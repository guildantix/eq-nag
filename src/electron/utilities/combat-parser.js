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
} = require( '../data/models/combat-parser' );
const { FctModel } = require( '../data/models/fct' );
const { CharacterModel } = require( '../data/models/character' );
const { nagLog, nagException } = require( './nag-console' );
const { getEverQuestClassName } = require( './everquest' );

const npcTimeoutMs = 8000;
const namedNpcTimeoutMs = 32000; // 4 * npcTimeoutMs
const encounterTimeoutMs = 30000;
const deathCheckDelayMs = npcTimeoutMs + 100;

//  Preamble: When connected to a server, each connected peer must end encounters at the same time.
//
//  1. ✅ Use statistics to end encounters.  Is there a named in the encounter? Yes? Longer timeout period to end encounter.
//  2. ✅ New NPC appears in the encounter, add them to a list.
//  3. ✅ When that NPC is dead, remove them from the list.
//  4. ✅ Start a "timeout" of 8 seconds.  If no new combat information is received with that NPC name, end the encounter.
//  5. ✅ Once all NPCs are dead, end the encounter.
//  6. ✅ If the NPC is named then extend the timeout to 30 seconds.
//  7. ✅ Receiving combat logs of peers with the same encounter id will extend the timeout.









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
    MeleeDamage: /^(?<actor>.*?) (?<attackType>backstab|backstabs|bash|bashes|bite|bites|claw|claws|crush|crushes|frenzy|frenzies|gore|gores|hit|hits|kick|kicks|maul|mauls|pierce|pierces|punch|punches|rend|rends|shoot|shoots|slam|slams|slash|slashes|slice|slices|smash|smashes|sting|stings|strike|strikes|sweep|sweeps+?) (?<target>.*) for (?<damage>[0-9]*) points of damage\.[\s]?(\((?<modifiers>.*)?\))?/gi,
    
    // Melee miss|es. [https://regex101.com/r/1sfdm4/1]
    MeleeMiss: /^(?<actor>.*?) (try|tries) to ([a-zA-Z0-9_]*) (?<target>.*), but ((?<defenseType>misses|miss))![\s]?(\((?<modifiers>.*)?\))?/gi,

    // Melee active defense. [https://regex101.com/r/9fsdCJ/2]
    ActiveDefense: /^(?<actor>.*?) (try|tries) to ([a-zA-Z0-9_]*) (?<target>.*), but ((\k<target> (?<defenseType>.*)))![\s]?(\((?<modifiers>.*)?\))?/gi,

    // Direct Damage spell attacks. [https://regex101.com/r/XBbPTp/2]
    DirectDamage: /^(?<actor>.*) hit (?<target>.*) for (?<damage>[0-9]*) points of (?<resistType>[a-zA-Z0-9_]*) damage by (?<attackType>.*)\.[\s]?(\((?<modifiers>.*)?\))?/gi,

    // Your Damage Over Time spell reports. [https://regex101.com/r/DaGnUf/2]
    YourDoT: /^(?<target>.*) has taken (?<damage>[0-9]*) damage from (?<actor>you)r (?<attackType>.*)\.[\s]?(\((?<modifiers>.*)?\))?/gi,

    // Other Damage Over Time spell reports. [https://regex101.com/r/PLpfT1/2]
    OtherDoT: /^(?<target>.*) (has|have) taken (?<damage>[0-9]*) damage from (?<attackType>.*) by (?<actor>.*)\.[\s]?(\((?<modifiers>.*)?\))?/gi,

    // Other Damage Over Time spell reports. [https://regex101.com/r/PLpfT1/2]
    SelfDot: /^(?<target>.*) have taken (?<damage>[0-9]*) damage from (?<attackType>.*)\.[\s]?(\((?<modifiers>.*)?\))?/gi,

    // Thorns damage. [https://regex101.com/r/w4h5xP/1]
    Thorns: /^(?<target>.*) is pierced by (?<actor>.+?)('s)? (?<attackType>thorns) for (?<damage>[0-9]*) points of non-melee damage\./gi,

    // Healing [https://regex101.com/r/8Xtkrq/2]
    Healing: /^(?<actor>.+?) (has been\s)?healed (?<target>.+?) (?<healDuration>over time for|for) (?<healActual>[0-9]*) (\((?<healLiteral>[0-9]*)\) )?hit points by (?<healType>.+?)\.[\s]?(\((?<modifiers>.*)?\))?/gi,
    
    // ^${target} has been slain by [^!]*!$
    SlainBy: /^(?<target>.+?) (has|have) been slain by (?<actor>[^!]*)!$/gi,

    // ^You have slain ${target}!$
    YouHaveSlain: /^(?<actor>You) have slain (?<target>.*)!$/gi,

    // ^${target} dies\.$
    // ^${target} died\.$
    Died: /(?<target>.+?) (died|dies)\.$/gi,

    // https://regex101.com/r/bdaD56/3
    GroupRaid: /\] (?<player>[A-Z][^\s]+?) (joined the|has left the|has joined the|have joined the)\s(raid|group)\.$/gi,

    // https://regex101.com/r/zL5Mr4/1
    Chat: /\] (?<player>.*) (tells the raid|tells the guild|tells the group),\s+'.*'$/gi,

    // https://regex101.com/r/EiZc5a/1
    Achievement: /\] Your guildmate (?<player>.*) has completed (.*) achievement\.$/gi,

    // https://regex101.com/r/fjHm0j/1
    Defensive: /^(?<actor>.+?)\b\s{0,1}'{0,1}s{0,1}\b.* assumes a defensive fighting style\.$/gi,

    // https://regex101.com/r/AjOthH/1
    Stonewall: /^(?<actor>.+?)\b\s{0,1}'{0,1}s{0,1}\b.* body becomes as hard as stone\.$/gi,

    // https://regex101.com/r/Hz44Hy/1
    FinalStand: /^(?<actor>.+?)\b\s{0,1}'{0,1}s{0,1}\b.* steels themselves for a final stand\.$/gi,

    // https://regex101.com/r/e1bXss/1
    LastStand: /^(?<actor>.+?)\b\s{0,1}'{0,1}s{0,1}\b.* steels themselves for a last stand\.$/gi,

    // https://regex101.com/r/cPfBq5/1
    PetLeader: /^(?<pet>.+?) says, 'My leader is (?<player>.*)\.'$/gi,

    // https://regex101.com/r/Sm6SVR/1
    PetAttack: /^(?<pet>.+?) told you, 'Attacking (?<target>.*) Master\.'$/gi,

    // https://regex101.com/r/nVsfms/1
    NamedPet: /^(?<pet>(?<player>.+?)`s pet)\s/gi,

    // The following match LastStand
    // CulminatingStand: null,
    // UltimateStand: null,
    // ResoluteStand: null,
}

// https://regex101.com/r/cqfoUU/2
// This won't capture anon people.
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
     * Returns the DPS for a 10 second encounter.
     * 
     * @description Returns an empty array if the total encounter damage done 
     *              is less than the minimum encounter damage value.
     * 
     * @returns {PlayerDps[]} The list of player DPS.
     */
    getEncounterOutgoingDps() {
        /** @type {PlayerDps[]} */
        let output = [];

        let underMinDmg = this._dpsMeterSettings.encounterMinimumDamage > 0 && ( this._encounterStats?.encounterDamageDone ?? 0 ) < this._dpsMeterSettings.encounterMinimumDamage;
        if ( underMinDmg ) {
            return output;
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

        return output;
    }










    /**
     * Returns the list of log records for the specified character.
     * 
     * @returns {{logRecords: LogRecord[], playerStats: PlayerEncounterStats}} The list of log records.
     * 
     * @param {string} character The name of the character to pull log records for.
     * @param {boolean | undefined} untransmittedOnly If true, will only pull untransmitted log records.
     */
    getCharacterEncounterEvents( character, untransmittedOnly ) {

        if ( !character ) {
            nagException( `getCharacterEncounterEvents: character is undefined.` );
            return {
                logRecords: [],
                playerStats: undefined,
            };
        }

        let actorPets = this._playerPets[ character ];
        let output = this.encounterEvents.filter( f => {
            return ( !untransmittedOnly || f.transmitted === false ) && ( f.actor === character || f.target === character );
        } );

        if ( actorPets?.length > 0 ) {
            let petOutput = this.encounterEvents.filter( f => ( !untransmittedOnly || f.transmitted === false ) && ( actorPets.includes( f.actor ) || actorPets.includes( f.target ) ) );
            output = output.concat( petOutput );
        }

        return {
            logRecords: output,
            playerStats: this._encounterStats?.playerEvents[ character ],
        };
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
                this._updateServerModel();
            }

            this._refreshEncounter();
            
            this._encounterStats.playerEvents[ playerName ] = playerStats;
            this._externalEncounterIds[ externalEncounterId ] = playerName;
        }

    }










    /**
     * Returns a list of log records for all characters on your profile.
     * 
     * @returns {LogRecord[]} The list of log records.
     * 
     * @param {boolean | undefined} untransmittedOnly If true, will only pull untransmitted log records.
     */
    getMyCharacterEncounterEvents( untransmittedOnly ) {
        let output = [];

        this._myCharacters.forEach( c => output = output.concat( this.getCharacterEncounterEvents( c.name, untransmittedOnly ) ) );

        return output;
    }










    /**
     * Adds the given log line to the encounter events.
     * 
     * @param {string} logLine The log file line to process and add to the combat events.
     */
    addCombatEvent( logLine ) {
        let timeLog = /^\[(?<timestamp>.*?)\]\s*(?<log>.*)/gi.exec( logLine )?.groups;
        if ( timeLog ) {

            let entry = {
                timestamp: timeLog.timestamp,
                log: timeLog.log,
            };
            
            this._updateEntityVerifications( [ entry.log ] );

            const timestamp = new Date( entry.timestamp );
            
            let regxResult = null;

            // Dead tracking
            regxResult = executCombatRgx( combatRgx.SlainBy, entry.log );
            regxResult = regxResult == null ? executCombatRgx( combatRgx.YouHaveSlain, entry.log ) : regxResult;
            regxResult = regxResult == null ? executCombatRgx( combatRgx.Died, entry.log ) : regxResult;
            if ( regxResult !== null ) {
                this._addDeathEvent( timestamp, regxResult.groups.target, regxResult.groups.actor, entry.log );
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
            regxResult = regxResult == null ? executCombatRgx( combatRgx.YourDoT, entry.log ) : regxResult;
            regxResult = regxResult == null ? executCombatRgx( combatRgx.OtherDoT, entry.log ) : regxResult;
            regxResult = regxResult == null ? executCombatRgx( combatRgx.SelfDot, entry.log ) : regxResult;
            if ( regxResult !== null ) {
                return this._addDetrimentalSpellEvent( timestamp, regxResult.groups.actor, regxResult.groups.target, +regxResult.groups.damage, regxResult.groups.attackType, regxResult.groups.resistType, regxResult.groups.modifiers );
            }
            
            regxResult = executCombatRgx( combatRgx.Thorns, entry.log );
            if ( regxResult !== null ) {
                return this._addThornsEvent( timestamp,  regxResult.groups.actor ,  regxResult.groups.target , +regxResult.groups.damage );
            }
            
            regxResult = executCombatRgx( combatRgx.Healing, entry.log );
            if ( regxResult !== null ) {
                return this._addBeneficialSpellEvent( timestamp,  regxResult.groups.actor ,  regxResult.groups.target , regxResult.groups.healDuration, +regxResult.groups.healActual, regxResult.groups.healType, +regxResult.groups.healLiteral, regxResult.groups.modifiers );
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
                this._updateServerStatistics = true;
            }

            let petAssigned = false;
            let petAttack = executCombatRgx( combatRgx.PetAttack, lines[ i ] );
            if ( petAttack !== null && petAttack.groups != null && petAttack.groups.pet != null ) {
                petAssigned = true;

                if ( !this._verifiedPlayers.includes( petAttack.groups.pet ) ) {
                    // Some guy playing a prank.
                    
                } else if ( this._verifiedPets.indexOf( petAttack.groups.pet ) === -1 ) {
                    this._verifiedPets.push( petAttack.groups.pet );

                    // This is "my" pet.
                    let petKey = this._characterName;

                    if ( !this._playerPets[ petKey ] ) {
                        this._playerPets[ petKey ] = [];
                    }
                
                    this._petOwners[ petLeader.groups.pet ] = petKey;
                    this._playerPets[ petKey ].push( petLeader.groups.pet );
                    this._updateServerStatistics = true;

                }
            }

            if ( !petAssigned ) {
                let namedPet = executCombatRgx( combatRgx.NamedPet, lines[ i ] );
                if ( namedPet != null && namedPet.groups != null && namedPet.groups.pet != null && namedPet.groups.player != null ) {
                    petAssigned = true;

                    if ( this._verifiedPlayers.indexOf( namedPet.groups.player ) === -1 ) {
                        this._verifiedPlayers.push( namedPet.groups.player );
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
                    let petKey = petLeader.groups.player;

                    if ( this._verifiedPlayers.indexOf( petLeader.groups.player ) === -1 ) {
                        this._verifiedPlayers.push( petLeader.groups.player );
                        this._updateServerStatistics = true;
                    }

                    if ( this._verifiedPets.indexOf( petLeader.groups.pet ) === -1 ) {
                        this._verifiedPets.push( petLeader.groups.pet );
                        this._updateServerStatistics = true;
                    }

                    if ( !this._playerPets[ petKey ] ) {
                        this._playerPets[ petKey ] = [];
                        this._updateServerStatistics = true;
                    }
                
                    if ( this._petOwners[ petLeader.groups.pet ] !== petKey ) {
                        this._petOwners[ petLeader.groups.pet ] = petKey;
                        this._updateServerStatistics = true;
                    }

                    if ( this._playerPets[ petKey ].indexOf( petLeader.groups.pet ) === -1 ) {
                        this._playerPets[ petKey ].push( petLeader.groups.pet );
                        this._updateServerStatistics = true;
                    }

                }
            }

            let playerWho = executCombatRgx( this._playerWhoRgx, lines[ i ] );
            if ( playerWho !== null && playerWho.groups != null && playerWho.groups.player != null ) {
                const playerName = playerWho.groups.player;

                if ( this._verifiedPlayers.indexOf( playerName ) === -1 ) {
                    this._verifiedPlayers.push( playerName );
                }

                if ( this._playerInfos[ playerName ] == null ) {
                    this._playerInfos[ playerName ] = {
                        level: +playerWho.groups.level,
                        className: playerWho.groups.classRealName ?? playerWho.groups.classTitleOrName,
                        raceName: playerWho.groups.raceName,
                    };
                } else {
                    this._playerInfos[ playerName ].level = +playerWho.groups.level;
                    this._playerInfos[ playerName ].className = playerWho.groups.classRealName ?? playerWho.groups.classTitleOrName;
                    this._playerInfos[ playerName ].raceName = playerWho.groups.raceName;
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
                
                this._updateServerStatistics = true;
            }
            
        }

        // TODO: Implicit entity verification could be refactored and optimized.
        let crazy = 0;
        while ( this._unknownEntities.length > 0 && crazy < 5 ) {
            crazy++;

            /** @type {{name: string, attackNpc: number, attackPlayer: number, healNpc: number, healPlayer: number, attackedByNpc: 0, attackedByPlayer: 0}[]} */
            let entitySimpleStats = [];

            // Let's calculate some simple statistics for each unknown entity,
            // and see if we can't figure out what they are implicitly.
            const limit = this.encounterEvents.length > 250 ? 250 : this.encounterEvents.length;
            for ( let i = 0; i < limit; i++ ) {
                const event = this.encounterEvents[ i ];

                if ( event.actor != null && event.target != null ) {
                    // Someone might be unaccounted for.
                    if ( this._unknownEntities.indexOf( event.actor ) > -1 ) {
                        // It's the actor!
                        let stats = entitySimpleStats.find( f => f.name === event.actor );
                        let add = false;

                        if ( stats == null ) {
                            stats = { name: event.actor, attackNpc: 0, attackPlayer: 0, healNpc: 0, healPlayer: 0, attackedByNpc: 0, attackedByPlayer: 0 };
                            add = true;
                        }

                        if ( event.damage > 0 || event.attackAvoided ) {
                            // The actor is attacking something.
                            if ( this._verifiedNpcs.indexOf( event.target ) > -1 ) {
                                stats.attackNpc += 1;
                            } else if ( this._verifiedPlayers.indexOf( event.target ) > -1 ) {
                                stats.attackPlayer += 1;
                            }

                        } else if ( event.heal > 0 ) {
                            // The actor is healing something.
                            if ( this._verifiedNpcs.indexOf( event.target ) > -1 ) {
                                stats.healNpc += 1;
                            } else if ( this._verifiedPlayers.indexOf( event.target ) > -1 ) {
                                stats.healPlayer += 1;
                            }

                        }

                        if ( add ) {
                            entitySimpleStats.push( stats );
                        }

                    } else if ( this._unknownEntities.indexOf( event.target ) > -1 ) {
                        // It's the target!
                        let stats = entitySimpleStats.find( f => f.name === event.target );
                        let add = false;

                        if ( stats == null ) {
                            stats = { name: event.target, attackNpc: 0, attackPlayer: 0, healNpc: 0, healPlayer: 0, attackedByNpc: 0, attackedByPlayer: 0 };
                            add = true;
                        }

                        if ( event.damage > 0 || event.attackAvoided ) {
                            // The known(?) is attacking the unknown.
                            if ( this._verifiedNpcs.indexOf( event.actor ) > -1 ) {
                                stats.attackedByNpc += 1;
                            } else if ( this._verifiedPlayers.indexOf( event.actor ) > -1 || this._verifiedPets.indexOf( event.actor ) > -1 ) {
                                console.log( 'attacked by pet or player' );
                                stats.attackedByPlayer += 1;
                            }

                        }
                        // NPCs can heal just players, so this doesn't tell us anything.
                        // Players can heal NPCs (and can only receive healing by NPCs. Charming a pet that can't heal themselves, so all healing comes from players), so this doesn't tell us anything.
                        if ( add ) {
                            entitySimpleStats.push( stats );
                        }

                    }
                }

            }

            for ( let i = 0; i < entitySimpleStats.length; i++ ) {
                const stats = entitySimpleStats[ i ];

                if ( stats.attackedByPlayer > 0 && stats.attackNpc === 0 ) {

                    this._verifiedNpcs.push( stats.name );
                    let ui = this._unknownEntities.indexOf( stats.name );
                    this._unknownEntities.splice( ui, 1 );
                    this._updateServerStatistics = true;

                } else if ( stats.attackedByNpc > 0 && stats.attackPlayer === 0 ) {

                    this._verifiedPets.push( stats.name );
                    let ui = this._unknownEntities.indexOf( stats.name );
                    this._unknownEntities.splice( ui, 1 );
                    this._updateServerStatistics = true;

                } else if ( stats.attackNpc === 0 && stats.attackPlayer > 0 ) {

                    this._verifiedNpcs.push( stats.name );
                    let ui = this._unknownEntities.indexOf( stats.name );
                    this._unknownEntities.splice( ui, 1 );
                    this._updateServerStatistics = true;

                } else if ( stats.attackPlayer > 0 && stats.attackNpc > 0 ) {

                    if ( stats.attackPlayer / stats.attackNpc <= 0.5 ) {
                        this._verifiedPets.push( stats.name );
                        let ui = this._unknownEntities.indexOf( stats.name );
                        this._unknownEntities.splice( ui, 1 );
                        this._updateServerStatistics = true;

                    } else if ( stats / attackNpc / stats.attackPlayer <= 0.5 ) {
                        this._verifiedNpcs.push( stats.name );
                        let ui = this._unknownEntities.indexOf( stats.name );
                        this._unknownEntities.splice( ui, 1 );
                        this._updateServerStatistics = true;
                        
                    }

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
     * Resets the encounter.
     */
    resetEncounter() {

        if ( this._encounterStats == null )
            return;

        let underMinDmg = this._dpsMeterSettings.encounterMinimumDamage > 0 && ( this._encounterStats?.encounterDamageDone ?? 0 ) < this._dpsMeterSettings.encounterMinimumDamage;

        const eventArgs = new EncounterResetEventArgs();
        eventArgs.encounterId = this._encounterStats.encounterId;
        eventArgs.timestamp = this._encounterStats.lastEncounterEvent;
        eventArgs.logRecords = this.encounterEvents;
        eventArgs.rawLogs = this.encounterRawLogs;
        eventArgs.npcs = [ ...this._encounterStats.npcs ];
        eventArgs.externalEncounterIds = Object.keys( this._externalEncounterIds );
        eventArgs.externalEncounterIdCharacters = this._externalEncounterIds;

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

        if ( this._encounterResetTimerId ) {
            clearTimeout( this._encounterResetTimerId );
        }

        if ( this.onEncounterReset && !underMinDmg ) {
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

        this.#restartEncounterTimeout();

        this.#initializeEncounter( rec );
        
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
            this.encounterEvents.push( rec );
            this._updateEncounterStats( rec );
            
            this._resetNpcDeath( rec.actor, rec.target );
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
     */
    #initializeEncounter( rec ) {
        if ( this._encounterStats == undefined ) {
            // Start a new encounter.
            this._encounterStats = new EncounterStats();
            this._externalEncounterIds = {};
            this._encounterStats.encounterStart = rec?.timestamp || new Date();

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
        }
        
        this._encounterResetTimerId = window.setTimeout( () => this.resetEncounter(), encounterTimeoutMs );

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

                // This is not a named NPC if it begins with A,a,An,an, or a lower case letter.
                const named = names.target.match( /^(?:A\s|An\s|a\s|an\s|[a-z])/ ) == null;
                const timeoutMs = named ? namedNpcTimeoutMs : npcTimeoutMs;

                this._encounterStats.npcDeathTimeoutTimestamps[ names.target ] = timestamp.getTime() + timeoutMs;

            }
        }

        this._startEncounterNpcDeathTimeout();
    }

    
    
    
    
    
    
    
    
    
    /**
     * Resets the death timer for the given NPC.
     * 
     * @param {string[]} names The names of the NPC to reset the death timer for.
     */
    _resetNpcDeath( ...names ) {
        if ( this._encounterStats != null && this.#encounterNpcDeathTimeoutId > 0 ) {
            for ( let i = 0; i < names.length; i++ ) {
                const name = names[ i ];
                if ( this._encounterStats.npcs.includes( name ) && this._encounterStats.npcDeathTimeoutTimestamps[ name ] ) {
                    this._encounterStats.npcDeathTimeoutTimestamps[ name ] = undefined;
                }
            }
        }
    }

    
    
    
    
    
    
    
    
    
    /**
     * Starts the encounter NPC death timeout.
     */
    _startEncounterNpcDeathTimeout() {
        if ( !this.#encounterNpcDeathTimeoutId ) {
            this.#encounterNpcDeathTimeoutId = setTimeout( () => {
                let now = new Date().getTime();
                let npcDeathKeys = Object.keys( this._encounterStats.npcDeathTimeoutTimestamps );
                let endEncounter = true;

                for ( let i = 0; i < npcDeathKeys.length; i++ ) {
                    const npc = npcDeathKeys[ i ];
                    let deathTime = this._encounterStats.npcDeathTimeoutTimestamps[ npc ];

                    if ( deathTime == undefined || deathTime > now ) {
                        endEncounter = false;
                        break;
                    }
                }

                if ( endEncounter ) {
                    this.#encounterNpcDeathTimeoutId = undefined;
                    this.resetEncounter();
                } else {
                    this.#encounterNpcDeathTimeoutId = undefined;
                    this._startEncounterNpcDeathTimeout();
                }
            }, deathCheckDelayMs );
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
     */
    _addMeleeEvent( timestamp, actor, target, damage, attackType, modifiers ) {
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
    
        return this._addEncounterEvent( rec );

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
     */
    _addMeleeAvoidance( timestamp, actor, target, defenseType, attackType, modifiers ) {
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
    
        return this._addEncounterEvent( rec );
        
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
     */
    _addDetrimentalSpellEvent( timestamp, actor, target, damage, attackType, resistType, modifiers ) {
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
            return this._addEncounterEvent( rec );
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
     */
    _addBeneficialSpellEvent(timestamp, actor, target, healDuration, healActual, healType, healLiteral, modifiers) {
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
    
        return this._addEncounterEvent( rec );
        
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
     */
    _addThornsEvent( timestamp, actor, target, damage ) {
        let names = this._getActorTargetNames( actor, target );
    
        let rec = new LogRecord();
        rec.timestamp = timestamp;
        rec.actor = names.actor;
        rec.target = names.target;
        rec.attackType = 'thorns';
        rec.damage = damage;
        rec.thorns = true;
        rec.modifiers = new AttackModifiers();
    
        return this._addEncounterEvent( rec );
        
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
     * @param {string} name The name of the player.
     * @param {string} className The class of the player.
     * @param {Date} timestamp The timestamp for the latest event.
     */
    _getOrCreatePlayerDpsStats( playerDpsRecs, name, className, timestamp ) {
        /** @type {PlayerDps} */
        let statBlock = undefined;

        if ( playerDpsRecs?.length > 0 ) {
            let lastDps = playerDpsRecs[ playerDpsRecs.length - 1 ];
            let delay = DateUtilities.timeSince( lastDps?.end ?? timestamp, timestamp ).totalMilliseconds;

            if ( delay > this._dpsMeterSettings.playerInactiveDelayMs ) {
                statBlock = new PlayerDps();
                statBlock.start = timestamp;
                statBlock.name = name;
                statBlock.class = className;
                statBlock.pets = [];
                playerDpsRecs.push( statBlock );
            } else {
                statBlock = lastDps;
            }
        } else {
            statBlock = new PlayerDps();
            statBlock.start = timestamp;
            statBlock.name = name;
            statBlock.class = className;
            statBlock.pets = [];
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
     * Updates the encounter statistics.
     * 
     * @param {LogRecord} logRecord The log record to update the encounter stats with.
     */
    _updateEncounterStats( logRecord ) {
        const timestamp = logRecord.timestamp || new Date();
        
        if ( logRecord != undefined ) {
            let playerActor = this._verifiedPlayers.includes( logRecord.actor );
            let playerTarget = this._verifiedPlayers.includes( logRecord.target );
            let petActor = this._verifiedPets.includes( logRecord.actor );
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

                if ( playerTarget ) {
                    // If the player is the target, then we need to add to the player's dps received record.
                    let playerEvents = this._getOrCreatePlayerEncounterStats( this._encounterStats.playerEvents, logRecord.target, timestamp );
                    let playerIncoming = this._getOrCreatePlayerDpsStats( playerEvents.playerDpsIncoming, playerEvents.name, playerEvents.class, timestamp );

                    this._calculateDpsStats( logRecord, playerIncoming, playerIncoming.time );

                    if ( this._verifiedNpcs.includes( logRecord.actor ) && !this._encounterStats.npcs.includes( logRecord.actor ) ) {
                        this._encounterStats.npcs.push( logRecord.actor );
                    }

                } else if ( petTarget ) {
                    // If a player's pet is the target, then we need to grab the pet's owner, and add the dps received to the owner's pet list for dps received.
                    let owner = this._petOwners[ logRecord.target ];

                    if ( owner ) {
                        let playerEvents = this._getOrCreatePlayerEncounterStats( this._encounterStats.playerEvents, owner, timestamp );
                        let playerIncoming = this._getOrCreatePlayerDpsStats( playerEvents.playerDpsIncoming, playerEvents.name, playerEvents.class, timestamp );
                        let petDpsRec = this._getOrCreatePetDpsStats( playerIncoming.pets, logRecord.target, timestamp );

                        this._calculateDpsStats( logRecord, petDpsRec, playerIncoming.time );
                    }

                    if ( this._verifiedNpcs.includes( logRecord.actor ) && !this._encounterStats.npcs.includes( logRecord.actor ) ) {
                        this._encounterStats.npcs.push( logRecord.actor );
                    }

                }

                if ( playerActor ) {
                    // If the player is the actor, then we need to add to the player's dps record.
                    let playerEvents = this._getOrCreatePlayerEncounterStats( this._encounterStats.playerEvents, logRecord.actor, timestamp );
                    let playerOutgoing = this._getOrCreatePlayerDpsStats( playerEvents.playerDpsOutgoing, playerEvents.name, playerEvents.class, timestamp );
                    
                    this._calculateDpsStats( logRecord, playerOutgoing, playerOutgoing.time );

                    if ( this._verifiedNpcs.includes( logRecord.target ) && !this._encounterStats.npcs.includes( logRecord.target ) ) {
                        this._encounterStats.npcs.push( logRecord.target );
                    }
                    
                } else if ( petActor ) {
                    // If a player's pet is the actor, then we need to grab the pet's owner, and add the dps to the owner's pet list.
                    let owner = this._petOwners[ logRecord.actor ];
                    
                    if ( owner ) {
                        let playerEvents = this._getOrCreatePlayerEncounterStats( this._encounterStats.playerEvents, owner, timestamp );
                        let playerOutgoing = this._getOrCreatePlayerDpsStats( playerEvents.playerDpsOutgoing, playerEvents.name, playerEvents.class, timestamp );
                        let petDps = this._getOrCreatePetDpsStats( playerOutgoing.pets, logRecord.actor, timestamp );

                        this._calculateDpsStats( logRecord, petDps, playerOutgoing.time );
                    }

                    if ( this._verifiedNpcs.includes( logRecord.target ) && !this._encounterStats.npcs.includes( logRecord.target ) ) {
                        this._encounterStats.npcs.push( logRecord.target );
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
