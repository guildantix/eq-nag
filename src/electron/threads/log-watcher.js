// const ipc = require( 'electron' ).ipcMain;
const { ipcRenderer, ipcMain } = require( 'electron' );
const fs = require( 'fs' );
const { Trigger, TriggerAction, ActionTypes, TriggerConditionTypes, OperatorTypes, CharacterClassLevel, TriggerSubAction, TriggerFolder, TriggerCondition, CapturePhrase, Phrase, TriggerParseHistoryModel, getActionLabel, LogTypes, ErrorMessages } = require( '../data/models/trigger' );
const { QuickShareAuthorListTypes, SimulationProgress } = require( '../data/models/common' );
const { PhraseParse, LogTrigger } = require( './log.model' );
const { OverlayComponent, OverlayWindow, TriggerSecondaryActionModel } = require( '../data/models/overlay-window' );
const { CharacterModel } = require( '../data/models/character' );
const customAlphabet = require( 'nanoid' ).customAlphabet;
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const nanoid = customAlphabet( alphabet, 16 );
const _ = require( 'lodash' );

const StringUtilities = require( '../utilities/string' );
const NumberUtilities = require( '../utilities/numbers' );
const ThreadUtilities = require( '../utilities/threading' );
const { FctModel, FctTypes } = require( '../data/models/fct' );
const { DateUtilities } = require( '../utilities/dates' );
const { IpcMessage } = require( '../data/models/common' );
const ArrayUtilities = require( '../utilities/arrays' );
const chunkSize = 512 * 1024;

window.onerror = ( error, url, line ) => {
    ipcRenderer.send( 'app:log:exception', `$${error}\r\n    at ${url}:${line}` );
};

function logInfo( data ) {
    ipcRenderer.send( 'app:log:info', data );
}

var currentPosition = null;

var watcher = null;
/** @type {OverlayWindow} */
var overlays = [];
/** @type {LogTrigger[]} */
var triggers = [];
/** @type {TriggerFolder[]} */
var triggerFolders = [];
/** @type {Record<string, string[]>} */
var storedVariables = {};
/** @type {string[]} A list of all component instance ids originated by this log watcher. */
var logInstanceIds = [];
/** @type {Record<string, {value: number, lastUpdate: Date, resetDelay: number, _parse: (logEntry: string) => boolean}>} */
var counters = {};
/** @type {{_parse: (logEntry: string) => boolean, instanceId: string}[]} */
var cancellableComponents = [];
/** @type {{_parse: (logEntry: string) => boolean, _trigger: (instanceId: string, timestamp: Date) => void, instanceId: string}[]} */
var secondaryTriggerActions = [];
/** @type {{_parse: (logEntry: string) => boolean, _trigger: (instanceId: string, timestamp: Date) => void, instanceId: string}[]} */
var dotWornOffTracking = [];
/** @type {Record<string, string[]>} */
var usedConditionValues = {};
var enableFct = false;
var enableQuickShareImports = true;
var damageDealtOverlayId = null;
var damageReceivedOverlayId = null;
var voiceOptions = [];
var voiceIndex = -1;
var masterVolume = 100;
var speechVolume = 100;
var audioVolume = 100;
var baseSpeakingRate = 1;
var logParseTimeoutId = null;
const logParseTimer = 50;
var changingLogFile = false;
var isDev = false;
var enableLogging = true;
/** @type {CharacterModel} */
var charModel = null;
var characterName = null;
/** @type {SpeechSynthesisUtterance[]} */
var utterances = [];
/** @type {Record<string, string>} */
var phoneticTransforms = {};
/** @type {Record<number, string[]>} */
var parsedLogEntries = {};
/** @type {{}} */
var persistentDictionary = {};
/** @type {string} */
var detrimentalOverlayId = null;
/** @type {string} */
var characterId = null;
const serverTickDuration = 6;
/** @type {TriggerParseHistoryModel[]} */
let successfulParses = [];
/** @type {TriggerParseHistoryModel[]} */
let failedParses = [];
/** @type {TriggerParseHistoryModel[]} */
let exceptionParses = [];
let batchTriggerParseHistoryTimeoutId = null;
const batchTriggerParseHistoryTimeoutDuration = 100;

/** @type {Record<string, {trigger: LogTrigger, res: PhraseParse}>} */
let actionInstances = {};

/** @type {QuickShareAuthorListTypes} */
let quickShareAuthorsListType = QuickShareAuthorListTypes.Disabled;

/** @type {string[]} */
let quickShareAuthorsList = [];

/** @type {HTMLAudioElement[]} */
let audioPlayers = [];

/** @type {string} */
let logFilePath = null;

/** @type {number|null} */
let eqTick = null;

/** @type {number[]} */
let outOfSyncEqTicks = [];

const resetEqTickOnCount = 3;

/** @type {number} */
let eqTickUpdate = 0;

/** @type {number|null} */
let eqTickIntervalId = null;

const eqTickMaxUpdateDistance = 60 * 1000;
const eqTickVariance = 1500;

/** @type {number|null} */
let eqTickTimeoutId = null;

/** @type {string} */
let simulationId = null;

/** @type {number} */
let simulationLineIndex = -1;

/** @type {number} */
let simulationMaxIndex = -1;

/** @type {boolean} */
let simulationPaused = false;

/** @type {boolean} */
let stopSimulation = false;

/** @type {Record<string, any>} */
let simulationCache = {};

/** @type {string[]} */
let disabledTriggerIds = [];









/**
 * Sends the error information to the main thread for logging.
 * 
 * @param {any} err The error object.
 * @param {string} raw The log entry currently processing.
 * @param {boolean} simulating True if we're simulating a log file.
 * @param {number} padTime The number of seconds to add to log time.
 * @param {string} errorDesc An error description to send to the debug console for the user.
 * @param {LogTrigger|undefined|null} trigger The trigger that caused the error.
 * @param {TriggerAction|undefined|null} action The trigger that caused the error.
 * @param {'End Early' | 'Trigger Action' | 'Exclude Target' | 'Trigger Secondary Action'} parseType The type of parse.
 * @param {string} renderedPhrase The rendered phrase.
 * @param {string} unrenderedPhrase The unrendered phrase.
 */
const logParseError = ( err, raw, simulating, padTime, errorDesc, trigger, action, parseType, renderedPhrase, unrenderedPhrase ) => {
    if ( raw ) {
        ipcRenderer.send( 'app:log:exception', {
            source: 'log-watcher.js',
            error: err,
            logEntry: raw,
            simulating: simulating === true,
            padTime: padTime === undefined ? 'undefined' :
                padTime === null ? 'null' :
                    padTime,
        } );
    } else {
        ipcRenderer.send( 'app:log:exception', err );
    }

    if ( errorDesc ) {
        
        // If there is an error description, send it to the debug console.

        let entry = new TriggerParseHistoryModel();

        entry.parseId = nanoid();
        entry.timestamp = new Date();
        entry.triggerId = trigger?.triggerId;
        entry.triggerName = trigger?.name;
        entry.actionId = action ? action.actionId : null;
        entry.actionTypeLabel = action ? getActionLabel( action.actionType ) : null;
        entry.rawLogEntry = raw;
        entry.logType = LogTypes.error;
        entry.error = err + '';
        entry.errorDescription = errorDesc;
        entry.parseType = parseType;
        entry.renderedPhrase = renderedPhrase;
        entry.unrenderedPhrase = unrenderedPhrase;
        entry.conditionResults = trigger?._conditionResults;
        entry.deltaTime = trigger?._deltaTime;
        entry.phraseId = null;
        entry.regexResult = null;
        entry.dependencyRegexResult = null;
        entry.counters = JSON.parse( JSON.stringify( counters ) );
        entry.storedVariables = JSON.parse( JSON.stringify( storedVariables ) );

        entry.characterId = characterId;
        entry.characterName = characterName;

        exceptionParses.push( entry );

    }
};










/**
 * Sends the error information to the main thread for logging.
 * 
 * @param {any} err The error object.
 * @param {string} raw The log entry currently processing.
 * @param {boolean} simulating True if we're simulating a log file.
 * @param {number} padTime The number of seconds to add to log time.
 * @param {string} errorDesc An error description to send to the debug console for the user.
 * @param {LogTrigger|undefined|null} trigger The trigger that caused the error.
 * @param {TriggerAction|undefined|null} action The trigger that caused the error.
 */
const logError = ( err, raw, simulating, padTime, errorDesc, trigger, action ) => {
    logParseError( err, raw, simulating, padTime, errorDesc, trigger, action );
};










/**
 * Starts tracking the server tick.
 * 
 * @param {number} time The eq tick time in milliseconds since midnight, January 1, 1970 UTC.
 */
let startEqTickTracking = ( time ) => {
    
    if ( eqTickTimeoutId > 0 ) {
        window.clearTimeout( eqTickTimeoutId );
    }
    if ( eqTickIntervalId > 0 ) {
        window.clearInterval( eqTickIntervalId );
    }

    // Set a timeout that will start the interval at the next server tick.
    eqTickTimeoutId = window.setTimeout( () => {

        // Set the current eq tick time.
        eqTick = new Date().getTime();

        // We should be synced with EQ time (for a bit at least) so let's start the 6 second interval tracking ticks.
        eqTickIntervalId = window.setInterval( () => {
            // Set the current eq tick time.
            eqTick = new Date().getTime();
        }, 6000 );

    // The duration of the timeout needs to sync the computer clock with the timestamp given from the log entry.
    }, time + ( 6 * 1000 ) - ( new Date().getTime() ) );
}

/**
 * Returns the next estimated EQ Server Tick for this character.
 * 
 * @returns {Date}
 */
let nextEqTick = () => {
    if ( eqTick > 0 ) {
        return new Date( eqTick + 6 * 1000 );
    } else {
        return null;
    }
}

/**
 * Sets the current tick value.
 * 
 * @param {Date} timestamp The timestamp of the tick.
 */
let setEqTick = ( timestamp ) => {
    if ( timestamp ) {
        let time = timestamp.getTime();

        let updateTime = new Date().getTime();
        let updateDistance = Math.abs( eqTickUpdate - updateTime );
        let nextTickTime = eqTick + 6 * 1000;

        let update = () => {
            eqTick = time;
            startEqTickTracking( time );
        }

        if ( updateDistance >= eqTickMaxUpdateDistance || Math.abs( nextTickTime - time ) > eqTickVariance ) {
            // If we haven't had a tick update in a while or the tick is way out of variance, then we'll just go with it.
            update();

        } else {

            if ( !outOfSyncEqTicks.includes( time ) ) {
                outOfSyncEqTicks.push( time );
            }

            // If the tick time is inside the variance amount for more than the configured number of distinct ticks, then let's update the tick timer.
            if ( outOfSyncEqTicks.length >= resetEqTickOnCount ) {
                update();
            }
        }
        


    }
}










/**
 * Sends the batch of parses to the main process, clears the batch, and sets 
 * the timeout to run again.
 */
let _batchTriggerParseHistory = () => {

    ipcRenderer.once( 'trigger:batch:complete', ( event, data ) => {

        // Set the timeout to run again.
        batchTriggerParseHistoryTimeoutId = window.setTimeout( () => _batchTriggerParseHistory(), batchTriggerParseHistoryTimeoutDuration );
            
    } );

    // Send the batch of parses to the main process.
    ipcRenderer.send( 'trigger:batch-history', { successful: successfulParses, failed: failedParses, exceptions: exceptionParses } );

    // Clear the batch.
    successfulParses = [];
    failedParses = [];
    exceptionParses = [];

}
batchTriggerParseHistoryTimeoutId = window.setTimeout( () => _batchTriggerParseHistory(), batchTriggerParseHistoryTimeoutDuration );










/**
 * Creates a new parse history entry.
 * 
 * @returns {TriggerParseHistoryModel} Returns the parse history entry.
 * 
 * @param {string} rawLogEntry The raw log entry.
 * @param {LogTypes} logType The log entry type.
 * @param {Trigger} trigger The trigger that was triggered.
 * @param {string} actionId The id of the action that was triggered.
 * @param {'End Early' | 'Trigger Action' | 'Exclude Target' | 'Trigger Secondary Action'} parseType The type of parse.
 * @param {string} renderedPhrase The rendered phrase.
 * @param {string} unrenderedPhrase The unrendered phrase.
 * @param {PhraseParse | undefined} parsedPhrase The parsed phrase.
 * @param {Record<string, string>} conditionResults The results of the trigger condition checks.
 * @param {number | undefined} deltaTime The time in milliseconds between the sequential phrases.
 */
let _getParseHistoryEntry = ( rawLogEntry, logType, trigger, actionId, parseType, renderedPhrase, unrenderedPhrase, parsedPhrase, conditionResults, deltaTime ) => {
    let entry = new TriggerParseHistoryModel();

    entry.parseId = nanoid();
    entry.timestamp = new Date();
    entry.triggerId = trigger.triggerId;
    entry.triggerName = trigger.name;
    entry.actionId = actionId;
    entry.actionTypeLabel = getActionLabel( trigger.actions.find( a => a.actionId === actionId )?.actionType );
    entry.parseType = parseType;
    entry.renderedPhrase = renderedPhrase;
    entry.unrenderedPhrase = unrenderedPhrase;
    entry.phraseId = parsedPhrase?.phraseId;
    entry.regexResult = parsedPhrase?.result;
    entry.dependencyRegexResult = parsedPhrase?.dependencyResult;
    entry.conditionResults = conditionResults;
    entry.deltaTime = deltaTime;
    entry.counters = JSON.parse( JSON.stringify( counters ) );
    entry.storedVariables = JSON.parse( JSON.stringify( storedVariables ) );
    entry.characterId = characterId;
    entry.characterName = characterName;
    entry.rawLogEntry = rawLogEntry;
    entry.logType = logType;

    return entry;
};








// TODO: Remove "Trigger" from option strings, since it's redundant.

/**
 * Adds a successful trigger parsed event to the batch.
 * 
 * @param {string} rawLogEntry The raw log entry.
 * @param {string} triggerId The id of the trigger that was triggered.
 * @param {string} actionId The id of the action that was triggered.
 * @param {'End Early' | 'Trigger Action' | 'Trigger Sequential Action' | 'Trigger Action Loopback' | 'Exclude Target' | 'Trigger Cancel Action' | 'Trigger Secondary Action' | 'Reset Counter'} parseType The type of parse.
 * @param {string} renderedPhrase The rendered phrase.
 * @param {string} unrenderedPhrase The unrendered phrase.
 * @param {PhraseParse | undefined} parsedPhrase The parsed phrase.
 * @param {Record<string, string>} conditionResults The results of the trigger condition checks.
 * @param {number | undefined} deltaTime The time in milliseconds between the sequential phrases.
 */
let addSuccessfulTriggerParsedEvent = ( rawLogEntry, triggerId, actionId, parseType, renderedPhrase, unrenderedPhrase, parsedPhrase, conditionResults, deltaTime ) => {
    let trigger = triggers.find( t => t.triggerId === triggerId );
    if ( trigger ) {
        let entry = _getParseHistoryEntry( rawLogEntry, LogTypes.info, trigger, actionId, parseType, renderedPhrase, unrenderedPhrase, parsedPhrase, conditionResults, deltaTime );

        // Add the entry to the batch.
        successfulParses.push( entry );
    }
};










/**
 * Adds a failed trigger parse history entry.
 * 
 * @param {string} rawLogEntry The raw log entry.
 * @param {string} triggerId The id of the trigger that was triggered.
 * @param {string} actionId The id of the action that was triggered.
 * @param {'End Early' | 'Trigger Action' | 'Trigger Sequential Action' | 'Trigger Action Loopback' | 'Exclude Target' | 'Trigger Secondary Action' | 'Reset Counter'} parseType The type of parse.
 * @param {string | string[]} renderedPhrase The rendered phrase.
 * @param {string | string[]} unrenderedPhrase The unrendered phrase.
 * @param {PhraseParse | undefined} parsedPhrase The parsed phrase.
 * @param {Record<string, string>} conditionResults The results of the trigger condition checks.
 * @param {number | undefined} deltaTime The time in milliseconds between the sequential phrases.
 */
let addFailedTriggerParsedEvent = ( rawLogEntry, triggerId, actionId, parseType, renderedPhrase, unrenderedPhrase, parsedPhrase, conditionResults, deltaTime ) => {
    // let trigger = triggers.find( t => t.triggerId === triggerId );

    // if ( trigger ) {
    //     let entry = _getParseHistoryEntry( rawLogEntry, LogTypes.info, trigger, actionId, parseType, renderedPhrase, unrenderedPhrase, parsedPhrase, conditionResults, deltaTime );
        
    //     // Add the entry to the batch.
    //     failedParses.push( entry );
    // }
};

// Common errors:
//  ${C} instead of {C}
//  ${CharacterName} isntead of ${Character}
//  ending with a '.' in regex instead of a '\.'
//  Forgetting to check the box for regex.
//  Choosing the wrong phrase for an action.
//      If the display text has {C} or {TS} in it, but the trigger phrase selected doesn't contain either option.










/**
 * Waits until the specified file exists and executes the startParsingLogFile 
 * method, starting at the beginning of the file.
 * 
 * @param {string} logPath The full path to the log file.
 */
function waitForLogFile( logPath ) {
    
    if ( logParseTimeoutId > 0 ) {
        window.clearTimeout( logParseTimeoutId );
        logParseTimeoutId = null;
        currentPosition = null;
    }

    if ( fs.existsSync( logPath ) ) {
        logInfo( `LogWatcher > ${logPath} file found, starting up again.` );
        startParsingLogFile( logPath, 0 );
    } else {
        window.setTimeout( () => waitForLogFile( logPath ), logParseTimer );
    }
}










/**
 * Starts parsing and watching log file changes for the specified file.
 * 
 * @param {string} logPath The file path to the log file.
 * @param {number} startLogPosition If a value is provided, will start parsing the log file at the given position.
 */
function startParsingLogFile( logPath, startLogPosition ) {
    fs.open( logPath, 'r', function ( err, fd ) {

        if ( fd ) {
            var file = fd;
            if ( startLogPosition != null && startLogPosition >= 0 ) {
                currentPosition = startLogPosition;
                startLogPosition = null;
            }
            currentPosition = currentPosition === null ? fs.fstatSync( file ).size : currentPosition;
            function parseLogFile() {

                if ( !fs.existsSync( logPath ) ) {
                    logInfo( `LogWatcher > ${logPath} does not exist, waiting for new log file.` );
                    waitForLogFile( logPath );
                    return;
                }

                var stats = fs.fstatSync( fd );
                var file = fd;
                var thisChunkSize = stats.size - currentPosition;
                
                // Prevent some overflows, if this is greater than the chunk
                // size, the something fucky happened with the log file, let's 
                // just start at the end of the file.
                if ( thisChunkSize > chunkSize ) {
                    currentPosition = stats.size;
                } else if ( currentPosition > stats.size ) {
                    currentPosition = stats.size;
                }

                fs.read( file, Buffer.alloc( stats.size - currentPosition ), 0, stats.size - currentPosition, currentPosition, ( err, bytecount, buff ) => {
                
                    currentPosition += bytecount;
                    let read = buff.toString( 'utf-8', 0, bytecount );
                    let lines = read.split( /\r\n|\r|\n/gmi );
                
                    lines.forEach( line => {
                        if ( line && line.length > 0 ) {
                            parseLogEntries( line );
                        }
                    } );

                } );

                // Wait logParseTimer milliseconds and poll again.
                if ( !changingLogFile ) {
                    logParseTimeoutId = window.setTimeout( parseLogFile, logParseTimer );
                }
            }

            // Start polling the log file every logParseTimer milliseconds.
            logParseTimeoutId = window.setTimeout( parseLogFile, logParseTimer );

        } else {
            // If the log file was not found, then let's wait for it to show up.
            waitForLogFile( logPath );

        }
    } );
}

const waitForSimulationResume = async () => {
    while ( simulationPaused ) {
        await ThreadUtilities.sleep( 250 );
    }
}

const waitForSimulationToEnd = async () => {
    while ( simluationId !== null ) {
        await ThreadUtilities.sleep( 5000 );
    }
}

/**
 * Creates a simulation timer that will display the remaining time in an overlay.
 * 
 * @returns Returns the instanceId of the created timer.
 * 
 * @param {number} duration The duration of the simulation in milliseconds.
 */
function createSimulationTimer( duration ) {
    let res = new PhraseParse();
    let action = new TriggerAction();
    let trigger = new LogTrigger();

    trigger.name = 'Simulation Timer';
    trigger._reset = () => { };
    trigger._parse = ( value, onMatch ) => { };
    trigger._conditionResults = {};
    trigger._deltaTime = 0;

    action.actionId = nanoid();
    action.displayText = 'Simulation Duration';
    action.overlayId = detrimentalOverlayId;
    action.showDuration = true;
    action.actionType = ActionTypes.Countdown;

    action.duration = duration;

    let instanceId = displayTimerCountdownComponent( res, new Date(), action, 0, trigger );
    
    logInstanceIds.push( instanceId );

    return instanceId;
}

/**
 * 
 * @param {string} lines The lines to simulate.
 * @param {Date} timestamp The timestamp to use for the simulation.
 * @param {*} lastBlock Unknown.
 * @param {number} padTime The amount of time to pad between each line.
 */
function simulateLogEntries( lines, timestamp, lastBlock, padTime ) {

    // Create an object that can track the progress.
    let progress = new SimulationProgress();
                
    progress.completePercent = 0;
    progress.label = `Simulating`;
    progress.isComplete = false;
    
    for ( let i = 0; i < lines.length; i++ ) {
        
        if ( simulationPaused ) {
            waitForSimulationResume();
        }

        simulationLineIndex += 1;
        progress.lineIndex = simulationLineIndex;
        
        let complete = ( progress.lineIndex ) / simulationMaxIndex;
        progress.completePercent = NumberUtilities.round( complete * 100, 2 );
        ipcRenderer.send( `log:simulation:${simulationId}:progress`, progress );
        
        parseLogEntries( lines[ i ], false, padTime );
    }
    if ( lastBlock ) {
        speakPhrase( 'Simulation ended', false, false, {}, false, {}, 0, 0, 100, 1, () => ipcRenderer.send( 'log:simulate:done', characterId ) );
    }
}










/**
 * Initializes the log watcher.
 * 
 * @param {CharacterModel} character The character details.
 * @param {number} logPosition The starting log position.
 */
function LogWatcher(character, logPosition) {
    
    if ( character ) {
        characterName = character.name;
        charModel = character;
        characterId = character.characterId;
    }

    loadCachedStoredVariables( () => {
        saveScalarVariable( "Character", characterName );
    } );

    ipcRenderer.on( 'log:changed',
        /**
         * Handles the log:changed event.
         * 
         * @param {any} event The event args.
         * @param {string} data The log file path.
         */
        function ( event, data ) {
            
            logFilePath = data;

            if ( logParseTimeoutId > 0 ) {
                window.clearTimeout( logParseTimeoutId );
                currentPosition = null;
                backfind( data, () => startParsingLogFile( data, logPosition >= 0 ? logPosition : null ) );
            } else {
                // If there is a timeout id, then we're in the middle of
                // processing a chunk of log file entries, let's give a 
                // millisecond for that to complete.
                changingLogFile = true;
                window.setTimeout( () => {
                    changingLogFile = false;
                    currentPosition = null;
                    backfind( data, () => startParsingLogFile( data, logPosition >= 0 ? logPosition : null ) );
                }, logParseTimer );
            }

            if ( watcher != null ) {
                watcher.close();
            }
        
        } );

    ipcRenderer.on( 'log:simulate:file', function ( event, data ) {
        fs.open( data, 'r', function ( err, fd ) {
            var file = fd;
            var stats = fs.fstatSync( fd );
                    
                fs.read( file, Buffer.alloc( stats.size ), 0, stats.size, 0, ( err, bytecount, buff ) => {
                    let read = buff.toString( 'utf-8', 0, bytecount );
                    let lines = read.split( /\r\n|\r|\n/gmi );
                    lines.forEach( line => {
                        if ( line && line.length > 0 ) {
                            parseLogEntries( line, true );
                        }
                    } );
                    console.log( 'lines done' );
                } );

        } );
    } );

    ipcRenderer.on( 'log:simulate:begin',
        /**
         * Begins the simulation.
         * 
         * @param {any} event Electron event args.
         * @param {{lines: string, lineIndex: number|null, simluationId: string}} model Simulation data.
         */
        async ( event, model ) => {
        
            if ( !model || !model.lines || model.lines.length == 0 ) {
                return;
            }

            if ( simulationId ) {
                await waitForSimulationToEnd();
            }

            // Keep a backup of the stored variables.
            simulationCache[ 'storedVariables' ] = storedVariables;
            simulationCache[ 'counters' ] = counters;
            simulationCache[ 'usedConditionValues' ] = usedConditionValues;
            
            simulationMaxIndex = model.lines.length - 1;
            simulationLineIndex = -1;
            simulationId = model.simulationId;
            let simTimerId = null;

            // Setup event handlers for this simulation.

            const cleanUp = () => {
                console.log( 'cleaning up', simulationId );

                const simulationStoppedChannel = `log:simulation:${simulationId}:stopped`;

                storedVariables = simulationCache[ 'storedVariables' ];
                counters = simulationCache[ 'counters' ];
                usedConditionValues = simulationCache[ 'usedConditionValues' ];
                
                if ( simTimerId ) {
                    ipcRenderer.send( 'overlay:destroy:component', simTimerId );
                }

                ipcRenderer.removeAllListeners( `log:simulation:${simulationId}:pause` );
                ipcRenderer.removeAllListeners( `log:simulation:${simulationId}:resume` );
                ipcRenderer.removeAllListeners( `log:simulation:${simulationId}:stop` );

                ipcRenderer.send( simulationStoppedChannel );

                simulationPaused = false;
                simulationMaxIndex = -1;
                simulationLineIndex = -1;
                simulationCache = {};
                simulationId = null;

            };
            
            ipcRenderer.on( `log:simulation:${simulationId}:pause`, () => {
                simulationPaused = true;
            } );
            
            ipcRenderer.on( `log:simulation:${simulationId}:resume`, ( lineIndex ) => {
                simulationPaused = false;
                simulationLineIndex = lineIndex ?? simulationLineIndex;
            } );
            
            ipcRenderer.on( `log:simulation:${simulationId}:stop`, () => {
                stopSimulation = true;
                cleanUp();
            } );

            /** @type {{lines: string[], delay: number, timestamp: Date}[]} */
            var lineData = [];

            let currentTimestamp = null;
            let start = new Date( /^\[(.*?)\]\s*/gi.exec( model.lines[ 0 ] )[ 1 ] );
            let di = -1;
    
            // Process each log file into a chunk that contains all entries at the same second.
            for ( let i = 0; i < model.lines.length; i++ ) {
                if ( model.lines[ i ]?.length > 0 ) {
                    let lineTimestamp = new Date( /^\[(.*?)\]\s*/gi.exec( model.lines[ i ] )[ 1 ] );
    
                    if ( currentTimestamp == null || lineTimestamp.getTime() != currentTimestamp.getTime() ) {
                        currentTimestamp = lineTimestamp;
                        di += 1;
                        lineData[ di ] = {
                            lines: [],
                            delay: DateUtilities.timeSince( start, lineTimestamp ).totalSeconds,
                            timestamp: lineTimestamp,
                        };
                    }
    
                    lineData[ di ].lines.push( model.lines[ i ] );
                }
            }
    
            let fudge = 0;
            let simDuration = lineData[ lineData.length - 1 ].delay + lineData.length * fudge;
            simDuration = simDuration >= 1 ? simDuration : 1;
            // The padTime allows us to simulate the log file in real time by timeshifting the log entries to now.
            let padTime = DateUtilities.timeSince( start, new Date() ).totalSeconds;

            const calculateRemainingTime = ( lineIndex ) => {
                lineIndex = lineIndex >= 0 ? lineIndex : 0;
                let remainingDurationMs = 0;
                for ( let k = lineIndex + 1; k < lineData.length; k++ ) {
                    remainingDurationMs += DateUtilities.timeSince( lineData[ k - 1 ].timestamp, lineData[ k ].timestamp ).totalMilliseconds;
                }
                return remainingDurationMs;
            }

            // Create an object that can track the progress.
            let progress = new SimulationProgress();

            progress.completePercent = 0;
            progress.label = `Simulating`;
            progress.isComplete = false;
            progress.msRemaining = simDuration;
            progress.lineIndex = 0;
    
            ipcRenderer.send( `log:simulation:${simulationId}:progress`, progress );

            for ( let i = 0; i < lineData.length; i++ ) {
                
                for ( let j = 0; j < lineData[ i ].lines.length; j++ ) {
                    
                    if ( stopSimulation ) {
                        break;
                    }
                    
                    if ( simulationPaused ) {
                    
                        progress.msRemaining = calculateRemainingTime( i );
                        progress.simulationPaused = true;
                        ipcRenderer.send( `log:simulation:${simulationId}:progress`, progress );

                        while ( simulationPaused ) {
                            await ThreadUtilities.sleep( 250 );
                        }

                        // TODO: Enable pause resume at a specific line.
                        // TODO: When paused, all timed actions should be paused as well.
                        let newIndex = 0;
                        for ( let k = 0; k < lineData.length; k++ ) {
                            for(let l = 0; l < lineData[ k ].lines.length; l++) {
                                newIndex += 1;

                                if ( newIndex > simulationLineIndex ) {
                                    simulationLineIndex = newIndex;
                                    break;
                                }
                            }
                        }
                        
                    }

                    simulationLineIndex += 1;
                    progress.lineIndex = simulationLineIndex;
                    progress.completePercent = ( simulationLineIndex / simulationMaxIndex ) * 100;

                    parseLogEntries( lineData[ i ].lines[ j ], false, padTime ); // The simulating argument will not execute most triggers. // TODO: Remove the simulating argument from parse log entries, it's not used any more.
                }

                if ( stopSimulation ) {
                    break;
                }

                if ( i < lineData.length - 1 ) {
                    
                    progress.msRemaining = calculateRemainingTime( i );
                    progress.simulationPaused = false;
                    ipcRenderer.send( `log:simulation:${simulationId}:progress`, progress );

                    // Wait for a period of time that matches the time between
                    // the current chunk and the next chunk.  By using async, 
                    // the log watcher will continue to process log entries 
                    // while we wait.
                    let waitMs = DateUtilities.timeSince( new Date(), new Date( lineData[ i + 1 ].timestamp.getTime() + ( padTime * 1000 ) ) ).totalMilliseconds;


                    await ThreadUtilities.sleep( waitMs );
                    
                    if ( stopSimulation ) {
                        break;
                    }
                }

            }
    
            if ( !stopSimulation ) {
                cleanUp();
            }

            stopSimulation = false;

        } );

    ipcRenderer.on( 'log:simulate:lines', function ( event, data ) {
        /** @type {{lines: string[], delay: number, timestamp: Date}[]} */
        var lineData = [];

        let initializeSimTimer =
            /**
             * Starts a timer in detrimental that shows how long the simulation will run.
             * 
             * @param {number} duration The timer duration, in seconds.
             */
            ( duration ) => {
                let res = new PhraseParse();
                let action = new TriggerAction();
                let trigger = new LogTrigger();

                trigger.name = 'Simulation Timer';
                trigger._reset = () => { };
                trigger._parse = ( value, onMatch ) => { };
                trigger._conditionResults = {};
                trigger._deltaTime = 0;

                action.actionId = nanoid();
                action.displayText = 'Simulation Duration';
                action.overlayId = detrimentalOverlayId;
                action.showDuration = true;
                action.actionType = ActionTypes.Countdown;
            
                action.duration = duration;

                displayTimerCountdownComponent( res, new Date(), action, 0, trigger );
            
            };

        let simLogEntries =
            /**
             * Parses the given log entries.
             * 
             * @param {string[]} lines The log entries at this point in time.
             * @param {Date} timestamp The timestamp.
             * @param {boolean} lastBlock If true, this is the last block of the simulation.
             * @param {number} padTime The ammount of time to pad the log entries with, in seconds.
             */
            ( lines, timestamp, lastBlock, padTime ) => {
                for ( let i = 0; i < lines.length; i++ ) {
                    parseLogEntries( lines[ i ], false, padTime );
                }
                if ( lastBlock ) {
                    speakPhrase( 'Simulation ended', false, false, {}, false, {}, 0, 0, 100, 1, () => ipcRenderer.send( 'log:simulate:done', characterId ) );
                }
            };
        
        if ( data?.length > 0 ) {
            let currentTimestamp = null;
            let start = new Date( /^\[(.*?)\]\s*/gi.exec( data[ 0 ] )[ 1 ] );
            let di = -1;

            // Process each log file into a chunk that contains all entries at the same second.
            for ( let i = 0; i < data.length; i++ ) {
                if ( data[ i ]?.length > 0 ) {
                    let lineTimestamp = new Date( /^\[(.*?)\]\s*/gi.exec( data[ i ] )[ 1 ] );

                    if ( currentTimestamp == null || lineTimestamp.getTime() != currentTimestamp.getTime() ) {
                        currentTimestamp = lineTimestamp;
                        di += 1;
                        lineData[ di ] = {
                            lines: [],
                            delay: DateUtilities.timeSince( start, lineTimestamp ).totalSeconds,
                            timestamp: lineTimestamp,
                        };
                    }

                    lineData[ di ].lines.push( data[ i ] );
                }
            }

            let fudge = 0;
            let simDuration = lineData[ lineData.length - 1 ].delay + lineData.length * fudge;
            simDuration = simDuration >= 1 ? simDuration : 1;
            let padTime = DateUtilities.timeSince( start, new Date() ).totalSeconds;
            for ( let i = lineData.length - 1; i >= 0; i-- ) {
                window.setTimeout( () => simLogEntries( lineData[ i ].lines, lineData[ i ].timestamp, i === lineData.length - 1, padTime ), lineData[ i ].delay * 1000 + i * fudge );
            }

            initializeSimTimer( simDuration );
        }
    } );

    ipcRenderer.on( 'log:parse:raw', function ( event, data ) {
        parseLogEntries( data );
    } );

    ipcRenderer.on( 'log:speak:phrase', function ( event, data ) {
        speakPhrase( data.phrase, data.interruptSpeech, data.speakNext === true, null, false, data.parseResult, data.timerDuration, 0, 100, 1 );
    } );

    ipcRenderer.on( 'tick', function ( event, data ) {
        triggers = data.triggers;
        triggerFolders = data.folders;
        enableFct = data.enableFct;
        damageDealtOverlayId = data.damageDealtOverlayId;
        damageReceivedOverlayId = data.damageReceivedOverlayId;
        voiceIndex = data.voiceIndex;
        masterVolume = data.masterVolume;
        speechVolume = data.speechVolume;
        audioVolume = data.audioVolume;
        baseSpeakingRate = data.baseSpeakingRate;
        isDev = data.isDev;
        phoneticTransforms = data.phoneticTransforms;
        charModel = data.characterModel ? data.characterModel : charModel;
        overlays = data.overlays;
        enableQuickShareImports = data.enableQuickShareImports;
        detrimentalOverlayId = data.detrimentalOverlayId;
        quickShareAuthorsListType = data.quickShareAuthorsListType;
        quickShareAuthorsList = data.quickShareAuthorsList;

        if ( data.characterDisabledTriggers ) {
            const characterDisabledTriggers = data.characterDisabledTriggers.find( f => f.characterId === characterId );

            if ( characterDisabledTriggers ) {
                disabledTriggerIds = characterDisabledTriggers.disabledTriggers;
            }

            if ( disabledTriggerIds?.length > 0 ) {
                triggers.forEach( trigger => {
                    trigger._profileDisabled = disabledTriggerIds.includes( trigger.triggerId );
                } );
            }
        }

        applyFolderConditions( triggerFolders );
        generateTriggerFns();
        initCounters();
    } );

    ipcRenderer.on( 'component:destroy', function ( event, instanceId ) {

        // Let's remove the destroyed instance from any cancellation or secondary action tracking.
        if ( cancellableComponents?.length > 0 ) {
            _.remove( cancellableComponents, token => token.instanceId === instanceId );
        }

        if ( secondaryTriggerActions?.length > 0 ) {
            secondaryTriggerActions = secondaryTriggerActions.filter( t => t.instanceId !== instanceId );
        }

        if ( dotWornOffTracking?.length > 0 ) {
            dotWornOffTracking = dotWornOffTracking.filter( t => t.instanceId !== instanceId );
        }
        
        actionInstances[ instanceId ] = null;

    } );

    ipcRenderer.on( 'log:check:pulse', function ( e ) {
        let activeCounters = false;

        if ( counters ) {
            for ( let key of Object.keys( counters ) ) {
                if ( counters[ key ].value > 0 ) {
                    activeCounters = true;
                    break;
                }
            }
        }

        if ( activeCounters || cancellableComponents?.length > 0 || secondaryTriggerActions?.length > 0 ) {
            // We're still alive, don't kill us!
            e.sender.send( 'log:pulse', true );
        } else {
            // Flatline
            e.sender.send( 'log:pulse', false );
        }

    } );

    ipcRenderer.on( 'settings:get:persistent-storage', ( e, v ) => {
        persistentDictionary = v;
        console.log( 'new dictionary', v );
    } );

    ipcRenderer.on( 'log:action:execute-sub-action',
        /**
         * 
         * @param {any} e Event args.
         * @param {{subAction: TriggerSubAction, instanceId: string}} v The values.
         */
        ( e, v ) => {
            let instanceData = actionInstances[ v.instanceId ];
            if ( instanceData ) {
                let action = instanceData.trigger.actions.find( f => f.actionId === v.subAction.actionId );
                let deltaTime = 0;

                if ( v.subAction ) {
                    
                    instanceData.res.result.groups = instanceData.res.result.groups ? instanceData.res.result.groups : {};
                    let expectedDuration = 0;
            
                    if ( instanceData.res.result?.groups?.timerDuration ) {
                        expectedDuration = StringUtilities.getDurationFromLabel( instanceData.res.result?.groups?.timerDuration );
        
                    } else {
                
                        if ( action.storageDuration && action.storageDuration.indexOf( '[' ) > -1 ) {
                            let dur = +action.duration;
                            dur = +getPersistentDictionaryValue( action.storageDuration, instanceData.res, timestamp, action, deltaTime, trigger );
                            expectedDuration = dur > 0 ? dur / 1000 : +action.duration;

                        } else if ( action.storageDuration ) {
                            let dur = +action.duration;
                            dur = +getScalarValue( action.storageDuration, 0 );
                            expectedDuration = dur > 0 ? dur / 1000 : +action.duration;

                        } else {
                            expectedDuration = +action.duration;

                        }

                    }

                    v.subAction.variableValues?.forEach( f => {
                        
                        let value = f.value;
                        let name = /\{(?<name>.+?)\}/gi.exec( f.name )?.groups?.name;
                        
                        if ( name ) {
                            value = StringUtilities.parseShortCodeValuesToLiteral( value, characterName, expectedDuration, instanceData.res.result?.groups, instanceData.res.result ? instanceData.res.result[ 0 ] : null );
                            value = StringUtilities.parseStoredVariablesToLiteral( value, storedVariables );
                            value = StringUtilities.parseConditionResultsToLiteral( value, instanceData.trigger._conditionResults );
                            value = StringUtilities.parseMatchesToLiteral( value, instanceData.res.result, deltaTime );
                            value = StringUtilities.parseCountersToLiteral( value, counters );

                            instanceData.res.result.groups[ name ] = value;
                        }
            
                    } );

                }

                enableLogging && sendInformationToLog( `Execute trigger sub-action [${v.instanceId}] : ${ActionTypes[ action.actionType ]}`, 24 );

                executeTriggerAction( instanceData.trigger, action, new Date(), instanceData.res, deltaTime, false );
            }
        } );
    
    ipcRenderer.on( 'log:clear-all:done', () => {
        // This used to speak, but it was a bit much.
    } );
    
    ipcRenderer.on( 'log:store:variable',
        /**
         * 
         * @param {any} e Event args.
         * @param {{variableName: string, variableValue: any, instanceId: string}} data The values.
         */
        ( e, data ) => {
            if ( logInstanceIds.includes( data.instanceId ) ) {
                saveVariable( data.variableName, data.variableValue, false );
            }
        } );
    
    ipcRenderer.on( 'log:store:scalar-variable',
        /**
         * 
         * @param {any} e Event args.
         * @param {{variableName: string, variableValue: any, instanceId: string}} data The values.
         */
        ( e, data ) => {
            console.log( 'received store variable', data, logInstanceIds.includes( data.instanceId ) );
            if ( logInstanceIds.includes( data.instanceId ) ) {
                saveScalarVariable( data.variableName, data.variableValue );
            }
        } );

    ipcRenderer.send( 'settings:get:persistent-storage', null );

    speechSynthesis.onvoiceschanged = () => {
        voiceOptions = speechSynthesis.getVoices();
    };
}










/**
 * Initializes all counter trigger actions.
 */
function initCounters() {
    counters = {};
    triggers?.forEach( trigger => {
        if ( ( isDev || !trigger.onlyExecuteInDev ) && trigger.capturePhrases?.length > 0 ) {
            trigger.actions?.forEach( action => {
                if ( action.actionType === ActionTypes.Counter ) {
                    let resetsOnPhrases = action.resetCounterPhrases?.length > 0;
                    let renderedPhrases = resetsOnPhrases ? renderPhrases( action.resetCounterPhrases ) : [];
                    counters[ action.displayText ] = {
                        value: 0,
                        lastUpdate: new Date(),
                        resetDelay: action.duration,
                        _parse: logEntry => {
                            if ( resetsOnPhrases ) {
                                let matched = false;
                                
                                renderedPhrases.forEach( ( phrase, i ) => {
                                    let _res = new RegExp( phrase, 'g' ).exec( logEntry );
                                    if ( _res?.length > 0 ) {
                                        matched = true;
                                        addSuccessfulTriggerParsedEvent(
                                            logEntry,
                                            trigger.triggerId,
                                            action.actionId,
                                            'Reset Counter',
                                            phrase,
                                            action.resetCounterPhrases[ i ],
                                            {
                                                phraseId: action.resetCounterPhrases[ i ].phraseId,
                                                result: _res,
                                            },
                                            trigger._conditionResults,
                                            undefined );
                                    }
                                } );

                                if ( !matched ) {
                                    addFailedTriggerParsedEvent(
                                        logEntry,
                                        trigger.triggerId,
                                        action.actionId,
                                        'Reset Counter',
                                        renderedPhrases,
                                        action.resetCounterPhrases,
                                        null,
                                        trigger._conditionResults,
                                        undefined,
                                    );
                                }
    
                                return matched;
                            } else {
                                return false;
                            }
                        }
                    };
                }
            } );
        }
    } );
}










/**
 * Pre-generate parse functions for each trigger.
 */
function generateTriggerFns() {
    triggers?.forEach( trigger => {

        try {

            if ( ( isDev || !trigger.onlyExecuteInDev ) && trigger.capturePhrases?.length > 0 ) {
    
                // First we generate parse functions for each capture phrase in the trigger.
                /** @type {((value: string, hasGroups: boolean, matchGroups: Record<string, string>) => PhraseParse)[]} */
                let _phraseParsers = [];
    
                /** @type {{groups: Record<string, string>, hasGroups: boolean, captureIndex: number, time: number, logValue: string}[]} */
                let _sequentialMatchs = [];
    
                /** @type {Record<string, string>} */
                let _renderedPhrases = {};
    
                trigger.capturePhrases?.forEach( phrase => {
    
                    // Only create parse functions for phrases that have content.
                    if ( phrase.phrase?.length > 0 ) {
                        if ( phrase.useRegEx ) {
                            // Use different parse functions for regex vs normal.
                            _phraseParsers.push( ( value, hasGroups, matchGroups ) => {
                                let rgxValue = phrase.phrase;
    
                                rgxValue = StringUtilities.parseShortCodesToRegex( rgxValue, characterName );
                                rgxValue = StringUtilities.parseStoredVariablesToRegex( rgxValue, storedVariables );
    
                                if ( trigger.captureMethod === 'Sequential' ) {
                                    rgxValue = StringUtilities.parseMatchesToLiteral( rgxValue, { groups: matchGroups }, trigger._deltaTime );
                                }
    
                                if ( hasGroups === true ) {
                                    rgxValue = StringUtilities.parseSequentialGroups( rgxValue, matchGroups );
                                }
                                
                                _renderedPhrases[ phrase.phraseId ] = rgxValue;
                                let _res = new RegExp( rgxValue, 'gi' ).exec( value );
                                return {
                                    phraseId: phrase.phraseId,
                                    match: _res?.length > 0,
                                    result: _res,
                                    renderedPhrase: rgxValue,
                                };
                            } );
                        } else {
                            _phraseParsers.push( ( value, hasGroups, matchGroups ) => {
                                if ( value?.length > 0 ) {
                                    // We won't care about case sensitivity.
                                    let _phrs = StringUtilities.parseStoredVariablesToLiteralArray( phrase.phrase, storedVariables );
                                    let matched = false;
    
                                    if ( _phrs?.length > 0 ) {
                                        for ( let i = 0; i < _phrs.length; i++ ) {
                                            if ( value.toLowerCase().indexOf( _phrs[ i ].toLowerCase() ) > -1 ) {
                                                matched = true;
                                                break;
                                            }
                                        }
                                    }
    
                                    _renderedPhrases[ phrase.phraseId ] = _phrs;
                                    return {
                                        phraseId: phrase.phraseId,
                                        match: matched,
                                        result: [ value ], 
                                        renderedPhrase: _phrs,
                                    };
                                } else {
                                    _renderedPhrases[ phrase.phraseId ] = "ERROR!! No value to parse";
                                    return {
                                        match: false,
                                        result: [],
                                        renderedPhrase: "ERROR!! No value to parse",
                                    };
                                }
                            } );
                        }
                    }
                } );
    
                /** @type {Record<string, string[]>} This object stores values converted from user input for condition checks.  Ex: Knowledge|Tranquility => ['Knowledge', 'Tranquility'] */
                let _conditionValues = {};
                trigger.conditions?.forEach( condition => {
                    if ( condition.variableValue ) {
                        _conditionValues[ condition.variableName ] = condition.variableValue.split( /\|/gi ) ?? [];
                        _conditionValues[ condition.variableName ].forEach( v => v = v?.trim() );
                    } else {
                        _conditionValues[ condition.variableName ] = null;
                    }
                } );
    
                trigger._folderConditions?.forEach( condition => {
                    if ( condition.variableValue ) {
                        _conditionValues[ condition.variableName ] = condition.variableValue.split( /\|/gi ) ?? [];
                        _conditionValues[ condition.variableName ].forEach( v => v = v?.trim() );
                    } else {
                        _conditionValues[ condition.variableName ] = null;
                    }
                } );
    
                /**
                 * Returns true if all conditions are passed.
                 * @returns {boolean}
                 */
                trigger._checkConditions = function () {
                    let conditionsPassed = true;
    
                    if ( trigger._passesClassCondition === false ) {
                        return false;
    
                    } else if ( StringUtilities.isNullOrWhitespace( charModel.class ) ) {
                        trigger._passesClassCondition = true;
                        
                    } else if ( trigger._passesClassCondition === undefined && trigger.classLevels?.length > 0 ) {
                        let classLevels = trigger.classLevels.filter( f => f.class?.trim().length > 0 ) ?? [];
    
                        trigger._passesClassCondition = classLevels.length === 0;
                        
                        for ( let i = 0; i < classLevels.length; i++ ) {
                            if ( classLevels[ i ].class === charModel.class ) {
                                trigger._passesClassCondition = true;
                                break;
                            }
                        }
    
                        if ( !trigger._passesClassCondition ) {
                            return false;
                        }
                    }
    
                    if ( trigger._onCooldown ) {
                        // If the trigger is on cooldown, determine if the trigger must remain on cooldown.
                        let ellapsedCooldown = DateUtilities.timeSince( trigger._cooldownStart, new Date() );
                        if ( ellapsedCooldown.totalSeconds > trigger.cooldownDuration ) {
                            trigger._onCooldown = false;
                        }
    
                        if ( trigger._onCooldown ) {
                            return false;
                        }
                    }
    
                    trigger._conditionResults = {};
    
                    /**
                     * Executes the given trigger condition checks and evaluations.
                     * 
                     * @param {TriggerCondition} condition The condition to check.
                     */
                    const checkCondition = condition => {
                        if ( condition.conditionType === TriggerConditionTypes.VariableValue ) {
                            if ( condition.operatorType === OperatorTypes.Equals ) {
                                
                                let storedValue = storeHasValue( condition.variableName, _conditionValues[ condition.variableName ] );
    
                                if ( !storedValue.exists ) {
                                    conditionsPassed = false;
                                } else {
                                    // Store what value passed.
                                    trigger._conditionResults[ condition.variableName ] = storedValue.value;
                                }
                                
                            } else if ( condition.operatorType === OperatorTypes.IsNull ) {
    
                                if ( storedVariables[ condition.variableName ]?.length > 0 ) {
                                    conditionsPassed = false;
                                } else {
                                    // Store the condition result for this key as null.
                                    trigger._conditionResults[ condition.variableName ] = null;
                                }
    
                            } else if ( condition.operatorType === OperatorTypes.DoesNotEqual ) {
    
                                let storedValue = storeHasValue( condition.variableName, _conditionValues[ condition.variableName ] );
                                
                                if ( _conditionValues[ condition.variableName ] && storedValue.exists ) {
                                    // If the condition value is not null, then check if the store has that value.
                                    conditionsPassed = false;
                                } else if ( _conditionValues[ condition.variableName ] == null && ( storedVariables[ condition.variableName ] == null || storedVariables[ condition.variableName ]?.length == 0 ) ) {
                                    // If the condition value is null, then check to make sure that the stored value(s) have at least 1 value;
                                    //  ex: If CurrentZone == null and the condition requires that CurrentZone DoesNotEqual Null
                                    conditionsPassed = false;
                                } else {
                                    // Store what value passed.
                                    trigger._conditionResults[ condition.variableName ] = storedValue.value;
                                }
    
                            } else if ( condition.operatorType === OperatorTypes.Contains ) {
                                let storedValue = storeContainsValue( condition.variableName, _conditionValues[ condition.variableName ] );
    
                                if ( !storedValue.exists ) {
                                    conditionsPassed = false;
    
                                } else {
                                    // Store what value passed.
                                    trigger._conditionResults[ condition.variableName ] = storedValue.value;
    
                                }
                                
                            }
                        }
                    }
    
                    // The trigger must pass each condition.
                    trigger.conditions?.forEach( condition => checkCondition( condition ) );
    
                    // Check folder conditions as well.
                    trigger._folderConditions?.forEach( condition => checkCondition( condition ) );
    
                    return conditionsPassed;
                }
    
                // Grab condition values and store them
                trigger.conditions.forEach( condition => {
                    if ( !StringUtilities.isNullOrWhitespace( condition.variableValue ) ) {
                        let values = condition.variableValue.split( /\|/gi ) ?? [];
                        usedConditionValues[ condition.variableName ] = usedConditionValues[ condition.variableName ] ? usedConditionValues[ condition.variableName ] : [];
                        for ( let i = 0; i < values?.length; i++ ) {
                            if ( usedConditionValues[ condition.variableName ].indexOf( values[ i ] ) == -1 ) {
                                usedConditionValues[ condition.variableName ].push( values[ i ] );
                            }
                        }
                    }
                } );
                
                // Store folder condition values as well
                trigger._folderConditions?.forEach( condition => {
                    if ( !StringUtilities.isNullOrWhitespace( condition.variableValue ) ) {
                        let values = condition.variableValue.split( /\|/gi ) ?? [];
                        usedConditionValues[ condition.variableName ] = usedConditionValues[ condition.variableName ] ? usedConditionValues[ condition.variableName ] : [];
                        for ( let i = 0; i < values?.length; i++ ) {
                            if ( usedConditionValues[ condition.variableName ].indexOf( values[ i ] ) == -1 ) {
                                usedConditionValues[ condition.variableName ].push( values[ i ] );
                            }
                        }
                    }
                } );
                
                // Any match.
                if ( trigger.captureMethod === 'Any match' ) {
    
                    trigger._reset = () => { };
                    /**
                     * Parses the given log entry and executes a callback when a match is found.
                     * 
                     * @param {string} value The full log entry sans timestamp.
                     * @param {(match: PhraseParse) => void} onMatch This callback is executed when a match is identified.
                     */
                    trigger._parse = ( value, onMatch ) => {

                        try {

                            let passed = false;
        
                            // If all conditions passed, then parse the phrase.
                            if ( trigger._checkConditions() ) {
                                for ( let i = 0; i < _phraseParsers?.length; i++ ) {
                                    let _res = _phraseParsers[ i ]( value );
                                    if ( _res?.match ) {
                                        onMatch( _res, 0 );
                                        passed = true;
                                    }
                                }
                            }
        
                            if ( !passed ) {
                                addFailedTriggerParsedEvent(
                                    value,
                                    trigger.triggerId,
                                    null,
                                    'Trigger Action',
                                    Object.keys( _renderedPhrases ).map( k => _renderedPhrases[ k ] ),
                                    trigger.capturePhrases.map( p => p.phrase ),
                                    null,
                                    trigger._conditionResults,
                                    undefined,
                                );
                            }
                            
                        } catch ( error ) {
                            logParseError(
                                error, value, null, null,
                                ErrorMessages.triggerParse(),
                                trigger, null,
                                'Trigger Action',
                                Object.keys( _renderedPhrases ).map( k => _renderedPhrases[ k ] ),
                                trigger.capturePhrases.map( p => p.phrase ) );
                        }
                        
                    };
    
                } else if ( trigger.captureMethod === 'Sequential' ) {
                    
                    trigger._reset = forceReset => {
                        forceReset = forceReset === true ? true : false;
                        _.remove( _sequentialMatchs, m => forceReset || m.captureIndex >= _phraseParsers?.length );
                    };
    
                    /**
                     * Parses the given log entry and executes a callback when a match is found.
                     * 
                     * @param {string} value The full log entry sans timestamp.
                     * @param {(match: PhraseParse, deltaTime: number) => void} onMatch This callback is executed when a match is identified.
                     */
                    trigger._parse = ( value, onMatch ) => {

                        try {

                            let passed = false;
        
                            if ( trigger._checkConditions() ) {
        
                                let _res = _phraseParsers[ 0 ]( value );
        
                                // This checks the first phrase, and if no matches are 
                                // found, then any active sequences are checked against 
                                // the log value.
                                if ( _res?.match ) {
                                    let _newSeqMatch = {
                                        sequenceId: nanoid(),
                                        groups: {},
                                        hasGroups: false,
                                        captureIndex: 1,
                                        time: Date.now(),
                                        logValue: _res.result[ 0 ],
                                    };
        
                                    let groupKeys = _res.result?.groups ? Object.keys( _res.result.groups ) : [];
                                    if ( groupKeys.length > 0 ) {
                                        for ( let key of groupKeys ) {
                                            _newSeqMatch.groups[ key ] = _res.result.groups[ key ];
                                        }
                                    }
        
                                    _newSeqMatch.hasGroups = groupKeys?.length > 0;
        
                                    if ( trigger.sequentialRestartBehavior === 'exactFirstMatch' && _sequentialMatchs?.length > 0 ) {
                                        let sequenceIndex = _sequentialMatchs.findIndex( s => s.logValue === _newSeqMatch.logValue );
                                        if ( sequenceIndex > -1 ) {
                                            _sequentialMatchs.splice( sequenceIndex, 1 );
                                        }
                                    }
        
                                    _sequentialMatchs.push( _newSeqMatch );
        
                                    trigger._deltaTime = 0;
        
                                    onMatch( _res, trigger._deltaTime );
                                    passed = true;
        
                                }
                                    
                                if ( _sequentialMatchs?.length > 0 ) {
        
                                    /** @type {number[]} */
                                    let removeSequenceIndices = [];
        
                                    for ( let i = 0; i < _sequentialMatchs.length; i++ ) {
                                        if ( _sequentialMatchs[ i ].captureIndex < _phraseParsers?.length ) {
                                            let _res = _phraseParsers[ _sequentialMatchs[ i ].captureIndex ]( value, _sequentialMatchs[ i ].hasGroups, _sequentialMatchs[ i ].groups );
                                                
                                            if ( _res?.match ) {
                                                _sequentialMatchs[ i ].captureIndex += 1;
        
                                                trigger._deltaTime = Date.now() - _sequentialMatchs[ i ].time;
                                                _sequentialMatchs[ i ].time = Date.now();
                                                    
                                                let groupKeys = _res.result?.groups ? Object.keys( _res.result.groups ) : [];
                                                if ( groupKeys.length > 0 ) {
                                                    for ( let key of groupKeys ) {
                                                        _sequentialMatchs[ i ].groups[ key ] = _res.result.groups[ key ];
                                                    }
                                                }
                        
                                                _sequentialMatchs[ i ].hasGroups = _sequentialMatchs[ i ].hasGroups || groupKeys.length > 0;
                        
                                                onMatch( _res, trigger._deltaTime );
                                                passed = true;
        
                                                // we've already checked the first match condition, if
                                                // the sequence restart behavior is 'afterFirstMatch' 
                                                // then we need to reset the sequence on this trigger.
                                                if ( trigger.sequentialRestartBehavior === 'afterFirstMatch' && _sequentialMatchs?.length > 0 ) {
                                                    removeSequenceIndices.push( i );
                                                }
                                            }
                                        }
                                    }
        
                                    // Remove any sequences.
                                    for ( let i = removeSequenceIndices.length - 1; i >= 0; i-- ) {
                                        _sequentialMatchs.splice( i, 1 );
                                    }
                                    
                                }
                                
                            } else {
                                // If the conditions are no longer met, then forcefully reset all possible match groups.
                                trigger._reset( true );
                                
                            }
        
                            if ( !passed ) {
                                addFailedTriggerParsedEvent(
                                    value,
                                    trigger.triggerId,
                                    null,
                                    'Trigger Sequential Action',
                                    Object.keys( _renderedPhrases ).map( k => _renderedPhrases[ k ] ),
                                    trigger.capturePhrases.map( p => p.phrase ),
                                    null,
                                    trigger._conditionResults,
                                    trigger._deltaTime,
                                );
                            }
                            
                        } catch ( error ) {
                            logParseError(
                                error, value, null, null,
                                ErrorMessages.triggerParse(),
                                trigger, null,
                                'Trigger Sequential Action',
                                Object.keys( _renderedPhrases ).map( k => _renderedPhrases[ k ] ),
                                trigger.capturePhrases.map( p => p.phrase ) );
                        }
    
                    };
    
                } else {
                    // Currently, 'Concurrent' is not supported/implemented.
                    trigger._reset = () => { };
                    trigger._parse = ( value, onMatch ) => { };
                }
    
            } else {
                // if the trigger is missing capture phrases, then do nothing.
                trigger._reset = () => { };
                trigger._parse = ( value, onMatch ) => {
                    
                    addFailedTriggerParsedEvent(
                        value,
                        trigger.triggerId,
                        null,
                        'Trigger Sequential Action',
                        [],
                        [],
                        null,
                        trigger._conditionResults,
                        undefined,
                    );
    
                };
            }

        } catch ( error ) {
            logError( error, raw, simulating, padTime, ErrorMessages.triggerGeneration(), trigger );
        }

    } );
}










/**
 * Parses the given log entry.
 * 
 * @param {string} raw The raw log entry.
 * @param {boolean} simulating If true, only simulates executing triggers via a consol.log call.
 * @param {padTime} padTime The amount of time to add to the timestamps of log entries.
 */
function parseLogEntries( raw, simulating, padTime ) {

    try {
        
        simulating = simulating === true ? true : false;
    
        // let rgxTrigger = /grats;/gi;
        let rgxTimestamp = /^\[(.*?)\]\s*/gi;
        // let rgxGrabText = /\'(.*?)\'$/gi;
        // let rgxDelimiter = /;/gi;
        // let rgxNum = /(\d+)/gi;
        let rgxCombatText = /hit|damage|miss|dodge|riposte|parry|become better|backstab|stun|attack|crush/gi;
        let rgxFctCritical = /\. \(.*(Critical|Crippling Blow|Strikethrough).*\)/gi;
        let rgxCombatModifiers = /\. \((?<combatModifiers>.*)\)$/gi;

        // Someone healed you.
        // https://regex101.com/r/Jdtzsf/3
        // ^(?<healer>.+?) healed you (over time for|for) (?<healAmount>[0-9]*) (\(([0-9]*)\) )?hit points by (?<healType>.+?)\.

        // You healed someone else.
        // https://regex101.com/r/0btqKz/1
        // ^(?<healer>You) healed (?<target>.+?) (over time for|for) (?<healAmount>[0-9]*) (\(([0-9]*)\) )?hit points by (?<healType>.+?)\.
    
        let fctRegExs = [

            // 0: rgxMelee
            /(?<actor>You) (?<action>[a-zA-Z0-9_]*) (?<target>.*) for (?<amount>[0-9]*) points of damage\./gi,

            // 1: rgxMeleeMiss
            /(?<actor>You) try to (?<action>[a-zA-Z0-9_]*) (?<target>.*),/gi,

            // 2: rgxSpellDmg
            /(?<target>.*) has taken (?<amount>[0-9]*) damage from (?<actor>you)r (?<action>.*)\./gi,

            // 3: rgxThorns
            /(?<target>.*) is pierced by (?<actor>YOU)R (?<action>thorns) for (?<amount>[0-9]*) points of non-melee damage\./gi,

            // 4: rgxSkillUp
            /(?<actor>You) have become better at (?<action>[a-zA-Z0-9_\s]*)! \((?<amount>[0-9]*)\)/gi,

            // 5: rgxTakeMeleeDmg
            /(?<actor>.*) (?<action>[a-zA-Z0-9_]*) (?<target>YOU) for (?<amount>[0-9]*) points of damage\./gi,

            // 6: rgxAvoidMeleeDmg
            /(?<actor>.*) tries to (?<action>[a-zA-Z0-9_]*) (?<target>YOU), but (?<avoidType>[a-zA-Z0-9_\s]*)/gi,

            // 7: rgxTakeSpellDmg
            /(?<actor>.*) hit (?<target>you) for (?<amount>[0-9]*) points of (?<damageType>[a-zA-Z0-9_]*) damage by (?<action>.*)\./gi,

            // 8: rgxSpellDmg
            /(?<actor>You) ([a-zA-Z0-9_]*) (?<target>.*) for (?<amount>[0-9]*) points of (?<damageType>.*) damage by (?<action>.*)\./gi,

            // 9: Other heal you
            /^(?<actor>.+?) healed (?<target>you) (over time for|for) (?<amount>[0-9]*) (\((?<overhealing>[0-9]*)\) )?hit points by (?<action>.+?)\./gi,

            // 10: You heal other
            /^(?<actor>You) healed (?<target>.+?) (over time for|for) (?<amount>[0-9]*) (\((?<overhealing>[0-9]*)\) )?hit points by (?<action>.+?)\./gi,

        ];

        let timestamp = new Date( rgxTimestamp.exec( raw )[ 1 ] );

        if ( !timestamp || timestamp.length === 0 || timestamp.length === 1 )
            console.log( 'failed parse', raw );
        else if ( padTime > 0 )
            timestamp = new Date( timestamp.getTime() + ( padTime * 1000 ) );
    
        let log = raw.replace( rgxTimestamp, '' );
        
        // https://regex101.com/r/FvGiGC/2
        // {NAG:(?<quickShareId>.+?)}
        // TODO: Remove the negative lookahead for package after a few versions.
        // let quickShareRegx = /{NAG:(?!package\/)(quick-share\/)?(?<quickShareId>.+?)}/g;
    
        // https://regex101.com/r/ZrNaZM/2
        let quickShareRegx = /^(:?(?<author>\w+) .*)?{NAG:(?!package\/)(quick-share\/)?(?<quickShareId>.+?)}/g;


        // https://regex101.com/r/RwCLkN/1
        let packageShareRegx = /{NAG:package\/(?<packageId>.+?)}/g;
        // {NAG:OVtf9VzRSjykb1xx}
        // {NAG:quick-share/OVtf9VzRSjykb1xx}
        // {NAG:package/X0VJh1fjkddZCl9r}

        // https://regex101.com/r/n9aOlR/1
        // ^(?<author>Name|Name2) .*{NAG:(?<quickShareId>.+?)}

        // Capture quickshares, when enabled.
        let quickShare = !enableQuickShareImports ? null : quickShareRegx.exec( log );
        if ( quickShare && quickShare.groups?.quickShareId ) {
            if ( quickShareAuthorsListType === QuickShareAuthorListTypes.Whitelist && quickShare.groups?.author ) {
                // Whitelist will only share if the author is known and in the
                // authors list.  Unknown is in terms of captured by the regular 
                // expression.
                if ( quickShareAuthorsList.findIndex( f => f.toLowerCase() === quickShare.groups.author.toLowerCase() ) > -1 ) {
                    ipcRenderer.send( 'quickshare_captured', quickShare.groups.quickShareId );
                }

            } else if ( quickShareAuthorsListType === QuickShareAuthorListTypes.Blacklist ) {
                // Blacklist will only share if the author is either unknown or the
                // author is known and not in the list.  Unknown is in terms of 
                // captured by the regular expression.
                if ( !quickShare.groups?.author || quickShareAuthorsList.findIndex( f => f.toLowerCase() === quickShare.groups.author.toLowerCase() ) === -1 ) {
                    ipcRenderer.send( 'quickshare_captured', quickShare.groups.quickShareId );
                }

            } else {
                ipcRenderer.send( 'quickshare_captured', quickShare.groups.quickShareId );

            }

        }
    
        let quickSharePackage = packageShareRegx.exec( log );
        if ( quickSharePackage && quickSharePackage.groups?.packageId ) {
            ipcRenderer.send( 'quicksharePackage_captured', quickSharePackage.groups.packageId );
        }
    
        if ( enableFct && raw.match( rgxCombatText )?.length > 0 ) {

            try {

                for ( let i = 0; i < fctRegExs.length; i++ ) {
                    let results = fctRegExs[ i ].exec( log );
                
                    if ( results && results.length > 1 ) {
                        let model = new FctModel();

                        // Misses: 1 - My melee misses, 6 - Other melee misses
                        let misses = [ 1, 6 ];
    
                        model.combatTypes.myHits = [ 0 ].indexOf( i ) > -1;
                        model.combatTypes.otherHitsOnMe = [ 5 ].indexOf( i ) > -1;
                        model.combatTypes.mySpellHits = [ 2, 3, 8 ].indexOf( i ) > -1;
                        model.combatTypes.otherSpellHitsOnMe = [ 7 ].indexOf( i ) > -1;
                        model.combatTypes.otherHealingOnMe = [ 9 ].indexOf( i ) > -1;
                        model.combatTypes.myHealing = [ 10 ].indexOf( i ) > -1;
                        model.combatTypes.skillUp = [ 4 ].indexOf( i ) > -1;

                        model.actor = results.groups?.actor;
                        model.action = results.groups?.action;
                        model.target = results.groups?.target;
                        model.amount = misses.includes( i ) ? undefined : +results.groups?.amount;
                        model.avoidType = results.groups?.avoidType;
                        model.damageType = results.groups?.damageType;
                        model.overHealing = +results.groups?.overhealing;

                        // We may use this if performance requires it.  However, most thing late game with have some modifier on it.
                        // if ( raw.match( /\)$/gi ) ) {
                            
                        // }

                        let combatModifiers = /\. \((?<combatModifiers>.*)\)$/gi.exec( raw )?.groups?.combatModifiers;
                        if ( combatModifiers ) {

                            let checkModifiers = ( modifierName ) => {
                                
                                if ( combatModifiers.length === 0 ) {
                                    return false;
                                }
    
                                let i = combatModifiers.indexOf( modifierName );
                                
                                if ( i > -1 ) {
                                    combatModifiers = combatModifiers.substring( 0, i ) + combatModifiers.substring( i + modifierName.length );
                                    return true;
                                }
    
                                return false;
                            }

                            checkModifiers( 'Critical' ) && model.combatModifiers.push( 'critical' );
                            checkModifiers( 'Crippling Blow' ) && model.combatModifiers.push( 'crippling_blow' );
                            checkModifiers( 'Flurry' ) && model.combatModifiers.push( 'flurry' );
                            checkModifiers( 'Lucky' ) && model.combatModifiers.push( 'lucky' );
                            checkModifiers( 'Twincast' ) && model.combatModifiers.push( 'twincast' );
                            checkModifiers( 'Riposte' ) && model.combatModifiers.push( 'riposte' );
                            checkModifiers( 'Strikethrough' ) && model.combatModifiers.push( 'strikethrough' );
                            checkModifiers( 'Wild Rampage' ) && model.combatModifiers.push( 'wild_rampage' );
                            checkModifiers( 'Rampage' ) && model.combatModifiers.push( 'rampage' );
                            checkModifiers( 'Assassinate' ) && model.combatModifiers.push( 'assassinate' );
                            checkModifiers( 'Headshot' ) && model.combatModifiers.push( 'headshot' );
                            checkModifiers( 'Double Bow Shot' ) && model.combatModifiers.push( 'double_bow_shot' );
                            checkModifiers( 'Deadly Strike' ) && model.combatModifiers.push( 'deadly_strike' );
                            checkModifiers( 'Finishing Blow' ) && model.combatModifiers.push( 'finishing_blow' );

                        } else {
                            model.combatModifiers.push( 'normal' );
                        }
                        
                        model.timestamp = timestamp;
                        model.characterId = characterId;
    
                        ipcRenderer.send( 'overlay:send:fct-component', model );
    
                        // leave the loop, we found the correct FCT type.
                        break;
    
                    } // if ( results && results.length > 1 )
    
                } // for ( let i = 0; i < fctRegExs.length; i++ )

            } catch ( error ) {
                logError( error, raw, simulating, padTime, ErrorMessages.fctException(), null );

            }
        
        }

        // If there are any cancellable actions, evaluate them here.
        if ( cancellableComponents?.length > 0 ) {
            let tokenIds = [];
            cancellableComponents.forEach( token => {

                try {
                    if ( token._parse( log ) ) {
                        // Broadcast the remove action.
                        ipcRenderer.send( 'overlay:destroy:component', token.instanceId );
    
                        // Mark the item for removal.
                        tokenIds.push( token.instanceId );
                    }
                } catch ( error ) {
                    logError( error, raw, simulating, padTime, ErrorMessages.cancellableParse(), actionInstances[ token.instanceId ]?.trigger );
                }

            } );

            // Remove the cancelled items.
            _.remove( cancellableComponents, token => tokenIds.indexOf( token.instanceId ) > -1 );
        }

        if ( secondaryTriggerActions?.length > 0 ) {

            // Iterate backwards so we can safely remove triggered actions as we go.
            for ( let i = secondaryTriggerActions.length - 1; i >= 0; i-- ) {
                const token = secondaryTriggerActions[ i ];
                try {

                    if ( token._parse( log ) ) {

                        try {
                            token._trigger( token.instanceId, timestamp );
                            secondaryTriggerActions.splice( i, 1 );
                        } catch (error) {
                            logError( error, raw, simulating, padTime, ErrorMessages.secondaryTriggerExecution(), actionInstances[ token.instanceId ]?.trigger );
                        }

                    }

                } catch ( error ) {
                    logError( error, raw, simulating, padTime, ErrorMessages.secondaryTriggerParse(), actionInstances[ token.instanceId ]?.trigger );
                }
            }
            
        }

        if ( dotWornOffTracking?.length > 0 ) {
            
            // Iterate backwards so we can safely remove expired actions as we go.
            for ( let i = dotWornOffTracking.length - 1; i >= 0; i-- ){
                const token = dotWornOffTracking[ i ];
                try {

                    if ( token._parse( log ) ) {

                        try {
                            token._trigger( token.instanceId, timestamp );
                            dotWornOffTracking.splice( i, 1 );
                        } catch (error) {
                            logError( error, raw, simulating, padTime, ErrorMessages.secondaryTriggerExecution(), actionInstances[ token.instanceId ]?.trigger );
                        }

                    }

                } catch ( error ) {
                    logError( error, raw, simulating, padTime, ErrorMessages.secondaryTriggerParse(), actionInstances[ token.instanceId ]?.trigger );
                }
            }
            
        }

        if ( counters ) {
            for ( let key of Object.keys( counters ) ) {

                try {

                    // Skip counter reset conditions if the counter is at 0.
                    if ( counters[ key ].value > 0 ) {
    
                        // check how long the value has existed and reset it if that 
                        // duration is greater than the reset delay specified by the 
                        // user.
                        let timeSinceLastUpdate = Math.abs( ( new Date() ) - counters[ key ].lastUpdate ) / 1000;
                        if ( timeSinceLastUpdate >= counters[ key ].resetDelay ) {
                            counters[ key ].value = 0;
                            // If the timer is reset, no need to check the reset 
                            // phrases.
                            continue;
                        }
    
                        // Parse the current log entry for any reset phrase matches.
                        if ( counters[ key ]._parse( log ) ) {
                            counters[ key ].value = 0;
                        }
                    }

                } catch (error) {
                    logError( error, raw, simulating, padTime, ErrorMessages.counterExecution( key ), null );
                }

            }
        }

        let entryMatched = false;
        triggers.forEach( trigger => {

            // try {
                
            if ( !!trigger.enabled && !trigger._profileDisabled ) {
                trigger._parse( log, ( res, deltaTime ) => {

                    try {
                            
                        trigger.actions.forEach( action => {
                            // This used to execute actions if there are no phrases on the action, but now it doesn't because the action may exist only as a subaction
                            // ( action.phrases == null || action.phrases?.length === 0 || action.phrases?.indexOf( res.phraseId ) > -1 )
                            if ( ( isDev || !action.onlyExecuteInDev ) && action.phrases?.indexOf( res.phraseId ) > -1 ) {

                                enableLogging && sendInformationToLog( `Execute trigger action [${trigger.name}] : ${ActionTypes[ action.actionType ]}`, 24 );
                                enableLogging && sendInformationToLog( `    ||${raw}||`, 24 );

                                executeTriggerAction( trigger, action, timestamp, res, deltaTime, simulating );
                                
                                addSuccessfulTriggerParsedEvent(
                                    log,
                                    trigger.triggerId,
                                    action.actionId,
                                    trigger.captureMethod === 'Sequential' ? 'Trigger Sequential Action' : 'Trigger Action',
                                    res.renderedPhrase,
                                    trigger.capturePhrases.find( p => p.phraseId === res.phraseId )?.phrase,
                                    res,
                                    trigger._conditionResults,
                                    undefined );
                            }
                        } );
                        entryMatched = true;

                        // If the trigger has a cooldown, start the cooldown now.
                        if ( trigger.useCooldown ) {
                            trigger._onCooldown = true;
                            trigger._cooldownStart = new Date();
                        }
                            
                    } catch ( error ) {
                        logError( error, raw, simulating, padTime, ErrorMessages.triggerExecution(), trigger );
                    }
                            

                } );
            }

            // } catch ( error ) {
            //     logError( error, raw, simulating, padTime, ErrorMessages.triggerParse(), trigger );
            // }
            
        } );

        if ( entryMatched ) {
            let t = timestamp.getTime();
            parsedLogEntries[ t ] = parsedLogEntries[ t ]?.length > 0 ? parsedLogEntries[ t ] : [];
            parsedLogEntries[ t ].push( log );
        }

    } catch ( error ) {
        logError( error, raw, simulating, padTime, ErrorMessages.generalParsingError(), null );
    }

}










/**
 * 
 * @param {LogTrigger} trigger 
 * @param {TriggerAction} action 
 * @param {Date} timestamp 
 * @param {PhraseParse} res 
 * @param {number} deltaTime 
 * @param {boolean} simulating
 */
function executeTriggerAction( trigger, action, timestamp, res, deltaTime, simulating ) {

    if ( action.actionType === ActionTypes.DisplayText ) {
        /* --== Display Text ==-- */
    
        displayTextComponent( res, timestamp, action, deltaTime, simulating, trigger.triggerId );
    
    } else if ( action.actionType === ActionTypes.PlayAudio ) {
        /* --== Play Audio ==-- */
    
        playAudioFile( action.audioFileId, action.audioVolume );

    } else if ( action.actionType === ActionTypes.Clipboard ) {
        /* --== Copy text to clipboard ==-- */
        
        sendToClipboard( res, action, trigger._conditionResults, deltaTime );
    
    } else if ( action.actionType === ActionTypes.StoreVariable ) {
        /* --== Store Variable ==-- */
    
        if ( action.variableStorageType === 'persistentDictionary' ) {
            savePersistentDictionary( action.variableName, res, timestamp, action, deltaTime, trigger );
        } else {
            if ( res.result.length === 1 ) {
                saveVariable( action.variableName, res.result[ 0 ], action.onlyStoreUsedValues );
            } else {
                saveVariable( action.variableName, res.result[ 1 ], action.onlyStoreUsedValues );
            }
        }

    } else if ( action.actionType === ActionTypes.ClearVariable ) {
        /* --== Clear Variable ==-- */

        if ( res.result.groups && res.result.groups[ action.variableName ] ) {
            clearStoredVariable( action.variableName, res.result.groups[ action.variableName ] );
        } else if ( trigger._conditionResults && trigger._conditionResults[ action.variableName ] ) {
            clearStoredVariable( action.variableName, trigger._conditionResults[ action.variableName ] );
        } else {
            clearAllStoredValuesInVariable( action.variableName );
        }

    } else if ( action.actionType === ActionTypes.Counter ) {
        /* --== Clear Variable ==-- */

        incrementCounter( action.displayText );

    } else if ( action.actionType === ActionTypes.Timer || action.actionType === ActionTypes.Countdown || action.actionType === ActionTypes.Stopwatch ) {
        /* --== Start a Timer/Countdown ==-- */
    
        let instanceId = displayTimerCountdownComponent( res, timestamp, action, deltaTime, trigger );

        let subRes = _.cloneDeep( res );
        subRes.result.groups = _.cloneDeep( res.result.groups );

        actionInstances[ instanceId ] = {
            trigger: trigger,
            res: subRes,
        };

    } else if ( action.actionType === ActionTypes.DotTimer ) {
        /* --== DOT Timers ==-- */
    
        let instanceId = displayDotTimerComponent( res, timestamp, action, deltaTime, trigger );

        let subRes = _.cloneDeep( res );
        subRes.result.groups = _.cloneDeep( res.result.groups );

        actionInstances[ instanceId ] = {
            trigger: trigger,
            res: subRes,
        };

    } else if ( action.actionType === ActionTypes.BeneficialTimer ) {
        /* --== Buff Timers ==-- */
    
        let spellName = trigger?._conditionResults?.SpellBeingCast ?? action.displayText;
        let rgx = new RegExp( `^You begin casting ${spellName}\\.$`, 'gmi' );
        let time = timestamp.getTime();
        let _t = timestamp.getTime();
        if ( action.castTime >= 3000 && charModel.hasBeneficialCastingSpeedFocus && !action.skipBenCastingTimeFocus ) {
            let tMod = calculateBeneficialCastingMilliseconds( action.castTime, action.duration, trigger.classLevels, charModel, 50 );
            time -= tMod;
        } else {
            time -= action.castTime;
        }

        // This checks the cast time to limit the chances that we're not capturing another player's buff.
        let m = checkParseHistory( rgx, { time: [ time, time + 1000 ] } );
        // If the cast time is zero, there's no need for this check.
        if ( m?.length > 0 || action.castTime === 0 ) {
            action.displayText = spellName;
            let instanceId = displayBeneficialTimerComponent( res, timestamp, action, trigger, spellName );

            let subRes = _.cloneDeep( res );
            subRes.result.groups = _.cloneDeep( res.result.groups );
    
            actionInstances[ instanceId ] = {
                trigger: trigger,
                res: subRes,
            };
        }

    } else if ( action.actionType === ActionTypes.Speak ) {
        /* --== TTS Speak ==-- */
        let duration = null;

        if ( res.result?.groups?.timerDuration ) {
            duration = StringUtilities.getDurationFromLabel( res.result?.groups?.timerDuration );
        } else if ( action.duration ) {
            duration = +action.duration;
        }

        speakPhrase( action.displayText, action.interruptSpeech, action.speakNext, trigger._conditionResults, simulating, res.result, duration, deltaTime, action.speechVolume, action.speechRate );
    
    } else if ( action.actionType === ActionTypes.DisplayDeathRecap ) {
        /* --== Death Recap ==-- */
        
        loadLastDeathRecap();
        
    } else if ( action.actionType === ActionTypes.ScreenGlow ) {
        /* --== Death Recap ==-- */
        
        displayScreenGlow( action, trigger.triggerId );
        
    } else if ( action.actionType === ActionTypes.ClearAll ) {
        /* --== Clear All ==-- */

        clearAll();
    }
}










/**
 * Sends the command to the render to clear all overlay components.  Restarts all counters.
 */
function clearAll() {

    for ( const key of Object.keys( counters ) ) {
        counters[ key ].value = 0;
    }

    for ( const key of Object.keys( storedVariables ) ) {
        storedVariables[ key ] = [];
    }

    let len = audioPlayers?.length ?? 0;
    for ( let i = len - 1; i >= 0; i-- ) {
        let player = audioPlayers.splice( i, 1 )[ 0 ];
        player.pause();
        player = null;
    }

    utterances = [];
    speechSynthesis.cancel();

    changingLogFile = true;
    window.setTimeout( () => {
        changingLogFile = false;
        // currentPosition = null;
        backfind( logFilePath, () => startParsingLogFile( logFilePath, currentPosition >= 0 ? currentPosition : null ) );
    }, logParseTimer );

    ipcRenderer.send( 'renderer:clear-all', null );

}










/**
 * Sends teh given screen glow action to the renderer.
 * 
 * @param {TriggerAction} action The screen glow action to render.
 * @param {string} triggerId The id of the trigger that caused this action to be rendered.
 */
function displayScreenGlow( action, triggerId ) {
    let comp = new OverlayComponent();

    comp.instanceId = nanoid();
    comp.triggerId = triggerId;
    comp.action = action;
    
    logInstanceIds.push( comp.instanceId );
    
    ipcRenderer.send( 'overlay:send:component', comp );
}










/**
 * Builds and sends a dot timer overlay component.
 * 
 * @param {PhraseParse} res The information from the parsed phrase.
 * @param {Date} timestamp The timestamp of the log entry.
 * @param {TriggerAction} action The trigger's display text action.
 * @param {LogTrigger} trigger If true the component is written to the console instead of sent to the overlay window.
 * @param {string} spellName The literal name of the spell that was cast.  This will usually include what rank the spell was.
 * 
 * @return {string} Returns the instance id of the renderer component
 */
function displayBeneficialTimerComponent( res, timestamp, action, trigger, spellName ) {
    
    let comp = new OverlayComponent();

    comp.instanceId = nanoid();
    comp.triggerId = trigger.triggerId;
    comp.triggerName = spellName;
    comp.action = Object.assign( new TriggerAction(), action );
    comp.action.displayText = `${spellName} --== ${res.result.groups.target} ==--`;
    comp.overlayId = action.overlayId;
    comp.matches = res.result;
    comp.timestamp = timestamp;
    comp.voiceIndex = voiceIndex;
    
    logInstanceIds.push( comp.instanceId );
    
    if ( comp.action.endingSoonDisplayText ) {
        comp.action.endingSoonText = StringUtilities.parseShortCodeValuesToLiteral( action.endingSoonText, characterName, comp.action.duration, res.result?.groups, res.result ? res.result[ 0 ] : null );
        comp.action.endingSoonText = StringUtilities.parseStoredVariablesToLiteral( comp.action.endingSoonText, storedVariables );
        comp.action.endingSoonText = StringUtilities.parseConditionResultsToLiteral( comp.action.endingSoonText, trigger._conditionResults );
        comp.action.endingSoonText = StringUtilities.parseCountersToLiteral( comp.action.endingSoonText, counters );
    }

    if ( comp.action.endingSoonSpeak ) {
        comp.action.endingSoonSpeakPhrase = StringUtilities.parseShortCodeValuesToLiteral( action.endingSoonSpeakPhrase, characterName, comp.action.duration, res.result?.groups, res.result ? res.result[ 0 ] : null );
        comp.action.endingSoonSpeakPhrase = StringUtilities.parseStoredVariablesToLiteral( comp.action.endingSoonSpeakPhrase, storedVariables );
        comp.action.endingSoonSpeakPhrase = StringUtilities.parseConditionResultsToLiteral( comp.action.endingSoonSpeakPhrase, trigger._conditionResults );
        comp.action.endingSoonSpeakPhrase = StringUtilities.parseCountersToLiteral( comp.action.endingSoonSpeakPhrase, counters );
    }

    if ( comp.action.endedDisplayText ) {
        comp.action.endedText = StringUtilities.parseShortCodeValuesToLiteral( action.endedText, characterName, comp.action.duration, res.result?.groups, res.result ? res.result[ 0 ] : null );
        comp.action.endedText = StringUtilities.parseStoredVariablesToLiteral( comp.action.endedText, storedVariables );
        comp.action.endedText = StringUtilities.parseConditionResultsToLiteral( comp.action.endedText, trigger._conditionResults );
        comp.action.endedText = StringUtilities.parseCountersToLiteral( comp.action.endedText, counters );
    }

    if ( comp.action.endedSpeak ) {
        comp.action.endedSpeakPhrase = StringUtilities.parseShortCodeValuesToLiteral( action.endedSpeakPhrase, characterName, comp.action.duration, res.result?.groups, res.result ? res.result[ 0 ] : null );
        comp.action.endedSpeakPhrase = StringUtilities.parseStoredVariablesToLiteral( comp.action.endedSpeakPhrase, storedVariables );
        comp.action.endedSpeakPhrase = StringUtilities.parseConditionResultsToLiteral( comp.action.endedSpeakPhrase, trigger._conditionResults );
        comp.action.endedSpeakPhrase = StringUtilities.parseCountersToLiteral( comp.action.endedSpeakPhrase, counters );
    }

    if ( charModel.hasExtendedBeneficialFocus ) {
        comp.action.duration += calculateAdditionalTicks( comp.action.duration, trigger.classLevels, charModel.extendedBeneficialFocusPercent, charModel.extendedBeneficialFocusDecayLevel, charModel.extendedBeneficialFocusAaPercent, comp.action.onlyUseAaBeneficialFocus ) * 6;
    }

    // reset the trigger.
    trigger._reset();

    ipcRenderer.send( 'overlay:send:component', comp );

    if ( comp.action.endEarlyPhrases?.length > 0 ) {
        let renderedPhrases = renderPhrases( comp.action.endEarlyPhrases, trigger._conditionResults, res.result );

        cancellableComponents.push( {
            _parse: ( logEntry ) => {
                let matched = false;
                
                renderedPhrases.forEach( (phrase, i) => {
                    let _res = new RegExp( phrase, 'gi' ).exec( logEntry );
                    if ( _res?.length > 0 ) {
                        enableLogging && sendInformationToLog( `DoT Timer ended early: [${logEntry}]` );
                        matched = true;
                        
                        addSuccessfulTriggerParsedEvent(
                            logEntry,
                            trigger.triggerId,
                            action.actionId,
                            'Trigger Cancel Action',
                            phrase,
                            comp.action.endEarlyPhrases[ i ].phrase,
                            {
                                phraseId: comp.action.endEarlyPhrases[ i ].phraseId,
                                result: _res,
                                renderedPhrase: phrase,
                                dependencyResult: res.result,
                            },
                            trigger._conditionResults,
                            undefined );
                        
                    }
                } );

                if ( !matched ) {
                    addFailedTriggerParsedEvent(
                        logEntry,
                        trigger.triggerId,
                        action.actionId,
                        'Trigger Cancel Action',
                        renderedPhrases,
                        comp.action.endEarlyPhrases.map( p => p.phrase ),
                        {
                            phraseId: null,
                            result: null,
                            renderedPhrase: null,
                            dependencyResult: res.result,
                        },
                        trigger._conditionResults,
                        undefined,
                    );
                }

                return matched;
            },
            instanceId: comp.instanceId
        } );
    }

    return comp.instanceId;

}










/**
 * Builds and sends a dot timer overlay component.
 * 
 * @param {PhraseParse} res The information from the parsed phrase.
 * @param {Date} timestamp The timestamp of the log entry.
 * @param {TriggerAction} action The trigger's display text action.
 * @param {number} deltaTime The change in time, in milliseconds, since the previous sequential capture.
 * @param {LogTrigger} trigger If true the component is written to the console instead of sent to the overlay window.
 * 
 * @return {string} Returns the instance id of the renderer component
 */
function displayDotTimerComponent( res, timestamp, action, deltaTime, trigger ) {
                        
    if ( action.excludeTargets?.length > 0 ) {
        for ( let i = 0; i < action.excludeTargets.length; i++ ) {
            let exclude = false;

            if ( action.excludeTargets[ i ].useRegEx ) {
                exclude = res.result[ 1 ].match( new RegExp( action.excludeTargets[ i ].phrase, 'g' ) )?.length > 0;
            } else {
                let _rgx = new RegExp( '^' + action.excludeTargets[ i ].phrase.replace( /[.*+?^${}()|[\]\\]/g, '\\$&' ) + '$', 'gi' );
                exclude = res.result[ 1 ].match( _rgx )?.length > 0;
            }

            if ( exclude ) {
                return;
            }
        }
    }
    
    // ${target} has been slain by (.+?)!
    let comp = new OverlayComponent();

    comp.instanceId = nanoid();
    comp.triggerId = trigger.triggerId;
    comp.triggerName = trigger.name;
    comp.action = Object.assign( new TriggerAction(), action );
    comp.action.displayText = `${trigger.name} --== ${res.result.groups.target} ==--`;
    comp.overlayId = action.overlayId;
    comp.matches = res.result;
    comp.timestamp = comp.action.secondaryPhrases?.length > 0 ? null : timestamp;
    comp.voiceIndex = voiceIndex;
    
    logInstanceIds.push( comp.instanceId );
    
    if ( comp.action.endingSoonDisplayText ) {
        comp.action.endingSoonText = StringUtilities.parseShortCodeValuesToLiteral( action.endingSoonText, characterName, comp.action.duration, res.result?.groups, res.result ? res.result[ 0 ] : null );
        comp.action.endingSoonText = StringUtilities.parseStoredVariablesToLiteral( comp.action.endingSoonText, storedVariables );
        comp.action.endingSoonText = StringUtilities.parseConditionResultsToLiteral( comp.action.endingSoonText, trigger._conditionResults );
        comp.action.endingSoonText = StringUtilities.parseMatchesToLiteral( comp.action.endingSoonText, res.result, deltaTime );
        comp.action.endingSoonText = StringUtilities.parseCountersToLiteral( comp.action.endingSoonText, counters );
    }

    if ( comp.action.endingSoonSpeak ) {
        comp.action.endingSoonSpeakPhrase = StringUtilities.parseShortCodeValuesToLiteral( action.endingSoonSpeakPhrase, characterName, comp.action.duration, res.result?.groups, res.result ? res.result[ 0 ] : null );
        comp.action.endingSoonSpeakPhrase = StringUtilities.parseStoredVariablesToLiteral( comp.action.endingSoonSpeakPhrase, storedVariables );
        comp.action.endingSoonSpeakPhrase = StringUtilities.parseConditionResultsToLiteral( comp.action.endingSoonSpeakPhrase, trigger._conditionResults );
        comp.action.endingSoonSpeakPhrase = StringUtilities.parseMatchesToLiteral( comp.action.endingSoonSpeakPhrase, res.result, deltaTime );
        comp.action.endingSoonSpeakPhrase = StringUtilities.parseCountersToLiteral( comp.action.endingSoonSpeakPhrase, counters );
    }

    if ( comp.action.endingClipboard ) {
        comp.action.endingClipboardText = StringUtilities.parseShortCodeValuesToLiteral( action.endingClipboardText, characterName, comp.action.duration, res.result?.groups, res.result ? res.result[ 0 ] : null );
        comp.action.endingClipboardText = StringUtilities.parseStoredVariablesToLiteral( comp.action.endingClipboardText, storedVariables );
        comp.action.endingClipboardText = StringUtilities.parseConditionResultsToLiteral( comp.action.endingClipboardText, trigger._conditionResults );
        comp.action.endingClipboardText = StringUtilities.parseMatchesToLiteral( comp.action.endingClipboardText, res.result, deltaTime );
        comp.action.endingClipboardText = StringUtilities.parseCountersToLiteral( comp.action.endingClipboardText, counters );
    }

    if ( comp.action.endedDisplayText ) {
        comp.action.endedText = StringUtilities.parseShortCodeValuesToLiteral( action.endedText, characterName, comp.action.duration, res.result?.groups, res.result ? res.result[ 0 ] : null );
        comp.action.endedText = StringUtilities.parseStoredVariablesToLiteral( comp.action.endedText, storedVariables );
        comp.action.endedText = StringUtilities.parseConditionResultsToLiteral( comp.action.endedText, trigger._conditionResults );
        comp.action.endedText = StringUtilities.parseMatchesToLiteral( comp.action.endedText, res.result, deltaTime );
        comp.action.endedText = StringUtilities.parseCountersToLiteral( comp.action.endedText, counters );
    }

    if ( comp.action.endedSpeak ) {
        comp.action.endedSpeakPhrase = StringUtilities.parseShortCodeValuesToLiteral( action.endedSpeakPhrase, characterName, comp.action.duration, res.result?.groups, res.result ? res.result[ 0 ] : null );
        comp.action.endedSpeakPhrase = StringUtilities.parseStoredVariablesToLiteral( comp.action.endedSpeakPhrase, storedVariables );
        comp.action.endedSpeakPhrase = StringUtilities.parseConditionResultsToLiteral( comp.action.endedSpeakPhrase, trigger._conditionResults );
        comp.action.endedSpeakPhrase = StringUtilities.parseMatchesToLiteral( comp.action.endedSpeakPhrase, res.result, deltaTime );
        comp.action.endedSpeakPhrase = StringUtilities.parseCountersToLiteral( comp.action.endedSpeakPhrase, counters );
    }

    if ( comp.action.endedClipboard ) {
        comp.action.endedClipboardText = StringUtilities.parseShortCodeValuesToLiteral( action.endedClipboardText, characterName, comp.action.duration, res.result?.groups, res.result ? res.result[ 0 ] : null );
        comp.action.endedClipboardText = StringUtilities.parseStoredVariablesToLiteral( comp.action.endedClipboardText, storedVariables );
        comp.action.endedClipboardText = StringUtilities.parseConditionResultsToLiteral( comp.action.endedClipboardText, trigger._conditionResults );
        comp.action.endedClipboardText = StringUtilities.parseMatchesToLiteral( comp.action.endedClipboardText, res.result, deltaTime );
        comp.action.endedClipboardText = StringUtilities.parseCountersToLiteral( comp.action.endedClipboardText, counters );
    }

    if ( charModel.hasExtendedDotFocus ) {
        let percent = charModel.extendedDotFocusPercent;
        let charClassData = _.find( trigger.classLevels, ccl => ccl.class === charModel.class );

        if ( charClassData != null && charClassData.level > charModel.extendedDotFocusDecayLevel ) {
            let decayPercent = ( charClassData.level - charModel.extendedDotFocusDecayLevel ) * 5;
            percent = percent * ( 1 - decayPercent / 100 );
        }

        let baseTicks = comp.action.duration / 6;
        let addTicks = baseTicks * percent / 100;
        if ( addTicks < 1 )
            addTicks = Math.round( addTicks );
        else
            addTicks = Math.floor( addTicks );
        comp.action.duration += addTicks * 6;
        
    }

    // reset the trigger.
    trigger._reset();

    ipcRenderer.send( 'overlay:send:component', comp );

    if ( comp.action.endEarlyPhrases?.length > 0 ) {
        let renderedPhrases = renderPhrases( comp.action.endEarlyPhrases, trigger._conditionResults, res.result, deltaTime );

        cancellableComponents.push( {
            _parse: ( logEntry ) => {
                let matched = false;
                
                renderedPhrases.forEach( (phrase, i) => {
                    let _res = new RegExp( phrase, 'gi' ).exec( logEntry );
                    if ( _res?.length > 0 ) {
                        enableLogging && sendInformationToLog( `DoT Timer ended early: [${logEntry}]` );
                        matched = true;
                        
                        addSuccessfulTriggerParsedEvent(
                            logEntry,
                            trigger.triggerId,
                            action.actionId,
                            'Trigger Cancel Action',
                            phrase,
                            comp.action.endEarlyPhrases[ i ].phrase,
                            {
                                phraseId: comp.action.endEarlyPhrases[ i ].phraseId,
                                result: _res,
                                renderedPhrase: phrase,
                                dependencyResult: res.result,
                            },
                            trigger._conditionResults,
                            deltaTime );
                        
                    }
                } );

                if ( !matched ) {
                    addFailedTriggerParsedEvent(
                        logEntry,
                        trigger.triggerId,
                        action.actionId,
                        'Trigger Cancel Action',
                        renderedPhrases,
                        comp.action.endEarlyPhrases.map( p => p.phrase ),
                        {
                            phraseId: null,
                            result: null,
                            renderedPhrase: null,
                            dependencyResult: res.result,
                        },
                        trigger._conditionResults,
                        deltaTime,
                    );
                }

                return matched;
            },
            instanceId: comp.instanceId
        } );
    }

    if ( comp.action.secondaryPhrases?.length > 0 ) {
        let phrases = trigger.capturePhrases.filter( f => comp.action.secondaryPhrases.indexOf( f.phraseId ) > -1 );
        let renderedPhrases = renderPhrases( phrases, trigger._conditionResults, res.result, deltaTime, true );

        secondaryTriggerActions.push( {
            /**
             * Returns true if the given log entry matches the phrases.
             * 
             * @param {string} logEntry The log entry to parse.
             * @returns {boolean}
             */
            _parse: ( logEntry ) => {
                let matched = false;
                
                renderedPhrases.forEach( ( phrase, i ) => {
                    let _res = new RegExp( phrase, 'gi' ).exec( logEntry );
                    if ( _res?.length > 0 ) {
                        enableLogging && sendInformationToLog( `DoT Timer secondary action: [${logEntry}]` );
                        matched = true;
                        
                        addSuccessfulTriggerParsedEvent(
                            logEntry,
                            trigger.triggerId,
                            action.actionId,
                            'Trigger Secondary Action',
                            phrase,
                            phrases[ i ].phrase,
                            {
                                phraseId: phrases[ i ].phraseId,
                                result: _res,
                                renderedPhrase: phrase,
                                dependencyResult: res.result,
                            },
                            trigger._conditionResults,
                            deltaTime );
                    }
                } );

                if ( !matched ) {
                    addFailedTriggerParsedEvent(
                        logEntry,
                        trigger.triggerId,
                        action.actionId,
                        'Trigger Secondary Action',
                        renderedPhrases,
                        phrases.map( p => p.phrase ),
                        {
                            phraseId: null,
                            result: null,
                            renderedPhrase: null,
                            dependencyResult: res.result,
                        },
                        trigger._conditionResults,
                        deltaTime,
                    );
                }

                return matched;
            },
            /**
             * Executes this component's secondary action.
             * 
             * @param {string} instanceId The instance id of the component.
             * @param {Date} timestamp The timestamp of the log entry.
             */
            _trigger: ( instanceId, timestamp ) => {
                let m = new TriggerSecondaryActionModel();
                m.instanceId = instanceId;
                m.timestamp = timestamp;
                m.action = 'setStart';
                
                logInstanceIds.push( m.instanceId );
                
                ipcRenderer.send( 'overlay:send:secondary-action', m );
            },
            instanceId: comp.instanceId
        } );

        let wornOffPhrase = new Phrase();
        // https://regex101.com/r/zp2l25/1
        // ^Your Polybiad Venom(?:\sRk\. III?)? spell has worn off of Combat Dummy Azia\.
        wornOffPhrase.phrase = `^Your ${trigger.name}(?:\\sRk\\. III?)? spell has worn off of ?{target}\\.`;
        wornOffPhrase.useRegEx = true;
        wornOffPhrase.phraseId = nanoid();
        let renderedWornOffPhrases = renderPhrases( [ wornOffPhrase ], trigger._conditionResults, res.result, deltaTime, true );
        
        dotWornOffTracking.push( {
            /**
             * Returns true if the given log entry matches the phrases.
             * 
             * @param {string} logEntry The log entry to parse.
             * @returns {boolean}
             */
            _parse: ( logEntry ) => {
                
                for ( let i = 0; i < renderedWornOffPhrases.length; i++ ) {
                    const phrase = renderedWornOffPhrases[ i ];
                    let _res = new RegExp( phrase, 'gi' ).exec( logEntry );
                    if ( _res?.length > 0 ) {
                        enableLogging && sendInformationToLog( `DoT Timer worn off: [${logEntry}]` );
                        
                        addSuccessfulTriggerParsedEvent(
                            logEntry,
                            trigger.triggerId,
                            action.actionId,
                            'Trigger Cancel Action',
                            phrase,
                            wornOffPhrase.phrase,
                            {
                                phraseId: wornOffPhrase.phraseId,
                                result: _res,
                                renderedPhrase: phrase,
                                dependencyResult: res.result,
                            },
                            trigger._conditionResults,
                            deltaTime );
                        
                        return true;
                    }
                }

                addFailedTriggerParsedEvent(
                    logEntry,
                    trigger.triggerId,
                    action.actionId,
                    'Trigger Cancel Action',
                    renderedWornOffPhrases,
                    [ wornOffPhrase.phrase ],
                    {
                        phraseId: null,
                        result: null,
                        renderedPhrase: null,
                        dependencyResult: res.result,
                    },
                    trigger._conditionResults,
                    deltaTime,
                );

                return false;
            },
            /**
             * Executes this component's secondary action.
             * 
             * @param {string} instanceId The instance id of the component.
             * @param {Date} timestamp The timestamp of the log entry.
             */
            _trigger: ( instanceId, timestamp ) => {
                let m = new TriggerSecondaryActionModel();
                m.instanceId = instanceId;
                m.action = 'clipTimer';
                m.timestamp = timestamp;
                
                logInstanceIds.push( m.instanceId );
                
                ipcRenderer.send( 'overlay:send:secondary-action', m );
            },
            instanceId: comp.instanceId,
        } );
        
    }

    return comp.instanceId;
}










/**
 * Builds and sends a timer/countdown overlay component.
 * 
 * @param {PhraseParse} res The information from the parsed phrase.
 * @param {Date} timestamp The timestamp of the log entry.
 * @param {TriggerAction} action The trigger's display text action.
 * @param {number} deltaTime The change in time, in milliseconds, since the previous sequential capture.
 * @param {LogTrigger} trigger If true the component is written to the console instead of sent to the overlay window.
 * 
 * @return {string} Returns the instance id of the renderer component
 */
function displayTimerCountdownComponent(res, timestamp, action, deltaTime, trigger) {
      
    // ${target} has been slain by (.+?)!
    let comp = new OverlayComponent();

    comp.instanceId = nanoid();
    comp.triggerId = trigger.triggerId;
    comp.triggerName = trigger.name;
    comp.action = Object.assign( new TriggerAction(), action );
    
    logInstanceIds.push( comp.instanceId );

    if ( comp.action.actionType !== ActionTypes.Stopwatch ) {
        if ( res.result?.groups?.timerDuration ) {
            comp.action.duration = StringUtilities.getDurationFromLabel( res.result?.groups?.timerDuration );
        } else {
    
            if ( action.storageDuration && action.storageDuration.indexOf( '[' ) > -1 ) {
                let dur = +action.duration;
                dur = +getPersistentDictionaryValue( action.storageDuration, res, timestamp, action, deltaTime, trigger );
                comp.action.duration = dur > 0 ? dur / 1000 : +action.duration;
            } else if ( action.storageDuration ) {
                let dur = +action.duration;
                dur = +getScalarValue( action.storageDuration, 0 );
                comp.action.duration = dur > 0 ? dur / 1000 : +action.duration;
            } else {
                comp.action.duration = +action.duration;
            }
        }
    }
    
    comp.action.displayText = StringUtilities.parseShortCodeValuesToLiteral( comp.action.displayText, characterName, comp.action.duration, res.result?.groups, res.result ? res.result[ 0 ] : null );
    comp.action.displayText = StringUtilities.parseStoredVariablesToLiteral( comp.action.displayText, storedVariables );
    comp.action.displayText = StringUtilities.parseConditionResultsToLiteral( comp.action.displayText, trigger._conditionResults );
    comp.action.displayText = StringUtilities.parseMatchesToLiteral( comp.action.displayText, res.result, deltaTime );
    comp.action.displayText = StringUtilities.parseCountersToLiteral( comp.action.displayText, counters );

    comp.overlayId = action.overlayId;
    comp.matches = res.result;
    comp.timestamp = timestamp;
    comp.voiceIndex = voiceIndex;
    
    if ( comp.action.actionType !== ActionTypes.Stopwatch ) {
        if ( comp.action.endingSoonDisplayText ) {
            comp.action.endingSoonText = StringUtilities.parseShortCodeValuesToLiteral( action.endingSoonText, characterName, comp.action.duration, res.result?.groups, res.result ? res.result[ 0 ] : null );
            comp.action.endingSoonText = StringUtilities.parseStoredVariablesToLiteral( comp.action.endingSoonText, storedVariables );
            comp.action.endingSoonText = StringUtilities.parseConditionResultsToLiteral( comp.action.endingSoonText, trigger._conditionResults );
            comp.action.endingSoonText = StringUtilities.parseMatchesToLiteral( comp.action.endingSoonText, res.result, deltaTime );
            comp.action.endingSoonText = StringUtilities.parseCountersToLiteral( comp.action.endingSoonText, counters );
        }
    
        if ( comp.action.endingSoonSpeak ) {
            comp.action.endingSoonSpeakPhrase = StringUtilities.parseShortCodeValuesToLiteral( action.endingSoonSpeakPhrase, characterName, comp.action.duration, res.result?.groups, res.result ? res.result[ 0 ] : null );
            comp.action.endingSoonSpeakPhrase = StringUtilities.parseStoredVariablesToLiteral( comp.action.endingSoonSpeakPhrase, storedVariables );
            comp.action.endingSoonSpeakPhrase = StringUtilities.parseConditionResultsToLiteral( comp.action.endingSoonSpeakPhrase, trigger._conditionResults );
            comp.action.endingSoonSpeakPhrase = StringUtilities.parseMatchesToLiteral( comp.action.endingSoonSpeakPhrase, res.result, deltaTime );
            comp.action.endingSoonSpeakPhrase = StringUtilities.parseCountersToLiteral( comp.action.endingSoonSpeakPhrase, counters );
        }
    
        if ( comp.action.endingClipboard ) {
            comp.action.endingClipboardText = StringUtilities.parseShortCodeValuesToLiteral( action.endingClipboardText, characterName, comp.action.duration, res.result?.groups, res.result ? res.result[ 0 ] : null );
            comp.action.endingClipboardText = StringUtilities.parseStoredVariablesToLiteral( comp.action.endingClipboardText, storedVariables );
            comp.action.endingClipboardText = StringUtilities.parseConditionResultsToLiteral( comp.action.endingClipboardText, trigger._conditionResults );
            comp.action.endingClipboardText = StringUtilities.parseMatchesToLiteral( comp.action.endingClipboardText, res.result, deltaTime );
            comp.action.endingClipboardText = StringUtilities.parseCountersToLiteral( comp.action.endingClipboardText, counters );
        }
    }

    if ( comp.action.endedDisplayText ) {
        comp.action.endedText = StringUtilities.parseShortCodeValuesToLiteral( action.endedText, characterName, comp.action.duration, res.result?.groups, res.result ? res.result[ 0 ] : null );
        comp.action.endedText = StringUtilities.parseStoredVariablesToLiteral( comp.action.endedText, storedVariables );
        comp.action.endedText = StringUtilities.parseConditionResultsToLiteral( comp.action.endedText, trigger._conditionResults );
        comp.action.endedText = StringUtilities.parseMatchesToLiteral( comp.action.endedText, res.result, deltaTime );
        comp.action.endedText = StringUtilities.parseCountersToLiteral( comp.action.endedText, counters );
    }

    if ( comp.action.endedSpeak ) {
        comp.action.endedSpeakPhrase = StringUtilities.parseShortCodeValuesToLiteral( action.endedSpeakPhrase, characterName, comp.action.duration, res.result?.groups, res.result ? res.result[ 0 ] : null );
        comp.action.endedSpeakPhrase = StringUtilities.parseStoredVariablesToLiteral( comp.action.endedSpeakPhrase, storedVariables );
        comp.action.endedSpeakPhrase = StringUtilities.parseConditionResultsToLiteral( comp.action.endedSpeakPhrase, trigger._conditionResults );
        comp.action.endedSpeakPhrase = StringUtilities.parseMatchesToLiteral( comp.action.endedSpeakPhrase, res.result, deltaTime );
        comp.action.endedSpeakPhrase = StringUtilities.parseCountersToLiteral( comp.action.endedSpeakPhrase, counters );
    }

    if ( comp.action.endedClipboard ) {
        comp.action.endedClipboardText = StringUtilities.parseShortCodeValuesToLiteral( action.endedClipboardText, characterName, comp.action.duration, res.result?.groups, res.result ? res.result[ 0 ] : null );
        comp.action.endedClipboardText = StringUtilities.parseStoredVariablesToLiteral( comp.action.endedClipboardText, storedVariables );
        comp.action.endedClipboardText = StringUtilities.parseConditionResultsToLiteral( comp.action.endedClipboardText, trigger._conditionResults );
        comp.action.endedClipboardText = StringUtilities.parseMatchesToLiteral( comp.action.endedClipboardText, res.result, deltaTime );
        comp.action.endedClipboardText = StringUtilities.parseCountersToLiteral( comp.action.endedClipboardText, counters );
    }

    // reset the trigger.
    trigger._reset();

    ipcRenderer.send( 'overlay:send:component', comp );

    if ( comp.action.endEarlyPhrases?.length > 0 ) {
        let renderedPhrases = renderPhrases( comp.action.endEarlyPhrases, trigger._conditionResults, res.result, deltaTime );

        cancellableComponents.push( {
            _parse: ( logEntry ) => {
                let matched = false;

                for ( let i = 0; i < renderedPhrases.length; i++ ) {
                    const phrase = renderedPhrases[ i ];
                    let _res = new RegExp( phrase, 'gi' ).exec( logEntry );
                    if ( _res?.length > 0 ) {
                        enableLogging && sendInformationToLog( `Timer/Countdown/Stopwatch ended early: [${logEntry}]` );
                        matched = true;
                        
                        addSuccessfulTriggerParsedEvent(
                            logEntry,
                            trigger.triggerId,
                            action.actionId,
                            'Trigger Cancel Action',
                            phrase,
                            comp.action.endEarlyPhrases[ i ].phrase,
                            {
                                phraseId: comp.action.endEarlyPhrases[ i ].phraseId,
                                result: _res,
                                renderedPhrase: phrase,
                                dependencyResult: res.result,
                            },
                            trigger._conditionResults,
                            deltaTime );
                        

                        if ( comp.action.actionType === ActionTypes.Stopwatch ) {
                            // TODO: This should be done with actual capture phrase properties instead of intercepting the end early phrases and modifying the results unnaturally.
                            ipcRenderer.send( 'renderer:stopwatch:stop', comp.instanceId );

                            // If this is a stopwatch, we need to send the stop command to the renderer, and tell the log watcher that the parse failed to prevent the log parser from destroying the component entirely.
                            return false;
                        }
                    }
                }

                if ( !matched ) {
                    addFailedTriggerParsedEvent(
                        logEntry,
                        trigger.triggerId,
                        action.actionId,
                        'Trigger Cancel Action',
                        renderedPhrases,
                        comp.action.endEarlyPhrases.map( p => p.phrase ),
                        {
                            phraseId: null,
                            result: null,
                            renderedPhrase: null,
                            dependencyResult: res.result,
                        },
                        trigger._conditionResults,
                        deltaTime,
                    );
                }

                return matched;
            },
            instanceId: comp.instanceId
        } );
    }

    return comp.instanceId;
    
}










/**
 * Builds and sends a display text overlay component.
 * 
 * @param {PhraseParse} res The information from the parsed phrase.
 * @param {TriggerAction} action The trigger's display text action.
 * @param {Record<string, string>} conditionResults The values of the conditions when the trigger was parsed.
 * @param {number} deltaTime The change in time, in milliseconds, since the previous sequential capture.
 */
function sendToClipboard( res, action, conditionResults, deltaTime ) {
    let clipboardText = action.displayText;

    clipboardText = StringUtilities.parseShortCodeValuesToLiteral( clipboardText, characterName, action.duration, res.result?.groups, res.result ? res.result[ 0 ] : null );
    clipboardText = StringUtilities.parseStoredVariablesToLiteral( clipboardText, storedVariables );
    clipboardText = StringUtilities.parseConditionResultsToLiteral( clipboardText, conditionResults );
    clipboardText = StringUtilities.parseMatchesToLiteral( clipboardText, res.result, deltaTime );
    clipboardText = StringUtilities.parseCountersToLiteral( clipboardText, counters );

    ipcRenderer.send( 'clipboard:writeText', clipboardText );

}










/**
 * Builds and sends a display text overlay component.
 * 
 * @param {PhraseParse} res The information from the parsed phrase.
 * @param {TriggerAction} action The trigger's display text action.
 * @param {Date} timestamp The timestamp of the log entry.
 * @param {number} deltaTime The change in time, in milliseconds, since the previous sequential capture.
 * @param {boolean} simulating If true the component is written to the console instead of sent to the overlay window.
 * @param {string} triggerId The id of the trigger that parsed the phrase.
 * 
 * @return {string} Returns the instance id of the renderer component
 */
function displayTextComponent( res, timestamp, action, deltaTime, simulating, triggerId ) {
    
    let comp = new OverlayComponent();

    comp.instanceId = nanoid();
    comp.triggerId = triggerId;
    comp.action = Object.assign( new TriggerAction(), action );
    
    logInstanceIds.push( comp.instanceId );
    
    comp.action.displayText = StringUtilities.parseShortCodeValuesToLiteral( comp.action.displayText, characterName, comp.action.duration, res.result?.groups, res.result ? res.result[ 0 ] : null );
    comp.action.displayText = StringUtilities.parseStoredVariablesToLiteral( comp.action.displayText, storedVariables );
    comp.action.displayText = StringUtilities.parseCountersToLiteral( comp.action.displayText, counters );
    comp.action.displayText = StringUtilities.parseMatchesToLiteral( comp.action.displayText, res.result, deltaTime );

    comp.overlayId = action.overlayId;
    comp.matches = res.result;
    comp.timestamp = timestamp;

    if ( !simulating )
        ipcRenderer.send( 'overlay:send:component', comp );
    else
        console.log( 'overlay:send:component', comp );
    
    return comp.instanceId;
}










/**
 * Sends the given information to the debug log overlay.
 * 
 * @param {any} info The information to send to the log.
 * @param {number} duration The duration to leave in the log overlay.
 * 
 * @return {string} Returns the instance id of the renderer component
 */
function sendInformationToLog( info, duration ) {
    
    let overlayId = _.find( overlays, o => o.overlayType === 'Log' )?.overlayId;
    duration = duration > 0 ? duration : 12;
    
    if ( overlayId ) {

        let comp = new OverlayComponent();
    
        comp.instanceId = nanoid();
        comp.action = new TriggerAction();
        comp.action.actionId = nanoid();
        comp.action.actionType = ActionTypes.DisplayText;
        
        logInstanceIds.push( comp.instanceId );
        
        if ( typeof info === 'string' ) {
            comp.action.displayText = info.replace( /\s/gmi, '&nbsp;' );
            comp.action.duration = duration;
        } else {
            comp.action.displayText = JSON.stringify( info );
            comp.action.duration = duration;
        }
        
        comp.overlayId = overlayId;
        comp.matches = null;
        comp.timestamp = new Date();

        ipcRenderer.send( 'overlay:send:component', comp );

        return comp.instanceId;
    }
}










/**
 * Sends the stored variables object to the main thread to cache in memory.
 */
function cacheStoredVariables() {
    ipcRenderer.send( 'cache:store', { key: `storedVariables:${characterId}`, value: storedVariables } );
}










/**
 * Clears the cached stored variables.
 */
function clearCachedStoredVariables() {
    ipcRenderer.send( 'cache:clear', `storedVariables:${characterId}` );
}










/**
 * Loads cached stored variables, or initializes the stored variables object if 
 * no cache is found.
 * 
 * @param {() => void} callback The callback to execute after the stored variables are loaded.
 */
function loadCachedStoredVariables( callback ) {
    let cacheKey = `storedVariables:${characterId}`;
    ipcRenderer.once( `cache:retrieve:${cacheKey}`, ( event, cachedVariables ) => {
        if ( cachedVariables ) {
            storedVariables = cachedVariables;
        } else {
            storedVariables = {};
        }

        if ( callback ) {
            callback();
        }
    } );
    ipcRenderer.send( 'cache:retrieve', cacheKey );
}










/**
 * Saves the given value in the store.
 * 
 * @param {string} key The key of the stored variable.
 * @param {any} value The value to store.
 * @param {boolean} restricted If true, the value must be used as a condition in a trigger before being saved.
 */
function saveVariable( key, value, restricted ) {
    let storeValue = true;
    
    if ( restricted ) {
        if ( usedConditionValues == null || usedConditionValues[ key ] == null || usedConditionValues[ key ].length == 0 || usedConditionValues[ key ].indexOf( value ) === -1 ) {
            storeValue = false;
        }
    }

    if ( storeValue ) {
        storedVariables[ key ] = storedVariables[ key ]?.length > 0 ? storedVariables[ key ] : [];
        storedVariables[ key ].push( value );

        enableLogging && sendInformationToLog( `Storing value [${value}] into [${key}]`, 12 );
        enableLogging && sendInformationToLog( `Current values are: ${storedVariables[ key ].join( '|' )}` );

        cacheStoredVariables();
    }

}










/**
 * Increments the specified counter by 1.
 * 
 * @param {string} key The counter name/key.
 */
function incrementCounter( key ) {
    if ( counters[ key ] == null ) {
        // Do not fail.
        console.error( 'No counter found for ', key );
    } else {
        counters[ key ].value += 1;
        counters[ key ].lastUpdate = new Date();
    }
}










/**
 * Saves the given value in the store.
 * 
 * @param {string} key The key of the stored variable.
 * @param {any} value The value to store.
 */
function saveScalarVariable( key, value ) {
    storedVariables[ key ] = [ value ];

    enableLogging && sendInformationToLog( `Storing scalar value [${value}] into [${key}]`, 12 );
    enableLogging && sendInformationToLog( `Current values are: ${storedVariables[ key ].join( '|' )}` );

    cacheStoredVariables();
}










/**
 * Returns the value of the given key in the store.
 * 
 * @param {string} key The key of the stored variable.
 * @param {any | undefined} defaultValue The default value to return if the key is not found.
 */
function getScalarValue( key, defaultValue ) {
    defaultValue = defaultValue ?? undefined;
    return storedVariables[ key ]?.length > 0 ? storedVariables[ key ][ 0 ] : defaultValue;
}










/**
 * Returns true if the given key has the specified value in the store.
 * 
 * @returns {{exists: boolean, value: any}}
 * 
 * @param {string} key The key of the stored variable.
 * @param {any|any[]} value The value to check.
 */
function storeHasValue( key, value ) {
    
    if ( storedVariables[ key ]?.length > 0 ) {
        if ( value instanceof Array ) {
            for ( let i = 0; i < value.length; i++ ) {
                let index = storedVariables[ key ].indexOf( value[ i ] );
                if ( index > -1 ) {
                    return { exists: true, value: value[ i ] };
                }
            }
        } else {
            let index = storedVariables[ key ].indexOf( value );
            return index > -1 ? { exists: true, value: value } : { exists: false };
        }
    }

    return { exists: false };
    
}










/**
 * Returns true if the given key has a matching value in the store.
 * 
 * @returns {{exists: boolean, value: any}}
 * 
 * @param {string} key The key of the stored variable.
 * @param {any|any[]} value The value to check.
 */
function storeContainsValue( key, value ) {
    
    if ( storedVariables[ key ]?.length > 0 ) {
        if ( value instanceof Array ) {
            for ( let i = 0; i < storedVariables[ key ].length; i++ ) {
                for ( let v = 0; v < value.length; v++ ) {
                    let rgx = new RegExp( value[ v ].replace( /[.*+?^${}()|[\]\\]/g, '\\$&' ), 'gi' );
                    
                    if ( storedVariables[ key ][ i ].match( rgx ) ) {
                        return { exists: true, value: storedVariables[ key ][ i ] };
                    }
                }
            }
        } else {
            for ( let i = 0; i < storedVariables[ key ].length; i++ ) {
                let rgx = new RegExp( value.replace( /[.*+?^${}()|[\]\\]/g, '\\$&' ), 'gi' );

                if ( storedVariables[ key ][ i ].match( rgx ) ) {
                    return { exists: true, value: storedVariables[ key ][ i ] };
                }
            }
        }
    }

    return { exists: false };
}










/**
 * Clears the given value from the store.
 * 
 * @param {string} key The key of the stored variable.
 * @param {any} value The value to clear.
 */
function clearStoredVariable( key, value ) {

    if ( storedVariables[ key ]?.length ) {
        let index = storedVariables[ key ].indexOf( value );

        if ( index > -1 ) {

            storedVariables[ key ].splice( index, 1 );
            enableLogging && sendInformationToLog( `Removed [${value}] from store variable [${key}] at index [${index}]` );
            enableLogging && sendInformationToLog( `Current values are: ${storedVariables[ key ].join( '|' )}` );

        } else {
            enableLogging && sendInformationToLog( `Clear value failed, [${value}] not found in stored variables` );
            enableLogging && sendInformationToLog( `Current values are: ${storedVariables[ key ].join( '|' )}` );

        }
    }

    clearCachedStoredVariables();

}










/**
 * Clears all values from the store.
 * 
 * @param {string} key The key of the stored variable.
 */
function clearAllStoredValuesInVariable( key ) {
    storedVariables[ key ] = [];
    cacheStoredVariables();
}










/**
 * Renders the given list of phrases into regular expressions.
 * 
 * @returns {string[]} Returns the rendered phrase regex.
 * 
 * @param {Phrase[]} phrases The list of phrases to render.
 * @param {Record<string,any>} conditionResults The value of condition checks for the executed trigger.
 * @param {RegExpExecArray} parseResult The regexp exec array of the parsed log entry.
 * @param {number} deltaTime The change in time, in milliseconds, since the previous sequential capture.
 * @param {boolean} parseSequentialMatches If true, sequential group matches will be parsed.
 */
function renderPhrases( phrases, conditionResults, parseResult, deltaTime, parseSequentialMatches ) {
    let renderedPhrases = [];
    
    deltaTime = deltaTime != null ? deltaTime : 0;

    for ( let phraseIndex = 0; phraseIndex < phrases?.length; phraseIndex++ ) {
        let renderedPhrase = phrases[ phraseIndex ].phrase;

        renderedPhrase = StringUtilities.parseShortCodeValuesToLiteral( renderedPhrase, characterName, 0, parseResult?.groups, parseResult ? parseResult[ 0 ] : null );
        renderedPhrase = StringUtilities.parseStoredVariablesToLiteral( renderedPhrase, storedVariables );
        renderedPhrase = conditionResults?.length > 0 ? StringUtilities.parseConditionResultsToLiteral( renderedPhrase, conditionResults ) : renderedPhrase;
        renderedPhrase = parseSequentialMatches === true && parseResult?.groups ? StringUtilities.parseSequentialGroups( renderedPhrase, parseResult.groups ) : renderedPhrase;
        renderedPhrase = parseResult?.length > 0 ? StringUtilities.parseMatchesToLiteral( renderedPhrase, parseResult, deltaTime ) : renderedPhrase;
        renderedPhrase = StringUtilities.parseCountersToLiteral( renderedPhrase, counters );

        if ( phrases[ phraseIndex ].useRegEx ) {
            renderedPhrases.push( renderedPhrase );
        } else {
            renderedPhrases.push( renderedPhrase.replace( /[.*+?^${}()|[\]\\]/g, '\\$&' ) );
        }
    }

    return renderedPhrases;
}










/**
 * Tells speech synthisis engine to speak the given phrase.
 * 
 * @param {string} phrase The phrase to speak.
 * @param {boolean} interrupt If true, interrupts the current utterance if the speech engine is speaking.
 * @param {boolean} speakNext If true, lets the current utterance complete but forces this speech next.
 * @param {Record<string, string>} conditionResults The condition results.
 * @param {boolean} simulating If true the phrase is written to the log instead of spoken.
 * @param {RegExpExecArray} parseResult The regexp exec array of the parsed log entry.
 * @param {number} timerDuration The duration in seconds of the timer, if applicable.
 * @param {number} deltaTime The change in time, in milliseconds, since the previous sequential capture.
 * @param {number} volume The volume which to speak.
 * @param {() => void} afterSpeech Executes function after speech ended.
 */
function speakPhrase( phrase, interrupt, speakNext, conditionResults, simulating, parseResult, timerDuration, deltaTime, volume, rate, afterSpeech ) {
    
    if ( !simulating && phrase && voiceIndex > -1 ) {

        let utter = new SpeechSynthesisUtterance();
    
        utter.text = StringUtilities.parseShortCodeValuesToLiteral( phrase, characterName, timerDuration, parseResult?.groups, parseResult ? parseResult[ 0 ] : null );
        utter.text = StringUtilities.parseStoredVariablesToLiteral( utter.text, storedVariables );
        if ( conditionResults ) {
            utter.text = StringUtilities.parseConditionResultsToLiteral( utter.text, conditionResults );
        }
        if ( parseResult ) {
            utter.text = StringUtilities.parseMatchesToLiteral( utter.text, parseResult, deltaTime );
        }
        utter.text = StringUtilities.parseCountersToLiteral( utter.text, counters );
        utter.text = StringUtilities.parsePhoneticTransformsToLiteral( utter.text, phoneticTransforms );
        utter.voice = voiceOptions[ voiceIndex ];
        utter.volume = ( masterVolume / 100 ) * ( speechVolume / 100 ) * ( volume > 0 ? volume / 100 : 1 );
        utter.rate = ( rate ?? 1 ) * ( baseSpeakingRate ?? 1 );
        
        utter.onend = function ( event ) {
            let i = utterances.indexOf( this );
            if ( i > -1 ) {
                utterances.splice( i, 1 );
            }
            if ( utterances?.length > 0 ) {
                speechSynthesis.speak( utterances[ 0 ] );
            }
            if ( afterSpeech ) {
                afterSpeech();
            }
        }
    
        if ( interrupt && speechSynthesis.speaking ) {
            
            // Stop any current speech.
            speechSynthesis.cancel();
            
            // Put this speech at the top of the list.
            utterances.unshift( utter );

            // Deletes the next item in the queue, preventing the system from attempting to re-speak what was already started.
            utterances.splice( 1, 1 );
            
            // Tell the engine to start talking.
            speechSynthesis.speak( utterances[ 0 ] );
    
        } else if ( speakNext && speechSynthesis.speaking ) {
            
            if ( utterances.length > 1 ) {
                // If there is another queued utterance, then push this utterance to the next in line.
                utterances = [].concat( utter, ...utterances.slice( 1 ) );
            } else {
                // Otherwise just push it into the array at the end.
                utterances.push( utter );
            }

        } else {
            
            // Put the utterance at the end of the queue.
            utterances.push( utter );
    
            // If the engine is not talking, tell it to start talking.
            !speechSynthesis.speaking && speechSynthesis.speak( utterances[ 0 ] );
    
        }
        
    } else {
        console.log( 'speaking', StringUtilities.parseStoredVariablesToLiteral( action.displayText, storedVariables ) );

    }
    
}










/**
 * Calculates the number of additional ticks from focus effects.
 * 
 * @param {number} duration The base duration.
 * @param {CharacterClassLevel[]} triggerClasses The base duration.
 * @param {number} wornExtFocusPercent The worn percent increase.
 * @param {number} extFocusDecayLevel The level in which the focus begins to fade.
 * @param {number} aaExtFocusPercent The aa percent increase.
 * @param {boolean} onlyUseAaBeneficialFocus If true, only the AA ben ext. focus effect will be used.
 */
function calculateAdditionalTicks( duration, triggerClasses, wornExtFocusPercent, extFocusDecayLevel, aaExtFocusPercent, onlyUseAaBeneficialFocus ) {
    let percent = 0;

    if ( !onlyUseAaBeneficialFocus ) {
        percent = wornExtFocusPercent;
        let charClassData = _.find( triggerClasses, ccl => ccl.class === charModel.class );

        if ( charClassData != null && charClassData.level > extFocusDecayLevel ) {
            let decayPercent = ( charClassData.level - extFocusDecayLevel ) * 5;
            percent = percent * ( 1 - decayPercent / 100 );
        }
    }
    percent += aaExtFocusPercent;

    let baseTicks = duration / 6;
    let addTicks = baseTicks * percent / 100;
    if ( addTicks < 1 )
        addTicks = Math.round( addTicks );
    else
        addTicks = Math.floor( addTicks );
    
    return addTicks;
}










/**
 * Calculates the number of additional ticks from focus effects.
 * 
 * @param {number} castTime The cast time, in milliseconds.
 * @param {number} timerDuration The timer duration, in milliseconds.
 * @param {CharacterClassLevel[]} triggerClasses The base duration.
 * @param {CharacterModel} characterModel The character model.
 * @param {number} maxPercent The maximum percent decrease.
 */
function calculateBeneficialCastingMilliseconds( castTime, timerDuration, triggerClasses, characterModel, maxPercent ) {
    
    let wornFocus = characterModel.beneficialCastingSpeedFocusPercent ?? 0;
    let aaFocus = characterModel.beneficialCastingSpeedFocusAaPercent ?? 0;
    let durationLimit = characterModel.beneficialCastingSpeedFocusAaDurationLimit > 0 ? characterModel.beneficialCastingSpeedFocusAaDurationLimit : 6000;
    let percent = timerDuration >= durationLimit ? wornFocus + aaFocus : wornFocus;
    let charClassData = _.find( triggerClasses, ccl => ccl.class === charModel.class );

    if ( charClassData != null && charClassData.level > characterModel.extendedBeneficialFocusDecayLevel ) {
        let decayPercent = ( charClassData.level - characterModel.extendedBeneficialFocusDecayLevel ) * 5;
        percent = percent * ( 1 - decayPercent / 100 );
    }

    if ( percent > maxPercent ) {
        percent = maxPercent;
    }

    let reduction = 1 - percent / 100;
    return castTime * reduction;
}










/**
 * Plays the specified audio file.
 * 
 * @param {string} fileId The id of the desired file.
 */
function playAudioFile( fileId, volume ) {
    ipcRenderer.once( 'audio-file:get:url', ( e, url ) => {
        if ( url ) {
            let player = new Audio( url );
            player.volume = ( masterVolume / 100 ) * ( audioVolume / 100 ) * ( volume > 0 ? volume / 100 : 1 );
            player.play();
            audioPlayers.push( player );
            player.addEventListener( 'ended', ( event ) => {
                let i = audioPlayers.indexOf( player );
                if ( i > -1 ) {
                    audioPlayers.splice( i, 1 );
                }
            } );
        }
    } );
    ipcRenderer.send( 'audio-file:get:url', fileId );
}










/**
 * Checks previously captured log entries for the given phrase.
 * 
 * @param {RegExp} phrase The phrase to query.
 * @param {{time: number[]}} options Changes the behavior of the search pattern.
 */
function checkParseHistory( phrase, options ) {
    
    if ( options.time?.length > 0 ) {
        for ( let i = 0; i < options.time.length; i++ ) {
            let t = Math.floor( options.time[ i ] / 1000 ) * 1000;
            let m = _findFirstMatch( parsedLogEntries[ t ] );

            if ( m ) {
                return m;
            }
        }
        // options.time = Math.round( options.time / 1000 ) * 1000;
        // console.log( 'checkParseHistory', parsedLogEntries, options.time );
        // return _findFirstMatch( parsedLogEntries[ options.time ] );

    } else {
        for ( let key in Object.keys( parsedLogEntries ) ) {

            let m = _findFirstMatch( parsedLogEntries[ +key ] );

            if ( m ) {
                return m;
            }
        
        }
    }

    function _findFirstMatch( logEntries ) {
        
        if ( logEntries?.length > 0 ) {
            for ( let i = 0; i < logEntries.length; i++ ) {
                let m = phrase.exec( logEntries[ i ] );
                if ( m?.length > 0 ) {
                    return m;
                }
            }
        }

    }

}










/**
 * Parses backwards in the log file to find a match.  If found, returns the matched results.
 * 
 * @param {string} log The log file to parse.
 * @param {() => void} callback When all look-backs are completed, this method is executed.
 */
function backfind( log, callback ) {

    let _triggers = _.filter( triggers, t => _.some( t.actions, a => a.loopBackForValue === true ) );

    // TODO: Loopback check, wat!?
    /**
     * Returns false if there is a trigger requiring loopback and still missing a value.
     */
    function valuesMissing() {
        for ( let ti = 0; ti < _triggers?.length ?? 0; ti++ ) {
            for ( let ai = 0; ai < _triggers[ ti ].actions?.length ?? 0; ai++ ) {
                let hasValue = storedVariables[ _triggers[ ti ].actions[ ai ].variableName ] instanceof Array ? storedVariables[ _triggers[ ti ].actions[ ai ].variableName ].length > 0 : !!storedVariables[ _triggers[ ti ].actions[ ai ].variableName ];
                if ( hasValue ) {
                    return false;
                }
            }
        }

        return true;
    }

    if ( valuesMissing() ) {
        fs.open( log, 'r', function ( err, fd ) {
            if ( fd ) {
                let danglyBits = null;
                var stats = fs.fstatSync( fd );
                let myChunkSize = stats.size < chunkSize ? stats.size : chunkSize;
                // let myChunkSize = stats.size;
                let position = stats.size; //  Start at the end of the file.

                /**
                 * 
                 * @param {number} readCount 
                 */
                function parseChunk( readCount ) {
                    let start = stats.size - readCount - myChunkSize;
                    if ( start < 0 ) {
                        start = 0;
                        myChunkSize = stats.size - readCount;
                    }
                    if ( position <= 0 || !valuesMissing() ) {
                        // If we've reached the beginning of the file or all values where parsed, execute the callback function and end parsing.
                        callback();

                    } else {
                        fs.read( fd, Buffer.alloc( myChunkSize ), 0, myChunkSize, start, ( err, bytecount, buff ) => {
                        
                            let read = buff.toString( 'utf-8', 0, bytecount );
                            let lines = read.split( /\r\n|\r|\n/gmi );

                            if ( position < stats.size ) {
                                lines[ lines.length - 1 ] += danglyBits;
                            }
                            danglyBits = lines[ 0 ];

                            if ( lines?.length > 1 ) {
                                for ( let i = lines.length - 1; i > 0; i-- ) {
                                    // We want to parse backwards, reading all lines except for the first in the list, this is because the first in the list could be a partial line.
                                    if ( lines[ i ].length > 0 && lines[ i ].charAt( 0 ) === '[' ) {
                                        try {
                                            _triggers.forEach( trigger => {
                                                // Check for a valid timestamp in the line.
                                                let log = lines[ i ].replace( /^\[(.*?)\]\s*/gi, '' );

                                                trigger._parse( log, res => {
                                                    trigger.actions.forEach( action => {
                                                        if ( action.phrases?.indexOf( res.phraseId ) > -1 && action.actionType === ActionTypes.StoreVariable ) {
                                                            /* --== Store Variable ==-- */
                    
                                                            if ( action.loopBackForValue ) {
                                                                if ( res.result.length === 1 ) {
                                                                    saveVariable( action.variableName, res.result[ 0 ], action.onlyStoreUsedValues );
                                                                } else {
                                                                    saveVariable( action.variableName, res.result[ 1 ], action.onlyStoreUsedValues );
                                                                }
                                
                                                                addSuccessfulTriggerParsedEvent(
                                                                    log,
                                                                    trigger.triggerId,
                                                                    action.actionId,
                                                                    'Trigger Action Loopback',
                                                                    res.renderedPhrase,
                                                                    trigger.capturePhrases.find( p => p.phraseId === res.phraseId )?.phrase,
                                                                    res,
                                                                    trigger._conditionResults,
                                                                    undefined );
                                                            }

                                                        }
                                                    } );
                                                } );
                                            } );
                                            
                                        } catch ( error ) {
                                            enableLogging && sendInformationToLog( `Failure attempting to read line: ${lines[ i ]}` );
                                        }
                                    }
                                    

                                    if ( !valuesMissing() ) {
                                        window.setTimeout( () => callback() );
                                        return;
                                    }
                                }
                            }

                            if ( bytecount <= 0 ) {
                                // If bytes read was 0, something went wonky and we need to trigger an exit condition.
                                position = -1;
                            }
                            
                            position -= bytecount;

                            parseChunk(bytecount);

                        } );
                    }
                }

                parseChunk(0);
                
            }
        } );
    } else {
        callback();

    }

}










/**
 * Applies folder conditions to each trigger.
 * 
 * @param {TriggerFolder[]} folders The trigger folders.
 * @param {TriggerCondition[] | null} conditionAncestry The conditions for each direct parent.
 */
function applyFolderConditions( folders, conditionAncestry ) {
    for ( let i = 0; i < folders?.length; i++ ) {
        const folder = folders[ i ];
        let generationConditions = ArrayUtilities.concat( conditionAncestry, folder.folderConditions );

        for ( let ti = 0; ti < triggers?.length; ti++ ) {
            const trigger = triggers[ ti ];
            if ( trigger.folderId === folder.folderId ) {
                trigger._folderConditions = generationConditions;
            }
        }

        applyFolderConditions( folder.children ?? [], ArrayUtilities.concat( conditionAncestry, folder.folderConditions ) );
    }
}










/**
 * Saves the given value in the store.
 * 
 * @param {string} key The dictionary definition.
 * @param {PhraseParse} res The information from the parsed phrase.
 * @param {Date} timestamp The timestamp of the log entry.
 * @param {TriggerAction} action The trigger's display text action.
 * @param {number} deltaTime The change in time, in milliseconds, since the previous sequential capture.
 * @param {LogTrigger} trigger The trigger that owns this action.
 */
function savePersistentDictionary( key, res, timestamp, action, deltaTime, trigger ) {
    let renderedKeys = key;
    
    renderedKeys = StringUtilities.parseShortCodeValuesToLiteral( renderedKeys, characterName, 0, res.result?.groups, res.result ? res.result[ 0 ] : null );
    renderedKeys = StringUtilities.parseStoredVariablesToLiteral( renderedKeys, storedVariables );
    renderedKeys = StringUtilities.parseConditionResultsToLiteral( renderedKeys, trigger._conditionResults );
    renderedKeys = StringUtilities.parseMatchesToLiteral( renderedKeys, res.result, deltaTime );
    renderedKeys = StringUtilities.parseCountersToLiteral( renderedKeys, counters );

    let renderedValue = action.storeLiteralDefinition;
    
    renderedValue = StringUtilities.parseShortCodeValuesToLiteral( renderedValue, characterName, 0, res.result?.groups, res.result ? res.result[ 0 ] : null );
    renderedValue = StringUtilities.parseStoredVariablesToLiteral( renderedValue, storedVariables );
    renderedValue = StringUtilities.parseConditionResultsToLiteral( renderedValue, trigger._conditionResults );
    renderedValue = StringUtilities.parseMatchesToLiteral( renderedValue, res.result, deltaTime );
    renderedValue = StringUtilities.parseCountersToLiteral( renderedValue, counters );

    let keys = StringUtilities.parseDictionaryKeys( renderedKeys );

    // https://regex101.com/r/Bf9Vk8/1
    keys.unshift( /^.+?(?=(\[))/gmi.exec( key )[ 0 ] );

    storePersistentDictionary( keys, renderedValue );

}










/**
 * Returns the stored value or null.
 * 
 * @param {string} key The dictionary definition.
 * @param {PhraseParse} res The information from the parsed phrase.
 * @param {Date} timestamp The timestamp of the log entry.
 * @param {TriggerAction} action The trigger's display text action.
 * @param {number} deltaTime The change in time, in milliseconds, since the previous sequential capture.
 * @param {LogTrigger} trigger The trigger that owns this action.
 */
function getPersistentDictionaryValue( key, res, timestamp, action, deltaTime, trigger ) {
    let renderedKeys = key;
    
    renderedKeys = StringUtilities.parseShortCodeValuesToLiteral( renderedKeys, characterName, 0, res.result?.groups, res.result ? res.result[ 0 ] : null );
    renderedKeys = StringUtilities.parseStoredVariablesToLiteral( renderedKeys, storedVariables );
    renderedKeys = StringUtilities.parseConditionResultsToLiteral( renderedKeys, trigger._conditionResults );
    renderedKeys = StringUtilities.parseMatchesToLiteral( renderedKeys, res.result, deltaTime );
    renderedKeys = StringUtilities.parseCountersToLiteral( renderedKeys, counters );
    
    let keys = StringUtilities.parseDictionaryKeys( renderedKeys );
    // https://regex101.com/r/Bf9Vk8/1
    keys.unshift( /^.+?(?=(\[))/gmi.exec( key )[ 0 ] );

    let storage = persistentDictionary;

    for ( let i = 0; i < keys?.length ?? 0; i++ ) {
        if ( storage[ keys[ i ] ] ) {
            if ( i === keys.length - 1 ) {
                return storage[ keys[ i ] ];
            }

            storage = storage[ keys[ i ] ];
        } else {
            return null;
        }
    }

    return null;
}










/**
 * Loads the current character's last death recap.
 */
function loadLastDeathRecap() {

    let message = new IpcMessage( { logFilePath: charModel.logFile, characterName: characterName } );
    ipcRenderer.send( 'window:last-death-recap', message );
    
}










/**
 * Sends the given value to the user-preferences to store.
 * 
 * @param {string[]} keys The keys for the dictionary value.
 * @param {string} value The value to keep.
 */
function storePersistentDictionary( keys, value ) {
    ipcRenderer.send( 'settings:set:persistent-storage-value', { keys: keys, value: value } );
}

module.exports = LogWatcher;

// Capture spell being cast
// You begin casting Cascading Darkness.

// Exit conditions (casting)
//X A loathling lich resisted your Cascading Darkness!
//X Your Envenomed Bolt spell is interrupted.
//X Your Journeyman Boots spell did not take hold. (Blocked by Pack Spirit.)

// Exit conditions (timer)
//  A black wolf has been slain by Grimrot!
//  You have slain a black wolf!

// ^You hit (.*) for 5 points of disease damage by ${SpellBeingCast}\.
// ^You hit (.*) for ([0-9]*) ?points of (.*)? ?damage by Poison Bolt\.

// Spell lands:
//  On Hit:
//        You hit a black wolf for 41 points of poison damage by Envenomed Bolt.
//        You hit (          ) for ()                         by (            )
//  On Tick 1:
//        A black wolf has taken 10 damage from your Envenomed Bolt.
//        (          )           ()             your (            )


// ***
// [Fri Oct 02 09:34:19 2020] You begin casting Funeral Pyre of Kelador.
// ***
// [Fri Oct 02 09:34:21 2020] a carrion beetle hatchling is enveloped in a funeral pyre.
// ***
// [Fri Oct 02 09:34:25 2020] A carrion beetle hatchling has taken 350 damage from your Funeral Pyre of Kelador.
// ***
// [Fri Oct 02 09:34:25 2020] You have slain a carrion beetle hatchling!

// [Thu Jun 06 23:22:28 2019] Azryl has fallen to the ground.
// [Thu Nov 05 00:31:50 2020] You are no longer feigning death, because a spell hit you.
