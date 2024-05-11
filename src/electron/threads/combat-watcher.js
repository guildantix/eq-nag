
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

// TODO: Synchronize encounters between peers.  Keep encounters active while other peers are sending synchronization data.
//          We could send an "encounter ended" message to all peers when the encounter is over, and only end the encounter when all peers have responded with their own ended event.
//          If an encounter is kicked up again with the same NPCs as the previous encounter, then we can merge the encounters together.
//          ! We can keep a map of peer encounter ids mapped to my encounter id, allowing any peer to continue submitting data to an encounter I have closed.

// TODO: Keep log watcher active while connected to a chat room.
// TODO: Move the peer to peer stuff into a thread, maybe? Damnit, yes.

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
const { DpsMeterSettings, LogRecord, EncounterResetEventArgs, EncounterModel, ExternalEncounterModel } = require( "../data/models/combat-parser" );
const { OverlayWindow } = require( "../data/models/overlay-window" );
const { ErrorMessages, TriggerParseHistoryModel, getActionLabel, LogTypes } = require( "../data/models/trigger" );
const { CombatParser, minifyCombatLogs } = require( "../utilities/combat-parser" );
const { TakpCombatParser } = require( "../utilities/combat-parser-takp" );
const customAlphabet = require( 'nanoid' ).customAlphabet;
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const nanoid = customAlphabet( alphabet, 16 );
const fs = require( 'fs' );
const { LogSync, createChatRoomLink, parseChatRoomLink, PeerDataPackageModel, CombatStatisticsPayloadModel, CombatEncounterPayloadModel, HandshakePayloadModel } = require( "../utilities/peer-to-peer" );
const { nagException, nagLog } = require( "../utilities/nag-console" );
const FileMonitor = require( "../utilities/file-monitor" );

/**
 * Sends to the main thread to log the message.
 * 
 * @param {string} message The message to log.
 * @param {any | undefined} payload The payload to log.
 */
const log = ( message, payload ) => {
    nagLog( {
        label: 'Chat Room',
        message: message,
        payload: payload,
    } );
}

/**
 * Sends the given message to the user's server log.
 * 
 * @param {string} message The message to log.
 * @param {undefined | 'red' | 'blue' | 'green' | 'yellow' | 'orange'} color The color of message.
 */
const serverLog = ( message, color ) => {
    ipcRenderer.send( 'chat-room:server-log', {
        message: message,
        color: color,
    } );
}

/**
 * Sends server message to the main process.
 * 
 * @param {'handshake' | 'disconnect'} type The type of message.
 * @param {any|undefined} payload The payload.
 */
const serverMessage = ( type, payload ) => {
    ipcRenderer.send( 'chat-room:server-event', {
        type: type,
        payload: payload,
    } );
}

/** @type {CharacterModel} */
let charModel = null;
/** @type {string} */
let characterName = null;
/** @type {string} */
let characterId = null;
/** @type {boolean} */
let dpsTrackingEnabled = false;
/** @type {boolean} */
let dpsTransmitEnabled = false;
/** @type {Date} */
let lastDpsTransmit = null;
/** @type {number} */
const dpsTransmitIntervalMs = 12 * 1000;
/** @type {number} */
const saveEncounterIntervalMs = 24 * 1000; // Generally twice as long as the transmit interval.
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

let simStoppedFileMonitor = false;

/** @type {number} */
let currentPosition = null;
let watcher = null;
let enableFct = false;
let isDev = false;
/** @type {OverlayWindow} */
let overlays = [];
/** @type {LogSync | null} */
let logSync = null;
/** @type {HandshakePayloadModel[]} */
let playerPeers = [];
/** @type {FileMonitor} */
let fileMonitor = null;
let logPosition = 0;

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

const sendDpsToRenderer = async () => {
    // This is currently a really simple version of DPS tracking.  What we need to do is capture the start/end of each players combat and then calculate the DPS based on that.  In addition to what we're doing now, which is their immediate DPS not encounter DPS.
    let encounterDps = myCombatParser?.getEncounterOutgoingDps() ?? [];
    ipcRenderer.send( 'renderer:encounter-dps', { character: characterName, encounterDps: encounterDps } );

    if ( dpsTransmitEnabled ) {
        if ( lastDpsTransmit == null || ( ( Date.now() - lastDpsTransmit ) >= dpsTransmitIntervalMs ) ) {
            transmitEncounterEvents();
            lastDpsTransmit = Date.now();
            await processChatRoom();
        }
    }
};

const transmitEncounterEvents = () => {
    if ( logSync == null || myCombatParser == null )
        return;

    let fullEncounterEvents = myCombatParser.getCharacterEncounterEvents( characterName, true ) ?? [];
    // let minifiedEncounterEvents = minifyCombatLogs( fullEncounterEvents ) ?? [];

    if ( fullEncounterEvents?.logRecords?.length > 0 ) {

        fullEncounterEvents.logRecords.forEach( e => e.transmitted = true );

        // TODO: Actually transmit the events.
        logSync.sendToAll( {
            type: 'combatStatistics',
            timestamp: fullEncounterEvents.logRecords[ 0 ].timestamp,
            payload: {
                characterName: characterName,
                logRecords: fullEncounterEvents.logRecords,
                encounterStats: fullEncounterEvents.playerStats,
                // logRecords: minifiedEncounterEvents,
                chatTimeStamp: new Date(),
            }
        } );
    }
}

const startDpsTransmit = () => {
    nagLog( `Enabling combat statistics sharing for ${characterName}.` );
    dpsTransmitEnabled = true;
};

const stopDpsTransmit = () => {
    nagLog( `Combat statistics sharing for ${characterName} has been disabled.` );
    dpsTransmitEnabled = false;
};

const startDpsTracking = () => {
    dpsTrackingEnabled = true;
};

/** @type {EncounterModel[]} */
let myEncounters = [];

/** @type {CombatEncounterPayloadModel[]} */
let externalEncounters = [];

/** @type {Record<string, number>} */
let myEncounterSaveIntervalIds = {};

/**
 * Executes when the encounter is reset.
 * 
 * @param {EncounterResetEventArgs} e The events from the encounter.
 */
const onEncounterReset = ( e ) => {

    myEncounters.push( {
        encounterId: e.encounterId,
        characterName: characterName,
        serverName: charModel.server,
        logRecords: e.logRecords,
        externalEncounterIds: e.externalEncounterIds,
        externalEncounterIdCharacters: e.externalEncounterIdCharacters,
        externalEncounterInfos: [],
        npcs: e.npcs,
    } );

    ipcRenderer.send( 'renderer:encounter-reset', { character: characterName } );

    if ( logSync != null ) {
        submitEncounter( e );
        processReceivedEncounters( e.encounterId );
        scheduleSaveEncounter( e.encounterId );
    } else {
        saveEncounter( e.encounterId );
    }
    
    // TODO: Send the full encounter log to disk.  I think that this should work differently than the current db structure.
    //          I think the best way is to have a local directory to store a .json file for each encounter.
    //          Filename format: {characterName}_{serverName}_{timestamp}.json
}

/**
 * Saves the encounter to disk.
 * 
 * @param {string} encounterId The id of the encounter to save.
 */
const saveEncounter = ( encounterId ) => {
    // TODO: Ask the user if they want to save the encounter.
    let encounterIndex = myEncounters.findIndex( e => e.encounterId === encounterId );

    if ( encounterIndex >= 0 ) {
        const encounter = myEncounters[ encounterIndex ];

        ipcRenderer.invoke( 'log:save-encounter', encounter ).then( () => {
            myEncounters = myEncounters.filter( e => e.encounterId !== encounterId );

            nagLog( {
                label: 'Encounter Save',
                message: `Encounter saved for ${characterName}.`,
            } );
        } );
    }
}

/**
 * Saves the specified encounter immediately and does not wait for the interval.
 * 
 * @param {string} encounterId The encounter id.
 */
const saveEncounterNow = ( encounterId ) => {
    saveEncounter( encounterId );
    
    if ( myEncounterSaveIntervalIds[ encounterId ] > 0 ) {
        window.clearTimeout( myEncounterSaveIntervalIds[ encounterId ] );
        delete myEncounterSaveIntervalIds[ encounterId ];
    }
};

/**
 * Schedules the encounter to be saved.
 * 
 * @param {string} encounterId The encounter id.
 */
const scheduleSaveEncounter = ( encounterId ) => {
    if ( myEncounterSaveIntervalIds[ encounterId ] > 0 ) {
        window.clearTimeout( myEncounterSaveIntervalIds[ encounterId ] );
    }

    myEncounterSaveIntervalIds[ encounterId ] = window.setTimeout( () => {
        saveEncounter( encounterId );
        delete myEncounterSaveIntervalIds[ encounterId ];
    }, saveEncounterIntervalMs );
};

/**
 * Submits the encounter to all peers.
 * 
 * @param {EncounterResetEventArgs} e The encounter reset event args.
 */
const submitEncounter = ( e ) => {
    logSync.sendToAll( {
        type: 'encounter',
        timestamp: e.timestamp,
        payload: {
            characterName: characterName,
            logRecords: e.logRecords,
            timestamp: e.timestamp,
            encounterId: e.encounterId,
            npcs: e.npcs,
        }
    } );

    nagLog( {
        label: 'Encounter Sync',
        message: `Encounter sent to all peers for ${characterName}.`,
    } );
};

/**
 * Processes any received encounters.
 * 
 * @param {string} encounterId The encounter id of my encounter.
 */
const processReceivedEncounters = ( encounterId ) => {
    const myEncounter = myEncounters.find( e => e.encounterId === encounterId );

    if ( myEncounter ) {
        for ( let i = 0; i < myEncounter.externalEncounterIds.length; i++ ) {
            const exIndex = externalEncounters.findIndex( e => e.encounterId === myEncounter.externalEncounterIds[ i ] );
            const externalEncounter = externalEncounters[ exIndex ];
            
            if ( externalEncounter ) {
                myEncounter.externalEncounterInfos.push( {
                    encounterId: externalEncounter.encounterId,
                    characterName: externalEncounter.characterName,
                    logRecords: externalEncounter.logRecords,
                } );
                externalEncounters.splice( exIndex, 1 );
            }
        }

        if ( myEncounter.externalEncounterInfos.length === myEncounter.externalEncounterIds.length ) {
            saveEncounterNow( encounterId );
        } else {
            // If there are more encounters we are waiting on, then schedule the save again.  But we won't wait forever.
            scheduleSaveEncounter( encounterId );
        }
    }
};

/**
 * Receives the encounter log from the peer.  If my encounter is ready, it is 
 * added to the encounter.  Otherwise it is cached until my encounter is ready.
 * 
 * @param {CombatEncounterPayloadModel} externalEncounter The external encounter received.
 */
const receiveEncounterLog = ( externalEncounter ) => {
    const myEncounter = myEncounters.find( e => e.externalEncounterIds.includes( externalEncounter.encounterId ) );

    if ( myEncounter == null ) {
        // Cache the external encounter.
        externalEncounters.push( externalEncounter );

    } else {
        myEncounter.externalEncounterInfos.push( {
            encounterId: externalEncounter.encounterId,
            characterName: externalEncounter.characterName,
            logRecords: externalEncounter.logRecords,
        } );

        scheduleSaveEncounter( myEncounter.encounterId );

    }
};

const stopDpsTracking = () => {
    dpsTrackingEnabled = false;
};

/**
 * Starts parsing and watching log file changes for the specified file.
 * 
 * @param {string} logPath The file path to the log file.
 * @param {number} startLogPosition If a value is provided, will start parsing the log file at the given position.
 */
async function startParsingLogFile( logPath, startLogPosition ) {

    fileMonitor.monitorLines( ( lines ) => {
        
        lines.forEach( line => {
            if ( line && line.length > 0 ) {
                parseLogEntries( line );
            }
        } );
        
        dpsTrackingEnabled === true && sendDpsToRenderer();

    }, startLogPosition );
    
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

        // This could be optimized better.
        // TODO: This should be checked in the bootstrap.
        if ( myCombatParser?.loaded && (dpsMeterSettings.show || enableFct) ) {
            
            if ( myCombatParserCache?.length > 0 ) {
                // Add cached log entries to the combat tracker.
                myCombatParserCache.forEach( c => {
                    let fctModel = myCombatParser?.addCombatEvent( c );

                    if ( fctModel && enableFct && !simulating ) {
                        ipcRenderer.send( 'overlay:send:fct-component', fctModel );
                    }
                } );
                myCombatParserCache = [];
            }

            // Add to the combat tracker.
            let fctModel = myCombatParser?.addCombatEvent( raw );

            if ( fctModel && enableFct && !simulating ) {
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
 */
function CombatWatcher() {

    ipcRenderer
        .invoke( 'settings:get', { key: 'dpsMeterSettings', subscribe: true } )
        .then( data => {
            dpsMeterSettings = data ?? new DpsMeterSettings();
        } );
    
    ipcRenderer.on( 'log:character:changed',
        /**
         * Handles the changing of the parse character.
         * 
         * @param {Electron.IpcRendererEvent} event The event args.
         * @param {{character: CharacterModel, logPosition: number | undefined}} data The character model.
         */
        async ( event, data ) => {
            if ( data && data.character?.characterId ) {
                
                if ( logSync != null ) {
                    logSync.changeCharacter( data.character.name, data.character.server );
                    serverLog( `Changed character to ${data.character.name} [${data.character.server}].`, 'orange' );
                }

                stopDpsTracking();

                characterName = data.character.name;
                charModel = data.character;
                characterId = data.character.characterId;

                myCombatParser = charModel.takp ? new TakpCombatParser( characterName, charModel.server ) : new CombatParser( characterName, charModel.server );
                myCombatParser.onEncounterReset = onEncounterReset;
                startDpsTracking();

                logFilePath = data.character.logFile;
                logPosition = data.logPosition;

                let fn = async () => {
                    fileMonitor = new FileMonitor( logFilePath );
                    await startParsingLogFile( logFilePath, logPosition >= 0 ? logPosition : null );
                }
    
                if ( fileMonitor != null )
                    fileMonitor.stopMonitoringLogFile().then( () => fn() );
                else
                    fn();
            
            } else if ( logSync != null && data.character == null ) {
                // Stop watching combat stats.
                stopDpsTracking();

                let fn = () => {
                    characterName = null;
                    charModel = null;
                    characterId = null;

                    myCombatParser = undefined;

                    logFilePath = null;
                    logPosition = 0;

                    fileMonitor = null;
                }

                if ( fileMonitor ) {
                    fileMonitor.stopMonitoringLogFile().then( () => fn() );
                } else {
                    fn();
                }
            } else {

            }
        } );
    
    ipcRenderer.on( 'log:combat:unload', async () => {

        if ( logSync != null ) {
            await logSync.dispose();
            cleanUpChatRoom();

            serverLog( `Left chat room ${logSync.chatRoomId}.`, 'yellow' );
            logSync = null;
            ipcRenderer.send( 'chat-room:disconnected', 'Combat watcher was unloaded.' );
        }

        ipcRenderer.send( 'log:combat:unloaded', null );

    } );
    
    ipcRenderer.on( 'chat-room:disconnect', async ( event, data ) => {
        if ( logSync != null ) {
            stopDpsTransmit();
            await logSync.dispose();
            cleanUpChatRoom();
            serverLog( `Left chat room ${logSync.chatRoomId}.`, 'yellow' );
            logSync = null;

        } else {
            nagException( 'Not in a chat room.' );

        }

        ipcRenderer.send( 'chat-room:disconnected', 'User closed connection.' );
    } );
    
    ipcRenderer.on( 'chat-room:start-chat-room', async ( event, data ) => {
        try {

            if ( charModel == null ) {
                throw new Error( 'The combat watcher has not been loaded yet.  Login or add a character to connect to a server.' );
            }

            if ( logSync != null ) {
                throw new Error( 'Already connected to a server.' );
            }

            logSync = new LogSync( charModel.name, charModel.server );
        
            await logSync.initialize();
            let success = await logSync.createChatRoom();
    
            if ( success ) {
                ipcRenderer.send( 'chat-room:connected', logSync.chatRoomId );
                let link = createChatRoomLink( logSync.chatRoomId );

                serverLog( `Chat room created: ${link}.`, 'green' );
                serverLog( `My peer id: ${logSync.peerId}` );

                startDpsTransmit();
                logSync.onDataReceived( async () => {
                    await processChatRoom();
                } );

            } else {
                stopDpsTransmit();
                throw new Error( 'Failed to create chat room.' );
    
            }

        } catch ( error ) {
            logError( error, 'Failed to create chat room', false, 0 );
            serverLog( `Failed to create chat room.`, 'red' );
            serverLog( `Check the console for more information.` );

        }
    } );

    ipcRenderer.on( 'chat-room:join-chat-room', async ( event, data ) => {
        try {
            
            if ( charModel == null ) {
                throw new Error( 'The combat watcher has not been loaded yet.  Login or add a character to connect to a server.' );
            }

            if ( logSync != null ) {
                throw new Error( 'Already connected to a server.' );
            }

            logSync = new LogSync( charModel.name, charModel.server );

            await logSync.initialize();
            let linkId = parseChatRoomLink( data );
            let success = await logSync.joinChatRoom( linkId );

            if ( success ) {
                ipcRenderer.send( 'chat-room:connected', logSync.chatRoomId );
                serverLog( `Joined chat room: ${data}.`, 'green' );
                serverLog( `My peer id: ${logSync.peerId}` );

                startDpsTransmit();
                logSync.onDataReceived( async () => {
                    await processChatRoom();
                } );

            } else {
                stopDpsTransmit();
                throw new Error( 'Failed to create chat room.' );
    
            }

        } catch ( error ) {
            logError( error, 'Faile to join chat room', false, 0 );
            serverLog( `Failed to join chat room: ${data}.`, 'red' );
            serverLog( `Check the console for more information.` );

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
         * @param {Electron.IpcRendererEvent} event The event args.
         */
        function ( event ) {
            backupStarted = true;
        } );

    ipcRenderer.on( 'log:changed',
        /**
         * Handles the log:changed event.
         * 
         * @param {Electron.IpcRendererEvent} event The event args.
         * @param {string} data The log file path.
         */
        async ( event, data ) => {
            
            logFilePath = data;

            let fn = async () => {
                fileMonitor = new FileMonitor( logFilePath );
                await startParsingLogFile( logFilePath, logPosition >= 0 ? logPosition : null );
            }

            if ( fileMonitor != null )
                fileMonitor.stopMonitoringLogFile().then( () => fn() );
            else
                fn();
        
        } );

    ipcRenderer.on( 'log:simulate:file', function ( event, data ) {
        throw new Error( 'Not implemented' );
    } );


    ipcRenderer.on( 'log:simulate:begin',
        /**
         * @param {Electron.IpcRendererEvent} event 
         * @param {any} data 
         */
        async ( event, data ) => {
            stopDpsTracking();

            myCombatParser?.resetEncounter();

            if ( fileMonitor != null ) {
                // We only want to start the file monitor if we stopped it.
                // The 'log:change' event waits for a sim to end on its own 
                // before starting the file monitor again.
                simStoppedFileMonitor = true;
                await fileMonitor.stopMonitoringLogFile();
            }
        } );

    ipcRenderer.on( 'log:simulate:end',
        /**
         * @param {Electron.IpcRendererEvent} event 
         * @param {any} data 
         */
        async ( event, data ) => {
            if ( simStoppedFileMonitor ) {
                let logStats = await fs.promises.stat( logFilePath );
                await startParsingLogFile( logFilePath, logStats ? logStats.size : Number.MAX_SAFE_INTEGER );
                startDpsTracking();
            }
        } );

    ipcRenderer.on( 'log:simulate:lines',
        /**
         * 
         * @param {Electron.IpcRendererEvent} event 
         * @param {{lines: string[], padTime: number}} data 
         */
        ( event, data ) => {
            data.lines.forEach( line => parseLogEntries( line, true, data.padTime ) );
        
            sendDpsToRenderer();
        } );

    ipcRenderer.on( 'tick', function ( event, data ) {

        enableFct = data.enableFct;
        isDev = data.isDev;
        charModel = data.characterModel ? data.characterModel : charModel;
        overlays = data.overlays;

    } );

}

let processChatRoom = async () => {
    if ( logSync != null ) {
        let data = logSync.flushData();

        for ( var peerId in data ) {
            let messages = data[ peerId ];
            let playerPeer = playerPeers.find( p => p.peerId === peerId );

            messages.forEach( m => {
                if ( m.type === 'message' ) {
                    serverLog( `${playerPeer?.characterName ?? 'Unknown Player'}: ${m.message}` );
                    
                } else if ( m.type === 'combatStatistics' ) {

                    /** @type {CombatStatisticsPayloadModel} */
                    let data = m.payload;

                    myCombatParser.importPlayerEncounterStats( data.characterName, data.encounterStats, data.encounterId );

                    serverLog( `Updating stats for ${playerPeer?.characterName ?? 'Unknown Player'}.` );

                } else if ( m.type === 'encounter' ) {
                    if ( playerPeer != null ) {
                        receiveEncounterLog( m.payload );
                        serverLog( `Received full encounter from ${playerPeer?.characterName ?? 'Unknown Player'}.` );

                    } else {
                        serverLog( `Received encounter from unknown player, ignoring.`, 'yellow' );
                    }

                } else if ( m.type === 'handshake' ) {
                    playerPeers.push( m.payload );
                    serverLog( `${m.payload.characterName} has joined the server.`, 'blue' );
                    serverMessage( 'handshake', m.payload );
                    
                } else if ( m.type === 'character' ) {
                    let peer = playerPeers.find( p => p.peerId === m.payload.peerId );

                    if ( peer ) {
                        
                        serverLog( `${peer.characterName} [${peer.serverName}] has changed to ${m.payload.characterName} [${m.payload.serverName}].`, 'orange' );
                        serverMessage( 'character', m.payload );
                        
                        peer.characterName = m.payload.characterName;
                        peer.serverName = m.payload.serverName;
                    }
                    
                } else if ( m.type === 'disconnect' ) {
                    playerPeers = playerPeers.filter( p => p.peerId !== m.payload.peerId );
                    serverLog( `${m.payload.characterName} has disconnected from the server.`, 'orange' );
                    serverMessage( 'disconnect', m.payload );

                }
            } );
        }

    }
}

function cleanUpChatRoom() {
    // this used to be a function that would clean up the chat room, but now it's just a placeholder.
}

module.exports = CombatWatcher;