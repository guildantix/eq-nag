const _ = require( 'lodash' );
const customAlphabet = require( 'nanoid' ).customAlphabet;
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const nanoid = customAlphabet( alphabet, 16 );
const { LogFileLocation } = require( '../data/log-file-location' );
const fs = require( 'fs' );
const StringUtilities = require( './string' );
const { ipcRenderer } = require( 'electron' );
const { VerifiedPlayersDb } = require( '../data/models/verified-players-db' );

class AttackModifiers {
    
    /** @type {boolean} */
    critical = false;
    /** @type {boolean} */
    flurry = false;
    /** @type {boolean} */
    lucky = false;
    /** @type {boolean} */
    riposte = false;
    /** @type {boolean} */
    dodge = false;
    /** @type {boolean} */
    parry = false;
    /** @type {boolean} */
    block = false;
    /** @type {boolean} */
    miss = false;
    /** @type {boolean} */
    strikethrough = false;
    /** @type {boolean} */
    wild_rampage = false;
    /** @type {boolean} */
    rampage = false;
    /** @type {boolean} */
    assassinate = false;
    /** @type {boolean} */
    headshot = false;
    /** @type {boolean} */
    double_bow_shot = false;
    /** @type {boolean} */
    deadly_strike = false;
    /** @type {boolean} */
    finishing_blow = false;
}

class LogRecord {
    /** @type {string} */
    actor;
    /** @type {string} */
    target;
    /** @type {string} */
    attackType;
    /** @type {string} */
    attackName;
    /** @type {boolean} */
    attackAvoided = false;
    /** @type {'debuff'|'direct damage'|'damage over time'|'direct heal'|'heal over time'} */
    spellType;
    /** @type {number} */
    damage;
    /** @type {number} */
    heal;
    /** @type {number} */
    overHeal;
    /** @type {boolean} */
    thorns;
    /** @type {AttackModifiers} */
    modifiers;
}

/** @type {Record<string, boolean>} */
let verifiedPlayers = {};
/** @type {Record<string, boolean>} */
let vertifiedPets = {};
/** @type {Record<string, boolean>} */
let vertifiedNpcs = {};
/** @type {Record<string, string>} */
let playerClasses = {};
/** @type {Record<string, string>} */
let petOwner = {};
/** @type {Record<string, boolean>} */
let unverifiedActors = {};

/** @type {string} */
let characterName = 'You';

/** @type {LogRecord[]} */
let encounterEvents = [];



let attackTypeMap = {
    'backstabs': 'backstab',
    'bashes': 'bash',
    'bites': 'bite',
    'claws': 'claw',
    'crushes': 'crush',
    'frenzies': 'frenzy',
    'gores': 'gore',
    'hits': 'hit',
    'kicks': 'kick',
    'learns': 'learn',
    'mauls': 'maul',
    'pierces': 'pierce',
    'punches': 'punch',
    'rends': 'rend',
    'shoots': 'shoot',
    'slams': 'slam',
    'slashes': 'slash',
    'slices': 'slice',
    'smashes': 'smash',
    'stings': 'sting',
    'strikes': 'strike',
    'sweeps': 'sweep',
    'backstab': 'backstab',
    'bash': 'bash',
    'bite': 'bite',
    'claw': 'claw',
    'crush': 'crush',
    'frenzy': 'frenzy',
    'gore': 'gore',
    'hit': 'hit',
    'kick': 'kick',
    'learn': 'learn',
    'maul': 'maul',
    'pierce': 'pierce',
    'punch': 'punch',
    'rend': 'rend',
    'shoot': 'shoot',
    'slam': 'slam',
    'slash': 'slash',
    'slice': 'slice',
    'smash': 'smash',
    'sting': 'sting',
    'strike': 'strike',
    'sweep': 'sweep',
}

let avoidTypeMap = {
    'dodges': 'dodge',
    'dodge': 'dodge',
    'parries': 'parry',
    'parry': 'parry',
    'ripostes': 'riposte',
    'riposte': 'riposte',
    'blocks': 'block',
    'block': 'block',
    'misses': 'miss',
    'miss': 'miss',
}

/**
 * Returns a unified name for the attack type.
 * 
 * @example 
 *          'backstabs' => 'backstab'
 *          'Touch of the Cursed XV' => 'Touch of the Cursed XV'
 * 
 * @returns {{name: string, type: 'melee'|'spell'}]}
 * 
 * @param {string} attackType The name of the attack type.
 */
function getAttackType( attackType ) {
    // regular expression to strip roman numerals or ranks from spell names: /^(?<spellName>.+?)(\s[IVXLCDM]+|\sRk\.\s[I]{2,3})?$/gi [https://regex101.com/r/xnoznH/1]
    let name = attackTypeMap[ attackType ];
    return {
        name: name ? name : attackType,
        type: name ? 'melee' : 'spell',
    };
}

/**
 * Returns the character name of the target and actor.
 * 
 * @remarks In the log, some references to the actor/target are himself, you, 
 *          etc.  This should map the value correctly.
 * 
 * @returns {{actor: string, target: string}}
 * 
 * @param {string} actor The name of the actor.
 * @param {string?} target The name of the actor.
 */
function getActorTargetNames( actor, target ) {
    let output = {
        actor: actor,
        target: target,
    };
        
    if ( actor === 'YOU' || actor === 'YOUR' || actor === 'you' || actor === 'You' ) {
        output.actor = characterName;
    }

    if ( target === 'YOU' || target === 'YOUR' || target === 'you' || target === 'You' ) {
        output.target = characterName;
    } else if ( target === 'himself' || target === 'herself' ) {
        output.target = actor;
    }

    return output;
}

/**
 * Adds a new melee event to the encounter.
 * 
 * @param {string} actor The name of the actor.
 * @param {string} target The name of the target.
 * @param {number} damage The damage amount.
 * @param {string} attackType The attack type.
 * @param {string?} modifiers The modifiers of the attack.
 */
function addMeleeEvent( actor, target, damage, attackType, modifiers ) {
    let names = getActorTargetNames( actor, target );
    let attackTypeName = getAttackType( attackType );

    let rec = new LogRecord();
    rec.actor = names.actor;
    rec.target = names.target;
    rec.attackType = attackTypeName.type;
    rec.attackName = attackTypeName.name;
    rec.damage = damage;
    rec.thorns = false;
    rec.modifiers = new AttackModifiers();
    rec.modifiers.critical = modifiers?.indexOf( 'Critical' ) > -1;
    rec.modifiers.flurry = modifiers?.indexOf( 'Flurry' ) > -1;
    rec.modifiers.lucky = modifiers?.indexOf( 'Lucky' ) > -1;
    rec.modifiers.riposte = modifiers?.indexOf( 'Riposte' ) > -1;
    rec.modifiers.strikethrough = modifiers?.indexOf( 'Strikethrough' ) > -1;
    rec.modifiers.wild_rampage = modifiers?.indexOf( 'Wild Rampage' ) > -1;
    rec.modifiers.rampage = modifiers?.indexOf( 'Rampage' ) > -1;
    rec.modifiers.assassinate = modifiers?.indexOf( 'Assassinate' ) > -1;
    rec.modifiers.headshot = modifiers?.indexOf( 'Headshot' ) > -1;
    rec.modifiers.double_bow_shot = modifiers?.indexOf( 'Double Bow Shot' ) > -1;
    rec.modifiers.deadly_strike = modifiers?.indexOf( 'Deadly Strike' ) > -1;
    rec.modifiers.finishing_blow = modifiers?.indexOf( 'Finishing Blow' ) > -1;

    encounterEvents.push( rec );
}

/**
 * Adds a new defense event to the encounter.
 * 
 * @param {string} actor The name of the actor.
 * @param {string} target The name of the target.
 * @param {string} defenseType The type of defense.
 * @param {string?} modifiers The modifiers of the attack.
 */
 function addMeleeAvoidance( actor, target, defenseType, modifiers ) {
    let names = getActorTargetNames( actor, target );
    let attackTypeName = getAttackType( attackType );
    let avoidTypeName = avoidTypeMap[ defenseType ];

    let rec = new LogRecord();
    rec.actor = names.actor;
    rec.target = names.target;
    rec.attackType = attackTypeName.type;
    rec.attackName = attackTypeName.name;
    rec.attackAvoided = true;
    rec.modifiers = new AttackModifiers();
    rec.modifiers.dodge = avoidTypeName === 'dodge';
    rec.modifiers.parry = avoidTypeName === 'parry';
    rec.modifiers.riposte = avoidTypeName === 'riposte';
    rec.modifiers.block = avoidTypeName === 'block';
    rec.modifiers.miss = avoidTypeName === 'miss';

    encounterEvents.push( rec );
}

/**
 * Adds a new detrimental spell event to the encounter.
 * 
 * 
 * @param {string} actor The name of the actor.
 * @param {string} target The name of the target.
 * @param {number} damage The damage amount.
 * @param {string} attackType The name of the spell.
 * @param {string?} resistType The resist check of the spell.
 * @param {string?} modifiers The modifiers of the spell.
 */
function addDetrimentalSpellEvent( actor, target, damage, attackType, resistType, modifiers ) {
    let names = getActorTargetNames( actor, target );
    let attackTypeName = getAttackType( attackType );

    let rec = new LogRecord();
    rec.actor = names.actor;
    rec.target = names.target;
    rec.attackType = attackTypeName.type;
    rec.attackName = attackTypeName.name;
    rec.damage = damage;
    rec.thorns = false;
    rec.modifiers = new AttackModifiers();
    rec.modifiers.critical = modifiers?.indexOf( 'Critical' ) > -1;
    rec.modifiers.lucky = modifiers?.indexOf( 'Lucky' ) > -1;
    rec.modifiers.strikethrough = modifiers?.indexOf( 'Strikethrough' ) > -1;

    encounterEvents.push( rec );
}

/**
 * Adds a new beneficial spell event to the encounter.
 * 
 * @param {string} actor The name of the actor.
 * @param {string} target The name of the target.
 * @param {string} healDuration The capture group for the heal duration.
 * @param {number} healActual The healing applied to the target.
 * @param {string} healType The name of the heal spell.
 * @param {number?} healLiteral The total amount of possible healing, if supplied in the capture groups.
 * @param {string?} modifiers The modifiers of the spell.
 */
function addBeneficialSpellEvent(actor, target, healDuration, healActual, healType, healLiteral, modifiers) {
    let names = getActorTargetNames( actor, target );

    let rec = new LogRecord();
    rec.actor = names.actor;
    rec.target = names.target;
    rec.attackType = healType;
    rec.attackName = healDuration === 'over time for' ? 'heal over time' : 'direct heal';
    rec.heal = healActual;
    rec.overHeal = healLiteral > 0 ? healLiteral - healActual : 0;
    rec.thorns = false;
    rec.modifiers = new AttackModifiers();
    rec.modifiers.critical = modifiers?.indexOf( 'Critical' ) > -1;
    rec.modifiers.lucky = modifiers?.indexOf( 'Lucky' ) > -1;

    encounterEvents.push( rec );
}

/**
 * Adds a new thorns event to the encounter.
 * 
 * @param {string} actor The name of the actor.
 * @param {string} target The name of the target.
 * @param {number} damage The thorns damage.
 */
function addThornsEvent( actor, target, damage ) {
    let names = getActorTargetNames( actor, target );

    let rec = new LogRecord();
    rec.actor = names.actor;
    rec.target = names.target;
    rec.attackType = 'thorns';
    rec.damage = damage;
    rec.thorns = true;
    rec.modifiers = new AttackModifiers();

    encounterEvents.add( rec );
}

let combatRegex = [
    // Melee damage. (learn|learns|) [https://regex101.com/r/oMsgre/2]
    // NOTES: 
    //  - If we change "points" to "point(s)?" then we can capture the 1 point of damage attacks, but the processing cost doesn't seem worth it.
    /^(?<actor>.*?) (?<attackType>backstab|backstabs|bash|bashes|bite|bites|claw|claws|crush|crushes|frenzy|frenzies|gore|gores|hit|hits|kick|kicks|maul|mauls|pierce|pierces|punch|punches|rend|rends|shoot|shoots|slam|slams|slash|slashes|slice|slices|smash|smashes|sting|stings|strike|strikes|sweep|sweeps+?) (?<target>.*) for (?<damage>[0-9]*) points of damage\.[\s]?(\((?<modifiers>.*)?\))?/gi,

    // Melee miss|es. [https://regex101.com/r/1sfdm4/1]
    /^(?<actor>.*?) (try|tries) to ([a-zA-Z0-9_]*) (.*), but ((?<defenseType>misses|miss))![\s]?(\((?<modifiers>.*)?\))?/gi,

    /// Melee active defense. [https://regex101.com/r/9fsdCJ/2]
    /^(?<actor>.*?) (try|tries) to ([a-zA-Z0-9_]*) (?<target>.*), but ((\k<target> (?<defenseType>.*)))![\s]?(\((?<modifiers>.*)?\))?/gi,

    // Direct Damage spell attacks. [https://regex101.com/r/XBbPTp/2]
    /^(?<actor>.*) hit (?<target>.*) for (?<damage>[0-9]*) points of (?<resistType>[a-zA-Z0-9_]*) damage by (?<attackType>.*)\.[\s]?(\((?<modifiers>.*)?\))?/gi,

    // Your Damage Over Time spell reports. [https://regex101.com/r/DaGnUf/2]
    /^(?<target>.*) has taken (?<damage>[0-9]*) damage from (?<actor>you)r (?<attackType>.*)\.[\s]?(\((?<modifiers>.*)?\))?/gi,

    // Other Damage Over Time spell reports. [https://regex101.com/r/PLpfT1/2]
    /^(?<target>.*) (has|have) taken (?<damage>[0-9]*) damage from (?<attackType>.*) by (?<actor>.*)\.[\s]?(\((?<modifiers>.*)?\))?/gi,

    // Thorns damage. [https://regex101.com/r/w4h5xP/1]
    /^(?<target>.*) is pierced by (?<actor>.+?)('s)? (?<attackType>thorns) for (?<damage>[0-9]*) points of non-melee damage\./gi,

    // Healing [https://regex101.com/r/8Xtkrq/1]
    /^(?<actor>.+?) healed (?<target>.+?) (?<healDuration>over time for|for) (?<healActual>[0-9]*) (\((?<healLiteral>[0-9]*)\) )?hit points by (?<healType>.+?)\.[\s]?(\((?<modifiers>.*)?\))?/gi,
];


    // (?<attackType>[(backstab)|(bash)|(bite)|(claw)|(crush)|(frenz)|(gore)|(hit)|(kick)|(learn)|(maul)|(pierce)|(punch)|(rend)|(shoot)|(slam)|(slash)|(slice)|(smash)|(sting)|(strike)|(sweep)]+?)
    // (?<attackType>[(backstab|backstab)|(bash|bashes)|(bite|bites)|(claw|claws)]+?)


    // (?<attackType>[(backstab|backstabs|bash|bashes|bite|bites|claw|claws|crush|crushes|frenzy|frenzies|gore|gores|hit|hits|kick|kicks|learn|learns|maul|mauls|pierce|pierces|punch|punches|rend|rends|shoot|shoots|slam|slams|slash|slashes|slice|slices|smash|smashes|sting|stings|strike|strikes|sweep|sweeps)]+?)

    // (?<attackType>[(backstab|backstabs)|(bash|bashes)|(bite|bites)|(claw|claws)|(crush|crushes)|(frenzy|frenzies)|(gore|gores)|(hit|hits)|(kick|kicks)|(learn|learns)|(maul|mauls)|(pierce|pierces)|(punch|punches)|(rend|rends)|(shoot|shoots)|(slam|slams)|(slash|slashes)|(slice|slices)|(smash|smashes)|(sting|stings)|(strike|strikes)|(sweep|sweeps)]+?)

    // (?<attackType>[(backstab|backstabs)|(bash|bashes)|(bite|bites)|(claw|claws)|(crush|crushes)|(frenzy|frenzies)|(gore|gores)|(hit|hits)|(kick|kicks)|(learn|learns)|(maul|mauls)|(pierce|pierces)|(punch|punches)|(rend|rends)|(shoot|shoots)|(slam|slams)|(slash|slashes)|(slice|slices)|(smash|smashes)|(sting|stings)|(strike|strikes)|(sweep|sweeps)]+?)

    // (?<attackType>[(backstab|backstabs|bash|bashes|bite|bites|claw|claws|crush|crushes|frenzy|frenzies|gore|gores|hit|hits|kick|kicks|learn|learns|maul|mauls|pierce|pierces|punch|punches|rend|rends|shoot|shoots|slam|slams|slash|slashes|slice|slices|smash|smashes|sting|stings|strike|strikes|sweep|sweeps)]+?)

class CombatParser {

    /** @type {number} */
    chunkSize = 1048576;
    /** @type {number} */
    chunks = 50;

    constructor() { }

    /**
     * Loads the death recap data.
     * 
     * @param {string} logFilePath The full path to the log file to process.
     * @param {number} lineNo The line number at which death occurred.
     */
    loadDeathRecap( logFilePath ) {
        ipcRenderer.on( 'verified-players:get',
            /**
             * Handles the event.
             * 
             * @param {any} event Event args.
             * @param {VerifiedPlayersDb} data Verified players data.
             */
            ( event, data ) => {
            
            }
        );
        ipcRenderer.send( 'verified-players:get' );
        
        // parse the entire log file for player data.
        // find the encounter duration.
    }










    /**
     * Queries the specified log file for all player deaths.
     * 
     * @param {string} logFilePath The full path to the log file to query.
     * @param {(found: LogFileLocation[]) => void} callback After the file has been parsed, callback will be executed with the results.
     */
    findAllDeaths( logFilePath, callback ) {
        /** @type {LogFileLocation[]} */
        let deathsFound = [];
        
        fs.open( logFilePath, 'r', ( err, fd ) => {
            // let read = 0;
            
            if ( fd ) {
                let file = fd;
                let fstats = fs.fstatSync( file );

                let position = 0;
                let lineNo = 0;
                /** @type {string} */
                let danglyBits = null;

                let readFile = () => {
                    let rsize = position + ( this.chunkSize * this.chunks ) > fstats.size ? fstats.size - position : ( this.chunkSize * this.chunks );
    
                    fs.read( file, Buffer.alloc( rsize ), 0, rsize, position, ( err, bytecount, buff ) => {

                        // read += bytecount;
                        position += bytecount;
    
                        let lines = ( ( danglyBits == null ? '' : danglyBits ) + buff.toString( 'utf-8', 0, bytecount ) ).split( /\r\n|\r|\n/gmi );

                        danglyBits = lines.pop();

                        for ( let i = 0; i < lines?.length; i++ ) {
                            lineNo++;
                            // https://regex101.com/r/a4YxfW/1
                            let e = /^\[(?<timestamp>.*?)\]\s*You have been slain by (?<slayer>[^!]*)!$/gi.exec( lines[ i ] );
                            if ( e ) {
                                let log = new LogFileLocation();
                                
                                log.lineNo = lineNo;
                                log.description = `You have been slain by ${e.groups.slayer}!`;
                                log.raw = lines[ i ];
                                log.timestamp = new Date( e.groups.timestamp );
                                log.logFilePath = logFilePath;

                                deathsFound.push( log );
                            }
                        }

                        if ( bytecount <= 0 ) {
                            callback( deathsFound );
                        } else if ( position < fstats.size ) {
                            setTimeout( () => readFile(), 50 );
                        } else {
                            callback( deathsFound );
                        }
                    } );
                    
                }

                readFile();
                
            }
        } );

        return deathsFound;
    }










    /**
     * Reads an entire log file, executing fn on each line.
     * 
     * @param {string} logFilePath The full path to the log file.
     * @param {(string) => void} fn Executed on each line in the log file.
     */
    readLogFile( logFilePath, fn ) {
        
    }
    
}

module.exports = CombatParser;
