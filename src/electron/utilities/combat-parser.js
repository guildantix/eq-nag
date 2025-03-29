const _ = require( 'lodash' );
const customAlphabet = require( 'nanoid' ).customAlphabet;
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const nanoid = customAlphabet( alphabet, 16 );
const { LogFileLocation } = require( '../data/log-file-location' );
const fs = require( 'fs' );
const StringUtilities = require( './string' );
const { ipcRenderer } = require( 'electron' );
const { VerifiedPlayersDb } = require( '../data/models/verified-players-db' );
const { DateUtilities } = require( './dates' );
const { DeathRecapEncounterMob, DeathRecapRaidStats, DeathRecapEncounter, DeathRecapLog, DeathRecapDamageSource, DeathRecapModel } = require( '../data/models/death-recap' );
const {
    AttackModifiers,
    LogRecord,
    avoidTypeMap,
    attackTypeMap,
    PlayerInfo,
    PlayerDps,
    EncounterStats,
    PlayerEncounterStats,
    PetDps,
    ServerCombatModel,
    DpsMeterSettings,
    EncounterResetEventArgs,
    EncounterStatsEventArgs,
    EntityStatsModel,
} = require( '../data/models/combat-parser' );
const { FctModel } = require( '../data/models/fct' );
const { CharacterModel } = require( '../data/models/character' );
const { nagLog, nagException } = require( './nag-console' );
const { getEverQuestClassName, getEverQuestClassFromTitle, getEverQuestClassAbbreviation } = require( './everquest' );

const playerNpcInteractionTimeoutMs = 2000;
const npcTimeoutMs = 8000;
const namedNpcTimeoutMs = 8000; // 4 * npcTimeoutMs
const encounterTimeoutMs = 8000;
const deathCheckDelayMs = npcTimeoutMs + 100;
const renderDebugMessages = false;

//  Preamble: When connected to a server, each connected peer must end encounters at the same time.
//
//  1. ✅ Use statistics to end encounters.  Is there a named in the encounter? Yes? Longer timeout period to end encounter.
//  2. ✅ New NPC appears in the encounter, add them to a list.
//  3. ✅ When that NPC is dead, remove them from the list.
//  4. ✅ Start a "timeout" of 8 seconds.  If no new combat information is received with that NPC name, end the encounter.
//  5. ✅ Once all NPCs are dead, end the encounter.
//  6. ✅ If the NPC is named then extend the timeout to 30 seconds.
//  7. ✅ Receiving combat logs of peers with the same encounter id will extend the timeout.

// TODO: Keep combat stats on the renderer so the user may choose to look at the stats of a closed encounter.
// TODO: Add the ability for the user to choose between overall data, and data for the current encounter.
// TODO: Update settings so that FCT can be enabled without the DPS meters.
// TODO: Front-end encounters should be able to combine with multiple encounters.
// TODO: Shared combat data should be incremental instead of total, allowing the merging of shared data.
// TODO: When a charm pet is found, remove it from the pets list.  Charm pets are not pets, but are still pets in the encounter.
// TODO: Share charm pet information with the server.
// TODO: Do not show the name of an NPC in the encounter if it is not attacked by a player.

// TODO: Run an update script that fixes in the petOwners list:
//          "A huge slime hits Warrie`s pet": "A huge slime hits Warrie",

// TODO: List of keystone events that should be shared:
//      Charm pets
//      NPC deaths
//      Player deaths


// TODO: !!Important!! End encounters immediately when everything is dead. Allow
// the user to choose their own "encounter timeout", but this value will be for
// display purposes only. This will require some renderer work to calculate totals
// for a group of encounters. This will allow encounters to sync up with other
// users, and still allow the user to set their own settings. Just use a flat x ms
// timeout for all things. Let the renderer handle the display.




// Notes: Npcs must timeout if an NPC has not hit a player/pet in x time.
// Because there are NPCs in the npcs list that are charm pets, and are never
// removed because the "has been charmed"/"moans" text doesn't appear in our
// logs, the encounter goes into "long wait" mode instead of the quick on
// death wait mode.

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
    return rgx.exec( logLine );
}










/**
 * Minifies the given log record.  Deleting undefined properties and false modifiers.
 * 
 * @returns {any} Returns the minified log record.
 * 
 * @param {LogRecord} rec The log record to minify.
 */
const minifyLogRecord = ( rec ) => {

    /** @type {LogRecord} */
    let minifiedRec = Object.assign( new LogRecord(), rec );
    minifiedRec.modifiers = Object.assign( new AttackModifiers(), rec.modifiers );

    let keys = Object.keys( minifiedRec );
    for ( let i = 0; i < keys.length; i++ ) {
        const key = keys[ i ];
        if ( minifiedRec[ key ] === undefined ) {
            delete minifiedRec[ key ];
        }
    }

    let mKeys = Object.keys( minifiedRec.modifiers );
    for ( let i = 0; i < mKeys.length; i++ ) {
        const key = mKeys[ i ];
        if ( minifiedRec.modifiers[ key ] === false ) {
            delete minifiedRec.modifiers[ key ];
        }
    }

    return minifiedRec;
}










/**
 * Minifies the given list of event logs.
 * 
 * @returns Returns the minified encounter events.
 * 
 * @param {LogRecord[]} eventLogs The list of event logs to minify.
 */
const minifyCombatLogs = ( eventLogs ) => {
    return eventLogs.map( m => minifyLogRecord( m ) );
}










const combatRgx = {
    // Melee damage. (learn|learns|) [https://regex101.com/r/oMsgre/3]
    // NOTES: 
    //  - If we change "points" to "point(s)?" then we can capture the 1 point of damage attacks, but the processing cost doesn't seem worth it.
    // MeleeDamage: /^(?<actor>.*?) (?<attackType>backstab|backstabs|bash|bashes|bite|bites|claw|claws|crush|crushes|frenzy|frenzies|gore|gores|hit|hits|kick|kicks|maul|mauls|pierce|pierces|punch|punches|rend|rends|shoot|shoots|slam|slams|slash|slashes|slice|slices|smash|smashes|sting|stings|strike|strikes|sweep|sweeps+?) (?<target>.*) for (?<damage>[0-9]*) points of damage\.[\s]?(\((?<modifiers>.*)?\))?/gi,
    // Maxxer [https://regex101.com/r/CNjMVp/2]
    MeleeDamage: /^(?<actor>.*?) (?<attackType>(?:b(?:a(?:ckstabs?|sh(?:es)?)|ites?))|c(?:laws?|rush(?:es)?)|frenz(?:y|ies)|gores?|hits?|kicks?|mauls?|p(?:ierces?|unch(?:es)?)|rends?|s(?:hoots?|l(?:a(?:ms?|sh(?:es)?)|ices?)|mash(?:es)?|t(?:ings?|rikes?)|weeps?)) (on\s)?(?<target>.*) for (?<damage>[0-9]*) points of damage\.[\s]?(\((?<modifiers>.*)?\))?/i,
    
    // Melee miss|es. [https://regex101.com/r/1sfdm4/1]
    MeleeMiss: /^(?<actor>.*?) (try|tries) to ([a-zA-Z0-9_]*) (?<target>.*), but ((?<defenseType>misses|miss))![\s]?(\((?<modifiers>.*)?\))?/i,

    // Melee active defense. [https://regex101.com/r/9fsdCJ/2]
    ActiveDefense: /^(?<actor>.*?) (try|tries) to ([a-zA-Z0-9_]*) (?<target>.*), but ((\k<target> (?<defenseType>.*)))![\s]?(\((?<modifiers>.*)?\))?/i,

    // Direct Damage spell attacks. [https://regex101.com/r/XBbPTp/2]
    DirectDamage: /^(?<actor>.*) hit (?<target>.*) for (?<damage>[0-9]*) points of (?<resistType>[a-zA-Z0-9_]*) damage by (?<attackType>.*)\.[\s]?(\((?<modifiers>.*)?\))?/i,

    // Your Damage Over Time spell reports. [https://regex101.com/r/DaGnUf/2]
    YourDoT: /^(?<target>.*) has taken (?<damage>[0-9]*) damage from (?<actor>you)r (?<attackType>.*)\.[\s]?(\((?<modifiers>.*)?\))?/i,

    // Other Damage Over Time spell reports. [https://regex101.com/r/PLpfT1/2]
    OtherDoT: /^(?<target>.*) (has|have) taken (?<damage>[0-9]*) damage from (?<attackType>.*) by (?<actor>.*)\.[\s]?(\((?<modifiers>.*)?\))?/i,

    // Other Damage Over Time spell reports. [https://regex101.com/r/voSAFu/1]
    SelfDot: /^(?<target>.*) have taken (?<damage>[0-9]*) damage from (?<attackType>.*)\.[\s]?(\((?<modifiers>.*)?\))?/i,

    // Thorns damage. [https://regex101.com/r/w4h5xP/1]
    Thorns: /^(?<target>.*) is pierced by (?<actor>.+?)('s)? (?<attackType>thorns) for (?<damage>[0-9]*) points of non-melee damage\./,

    // Healing [https://regex101.com/r/8Xtkrq/2]
    Healing: /^(?<actor>.+?) (has been\s)?healed (?<target>.+?) (?<healDuration>over time for|for) (?<healActual>[0-9]*) (\((?<healLiteral>[0-9]*)\) )?hit points by (?<healType>.+?)\.[\s]?(\((?<modifiers>.*)?\))?/i,
    
    // ^${target} has been slain by [^!]*!$
    SlainBy: /^(?<target>.+?) (has|have) been slain by (?<actor>.+?)!/i,

    // ^You have slain ${target}!$
    YouHaveSlain: /^(?<actor>You) have slain (?<target>.+?)!/i,

    // ^${target} dies\.$
    // ^${target} died\.$
    Died: /(?<target>.+?) (died|dies)\.$/i,

    // https://regex101.com/r/bdaD56/3
    GroupRaid: /\] (?<player>[A-Z][^\s]+?) (joined the|has left the|has joined the|have joined the)\s(raid|group)\.$/i,

    // https://regex101.com/r/zL5Mr4/1
    Chat: /\] (?<player>.*) (tells the raid|tells the guild|tells the group),\s+'.*'$/i,

    // https://regex101.com/r/EiZc5a/1
    Achievement: /\] Your guildmate (?<player>.*) has completed (.*) achievement\.$/i,

    // https://regex101.com/r/fjHm0j/1
    Defensive: /^(?<actor>.+?)\b\s{0,1}'{0,1}s{0,1}\b.* assumes a defensive fighting style\./i,

    // https://regex101.com/r/AjOthH/1
    Stonewall: /^(?<actor>.+?)\b\s{0,1}'{0,1}s{0,1}\b.* body becomes as hard as stone\./i,

    // https://regex101.com/r/Hz44Hy/1
    FinalStand: /^(?<actor>.+?)\b\s{0,1}'{0,1}s{0,1}\b.* steels themselves for a final stand\./i,

    // https://regex101.com/r/e1bXss/1
    LastStand: /^(?<actor>.+?)\b\s{0,1}'{0,1}s{0,1}\b.* steels themselves for a last stand\./i,

    // https://regex101.com/r/cPfBq5/1
    PetLeader: /^(?<pet>.+?) says, 'My leader is (?<player>.*)\.'/i,

    // https://regex101.com/r/Sm6SVR/1
    PetAttack: /^(?<pet>.+?) told you, 'Attacking (?<target>.*) Master\.'/i,

    // https://regex101.com/r/nVsfms/1
    NamedPet: /^(?<pet>(?<player>.+?)`s (pet|familiar))\s/i,

    // https://regex101.com/r/kOmGrB/2
    Charmed: /^(?<charmPet>.+?) (is|has been) charmed\./i,

    // https://regex101.com/r/GiGkwf/1
    NecroCharmed: /^(?<charmPet>.+?) moans\./i,

    // Not named NPC if it begins with A,a,An,an, or a lower case letter.
    NotNamedNpc: /^(?:A\s|An\s|a\s|an\s|[a-z])/,

    // The following match LastStand
    // CulminatingStand: null,
    // UltimateStand: null,
    // ResoluteStand: null,
}

// https://regex101.com/r/cqfoUU/2
// This won't capture anon people.
// classTitleOrName will capture any one-word class name by default, however if the class title has spaces it must be added to the list.
const playerWhoRgx = /^(OFFLINEMODE)?\[(?<level>\d+)\s(?<classTitleOrName>Savage Lord|Arch Arcanist|Arch Animist|Arch Mage|High Priest|Grave Lord|Feral Lord|Storm Warden|Arch Convoker|Arch Lich|Lord Protector|Forest Stalker|Dread Lord|Arch Magus|Stone Fist|Scourge Knight|Grand Archanist|Storm Caller|Grand Summoner|Holy Defender|.+?)\]?\s(:?\((?<classRealName>.*?)\)\])?\s?(?<player>.*?)\s\((?<raceName>.+?)\)\s/i;




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

    /** @type {string[]} */
    _unknownEntities = [];
    /** @type {string[]} */
    _verifiedPlayers = []; // needs to be by server
    /** @type {string[]} */
    _verifiedNpcs = [];
    /** @type {string[]} */
    _verifiedPets = []; // needs to be by server
    /** @type {Record<string, string[]>} */
    _playerPets = {}; // needs to be by server
    /** @type {Record<string, string>} */
    _petOwners = {}; // needs to be by server
    /** @type {Record<string, PlayerInfo>} */
    _playerInfos = {}; // needs to be by server
    /** @type {string} */
    _serverName;
    /** @type {string[]} */
    _charmPets = [];

    /** @type {EntityStatsModel[]} */
    _entityStats = [];

    /** @type {CharacterModel[]} */
    _fctCharacters = [];

    /** @type {CharacterModel[]} */
    _myCharacters = [];

    /** @type {DpsMeterSettings} */
    _dpsMeterSettings = new DpsMeterSettings();

    /** @type {LogRecord[]} */
    encounterEvents = [];

    /** @type {{name: string, start: Date, duration: number, end: Date}[]} */
    encounterDefensiveTimers = [];

    /** @type {EncounterStats} */
    _encounterStats = undefined;

    /** @type {Record<string, string>} */
    _externalEncounterIds = {};

    /** @type {string[]} */
    _closedExternalEncounterIds = [];

    /** @type {string} */
    _characterName = 'You';

    /** @type {RegExp} */
    _playerWhoRgx;

    /** @type {number} */
    _encounterResetTimerId = undefined;

    /** @type {number|undefined} */
    #encounterNpcDeathTimeoutId = undefined;

    /** @type {(e: EncounterResetEventArgs) => void} */
    onEncounterReset = undefined;

    /** @type {() => void} */
    onReady = undefined;

    /** @type {boolean} */
    loaded = false;

    /** @type {boolean} */
    _updateServerStatistics = false;

    /**
     * Constructs a new combat parser.
     * 
     * @param {string} myCharacterName The character name of the current log file owner.
     * @param {string} serverName The name of the server for the character.
     */
    constructor( myCharacterName, serverName ) {
        
        this._playerWhoRgx = playerWhoRgx;

        this._characterName = myCharacterName ?? this._characterName;
        this._verifiedPlayers.push( this._characterName );
        nagLog( {
            label: 'Combat Parser',
            message: `initiating combat parser for ${this._characterName} on server ${serverName}`,
        }, true );
        this._serverName = serverName;

        ipcRenderer.on( 'character:get',
            /**
             * 
             * @param {Electron.IpcRendererEvent} event The electron event args.
             * @param {CharacterModel[]} data The list of characters.
             */
            ( event, data ) => {
                this._myCharacters = data;
                this._fctCharacters = data.filter( f => !f.disableFct );
                
                if ( serverName ) {
                    ipcRenderer.send( 'combat-database:get-server', serverName );
                }
        
            } );

        ipcRenderer.on( 'settings:get:dpsMeterSettings:generic',
        /**
         * 
         * @param {Electron.IpcRendererEvent} event The event args
         * @param {boolean} data True if enabled.
         */
        ( event, data ) => {
            this._dpsMeterSettings = data;
        } );

        ipcRenderer.on( `combat-database:get-server:${serverName}`,
            /**
             * Handles the get-server event.
             * 
             * @param {any} event The event args.
             * @param {ServerCombatModel} data The server combat model.
             */
            ( event, data ) => {
                this._loadServerData( data );

                this.loaded = true;
                if ( this.onReady ) {
                    this.onReady();
                }
            } );
        
        ipcRenderer
            .invoke( 'settings:get', { key: 'dpsMeterSettings', subscribe: true } )
            .then( data => {
                this._dpsMeterSettings = data;
            } );
        
        ipcRenderer.send( 'character:get' );

    }










    /**
     * Loads the given server data.
     * 
     * @param {ServerCombatModel} data The server data.
     */
    _loadServerData( data ) {
        if ( data ) {
            this._playerInfos = data.verifiedPlayers;
            this._verifiedPlayers = Object.keys( data.verifiedPlayers );
            this._verifiedNpcs = data.verifiedNpcs;
            this._verifiedPets = data.verifiedPets;
            this._petOwners = data.petOwners;

            // Add all of my server characters to the verified players list.
            let serverCharacters = this._myCharacters.filter( f => f.server === this._serverName );
            let scheduleSave = false;
            for ( let i = 0; i < serverCharacters.length; i++ ) {
                const character = serverCharacters[ i ];
                if ( !this._verifiedPlayers.includes( character.name ) ) {
                    this._verifiedPlayers.push( character.name );

                    if ( this._playerInfos[ character.name ] == null ) {
                        this._playerInfos[ character.name ] = {
                            level: 0,
                            className: getEverQuestClassName( character.class ),
                            raceName: null,
                        };
                    }

                    scheduleSave = true;
                }
            }

            // Calculate the pets each player has.
            this._playerPets = this._playerPets ?? {};
            let petKeys = Object.keys( this._petOwners );
            for ( let i = 0; i < petKeys.length; i++ ) {
                let pet = petKeys[ i ];
                let owner = this._petOwners[ pet ];
                if ( !this._playerPets[ owner ] ) {
                    this._playerPets[ owner ] = [];
                }
                this._playerPets[ owner ].push( pet );
            }

            if ( this._encounterStats ) {

                this._verifiedPlayers.forEach( f => {
                    if ( this._encounterStats.playerEvents[ f ] != null ) {
                        this._encounterStats.playerEvents[ f ].class = this._playerInfos[ f ].className;
                    }
                } );

                this._verifiedNpcs.forEach( f => {
                    // Remove from player events
                    if ( this._encounterStats.playerEvents[ f ] != null ) {
                        delete this._encounterStats.playerEvents[ f ];
                    }
                } );

                this._verifiedPets.forEach( f => {
                    // Remove from player events
                    if ( this._encounterStats.playerEvents[ f ] != null ) {
                        delete this._encounterStats.playerEvents[ f ];
                    }
                } );
                
            }
    
            if ( scheduleSave ) {
                window.setTimeout( () => this._updateServerModel(), 0 );
            }
        }
    }









    
    /**
     * Updates the combat db with the current player/pet data.
     */
    _updateServerModel() {
        let server = new ServerCombatModel();

        server.server = this._serverName;
        server.verifiedPlayers = this._playerInfos;
        server.verifiedNpcs = this._verifiedNpcs;
        server.verifiedPets = this._verifiedPets;
        server.petOwners = this._petOwners;

        ipcRenderer.send( 'combat-database:put-server', server );
    }










    /**
     * Returns a list of encounter events matching the given criteria.
     * 
     * @returns {LogRecord[]} The list of encounter events.
     * 
     * @param {Date} start The start of the encounter.
     * @param {Date} end The end of the encounter.
     * @param {string} actor The name of the actor.
     * @param {string} target The name of the target.
     */
    getEncounterEvents( start, end, actor, target ) {
        let actorPets = this._playerPets[ actor ];
        let output = this.encounterEvents.filter( f => {
            return ( start == null || f.timestamp >= start ) && ( end == null || f.timestamp <= end ) && ( actor == null || f.actor === actor ) && ( target == null || f.target === target );
        } );

        if ( actorPets?.length > 0 ) {
            let petOutput = this.encounterEvents.filter( f => actorPets.includes( f.actor ) );
            output = output.concat( petOutput );
        }

        return output;
    }










    /**
     * Returns the current encounter stats.
     * 
     * @returns {EncounterStatsEventArgs | undefined} Returns the current encounter stats.
     */
    getCurrentEncounterStats() {

        // If there is no encounter, or the total damage in the encounter is under the minimum value, then return undefined.
        let underMinDmg = this._dpsMeterSettings.encounterMinimumDamage > 0 && ( this._encounterStats?.encounterDamageDone ?? 0 ) < this._dpsMeterSettings.encounterMinimumDamage;
        if ( this._encounterStats == undefined || underMinDmg ) {
            return undefined;
        }

        let output = {
            encounter: Object.assign( new EncounterStats(), this._encounterStats ),
            verifiedPlayers: [ ...this._verifiedPlayers ],
            verifiedNpcs: [ ...this._verifiedNpcs ],
            verifiedPets: [ ...this._verifiedPets ],
            petOwners: Object.assign( {}, this._petOwners ),
            playerDps: [],
        };

        output.encounter.logs = [];
        output.encounter.ownedLogs = [];

        return output;
    }










    /**
     * Returns the DPS for a 10 second encounter.
     * 
     * @description Returns an empty array if the total encounter damage done 
     *              is less than the minimum encounter damage value.
     * 
     * @returns {{playerDps: PlayerDps[], npcs: string[], encounterId: string, start: Date} | undefined} The list of player DPS.
     */
    getEncounterOutgoingDps() {
        /** @type {PlayerDps[]} */
        let output = [];

        let underMinDmg = this._dpsMeterSettings.encounterMinimumDamage > 0 && ( this._encounterStats?.encounterDamageDone ?? 0 ) < this._dpsMeterSettings.encounterMinimumDamage;
        if ( this._encounterStats == undefined || underMinDmg ) {
            return undefined;
        }

        for ( let i = 0; i < this._verifiedPlayers.length; i++ ) {
            let playerEvents = this._encounterStats?.playerEvents[ this._verifiedPlayers[ i ] ];
            if ( playerEvents ) {
                let playerDps = new PlayerDps();

                playerDps.name = playerEvents.name;
                playerDps.class = playerEvents.class;
                playerDps.dps = 0;
                playerDps.hps = 0;
                playerDps.damage = 0;
                playerDps.healing = 0;
                playerDps.time = 0;
                playerDps.pets = [];

                for ( let j = 0; j < playerEvents.playerDpsOutgoing.length; j++ ) {
                    const event = playerEvents.playerDpsOutgoing[ j ];
                    playerDps.damage += event.damage;
                    playerDps.healing += event.healing;
                    playerDps.time += event.time;

                    for ( let k = 0; k < event.pets.length; k++ ) {
                        const petDps = event.pets[ k ];
                        let pet = playerDps.pets.find( f => f.name === petDps.name );
                        if ( !pet ) {
                            pet = new PetDps();
                            pet.name = petDps.name;
                            pet.class = petDps.class;
                            pet.damage = 0;
                            pet.healing = 0;
                            pet.time = 0;
                            playerDps.pets.push( pet );
                        }

                        pet.damage += petDps.damage;
                        pet.healing += petDps.healing;

                    }
                }

                // Calculate the DPS and HPS.
                playerDps.dps = playerDps.damage / ( playerDps.time > 0 ? playerDps.time : 1 );
                playerDps.hps = playerDps.healing / ( playerDps.time > 0 ? playerDps.time : 1 );

                playerDps.pets.forEach( f => {
                    f.dps = f.damage / ( playerDps.time > 0 ? playerDps.time : 1 );
                    f.hps = f.healing / ( playerDps.time > 0 ? playerDps.time : 1 );
                } );

                output.push( playerDps );
            }
        }

        return {
            playerDps: output,
            npcs: this._encounterStats.npcs,
            encounterId: this._encounterStats.encounterId,
            start: this._encounterStats.encounterStart,
        };
    }










    /**
     * Returns the list of log records for the specified character.
     * 
     * @returns {{rawLogs: string[], playerStats: PlayerEncounterStats}} The list of log records.
     * 
     * @param {string} character The name of the character to pull log records for.
     * @param {boolean | undefined} untransmittedOnly If true, will only pull untransmitted log records.
     */
    getCharacterFullEncounter( character, untransmittedOnly ) {

        if ( !character ) {
            nagException( `getCharacterFullEncounter: character is undefined.` );
            return {
                logRecords: [],
                playerStats: undefined,
            };
        }

        /** @type {string[]} */
        let logs = [];

        if ( this._encounterStats ) {
            let characterOwned = [ character, ...this._playerPets[ character ] ];
            logs = this._encounterStats.ownedLogs.filter( f => characterOwned.includes( f.actor ) || characterOwned.includes( f.target ) );
        }

        return {
            rawLogs: this._encounterStats?.ownedLogs.filter( f => f.actor === character || f.target === character ) ?? [],
            playerStats: this._encounterStats?.playerEvents[ character ],
        };
    }










    /**
     * Returns the player stats for the specified player.
     * 
     * @param {string} character The name of the character.
     * @returns {{encounterId: string, playerStats: PlayerEncounterStats} | undefined}
     */
    getCharacterStatistics( character ) {
        return this._encounterStats && this._encounterStats.playerEvents[ character ] ? {
            encounterId: this._encounterStats.encounterId,
            playerStats: this._encounterStats.playerEvents[ character ],
        } : undefined;
    }










    /**
     * Imports the given player encounter stats.  Encounter stats are the 
     * calculated stats for the player during the encounter.
     * 
     * @param {string} playerName The name of the character.
     * @param {PlayerEncounterStats} playerStats The player's encounter stats.
     * @param {string} externalEncounterId The player's external encounter id.
     */
    importPlayerEncounterStats( playerName, playerStats, externalEncounterId ) {

        // If the encounter is already closed, then we need to ignore the data.
        if ( !this._closedExternalEncounterIds.includes( externalEncounterId ) ) {
            if ( !this._verifiedPlayers.includes( playerName ) ) {
                this._verifiedPlayers.push( playerName );
                let eNpcIdx = this._encounterStats.npcs.indexOf( playerName );
                if ( eNpcIdx > -1 ) {
                    this._encounterStats.npcs.splice( eNpcIdx, 1 );
                }
                this._updateServerModel();
            }

            this._refreshEncounter();
            
            this._encounterStats.playerEvents[ playerName ] = playerStats;
            this._externalEncounterIds[ externalEncounterId ] = playerName;
        } else {
            nagLog( {
                label: 'Combat Parser',
                message: `Ignoring player stats import for ${playerName} due to encounter being closed.`,
            }, true );
        }

    }










    /**
     * Returns a list of log records for all characters on your profile.
     * 
     * @returns {LogRecord[]} The list of log records.
     * 
     * @param {boolean | undefined} untransmittedOnly If true, will only pull untransmitted log records.
     */
    getMyCharacterFullEncounter( untransmittedOnly ) {
        let output = [];

        this._myCharacters.forEach( c => output = output.concat( this.getCharacterFullEncounter( c.name, untransmittedOnly ) ) );

        return output;
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

            if ( this._encounterStats != null ) {
                this._encounterStats.logs.push( logLine );
            } else {
                this.#initializeEncounter( undefined, logLine );
            }

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

            regxResult = executCombatRgx( combatRgx.MeleeDamage, entry.log );
            if ( regxResult !== null ) {
                return this._addMeleeEvent( timestamp, regxResult.groups.actor, regxResult.groups.target, +regxResult.groups.damage, regxResult.groups.attackType, regxResult.groups.modifiers, logLine );
            }
            
            regxResult = executCombatRgx( combatRgx.MeleeMiss, entry.log );
            regxResult = regxResult == null ? executCombatRgx( combatRgx.ActiveDefense, entry.log ) : regxResult;
            if ( regxResult !== null ) {
                return this._addMeleeAvoidance( timestamp,  regxResult.groups.actor ,  regxResult.groups.target, regxResult.groups.defenseType, regxResult.groups.attackType, regxResult.groups.modifiers, logLine );
            }
            
            regxResult = executCombatRgx( combatRgx.DirectDamage, entry.log );
            regxResult = regxResult == null ? executCombatRgx( combatRgx.YourDoT, entry.log ) : regxResult;
            regxResult = regxResult == null ? executCombatRgx( combatRgx.OtherDoT, entry.log ) : regxResult;
            if ( regxResult !== null ) {
                return this._addDetrimentalSpellEvent( timestamp, regxResult.groups.actor, regxResult.groups.target, +regxResult.groups.damage, regxResult.groups.attackType, regxResult.groups.resistType, regxResult.groups.modifiers, logLine );
            }
            regxResult = regxResult == null ? executCombatRgx( combatRgx.SelfDot, entry.log ) : regxResult;
            if ( regxResult !== null ) {
                return this._addDetrimentalSpellEvent( timestamp, 'You', regxResult.groups.target, +regxResult.groups.damage, regxResult.groups.attackType, regxResult.groups.resistType, regxResult.groups.modifiers, logLine );
            }

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
            
            regxResult = executCombatRgx( combatRgx.Thorns, entry.log );
            if ( regxResult !== null ) {
                return this._addThornsEvent( timestamp,  regxResult.groups.actor ,  regxResult.groups.target , +regxResult.groups.damage, logLine );
            }
            
            regxResult = executCombatRgx( combatRgx.Healing, entry.log );
            if ( regxResult !== null ) {
                return this._addBeneficialSpellEvent( timestamp,  regxResult.groups.actor ,  regxResult.groups.target , regxResult.groups.healDuration, +regxResult.groups.healActual, regxResult.groups.healType, +regxResult.groups.healLiteral, regxResult.groups.modifiers, logLine );
            }

            regxResult = executCombatRgx( combatRgx.Defensive, entry.log );
            regxResult = regxResult == null ? executCombatRgx( combatRgx.Stonewall, entry.log ) : regxResult;
            regxResult = regxResult == null ? executCombatRgx( combatRgx.FinalStand, entry.log ) : regxResult;
            regxResult = regxResult == null ? executCombatRgx( combatRgx.LastStand, entry.log ) : regxResult;
            if ( regxResult !== null ) {
                let names = this._getActorTargetNames( regxResult.groups.actor, regxResult.groups.target );
                this.encounterDefensiveTimers.push( {
                    name: names.actor,
                    start: timestamp,
                    duration: 3 * 60,
                    end: DateUtilities.addSeconds( timestamp, 3 * 60 )
                } );
                return undefined;
            }

        }
    }










    /**
     * Loads the death recap data.
     * 
     * @param {string} logFilePath The full path to the log file to process.
     * @param {number?} lineNo The line number at which death occurred, if no value is provided loads the last death found in the log file.
     * @param {( data: any ) => void} callback Executed when the death recap data is ready.
     * @param {string} myCharacterName The character name of the log file owner.
     */
    loadDeathRecap( logFilePath, lineNo, myCharacterName, callback ) {

        let act = () => {
            this._doLoadDeathRecap( logFilePath, lineNo, callback );
        }

        if ( lineNo > 0 ) {
            act();
        } else {
            this.findAllDeaths( logFilePath, found => {
                if ( found?.length > 0 ) {
                    lineNo = found[ found.length - 1 ].lineNo;
                    act();
                } else {
                    // TODO: Display a message for No Deaths Found!
                }
            } );
        }
        // parse the entire log file for player data.
        // find the encounter duration.
    }










    /**
     * Perfoms the actual data logging methods for creating the death recap.
     * @private
     * 
     * @param {string} logFilePath The full path to the log file to process.
     * @param {number} lineNo The line number at which death occurred.
     * @param {( data: any ) => void} callback Executed when the death recap data is ready.
     */
    _doLoadDeathRecap( logFilePath, lineNo, callback ) {
        fs.open( logFilePath, 'r', ( err, fd ) => {
            
            if ( fd ) {
                let file = fd;
                let fstats = fs.fstatSync( file );

                let position = 0;
                let logLineNo = 0;
                /** @type {string} */
                let danglyBits = null;
                /** @type {string[]} */
                let prevLines = null;
                /** @type {string[]} */
                let currentLines = null;

                let readFile = () => {
                    let rsize = position + ( this.chunkSize * this.chunks ) > fstats.size ? fstats.size - position : ( this.chunkSize * this.chunks );
    
                    fs.read( file, Buffer.alloc( rsize ), 0, rsize, position, ( err, bytecount, buff ) => {

                        position += bytecount;
    
                        let lineFound = false;
                        let lines = ( ( danglyBits == null ? '' : danglyBits ) + buff.toString( 'utf-8', 0, bytecount ) ).split( /\r\n|\r|\n/gmi );
                        currentLines = [];

                        danglyBits = lines.pop();

                        for ( let i = 0; i < lines?.length; i++ ) {
                            logLineNo++;
                            currentLines.push( lines[ i ] );
                            if ( logLineNo === lineNo ) {
                                setTimeout( () => this._processDeathRecapLines( Array.prototype.concat( [], prevLines, currentLines ), callback ) );
                                return;
                            }
                        }

                        prevLines = lines;

                        if ( lineFound ) {
                            return;
                        } else if ( bytecount <= 0 ) {
                            callback( null );
                        } else if ( position < fstats.size ) {
                            setTimeout( () => readFile(), 50 );
                        } else {
                            callback( null );
                        }
                    } );
                    
                }

                readFile();
                
            }
        } );
    }










    /**
     * Processes the given encounter log entries.
     * @private
     * 
     * @param {string[]} lines The two-block size of log file entries ending with the death.
     * @param {( data: any ) => void} callback Executed when the death recap data is ready.
     */
    _processDeathRecapLines( lines, callback ) {

        let medianLogsPerSecond = 0;
        let allBlocksLps = [];
        let totalLogTimeBlocks = 0;
        let currentTimestamp = null;
        // Calculate the median lps every # log entries.
        let calculateMedianAt = 100;
        // When the number of logs per second (lps) are lower than this value times the median lps, we're likely at the beginning of the fight.
        let dieDownMultiplier = 0.2;
        // The number of consecutive block lps less than median * multiplier.
        let dieDown = 0;
        // When die down count equals the limit, we break the loop and have found the beginning of the fight.
        let dieDownLimit = 5;

        /** @type {Record<string, string[]>} */
        let timeLogs = {};

        // Trim lines to fight duration.
        for ( let i = lines.length - 1; i >= 0; i-- ) {
            let timeLog = /^\[(?<timestamp>.*?)\]\s*(?<log>.*)/gi.exec( lines[ i ] )?.groups;
            if ( timeLog ) {
                let entry = {
                    timestamp: timeLog.timestamp, 
                    log: timeLog.log,
                };

                if ( !timeLogs[ entry.timestamp ] ) {
                    timeLogs[ entry.timestamp ] = [];
                }

                timeLogs[ entry.timestamp ].push( timeLog.log );

                if ( currentTimestamp == null ) {
                    currentTimestamp = entry.timestamp;
                } else if ( currentTimestamp != entry.timestamp ) {
                    // If we've started a new time block, we need to check the 
                    // previous time block's LPS, and determine if we need to 
                    // break the loop.
                    totalLogTimeBlocks += 1;
                    let blockLps = timeLogs[ currentTimestamp ].length;
                    if ( blockLps < medianLogsPerSecond * dieDownMultiplier ) {
                        dieDown += 1;
                        if ( dieDown >= dieDownLimit ) {
                            // Exit the loop.
                            i = -1;
                        }
                    } else {

                        // Reset the die down counter.
                        dieDown = 0;

                        // Push the current block into total LPS.
                        allBlocksLps.push( blockLps );
                        
                        if ( allBlocksLps.length > 1 && allBlocksLps.length % calculateMedianAt === 0 ) {
                            // Calculate the new median LPS.
                            allBlocksLps.sort();
                            medianLogsPerSecond = allBlocksLps[ ( allBlocksLps.length / 2 ) - 1 ];
                        }
                    }
                    
                    currentTimestamp = entry.timestamp;

                }
            }
        }

        const startParse = Date.now();
        // MeleeDamage: actor, attackType, target, damage modifiers.
        // MeleeMiss: actor, target, defenseType, modifiers.
        // ActiveDefense: actor, target, defenseType, modifiers.
        // DirectDamage: actor, target, damage, resistType, attackType, modifiers.
        // YourDot: target, damage, actor, attackType, modifiers.
        // OtherDot: target, damage, attackType, actor, modifiers.
        // Thorns: target, actor, attackType, damage.
        // Healing: actor, target, healDuration, healActual, healLiteral, healType, modifiers.
        // SlainBy: target, actor.
        // Died: target.

        /** @type {{name: string, start: Date, duration: number, end: Date}[]} */
        let defensiveTimers = [];
        
        const timestamps = Object.keys( timeLogs ).sort();
        for ( let ti = 0; ti < timestamps.length; ti++ ) {
            const key = timestamps[ ti ];
            let logs = timeLogs[ key ];
            const timestamp = new Date( key );
            for ( let i = logs.length - 1; i >= 0; i-- ) {

                let regxResult = null;

                regxResult = executCombatRgx( combatRgx.MeleeDamage, logs[ i ] );
                if ( regxResult !== null ) {
                    this._addMeleeEvent( timestamp, regxResult.groups.actor, regxResult.groups.target, +regxResult.groups.damage, regxResult.groups.attackType, regxResult.groups.modifiers );
                    continue;
                }
                
                regxResult = executCombatRgx( combatRgx.MeleeMiss, logs[ i ] );
                regxResult = regxResult == null ? executCombatRgx( combatRgx.ActiveDefense, logs[ i ] ) : regxResult;
                if ( regxResult !== null ) {
                    this._addMeleeAvoidance( timestamp, regxResult.groups.actor, regxResult.groups.target, regxResult.groups.defenseType, regxResult.groups.attackType, regxResult.groups.modifiers );
                    continue;
                }
                
                regxResult = executCombatRgx( combatRgx.DirectDamage, logs[ i ] );
                regxResult = regxResult == null ? executCombatRgx( combatRgx.YourDoT, logs[ i ] ) : regxResult;
                regxResult = regxResult == null ? executCombatRgx( combatRgx.OtherDoT, logs[ i ] ) : regxResult;
                if ( regxResult !== null ) {
                    this._addDetrimentalSpellEvent( timestamp, regxResult.groups.actor, regxResult.groups.target, +regxResult.groups.damage, regxResult.groups.attackType, regxResult.groups.resistType, regxResult.groups.modifiers );
                    continue;
                }
                regxResult = regxResult == null ? executCombatRgx( combatRgx.SelfDot, entry.log ) : regxResult;
                if ( regxResult !== null ) {
                    this._addDetrimentalSpellEvent( timestamp, 'You', regxResult.groups.target, +regxResult.groups.damage, regxResult.groups.attackType, regxResult.groups.resistType, regxResult.groups.modifiers, logLine );
                    continue;
                }
                
                regxResult = executCombatRgx( combatRgx.Thorns, logs[ i ] );
                if ( regxResult !== null ) {
                    this._addThornsEvent( timestamp, regxResult.groups.actor, regxResult.groups.target, +regxResult.groups.damage );
                    continue;
                }
                
                regxResult = executCombatRgx( combatRgx.Healing, logs[ i ] );
                if ( regxResult !== null ) {
                    this._addBeneficialSpellEvent( timestamp, regxResult.groups.actor, regxResult.groups.target, regxResult.groups.healDuration, +regxResult.groups.healActual, regxResult.groups.healType, +regxResult.groups.healLiteral, regxResult.groups.modifiers );
                    continue;
                }

                regxResult = executCombatRgx( combatRgx.Defensive, logs[ i ] );
                regxResult = regxResult == null ? executCombatRgx( combatRgx.Stonewall, logs[ i ] ) : regxResult;
                regxResult = regxResult == null ? executCombatRgx( combatRgx.FinalStand, logs[ i ] ) : regxResult;
                regxResult = regxResult == null ? executCombatRgx( combatRgx.LastStand, logs[ i ] ) : regxResult;
                if ( regxResult !== null ) {
                    defensiveTimers.push( {
                        name: regxResult.groups.actor,
                        start: timestamp,
                        duration: 3 * 60,
                        end: DateUtilities.addSeconds( timestamp, 3 * 60 )
                    } );
                    continue;
                }

            }
        }

        this._updateEntityVerifications( lines );

        callback( this._getDeathRecapModel( defensiveTimers ) );

    }










    /**
     * Updates entity verification, adding 100% confirmations for players, 
     * pets, and npcs.
     * 
     * @param {string[]} lines The log lines for the combat.
     * @param {string} myCharacterName The character name of the log file owner.
     */
    _updateEntityVerifications( lines, myCharacterName ) {

        for ( let i = 0; i < lines.length; i++ ) {
            let regxResult = executCombatRgx( combatRgx.GroupRaid, lines[ i ] );
            regxResult = regxResult == null ? executCombatRgx( combatRgx.Chat, lines[ i ] ) : regxResult;
            regxResult = regxResult == null ? executCombatRgx( combatRgx.Achievement, lines[ i ] ) : regxResult;
            if ( regxResult !== null && this._verifiedPlayers.indexOf( regxResult.groups.player ) === -1 ) {
                this._verifiedPlayers.push( regxResult.groups.player );
                let eNpcIdx = this._encounterStats.npcs.indexOf( regxResult.groups.player );
                if ( eNpcIdx > -1 ) {
                    this._encounterStats.npcs.splice( eNpcIdx, 1 );
                }
                this._updateServerStatistics = true;
            }

            let petAssigned = false;
            let petName = '';
            let petAttack = executCombatRgx( combatRgx.PetAttack, lines[ i ] );
            if ( petAttack !== null && petAttack.groups != null && petAttack.groups.pet != null ) {
                petAssigned = true;
                petName = petAttack.groups.pet;

                if ( this._verifiedPets.indexOf( petName ) === -1 ) {
                    this._verifiedPets.push( petName );

                    // This is "my" pet.
                    let petKey = this._characterName;

                    if ( !this._playerPets[ petKey ] ) {
                        this._playerPets[ petKey ] = [];
                    }
                
                    this._petOwners[ petName ] = petKey;
                    if ( this._playerPets[ petKey ].indexOf( petName ) === -1 ) {
                        this._playerPets[ petKey ].push( petName );
                    }

                    this._updateServerStatistics = true;

                }
            }

            if ( !petAssigned ) {
                let namedPet = executCombatRgx( combatRgx.NamedPet, lines[ i ] );
                if ( namedPet != null && namedPet.groups != null && namedPet.groups.pet != null && namedPet.groups.player != null ) {
                    petAssigned = true;
                    petName = namedPet.groups.pet;

                    if ( this._verifiedPlayers.indexOf( namedPet.groups.player ) === -1 ) {
                        this._verifiedPlayers.push( namedPet.groups.player );
                        let eNpcIdx = this._encounterStats.npcs.indexOf( namedPet.groups.player );
                        if ( eNpcIdx > -1 ) {
                            this._encounterStats.npcs.splice( eNpcIdx, 1 );
                        }
                        this._updateServerStatistics = true;
                    }

                    if ( this._verifiedPets.indexOf( namedPet.groups.pet ) === -1 ) {
                        this._verifiedPets.push( namedPet.groups.pet );
                        this._updateServerStatistics = true;
                    }

                    if ( !this._playerPets[ namedPet.groups.player ] ) {
                        this._playerPets[ namedPet.groups.player ] = [];
                        this._updateServerStatistics = true;
                    }
                
                    if ( this._petOwners[ namedPet.groups.pet ] !== namedPet.groups.player ) {
                        this._petOwners[ namedPet.groups.pet ] = namedPet.groups.player;
                        this._updateServerStatistics = true;
                    }

                    if ( this._playerPets[ namedPet.groups.player ].indexOf( namedPet.groups.pet ) === -1 ) {
                        this._playerPets[ namedPet.groups.player ].push( namedPet.groups.pet );
                        this._updateServerStatistics = true;
                    }
                }
            }

            if ( !petAssigned ) {
                let petLeader = executCombatRgx( combatRgx.PetLeader, lines[ i ] );
                if ( petLeader !== null && petLeader.groups != null && petLeader.groups.player != null && petLeader.groups.pet != null ) {
                    const ownerName = petLeader.groups.player;
                    petName = petLeader.groups.pet;

                    // If the pet leader is not in the players list, add them.
                    if ( this._verifiedPlayers.indexOf( ownerName ) === -1 ) {
                        this._verifiedPlayers.push( ownerName );
                        this._updateServerStatistics = true;
                    }

                    // Determine if this is an NPC pet (charm).
                    let isNpc = petName.indexOf( ' ' ) > -1;
                    if ( isNpc && this._verifiedNpcs.indexOf( petName ) === -1 ) {
                        this._verifiedNpcs.push( petName );
                        this._updateServerStatistics = true;
                    }

                    let petIdx = this._verifiedPets.indexOf( petName );
                    if ( petIdx === -1 && !isNpc ) {
                        // Add this pet to the pets list, if it's not an NPC pet.
                        this._verifiedPets.push( petName );
                        this._updateServerStatistics = true;
                    } else if ( isNpc && petIdx > -1 ) {
                        // If it's already in the pet list as an NPC, then remove it from the pet list.
                        this._verifiedPets.splice( petIdx, 1 );
                        this._updateServerStatistics = true;
                    }

                    if ( !this._playerPets[ ownerName ] ) {
                        this._playerPets[ ownerName ] = [];
                        this._updateServerStatistics = true;
                    }
                
                    if ( this._petOwners[ petName ] !== ownerName ) {
                        this._petOwners[ petName ] = ownerName;
                        this._updateServerStatistics = true;
                    }

                    if ( this._playerPets[ ownerName ].indexOf( petName ) === -1 ) {
                        this._playerPets[ ownerName ].push( petName );
                        this._updateServerStatistics = true;
                    }

                }
            }

            if ( petName?.length > 0 ) {
                let eNpcIdx = this._encounterStats.npcs.indexOf( petName );
                if ( eNpcIdx > -1 ) {
                    this._encounterStats.npcs.splice( eNpcIdx, 1 );
                }
            }

            let playerWho = executCombatRgx( this._playerWhoRgx, lines[ i ] );
            if ( playerWho !== null && playerWho.groups != null && playerWho.groups.player != null ) {
                const playerName = playerWho.groups.player;

                if ( this._verifiedPlayers.indexOf( playerName ) === -1 ) {
                    this._verifiedPlayers.push( playerName );
                    let npcIdx = this._encounterStats.npcs.indexOf( playerName );
                    if ( npcIdx > -1 ) {
                        this._encounterStats.npcs.splice( npcIdx, 1 );
                    }
                }

                if ( this._playerInfos[ playerName ] == null ) {
                    this._playerInfos[ playerName ] = {
                        level: +playerWho.groups.level,
                        className: playerWho.groups.classRealName ?? getEverQuestClassFromTitle( playerWho.groups.classTitleOrName ),
                        raceName: playerWho.groups.raceName,
                    };
                } else {
                    this._playerInfos[ playerName ].level = +playerWho.groups.level;
                    this._playerInfos[ playerName ].className = playerWho.groups.classRealName ?? getEverQuestClassFromTitle( playerWho.groups.classTitleOrName );
                    this._playerInfos[ playerName ].raceName = playerWho.groups.raceName;
                }

                // If the player is in the character list, then we need to update their profile if their new class doesn't match their profile.
                const myCharacter = this._myCharacters.find( f => f.name === playerName && f.server === this._serverName );
                if ( myCharacter != null ) {
                    const playerClassAbbr = getEverQuestClassAbbreviation( this._playerInfos[ playerName ].className );
                    if ( myCharacter.classAbbr !== playerClassAbbr ) {
                        ipcRenderer.send( 'character:update:class', {
                            characterId: myCharacter.characterId,
                            class: playerClassAbbr,
                        } );
                    }
                }

                // Let's remove the player from the pets list, if they are there.
                if ( this._verifiedPets.includes( playerName ) ) {

                    let pi = this._verifiedPets.indexOf( playerName );
                    this._verifiedPets.splice( pi, 1 );

                    if ( this._petOwners[ playerName ] != null ) {

                        if ( this._playerPets[ this._petOwners[ playerName ] ] != null ) {
                            let pi = this._playerPets[ this._petOwners[ playerName ] ].indexOf( playerName );
                            if ( pi > -1 ) {
                                this._playerPets[ this._petOwners[ playerName ] ].splice( pi, 1 );
                            }
                        }

                        delete this._petOwners[ playerName ];
                    }
                }

                // Let's remove them from the NPC list, if they are there.
                if ( this._verifiedNpcs.includes( playerName ) ) {
                    
                    let npci = this._verifiedNpcs.indexOf( playerName );
                    this._verifiedNpcs.splice( npci, 1 );

                }
                
                this._updateServerStatistics = true;
            }
            
        }

        for ( let i = 0; i < this._entityStats.length; i++ ) {
            const stats = this._entityStats[ i ];
            let ui = this._unknownEntities.indexOf( stats.name );
            let playerNameMaybe = !this._verifiedPets.includes( stats.name ) && !this._verifiedPlayers.includes( stats.name ) && stats.name.indexOf( ' ' ) === -1;

            if ( playerNameMaybe ) {
                if ( stats.attackPlayer === 0 && ( stats.attackNpc > 10 || stats.healPlayer > 10 ) ) {
                    this._verifiedPlayers.push( stats.name );
                    let eNpcIdx = this._encounterStats.npcs.indexOf( stats.name );
                    if ( eNpcIdx > -1 ) {
                        this._encounterStats.npcs.splice( eNpcIdx, 1 );
                    }
                    if ( ui > -1 ) {
                        this._unknownEntities.splice( ui, 1 );
                        ui = -1;
                    }
                    let npcIdx = this._verifiedNpcs.indexOf( stats.name );
                    if ( npcIdx > -1 ) {
                        this._verifiedNpcs.splice( npcIdx, 1 );
                    }
                    let petIdx = this._verifiedPets.indexOf( stats.name );
                    if ( petIdx > -1 ) {
                        this._verifiedPets.splice( petIdx, 1 );
                    }
                    this._updateServerStatistics = true;
                }
            }

            if ( ui === -1 ) {
                continue;
            }

            if ( stats.attackedByPlayer > 0 && stats.attackNpc === 0 && stats.healPlayer === 0 ) {

                this._verifiedNpcs.push( stats.name );
                this._unknownEntities.splice( ui, 1 );
                this._updateServerStatistics = true;

            } else if ( stats.attackNpc === 0 && stats.healPlayer === 0 && stats.attackPlayer > 0 ) {

                this._verifiedNpcs.push( stats.name );
                this._unknownEntities.splice( ui, 1 );
                this._updateServerStatistics = true;

            } else if ( stats.attackPlayer > 0 && stats.attackNpc > 0 ) {

                if ( stats.attackNpc / stats.attackPlayer <= 0.5 ) {
                    this._verifiedNpcs.push( stats.name );
                    this._unknownEntities.splice( ui, 1 );
                    this._updateServerStatistics = true;
                        
                }

            }
        }

        if ( this._updateServerStatistics ) {
            this._updateServerModel();
            this._updateServerStatistics = false;
        }
        
    }










    /**
     * Returns the death recap model.
     * 
     * @param {{name: string, start: Date, duration: number, end: Date}[]} defensiveTimers The list of defensive timers.
     */
    _getDeathRecapModel( defensiveTimers ) {
        let model = new DeathRecapModel();

        model.myDeathLog = [];
        model.damageSources = [];
        model.encounterStatistics = new DeathRecapEncounter();

        /** @type {Record<string, number>} */
        let damageToRaid = {};
        /** @type {Record<string, number>} */
        let healingToRaid = {};
        let encounterDuration = DateUtilities.timeSince( this.encounterEvents[ 0 ].timestamp, this.encounterEvents[ this.encounterEvents.length - 1 ].timestamp ).totalSeconds;
        let totalRaidHealing = 0;
        let totalRaidHealingReceived = 0;
        let totalRaidDamage = 0;
        let encounterTimestamp = this.encounterEvents[ 0 ].timestamp;

        /** @type {Record<string, number>} */
        let mobQuadCount = {};

        /** @type {Record<string, {defensiveHit: number[], regularHit: number[], spellHits: number[]}>} */
        let mobHitCount = {};

        /** @type {Record<string, DeathRecapEncounterMob>} */
        let mobStats = {};

        for ( let i = 0; i < this.encounterEvents.length; i++ ) {
            const event = this.encounterEvents[ i ];
            let handled = false;

            // Calculates encounter mob statsitics, this doesn't break the loop when a match is found.
            for ( let j = 0; j < this._verifiedNpcs.length; j++ ) {
                const npc = this._verifiedNpcs[ j ];

                if ( npc === event.actor ) {

                    // Initialize stat trackers.
                    mobQuadCount[ npc ] = mobQuadCount[ npc ] ? mobQuadCount[ npc ] : 0;
                    mobStats[ npc ] = mobStats[ npc ] ? mobStats[ npc ] : new DeathRecapEncounterMob();
                    mobHitCount[ npc ] = mobHitCount[ npc ] ? mobHitCount[ npc ] : { defensiveHit: [], regularHit: [], spellHits: [] };

                    mobStats[ npc ].name = npc;

                    if ( event.attackType === 'melee' ) {
                        if ( encounterTimestamp == event.timestamp && !event.modifiers.rampage && !event.modifiers.wild_rampage ) {
                            mobQuadCount[ npc ] += 1;

                            if ( mobQuadCount[ npc ] >= 4 ) {
                                mobStats[ npc ].quadCount += 1;
                                mobQuadCount[ npc ] = 0;
                            }
                        }

                        if ( event.modifiers?.flurry ) {
                            mobStats[ npc ].flurries = true;
                        }
                        if ( event.modifiers?.rampage ) {
                            mobStats[ npc ].rampage = true;
                        }
                        if ( event.modifiers?.wild_rampage ) {
                            mobStats[ npc ].wildRampage = true;
                        }

                        if ( !event.attackAvoided ) {
                            let targetIsDefensive = defensiveTimers.find( f => f.name === event.target && event.timestamp > f.start && event.timestamp < f.end );

                            if ( targetIsDefensive ) {
                                mobHitCount[ npc ].defensiveHit.push( event.damage );
                                mobStats[ npc ].maxDefensiveHit = mobStats[ npc ].maxDefensiveHit > event.damage ? mobStats[ npc ].maxDefensiveHit : event.damage;
                                mobStats[ npc ].minDefensiveHit = mobStats[ npc ].minDefensiveHit > 0 && mobStats[ npc ].minDefensiveHit < event.damage ? mobStats[ npc ].minDefensiveHit : event.damage;
                            } else {
                                mobHitCount[ npc ].regularHit.push( event.damage );
                                mobStats[ npc ].maxHit = mobStats[ npc ].maxHit > event.damage ? mobStats[ npc ].maxHit : event.damage;
                                mobStats[ npc ].minHit = mobStats[ npc ].minHit > 0 && mobStats[ npc ].minHit < event.damage ? mobStats[ npc ].minHit : event.damage;
                            }
                        }

                    } else if ( event.attackType === 'spell' ) {
                        if ( event.damage > 0 ) {
                            mobStats[ npc ].maxSpell = mobStats[ npc ].maxSpell > event.damage ? mobStats[ npc ].maxSpell : event.damage;
                            mobHitCount[ npc ].spellHits.push( event.damage );
                        }
                    } else if ( event.attackType === 'thorns' ) {
                        if ( event.damage > 0 ) {
                            mobHitCount[ npc ].spellHits.push( event.damage );
                        }
                    }

                }
            }

            // Calculate raid statistics
            for ( let j = 0; j < this._verifiedPlayers.length; j++ ) {
                const player = this._verifiedPlayers[ j ];

                if ( player === event.actor ) {

                    if ( event.heal > 0 ) {

                        if ( event.overHeal > 0 ) {

                            totalRaidHealing += event.heal + event.overHeal;
                            totalRaidHealingReceived += event.heal;

                        } else if ( event.heal > 0 ) {

                            totalRaidHealing += event.heal;
                            totalRaidHealingReceived += event.heal;

                        }

                        healingToRaid[ event.actor ] = healingToRaid[ event.actor ] ? healingToRaid[ event.actor ] : 0;
                        healingToRaid[ event.actor ] += event.heal;

                        totalRaidHealing += event.heal;
                    }

                    if ( event.damage > 0 ) {
                        totalRaidDamage += event.damage;
                    }

                }
            }

            for ( let j = 0; j < this._verifiedPlayers.length; j++ ) {
                const player = this._verifiedPlayers[ j ];

                if ( player === event.target ) {
                    if ( player === this._characterName ) {
                        let log = new DeathRecapLog();

                        log.timestamp = event.timestamp;
                        log.actor = event.actor;
                        log.attackType = event.attackType;
                        log.damage = event.damage;
                        log.healing = event.heal;
                        log.overHealing = event.overHeal;
                        log.attackName = event.attackName;
                        log.target = player;

                        model.myDeathLog.push( log );

                        if ( event.damage > 0 ) {
                            damageToRaid[ event.actor ] = damageToRaid[ event.actor ] ? damageToRaid[ event.actor ] : 0;
                            damageToRaid[ event.actor ] += event.damage;
                        }

                        handled = true;
                        break;
                    } else {

                        if ( event.damage > 0 ) {
                            damageToRaid[ event.actor ] = damageToRaid[ event.actor ] ? damageToRaid[ event.actor ] : 0;
                            damageToRaid[ event.actor ] += event.damage;
                        }

                        handled = true;
                        break;
                    }
                }
            }

            if ( handled )
                continue;

            for ( let j = 0; j < this._verifiedPets.length; j++ ) {
                const pet = this._verifiedPets[ j ];

                if ( pet === event.target ) {

                    if ( event.damage > 0 ) {
                        damageToRaid[ event.actor ] = damageToRaid[ event.actor ] ? damageToRaid[ event.actor ] : 0;
                        damageToRaid[ event.actor ] += event.damage;
                    }

                    if ( event.heal > 0 ) {
                        healingToRaid[ event.actor ] = healingToRaid[ event.actor ] ? healingToRaid[ event.actor ] : 0;
                        healingToRaid[ event.actor ] += event.heal;

                        totalRaidHealing += event.heal;
                    }

                    handled = true;
                    break;
                }
            }

            if ( encounterTimestamp != event.timestamp ) {
                mobQuadCount = {};
                encounterTimestamp = event.timestamp;
            }
        }

        // Map damage sources to the model.
        let damageSourceNames = Object.keys( damageToRaid );
        for ( let i = 0; i < damageSourceNames?.length; i++ ) {
            const key = damageSourceNames[ i ];
            let dmgs = new DeathRecapDamageSource();

            dmgs.damage = damageToRaid[ key ];
            dmgs.source = key;
            model.damageSources.push( dmgs );

        }

        // Map healing sources to the model.
        let healingSourceNames = Object.keys( healingToRaid );
        for ( let i = 0; i < healingSourceNames?.length; i++ ) {
            const key = healingSourceNames[ i ];
            let dmgs = new DeathRecapDamageSource();

            dmgs.healing = healingToRaid[ key ];
            dmgs.source = key;
            model.damageSources.push( dmgs );

        }

        model.damageSources = _.orderBy( model.damageSources, [ f => f.healing, f => f.damage ], [ 'desc', 'desc' ] );

        // Calculates the average hit from mobs.
        let mobHitKeys = Object.keys( mobHitCount );
        for ( let i = 0; i < mobHitKeys?.length; i++ ) {
            const npc = mobHitKeys[ i ];
            let defensiveDamage = 0;
            let regularDamage = 0;
            let spellDamage = 0;

            if ( mobHitCount[ npc ].defensiveHit?.length > 0 ) {
                mobHitCount[ npc ].defensiveHit?.forEach( d => defensiveDamage += d );
                mobStats[ npc ].avgDevensiveHit = Math.round( defensiveDamage / mobHitCount[ npc ].defensiveHit.length );
            }
            if ( mobHitCount[ npc ].regularHit?.length > 0 ) {
                mobHitCount[ npc ].regularHit?.forEach( d => regularDamage += d );
                mobStats[ npc ].avgHit = Math.round( regularDamage / mobHitCount[ npc ].regularHit.length );
            }

            mobHitCount[ npc ].spellHits?.forEach( d => spellDamage += d );

            mobStats[ npc ].totalDamage = defensiveDamage + regularDamage + spellDamage;
        }

        model.encounterStatistics.mobs = [];
        let mobStatKeys = Object.keys( mobStats );
        for ( let i = 0; i < mobStatKeys.length; i++ ) {
            const stats = mobStats[ mobStatKeys[ i ] ];
            stats.name = mobStatKeys[ i ];

            model.encounterStatistics.mobs.push( stats );
        }
        model.encounterStatistics.mobs = _.orderBy( model.encounterStatistics.mobs, f => f.totalDamage, 'desc' );

        model.encounterStatistics.raid = new DeathRecapRaidStats();
        model.encounterStatistics.raid.damage = totalRaidDamage;
        model.encounterStatistics.raid.dps = totalRaidDamage / encounterDuration;
        model.encounterStatistics.raid.healing = totalRaidHealing;
        model.encounterStatistics.raid.healingReceived = totalRaidHealingReceived;
        return model;
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
    _getAttackType( attackType ) {
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
    _getActorTargetNames( actor, target ) {
        let output = {
            actor: actor?.substring( 0, 1 ).toUpperCase() + actor?.substring( 1 ),
            target: target?.substring( 0, 1 ).toUpperCase() + target?.substring( 1 ),
        };
            
        if ( actor === 'YOU' || actor === 'YOUR' || actor === 'you' || actor === 'You' ) {
            output.actor = this._characterName;
        }
    
        if ( target === 'YOU' || target === 'YOUR' || target === 'you' || target === 'You' || target === 'yourself' ) {
            output.target = this._characterName;
        } else if ( target === 'himself' || target === 'herself' ) {
            output.target = actor;
        }
    
        return output;
    }










    /**
     * Resets the encounter, triggering the onEncounterReset event and 
     * initializing a new encounter object.
     */
    resetEncounter() {

        const realEncounter = this._encounterStats?.npcs?.length > 0;
        if ( realEncounter ) {
            log( 'Resetting Encounter', undefined, true );
        }

        if ( this._encounterResetTimerId ) {
            clearTimeout( this._encounterResetTimerId );
            this._encounterResetTimerId = null;
        }

        if ( this.#encounterNpcDeathTimeoutId > 0 ) {
            clearTimeout( this.#encounterNpcDeathTimeoutId );
            this.#encounterNpcDeathTimeoutId = undefined;
        }

        if ( this._encounterStats == null )
            return;
        else
            this._encounterStats.ended = true;

        // We still want to reset this encounter if we're under the min damage,
        // but we don't want to trigger the event.
        let underMinDmg = this._dpsMeterSettings.encounterMinimumDamage > 0 && ( this._encounterStats?.encounterDamageDone ?? 0 ) < this._dpsMeterSettings.encounterMinimumDamage;

        const eventArgs = new EncounterResetEventArgs();
        eventArgs.encounterId = this._encounterStats.encounterId;
        eventArgs.timestamp = new Date();
        eventArgs.timezoneOffset = eventArgs.timestamp.getTimezoneOffset();
        eventArgs.firstEncounterEventTimestamp = this._encounterStats.encounterStart;
        eventArgs.lastEncounterEventTimestamp = this._encounterStats.lastEncounterEvent;
        eventArgs.logRecords = this.encounterEvents;
        eventArgs.logs = this._encounterStats.logs;
        eventArgs.npcs = [ ...this._encounterStats.npcs ];
        eventArgs.externalEncounterIds = Object.keys( this._externalEncounterIds );
        eventArgs.externalEncounterIdCharacters = this._externalEncounterIds;
        eventArgs.encounter = this._encounterStats;
        
        /** @type {string[]} */
        let names = [].concat( 'You', this._characterName, ...( this._playerPets[ this._characterName ] ?? [] ) );

        eventArgs.myOwnedLogs = this._encounterStats.ownedLogs.filter( f => names.includes( f.actor ) || names.includes( f.target ) ).map( f => f.log );

        // Once the encounter is over, we may continue to receive stats from
        // connected players.  Since there is no point to tracking stats for an 
        // encounter that has, for us, ended then we need to ignore them.  To 
        // do that, we need to know that the external encounter id has been 
        // closed.
        this._closedExternalEncounterIds = this._closedExternalEncounterIds.concat( ...eventArgs.externalEncounterIds );

        this.encounterEvents = [];
        this.encounterRawLogs = [];
        this._externalEncounterIds = {};
        this._encounterStats = new EncounterStats();

        if ( realEncounter && this.onEncounterReset && !underMinDmg ) {
            this.onEncounterReset( eventArgs );
        }
    }









    
    /**
     * Returns a new FCT model from the given log record, or undefined if the log record is not an FCT event.
     * 
     * @returns {FctModel?}
     * 
     * @param {LogRecord} rec The log record to create an FCT model from.
     */
    _getFctModel( rec ) {
        let model = new FctModel();

        let actor = rec.actor;
        let target = rec.target;
        let character = this._fctCharacters.find( f => f.name === actor || f.name === target );

        if ( !character )
            // If no character was found, then this log record will be treated as a non-FCT event.
            return undefined;

        let myAction = actor === character.name;
        let otherAction = target === character.name;

        if ( otherAction || myAction ) {

            if ( rec.attackType === 'melee' ) {
                model.combatTypes.myHits = myAction;
                model.combatTypes.otherHitsOnMe = otherAction;

            } else if ( rec.attackType === 'spell' ) {
                model.combatTypes.mySpellHits = myAction && !rec.heal && actor !== target;
                model.combatTypes.otherSpellHitsOnMe = otherAction && !rec.heal;
                model.combatTypes.myHealing = myAction && rec.heal > 0 && actor !== target;
                model.combatTypes.otherHealingOnMe = otherAction && rec.heal > 0;

            }

            if ( rec.modifiers.dodge ) {
                model.avoidType = 'dodge';
            } else if ( rec.modifiers.parry ) {
                model.avoidType = 'parry';
            } else if ( rec.modifiers.riposte ) {
                model.avoidType = 'riposte';
            } else if ( rec.modifiers.block ) {
                model.avoidType = 'block';
            } else if ( rec.modifiers.miss ) {
                model.avoidType = 'miss';
            } else {
                model.amount = model.combatTypes.myHealing || model.combatTypes.otherHealingOnMe ? rec.heal : rec.damage;
            }

            model.actor = actor;
            model.action = rec.attackName;
            model.target = target;
            model.damageType = rec.resistType;
            model.overHealing = rec.overHeal;

            model.combatModifiers = [];

            rec.modifiers.critical && model.combatModifiers.push( 'critical' );
            rec.modifiers.cripplingBlow && model.combatModifiers.push( 'crippling_blow' );
            rec.modifiers.flurry && model.combatModifiers.push( 'flurry' );
            rec.modifiers.lucky && model.combatModifiers.push( 'lucky' );
            rec.modifiers.twincast && model.combatModifiers.push( 'twincast' );
            rec.modifiers.riposte && model.combatModifiers.push( 'riposte' );
            rec.modifiers.strikethrough && model.combatModifiers.push( 'strikethrough' );
            rec.modifiers.wild_rampage && model.combatModifiers.push( 'wild_rampage' );
            rec.modifiers.rampage && model.combatModifiers.push( 'rampage' );
            rec.modifiers.assassinate && model.combatModifiers.push( 'assassinate' );
            rec.modifiers.headshot && model.combatModifiers.push( 'headshot' );
            rec.modifiers.double_bow_shot && model.combatModifiers.push( 'double_bow_shot' );
            rec.modifiers.deadly_strike && model.combatModifiers.push( 'deadly_strike' );
            rec.modifiers.finishing_blow && model.combatModifiers.push( 'finishing_blow' );
            
            if ( model.combatModifiers.length === 0 ) {
                model.combatModifiers.push( 'normal' );
            }

            model.timestamp = rec.timestamp;
            model.characterId = character.characterId;

            // TODO: This is a temporary fix for the FCT model.  The FCT model should be refactored to handle all combat types.
            return model.amount > 0 ? model : undefined;
        }

        return undefined;
    }










    /**
     * Refreshes the encounter.
     * 
     * @param {LogRecord | undefined} rec The log record being added to the encounter.
     * @param {string | undefined} rawLog The raw log record.
     */
    _refreshEncounter( rec, rawLog ) {

        if ( rec != undefined && !rec.corpse && this._charmPets.indexOf( rec.actor ) === -1 && this._charmPets.indexOf( rec.target ) === -1 ) {
            this.#restartEncounterTimeout();
        } else if ( rec == undefined ) {
            this.#restartEncounterTimeout();
        } else if ( this._encounterStats.npcs.length > 0 ) {
            log( 'Not resetting encounter timeout', { actor: rec.actor, target: rec.target, location: '#_refreshEncounter' }, true );
        }

        this.#initializeEncounter( rec, rawLog );
        
        this.#recordEncounterEvent( rec, rawLog );

    }










    /**
     * Adds the given log record to the encounter and updates the encounter statistics.
     * 
     * @param {LogRecord|undefined} rec The log record to add to the encounter.
     * @param {string|undefined} rawLog The raw log record.
     */
    #recordEncounterEvent( rec, rawLog ) {
        if ( rec != undefined ) {
            let encounterBegins = this._encounterStats.npcs.length === 0;
            this.encounterEvents.push( rec );
            this._updateEncounterStats( rec, rawLog );
            encounterBegins = encounterBegins && this._encounterStats.npcs.length > 0;

            if ( encounterBegins ) {
                log( 'Beginning a new encounter', { location: '#recordEncounterEvent', npcs: this._encounterStats.npcs }, true );
            }
        }

        if ( rawLog ) {
            this._encounterStats.ownedLogs.push( {
                actor: rec?.actor,
                target: rec?.target,
                log: rawLog,
            } );
        }
    }










    /**
     * Initializes the encounter, setting the encounter start time if it's not already set.
     * 
     * @param {LogRecord|undefined} rec The log record to initialize to the encounter.
     * @param {string|undefined} rawLog The raw log record.
     */
    #initializeEncounter( rec, rawLog ) {
        if ( this._encounterStats == undefined ) {
            // Start a new encounter.
            this._encounterStats = new EncounterStats();
            this._encounterStats.encounterStart = rec?.timestamp || new Date();
            this._externalEncounterIds = {};
            if ( rec != undefined && rawLog != undefined ) {
                if ( rawLog ) {
                    this._encounterStats.logs.push( rawLog );
                }
            }

        } else if ( this._encounterStats.encounterStart == undefined ) {
            // Set the encounter start time, if it's not already set.
            this._encounterStats.encounterStart = rec?.timestamp || new Date();

        }
    }










    /**
     * Restarts the encounter timeout, letting the encounter end after a period of inactivity.
     */
    #restartEncounterTimeout() {
        
        if ( this._encounterResetTimerId ) {
            clearTimeout( this._encounterResetTimerId );
            this._encounterResetTimerId = undefined;
        }
        
        this._encounterResetTimerId = window.setTimeout( () => {
            if ( this._encounterStats.npcs.length > 0 ) {
                log( 'Encounter timeout reached, resetting encounter.', { location: '#restartEncounterTimeout' }, true );
            }
            this.resetEncounter();
        }, this._encounterStats?.namedEvent ? namedNpcTimeoutMs : encounterTimeoutMs);

    }










    /**
     * Adds the given log record to the encounter statistics.
     * 
     * @returns {FctModel?} Returns an FCT model if the log record is an FCT event, otherwise undefined.
     * 
     * @param {LogRecord} rec The log record to add to the encounter.
     * @param {string} rawLog The raw log record.
     * @param {boolean|undefined} noFct If true, the log record will not be treated as an FCT event.
     */
    _addEncounterEvent( rec, rawLog, noFct ) {
        rec.corpse = /'s corpse$/gi.exec( rec.actor ) != null; // || /'s corpse$/gi.exec( rec.target ) != null;
        noFct = noFct === true;
        this._refreshEncounter( rec, rawLog );

        let actorCategorized = false;

        // Note: Only NPCs rampage.
        const rampages = rec.modifiers?.rampage || rec.modifiers?.wild_rampage;
        if ( rampages && !this._verifiedPets.includes( rec.actor ) && !this._verifiedNpcs.includes( rec.actor ) ) {
            this._verifiedNpcs.push( rec.actor );
            actorCategorized = true;
            this._updateServerStatistics = true;
        }

        // Update uknown verification
        if ( !actorCategorized && rec.actor != null ) {
            let known = this._verifiedNpcs.includes( rec.actor )
                || this._verifiedPets.includes( rec.actor )
                || this._verifiedPlayers.includes( rec.actor )
                || this._unknownEntities.includes( rec.actor );
            if ( !known ) {
                this._unknownEntities.push( rec.actor );
                this._updateServerStatistics = true;
            }
        }

        if ( rec.target != null ) {
            let known = this._verifiedNpcs.includes( rec.target )
                || this._verifiedPets.includes( rec.target )
                || this._verifiedPlayers.includes( rec.target )
                || this._unknownEntities.includes( rec.target );
            if ( !known ) {
                this._unknownEntities.push( rec.target );
                this._updateServerStatistics = true;
            }
        }

        return noFct ? undefined : this._getFctModel( rec );
    }










    /**
     * Adds a death event to the encounter.
     * 
     * @param {Date} timestamp The timestamp of the event.
     * @param {string} target The name of the target.
     * @param {string | undefined} actor The name of the actor.
     * @param {string} rawLog The raw log record.
     */
    _addDeathEvent( timestamp, target, actor, rawLog  ) {

        let names = this._getActorTargetNames( actor, target );
    
        let rec = new LogRecord();
        rec.timestamp = timestamp;
        rec.actor = names.actor;
        rec.target = names.target;

        this._addEncounterEvent( rec, rawLog, true );
        
        if ( this._encounterStats != null ) {
            if ( this._encounterStats.npcs.includes( names.target ) ) {

                if ( !this._encounterStats.deadNpcs.includes( names.target ) ) {
                    this._encounterStats.deadNpcs.push( names.target );
                }

                this._onNpcDeath();
            }
        }
    }










    /**
     * Adds a charm event to the encounter.
     * 
     * @description This method will also add the charm pet as a pet to the 
     * encounter, if they are not already added. And if the charmed target is 
     * not in the PC list, they will be added to the NPC list and removed from 
     * the Pets list.
     * 
     * @param {Date} timestamp The timestamp of the event.
     * @param {string} petName The name of the pet.
     * @param {string} rawLog The raw log record.
     */
    _addCharmEvent( timestamp, petName, rawLog ) {
        
        // Let's keep track of this pet.
        this._charmPets.push( petName );

        // If the pet is not already in the pet list, add it.
        this._petOwners[ petName ] = this._petOwners[ petName ] ?? undefined;

        // This is a "temporary" pet, so if they are in the server pet list, we need to remove it.
        if ( !this._verifiedPlayers.includes( petName ) ) {
            let idx = this._verifiedPets.indexOf( petName );
            if ( idx >= 0 ) {
                this._verifiedPets.splice( idx, 1 );
                this._updateServerStatistics = true;
            }
            if ( !this._verifiedNpcs.includes( petName ) ) {
                this._verifiedNpcs.push( petName );
                this._updateServerStatistics = true;
            }
        }

        if ( this._encounterStats == null ) {
            return;
        } else {
            if ( this._encounterStats.npcs.some( f => f.toLowerCase() === petName.toLowerCase() ) ) {
                this._encounterStats.npcs = this._encounterStats.npcs.filter( f => f.toLowerCase() !== petName.toLowerCase() );
                delete this._encounterStats.npcDeathTimeoutTimestamps[ petName ];

                if ( this._encounterStats.npcs.length === 0 ) {
                    log( 'Immediately resetting encounter', { location: '_addCharmEvent' }, true );
                    this.resetEncounter();
                } else {
                    // For the purposes of the encounter, this can be considered a death event.
                    this._onNpcDeath();
                }
            }
        }
    }

    
    
    
    
    
    
    
    
    
    /**
     * Resets the death timer for the given NPC and stops the npc death timeout.
     * 
     * @param {string} names The names of the NPC to reset the death timer for.
     */
    _resetNpcDeath( names ) {

        if ( this.#encounterNpcDeathTimeoutId > 0 ) {
            
            // If all NPCs are dead in the encounter, and this name does not
            // exist in the NPCs list, we need to end the encounter immediately.
            // The reason we don't reset if the NPC name is in the list is because
            // we can't know if the NPC was originally part of the encounter.  The 
            // EQ log does not uniquely identify NPCs.
            if ( this._encounterStats != null && !this._verifiedPlayers.includes( names ) && !this._verifiedPets.includes( names ) ) {
                if ( !this._encounterStats.npcs.includes( names ) ) {
                    if ( this._encounterStats.npcs.every( f => this._encounterStats.deadNpcs.includes( f ) ) ) {
                        log( 'Immediately resetting encounter', { names: names, npcs: this._encounterStats.npcs, location: '_resetNpcDeath' }, true );
                        this.resetEncounter();
                    }
                } else {
                    this._encounterStats.deadNpcs = this._encounterStats.deadNpcs.filter( f => f !== names );
                }
            }
        }

        if ( this._encounterStats != null ) {
            if ( this._encounterStats.npcs.includes( names ) && this._encounterStats.npcDeathTimeoutTimestamps[ names ] ) {
                this._encounterStats.npcDeathTimeoutTimestamps[ names ] = undefined;
            }
        }
    }









    
    /**
     * Checks if all NPCs in the encounter are dead.  If true, the encounter is 
     * ended.
     */
    _onNpcDeath() {
        if ( this._encounterStats != null ) {
            if ( this._encounterStats.npcs.every( f => this._encounterStats.deadNpcs.includes( f ) ) ) {
                log( 'All NPCs are dead, ending encounter.', { location: '_onNpcDeath' }, true );
                this.resetEncounter();
            }
        }
    }










    /**
     * Updates the entity statistics with the given information.
     * 
     * @param {string} name The name of the entity.
     * @param {string} targetName The name of the target entity.
     * @param {boolean} damage If true, the entity is attacking.
     * @param {boolean} heal If true, the entity is healing.
     */
    _updateEntityStats( name, targetName, damage, heal ) {
        
        let stats = this._entityStats.find( f => f.name === name );

        if ( !stats ) {
            stats = new EntityStatsModel();
            stats.name = name;
            this._entityStats.push( stats );
        }
    

        let targetNpc = this._verifiedNpcs.includes( targetName );
        let targetPlayer = this._verifiedPlayers.includes( targetName );

        if ( damage === true ) {
            stats.attackNpc += targetNpc ? 1 : 0;
            stats.attackPlayer += targetPlayer ? 1 : 0;
        }

        if ( heal === true ) {
            stats.healNpc += targetNpc ? 1 : 0;
            stats.healPlayer += targetPlayer ? 1 : 0;
        }

        if ( this._verifiedPlayers.includes( name ) && damage === true ) {
            // If 'name' is a player, then we need to update the stats for the target's attacked by player.
            let targetStats = this._entityStats.find( f => f.name === targetName );

            if ( !targetStats ) {
                targetStats = new EntityStatsModel();
                targetStats.name = targetName;
                this._entityStats.push( targetStats );
            }

            targetStats.attackedByPlayer += 1;

        } else if ( this._verifiedNpcs.includes( name ) && damage === true ) {
            // If 'name' is an NPC, then we need to update the stats for the target's attacked by NPC.
            let targetStats = this._entityStats.find( f => f.name === targetName );

            if ( !targetStats ) {
                targetStats = new EntityStatsModel();
                targetStats.name = targetName;
                this._entityStats.push( targetStats );
            }

            targetStats.attackedByNpc += 1;

        }
    }
    
    
    
    
    
    
    
    
    
    
    /**
     * Adds a new melee event to the encounter.
     * 
     * @returns {FctModel?} Returns an FCT model if the log record is an FCT event, otherwise undefined.
     * 
     * @param {Date} timestamp The timestamp of the event.
     * @param {string} actor The name of the actor.
     * @param {string} target The name of the target.
     * @param {number} damage The damage amount.
     * @param {string} attackType The attack type.
     * @param {string?} modifiers The modifiers of the attack.
     * @param {string?} rawLog The raw log record.
     */
    _addMeleeEvent( timestamp, actor, target, damage, attackType, modifiers, rawLog ) {
        let names = this._getActorTargetNames( actor, target );
        let attackTypeName = this._getAttackType( attackType );
    
        let rec = new LogRecord();
        rec.timestamp = timestamp;
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

        this._updateEntityStats( rec.actor, rec.target, true, false );

        return this._addEncounterEvent( rec, rawLog );

    }
    
    
    
    
    
    
    
    
    
    
    /**
     * Adds a new defense event to the encounter.
     * 
     * @returns {FctModel?} Returns an FCT model if the log record is an FCT event, otherwise undefined.
     * 
     * @param {Date} timestamp The timestamp of the event.
     * @param {string} actor The name of the actor.
     * @param {string} target The name of the target.
     * @param {string} defenseType The type of defense.
     * @param {string?} attackType The type of defense.
     * @param {string?} modifiers The modifiers of the attack.
     * @param {string?} rawLog The raw log record.
     */
    _addMeleeAvoidance( timestamp, actor, target, defenseType, attackType, modifiers, rawLog ) {
        let names = this._getActorTargetNames( actor, target );
        let attackTypeName = this._getAttackType( attackType );
        let avoidTypeName = avoidTypeMap[ defenseType ];
    
        let rec = new LogRecord();
        rec.timestamp = timestamp;
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

        this._updateEntityStats( rec.actor, rec.target, true, false );
    
        return this._addEncounterEvent( rec, rawLog );
        
    }
    
    
    
    
    
    
    
    
    
    
    /**
     * Adds a new detrimental spell event to the encounter.
     * 
     * @returns {FctModel?} Returns an FCT model if the log record is an FCT event, otherwise undefined.
     * 
     * @param {Date} timestamp The timestamp of the event.
     * @param {string} actor The name of the actor.
     * @param {string} target The name of the target.
     * @param {number} damage The damage amount.
     * @param {string} attackType The name of the spell.
     * @param {string?} resistType The resist check of the spell.
     * @param {string?} modifiers The modifiers of the spell.
     * @param {string?} rawLog The raw log record.
     */
    _addDetrimentalSpellEvent( timestamp, actor, target, damage, attackType, resistType, modifiers, rawLog ) {
        let names = this._getActorTargetNames( actor, target );
        let attackTypeName = this._getAttackType( attackType );
    
        let rec = new LogRecord();
        rec.timestamp = timestamp;
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
        rec.resistType = resistType;
    
        if ( rec.actor !== rec.target ) {
            this._updateEntityStats( rec.actor, rec.target, true, false );
            return this._addEncounterEvent( rec, rawLog );
        } else {
            return this._getFctModel( rec );
        }
        
    }
    
    
    
    
    
    
    
    
    
    
    /**
     * Adds a new beneficial spell event to the encounter.
     * 
     * @returns {FctModel?} Returns an FCT model if the log record is an FCT event, otherwise undefined.
     * 
     * @param {Date} timestamp The timestamp of the event.
     * @param {string} actor The name of the actor.
     * @param {string} target The name of the target.
     * @param {string} healDuration The capture group for the heal duration.
     * @param {number} healActual The healing applied to the target.
     * @param {string} healType The name of the heal spell.
     * @param {number?} healLiteral The total amount of possible healing, if supplied in the capture groups.
     * @param {string?} modifiers The modifiers of the spell.
     * @param {string?} rawLog The raw log record.
     */
    _addBeneficialSpellEvent(timestamp, actor, target, healDuration, healActual, healType, healLiteral, modifiers, rawLog ) {
        let names = this._getActorTargetNames( actor, target );
        let healTypeName = this._getAttackType( healType );
    
        let rec = new LogRecord();
        rec.timestamp = timestamp;
        rec.actor = names.actor;
        rec.target = names.target;
        rec.attackType = healTypeName.type;
        rec.attackName = healTypeName.name; // healDuration === 'over time for' ? 'heal over time' : 'direct heal'; // TODO: Log heal over times.
        rec.heal = healActual;
        rec.overHeal = healLiteral > 0 ? healLiteral - healActual : 0;
        rec.thorns = false;
        rec.modifiers = new AttackModifiers();
        rec.modifiers.critical = modifiers?.indexOf( 'Critical' ) > -1;
        rec.modifiers.lucky = modifiers?.indexOf( 'Lucky' ) > -1;

        if ( healActual + healLiteral > 0 ) {
            this._updateEntityStats( rec.actor, rec.target, false, true );
        }
    
        return this._addEncounterEvent( rec, rawLog );
        
    }
    
    
    
    
    
    
    
    
    
    
    /**
     * Adds a new thorns event to the encounter.
     * 
     * @returns {FctModel?} Returns an FCT model if the log record is an FCT event, otherwise undefined.
     * 
     * @param {Date} timestamp The timestamp of the event.
     * @param {string} actor The name of the actor.
     * @param {string} target The name of the target.
     * @param {number} damage The thorns damage.
     * @param {string} rawLog The raw log record.
     */
    _addThornsEvent( timestamp, actor, target, damage, rawLog ) {
        let names = this._getActorTargetNames( actor, target );
    
        let rec = new LogRecord();
        rec.timestamp = timestamp;
        rec.actor = names.actor;
        rec.target = names.target;
        rec.attackType = 'thorns';
        rec.damage = damage;
        rec.thorns = true;
        rec.modifiers = new AttackModifiers();
    
        return this._addEncounterEvent( rec, rawLog );
        
    }










    /**
     * Updates the given dps record with the log record.
     * 
     * @param {LogRecord} logRecord The log record.
     * @param {PlayerDps | PetDps} dpsRec The dps record.
     * @param {number} duration The player encounter duration in seconds.
     */
    _calculateDpsStats( logRecord, dpsRec, duration ) {

        dpsRec.damage += logRecord.damage ?? 0;
        dpsRec.healing += logRecord.heal ?? 0;

    }










    /**
     * 
     * @param {Record<string, PlayerEncounterStats>} source The source for player encounter stats.
     * @param {string} name The name of the player.
     * @param {Date} timestamp The timestamp of the event.
     */
    _getOrCreatePlayerEncounterStats( source, name, timestamp ) {
        if ( source[ name ] == null ) {
            let playerInfo = this._playerInfos ? this._playerInfos[ name ] : undefined;

            source[ name ] = new PlayerEncounterStats();
            source[ name ].name = name;
            source[ name ].class = playerInfo?.className;
            source[ name ].encounterStart = timestamp;

        }
        source[ name ].lastEncounterEvent = timestamp;



        return source[ name ];
    }










    /**
     * Finds or creates a player dps stat block.
     * 
     * @returns {PlayerDps} Returns the player dps stat block.
     * 
     * @param {PlayerDps[]} playerDpsRecs The player's stat blocks.
     * @param {string} playerName The name of the player.
     * @param {string} playerClassName The class of the player.
     * @param {Date} timestamp The timestamp for the latest event.
     * @param {boolean} otherIsNpc If true, the other entity is an NPC.
     * @param {string} otherName The name of the other entity.
     */
    _getOrCreatePlayerDpsStats( playerDpsRecs, playerName, playerClassName, timestamp, otherIsNpc, otherName ) {
        /** @type {PlayerDps} */
        let statBlock = undefined;

        if ( playerDpsRecs?.length > 0 ) {
            /** @type {PlayerDps | undefined} Find the last dps record for the player and the other entity. */
            let lastDps = otherIsNpc ? playerDpsRecs.findLast( f => f.npcName === otherName ) : playerDpsRecs.findLast( f => f.otherPlayerName === otherName );
            let delay = DateUtilities.timeSince( lastDps?.end ?? timestamp, timestamp ).totalMilliseconds;

            if ( lastDps == null || delay > this._dpsMeterSettings.playerInactiveDelayMs ) {
                statBlock = new PlayerDps();
                statBlock.start = timestamp;
                statBlock.name = playerName;
                statBlock.class = playerClassName;
                statBlock.pets = [];
                
                if ( otherIsNpc ) {
                    statBlock.npcName = otherName;
                } else {
                    statBlock.otherPlayerName = otherName;
                }

                playerDpsRecs.push( statBlock );
            } else {
                statBlock = lastDps;
            }

        } else {
            statBlock = new PlayerDps();
            statBlock.start = timestamp;
            statBlock.name = playerName;
            statBlock.class = playerClassName;
            statBlock.pets = [];

            if ( otherIsNpc ) {
                statBlock.npcName = otherName;
            } else {
                statBlock.otherPlayerName = otherName;
            }

            playerDpsRecs.push( statBlock );

        }

        statBlock.end = timestamp;
        statBlock.time = DateUtilities.timeSince( statBlock.start, statBlock.end ).totalSeconds;
        statBlock.time = statBlock.time > 0 ? statBlock.time : 1;

        return statBlock;
    }









    
    /**
     * Finds or creates a pet dps stat block.
     * 
     * @returns {PetDps} Returns the pet dps stat block.
     * 
     * @param {PetDps[]} petDpsRecs The pet's encounter stat blocks.
     * @param {string} name The name of the pet.
     * @param {Date} timestamp The timestamp for the latest event.
     */
    _getOrCreatePetDpsStats( petDpsRecs, name, timestamp ) {
        /** @type {PetDps} */
        let statBlock = undefined;

        if ( petDpsRecs?.length > 0 ) {
            statBlock = petDpsRecs.find( f => f.name === name );

            if ( statBlock == null ) {
                statBlock = new PetDps();
                statBlock.name = name;
                statBlock.damage = 0;
                statBlock.healing = 0;
                petDpsRecs.push( statBlock );
            }
        } else {
            statBlock = new PetDps();
            statBlock.name = name;
            statBlock.damage = 0;
            statBlock.healing = 0;
            petDpsRecs.push( statBlock );
        }

        return statBlock;
    }









    
    /**
     * Determines if the entity is a named NPC.
     * 
     * @returns Returns true if the entity is a named NPC, otherwise false.
     * 
     * @param {string} name The name of the entity.
     */
    _isNamedNpc( name ) {
        // If NotNamedNpc is null, then it's a named npc.
        return name.match( combatRgx.NotNamedNpc ) == null;
    }
    









    /**
     * Updates the encounter statistics.
     * 
     * @param {LogRecord} logRecord The log record to update the encounter stats with.
     */
    _updateEncounterStats( logRecord, rawLog ) {
        const timestamp = logRecord.timestamp || new Date();
        
        if ( logRecord != undefined ) {
            let playerActor = this._verifiedPlayers.includes( logRecord.actor );
            let playerTarget = this._verifiedPlayers.includes( logRecord.target );
            let petActor = this._verifiedPets.includes( logRecord.actor ) || this._petOwners[ logRecord.actor ] != undefined;
            let petTarget = this._verifiedPets.includes( logRecord.target );

            // TODO: This needs to be done for a single player, instead
            //      of each character tracked parsing DPS.  Alternatively, 
            //      we could just track our own DPS/HPS and receive DPS/HPS 
            //      from other players.  But that should automatically 
            //      accept local log file data, and not require a server.
            
            // TODO: Player duration should be an array of durations, 
            //      allowing for the player to stop attacking and start again.  
            //      This should be separate from their encounter dps.
            
            // TODO: FCT should be calculated from the encounter stats for the player, not separate parsed data.
            
            if ( playerActor || playerTarget || petActor || petTarget ) {

                this._encounterStats.lastEncounterEvent = timestamp;
                this._encounterStats.encounterDamageDone += ( ( playerActor || petActor ) ? logRecord.damage ?? 0 : 0 );

                if ( !this._encounterStats.namedEvent ) {
                    this._encounterStats.namedEvent = playerTarget || petTarget ? this._isNamedNpc( logRecord.actor ) : this._isNamedNpc( logRecord.target );
                }

                if ( playerTarget ) {
                    // If the player is the target, then we need to add to the player's dps received record.
                    let playerEvents = this._getOrCreatePlayerEncounterStats( this._encounterStats.playerEvents, logRecord.target, timestamp );
                    let playerIncoming = this._getOrCreatePlayerDpsStats( playerEvents.playerDpsIncoming, playerEvents.name, playerEvents.class, timestamp, !playerActor && !petActor, logRecord.actor );

                    this._calculateDpsStats( logRecord, playerIncoming, playerIncoming.time );

                    if ( !logRecord.corpse && this._verifiedNpcs.includes( logRecord.actor ) ) {
                        if ( !this._encounterStats.npcs.includes( logRecord.actor ) ) {
                            this._encounterStats.npcs.push( logRecord.actor );
                        }
                        this._encounterStats.lastPlayerNpcAction[ logRecord.actor ] = timestamp;
                    }
                    
                } else if ( petTarget ) {
                    // If a player's pet is the target, then we need to grab the pet's owner, and add the dps received to the owner's pet list for dps received.
                    let owner = this._petOwners[ logRecord.target ];

                    if ( owner ) {
                        let playerEvents = this._getOrCreatePlayerEncounterStats( this._encounterStats.playerEvents, owner, timestamp );
                        let playerIncoming = this._getOrCreatePlayerDpsStats( playerEvents.playerDpsIncoming, playerEvents.name, playerEvents.class, timestamp, !playerActor && !petActor, logRecord.actor );
                        let petDpsRec = this._getOrCreatePetDpsStats( playerIncoming.pets, logRecord.target, timestamp );

                        this._calculateDpsStats( logRecord, petDpsRec, playerIncoming.time );
                    }

                    if ( !logRecord.corpse ) {
                        if ( playerActor && logRecord.target.indexOf( '`s pet' ) === -1 && logRecord.target.indexOf( '`s familiar' ) === -1 && logRecord.target.indexOf( ' ' ) > -1 ) {
                            // If a player is hitting a pet with a space in the name, then we add that to the npcs list.
                            // This will fail if the player is charmed...
                            if ( !this._encounterStats.npcs.includes( logRecord.target ) ) {
                                this._encounterStats.npcs.push( logRecord.target );
                            }
                            this._encounterStats.lastPlayerNpcAction[ logRecord.target ] = timestamp;

                        } else if ( this._verifiedNpcs.includes( logRecord.actor ) ) {
                            if ( !this._encounterStats.npcs.includes( logRecord.actor ) ) {
                                this._encounterStats.npcs.push( logRecord.actor );
                            }
                            this._encounterStats.lastPlayerNpcAction[ logRecord.actor ] = timestamp;

                        }
                    }

                }

                if ( playerActor ) {
                    // If the player is the actor, then we need to add to the player's dps record.
                    let playerEvents = this._getOrCreatePlayerEncounterStats( this._encounterStats.playerEvents, logRecord.actor, timestamp );
                    let playerOutgoing = this._getOrCreatePlayerDpsStats( playerEvents.playerDpsOutgoing, playerEvents.name, playerEvents.class, timestamp, logRecord.target.indexOf( ' ' ) > -1 || ( !playerTarget && !petTarget ), logRecord.target );
                    
                    this._calculateDpsStats( logRecord, playerOutgoing, playerOutgoing.time );

                    if ( !logRecord.corpse && this._verifiedNpcs.includes( logRecord.target ) ) {
                        if ( logRecord.damage > 0 && !this._encounterStats.npcs.includes( logRecord.target ) ) {
                            this._encounterStats.npcs.push( logRecord.target );
                        }
                        this._encounterStats.lastPlayerNpcAction[ logRecord.target ] = timestamp;
                        this._encounterStats.active = true;
                    }
                    
                } else if ( petActor ) {
                    // If a player's pet is the actor, then we need to grab the pet's owner, and add the dps to the owner's pet list.
                    let owner = this._petOwners[ logRecord.actor ];
                    let isNpcTarget = logRecord.target.indexOf( ' ' ) > -1 || this._encounterStats.npcs.includes( logRecord.target );
                    
                    if ( owner ) {
                        let playerEvents = this._getOrCreatePlayerEncounterStats( this._encounterStats.playerEvents, owner, timestamp );
                        let playerOutgoing = this._getOrCreatePlayerDpsStats( playerEvents.playerDpsOutgoing, playerEvents.name, playerEvents.class, timestamp, isNpcTarget || ( !playerTarget && !petTarget ), logRecord.target );
                        let petDps = this._getOrCreatePetDpsStats( playerOutgoing.pets, logRecord.actor, timestamp );

                        this._calculateDpsStats( logRecord, playerOutgoing, playerOutgoing.time );
                    }

                    if ( !logRecord.corpse && !this._verifiedPlayers.includes( logRecord.target ) ) {
                        if ( !this._encounterStats.npcs.includes( logRecord.target ) ) {
                            this._encounterStats.npcs.push( logRecord.target );
                        }
                        this._encounterStats.lastPlayerNpcAction[ logRecord.target ] = timestamp;
                        // Here, we need to make sure that the pet activity is not
                        // a charm pet attacking a player, but a pet (charmed or 
                        // otherwise) attacking another NPC.
                        if ( this._encounterStats.active !== true ) {
                            this._encounterStats.active = isNpcTarget;
                        }
                    }
                    
                }

            }

        }
        
    }
    
}

module.exports = {
    CombatParser,
    minifyCombatLogs,
};
