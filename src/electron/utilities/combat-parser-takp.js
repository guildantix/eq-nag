const _ = require( 'lodash' );
const { CombatParser } = require( './combat-parser' );
const { nagLog } = require( './nag-console' );

const renderDebugMessages = false;

// TODO: Zhay`s pet hits Vius Vex for 9075 points of damage.

/**
 * Sends to the main thread to log the message.
 * 
 * @param {string} message The message to log.
 * @param {any | undefined} payload The payload to log.
 * @param {boolean | undefined} isDebug If true, the message is a debug message.
 */
const log = ( message, payload, isDebug ) => {
    if ( !isDebug || renderDebugMessages ) {
        nagLog( {
            label: 'Combat Parser',
            message: message,
            payload: payload,
        } );
    }
}








/**
 * Executes the given regular expression against the given log line.
 * 
 * @returns {RegExpExecArray | null} The regular expression result.
 * 
 * @param {RegExp} rgx The combat regular expression to execute.
 * @param {string} logLine The log line to execute the regular expression against.
 */
const executCombatRgx = ( rgx, logLine ) => {
    rgx.lastIndex = 0;
    return rgx.exec( logLine );
}










const combatRgx = {
    // Melee damage. (learn|learns|) [https://regex101.com/r/oMsgre/3]
    // NOTES: 
    //  - If we change "points" to "point(s)?" then we can capture the 1 point of damage attacks, but the processing cost doesn't seem worth it.
    MeleeDamage: /^(?<actor>.*?) (?<attackType>backstab|backstabs|bash|bashes|bite|bites|claw|claws|crush|crushes|frenzy|frenzies|gore|gores|hit|hits|kick|kicks|maul|mauls|pierce|pierces|punch|punches|rend|rends|shoot|shoots|slam|slams|slash|slashes|slice|slices|smash|smashes|sting|stings|strike|strikes|sweep|sweeps+?) (?<target>.*) for (?<damage>[0-9]*) points of damage\.[\s]?(\((?<modifiers>.*)?\))?/gi,
    
    // Melee miss|es. [https://regex101.com/r/1sfdm4/1]
    MeleeMiss: /^(?<actor>.*?) (try|tries) to ([a-zA-Z0-9_]*) (?<target>.*), but ((?<defenseType>misses|miss))![\s]?(\((?<modifiers>.*)?\))?/gi,

    // Melee active defense. [https://regex101.com/r/9fsdCJ/2]
    ActiveDefense: /^(?<actor>.*?) (try|tries) to ([a-zA-Z0-9_]*) (?<target>.*), but ((\k<target> (?<defenseType>.*)))![\s]?(\((?<modifiers>.*)?\))?/gi,

    // Direct Damage spell attacks. [https://regex101.com/r/K5N1Ss/1]
    DirectDamage: /^(?<target>.*) was hit by non-melee for (?<damage>[0-9]*) points of damage\./gi,

    // Your Damage Over Time spell reports. [https://regex101.com/r/DaGnUf/2]
    YourDoT: /^(?<target>.*) has taken (?<damage>[0-9]*) damage from (?<actor>you)r (?<attackType>.*)\.[\s]?(\((?<modifiers>.*)?\))?/gi,

    // TAKP: TAKP doesn't distinguish between thorns and other spell damage.
    // Thorns: /^.*/gi,

    // TAKP: Only the person being healed has a logged message. Useless for metrics, removed for TAKP.
    // Healing: /^.*/gi,
    
    // ^${target} has been slain by [^!]*!$
    SlainBy: /^(?<target>.+?) (has|have) been slain by (?<actor>[^!]*)!$/gi,

    // ^You have slain ${target}!$
    YouHaveSlain: /^You have slain (?<target>.*)!$/gi,

    // ^${target} dies\.$
    // ^${target} died\.$
    Died: /(?<target>.+?) (died|dies)\.$/gi,

    // https://regex101.com/r/bdaD56/3
    GroupRaid: /\] (?<player>[A-Z][^\s]+?) (joined the|has left the|has joined the|have joined the)\s(raid|group)\.$/gi,

    // https://regex101.com/r/zL5Mr4/1
    Chat: /\] (?<player>.*) (tells the raid|tells the guild|tells the group),\s+'.*'$/gi,

    // https://regex101.com/r/I4wX9J/1
    PetLeader: /^(?<pet>.+?) says 'My leader is (?<player>.*)\.'/gi,

    // https://regex101.com/r/kOmGrB/2
    Charmed: /^(?<charmPet>.+?) (is|has been) charmed\.$/gi,

    // https://regex101.com/r/GiGkwf/1
    NecroCharmed: /^(?<charmPet>.+?) moans\.$/gi,

    // Not named NPC if it begins with A,a,An,an, or a lower case letter.
    NotNamedNpc: /^(?:A\s|An\s|a\s|an\s|[a-z])/,

}

// https://regex101.com/r/cqfoUU/2
// This won't capture anon people.
const playerWhoRgx = /^(OFFLINEMODE)?\[(?<level>\d+)\s(?<classTitleOrName>Savage Lord|Arch Arcanist|Arch Animist|Arch Mage|High Priest|Grave Lord|Feral Lord|Storm Warden|Arch Convoker|Arch Lich|Lord Protector|Forest Stalker|Dread Lord|Arch Magus|Stone Fist|Scourge Knight|Grand Archanist|Storm Caller|Grand Summoner|Holy Defender|.+?)\]?\s(:?\((?<classRealName>.*?)\)\])?\s?(?<player>.*?)\s\((?<raceName>.+?)\)\s/i;

class TakpCombatParser extends CombatParser {

    /** @type {RegExp} */
    _playerWhoRgx;

    /**
     * Constructs a new combat parser.
     * 
     * @param {string} myCharacterName The character name of the current log file owner.
     * @param {string} serverName The name of the server for the character.
     */
    constructor( myCharacterName, serverName ) {
        super( myCharacterName, serverName );
        
        this._playerWhoRgx = playerWhoRgx;

    }










    /**
     * Adds the given log line to the encounter events.
     * 
     * @param {string} logLine The log file line to process and add to the combat events.
     * @param {number | undefined} padTime The number of s to add to the time log.
     * @param {string | undefined} prevLog The previous log line.
     * @param {string | undefined} nextLog The next log line.
     */
    addCombatEvent( logLine, padTime, prevLog, nextLog ) {
        let timeLog = /^\[(?<timestamp>.*?)\]\s*(?<log>.*)/gi.exec( logLine )?.groups;
        if ( timeLog ) {

            let entry = {
                timestamp: timeLog.timestamp,
                log: timeLog.log,
            };
            
            this._updateEntityVerifications( [ entry.log ] );

            const timestamp = new Date( entry.timestamp );
            
            if ( padTime > 0 ) {
                timestamp.setSeconds( timestamp.getSeconds() + padTime );
            }
            
            let regxResult = null;

            // Dead tracking
            regxResult = executCombatRgx( combatRgx.SlainBy, entry.log );
            regxResult = regxResult == null ? executCombatRgx( combatRgx.YouHaveSlain, entry.log ) : regxResult;
            regxResult = regxResult == null ? executCombatRgx( combatRgx.Died, entry.log ) : regxResult;
            if ( regxResult !== null ) {
                this._addDeathEvent( timestamp, regxResult.groups.target, regxResult.groups.actor, logLine );
                log( 'Adding death event', { target: regxResult.groups.target, deadNpcs: this._encounterStats.deadNpcs }, true );
                return undefined;
            }

            // Charm tracking
            regxResult = executCombatRgx( combatRgx.Charmed, entry.log );
            regxResult = regxResult == null ? executCombatRgx( combatRgx.NecroCharmed, entry.log ) : regxResult;
            if ( regxResult !== null ) {
                this._addCharmEvent( timestamp, regxResult.groups.charmPet, logLine );
                return undefined;
            }

            regxResult = executCombatRgx( combatRgx.MeleeDamage, entry.log );
            if ( regxResult !== null ) {
                return this._addMeleeEvent( timestamp, regxResult.groups.actor, regxResult.groups.target, +regxResult.groups.damage, regxResult.groups.attackType, regxResult.groups.modifiers );
            }
            
            regxResult = executCombatRgx( combatRgx.MeleeMiss, entry.log );
            regxResult = regxResult == null ? executCombatRgx( combatRgx.ActiveDefense, entry.log ) : regxResult;
            if ( regxResult !== null ) {
                return this._addMeleeAvoidance( timestamp,  regxResult.groups.actor ,  regxResult.groups.target, regxResult.groups.defenseType, regxResult.groups.attackType, regxResult.groups.modifiers );
            }
            
            regxResult = executCombatRgx( combatRgx.DirectDamage, entry.log );
            if ( regxResult !== null ) {
                return this._addDetrimentalSpellEvent( timestamp, 'You', regxResult.groups.target, +regxResult.groups.damage, 'Non-melee', null, null );
            }

            regxResult = executCombatRgx( combatRgx.YourDoT, entry.log );
            if ( regxResult !== null ) {
                return this._addDetrimentalSpellEvent( timestamp, regxResult.groups.actor, regxResult.groups.target, +regxResult.groups.damage, regxResult.groups.attackType, regxResult.groups.resistType, regxResult.groups.modifiers );
            }
            
        }
    }
    
}

module.exports = {
    TakpCombatParser,
};
