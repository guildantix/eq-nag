// TODO: This can be accomplished using web workers.  Buckle up and do it.
const { ipcRenderer } = require( 'electron' );
const fs = require( 'fs' );
const { Trigger, TriggerAction, ActionTypes, TriggerConditionTypes, OperatorTypes, CharacterClassLevel, TriggerSubAction, TriggerFolder, TriggerCondition, CapturePhrase, Phrase, TriggerParseHistoryModel, getActionLabel, LogTypes, ErrorMessages } = require( '../data/models/trigger' );
const { QuickShareAuthorListTypes, SimulationProgress, NConditionalModel, VConditionalOperationModel, SConditionalModel, LConditionalOperationModel, SConditionalOperationModel } = require( '../data/models/common' );
const { PhraseParse, LogTrigger, LogList } = require( './log.model' );
const { OverlayComponent, OverlayWindow, TriggerSecondaryActionModel } = require( '../data/models/overlay-window' );
const { CharacterModel } = require( '../data/models/character' );
const customAlphabet = require( 'nanoid' ).customAlphabet;
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const nanoid = customAlphabet( alphabet, 16 );
const _ = require( 'lodash' );
const StringUtilities = require( '../utilities/string' );
const NumberUtilities = require( '../utilities/numbers' );
const ThreadUtilities = require( '../utilities/threading' );
const { DateUtilities } = require( '../utilities/dates' );
const { IpcMessage } = require( '../data/models/common' );
const ArrayUtilities = require( '../utilities/arrays' );
const FileMonitor = require( '../utilities/file-monitor' );
const perf = require( '../utilities/perf' );
// Triggers are timed on one log line in ten (perf-taps.js scales them up), so
// the per-trigger timing doesn't slow the log watcher down much.
let perfTriggerSample = 0;
const { LogHistoryManager } = require( '../utilities/log-console' );
const { createChatRoomLink } = require( '../utilities/peer-to-peer' );
const { nagException, nagLog } = require( '../utilities/nag-console' );
const { nagId } = require( '../utilities/nag-id' );
const { RendererComponent, ListObjectModel } = require( '../data/models/renderer' );
const { nagListNameKey, getCharacterName } = require( '../data/models/core' );
const chunkSize = 512 * 1024;

window.onerror = ( error, url, line ) => {
    ipcRenderer.send( 'app:log:exception', `$${error}\r\n    at ${url}:${line}` );
};

/**
 * Sends to the main thread to log the message.
 * 
 * @param {string} message The message to log.
 * @param {any | undefined} payload The payload to log.
 */
const log = ( message, payload ) => {
    nagLog( {
        label: 'Log Watcher',
        message: message,
        payload: payload,
    } );
}

/** @type {OverlayWindow} */
var overlays = [];
/** @type {LogTrigger[]} */
var triggers = [];
/** @type {LogTrigger[]} The triggers that are enabled for this character, rebuilt on each tick. */
var activeTriggers = [];
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
var enableQuickShareImports = true;
var damageDealtOverlayId = null;
var damageReceivedOverlayId = null;
var voiceOptions = [];
var voiceIndex = -1;
var masterVolume = 100;
var speechVolume = 100;
var audioVolume = 100;
var baseSpeakingRate = 1;
const logParseTimer = 50;
var changingLogFile = false;
var backupStarted = false;
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
/** @type {FileMonitor} */
let fileMonitor = null;
/** @type {LogHistoryManager} */
let logHistoryMgr = new LogHistoryManager( '', '', () => { }, () => { }, () => [] );

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

/** @type {Record<string, RegExp>} */
let buffRegExs = {};

/** @type {(() => void)[]} */
let onTriggerGenCompleteHandlers = [];

/** @type {boolean} */
let triggerGenComplete = false;
    
let rgxTimestamp = /^\[(.*?)\]\s*/i;

/** @type {LogList[]} */
let lists = [];

// Common errors:
//  ${C} instead of {C}
//  ${CharacterName} isntead of ${Character}
//  ending with a '.' in regex instead of a '\.'
//  Forgetting to check the box for regex.
//  Choosing the wrong phrase for an action.
//      If the display text has {C} or {TS} in it, but the trigger phrase selected doesn't contain either option.










let _lowerCaseSource = undefined;
let _lowerCaseValue = undefined;
/**
 * Returns the given value in lower case.  Every trigger phrase checks the same
 * log line, so the last result is reused.
 * 
 * @param {string} value The value.
 */
function toLowerCached( value ) {
    if ( value !== _lowerCaseSource ) {
        _lowerCaseSource = value;
        _lowerCaseValue = value.toLowerCase();
    }
    return _lowerCaseValue;
}










/**
 * Starts parsing and watching log file changes for the specified file.
 * 
 * @param {string} logPath The file path to the log file.
 * @param {number} startLogPosition If a value is provided, will start parsing the log file at the given position.
 */
function startParsingLogFile( logPath, startLogPosition ) {
    
    fileMonitor.monitorLines( ( lines ) => {
        // let start = performance.now();

        lines.forEach( line => {
            if ( line && line.length > 0 ) {
                const perfStart = perf.enabled ? perf.now() : 0;
                parseLogEntries( line );
                perf.enabled && perf.record( 'log-watcher: line', perfStart );
            }
        } );
        
        // console.log( 'done processing lines, total time', performance.now() - start, 'line count', lines.length );
    }, startLogPosition )
        .then( () => {
            log( `Monitoring log file: ${logPath}` );
        } )
        .catch( error => {
            log( `Error monitoring log file: ${logPath}`, error );
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
        logHistoryMgr = new LogHistoryManager( character.characterId, character.name, () => counters, () => storedVariables, () => triggers );
        fileMonitor = new FileMonitor( character.logFile );
        logHistoryMgr.startBatchTriggerParseHistory();
    }

    loadCachedStoredVariables( () => {
        saveScalarVariable( "Character", characterName );
    } );

    ipcRenderer.on( 'app:clear-log-history',
        /**
         * Handles the log:changed event.
         * 
         * @param {any} event The event args.
         */
        ( event ) => {
            logHistoryMgr?.clearHistory();
        } );
    
    ipcRenderer.on( 'log:backup-started',
        /**
         * Handles the log:changed event.
         * 
         * @param {any} event The event args.
         */
        function ( event ) {
            backupStarted = true;
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

            fileMonitor.stopMonitoringLogFile().then( () => {
                fileMonitor = new FileMonitor( logFilePath );
                if ( !triggerGenComplete ) {
                    onTriggerGenCompleteHandlers.push( () => backfind().then( () => startParsingLogFile( logFilePath, logPosition >= 0 ? logPosition : null ) ) );

                } else {
                    backfind().then( () => startParsingLogFile( logFilePath, logPosition >= 0 ? logPosition : null ) );

                }
            } );

        } );

    ipcRenderer.on( 'log:simulate:file', function ( event, data ) {
        throw new Error( 'Not implemented' );
        // fs.open( data, 'r', function ( err, fd ) {
        //     var file = fd;
        //     var stats = fs.fstatSync( fd );
                    
        //         fs.read( file, Buffer.alloc( stats.size ), 0, stats.size, 0, ( err, bytecount, buff ) => {
        //             let read = buff.toString( 'utf-8', 0, bytecount );
        //             let lines = read.split( /\r\n|\r|\n/gmi );
        //             lines.forEach( line => {
        //                 if ( line && line.length > 0 ) {
        //                     parseLogEntries( line, true );
        //                 }
        //             } );
        //             console.log( 'lines done' );
        //         } );

        // } );
    } );

    ipcRenderer.on( 'log:simulate:begin',
        /**
         * Begins the simulation.
         * 
         * @param {any} event Electron event args.
         * @param {{lines: string, lineIndex: number|null, simulationId: string}} model Simulation data.
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
                const lineCount = lineData[ i ].lines.length;

                ipcRenderer.send( `log:simulation:${simulationId}:lines`, { lines: lineData[ i ].lines, padTime: padTime } );

                // let startp = performance.now();
                // TODO: Remove the simulating argument from parse log entries, it's not used any more.
                lineData[ i ].lines.forEach( line => parseLogEntries( line, false, padTime ) );
                
                simulationLineIndex += lineCount;
                progress.lineIndex = simulationLineIndex;
                progress.completePercent = ( simulationLineIndex / simulationMaxIndex ) * 100;

                // let endp = performance.now();
                // let duration = endp - startp;
                // let avgp = duration / lineCount;
                // console.log( '[i/m] Line count, duration, avg', i, lineData.length - 1, lineCount, duration, avgp );

                // TODO: When paused, all timed actions should be paused as well.

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
                    // let waitMs = DateUtilities.timeSince( new Date(), new Date( lineData[ i + 1 ].timestamp.getTime() + ( padTime * 1000 ) ) ).totalMilliseconds;
                    let waitMs = new Date( lineData[ i + 1 ].timestamp.getTime() + ( padTime * 1000 ) ).getTime() - new Date().getTime();
                    // console.log( 'waitMs', waitMs );
                    waitMs = waitMs > logParseTimer ? waitMs : logParseTimer;

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

    // TODO: I think this is unused.
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

    // TODO: I think this is unused.
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

        const perfStart = perf.enabled ? perf.now() : 0;
        applyFolderConditions( triggerFolders );
        generateTriggerFns();
        activeTriggers = triggers.filter( trigger => !!trigger.enabled && !trigger._profileDisabled );
        initCounters();
        perf.enabled && perf.record( 'log-watcher: tick (rebuild triggers)', perfStart );
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

        if ( lists.length > 0 || activeCounters || cancellableComponents?.length > 0 || secondaryTriggerActions?.length > 0 ) {
            // We're still alive, don't kill us!
            e.sender.send( 'log:pulse', true );
        } else {
            // Flatline
            e.sender.send( 'log:pulse', false );
        }

    } );

    ipcRenderer.on( 'settings:get:persistent-storage', ( e, v ) => {
        persistentDictionary = v;
    } );

    ipcRenderer.on( 'log:action:execute-sub-action',
        /**
         * 
         * @param {any} e Event args.
         * @param {{subAction: TriggerSubAction, instanceId: string}} v The values.
         */
        ( e, v ) => {
            executeSubAction( v );
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
 * Executes the given sub-action.
 * 
 * @param {{subAction: TriggerSubAction, instanceId: string}} v The values.
 * @param {{duration?: number, instanceId?: string} | undefined} options The options.
 */
function executeSubAction( v, options ) {
    try {

        let instanceData = actionInstances[ v.instanceId ];
        if ( instanceData ) {
            let action = instanceData.trigger.actions.find( f => f.actionId === v.subAction.actionId );
            let deltaTime = 0;

            if ( v.subAction ) {

                instanceData.res.result.groups = instanceData.res.result.groups ? instanceData.res.result.groups : {};
                let expectedDuration = 0;

                if ( options?.duration > 0 ) {
                    expectedDuration = options.duration;
                    action.duration = options.duration;
                    
                } else if ( instanceData.res.result?.groups?.timerDuration ) {
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

            executeTriggerAction( instanceData.trigger, action, new Date(), instanceData.res, deltaTime, false, options );
        } else {
            console.log( 'No instance data', v );
        }

    } catch ( error ) {
        let instanceData = actionInstances[ v.instanceId ];

        instanceData = instanceData ? instanceData : {
            trigger: {
                triggerId: 'undefined',
                name: 'undefined',
                _conditionResults: {},
                _deltaTime: 0,
            }
        };

        logHistoryMgr.logError(
            error,
            'Executing Sub Action',
            false,
            0,
            ErrorMessages.subActionExecution( instanceData?.trigger?.triggerId ),
            {
                triggerId: instanceData?.trigger?.triggerId,
                name: instanceData?.trigger?.name,
                _conditionResults: instanceData?.trigger?._conditionResults,
                _deltaTime: instanceData?.trigger?._deltaTime,
            } );
    }
}










/**
 * Returns the regex options for the given capture phrase.
 * 
 * @returns {string | undefined} The regex options, if any.
 * 
 * @param {CapturePhrase} phrase The capture phrase
 */
function getPhraseRegexOptions( phrase ) {
    let opts = undefined;
    if ( phrase.ignoreCase ) {
        opts = 'i';
    }
    return opts;
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
                    /** @type {RegExp[]} */
                    let renderedPhraseRegExps = [];
                    counters[ action.displayText ] = {
                        value: 0,
                        lastUpdate: new Date(),
                        resetDelay: action.duration,
                        _parse: logEntry => {
                            if ( resetsOnPhrases ) {
                                let matched = false;
                                
                                renderedPhrases.forEach( ( phrase, i ) => {
                                    renderedPhraseRegExps[ i ] = renderedPhraseRegExps[ i ] ?? new RegExp( phrase, getPhraseRegexOptions( action.resetCounterPhrases[ i ] ) );
                                    let _res = renderedPhraseRegExps[ i ].exec( logEntry );
                                    if ( _res?.length > 0 ) {
                                        matched = true;
                                        logHistoryMgr.addSuccessfulTriggerParsedEvent(
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

                /** @type {Record<string, RegExp>} */
                let _phraseRegEx = {};

                /** @type {Record<string, string>} */
                let _phraseStaticCache = {};

                /** @type {Record<string, NConditionalModel>} */
                let _phraseNConditionals = {};

                /** @type {Record<string, VConditionalOperationModel[]>} */
                let _phraseVarConditionals = {};

                /** @type {Record<string, LConditionalOperationModel[]>} */
                let _phraseListConditionals = {};

                /** @type {Record<string, SConditionalOperationModel[]>} */
                let _phraseSeqConditionals = {};
    
                trigger.capturePhrases?.forEach( phrase => {

                    // If a phrase is dynamic, we'll need to re-create the regex each time.
                    // Note: we may be able to squeeze a little more performance out of this 
                    // by ensuring that each { is not preceeded by a \.  Because this only 
                    // executes when generating the parse functions, we can be a little heavy 
                    // handed computationally.
                    phrase.dynamic = phrase.dynamic === true || phrase.phrase?.indexOf( '{' ) > -1;
    
                    // Only create parse functions for phrases that have content.
                    if ( phrase.phrase?.length > 0 ) {
                        if ( phrase.useRegEx ) {
                            // Use different parse functions for regex vs normal.
                            _phraseParsers.push( ( value, hasGroups, matchGroups ) => {
                                let rgxValue = phrase.phrase;

                                if ( _phraseRegEx[ phrase.phraseId ] == null ) {
                                    if ( _phraseStaticCache[ phrase.phraseId ] ) {
                                        rgxValue = _phraseStaticCache[ phrase.phraseId ];

                                    } else {
                                        _phraseNConditionals[ phrase.phraseId ] = StringUtilities.parseNConditionalCodesToRegex( rgxValue, characterName );
                                        rgxValue = _phraseNConditionals[ phrase.phraseId ]?.value ?? rgxValue;

                                        _phraseStaticCache[ phrase.phraseId ] = rgxValue;

                                    }
                                
                                    rgxValue = StringUtilities.parseShortCodesToRegex( rgxValue, characterName );
                                
                                    const regexVConditional = StringUtilities.parseStoredVariablesToRegexConditional( rgxValue, storedVariables );
                                    if ( regexVConditional?.operations.length > 0 ) {
                                        rgxValue = regexVConditional.value;
                                        _phraseVarConditionals[ phrase.phraseId ] = _phraseVarConditionals[ phrase.phraseId ]?.length > 0 ? [ ..._phraseVarConditionals[ phrase.phraseId ], ...regexVConditional.operations ] : regexVConditional.operations;
                                    }

                                    // If the trigger has any List action types.
                                    let listAction = trigger.actions?.find( a => a.actionType === ActionTypes.List );
                                    if ( listAction ) {
                                        const regexLConditional = StringUtilities.parseListCodesToRegexConditionals( rgxValue );
                                        if ( regexLConditional?.operations.length > 0 ) {
                                            rgxValue = regexLConditional.value;
                                            _phraseListConditionals[ phrase.phraseId ] = _phraseListConditionals[ phrase.phraseId ]?.length > 0 ? [ ..._phraseListConditionals[ phrase.phraseId ], ...regexLConditional.operations ] : regexLConditional.operations;
                                        }
                                    }
    
    
                                    if ( trigger.captureMethod === 'Sequential' ) {
                                        const regexSConditional = StringUtilities.parseSequentialGroupsToRegexConditionals( rgxValue );
                                        if ( regexSConditional?.operations.length > 0 ) {
                                            rgxValue = regexSConditional.value;
                                            _phraseSeqConditionals[ phrase.phraseId ] = _phraseSeqConditionals[ phrase.phraseId ]?.length > 0 ? [ ..._phraseSeqConditionals[ phrase.phraseId ], ...regexSConditional.operations ] : regexSConditional.operations;
                                        }
                                    }
                                
                                    _renderedPhrases[ phrase.phraseId ] = rgxValue;
                                    // Optimizations:
                                    // Here, we could use formula to add named capture groups for variable insertion, letting the system create one regex once.
                                    // ex: (?<number_VariableName>\d+), (?<string_VariableName>.+), etc.
                                    // If the regex matches, do a simple regex.groups?.string_VariableName == 'value' to determine if the value is a match.
                                    // It is possible that we would need to do an includes or startswith to correctly capture variable values.

                                    // Further, we can do a better job of caching phrases, maybe an array of some type that we can loop through.

                                    // If we really want to, we could divine a way to determine if the variables have changed since last check.
                                    _phraseRegEx[ phrase.phraseId ] = new RegExp( rgxValue, getPhraseRegexOptions( phrase ) );
                                }

                                let _res = _phraseRegEx[ phrase.phraseId ].exec( value );

                                // Notes:
                                //  variable conditional failed for TestRecallVariable with name nag_2WmDJBOlld37UnZ8 with value asdf
                                //  rgxValue ^Eryndhel recalls (?<nag_2WmDJBOlld37UnZ8>.+?)\.$
                                //  Variable conditional passed for TestRecallVariable with value testing
                                //  cleaning up 3eSxSuf9dfI9seZ3

                                if ( _res?.groups ) {

                                    if ( _phraseVarConditionals[ phrase.phraseId ]?.length > 0 ) {
                                        // If the phrase has variable conditionals, we need to check them.
                                        for ( let i = 0; i < _phraseVarConditionals[ phrase.phraseId ].length; i++ ) {
                                            const vCond = _phraseVarConditionals[ phrase.phraseId ][ i ];

                                            // NOTE: This is showing a preference for the stored variables, so if a sequence has a matching value as a stored variable, the stored variable will check first.
                                            if ( !vCond.validatorFn( _res, storedVariables ) ) {
                                                if ( trigger.captureMethod === 'Sequential' && matchGroups ) {
                                                    // If the phrase is sequential and we have sequential regex matches, we need to re-check against the sequential conditionals.
                                                    if ( !vCond.seqValidatorFn( _res, { groups: matchGroups } ) ) {
                                                        _res = undefined;
                                                        break;
                                                    }
                                                } else {
                                                    _res = undefined;
                                                    break;
                                                }
                                            }
                                        }
                                    }

                                    if ( _phraseListConditionals[ phrase.phraseId ]?.length > 0 ) {
                                        // If the phrase has list conditionals, we need to check them.
                                        for ( let i = 0; i < _phraseListConditionals[ phrase.phraseId ].length; i++ ) {
                                            const lCond = _phraseListConditionals[ phrase.phraseId ][ i ];

                                            if ( !lCond.validatorFn( _res, lists, characterName ) ) {
                                                _res = undefined;
                                                break;
                                            }
                                        }
                                    }

                                    if ( _phraseSeqConditionals[ phrase.phraseId ]?.length > 0 ) {
                                        // If the phrase has sequential conditionals, we need to check them.
                                        for ( let i = 0; i < _phraseSeqConditionals[ phrase.phraseId ].length; i++ ) {
                                            const sCond = _phraseSeqConditionals[ phrase.phraseId ][ i ];

                                            if ( !sCond.validatorFn( _res, { groups: matchGroups } ) ) {
                                                _res = undefined;
                                                break;
                                            }
                                        }
                                    }

                                }

                                if ( _res?.length > 0 && _phraseNConditionals[ phrase.phraseId ] ) {
                                    for ( let opI = 0; opI < _phraseNConditionals[ phrase.phraseId ].operations.length; opI++ ) {
                                        const op = _phraseNConditionals[ phrase.phraseId ].operations[ opI ];
                                        let value = op.nIndex == undefined ? +_res.groups.N : +_res.groups[ `N${op.nIndex}` ];
                                        let pass = true;

                                        for ( let vi = 0; vi < op.validateFns?.length ?? 0; vi++ ) {
                                            pass = op.validateFns[ vi ]( value );

                                            if ( !pass ) {
                                                break;
                                            }
                                        }

                                        if ( !pass ) {
                                            _res = undefined;
                                            break;
                                        }
                                    }
                                }

                                return {
                                    phraseId: phrase.phraseId,
                                    match: _res?.length > 0,
                                    result: _res,
                                    renderedPhrase: rgxValue,
                                };
                            } );
                        } else {
                            // These only depend on the phrase, so work them out once instead of on every log line.
                            const hasListShortCode = typeof phrase.phrase === 'string' && /{L([0-9]*?)}/i.test( phrase.phrase );
                            const staticLiterals = typeof phrase.phrase === 'string' && !phrase.phrase.includes( '${' ) ? [ phrase.phrase ] : null;
                            const staticLiteralsLower = staticLiterals?.map( p => p.toLowerCase() );

                            _phraseParsers.push( ( value, hasGroups, matchGroups ) => {

                                // If the trigger has any List action types.
                                if ( hasListShortCode ) {
                                    logHistoryMgr.logParseError(
                                        `List action types are not supported in non-regex capture phrases.`, value, null, null,
                                        `List action types are not supported in non-regex capture phrases.`,
                                        trigger, null,
                                        'Trigger Generation',
                                        phrase.phrase,
                                        phrase.phrase );
                                }

                                if ( value?.length > 0 ) {
                                    // We won't care about case sensitivity.
                                    let _phrs = staticLiterals ?? StringUtilities.parseStoredVariablesToLiteralArray( phrase.phrase, storedVariables );
                                    let matched = false;
                                    const valueLower = toLowerCached( value );
    
                                    if ( _phrs?.length > 0 ) {
                                        for ( let i = 0; i < _phrs.length; i++ ) {
                                            if ( valueLower.indexOf( staticLiteralsLower?.[ i ] ?? _phrs[ i ].toLowerCase() ) > -1 ) {
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
                        const variableName = condition.variableName;
                        if ( condition.conditionType === TriggerConditionTypes.VariableValue ) {
                            if ( condition.operatorType === OperatorTypes.Equals ) {

                                let storedValue = storeHasValue( variableName, _conditionValues[ variableName ] );

                                if ( !storedValue.exists ) {
                                    conditionsPassed = false;
                                } else {
                                    // Store what value passed.
                                    trigger._conditionResults[ variableName ] = storedValue.value;
                                }
                                
                            } else if ( condition.operatorType === OperatorTypes.IsNull ) {
    
                                if ( storedVariables[ variableName ]?.length > 0 ) {
                                    conditionsPassed = false;
                                } else {
                                    // Store the condition result for this key as null.
                                    trigger._conditionResults[ variableName ] = null;
                                }
    
                            } else if ( condition.operatorType === OperatorTypes.DoesNotEqual ) {
    
                                let storedValue = storeHasValue( variableName, _conditionValues[ variableName ] );
                                
                                if ( _conditionValues[ variableName ] && storedValue.exists ) {
                                    // If the condition value is not null, then check if the store has that value.
                                    conditionsPassed = false;
                                } else if ( _conditionValues[ variableName ] == null && ( storedVariables[ variableName ] == null || storedVariables[ variableName ]?.length == 0 ) ) {
                                    // If the condition value is null, then check to make sure that the stored value(s) have at least 1 value;
                                    //  ex: If CurrentZone == null and the condition requires that CurrentZone DoesNotEqual Null
                                    conditionsPassed = false;
                                } else {
                                    // Store what value passed.
                                    trigger._conditionResults[ variableName ] = storedValue.value;
                                }
    
                            } else if ( condition.operatorType === OperatorTypes.Contains ) {
                                
                                let storedValue = storeContainsValue( variableName, _conditionValues[ variableName ] );
    
                                if ( !storedValue.exists ) {
                                    conditionsPassed = false;
    
                                } else {
                                    // Store what value passed.
                                    trigger._conditionResults[ variableName ] = storedValue.value;
    
                                }
                                
                            }
                        } else if ( condition.conditionType === TriggerConditionTypes.CounterValue ) {
                            const counterValue = counters[ variableName ]?.value ?? null;
                            const conditionValue = condition.variableValue && !StringUtilities.isNullOrWhitespace( condition.variableValue ) ? +condition.variableValue : null;
                            const conditionNullMatch = counterValue === null && conditionValue === null;

                            if ( condition.operatorType === OperatorTypes.Equals ) {
                                if ( !conditionNullMatch && counterValue - conditionValue !== 0 ) {
                                    conditionsPassed = false;
                                }
                            } else if ( condition.operatorType === OperatorTypes.GreaterThan ) {
                                if ( conditionNullMatch || counterValue - conditionValue <= 0 ) {
                                    conditionsPassed = false;
                                }
                            } else if ( condition.operatorType === OperatorTypes.LessThan ) {
                                if ( conditionNullMatch || conditionValue - counterValue <= 0 ) {
                                    conditionsPassed = false;
                                }
                            } else if ( condition.operatorType === OperatorTypes.DoesNotEqual ) {
                                if ( conditionNullMatch || counterValue - conditionValue === 0 ) {
                                    conditionsPassed = false;
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
                                _phraseParsers.forEach( ( parser, i ) => {
                                    let _res = parser( value );
                                    if ( _res?.match ) {
                                        onMatch( _res, 0 );
                                        passed = true;
                                    }
                                } );
                            }
                            
                        } catch ( error ) {
                            logHistoryMgr.logParseError(
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
                                        groupKeys.forEach( key => {
                                            _newSeqMatch.groups[ key ] = _res.result.groups[ key ];
                                        } );
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
        
                                    _sequentialMatchs.forEach( ( sequentialMatch, i ) => {
                                        if ( sequentialMatch.captureIndex < _phraseParsers?.length ) {
                                            let _res = _phraseParsers[ sequentialMatch.captureIndex ]( value, sequentialMatch.hasGroups, sequentialMatch.groups );
                                                
                                            if ( _res?.match ) {
                                                sequentialMatch.captureIndex += 1;
        
                                                trigger._deltaTime = Date.now() - sequentialMatch.time;
                                                sequentialMatch.time = Date.now();
                                                    
                                                let groupKeys = _res.result?.groups ? Object.keys( _res.result.groups ) : [];
                                                if ( groupKeys.length > 0 ) {
                                                    for ( let key of groupKeys ) {
                                                        sequentialMatch.groups[ key ] = _res.result.groups[ key ];
                                                    }
                                                }
                        
                                                sequentialMatch.hasGroups = sequentialMatch.hasGroups || groupKeys.length > 0;
                        
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
                                    } );
        
                                    // Remove any sequences.
                                    for ( let i = removeSequenceIndices.length - 1; i >= 0; i-- ) {
                                        _sequentialMatchs.splice( i, 1 );
                                    }
                                    
                                }
                                
                            } else {
                                // If the conditions are no longer met, then forcefully reset all possible match groups.
                                trigger._reset( true );
                                
                            }
        
                        } catch ( error ) {
                            logHistoryMgr.logParseError(
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
                    
                };
            }

        } catch ( error ) {
            logHistoryMgr.logError( error, raw, simulating, padTime, ErrorMessages.triggerGeneration(), trigger );
        }

    } );

    triggerGenComplete = true;
    if ( onTriggerGenCompleteHandlers?.length > 0 ) {
        let fns = onTriggerGenCompleteHandlers.splice( 0, onTriggerGenCompleteHandlers.length );
        fns.forEach( f => f() );
    }
}










/**
 * Parses the given log entry.
 * 
 * @param {string} raw The raw log entry.
 * @param {boolean} simulating If true, only simulates executing triggers via a consol.log call.
 * @param {number|undefined} padTime The amount of time to add to the timestamps of log entries.
 */
function parseLogEntries( raw, simulating, padTime ) {

    try {
        // let startp = performance.now(); //p
        
        simulating = simulating === true ? true : false;
    
        // let rgxTrigger = /grats;/gi;
        // let rgxGrabText = /\'(.*?)\'$/gi;
        // let rgxDelimiter = /;/gi;
        // let rgxNum = /(\d+)/gi;

        // Someone healed you.
        // https://regex101.com/r/Jdtzsf/3
        // ^(?<healer>.+?) healed you (over time for|for) (?<healAmount>[0-9]*) (\(([0-9]*)\) )?hit points by (?<healType>.+?)\.

        // You healed someone else.
        // https://regex101.com/r/0btqKz/1
        // ^(?<healer>You) healed (?<target>.+?) (over time for|for) (?<healAmount>[0-9]*) (\(([0-9]*)\) )?hit points by (?<healType>.+?)\.

        let tsRgx = rgxTimestamp.exec( raw );
        let timestamp = tsRgx ? new Date( tsRgx[ 1 ] ) : null;

        if ( !timestamp || timestamp.length === 0 || timestamp.length === 1 ) {
            nagException( {
                label: 'log-watcher.js',
                message: `Timestamp not found in log entry.`,
                payload: {
                    logEntry: raw,
                    simulating: simulating === true,
                    padTime: padTime,
                },
            } );

            return;
            
        } else if ( padTime > 0 )
            timestamp = new Date( timestamp.getTime() + ( padTime * 1000 ) );
    
        let log = raw.replace( rgxTimestamp, '' );
        
        // https://regex101.com/r/FvGiGC/2
        // {NAG:(?<quickShareId>.+?)}
        // TODO: Remove the negative lookahead for package after a few versions.
        // let quickShareRegx = /{NAG:(?!package\/)(quick-share\/)?(?<quickShareId>.+?)}/g;
    
        // https://regex101.com/r/ZrNaZM/2
        let quickShareRegx = /^(:?(?<author>\w+) .*)?{NAG:(?!package\/)(?!p2p\/)(quick-share\/)?(?<quickShareId>.+?)}/g;

        // https://regex101.com/r/L8V7Ip/2
        let p2pRegex = /^(:?(?<player>\w+) .*)?{NAG:(p2p\/)(?<chatRoomId>.+?)}/g;

        // https://regex101.com/r/RwCLkN/1
        let packageShareRegx = /{NAG:package\/(?<packageId>.+?)}/g;
        // {NAG:OVtf9VzRSjykb1xx}
        // {NAG:quick-share/OVtf9VzRSjykb1xx}
        // {NAG:package/X0VJh1fjkddZCl9r}

        // https://regex101.com/r/n9aOlR/1
        // ^(?<author>Name|Name2) .*{NAG:(?<quickShareId>.+?)}

        // Every share link contains {NAG:, so most lines can skip these checks.
        const hasNagLink = log.includes( '{NAG:' );

        // Capture quickshares, when enabled.
        let quickShare = !enableQuickShareImports || !hasNagLink ? null : quickShareRegx.exec( log );
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

        let p2p = hasNagLink ? p2pRegex.exec( log ) : null;
        if ( p2p && p2p.groups?.chatRoomId && p2p.groups?.player != 'You' && p2p.groups?.player != 'you' && p2p.groups?.player != characterName ) {
            let link = createChatRoomLink( p2p.groups.chatRoomId );
            ipcRenderer.send( 'chat-room:link-received', {
                link: link,
                player: p2p.groups.player,
                server: charModel.server,
            } );
        }

        let quickSharePackage = hasNagLink ? packageShareRegx.exec( log ) : null;
        if ( quickSharePackage && quickSharePackage.groups?.packageId ) {
            ipcRenderer.send( 'quicksharePackage_captured', quickSharePackage.groups.packageId );
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
                    logHistoryMgr.logError( error, raw, simulating, padTime, ErrorMessages.cancellableParse(), actionInstances[ token.instanceId ]?.trigger );
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
                            logHistoryMgr.logError( error, raw, simulating, padTime, ErrorMessages.secondaryTriggerExecution(), actionInstances[ token.instanceId ]?.trigger );
                        }

                    }

                } catch ( error ) {
                    logHistoryMgr.logError( error, raw, simulating, padTime, ErrorMessages.secondaryTriggerParse(), actionInstances[ token.instanceId ]?.trigger );
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
                            logHistoryMgr.logError( error, raw, simulating, padTime, ErrorMessages.secondaryTriggerExecution(), actionInstances[ token.instanceId ]?.trigger );
                        }

                    }

                } catch ( error ) {
                    logHistoryMgr.logError( error, raw, simulating, padTime, ErrorMessages.secondaryTriggerParse(), actionInstances[ token.instanceId ]?.trigger );
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
                    logHistoryMgr.logError( error, raw, simulating, padTime, ErrorMessages.counterExecution( key ), null );
                }

            }
        }

        let entryMatched = false;
        const perfTriggers = perf.enabled && ++perfTriggerSample % 10 === 0;
        activeTriggers.forEach( trigger => {

            if ( !!trigger.enabled && !trigger._profileDisabled ) {
                const perfStart = perfTriggers ? perf.now() : 0;
                trigger._parse( log, ( res, deltaTime ) => {

                    try {
                            
                        trigger.actions.forEach( action => {
                            // This used to execute actions if there are no phrases on the action, but now it doesn't because the action may exist only as a subaction
                            // ( action.phrases == null || action.phrases?.length === 0 || action.phrases?.indexOf( res.phraseId ) > -1 )
                            if ( ( isDev || !action.onlyExecuteInDev ) && ( action.actionType === ActionTypes.List || action.phrases?.indexOf( res.phraseId ) > -1 ) ) {

                                enableLogging && sendInformationToLog( `Execute trigger action [${trigger.name}] : ${ActionTypes[ action.actionType ]}`, 24 );
                                enableLogging && sendInformationToLog( `    ||${raw}||`, 24 );

                                executeTriggerAction( trigger, action, timestamp, res, deltaTime, simulating );
                                
                                logHistoryMgr.addSuccessfulTriggerParsedEvent(
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
                        logHistoryMgr.logError( error, raw, simulating, padTime, ErrorMessages.triggerExecution(), trigger );
                    }
                    
                } );
                perfTriggers && perf.record( trigger._perfName ??= `trigger: ${trigger.name}`, perfStart, 10 );
            }
            
        } );

        if ( entryMatched ) {
            let t = timestamp.getTime();
            parsedLogEntries[ t ] = parsedLogEntries[ t ]?.length > 0 ? parsedLogEntries[ t ] : [];
            parsedLogEntries[ t ].push( log );
        }

        // let endp = performance.now(); //p
        // let p = ( endp - startp ); //p

        // console.log( 'p', p, raw ); //p

    } catch ( error ) {
        logHistoryMgr.logError( error, raw, simulating, padTime, ErrorMessages.generalParsingError(), null );
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
 * @param {{instanceId?: string} | undefined} options
 */
function executeTriggerAction( trigger, action, timestamp, res, deltaTime, simulating, options ) {

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
    
        let instanceId = displayTimerCountdownComponent( res, timestamp, action, deltaTime, trigger, options );

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
        buffRegExs[ spellName ] = buffRegExs[ spellName ] ?? new RegExp( `^You begin casting ${spellName}\\.$`, 'mi' );
        rgx = buffRegExs[ spellName ];
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
    } else if ( action.actionType === ActionTypes.List ) {
        /* --== List Action ==-- */
        
        displayListAction( res, action, trigger );
    }
}










/**
 * Sends the list action to the renderer.
 * 
 * @param {PhraseParse} res The information from the parsed phrase.
 * @param {TriggerAction} action The screen glow action to render.
 * @param {Trigger} trigger The action trigger.
 */
function displayListAction( res, action, trigger ) {
    const trackName = StringUtilities.isNullOrWhitespace( action.listBoxName ) ? characterName : action.listBoxName;

    /**
     * Executes the "Show Timer" timer for a list.
     * 
     * @param {LogList} list The list to execute.
     * @param {number} duration The timer duration.
     */
    const executeListTimerAction = ( list, duration ) => {
        let subAct = new TriggerSubAction();
        subAct.actionId = list.action.listTimerActionId;
        
        // We need to create a new instance id for the timer.
        list.timerInstanceId = nagId();

        executeSubAction( {
            subAction: subAct,
            instanceId: list.instanceId,
        }, {
            duration: duration,
            instanceId: list.timerInstanceId,
        } );
    };

    if ( action.createListPhrases.includes( res.phraseId ) ) {

        // Create a new list.
        let list = lists.find( f => f.action.actionId === action.actionId ) ?? new LogList();

        if ( list.instanceId ) {
            ipcRenderer.send( 'overlay:destroy:component', list.instanceId );
            lists = lists.filter( f => f.instanceId !== list.instanceId );
            list.instanceId = null;
        }

        list.name = action.listName;
        list.instanceId = nagId();
        list.trigger = trigger;
        list.action = action;
        list.state = 'created';

        lists.push( list );
        
        list.component = new RendererComponent();
        list.component.instanceId = list.instanceId;
        list.component.triggerId = trigger.triggerId;
        list.component.action = action;
        list.component.matches = res.result;
        list.component.errorNames = [];
        list.component.successNames = [];
        list.component.warnNames = [];
        
        let listSource = '';
        if ( action.listRegexVarName ) {
            if ( res.result?.groups && res.result.groups[ action.listRegexVarName ] ) {
                listSource = res.result.groups[ action.listRegexVarName ];
            }

            if ( !listSource ) {
                throw new Error( 'Unable to execute list action. A list variable was specified, but not found in the log entry.' );
            }
        } else {
            // use the first capture group if no name is given.
            listSource = res.result[ 1 ] ?? '';

            if ( !listSource ) {
                throw new Error( 'Unable to execute list action. A list could not be generated with the log entry.' );
            }
        }

        list.component.listNames = listSource.split( /,/g ).map( s => s.trim() );

        if ( list.component.listNames == null || list.component.listNames.length === 0 ) {
            throw new Error( 'Unable to execute list action. No items were found in the list from the log entry.' );
        }

        if ( action.autoEnumerateListTimerName && res.result.groups[ action.autoEnumerateListTimerName ] ) {
            list.action.duration = StringUtilities.getDurationFromLabel( res.result.groups[ action.autoEnumerateListTimerName ] );
        }

        // Ensure the duration is at least numerical.
        list.action.duration = list.action.duration ? list.action.duration : 0;
        
        logInstanceIds.push( list.component.instanceId );

        let subRes = _.cloneDeep( res );
        subRes.result.groups = _.cloneDeep( res.result.groups );

        actionInstances[ list.component.instanceId ] = {
            trigger: trigger,
            res: subRes,
        };

        list.updateListFn = ( opts ) => {
            let now = Math.round( performance.now() );
            let currentIndex = 0;

            if ( opts?.actName ) {
                // With the act name provided, we only must cancel the timeout for the list and clear the css for the current name.
                if ( list.actionTrackIntervalId > 0 ) {
                    window.clearTimeout( list.actionTrackIntervalId );
                    list.actionTrackIntervalId = -1;
                }

                if ( list.component.errorNames.includes( opts.actName ) ) {
                    list.component.errorNames = list.component.errorNames.filter( f => f !== opts.actName );
                }

                if ( !list.component.successNames.includes( opts.actName ) ) {
                    list.component.successNames.push( opts.actName );
                }

                ipcRenderer.send( 'renderer:update:component', {
                    instanceId: list.component.instanceId,
                    updateType: 'list',
                    model: list.component,
                } );

                return;
            }

            if ( !opts?.setName ) {
                if ( list.component.currentName ) {
                    currentIndex = list.component.listNames.indexOf( list.component.currentName ) + 1;
                }

                if ( currentIndex >= list.component.listNames.length ) {
                    currentIndex = 0;
                }

                list.actedName = undefined;
            } else {
                currentIndex = list.component.listNames.findIndex( f => f === opts.setName ) ?? 0;
                list.timestamp = 0;
            }

            let changingCurrent = list.component.currentName !== list.component.listNames[ currentIndex ];
            list.component.currentName = list.component.listNames[ currentIndex ];

            if ( changingCurrent && list.action.autoEnumerateList ) {
                list.component.successNames = [];
                list.component.errorNames = [];
                list.component.warnNames = [];
            }

            if ( list.action.autoEnumerateList && list.component.currentName === trackName && !list.component.skipNames.includes( trackName ) ) {
                // Reduce the list by the number of skipped names.
                let skipCount = list.component.skipNames.length;
                let duration = list.action.duration * list.component.listNames.length;
                if ( skipCount > 0 ) {
                    duration -= ( skipCount * list.action.duration );
                }
                if ( duration > 0 ) {
                    executeListTimerAction( list, duration );
                }
            } else if ( list.action.autoEnumerateList && list.action.listTimerActionId ) {
                
                if ( list.timerInstanceId ) {
                    // Do nothing.
                } else {

                    let myIndex = list.component.listNames.indexOf( trackName );
                    let duration = list.action.duration;

                    if ( currentIndex < myIndex ) {
                        duration = duration * ( myIndex - currentIndex );
                    } else {
                        duration = duration * ( list.component.listNames.length - currentIndex + myIndex );
                    }

                    if ( duration > 0 ) {
                        executeListTimerAction( list, duration );
                    }
                }
            }

            if ( list.component.skipNames.includes( list.component.currentName ) ) {
                let skipIndex = list.component.skipNames.indexOf( list.component.currentName );
                list.component.skipNames.splice( skipIndex, 1 );
                list.updateListFn();
                return;

            } else if ( list.action.autoEnumerateList ) {
                ipcRenderer.send( 'overlay:send:component', list.component );

                if ( list.action.duration > 0 ) {
                    let duration = list.action.duration * 1000;

                    if ( list.timestamp === 0 ) {
                        list.timestamp = now;
                    } else {
                        // set timeout is often a few ms off, to account for this drifting over time we'll alter the timeout duration.
                        let expected = list.timestamp + duration;
                        let drift = now - expected;
                        duration = duration - drift;

                        // Now that we have our duration, we can set our timestamp, nudging it to account for drift.
                        list.timestamp = now - drift;
                    }
                    
                    if ( duration > 0 ) {
                        list.component.intervalId = window.setTimeout( () => {
                            list.updateListFn();
                        }, duration );
                        
                        if ( list.action.listEnableActionTracking ) {
                            let actDuration = Math.min( duration * 0.33, 1500 );
                            list.actionTrackIntervalId = window.setTimeout( () => {
                                if ( list.actedName !== list.component.currentName ) {
                                    
                                    if ( list.component.successNames.includes( list.component.currentName ) ) {
                                        list.component.successNames = list.component.successNames.filter( f => f !== list.component.currentName );
                                    }

                                    if ( !list.component.warnNames.includes( list.component.currentName ) ) {
                                        list.component.warnNames.push( list.component.currentName );
                                    }
                                    
                                    ipcRenderer.send( 'renderer:update:component', {
                                        instanceId: list.component.instanceId,
                                        updateType: 'list',
                                        model: list.component,
                                    } );
                                }
                            }, actDuration );
                        } else {
                            list.actionTrackIntervalId = -1;
                        }

                    } else {
                        list.updateListFn();
                    }

                } else {
                    throw new Error( 'Unable to execute list action. The duration for the list enumeration is not set and cannot auto enumerate.' );
                }
            } else {
                ipcRenderer.send( 'overlay:send:component', list.component );

                list.component.intervalId = -1;
            }

            if ( list.action.listEnableActionTracking && changingCurrent ) {
                const timer = list.action.listBottomTimerEnum ? 'bottom' : list.action.listTopTimerEnum ? 'top' : null;

                if ( timer ) {
                    ipcRenderer.send( 'renderer:reset:list-timer', { instanceId: list.component.instanceId, timers: timer } );
                    ipcRenderer.send( 'renderer:execute:list-timer', {
                        instanceId: list.component.instanceId,
                        name: list.component.listNames[ currentIndex ],
                        timer: timer,
                        duration: list.action.duration,
                    } );
                }
            }
        };
        
        ipcRenderer.send( 'overlay:send:component', list.component );

    } else if ( action.enableListEnrollment && action.listEnrollmentAddPhrase === res.phraseId ) {
        let list = lists.find( f => f.action.actionId === action.actionId );
        let addName = null;

        if ( !list ) {
            return;
        }

        if ( action.listEnrollmentAddVarName ) {
            addName = res.result.groups[ action.listEnrollmentAddVarName ];
            if ( res.result?.groups && addName ) {
                list.component.listNames.push( addName );
            } else {
                throw new Error( 'Unable to execute list action. The enrollment variable was not found in the log entry.' );
            }
        } else if ( res.result[ 1 ] ) {
            addName = res.result[ 1 ];
            list.component.listNames.push( addName );
        }

        ipcRenderer.send( 'renderer:update:component', {
            instanceId: list.component.instanceId,
            updateType: 'list',
            model: list.component,
        } );
        
        if ( list.action.listEnrollmentShowTimer && list.component.intervalId !== -1 ) {

            if ( list.timerInstanceId && list.component.listNames.includes( trackName ) ) {
                let currentIndex = list.component.listNames.indexOf( list.component.currentName );
                let myIndex = list.component.listNames.indexOf( trackName );

                if ( currentIndex < myIndex ) {
                    // Do nothing, we're already ahead of the new name.

                } else {
                    // We need to increase the time remaining on the timer, so
                    // we'll add the duration of the list to the timer's start 
                    // time.
                    ipcRenderer.send( 'renderer:update:component', {
                        instanceId: list.timerInstanceId,
                        updateType: 'alter-start',
                        duration: list.action.duration,
                    } );
                }
                
            } else if ( !list.timerInstanceId && addName === trackName ) {
                // If our name was added, we need to start the timer.
                let myIndex = list.component.listNames.indexOf( trackName );
                let now = Math.round( performance.now() );

                let duration = list.timestamp + ( myIndex * list.action.duration * 1000 ) - now;

                if ( duration > 0 ) {
                    executeListTimerAction( list, Math.round( duration / 1000 ) );
                }

            }

        }

    } else if ( action.enableListEnrollment && action.listEnrollmentRemovePhrase === res.phraseId ) {
        let list = lists.find( f => f.action.actionId === action.actionId );
        let removeName = null;
        let removedIndex = -1;

        if ( !list ) {
            return;
        }

        if ( action.listEnrollmentRemoveVarName ) {
            removeName = res.result.groups[ action.listEnrollmentRemoveVarName ];
            if ( res.result?.groups && removeName ) {
                removedIndex = list.component.listNames.indexOf( removeName );
                list.component.listNames = list.component.listNames.filter( f => f !== removeName );
            } else {
                throw new Error( 'Unable to execute list action. The removal variable was not found in the log entry.' );
            }
        } else {
            removeName = res.result[ 1 ];
            removedIndex = list.component.listNames.indexOf( removeName );
            list.component.listNames = list.component.listNames.filter( f => f !== removeName );
        }
        
        ipcRenderer.send( 'renderer:update:component', {
            instanceId: list.component.instanceId,
            updateType: 'list',
            model: list.component,
        } );

        if ( list.action.manualEnumerateList && removeName ) {
            // Manual enumeration does not have a mechanism that resets these lists, so we need to remove them when the name is removed.
            if ( list.component.errorNames.includes( removeName ) ) {
                list.component.errorNames = list.component.errorNames.filter( f => f !== removeName );
            }
            if ( list.component.successNames.includes( removeName ) ) {
                list.component.successNames = list.component.successNames.filter( f => f !== removeName );
            }
            if ( list.component.warnNames.includes( removeName ) ) {
                list.component.warnNames = list.component.warnNames.filter( f => f !== removeName );
            }
        }
        
        if ( list.action.listEnrollmentShowTimer && list.component.intervalId !== -1 ) {

            if ( list.timerInstanceId ) {
                if ( list.component.listNames.length === 0 || removeName === trackName ) {
                    // If the list is empty, then we'll stop the timer.
                    ipcRenderer.send( 'renderer:kill:component', list.timerInstanceId );
                    list.timerInstanceId = null;

                } else {
                    let currentIndex = list.component.listNames.indexOf( list.component.currentName );
                    let myIndex = list.component.listNames.indexOf( trackName );

                    if ( currentIndex >= myIndex && currentIndex <= removedIndex ) {
                        // If the current index is inclusively between mine and
                        // the removed name, then we'll need to adjust the timer.

                        // We need to reduce the time remaining on the timer, so we'll
                        // subtract the duration of the list from the timer's start 
                        // time. That will reduce the time remaining on the timer by 
                        // one iteration of the list.
                        ipcRenderer.send( 'renderer:update:component', {
                            instanceId: list.timerInstanceId,
                            updateType: 'alter-start',
                            duration: -1 * list.action.duration,
                        } );
                    }

                }
            }

        }

    } else if ( action.enableListEnrollment && action.listEnrollmentSkipPhrase === res.phraseId ) {
        let list = lists.find( f => f.action.actionId === action.actionId );

        if ( !list ) {
            return;
        }

        let skipName = '';

        if ( action.listEnrollmentSkipVarName ) {
            if ( res.result?.groups && res.result.groups[ action.listEnrollmentSkipVarName ] ) {
                skipName = res.result.groups[ action.listEnrollmentSkipVarName ];
            } else {
                throw new Error( 'Unable to execute list action. The skip variable was not found in the log entry.' );
            }
        } else {
            skipName = res.result[ 1 ];
        }

        if ( !skipName ) {
            throw new Error( 'Unable to execute list action. The skip name was not found in the log entry.' );
        }

        list.component.skipNames = list.component.skipNames?.length > 0 ? [ ...list.component.skipNames, skipName ] : [ skipName ];
        
        ipcRenderer.send( 'renderer:update:component', {
            instanceId: list.component.instanceId,
            updateType: 'list',
            model: list.component,
        } );

        if ( list.action.listEnrollmentShowTimer && list.component.intervalId !== -1 ) {
            let currentIndex = list.component.listNames.indexOf( list.component.currentName );
            let myIndex = list.component.listNames.indexOf( trackName );

            if ( list.timerInstanceId ) {
                if ( skipName === trackName ) {
                    // If we're skipping ourselves, then we need to kill the current timer and start a new one. The duration of this new timer will be a full round, minus our time.
                    ipcRenderer.send( 'renderer:kill:component', list.timerInstanceId );
                    list.timerInstanceId = null;

                    let count = list.component.skipNames.filter( f => f === trackName ).length;
                    let duration = list.action.duration * list.component.listNames.length - list.action.duration;

                    if ( currentIndex < myIndex ) {
                        // If we're ahead of the current name, then we'll need to add a duration matching the number of names ahead of us.
                        duration += list.action.duration * ( myIndex - currentIndex );
                    } else if ( currentIndex >= myIndex ) {
                        // If we're behind the current name, then we'll need to add a duration matching the number of names ahead of us.
                        duration += list.action.duration * ( list.component.listNames.length - currentIndex + myIndex );
                    }

                    // // If our name was added, we need to start the timer.
                    // let myIndex = list.component.listNames.indexOf( trackName );
                    let now = Math.round( performance.now() );
    
                    duration += ( list.timestamp - now ) / 1000;

                    if ( count > 1 ) {
                        duration += list.action.duration * ( count - 1 ) * ( list.component.listNames.length - 1 );
                    }

                    if ( duration > 0 ) {
                        executeListTimerAction( list, duration );
                    }

                } else {

                    // We need to reduce the time remaining on the timer, so we'll
                    // subtract the duration of the list from the timer's start 
                    // time. That will reduce the time remaining on the timer by 
                    // one iteration of the list.
                    ipcRenderer.send( 'renderer:update:component', {
                        instanceId: list.timerInstanceId,
                        updateType: 'alter-start',
                        duration: -1 * list.action.duration,
                    } );

                }
            }

        }

    } else if ( action.autoEnumerateList && action.listEnumerateBeginPhrase === res.phraseId ) {
        let list = lists.find( f => f.action.actionId === action.actionId );

        if ( !list ) {
            return;
        } else if ( list.state === 'running' ) {
            if ( list.component.intervalId === -1 ) {
                list.timestamp = 0;
                list.updateListFn();
            }
        } else {
            list.state = 'running';
        }

    } else if ( action.listEnumerateEndPhrase === res.phraseId ) {
        let list = lists.find( f => f.action.actionId === action.actionId );

        if ( !list ) {
            return;
        }

        list.state = 'stopped';

        if ( action.autoEnumerateList && list.component.intervalId !== -1 ) {
            window.clearTimeout( list.component.intervalId );
            list.component.intervalId = -1;

            list.component.currentName = undefined;

            ipcRenderer.send( 'overlay:send:component', list.component );

            // If there's a timer, destroy that as well.
            if ( list.timerInstanceId ) {
                ipcRenderer.send( 'renderer:kill:component', list.timerInstanceId );
            }
            
        } else {
            // If the list is already stopped, then we'll delete the list.
            ipcRenderer.send( 'overlay:destroy:component', list.instanceId );

            lists = lists.filter( f => f.instanceId !== list.instanceId );
        }

        if ( action.autoEnumerateList ) {
            const timer = list.action.listEnableBottomTimer && list.action.listEnableTopTimer ? 'both' : list.action.listEnableBottomTimer ? 'bottom' : list.action.listEnableTopTimer ? 'top' : null;

            if ( timer ) {
                ipcRenderer.send( 'renderer:reset:list-timer', { instanceId: list.component.instanceId, timers: timer } );
            }
        }

    } else if ( action.manualEnumerateList && action.listManualEnumeratePhrase === res.phraseId ) {
        let list = lists.find( f => f.action.actionId === action.actionId );

        if ( !list ) {
            return;
        }

        if ( list.component.intervalId !== -1 ) {
            window.clearTimeout( list.component.intervalId );
            list.component.intervalId = -1;
        }

        if ( res.result?.groups && res.result.groups[ nagListNameKey ] ) {
            list.updateListFn( { setName: getCharacterName( res.result.groups[ nagListNameKey ], characterName ) } );
        } else {
            list.updateListFn();
        }
    }
    
    if ( action.listEnrollmentDeactivatePhrase === res.phraseId ) {
        // Deactivate the item.
        let list = lists.find( f => f.action.actionId === action.actionId );

        if ( !list ) {
            return;
        }

        if ( res.result?.groups && res.result.groups[ nagListNameKey ] ) {
            const name = getCharacterName( res.result.groups[ nagListNameKey ], characterName );
                
            list.component.errorNames = list.component.errorNames?.length > 0 ? list.component.errorNames : [];

            if ( !list.component.errorNames.includes( name ) ) {
                
                list.component.errorNames.push( name );
            
                ipcRenderer.send( 'renderer:update:component', {
                    instanceId: list.component.instanceId,
                    updateType: 'list',
                    model: list.component,
                } );

                const index = list.component.listNames.indexOf( name );

                if ( index > -1 ) {
                    if ( action.listTopTimerClearOnDeactivate ) {
                        // Clear the top timer.
                        ipcRenderer.send( 'renderer:kill:list-timer', { instanceId: list.component.instanceId, timers: 'top', index: index } );
                    }

                    if ( action.listBottomTimerClearOnDeactivate ) {
                        // Clear the bottom timer
                        ipcRenderer.send( 'renderer:kill:list-timer', { instanceId: list.component.instanceId, timers: 'bottom', index: index } );
                    }
                }
            }

        }

    }
    
    if ( action.listEnrollmentActivatePhrase === res.phraseId ) {
        // Activate the item.
        let list = lists.find( f => f.action.actionId === action.actionId );

        if ( !list ) {
            return;
        }

        if ( res.result?.groups && res.result.groups[ nagListNameKey ] ) {
            const name = getCharacterName( res.result.groups[ nagListNameKey ], characterName );
            
            list.component.errorNames = list.component.errorNames?.length > 0 ? list.component.errorNames : [];

            if ( list.component.errorNames.includes( name ) ) {
    
                list.component.errorNames = list.component.errorNames.filter( f => f !== name );
    
                ipcRenderer.send( 'renderer:update:component', {
                    instanceId: list.component.instanceId,
                    updateType: 'list',
                    model: list.component,
                } );
            }

        }
    }
    
    if ( action.listTopTimerPhrase?.includes( res.phraseId ) ) {
        let list = lists.find( f => f.action.actionId === action.actionId );

        if ( !list ) {
            return;
        }

        const actName = getCharacterName( res.result.groups[ nagListNameKey ], characterName );

        ipcRenderer.send( 'renderer:execute:list-timer', {
            instanceId: list.component.instanceId,
            name: actName,
            timer: 'top',
            duration: action.listTopTimerDuration,
        } );

    }
    
    if ( action.listBottomTimerPhrase?.includes( res.phraseId ) ) {
        let list = lists.find( f => f.action.actionId === action.actionId );

        if ( !list ) {
            return;
        }

        const actName = getCharacterName( res.result.groups[ nagListNameKey ], characterName );

        ipcRenderer.send( 'renderer:execute:list-timer', {
            instanceId: list.component.instanceId,
            name: actName,
            timer: 'bottom',
            duration: action.listBottomTimerDuration,
        } );
        
    }

    // This really needs to mutate the current name of the list, like the skip operation does.
    if ( action.listActionTrackingPhrase.includes( res.phraseId ) ) {
        let list = lists.find( f => f.action.actionId === action.actionId );

        if ( !list ) {
            return;
        } else if ( list.state !== 'running' ) {
            return;
        }

        if ( res.result?.groups && res.result.groups[ nagListNameKey ] ) {
            const actName = getCharacterName( res.result.groups[ nagListNameKey ], characterName );

            if ( list.component.currentName === actName ) {
                // This is the expected character doing their action at the expected time.
                list.actedName = actName;
                list.updateListFn( { actName: actName } );

            } else {
                // If the acted name is not the current name, then we must mutate the list so that the current name is now the acted name.
                // Because we are changing the current index, first we need to cancel the timer, if there is one.
                if ( list.timerInstanceId ) {
                    ipcRenderer.send( 'renderer:kill:component', list.timerInstanceId );
                    list.timerInstanceId = null;
                }

                if ( list.component.intervalId > -1 ) {
                    window.clearTimeout( list.component.intervalId );
                    list.component.intervalId = -1;
                }

                list.actedName = actName;
                list.updateListFn( { setName: actName } );

                // Since we aren't going to re-evaluate this command, we'll immediately follow this up with the act name to send the good css to the renderer.
                list.updateListFn( { actName: actName } );

            }
        }
    }
}










/**
 * Sends the command to the render to clear all overlay components.  Restarts all counters.
 */
function clearAll() {

    for ( const key of Object.keys( counters ) ) {
        counters[ key ].value = 0;
    }

    // storedVariableHash = {};
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
        fileMonitor.stopMonitoringLogFile().then( position => {
            backfind().then( () => startParsingLogFile( logFilePath, position >= 0 ? position : null ) );
        } );
    }, logParseTimer );

    for ( let i = 0; i < lists.length; i++ ) {
        const list = lists[ i ];

        if ( list.component.intervalId !== -1 ) {
            window.clearTimeout( list.component.intervalId );
            list.component.intervalId = -1;
        }
        
        if ( list.instanceId ) {
            ipcRenderer.send( 'overlay:destroy:component', list.instanceId );
        }
    }
    lists = [];

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
        /** @type {RegExp[]} */
        let renderedRegExs = [];

        cancellableComponents.push( {
            _parse: ( logEntry ) => {
                let matched = false;
                
                renderedPhrases.forEach( ( phrase, i ) => {
                    renderedRegExs[ i ] = renderedRegExs[ i ] ?? new RegExp( phrase, getPhraseRegexOptions( comp.action.endEarlyPhrases[ i ] ) );
                    let _res = renderedRegExs[ i ].exec( logEntry );
                    if ( _res?.length > 0 ) {
                        enableLogging && sendInformationToLog( `DoT Timer ended early: [${logEntry}]` );
                        matched = true;
                        
                        logHistoryMgr.addSuccessfulTriggerParsedEvent(
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
                exclude = res.result[ 1 ].match( new RegExp( action.excludeTargets[ i ].phrase, getPhraseRegexOptions( action.excludeTargets[ i ] ) ) )?.length > 0;
            } else {
                let _rgx = new RegExp( '^' + action.excludeTargets[ i ].phrase.replace( /[.*+?^${}()|[\]\\]/g, '\\$&' ) + '$', 'i' );
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
        /** @type {RegExp[]} */
        let renderedRegExs = [];

        cancellableComponents.push( {
            _parse: ( logEntry ) => {
                let matched = false;
                
                renderedPhrases.forEach( ( phrase, i ) => {
                    renderedRegExs[ i ] = renderedRegExs[ i ] ?? new RegExp( phrase, getPhraseRegexOptions( comp.action.endEarlyPhrases[ i ] ) );
                    let _res = renderedRegExs[ i ].exec( logEntry );
                    if ( _res?.length > 0 ) {
                        enableLogging && sendInformationToLog( `DoT Timer ended early: [${logEntry}]` );
                        matched = true;
                        
                        logHistoryMgr.addSuccessfulTriggerParsedEvent(
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

                return matched;
            },
            instanceId: comp.instanceId
        } );
    }

    if ( comp.action.secondaryPhrases?.length > 0 ) {
        let phrases = trigger.capturePhrases.filter( f => comp.action.secondaryPhrases.indexOf( f.phraseId ) > -1 );
        let renderedPhrases = renderPhrases( phrases, trigger._conditionResults, res.result, deltaTime, true );
        /** @type {RegExp[]} */
        let renderedRegExs = [];

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
                    renderedRegExs[ i ] = renderedRegExs[ i ] ?? new RegExp( phrase, getPhraseRegexOptions( phrases[ i ] ) );
                    let _res = renderedRegExs[ i ].exec( logEntry );
                    if ( _res?.length > 0 ) {
                        enableLogging && sendInformationToLog( `DoT Timer secondary action: [${logEntry}]` );
                        matched = true;
                        
                        logHistoryMgr.addSuccessfulTriggerParsedEvent(
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
        wornOffPhrase.ignoreCase = true;
        wornOffPhrase.phraseId = nanoid();
        let renderedWornOffPhrases = renderPhrases( [ wornOffPhrase ], trigger._conditionResults, res.result, deltaTime, true );
        /** @type {RegExp[]} */
        let renderedWornOffRegExs = [];
        
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
                    renderedWornOffRegExs[ i ] = renderedWornOffRegExs[ i ] ?? new RegExp( phrase, getPhraseRegexOptions( wornOffPhrase ) );
                    let _res = renderedWornOffRegExs[ i ].exec( logEntry );
                    if ( _res?.length > 0 ) {
                        enableLogging && sendInformationToLog( `DoT Timer worn off: [${logEntry}]` );
                        
                        logHistoryMgr.addSuccessfulTriggerParsedEvent(
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
 * @param {{instanceId?: string} | undefined} options
 * 
 * @return {string} Returns the instance id of the renderer component
 */
function displayTimerCountdownComponent(res, timestamp, action, deltaTime, trigger, options) {
      
    // ${target} has been slain by (.+?)!
    let comp = new OverlayComponent();

    comp.instanceId = options?.instanceId ?? nagId();
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

    if ( comp.action.duration > 0 || comp.action.actionType === ActionTypes.Stopwatch ) {
        // Timers with zero duration are non-sensical, or "undefined" if you like.
        ipcRenderer.send( 'overlay:send:component', comp );

        if ( comp.action.endEarlyPhrases?.length > 0 ) {
            let renderedPhrases = renderPhrases( comp.action.endEarlyPhrases, trigger._conditionResults, res.result, deltaTime );
            /** @type {RegExp[]} */
            let renderedRegExs = [];

            cancellableComponents.push( {
                _parse: ( logEntry ) => {
                    let matched = false;

                    for ( let i = 0; i < renderedPhrases.length; i++ ) {
                        const phrase = renderedPhrases[ i ];
                        renderedRegExs[ i ] = renderedRegExs[ i ] ?? new RegExp( phrase, getPhraseRegexOptions( comp.action.endEarlyPhrases[ i ] ) );
                        let _res = renderedRegExs[ i ].exec( logEntry );
                        if ( _res?.length > 0 ) {
                            enableLogging && sendInformationToLog( `Timer/Countdown/Stopwatch ended early: [${logEntry}]` );
                            matched = true;
                        
                            logHistoryMgr.addSuccessfulTriggerParsedEvent(
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

                    return matched;
                },
                instanceId: comp.instanceId
            } );
        }
    } else {
        log( 'Timer/Countdown with zero duration will not be rendered.', comp.action );
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
    
    if ( storedVariables[ key ]?.length > 0 && value?.length > 0 ) {
        if ( value instanceof Array ) {
            let values = value.map( v => v.toLowerCase() );
            for ( let i = 0; i < storedVariables[ key ].length; i++ ) {
                for ( let v = 0; v < values.length; v++ ) {
                    if ( storedVariables[ key ][ i ].toLowerCase().indexOf( values[ v ] ) > -1 ) {
                        return { exists: true, value: storedVariables[ key ][ i ] };
                    }
                }
            }
        } else {
            let v = value.toLowerCase();
            for ( let i = 0; i < storedVariables[ key ].length; i++ ) {
                if ( storedVariables[ key ][ i ].toLowerCase().indexOf( v ) > -1 ) {
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
        
    } else if ( !simulating ) {
        nagException( { label: 'Speech Synthesis', message: phrase == null ? 'No phrase to speak' : 'No voice selected.', payload: { phrase: phrase, interrupt: interrupt, speakNext: speakNext, conditionResults: conditionResults, simulating: simulating, parseResult: parseResult, timerDuration: timerDuration, deltaTime: deltaTime, volume: volume, rate: rate } } );

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
    let percent = timerDuration * 1000 >= durationLimit ? wornFocus + aaFocus : wornFocus;
    let charClassData = _.find( triggerClasses, ccl => ccl.class === charModel.class );

    if ( charClassData != null && charClassData.level > characterModel.beneficialCastingSpeedFocusDecayLevel ) {
        let decayPercent = ( charClassData.level - characterModel.beneficialCastingSpeedFocusDecayLevel ) * 5;
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
 */
async function backfind() {

    if ( fileMonitor == null )
        throw new Error( 'File monitor is not initialized.' );

    let _triggers = triggers.filter( t => t.actions?.some( a => a.loopBackForValue === true ) );

    let valueExists = ( variableName ) => {
        return storedVariables[ variableName ] instanceof Array ? storedVariables[ variableName ].length > 0 : !!storedVariables[ variableName ];
    }

    /**
     * Returns true if there is a trigger requiring loopback and still missing a value.
     */
    const valuesMissing = () => {
        for ( let ti = 0; ti < _triggers?.length ?? 0; ti++ ) {
            for ( let ai = 0; ai < _triggers[ ti ].actions?.length ?? 0; ai++ ) {
                let variableName = _triggers[ ti ].actions[ ai ].variableName;
                if ( variableName && !valueExists( variableName ) ) {
                    return true;
                }
            }
        }

        return false;
    }

    await fileMonitor.backfind( lines => {
        if ( lines?.length > 1 ) {
            for ( let i = lines.length - 1; i > 0; i-- ) {
                
                if ( !valuesMissing() )
                    // If all values are found, stop looking.
                    return false;

                // Check for a valid timestamp in the line.
                let log = lines[ i ]?.replace( /^\[(.*?)\]\s*/gi, '' );

                if ( log ) {
                    try {
                        _triggers.forEach( trigger => {
                            trigger._parse( log, res => {
                                trigger.actions.forEach( action => {
                                    if ( action.phrases?.indexOf( res.phraseId ) > -1 && action.actionType === ActionTypes.StoreVariable ) {
                                        /* --== Store Variable ==-- */

                                        if ( action.loopBackForValue && action.variableName && !valueExists( action.variableName ) ) {

                                            const v = res.result.length === 1 ? res.result[ 0 ] : res.result[ 1 ];
                                            saveVariable( action.variableName, v, action.onlyStoreUsedValues );
            
                                            logHistoryMgr.addSuccessfulTriggerParsedEvent(
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
            }
        }

        return valuesMissing();
    } );
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

    let message = new IpcMessage( { logFilePath: charModel.logFile, characterName: characterName, serverName: charModel.server } );
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
