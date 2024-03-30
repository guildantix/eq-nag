
// Testing

// Notes:
// If you set initiator as true, then when you create the Peer a signal will be emitted within roughly 80ms.  This "signal" is special, and begins the process.
// The receiving peer will use p.signal(...) and then that peer will emit a "signal".  This signal will need to be entered into the initiating peer's p.signal(...) method.

// "Chat room" is labeled a chat room for the purposes of Nag clients connecting
// to each other.  It's the clients that are chatting, not the users.

// steps
// 1. User creates a new chat room, and receive a chat room id and their peer id.
// 2. User then puts a tag in /raid/guild/say/whatever {NAG:p2p/abcd1234}
// 3. User waits for other users to connect to the chat room.
// 4. New users start by clicking a UI button to join the chat room, Nag will join them to the
//    chat room and they will receive a peer id.
//      i. Allow users to block specific users chat room invites, as well as
//         block all chat room invites.
// 5. New user will receive a list of all peer ids in the chat room.
// 6. New user will create a single Peer for each peer id, as an initiator, and then send their
//    offer to the chat room attached to their peer id and the recipient peer id.
// 7. Any users already in the chat room will create a new Peer and signal the new user's offer.
// 8. Each peer will be responsible for sending their own messages/data to the other peers.

// Troubleshooting
//  1. If a peer is unable to connect, delete the peer, create a new one as the initiator,
//     and send the signal to the other peer.

// const p = new Peer( {
//     initiator: location.hash === '#1',
//     trickle: false
// } );

// p.on( 'error', err => console.log( 'error', err ) );

// p.on( 'signal', data => {
//     console.log( 'SIGNAL', JSON.stringify( data ) )
//     document.querySelector( '#outgoing' ).textContent = JSON.stringify( data )
// } );

// document.querySelector( 'form' ).addEventListener( 'submit', ev => {
//     ev.preventDefault()
//     p.signal( JSON.parse( document.querySelector( '#incoming' ).value ) )
// } );

// p.on( 'connect', () => {
//     console.log( 'CONNECT' )
//     p.send( 'whatever' + Math.random() )
// } );

// p.on( 'data', data => {
//     console.log( 'data: ' + data )
// } );

const { CharacterModel } = require( "../data/models/character" );
const { ipcRenderer, ipcMain } = require( 'electron' );
const { DpsMeterSettings } = require( "../data/models/combat-parser" );
const { OverlayWindow } = require( "../data/models/overlay-window" );
const { ErrorMessages, TriggerParseHistoryModel, getActionLabel, LogTypes } = require( "../data/models/trigger" );
const { CombatParser } = require( "../utilities/combat-parser" );
const { TakpCombatParser } = require( "../utilities/combat-parser-takp" );
const customAlphabet = require( 'nanoid' ).customAlphabet;
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const nanoid = customAlphabet( alphabet, 16 );
const fs = require( 'fs' );
const { LogSync, createChatRoomLink, parseChatRoomLink } = require( "../utilities/peer-to-peer" );
const { nagException, nagLog } = require( "../utilities/nag-console" );
const chunkSize = 512 * 1024;

/** @type {CharacterModel} */
let charModel = null;
/** @type {string} */
let characterName = null;
/** @type {string} */
let characterId = null;
/** @type {number} */
let dpsIntervalId = null;
/** @type {number} */
const dpsInterval = 250;
/** @type {boolean} */
const enableDpsTransmit = false; // TODO: Enable transmission of DPS to the api for log event synchronization.
/** @type {number} */
let dpsTransmitIntervalId = null;
/** @type {number} */
const dpsTransmitIntervalMs = 12 * 1000;
/** @type {DpsMeterSettings} */
let dpsMeterSettings = new DpsMeterSettings();

/** @type {boolean} */
let backupStarted = false;

/** @type {string} */
let logFilePath = null;
/** @type {number} */
let logParseTimeoutId = null;
const logParseTimer = 50;
/** @type {boolean} */
let changingLogFile = false;

/** @type {number} */
let currentPosition = null;
let watcher = null;
let enableFct = false;
let isDev = false;
/** @type {OverlayWindow} */
let overlays = [];
/** @type {LogSync | null} */
let logSync = null;

/**
 * Sends the error information to the main thread for logging.
 * 
 * @param {any} err The error object.
 * @param {string} raw The log entry currently processing.
 * @param {boolean} simulating True if we're simulating a log file.
 * @param {number} padTime The number of seconds to add to log time.
 */
const logParseError = ( err, raw, simulating, padTime ) => {
    if ( raw ) {
        nagException( {
            source: 'combat-watcher.js',
            error: err,
            logEntry: raw,
            simulating: simulating === true,
            padTime: padTime === undefined ? 'undefined' :
                padTime === null ? 'null' :
                    padTime,
        } );
    } else {
        nagException( err );
    }

    // TODO: Implement generic errors shown in console.
};










/**
 * Sends the error information to the main thread for logging.
 * 
 * @param {any} err The error object.
 * @param {string} raw The log entry currently processing.
 * @param {boolean} simulating True if we're simulating a log file.
 * @param {number} padTime The number of seconds to add to log time.
 */
const logError = ( err, raw, simulating, padTime ) => {
    logParseError( err, raw, simulating, padTime );
};

/** @type {CombatParser | TakpCombatParser | undefined} */
let myCombatParser = undefined;

/** @type {string[]} */
let myCombatParserCache = [];

const sendDpsToRenderer = () => {
    // This is currently a really simple version of DPS tracking.  What we need to do is capture the start/end of each players combat and then calculate the DPS based on that.  In addition to what we're doing now, which is their immediate DPS not encounter DPS.
    let encounterDps = myCombatParser?.getEncounterOutgoingDps() ?? [];
    ipcRenderer.send( 'renderer:encounter-dps', { character: characterName, encounterDps: encounterDps } );
};

const transmitEncounterEvents = () => {
    let fullEncounterEvents = myCombatParser?.getMyCharacterEncounterEvents( true ) ?? [];
    let minifiedEncounterEvents = myCombatParser?.getMinifiedEncounterEvents( fullEncounterEvents ) ?? [];

    // TODO: This should really be done in the combat parser.
    fullEncounterEvents?.forEach( e => e.transmitted = true );

    // TODO: Actually transmit the events.
}

const dpsTransmitFn = () => {
    transmitEncounterEvents();

    dpsTransmitIntervalId = window.setTimeout( () => dpsTransmitFn(), dpsTransmitIntervalMs );
}

const dpsIntervalFn = () => {
    sendDpsToRenderer();

    dpsIntervalId = window.setTimeout( () => dpsIntervalFn(), dpsInterval );
}

const startDpsTracking = () => {
    if ( !dpsIntervalId ) {
        dpsIntervalId = window.setTimeout( () => dpsIntervalFn(), dpsInterval );
        enableDpsTransmit && ( dpsTransmitIntervalId = window.setTimeout( () => dpsTransmitFn(), dpsTransmitIntervalMs ) );
    }
};

/**
 * Executes when the encounter is reset.
 * 
 * @param {LogRecord[]} encounterEvents The events from the encounter.
 */
const onEncounterReset = ( encounterEvents ) => {
    ipcRenderer.send( 'renderer:encounter-reset', { character: characterName } );
}

const stopDpsTracking = () => {
    if ( dpsIntervalId ) {
        window.clearTimeout( dpsIntervalId );
        dpsIntervalId = null;
        window.clearTimeout( dpsTransmitIntervalId );
        dpsTransmitIntervalId = null;
    }
};

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
        backupStarted = false;
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
    var danglyBit = '';

    fs.open( logPath, 'r', function ( err, fd ) {

        if ( fd ) {
            var file = fd;
            if ( startLogPosition != null && startLogPosition >= 0 ) {
                currentPosition = startLogPosition;
                startLogPosition = null;
            }
            currentPosition = currentPosition === null ? fs.fstatSync( file ).size : currentPosition;
            function parseLogFile() {

                if ( !fs.existsSync( logPath ) || backupStarted ) {
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
                    let dangling = !read.endsWith( '\r\n' );
                    let lines = (danglyBit + read).split( /\r\n|\r|\n/gmi );
                
                    if ( dangling ) {
                        danglyBit = lines.splice( lines.length - 1, 1 )[ 0 ];
                    } else {
                        danglyBit = '';
                    }

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

function parseLogEntries( raw, simulating, padTime ) {
    try {
        
        simulating = simulating === true ? true : false;

        // This could be optimized better.
        // TODO: This should be checked in the bootstrap.
        if ( myCombatParser?.loaded && (dpsMeterSettings.show || enableFct) ) {
            
            if ( myCombatParserCache?.length > 0 ) {
                // Add cached log entries to the combat tracker.
                myCombatParserCache.forEach( c => {
                    let fctModel = myCombatParser?.addCombatEvent( c );

                    if ( fctModel && enableFct ) {
                        ipcRenderer.send( 'overlay:send:fct-component', fctModel );
                    }
                } );
                myCombatParserCache = [];
            }

            // Add to the combat tracker.
            let fctModel = myCombatParser?.addCombatEvent( raw );

            if ( fctModel && enableFct ) {
                ipcRenderer.send( 'overlay:send:fct-component', fctModel );
            }

        } else if ( (dpsMeterSettings.show || enableFct) ) {

            // Add to the combat tracker cache.
            myCombatParserCache.push( raw );

        }

    } catch ( error ) {
        logError( error, raw, simulating, padTime );
    }
}

/**
 * Initializes the combat watcher.
 * 
 * @param {CharacterModel} character The character details.
 * @param {number} logPosition The starting log position.
 */
function CombatWatcher( character, logPosition ) {

    if ( character ) {
        characterName = character.name;
        charModel = character;
        characterId = character.characterId;

        myCombatParser = charModel.takp ? new TakpCombatParser( characterName, character.server ) : new CombatParser( characterName, character.server );
        myCombatParser.onEncounterReset = onEncounterReset;
        startDpsTracking();

    } else {
        throw new Error( 'Character model is required.' );

    }

    ipcRenderer
        .invoke( 'settings:get', { key: 'dpsMeterSettings', subscribe: true } )
        .then( data => {
            dpsMeterSettings = data ?? new DpsMeterSettings();
        } );
    
    ipcRenderer.on( 'log:combat:unload', async () => {

        if ( logSync != null ) {
            await logSync.dispose();
            cleanUpChatRoom();
            logSync = null;
        }

        ipcRenderer.send( 'log:combat:unloaded', null );

    } );
    
    ipcRenderer.on( 'log:leave-chat-room', async ( event, data ) => {
        if ( logSync != null ) {
            await logSync.dispose();
            cleanUpChatRoom();
            nagLog( `Left chat room ${logSync.chatRoomId}.` );
            logSync = null;

        } else {
            nagException( 'Not in a chat room.' );

        }
    } );
    
    ipcRenderer.on( 'log:start-chat-room', async ( event, data ) => {
        try {
            logSync = new LogSync();
        
            await logSync.initialize();
            let success = await logSync.createChatRoom();
    
            if ( success ) {
                let link = createChatRoomLink( logSync.chatRoomId );

                nagLog( `Chat room created: ${link}, my peer id: ${logSync.peerId}` );
                nagException( {
                    source: 'combat-watcher.js',
                    error: new Error( 'Chat room created' ),
                    logEntry: 'This is a test of the thing as a log entry.',
                    simulating: false,
                    padTime: 0,
                } );

                processChatRoom();

            } else {
                throw new Error( 'Failed to create chat room.' );
    
            }

        } catch ( error ) {
            logError( error, 'Failed to create chat room', false, 0 );

        }
    } );

    ipcRenderer.on( 'log:join-chat-room', async ( event, data ) => {
        try {
            logSync = new LogSync();

            await logSync.initialize();
            let linkId = parseChatRoomLink( data );
            let success = await logSync.joinChatRoom( linkId );

            if ( success ) {
                nagLog( `Joined chat room: ${data}, my peer id: ${logSync.peerId}` );

                processChatRoom();

            } else {
                throw new Error( 'Failed to create chat room.' );
    
            }

        } catch ( error ) {
            logError( error, 'Faile to join chat room', false, 0 );

        }
    } );
    
    ipcRenderer.on( 'settings:get:dpsMeterSettings:generic',
        /**
         * 
         * @param {Electron.IpcRendererEvent} event The event args
         * @param {boolean} data True if enabled.
         */
        ( event, data ) => {
            dpsMeterSettings = data ?? new DpsMeterSettings();
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

            if ( logParseTimeoutId > 0 ) {
                window.clearTimeout( logParseTimeoutId );
                currentPosition = null;
                startParsingLogFile( data, logPosition >= 0 ? logPosition : null );

            } else {
                // If there is not a timeout id, then we're in the middle of
                // processing a chunk of log file entries, let's give a 
                // millisecond for that to complete.
                changingLogFile = true;
                window.setTimeout( () => {
                    changingLogFile = false;
                    currentPosition = null;
                    startParsingLogFile( data, logPosition >= 0 ? logPosition : null );
                }, logParseTimer );
            }

            if ( watcher != null ) {
                watcher.close();
            }
        
        } );

    ipcRenderer.on( 'log:simulate:file', function ( event, data ) {
        throw new Error( 'Not implemented' );
    } );
    
    // TODO: Enable simulation for combat watcher.
    // ipcRenderer.on( 'log:simulate:begin', function ( event, data ) {});

    ipcRenderer.on( 'tick', function ( event, data ) {

        enableFct = data.enableFct;
        isDev = data.isDev;
        charModel = data.characterModel ? data.characterModel : charModel;
        overlays = data.overlays;

    } );

}

/** @type {number | null} */
let chatRoomIntervalId = null;

let processChatRoom = async () => {
    if ( logSync != null ) {
        let data = logSync.flushData();

        for ( var peerId in data ) {
            let messages = data[ peerId ];

            messages.forEach( m => {
                if ( m.type === 'message' ) {
                    nagLog( {
                        label: 'Chat Room',
                        message: m.message,
                        payload: m,
                    } );
                } else if ( m.type === 'combatStatistics' ) {
                    // TODO: Implement combat statistics importing.
                    nagLog( `Received combat statistics from ${peerId}` );
                    nagException( `(combat-watcher.js) Not implemented yet!` );
                }
            } );
        }

        chatRoomIntervalId = window.setTimeout( async () => await processChatRoom(), dpsTransmitIntervalMs );
    }
}

function cleanUpChatRoom() {
    if ( chatRoomIntervalId > 0 ) {
        window.clearTimeout( chatRoomIntervalId );
        chatRoomIntervalId = null;
    }
}

module.exports = CombatWatcher;