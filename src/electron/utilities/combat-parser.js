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
const { AttackModifiers, LogRecord, avoidTypeMap, attackTypeMap, PlayerInfo, PlayerDps, EncounterStats, PlayerEncounterStats, PetDps, ServerCombatModel } = require( '../data/models/combat-parser' );

/** @type {string} */
let characterName = 'You';










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

    // Thorns damage. [https://regex101.com/r/w4h5xP/1]
    Thorns: /^(?<target>.*) is pierced by (?<actor>.+?)('s)? (?<attackType>thorns) for (?<damage>[0-9]*) points of non-melee damage\./gi,

    // Healing [https://regex101.com/r/8Xtkrq/2]
    Healing: /^(?<actor>.+?) (has been\s)?healed (?<target>.+?) (?<healDuration>over time for|for) (?<healActual>[0-9]*) (\((?<healLiteral>[0-9]*)\) )?hit points by (?<healType>.+?)\.[\s]?(\((?<modifiers>.*)?\))?/gi,
    
    SlainBy: /^(?<target>.+?) (has|have) been slain by (?<actor>[^!]*)!$/gi,

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

    // The following match LastStand
    // CulminatingStand: null,
    // UltimateStand: null,
    // ResoluteStand: null,
}

// https://regex101.com/r/cqfoUU/2
// This won't capture anon people.
const playerWhoRgx = /^(OFFLINEMODE)?\[(?<level>\d+)\s(?<classTitleOrName>Savage Lord|Arch Mage|High Priest|Grave Lord|Feral Lord|Storm Warden|Arch Convoker|Arch Lich|Lord Protector|Forest Stalker|Dread Lord|Arch Magus|Stone Fist|Scourge Knight|Grand Archanist|Storm Caller|Grand Summoner|Holy Defender|.+?)\]?\s(:?\((?<classRealName>.*?)\)\])?\s?(?<player>.*?)\s\((?<raceName>.+?)\)\s/gi;




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

    // TODO: Keep records of entity verifications, by server where appropriate.
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

    /** @type {LogRecord[]} */
    encounterEvents = [];

    /** @type {{name: string, start: Date, duration: number, end: Date}[]} */
    encounterDefensiveTimers = [];

    /** @type {EncounterStats} */
    _encounterStats = undefined;

    /**
     * Constructs a new combat parser.
     * 
     * @param {string} myCharacterName The character name of the current log file owner.
     * @param {string} serverName The name of the server for the character.
     */
    constructor( myCharacterName, serverName ) {
        characterName = myCharacterName ?? characterName;
        this._verifiedPlayers.push( characterName );
        console.log( 'initiating combat parser for', characterName, 'on server', serverName );
        this._serverName = serverName;

        ipcRenderer.on( 'combat-database:get-server',
            /**
             * Handles the get-server event.
             * 
             * @param {any} event The event args.
             * @param {ServerCombatModel} data The server combat model.
             */
            ( event, data ) => {
                if ( data ) {
                    this._playerInfos = data.verifiedPlayers;
                    this._verifiedPlayers = Object.keys( data.verifiedPlayers );
                    this._verifiedNpcs = data.verifiedNpcs;
                    this._verifiedPets = data.verifiedPets;
                    this._petOwners = data.petOwners;

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
                }
            } );
        
        if ( serverName ) {
            ipcRenderer.send( 'combat-database:get-server', serverName );
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
        // TODO: We should just update this so that DPS statistics are returned instead of the raw encounter events.  That way, we can just update statistics as new combat events are added.
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
     * @returns {PlayerDps[]} The list of player DPS.
     */
    getEncounterDps() {
        /** @type {PlayerDps[]} */
        let output = [];

        for ( let i = 0; i < this._verifiedPlayers.length; i++ ) {
            let playerEvents = this._encounterStats?.playerEvents[ this._verifiedPlayers[ i ] ];
            if ( playerEvents ) {
                
                playerEvents.playerDps.start = playerEvents.encounterStart;
                playerEvents.playerDps.end = playerEvents.lastEncounterEvent;

                output.push( playerEvents.playerDps );
            }
        }

        return output;
    }










    /**
     * Returns the list of log records for the specified character.
     * 
     * @returns {LogRecord[]} The list of log records.
     * 
     * @param {string} character The name of the character to pull log records for.
     * @param {boolean | undefined} untransmittedOnly If true, will only pull untransmitted log records.
     */
    getCharacterEncounterEvents( character, untransmittedOnly ) {
        let actorPets = this._playerPets[ character ];
        let output = this.encounterEvents.filter( f => {
            return ( !untransmittedOnly || f.transmitted === false ) && ( character == null || f.actor === character );
        } );

        if ( actorPets?.length > 0 ) {
            let petOutput = this.encounterEvents.filter( f => ( !untransmittedOnly || f.transmitted === false ) && actorPets.includes( f.actor ) );
            output = output.concat( petOutput );
        }

        return output;
    }










    /**
     * Minifies the given list of event logs.
     * 
     * @returns Returns the minified encounter events.
     * 
     * @param {LogRecord[]} eventLogs The list of event logs to minify.
     */
    getMinifiedEncounterEvents( eventLogs ) {
        return eventLogs.map( m => minifyLogRecord( m ) );
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

            regxResult = executCombatRgx( combatRgx.MeleeDamage, entry.log );
            if ( regxResult !== null ) {
                this._addMeleeEvent( timestamp, regxResult.groups.actor, regxResult.groups.target, +regxResult.groups.damage, regxResult.groups.attackType, regxResult.groups.modifiers );
                return;
            }
            
            regxResult = executCombatRgx( combatRgx.MeleeMiss, entry.log );
            regxResult = regxResult == null ? executCombatRgx( combatRgx.ActiveDefense, entry.log ) : regxResult;
            if ( regxResult !== null ) {
                this._addMeleeAvoidance( timestamp,  regxResult.groups.actor ,  regxResult.groups.target, regxResult.groups.defenseType, regxResult.groups.attackType, regxResult.groups.modifiers );
                return;
            }
            
            regxResult = executCombatRgx( combatRgx.DirectDamage, entry.log );
            regxResult = regxResult == null ? executCombatRgx( combatRgx.YourDoT, entry.log ) : regxResult;
            regxResult = regxResult == null ? executCombatRgx( combatRgx.OtherDoT, entry.log ) : regxResult;
            if ( regxResult !== null ) {
                this._addDetrimentalSpellEvent( timestamp,  regxResult.groups.actor ,  regxResult.groups.target , +regxResult.groups.damage, regxResult.groups.attackType, regxResult.groups.resistType, regxResult.groups.modifiers );
                return;
            }
            
            regxResult = executCombatRgx( combatRgx.Thorns, entry.log );
            if ( regxResult !== null ) {
                this._addThornsEvent( timestamp,  regxResult.groups.actor ,  regxResult.groups.target , +regxResult.groups.damage );
                return;
            }
            
            regxResult = executCombatRgx( combatRgx.Healing, entry.log );
            if ( regxResult !== null ) {
                this._addBeneficialSpellEvent( timestamp,  regxResult.groups.actor ,  regxResult.groups.target , regxResult.groups.healDuration, +regxResult.groups.healActual, regxResult.groups.healType, +regxResult.groups.healLiteral, regxResult.groups.modifiers );
                return;
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
                return;
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
        
        // TODO: This is in serious need of optimization.
        let updateServerModel = false;

        for ( let i = 0; i < lines.length; i++ ) {
            let regxResult = executCombatRgx( combatRgx.GroupRaid, lines[ i ] );
            regxResult = regxResult == null ? executCombatRgx( combatRgx.Chat, lines[ i ] ) : regxResult;
            regxResult = regxResult == null ? executCombatRgx( combatRgx.Achievement, lines[ i ] ) : regxResult;
            if ( regxResult !== null && this._verifiedPlayers.indexOf( regxResult.groups.player ) === -1 ) {
                this._verifiedPlayers.push( regxResult.groups.player );
                updateServerModel = true;
            }

            let petLeader = executCombatRgx( combatRgx.PetLeader, lines[ i ] );
            if ( petLeader !== null && petLeader.groups != null && petLeader.groups.player != null && petLeader.groups.pet != null ) {
                let petKey = petLeader.groups.player;

                if ( this._verifiedPlayers.indexOf( petLeader.groups.player ) === -1 ) {
                    this._verifiedPlayers.push( petLeader.groups.player );
                }

                if ( this._verifiedPets.indexOf( petLeader.groups.pet ) === -1 ) {
                    this._verifiedPets.push( petLeader.groups.pet );
                }

                if ( !this._playerPets[ petKey ] ) {
                    this._playerPets[ petKey ] = [];
                }
                
                this._petOwners[ petLeader.groups.pet ] = petKey;
                this._playerPets[ petKey ].push( petLeader.groups.pet );
                updateServerModel = true;

            }

            let playerWho = executCombatRgx( playerWhoRgx, lines[ i ] );
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
                
                updateServerModel = true;
            }
            
        }

        // TODO: This is looping through all of the encounter events, this should be refactored and optimized.
        for ( let i = 0; i < this.encounterEvents.length; i++ ) {
            const event = this.encounterEvents[ i ];
            const rampages = event.modifiers?.rampage || event.modifiers?.wild_rampage;
            if ( rampages && !this._verifiedPets.includes( event.actor ) && !this._verifiedNpcs.includes( event.actor ) ) {
                this._verifiedNpcs.push( event.actor );
                updateServerModel = true;
            }
        }

        // Loop through all verified players, and remove their named pets from the npcs list. Ex: Soandso's warder.
        for ( let i = 0; i < this._verifiedPlayers.length; i++ ) {
            const player = this._verifiedPlayers[ i ];
            for ( let j = 0; j < this._verifiedNpcs.length; j++ ) {
                const npc = this._verifiedNpcs[ j ];

                if ( npc.indexOf( player ) === 0 ) {
                    this._verifiedPets.push( npc );
                    // Pets do not belong in the verified npcs list.
                    this._verifiedNpcs.splice( j, 1 );
                    updateServerModel = true;
                }
            }
        }


        // TODO: Another loop that is going through all encounter events, refactor and optimize.
        for ( let i = 0; i < this.encounterEvents.length; i++ ) {
            const event = this.encounterEvents[ i ];
            if ( event.actor != null && !( this._verifiedNpcs.indexOf( event.actor ) >= 0 || this._verifiedPets.indexOf( event.actor ) >= 0 || this._verifiedPlayers.indexOf( event.actor ) >= 0 || this._unknownEntities.indexOf( event.actor ) >= 0 ) ) {
                this._unknownEntities.push( event.actor );
                updateServerModel = true;
            }
        }

        // TODO: Implicit entity verification should be refactored and optimized, and not something to be executed at every log line.
        let crazy = 0;
        while ( this._unknownEntities.length > 0 && crazy < 5 ) {
            crazy++;

            /** @type {{name: string, attackNpc: number, attackPlayer: number, healNpc: number, healPlayer: number, attackedByNpc: 0, attackedByPlayer: 0}[]} */
            let entitySimpleStats = [];

            // Let's calculate some simple statistics for each unknown entity,
            // and see if we can't figure out what they are implicitly.
            for ( let i = 0; i < this.encounterEvents.length; i++ ) {
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
                            } else if ( this._verifiedPlayers.indexOf( event.actor ) > -1 ) {
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

                if ( stats.attackPlayer === 0 && stats.attackNpc > 0 ) {

                    this._verifiedPets.push( stats.name );
                    let ui = this._unknownEntities.indexOf( stats.name );
                    this._unknownEntities.splice( ui, 1 );
                    updateServerModel = true;

                } else if ( stats.attackNpc === 0 && stats.attackPlayer === 0 && stats.healPlayer > 0 ) {

                    this._verifiedPets.push( stats.name );
                    let ui = this._unknownEntities.indexOf( stats.name );
                    this._unknownEntities.splice( ui, 1 );
                    updateServerModel = true;

                } else if ( stats.attackedByPlayer > 0 && stats.attackNpc === 0 ) {

                    this._verifiedNpcs.push( stats.name );
                    let ui = this._unknownEntities.indexOf( stats.name );
                    this._unknownEntities.splice( ui, 1 );
                    updateServerModel = true;

                } else if ( stats.attackedByNpc > 0 && stats.attackPlayer === 0 ) {

                    this._verifiedPets.push( stats.name );
                    let ui = this._unknownEntities.indexOf( stats.name );
                    this._unknownEntities.splice( ui, 1 );
                    updateServerModel = true;

                } else if ( stats.attackNpc === 0 && stats.attackPlayer > 0 ) {

                    this._verifiedNpcs.push( stats.name );
                    let ui = this._unknownEntities.indexOf( stats.name );
                    this._unknownEntities.splice( ui, 1 );
                    updateServerModel = true;

                } else if ( stats.attackPlayer > 0 && stats.attackNpc > 0 ) {

                    if ( stats.attackPlayer / stats.attackNpc <= 0.5 ) {
                        this._verifiedPets.push( stats.name );
                        let ui = this._unknownEntities.indexOf( stats.name );
                        this._unknownEntities.splice( ui, 1 );
                        updateServerModel = true;

                    } else if ( stats / attackNpc / stats.attackPlayer <= 0.5 ) {
                        this._verifiedNpcs.push( stats.name );
                        let ui = this._unknownEntities.indexOf( stats.name );
                        this._unknownEntities.splice( ui, 1 );
                        updateServerModel = true;
                        
                    }

                }
            }
        }

        if ( updateServerModel ) {
            this._updateServerModel();
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
                    if ( player === characterName ) {
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
    
        this.encounterEvents.push( rec );
        this._updateEncounterStats( rec );

    }
    
    
    
    
    
    
    
    
    
    
    /**
     * Adds a new defense event to the encounter.
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
    
        this.encounterEvents.push( rec );
        this._updateEncounterStats( rec );
        
    }
    
    
    
    
    
    
    
    
    
    
    /**
     * Adds a new detrimental spell event to the encounter.
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
    
        this.encounterEvents.push( rec );
        this._updateEncounterStats( rec );
        
    }
    
    
    
    
    
    
    
    
    
    
    /**
     * Adds a new beneficial spell event to the encounter.
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
    
        this.encounterEvents.push( rec );
        this._updateEncounterStats( rec );
        
    }
    
    
    
    
    
    
    
    
    
    
    /**
     * Adds a new thorns event to the encounter.
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
    
        this.encounterEvents.push( rec );
        this._updateEncounterStats( rec );
        
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

        if ( duration > 0 ) {
            dpsRec.dps = Math.round( dpsRec.damage / duration );
            dpsRec.hps = Math.round( dpsRec.healing / duration );
        }

    }










    /**
     * 
     * @param {Record<string, PlayerEncounterStats>} source The source for player encounter stats.
     * @param {string} name The name of the player.
     * @param {Date} timestamp The timestamp of the event.
     */
    _getOrCreatePlayerEncounterStats( source, name, timestamp ) {
        if ( source[ name ] == null ) {
            source[ name ] = new PlayerEncounterStats();
            source[ name ].name = name;
            source[ name ].encounterStart = timestamp;
            source[ name ].playerDps.name = name;
            source[ name ].playerDps.pets = [];
            source[ name ].playerDpsRec.name = name;
            source[ name ].playerDpsRec.pets = [];
        }
        source[ name ].lastEncounterEvent = timestamp;

        return source[ name ];
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
                // 30 seconds of no encounter activity ends the encounter, starting a new one.
                if ( this._encounterStats == undefined || this._encounterStats.lastEncounterEvent < DateUtilities.addSeconds( timestamp, -30 ) ) {
                    this._encounterStats = new EncounterStats();
                    this._encounterStats.encounterStart = timestamp;
                }

                this._encounterStats.lastEncounterEvent = timestamp;

                if ( playerTarget ) {
                    // If the player is the target, then we need to add to the player's dps received record.
                    let playerEvents = this._getOrCreatePlayerEncounterStats( this._encounterStats.playerEvents, logRecord.target, timestamp );
                    let playerDuration = DateUtilities.timeSince( playerEvents.encounterStart, timestamp ).totalSeconds;
                    this._calculateDpsStats( logRecord, playerEvents.playerDpsRec, playerDuration );

                } else if ( petTarget ) {
                    // If a player's pet is the target, then we need to grab the pet's owner, and add the dps received to the owner's pet list for dps received.
                    let owner = this._petOwners[ logRecord.target ];
                    let playerEvents = this._getOrCreatePlayerEncounterStats( this._encounterStats.playerEvents, owner, timestamp );

                    let petDpsRec = playerEvents.playerDpsRec.pets.find( f => f.name === logRecord.target );
                    if ( petDpsRec == null ) {
                        petDpsRec = new PetDps();
                        petDpsRec.name = logRecord.target;
                        playerEvents.playerDpsRec.pets.push( petDpsRec );
                    }

                    let playerDuration = DateUtilities.timeSince( playerEvents.encounterStart, timestamp ).totalSeconds;
                    this._calculateDpsStats( logRecord, petDpsRec, playerDuration );

                }

                if ( playerActor ) {
                    // If the player is the actor, then we need to add to the player's dps record.
                    let playerEvents = this._getOrCreatePlayerEncounterStats( this._encounterStats.playerEvents, logRecord.actor, timestamp );
                    let playerDuration = DateUtilities.timeSince( playerEvents.encounterStart, timestamp ).totalSeconds;
                    this._calculateDpsStats( logRecord, playerEvents.playerDps, playerDuration );
                    
                } else if ( petActor ) {
                    // If a player's pet is the actor, then we need to grab the pet's owner, and add the dps to the owner's pet list.
                    let owner = this._petOwners[ logRecord.actor ];
                    let playerEvents = this._getOrCreatePlayerEncounterStats( this._encounterStats.playerEvents, owner, timestamp );

                    let petDps = playerEvents.playerDps.pets.find( f => f.name === logRecord.actor );
                    if ( petDps == null ) {
                        petDps = new PetDps();
                        petDps.name = logRecord.actor;
                        petDps.healing = 0;
                        petDps.damage = 0;
                        playerEvents.playerDps.pets.push( petDps );
                    }

                    let playerDuration = DateUtilities.timeSince( playerEvents.encounterStart, timestamp ).totalSeconds;
                    this._calculateDpsStats( logRecord, petDps, playerDuration );
                    
                }

            }

        }
        
    }
    
}

module.exports = CombatParser;
