const { app, BrowserWindow, ipcMain, screen } = require( "electron" );
const fs = require('fs');
const fsp = fs.promises;
const CharacterDatabaseStore = require( './data/character-database' );
const CharacterModel = require( './data/models/character' );
const _ = require( 'lodash' );
const UserPreferencesStore = require( "./data/user-preferences" );
const FsUtilities = require( "./utilities/file-system" );
const log = require( 'electron-log' );
const ForwardRef = require( './forward-ref' );
const { LogMaintenancePlanTypes, LogMaintenanceRules, ArchiveFilePrefix, SimulationProgress } = require( "./data/models/common" );
const customAlphabet = require( 'nanoid' ).customAlphabet;
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const nanoid = customAlphabet( alphabet, 16 );

class LogWatcherMeta {
    /** @type {BrowserWindow|null} */
    window;

    /** @type {string} */
    logFile;

    /** @type {number} */
    logSize;

    /** @type {number} */
    nullAttemptCount;

    /** @type {CharacterModel} */
    model;

    /** @type {() => void} */
    interrupt;

    /** @type {() => void} */
    start;
}

/** @type {Record<string, LogWatcherMeta>} Dictionary of log watcher windows. */
var logWatchers = {};

/** @type {number} The duration to wait between checking for activity on a log file. */
const checkInterval = 5 * 1000;

/** @type {number} If the log file has no updates in the given number of checks, then kill the log watcher window. */
const killAfterNAttempts = 60 * 1000 / checkInterval;

class LogBootstrapper {

    /** @type {UserPreferencesStore} */
    #userPreferences;

    // /** @type {{logFile: string, callback: () => void}[]} */
    /** @type {{logFile: string, size: number}[]} */
    #filesForArchive = [];

    /** @type {BrowserWindow} */
    #logBackupWindow = null;

    /** @type {boolean} */
    #isDev = false;

    /** @type {number} */
    #backupWaitId = null;

    /** @type {boolean]} */
    get isBackupProcessing() {
        return this.#logBackupWindow != null;
    }










    /**
     * Begins the process of checking and running log file watchers.
     * 
     * @param {ForwardRef<BrowserWindow>} mainWindowRef The main window of the application.
     * @param {boolean} isDev Sets up the log watcher window for development environment if true.
     * @param {CharacterDatabaseStore} characterDatabase The character database.
     * @param {function} sendTick The send tick method.
     * @param {UserPreferencesStore} userPreferences The user preferences store.
     */
    boostrapLogWatchers( mainWindowRef, isDev, characterDatabase, sendTick, userPreferences ) {

        this.#userPreferences = userPreferences;
        this.#isDev = isDev;

        ipcMain.on( 'tick', ( event, tickData ) => {
            for ( let key in logWatchers ) {
                if ( logWatchers.hasOwnProperty( key ) && logWatchers[ key ].window != null ) {
                    logWatchers[ key ].model = characterDatabase.find( key );
                    tickData.characterModel = logWatchers[ key ].model;
                    logWatchers[ key ].window.webContents.send( 'tick', tickData );
                }
            }
        } );

        ipcMain.on( 'log:send:raw', function ( event, data ) {
            for ( let key in logWatchers ) {
                if ( logWatchers.hasOwnProperty( key ) && logWatchers[ key ].window != null ) {
                    logWatchers[ key ].window.webContents.send( 'log:parse:raw', data );
                    break;
                }
            }
        } );

        ipcMain.on( 'log:simulate:file', function ( event, data ) {
            for ( let key in logWatchers ) {
                if ( logWatchers.hasOwnProperty( key ) && logWatchers[ key ].window != null ) {
                    logWatchers[ key ].window.webContents.send( 'log:simulate:file', data );
                    break;
                }
            }
        } );

        ipcMain.on( 'log:store:variable', function ( event, data ) {
            for ( let key in logWatchers ) {
                if ( logWatchers.hasOwnProperty( key ) && logWatchers[ key ].window != null ) {
                    logWatchers[ key ].window.webContents.send( 'log:store:variable', data );
                }
            }
        } );

        ipcMain.on( 'log:store:scalar-variable', function ( event, data ) {
            for ( let key in logWatchers ) {
                if ( logWatchers.hasOwnProperty( key ) && logWatchers[ key ].window != null ) {
                    logWatchers[ key ].window.webContents.send( 'log:store:scalar-variable', data );
                }
            }
        } );

        ipcMain.on( 'log:simulate:begin',
            /**
             * Runs the simulation.
             * 
             * @param {Electron.IpcMainEvent} event Electron event args.
             * @param {{ lines: string[], characterId: string, lineIndex: number|null }} data The data to simulate.
             */
            function ( event, data ) {
                let simulationId = nanoid();
                let simData = {
                    lines: data.lines,
                    lineIndex: data.lineIndex,
                    simulationId: simulationId,
                };

                // Create a clean up function that unregisters the sim events.
                const cleanUp = function () {
                    ipcMain.removeAllListeners( `log:simulation:${simulationId}:progress` );
                    ipcMain.removeAllListeners( `log:simulation:${simulationId}:pause` );
                    ipcMain.removeAllListeners( `log:simulation:${simulationId}:resume` );
                    ipcMain.removeAllListeners( `log:simulation:${simulationId}:stop` );
                    event.sender?.send( `simulation:${simulationId}:progress`, { isComplete: true, completePercent: 100, label: 'Simulation complete' } );
                };
                    
                // Setup sim events that handle progress and control.

                ipcMain.on( `log:simulation:${simulationId}:progress`,
                    /**
                     * Handles passing progress data to the user window.
                     * 
                     * @param {Electron.IpcMainEvent} childEvent Electron event args.
                     * @param {SimulationProgress} data The sim progress data.
                     */
                    function ( childEvent, data ) {
                        // Executed when log watcher window sends progress.
                        event.sender?.send( `simulation:${simulationId}:progress`, data );

                        if ( data.isComplete ) {
                            cleanUp();
                        }
                    } );

                ipcMain.on( `log:simulation:${simulationId}:pause`,
                    /**
                     * Passes pause event to the log watcher window.
                     * 
                     * @param {Electron.IpcMainEvent} childEvent Electron event args.
                     */
                    function ( childEvent ) {
                        // Executed when user pauses sim.
                        logWatchers[ data.characterId ].window.webContents.send( `log:simulation:${simulationId}:pause` );
                    } );

                ipcMain.on( `log:simulation:${simulationId}:resume`,
                    /**
                     * Passes resume event to the log watcher window.
                     * 
                     * @param {Electron.IpcMainEvent} childEvent Electron event args.
                     * @param {number|null} lineNumber The line number to resume from.
                     */
                    function ( childEvent, lineNumber ) {
                        // Executed when user resumes sim.
                        logWatchers[ data.characterId ].window.webContents.send( `log:simulation:${simulationId}:resume`, lineNumber );
                    } );

                ipcMain.on( `log:simulation:${simulationId}:stop`,
                    /**
                     * Passes stop event to the log watcher window.
                     * 
                     * @param {Electron.IpcMainEvent} childEvent Electron event args.
                     */
                    function ( childEvent ) {
                        // Executed when user stops sim.
                        logWatchers[ data.characterId ].window.webContents.send( `log:simulation:${simulationId}:stop` );
                    } );
                
                ipcMain.on( `log:simulation:${simulationId}:stopped`,
                    /**
                     * Passes stop event to the user window.
                     * 
                     * @param {Electron.IpcMainEvent} childEvent Electron event args.
                     */
                    ( childEvent ) => {
                        cleanUp();
                    } );

                let _chr = characterDatabase.find( data.characterId );

                if ( _chr && logWatchers[ _chr.characterId ].window == null ) {
                    let _stats = fs.existsSync( _chr.logFile ) ? fs.statSync( _chr.logFile ) : null;

                    // If the window has not been engaged, then open it. // TODO: Start up a log watcher when simulating. Even allow a charcter to be selected from a list.
                    logWatchers[ _chr.characterId ].window = startLogWatcherWindow( _chr.logFile, isDev, sendTick, _chr, logWatchers[ _chr.characterId ].logSize > _stats.size ? 0 : logWatchers[ _chr.characterId ].logSize );
            
                    // Notify the main window.
                    mainWindowRef.reference.webContents.send( 'log:character:activated', _chr.characterId );
                
                    logWatchers[ _chr.characterId ].window.webContents.once( 'dom-ready', () => {
                        logWatchers[ _chr.characterId ].window.webContents.send( 'log:simulate:begin', simData );
                        logWatchers[ _chr.characterId ].simulating = true;
                    } );

                } else {
                    logWatchers[ _chr.characterId ].window.webContents.send( 'log:simulate:begin', simData );
                    logWatchers[ _chr.characterId ].simulating = true;
                }

                event.sender?.send( 'log:simulate:begin', simData.simulationId );
            } );

        ipcMain.on( 'log:simulate:lines', function ( event, data ) {
            for ( let key in logWatchers ) {
                if ( logWatchers.hasOwnProperty( key ) && logWatchers[ key ].window != null ) {
                    logWatchers[ key ].window.webContents.send( 'log:simulate:lines', data );
                    logWatchers[ key ].simulating = true;
                    break;
                }
            }

            
            if ( !_.some( logWatchers, f => f.simulating ) ) {
                let characters = characterDatabase.getAll();
                let _chr = characters[ 0 ];
                if ( logWatchers[ _chr.characterId ].window == null ) {
                    let _stats = fs.existsSync( _chr.logFile ) ? fs.statSync( _chr.logFile ) : null;

                    // If the window has not been engaged, then open it. // TODO: Start up a log watcher when simulating. Even allow a charcter to be selected from a list.
                    logWatchers[ _chr.characterId ].window = startLogWatcherWindow( _chr.logFile, isDev, sendTick, _chr, logWatchers[ _chr.characterId ].logSize > _stats.size ? 0 : logWatchers[ _chr.characterId ].logSize );
                
                    // Notify the main window.
                    mainWindowRef.reference.webContents.send( 'log:character:activated', _chr.characterId );
                    
                    logWatchers[ _chr.characterId ].window.webContents.once( 'dom-ready', () => {
                        logWatchers[ _chr.characterId ].window.webContents.send( 'log:simulate:lines', data );
                        logWatchers[ _chr.characterId ].simulating = true;
                    } );

                } else {
                    // logWatchers[ _chr.characterId ].window.webContents.once( 'dom-ready', () => {
                        logWatchers[ _chr.characterId ].window.webContents.send( 'log:simulate:lines', data );
                        logWatchers[ _chr.characterId ].simulating = true;
                    // } );
                }

            }
        } );

        ipcMain.on( 'log:simulate:done', function ( event, characterId ) {
            if ( logWatchers.hasOwnProperty( characterId ) ) {
                logWatchers[ characterId ].simulating = false;
            }
        } );

        ipcMain.on( 'log:destroy:component', function ( event, instanceId ) {
            for ( let key in logWatchers ) {
                if ( logWatchers.hasOwnProperty( key ) && logWatchers[ key ].window != null ) {
                    logWatchers[ key ].window.webContents.send( 'component:destroy', instanceId );
                }
            }
        } );

        ipcMain.on( 'log:speak:phrase', function ( event, data ) {
            for ( let key in logWatchers ) {
                if ( logWatchers.hasOwnProperty( key ) && logWatchers[ key ].window != null ) {
                    logWatchers[ key ].window.webContents.send( 'log:speak:phrase', data );
                    // We only need to send this to one log watcher window. It's not hacky!
                    break;
                }
            }
        } );

        ipcMain.on( 'log:action:execute-sub-action', function ( event, data ) {
            for ( let key in logWatchers ) {
                if ( logWatchers.hasOwnProperty( key ) && logWatchers[ key ].window != null ) {
                    logWatchers[ key ].window.webContents.send( 'log:action:execute-sub-action', data );
                }
            }
        } );
        
        let characters = characterDatabase.getAll();
        characters.forEach( chr => {
            this.startWatcher( mainWindowRef, chr, isDev, characterDatabase, sendTick ).then( () => { } );
        } );

        characterDatabase.onCharacterCreated( chr => {
            this.startWatcher( mainWindowRef, chr, isDev, characterDatabase, sendTick ).then( () => { } );
        } );

        characterDatabase.onCharacterRemoved( chr => {
            if ( logWatchers.hasOwnProperty( chr.characterId ) ) {
                if ( logWatchers[ chr.characterId ].window != null ) {
                    logWatchers[ chr.characterId ].window.close();
                    logWatchers[ chr.characterId ].window = null;
                }

                clearInterval( logWatchers[ chr.characterId ].intervalId );

                delete logWatchers[ chr.characterId ];
            }
        } );

        ipcMain.on( 'log:clear-all:done', function ( event, instanceId ) {
            for ( let key in logWatchers ) {
                if ( logWatchers.hasOwnProperty( key ) && logWatchers[ key ].window != null ) {
                    logWatchers[ key ].window.webContents.send( 'log:clear-all:done', null );
                }
            }
        } );

    }










    /**
     * Adds the given log file to the backup list and checks if backups can start.
     * 
     * @param {string} logFile The full path to the log file.
     * @param {number} fileSize The current file size.
     */
    #addToArchive( logFile, fileSize ) {

        this.#filesForArchive.push( { logFile: logFile, size: fileSize } );

        if ( this.#backupWaitId > 0 ) {
            clearTimeout( this.#backupWaitId );
        }

        this.#backupWaitId = setTimeout( () => {
            this.#waitForArchive();
        }, checkInterval + 1000 );

    }










    /**
     * Checks for an active archive process to complete before beginning a new 
     * one.
     */
    #waitForArchive() {

        if ( this.#logBackupWindow == null ) {

            this.#logBackupWindow = startLogBackup( this.#filesForArchive.map( f => f.logFile ), this.#userPreferences.everquestInstallFolder, this.#isDev, null, 0 );

            // Reset the archive files.
            this.#filesForArchive = [];
            
            this.#logBackupWindow.on( 'closed', () => {
                this.#logBackupWindow = null;
            } );

        } else if ( this.#filesForArchive?.length > 0 ) {
            this.#backupWaitId = setTimeout( () => this.#waitForArchive(), checkInterval + 1000 );
        } else {
            
        }

    }










    /**
     * Starts the backup process for all tracked log files.
     * @param {LogMaintenanceRules} logMaintenanceRules The log maintenance rules.
     * @param {number} backupIndex The index of this backup event in the history.
     */
    backupLogFiles( logMaintenanceRules, backupIndex ) {

        let p = new Promise( async ( resolve, reject ) => {
            
            try {
                
                /** @type {string[]} */
                let logFiles = [];
                
                // Stop all running watchers and add to the archive queue
                for ( let characterId in logWatchers ) {
                    if ( logWatchers.hasOwnProperty( characterId ) ) {
                        logWatchers[ characterId ].interrupt();
                
                        // Lets only operate on existing files. This operation is
                        // executed outside the check loop, we need to ensure that the 
                        // file actually exists.
                        if ( await FsUtilities.existsAsync( logWatchers[ characterId ].logFile ) ) {
                    
                            // First, let's rename the log file with the archive prefix.
                            const logFilePath = FsUtilities.Path.prependFilename( logWatchers[ characterId ].logFile, ArchiveFilePrefix );
                            await fsp.rename( logWatchers[ characterId ].logFile, logFilePath );
                
                            // Next, let's reset the current log file size.
                            log.info( `LogBootstrap > Log file renamed to: ${logFilePath}` );
                            logWatchers[ characterId ].logSize = 0;

                            // Finally, add it to the list of files to archive.
                            logFiles.push( logFilePath );
                    
                        }
                    }
                }

                if ( logFiles.length === 0 ) {
                    log.info( 'LogBootstrap > No log files to backup, exiting.' );
                    resolve();
                    return;
                }

                this.#logBackupWindow = startLogBackup( logFiles, this.#userPreferences.everquestInstallFolder, this.#isDev, logMaintenanceRules.logSchedule.dayOfWeek, backupIndex ?? 0 );

                // Reset the archive files.
                this.#filesForArchive = [];
        
                this.#logBackupWindow.on( 'closed', () => {
                    this.#logBackupWindow = null;
                    resolve();
                } );
        
                // Once the files have been renamed and the backup process has started,
                // let's restart the watchers.
                for ( let characterId in logWatchers ) {
                    if ( logWatchers.hasOwnProperty( characterId ) ) {
                        logWatchers[ characterId ].start();
                    }
                }
                
            } catch ( error ) {
                
                if ( this.#logBackupWindow ) {
                    this.#logBackupWindow.close();
                    this.#logBackupWindow = null;
                }

                reject( error );
            }

        } );

        return p;
    }










    /**
     *  Starts watching for changes in the given character data.
     * 
     * @param {ForwardRef} mainWindowRef The main window of the application.
     * @param {CharacterModel} chr The character to watch.
     * @param {boolean} isDev Sets up the log watcher window for development environment if true.
     * @param {CharacterDatabaseStore} characterDatabase The character database.
     * @param {function} sendTick The send tick method.
     */
    async startWatcher( mainWindowRef, chr, isDev, characterDatabase, sendTick ) {
        let characterId = chr.characterId;
        let startingStats = await FsUtilities.existsAsync( chr.logFile ) ? await fsp.stat( chr.logFile ) : null;
        logWatchers[ characterId ] = {
            /** @type {BrowserWindow} */
            window: null,
            logFile: chr.logFile,
            logSize: startingStats == null ? 0 : startingStats.size,
            nullAttemptCount: 0,
            model: chr,
            interrupt: () => {
                clearInterval( logWatchers[ characterId ].intervalId );
            },
            start: () => {
                waitForLogFile().then( () => { } );
            }
        };

        const waitForLogFile = async () => {
            if ( await FsUtilities.existsAsync( chr.logFile ) ) {
                // Log file's back, let's start watching again.
                logWatchers[ characterId ].intervalId = setInterval( () => checkFn().then( () => { } ), checkInterval );
                
            } else {
                setTimeout( () => waitForLogFile().then( () => { } ), checkInterval );
            }
        }

        /**
         * Starts the backup for the current character file.
         * 
         * @param {number} fileSize The file size.
         */
        const backupFn = async ( fileSize ) => {
            log.info( `LogBootstrap > Initializing backup for: ${chr.logFile}` );

            // First, let's rename the log file with a timestamp.
            const logFilePath = FsUtilities.Path.appendFilename( chr.logFile, FsUtilities.getFileTimestamp() );
            await fsp.rename( chr.logFile, logFilePath );
            
            log.info( `LogBootstrap > Log file renamed to: ${logFilePath}` );
            logWatchers[ characterId ].logSize = 0;

            this.#addToArchive( logFilePath, fileSize );
            
            waitForLogFile().then( () => { } );
        }

        const checkFn = async () => {

            // Ensure we have the latest information.
            let _chr = characterDatabase.find( characterId );
            let _stats = await FsUtilities.existsAsync( chr.logFile ) ? await fsp.stat( _chr.logFile ) : null;
            
            if ( _chr.logFile !== logWatchers[ characterId ].logFile ) {

                // The log file changed by the user, update the statistics.
                logWatchers[ characterId ].logFile = _chr.logFile;
                logWatchers[ characterId ].logSize = _stats == null ? 0 : _stats.size;

                // Reset the null attempt count.
                logWatchers[ characterId ].nullAttemptCount = 0;

                if ( logWatchers[ characterId ].window != null ) {
                    // Update the window if it exists.
                    logWatchers[ characterId ].window.send( 'log:changed', _chr.logFile );
                }

            }

            let enableLogFileMaintenance = this.#userPreferences.logMaintenanceRules?.enableLogFileMaintenance === true;
            let enableLogFileMaintenanceBySize = enableLogFileMaintenance && this.#userPreferences.logMaintenanceRules.maintenancePlan === LogMaintenancePlanTypes.BySize && +( this.#userPreferences.logMaintenanceRules?.maxLogFileSizeMb ?? 0 ) > 0;

            if ( _stats != null && _stats.size !== logWatchers[ characterId ].logSize ) {

                // Reset the null attempt count.
                logWatchers[ characterId ].nullAttemptCount = 0;

                if ( logWatchers[ characterId ].window == null ) {

                    // If the window has not been engaged, then open it. // TODO: Start up a log watcher when simulating. Even allow a charcter to be selected from a list.
                    logWatchers[ characterId ].window = startLogWatcherWindow( _chr.logFile, isDev, sendTick, _chr, logWatchers[ characterId ].logSize > _stats.size ? 0 : logWatchers[ characterId ].logSize );
                    
                    // Notify the main window.
                    mainWindowRef.reference.webContents.send( 'log:character:activated', characterId );

                }
                
            } else if ( enableLogFileMaintenanceBySize && _stats != null && this.#userPreferences.everquestInstallFolder?.length > 0 && _stats.size / ( 1024 * 1024 ) > this.#userPreferences.logMaintenanceRules?.maxLogFileSizeMb ) {
                
                // Clear the watch interval.
                clearInterval( logWatchers[ characterId ].intervalId );

                // Execute the backup function.
                backupFn( _stats.size );

            } else if ( logWatchers[ characterId ].window != null ) {

                // Increment the null attempt count.
                logWatchers[ characterId ].nullAttemptCount += 1;

                // If after # of attempts without seeing any changes in the log file, then kill the process.
                if ( !logWatchers[ characterId ].simulating && logWatchers[ characterId ].nullAttemptCount >= killAfterNAttempts ) {
                    
                    logWatchers[ characterId ].window.send( 'log:check:pulse', null );
                    ipcMain.once( 'log:pulse', function ( e, alive ) {
                        if ( !alive ) {
                            
                            // Notify the main window.
                            mainWindowRef.reference.webContents.send( 'log:character:deactivated', characterId );
        
                            if ( logWatchers[ characterId ].window != null && !logWatchers[ characterId ].window.isDestroyed() ) {
                                logWatchers[ characterId ].window.close();
                                logWatchers[ characterId ].window = null;
                            }

                        }
                    } );

                }
            }
            
            logWatchers[ characterId ].model = _chr;
            logWatchers[ characterId ].logSize = _stats == null ? 0 : _stats.size;

        }
        
        logWatchers[ characterId ].intervalId = setInterval( () => checkFn().then( () => { } ), checkInterval );

    }










    /**
     * Unloads all running processes and closes log watcher windows.
     */
    unload() {
        for ( let key in logWatchers ) {
            if ( logWatchers.hasOwnProperty( key ) ) {
                if ( logWatchers[ key ].window != null && !logWatchers[ key ].window.isDestroyed() ) {
                    logWatchers[ key ].window.close();
                    logWatchers[ key ].window = null;
                }

                clearInterval( logWatchers[ key ].intervalId );
            }
        }
    }










    /**
     * Sends a tick to all log watcher windows.
     * 
     * @param {any} tickData The data for the tick
     * @param {CharacterDatabaseStore} characterDatabase The character database.
     */
    tick( tickData, characterDatabase ) {
        for ( let key in logWatchers ) {
            if ( logWatchers.hasOwnProperty( key ) && logWatchers[ key ].window != null ) {
                logWatchers[ key ].model = characterDatabase.find( key );
                tickData.characterModel = logWatchers[ key ].model;
                logWatchers[ key ].window.webContents.send( 'tick', tickData );
            }
        }
    }










    /**
     * Sends the event to each log watcher window.
     * 
     * @param {string} eventId The event identifier.
     * @param {string} value The event value.
     */
    sendToEach( eventId, value ) {
        for ( let key in logWatchers ) {
            if ( logWatchers.hasOwnProperty( key ) && logWatchers[ key ].window != null ) {
                logWatchers[ key ].window.webContents.send( eventId, value );
            }
        }
    }

}










/**
 * Starts a new log watcher window for the specified log file.
 * 
 * @param {string} logFile The full path to the log file.
 * @param {boolean} isDev Sets up the log watcher window for development environment if true.
 * @param {function} sendTick The send tick method.
 * @param {CharacterModel} character The character to watch.
 * @param {number} logPosition The position the log watcher should start processing log entries.
 */
function startLogWatcherWindow( logFile, isDev, sendTick, character, logPosition ) {
    let logWatcherWindow = new BrowserWindow( {
        //   width: 800,
        //   height: 600,
        show: isDev === true,
        // TODO: use preloaders.
        webPreferences: { nodeIntegration: true, contextIsolation: false, webSecurity: false, devTools: isDev === true },
    } );
    logWatcherWindow.webContents.openDevTools( { mode: 'undocked' } );
    logWatcherWindow.loadURL( `file://${__dirname}/threads/log-watcher.html?character=${encodeURI(JSON.stringify(character))}&logPosition=${logPosition}` );

    logWatcherWindow.on( 'closed', function () {
        logWatcherWindow = null;
    } );

    logWatcherWindow.webContents.once( 'dom-ready', () => {
        logWatcherWindow.webContents.send( 'log:changed', logFile );
        sendTick();
    } );
    logWatcherWindow.setPosition( 100, 500 );

    return logWatcherWindow;
}










/**
 * Spins up a new log backup window to backup the specified log files.
 * 
 * @param {string[]} logFiles 
 * @param {string} everquestInstallFolder
 * @param {boolean} isDev
 * @param {number[]|null} daysOfWeek
 * @param {number} backupIndex
 */
function startLogBackup( logFiles, everquestInstallFolder, isDev, daysOfWeek, backupIndex ) {
    
    let logBackupWindow = new BrowserWindow( {
        show: isDev === true,
        // TODO: use preloaders.
        webPreferences: { nodeIntegration: true, contextIsolation: false, webSecurity: false, devTools: isDev === true },
    } );

    if ( isDev ) {
        logBackupWindow.webContents.openDevTools( { mode: 'undocked' } );
    }
    logBackupWindow.loadURL( `file://${__dirname}/threads/log-backup.html?logFiles=${encodeURI(JSON.stringify(logFiles))}&eqFolder=${encodeURI(everquestInstallFolder)}&daysOfWeek=${encodeURI(JSON.stringify(daysOfWeek ?? []))}&i=${backupIndex}` );

    return logBackupWindow;
}










module.exports = LogBootstrapper;
