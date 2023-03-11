const { app, BrowserWindow, ipcMain, screen } = require( "electron" );
const fs = require('fs');
const fsp = fs.promises;
const archiver = require( 'archiver' );
const extract = require( 'extract-zip' );
const CharacterDatabaseStore = require( './data/character-database' );
const CharacterModel = require( './data/models/character' );
const _ = require( 'lodash' );
const UserPreferencesStore = require( "./data/user-preferences" );
const FsUtilities = require( "./utilities/file-system" );
const log = require( 'electron-log' );
const path = require( "path" );
const AdmZip = require( "adm-zip" );

/** @type {any} Dictionary of log watcher windows. */
var logWatchers = {};

/** @type {number} The duration to wait between checking for activity on a log file. */
const checkInterval = 5 * 1000;

/** @type {number} If the log file has no updates in the given number of checks, then kill the log watcher window. */
const killAfterNAttempts = 60 * 1000 / checkInterval;

class LogBootstrapper {

    /** @type {UserPreferencesStore} */
    #userPreferences;

    // /** @type {{logFile: string, callback: () => void}[]} */
    /** @type {string[]} */
    #filesForArchive = [];

    /** @type {BrowserWindow} */
    #logBackupWindow = null;

    /** @type {boolean} */
    #isDev = false;

    /** @type {number]} */
    #backupWaitId = null;










    /**
     * Begins the process of checking and running log file watchers.
     * 
     * @param {ForwardRef} mainWindowRef The main window of the application.
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
            this.startWatcher( mainWindowRef, chr, isDev, characterDatabase, sendTick );
        } );

        characterDatabase.onCharacterCreated( chr => {
            this.startWatcher( mainWindowRef, chr, isDev, characterDatabase, sendTick );
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
    }

    #addToArchive( logFile ) {

        this.#filesForArchive.push( logFile );

        if ( this.#backupWaitId > 0 ) {
            clearTimeout( this.#backupWaitId );
        }

        this.#backupWaitId = setTimeout( () => {
            this.#waitForArchive();
        }, checkInterval + 1000 );

    }

    #waitForArchive() {

        if ( this.#logBackupWindow == null ) {

            this.#logBackupWindow = startLogBackup( this.#filesForArchive, this.#userPreferences.everquestInstallFolder, this.#isDev );

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

    // async #executeArchiveTransfer() {
    //     log.info( 'Execute has been called' );

    //     if ( this.#processingArchive ) {
    //         return;
    //     }

    //     this.#processingArchive = true;

    //     // Next, we need to add it to the log archive.
    //     const logArchivePath = path.join( this.#userPreferences.everquestInstallFolder, 'Logs', 'LogArchive.zip' );
    //     const archiveExists = fs.existsSync( logArchivePath );
    //     const archive = archiveExists ? new AdmZip( logArchivePath ) : new AdmZip();

    //     console.log( 'values', archiveExists, archive.getEntryCount() );
    //     // if ( archiveExists ) {
    //     //     archive.getEntries().forEach( entry => {
    //     //         console.log( 'adding', entry.entryName );
    //     //         // var entryName = entry.entryName;
    //     //         // var zo = archive.getEntry( entryName );
    //     //         archive.addFile( entry.entryName, archive.readFile( entry ) );
    //     //         // var decompressedData = archive.readFile( entry ); // decompressed buffer of the entry
    //     //         // console.log( zip.readAsText( entry ) ); // outputs the decompressed content of the entry  
    //     //     } );
    //     // }

    //     // const tempDir = path.join( this.#userPreferences.everquestInstallFolder, 'Logs', 'LogArchive-unpack' );
    //     // await fsp.mkdir( tempDir, { recursive: true } );

    //     // if ( fs.existsSync( logArchivePath ) ) {

    //     //     await extract( logArchivePath, { dir: tempDir } );

    //     //     await fsp.unlink( logArchivePath );
    //     // }

    //     // const output = fs.createWriteStream( logArchivePath );
    //     // const zip = archiver( 'zip', { zlib: { level: 9 } } );
        
    //     // // Before we start, let's catch some archiver errors.
    //     // zip.on( 'warning', function ( err ) {
    //     //     if ( err.code === 'ENOENT' ) {
    //     //         log.warn( err );
    //     //     } else {
    //     //         log.error( err );
    //     //     }
    //     // } );

    //     // zip.on( 'entry', function ( e ) {
    //     //     log.info( `${e.name} has been added to the archive.` );
    //     // } );

    //     // zip.on( 'progress', function ( e ) {
    //     //     log.info( `Archive progress -> {totalEntries: ${e.entries.total}, completedEntries: ${e.entries.processed}}` );
    //     // } );

    //     // zip.on( 'error', function ( err ) {
    //     //     log.error( err );
    //     // } );

    //     // zip.pipe( output );
        
    //     /** @type {{logFile: string, callback: () => void}[]} */
    //     let processedFiles = [];
    //     while ( this.#filesForArchive.length > 0 ) {
    //         const logFileMeta = this.#filesForArchive.pop();
    //         log.info( `Adding ${logFileMeta.logFile} to the archive.` );
    //         // archive.addFile( FsUtilities.Path.getFilename( logFileMeta.logFile ), fs.readFileSync( logFileMeta.logFile ) );
    //         archive.addLocalFile( logFileMeta.logFile, '', FsUtilities.Path.getFilename( logFileMeta.logFile ) );
    //         // zip.append( fs.createReadStream( logFileMeta.logFile ), { name: FsUtilities.Path.getFilename( logFileMeta.logFile ) } );
    //         processedFiles.push( logFileMeta );
    //     }

    //     // // zip.directory(tempDir, false);
    //     // await zip.finalize();
    //     // await archive.writeZipPromise( logArchivePath );

    //     archive.writeZip( logArchivePath, error => {
    //         if ( error ) {
    //             console.log( 'error', error );
    //         }


    //         processedFiles.forEach( async logFileMeta => {
    //             if ( logFileMeta.callback ) {
    //                 logFileMeta.callback();
    //             }
    //             log.info( `Deleting temporary file ${logFileMeta.logFile}` );
    //             // await fsp.rm( logFileMeta.logFile );
    //         } );
    
    //         // fs.rmdirSync( tempDir, { recursive: true } );
            
    //         this.#processingArchive = false;

    //     } );
    // }

    // async #executeArchiveTransferArchiver() {
    //     log.info( 'Execute has been called' );

    //     if ( this.#processingArchive ) {
    //         return;
    //     }

    //     this.#processingArchive = true;

    //     // Next, we need to add it to the log archive.
    //     const logArchivePath = path.join( this.#userPreferences.everquestInstallFolder, 'Logs', 'LogArchive.zip' );

    //     const tempDir = path.join( this.#userPreferences.everquestInstallFolder, 'Logs', 'LogArchive-unpack' );
    //     await fsp.mkdir( tempDir, { recursive: true } );

    //     if ( fs.existsSync( logArchivePath ) ) {

    //         await extract( logArchivePath, { dir: tempDir } );

    //         await fsp.unlink( logArchivePath );
    //     }

    //     const output = fs.createWriteStream( logArchivePath );
    //     const zip = archiver( 'zip' ); // , { zlib: { level: 9 } }
        
    //     // Before we start, let's catch some archiver errors.
    //     zip.on( 'warning', function ( err ) {
    //         if ( err.code === 'ENOENT' ) {
    //             log.warn( err );
    //         } else {
    //             log.error( err );
    //         }
    //     } );

    //     zip.on( 'entry', function ( e ) {
    //         log.info( `${e.name} has been added to the archive.` );
    //     } );

    //     zip.on( 'progress', function ( e ) {
    //         log.info( `Archive progress -> {totalEntries: ${e.entries.total}, completedEntries: ${e.entries.processed}}` );
    //     } );

    //     zip.on( 'error', function ( err ) {
    //         log.error( err );
    //     } );

    //     zip.pipe( output );
        
    //     /** @type {{logFile: string, callback: () => void}[]} */
    //     let processedFiles = [];
    //     while ( this.#filesForArchive.length > 0 ) {
    //         const logFileMeta = this.#filesForArchive.pop();
    //         log.info( `Adding ${logFileMeta.logFile} to the archive.` );
    //         zip.append( fs.createReadStream( logFileMeta.logFile ), { name: FsUtilities.Path.getFilename( logFileMeta.logFile ) } );
    //         processedFiles.push( logFileMeta );
    //     }

    //     zip.directory(tempDir, false);
    //     await zip.finalize();

    //     processedFiles.forEach( async logFileMeta => {
    //         log.info( `Deleting temporary file ${logFileMeta.logFile}` );
    //         // await fsp.rm( logFileMeta.logFile );
    //         if ( logFileMeta.callback ) {
    //             logFileMeta.callback();
    //         }
    //     } );

    //     fs.rmdirSync( tempDir, { recursive: true } );
        
    //     this.#processingArchive = false;
    // }










    /**
     *  Starts watching for changes in the given character data.
     * 
     * @param {ForwardRef} mainWindowRef The main window of the application.
     * @param {CharacterModel} chr The character to watch.
     * @param {boolean} isDev Sets up the log watcher window for development environment if true.
     * @param {CharacterDatabaseStore} characterDatabase The character database.
     * @param {function} sendTick The send tick method.
     */
    startWatcher( mainWindowRef, chr, isDev, characterDatabase, sendTick ) {
        let characterId = chr.characterId;
        let startingStats = fs.existsSync( chr.logFile ) ? fs.statSync( chr.logFile ) : null;
        logWatchers[ characterId ] = {
            /** @type {BrowserWindow} */
            window: null,
            logFile: chr.logFile,
            logSize: startingStats == null ? 0 : startingStats.size,
            nullAttemptCount: 0,
            model: chr,
        };

        const waitForLogFile = () => {
            if ( fs.existsSync( chr.logFile ) ) {
                // Log file's back, let's start watching again.
                logWatchers[ characterId ].intervalId = setInterval( checkFn, checkInterval );
                
            } else {
                setTimeout( () => waitForLogFile( chr.logFile ), checkInterval );
            }
        }

        const backupFn = async () => {
            log.info( `Backing up log file: ${chr.logFile}` );

            // First, let's rename the log file with a timestamp.
            const logFilePath = FsUtilities.Path.appendFilename( chr.logFile, FsUtilities.getFileTimestamp() );
            fs.rename( chr.logFile, logFilePath, async ( error ) => {
                if ( error ) {
                    log.error( error );
                } else {
                    log.info( `Log file renamed to: ${logFilePath}` );
                    logWatchers[ characterId ].logSize = 0;

                    this.#addToArchive( logFilePath );
                    // this.#addToArchive( logFilePath, () => {
                    //     log.info( 'Log added to archive' );
                    //     logWatchers[ characterId ].logSize = 0;
                    // } );
            
                    // let fn = async () => {
                        
                    //     log.info( 'Log added to archive' );
                    //     
    
                    //     // Reset the log size.
                    //     logWatchers[ characterId ].logSize = 0;
                    // }
                    
                    waitForLogFile();
                }

            } );
        }

        const checkFn = () => {

            // Ensure we have the latest information.
            let _chr = characterDatabase.find( characterId );
            let _stats = fs.existsSync( chr.logFile ) ? fs.statSync( _chr.logFile ) : null;
            
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

            if ( _stats != null && _stats.size !== logWatchers[ characterId ].logSize ) {

                // Reset the null attempt count.
                logWatchers[ characterId ].nullAttemptCount = 0;

                if ( logWatchers[ characterId ].window == null ) {

                    // If the window has not been engaged, then open it. // TODO: Start up a log watcher when simulating. Even allow a charcter to be selected from a list.
                    logWatchers[ characterId ].window = startLogWatcherWindow( _chr.logFile, isDev, sendTick, _chr, logWatchers[ characterId ].logSize > _stats.size ? 0 : logWatchers[ characterId ].logSize );
                    
                    // Notify the main window.
                    mainWindowRef.reference.webContents.send( 'log:character:activated', characterId );

                }
                
            } else if ( _stats != null && this.#userPreferences.everquestInstallFolder?.length > 0 && _stats.size / ( 1024 * 1024 ) > this.#userPreferences.maxLogFileSizeMb ) {
                
                // Clear the watch interval.
                clearInterval( logWatchers[ characterId ].intervalId );

                // Execute the backup function.
                backupFn();

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
        
        logWatchers[ characterId ].intervalId = setInterval( checkFn, checkInterval );

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
 */
function startLogBackup( logFiles, everquestInstallFolder, isDev ) {
    
    let logBackupWindow = new BrowserWindow( {
        //   width: 800,
        //   height: 600,
        show: isDev === true,
        // TODO: use preloaders.
        webPreferences: { nodeIntegration: true, contextIsolation: false, webSecurity: false, devTools: isDev === true },
    } );

    if ( isDev ) {
        logBackupWindow.webContents.openDevTools( { mode: 'undocked' } );
    }
    logBackupWindow.loadURL( `file://${__dirname}/threads/log-backup.html?logFiles=${encodeURI(JSON.stringify(logFiles))}&eqFolder=${encodeURI(everquestInstallFolder)}` );

    return logBackupWindow;
}










module.exports = LogBootstrapper;
