// TODO: Quickshare lists are still sharing the position information.
// TODO: Fix the enternally repeating update modal.

const { app, BrowserWindow, ipcMain, protocol, session, screen, Tray, Menu, globalShortcut } = require( "electron" );
const { autoUpdater, updaterSignal } = require('electron-updater');
const url = require( "url" );
const path = require( "path" );
const log = require( 'electron-log' );
const unhandled = require('electron-unhandled');
const { clipboard } = require( 'electron' );
const UserPreferencesStore = require( './src/electron/data/user-preferences' );
const DkpDatabaseStore = require( './src/electron/data/dkp-database' );
const TriggerDatabaseStore = require( './src/electron/data/trigger-database' );
const OverlayDatabaseStore = require( "./src/electron/data/overlay-database" );
const ForwardRef = require( './src/electron/forward-ref' );
const WindowManager = require( './src/electron/window-manager' );
const CharacterDatabaseStore = require( "./src/electron/data/character-database" );
const LogBootstrapper = require( './src/electron/log-bootstrap' );
const GameResources = require( './src/electron/data/game-resources' );
const FilesDatabaseStore = require( './src/electron/data/files-database' );
const GinaImporter = require( "./src/electron/gina-importer" );
const { IpcMessage, Progress, ScheduledTask, LogMaintenanceRules, Version, WinInfo, LogMaintenancePlanTypes } = require( "./src/electron/data/models/common" );
const { LogFileLocation } = require( "./src/electron/data/log-file-location" );
const VerifiedPlayersStore = require( "./src/electron/data/verified-players" );
const cronParser = require( 'cron-parser' );
const { DateUtilities } = require( "./src/electron/utilities/dates" );
const CombatDatabase = require( "./src/electron/data/combat-database" );
const activeWindow = require( "active-win" );
const hasher = require( 'crypto' ).createHash;

/** @type {BrowserWindow} */
var mainWindow, logWatcherWindow, testWindow;
var enableDevMode = true;
const updateCheckInterval = 10 * 60 * 1000;
const winManager = new WindowManager(__dirname);
const userPreferences = new UserPreferencesStore( {} );
const dkpDatabase = new DkpDatabaseStore();
const triggerDatabase = new TriggerDatabaseStore();
const overlayDatabase = new OverlayDatabaseStore();
const characterDatabase = new CharacterDatabaseStore();
const logBootstrap = new LogBootstrapper();
const gameResources = new GameResources();
const fileDatabase = new FilesDatabaseStore();
const ginaImporter = new GinaImporter();
// const verifiedPlayersDatabase = new VerifiedPlayersStore();
const combatDatabase = new CombatDatabase();
/** @type {Tray} */
var trayMenu = null;
/** @type {string | undefined} */
var combatParseCharacterId = undefined;
autoUpdater.logger = log;
/** @type {number | undefined} */
var nagProcessId = undefined;
const allowMultipleInstances = false;
const fs = require( 'fs' );


const configRootPath = path.join( __dirname, 'config.json' );

const config = JSON.parse( fs.readFileSync( configRootPath, 'utf-8' ) );
// require( 'dotenv' ).config();
require( '@electron/remote/main' ).initialize();

unhandled( {
    logger: log.error,
    showDialog: false,
} );

/**
 * Creates a tray menu for the application.
 * 
 * @returns Returns the new application tray menu.
 */
function createTray() {
    let appTrayMenu = new Tray( path.join( __dirname, "Nag.ico" ) );
    const contextMenu = Menu.buildFromTemplate( [
        {
            label: 'Show', click: function () {
                mainWindow.show();
            }
        },
        {
            label: 'Exit', click: function () {
                app.isQuiting = true;
                app.quit();
            }
        }
    ] );

    appTrayMenu.on( 'double-click', function ( event ) {
        mainWindow.show();
    } );

    appTrayMenu.setToolTip( 'Nag' );
    appTrayMenu.setContextMenu( contextMenu );

    return appTrayMenu;
}

const checkForUpdates = () => {
    autoUpdater.allowPrerelease = userPreferences.allowPrerelease;
    autoUpdater.checkForUpdates();
}

const getDefaultMainWindowBounds = () => {
    let nagBounds = {
        width: 0,
        height: 0,
        x: 0,
        y: 0,
    };
    const screenBounds = screen.getPrimaryDisplay().workArea;

    // Set the window to be a natural size for their monitor.
    const maxWidth = Math.min( screenBounds.width * 0.8, 1100 );
    const maxHeight = Math.min( screenBounds.height * 0.8, 900 );
    nagBounds.width = Math.max( Math.min( screenBounds.width, 800 ), maxWidth );
    nagBounds.height = Math.max( Math.min( screenBounds.height, 600 ), maxHeight );

    // Position the window in the center of the screen.
    nagBounds.x = Math.floor( ( screenBounds.width - nagBounds.width ) / 2 );
    nagBounds.y = Math.floor( ( screenBounds.height - nagBounds.height ) / 2 );

    return nagBounds;
}

function createWindow() {
    let nagBounds = {
        width: userPreferences.windowWidth,
        height: userPreferences.windowHeight,
        x: userPreferences.windowX,
        y: userPreferences.windowY,
    };

    // If the nag window bounds any of the dimensions are undefined or less than 100, then we need to reset the bounds.
    let widthInvalid = nagBounds.width == null || nagBounds.width < 100;
    let heightInvalid = nagBounds.height == null || nagBounds.height < 100;
    let xInvalid = nagBounds.x == null || nagBounds.x < 0;
    let yInvalid = nagBounds.y == null || nagBounds.y < 0;
    if ( widthInvalid || heightInvalid || xInvalid || yInvalid ) {
        log.warn( '[main:createWindow] Main window bounds are invalid. Resetting window bounds.' );
        nagBounds = getDefaultMainWindowBounds();
    }

    // If the main window has any part that is not on any screen, then we need to reset the bounds.
    const displays = screen.getAllDisplays();
    let isWindowOutOfBounds = false;
    displays.forEach( display => {
        if ( !isWindowOutOfBounds ) {
            let out = nagBounds.x + nagBounds.width < display.bounds.x || nagBounds.x > display.bounds.x + display.bounds.width || nagBounds.y + nagBounds.height < display.bounds.y || nagBounds.y > display.bounds.y + display.bounds.height;
            isWindowOutOfBounds = out;
        }
    } );

    if ( isWindowOutOfBounds ) {
        log.warn( '[main:createWindow] Main window is out of bounds. Resetting window bounds.' );
        nagBounds = getDefaultMainWindowBounds();
    }

    mainWindow = new BrowserWindow( {
        width: nagBounds.width,
        height: nagBounds.height,
        x: nagBounds.x,
        y: nagBounds.y,
        //   transparent: true,
        frame: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            devTools: app.isDev(),
            sandbox: false,
            preload: path.join( __dirname, '/src/electron/preloaders/main.js' ),
        },
        show: false,
    } );

    require( "@electron/remote/main" ).enable( mainWindow.webContents );

    mainWindow.setBackgroundColor( '#1a1a1a' );

    trayMenu = createTray();

    let mainUrl = new url.URL( `file://${path.join( __dirname, `/dist/index.html` )}` );
    mainWindow.loadURL( mainUrl.toString() );

    // Open the DevTools.
    if ( app.isDev() ) {
        mainWindow.webContents.openDevTools( { mode: 'undocked' } );
    }

    mainWindow.on( 'closed', function () {
        mainWindow = null;
    } );

    mainWindow.on( 'close', async () => {
        winManager.unload();
        await logBootstrap.unload();
    } );

    mainWindow.on( 'resize', function ( e ) {
        let bounds = mainWindow.webContents.getOwnerBrowserWindow().getBounds();
        userPreferences.windowWidth = bounds.width;
        userPreferences.windowHeight = bounds.height;
    } );

    mainWindow.on( 'move', function () {
        let bounds = mainWindow.webContents.getOwnerBrowserWindow().getBounds();
        userPreferences.windowX = bounds.x;
        userPreferences.windowY = bounds.y;
    } );

    mainWindow.webContents.once( 'dom-ready', () => {
        sendTick();
        checkForUpdates();
        setInterval( () => {
            checkForUpdates();
        }, updateCheckInterval );

        // TODO: Remove this in a few versions.
        let overlays = overlayDatabase.getAll();
        overlays.forEach( overlay => {
            mainWindow.webContents.send( 'color:darken', { overlayId: overlay.overlayId, color: overlay.timerColor } );
        } );

        checkCombatGroups();
    } );

    mainWindow.once( 'ready-to-show', () => {
        if ( !userPreferences.minimizeToTrayOnLoad ) {
            mainWindow.show();
        }
    } );

    if ( userPreferences.setup ) {
        // Set the last viewed version to the current version.
        userPreferences.lastViewedUpdateNotes = app.getVersion();
    }
    
};

app.isDev = () => enableDevMode === true && process.defaultApp === true;

app.commandLine.appendSwitch( 'enable-speech-dispatcher' );

app.on( 'before-quit', async () => {
    trayMenu.destroy();
    trayMenu = null;
} );

app.on( 'child-process-gone', ( event, details ) => {
    log.info( '[main:child-process-gone] Child process gone.', details );
} );

// Deprecated: This event is superceded by the child-process-gone event which contains more information about why the child process disappeared. It isn't always because it crashed. The killed boolean can be replaced by checking reason === 'killed' when you switch to that event.
// app.on('gpu-process-crashed', (event, killed) => {

const registerDevToolsShortcut = () => {
    globalShortcut.register( 'CommandOrControl+Shift+D', function () {
        
        const focusedWindow = BrowserWindow.getFocusedWindow();

        if ( focusedWindow ) {
            if ( focusedWindow?.webContents.isDevToolsOpened() ) {
                focusedWindow.webContents.closeDevTools();
            } else {
                focusedWindow.webContents.openDevTools();
            }
        }

    } );
};

const checkCombatGroups = () => {
    if ( overlayDatabase.getCombatGroups().length === 0 ) {
        if ( userPreferences.askForCombatGroupMigrations && !userPreferences.setup ) {
            mainWindow.webContents.send( 'ask_combat_group_migration', userPreferences.fctStyles?.fctDmgInStyle != null );
        }
    }
};

// --========================--
// --== App Initialization ==--
// --========================--

if ( process.argv?.length > 1 && process.argv.includes( '--no-gpu' ) ) {
    
    log.info( '[main:app-initialization] Disabling hardware acceleration. --no-gpu' );

    app.disableHardwareAcceleration();
    app.commandLine.appendSwitch( "disable-software-rasterizer" );

}


const bootstrapApp = () => {

    app.on( 'ready', function () {
        
        winManager.onReady();
        screen.on( 'display-metrics-changed', ( e, newDisplay ) => {
            if ( userPreferences.enableCheckWindowPosition === true ) {
                log.info( '[main:display-metrics-changed] Initiating overlay position checks.', e, newDisplay );
                winManager.checkOverlayPositions( true );
            }
        } );
        protocol.interceptFileProtocol( 'file', ( req, callback ) => {
            let filePath = new url.URL( req.url ).pathname;
            
            if ( !filePath.match( /electron/ ) ) {
                if ( process.platform === 'win32' ) {
    
                    if ( filePath.match( /^\/[A-Za-z]:/ ) ) {
                        // If it begins with a slash, remove it.
                        filePath = filePath.slice( 1 );
                    }
    
                    if ( filePath.match( /^[A-Za-z]:\/(css|img|js|fonts)/ ) ) {
                        filePath = path.join( app.getAppPath(), 'dist', filePath.slice( 3 ) );
    
                    } else if ( filePath.match( /^[A-Za-z]:\/.*\.(js|css|png|jpeg|jpg|ico|svg|woff|woff2|ttf|webp)$/ ) ) {
                        // case of "vue-cli-service build --mode development"
                        filePath = path.join( app.getAppPath(), 'dist', filePath.slice( 3 ) );
                    }
    
                } else {
    
                    if ( filePath.match( /^\/(css|img|js)/ ) ) {
                        filePath = path.join( app.getAppPath(), 'dist', filePath.slice( 1 ) );
                    } else if ( filePath.match( /^\/[^/\\]+?\.(js|css|png|jpeg|jpg|ico|svg)$/ ) ) {
                        // case of "vue-cli-service build --mode development"
                        filePath = path.join( app.getAppPath(), 'dist', filePath.slice( 1 ) );
                    }
    
                }
            }
    
            if ( !app.isDev() && !filePath.match( /\.png$/i ) ) {
                log.info( '[main:interceptFileProtocol] Intercepted file protocol.', {
                    req: req,
                    filePath: filePath,
                    normalizedFilePath: path.normalize( filePath ),
                    appPath: app.getAppPath(),
                } );
            }

            callback( path.normalize( filePath ).replace( /%20/g, ' ' ) );
        } );
        createWindow();

        if ( enableDevMode === true && process.defaultApp === true ) {
            // If we're running in dev mode, then we need to register the global shortcut
            // to open the dev tools.
            registerDevToolsShortcut();
        }

        setTimeout( checkActiveWindow, 100 );

    } );
    
}

// Using the instance lock we can prevent multiple Nag instances from opening.
const instanceLock = allowMultipleInstances || app.requestSingleInstanceLock();

if ( !allowMultipleInstances && !instanceLock ) {
    app.quit();
} else {

    if ( !allowMultipleInstances ) {
        app.on( 'second-instance', ( event, argv, workingDir, addtnlData ) => {

            if ( mainWindow ) {
                // If the main window has been loaded, then let's make sure that 
                // appears for the user so they don't think Nag isn't running.

                if ( mainWindow.isMinimized() ) {
                    mainWindow.restore();
                }

                mainWindow.setAlwaysOnTop( true );
                mainWindow.show();
                mainWindow.setAlwaysOnTop( false );
                mainWindow.focus();
            
            }
        } );
    }

    bootstrapApp();
}

app.on( 'window-all-closed', function () {
    if ( process.platform !== 'darwin' ) app.quit()
} );

app.on( 'activate', function () {
    if ( mainWindow === null ) createWindow()
} );

ipcMain.handle( 'app:register-combat-parser', ( event, characterId ) => {
    if ( combatParseCharacterId == undefined ) {
        combatParseCharacterId = characterId;
    }

    return combatParseCharacterId;
} );

ipcMain.on( 'app:unregister-combat-parser', ( event, characterId ) => {
    if ( combatParseCharacterId === characterId ) {
        combatParseCharacterId = undefined;
    }
} );

// TODO: Remove this in a few versions.
ipcMain.on( `color:darken`, ( e, data ) => {
    let overlay = overlayDatabase.find( data.overlayId );
    overlay.timerBackgroundColor = data.color;
    overlayDatabase.update( overlay );
} );

/** @type {string[]} */
let errorHashes = [];

ipcMain.on( 'app:clear-log-history', ( event ) => {
    errorHashes = [];
} );

/**
 * Sends the error to the user.
 * 
 * @param {any} data The error data.
 * @param {boolean|undefined} present If true, the user should be presented with the error.
 */
const appLogException = ( data, present ) => {
    let eid = ( data?.source ?? 'unknown' ) + ( data?.error?.message ?? data?.message ?? 'Unknown Error' ) + ( data?.error?.stack ?? '' );
    let hash = hasher( 'sha1' ).update( eid ).digest( 'base64' );
    if ( errorHashes.includes( hash ) ) {
        return;
    } else {
        errorHashes.push( hash );
    }
    
    let error = {
        label: 'System Error:',
        message: '',
        timestamp: new Date(),
        payload: null,
        present: present === true,
        hash: hash,
    };

    if ( data?.source === 'log-watcher.js' ) {
        log.error( data.error,
            '\r\n						  [error] (log entry)  "' + data.logEntry + '"',
            '\r\n						  [error] (simulating) ' + ( data.simulating ? 'true' : 'false' ),
            '\r\n						  [error] (pad time)   ' + data.padTime );
        
        error.label = 'Log Watcher Error:';
        error.message = data?.error?.message ?? 'Unexpected Error';
        error.payload = data?.error;
        
    } else if ( data?.source === 'renderer.js' && data?.fctModel ) {
        log.error( data.error,
            '\r\n						  [error] (fct model)  ' + JSON.stringify( data.fctModel ),
            '\r\n						  [error] (overlay id) ' + data.overlayId );
        
        error.label = 'Renderer FCT Error:';
        error.message = data?.error?.message ?? 'Unexpected Error';
        error.payload = data?.error;
        
    } else if ( data?.source === 'renderer.js' && data?.overlayComponent ) {
        log.error( data.error,
            '\r\n						  [error] (overlay component)  ' + JSON.stringify( data.overlayComponent ),
            '\r\n						  [error] (overlay id)         ' + data.overlayId );
        
        error.label = 'Renderer Trigger Error:';
        error.message = data?.error?.message ?? 'Unexpected Error';
        error.payload = data?.error;
        
    } else if ( data?.source ) {
        log.error( data.error );

        error.label = data.source;
        error.message = data?.error?.message ?? data.error ?? 'Unexpected Error';
        error.payload = data?.error;
    
    } else {
        log.error( data );

        error.label = data?.label ?? 'System Error';
        error.message = data?.message ?? data;
        error.payload = data?.payload ?? null;
    }

    mainWindow.webContents.send( 'console:error', error );
}

ipcMain.on( 'app:log:exception', ( event, data ) => {
    appLogException( data );
} );

ipcMain.on( 'app:log:info', ( event, data ) => {
    log.info( data );
} );

var quitCalled = false;
ipcMain.on( 'app:quit', async ( event, forceQuit ) => {
    if ( forceQuit === true || !logBootstrap.isBackupProcessing ) {
        quitCalled = true;
        winManager.unload();
        await logBootstrap.unload();
        app.quit();
    } else {
        event.sender.send( 'app:quit:failure', {
            code: 'backup'
        } );
    }
} );

process.on( 'exit', () => {
    !quitCalled && app.quit();
} );

ipcMain.on( 'app:minimize', ( event, data ) => {
    mainWindow.minimize();
} );

ipcMain.on( 'app:minimize:tray', ( event, data ) => {
    mainWindow.hide();
} );

ipcMain.on( 'app:open-patreon', ( event ) => {
    require( 'electron' ).shell.openExternal( 'https://www.patreon.com/EverQuestNag' );
} );

ipcMain.on( 'app:request:tick', ( event, data ) => {
    sendTick();
} );

ipcMain.on( 'app:get:primary-display', ( event ) => {
    event.sender.send( 'app:get:primary-display', screen.getPrimaryDisplay() );
} );

ipcMain.on( 'app:get:all-display', ( event ) => {
    event.sender.send( 'app:get:all-display', screen.getAllDisplays() );
} );

ipcMain.on( 'combat:record-encounters',
    /**
     * @param {Electron.IpcMainEvent} event The event args.
     * @param {{recordEncounters: boolean}} data The data.
     */
    ( event, data ) => {
        logBootstrap.sendToCombatWatcher( 'combat:record-encounters', data );
    } );

ipcMain.on( 'chat-room:link-received',
    /**
     * @param {Electron.IpcMainEvent} event The event args.
     * @param {{link: string, player: string, server: string}} data The chat link received args.
     */
    ( event, data ) => {
        
        if ( userPreferences.serverTrustedPlayers[ data.server ] && userPreferences.serverTrustedPlayers[ data.server ].includes( data.player ) ) {
            // join server.
            logBootstrap.sendToCombatWatcher( 'chat-room:join-chat-room', data.link );

        } else if ( userPreferences.serverBlockedPlayers[ data.server ] && userPreferences.serverBlockedPlayers[ data.server ].includes( data.player ) ) {
            // ignore
            appLogException( { label: 'Chat Room', message: `Blocked player ${data.player} from server ${data.server}.`, payload: data } );

        } else {
            mainWindow.webContents.send( 'chat-room:link-received', data );
            mainWindow.flashFrame( true );
        }

    } );

ipcMain.on( 'main:console:log', ( event, data ) => { mainWindow.webContents.send( 'console:log', data ); } );

let _tickTimeoutId = -1;
let _tickTriggers = 0;
function sendTick( delay ) {
    delay = delay === true ? true : false;
    let _triggers = triggerDatabase.getAll();
    let _folders = triggerDatabase.getFolders();
    let tickData = {
        characterOptions: characterDatabase.getAll().map( f => { f.characterId, f.name, f.server } ),
        dkpEntries: dkpDatabase.getAllUnentered(),
        logFile: userPreferences.logFile,
        voiceIndex: userPreferences.voiceIndex,
        masterVolume: userPreferences.masterVolume,
        speechVolume: userPreferences.speechVolume,
        audioVolume: userPreferences.audioVolume,
        baseSpeakingRate: userPreferences.baseSpeakingRate,
        triggers: _triggers,
        triggerChanges: _tickTriggers !== _triggers.length,
        overlays: overlayDatabase.getAll(),
        damageDealtOverlayId: userPreferences.damageDealtOverlayId,
        damageReceivedOverlayId: userPreferences.damageReceivedOverlayId,
        enableFct: userPreferences.enableFct,
        fctShowCriticalsInline: userPreferences.fctShowCriticalsInline,
        hasExtendedDotFocus: userPreferences.hasExtendedDotFocus,
        extendedDotFocusPercent: userPreferences.extendedDotFocusPercent,
        extendedDotFocusDecayLevel: userPreferences.extendedDotFocusDecayLevel,
        isDev: app.isDev(),
        phoneticTransforms: userPreferences.phoneticTransforms,
        ignoredGinaObjects: userPreferences.ignoreGinaObjects,
        folders: _folders,
        fctStyles: userPreferences.fctStyles,
        persistentStorage: userPreferences.persistentStorage,
        enableQuickShareImports: userPreferences.enableQuickShareImports,
        detrimentalOverlayId: userPreferences.detrimentalOverlayId,
        quickShareAuthorsListType: userPreferences.quickShareAuthorsListType,
        quickShareAuthorsList: userPreferences.quickShareAuthorsList,
        characterDisabledTriggers: characterDatabase.getAll().map( c => { return { characterId: c.characterId, disabledTriggers: c.disabledTriggers }; } ),
        triggerProfileDisabledTriggers: characterDatabase.getAllTriggerProfiles().map( tp => { return { triggerProfileId: tp.triggerProfileId, disabledTriggers: tp.disabledTriggers }; } ),
    };

    const _executeTick = () => {
        _tickTriggers = _triggers?.length ?? 0;
        mainWindow.webContents.send( 'tick', tickData );
        logBootstrap.tick( tickData, characterDatabase );

        if ( winManager.ginaImportWindow != null ) {
            winManager.ginaImportWindow.send( 'tick', tickData );
        }
    };
    
    if (_tickTimeoutId > -1) {
        clearTimeout(_tickTimeoutId);
    }

    if ( delay ) {
        _tickTimeoutId = setTimeout( () => {
            _executeTick();
        }, 1000 );

    } else {
        _executeTick();
    }

}

/** @type {import("electron-updater").UpdateInfo} */
var updateInfo = null;

autoUpdater.on( 'update-downloaded', () => {
    log.info( 'update-downloaded executed' );

    if ( !userPreferences.allowPrerelease || Version.compareVersions( updateInfo.version, app.getVersion() ) === 1 ) {

        mainWindow.webContents.send( 'update_downloaded', updateInfo );
        winManager.eachWindow( ( window, identifier ) => {
            log.info( `Sending update to ${identifier}` );
            // TODO: Load update notes markdown.
            window.webContents.send( 'update_downloaded', updateInfo );
        } );

    }

    if ( updateCheckInterval > 0 ) {
        // Once an update is loaded, stop checking for updates.
        clearInterval( updateCheckInterval );
    }
} );


autoUpdater.on( 'update-available', info => {
    log.info( info );
    updateInfo = info;
    mainWindow.webContents.send( 'update_available', info );
} );

ipcMain.on( 'app:restart', () => {
    log.info( 'app:restart executed' );
    autoUpdater.quitAndInstall();
} );

ipcMain.on( 'app:isDev', ( event ) => {
    event.sender.send( 'app:isDev', app.isDev() );
} );

ipcMain.on( 'app:version', ( event ) => {
    log.info( `[app:version] ${app.getVersion()}` );
    event.sender.send( 'app:version', { version: app.getVersion() } );
} );

ipcMain.on( 'clipboard:writeText', ( event, value ) => {
    clipboard.writeText( value );
} );

ipcMain.on( 'quickshare_captured', ( event, quickShareId ) => {
    mainWindow.webContents.send( 'quickshare_captured', quickShareId );
} );

ipcMain.on( 'quicksharePackage_captured', ( event, packageId ) => {
    mainWindow.webContents.send( 'quicksharePackage_captured', packageId );
} );

var pseudoClipboard = {};
ipcMain.on( 'context:store:pseudo-clipboard', ( event, model ) => {
    if ( model && model.key ) {
        pseudoClipboard[ model.key ] = model.value;
    }
} );
ipcMain.on( 'context:get:pseudo-clipboard', ( event, key ) => {
    event.sender.send( `context:get:pseudo-clipboard:${key}`, pseudoClipboard[ key ] );
} );

ipcMain.on( 'window:unfocus', ( event ) => {
    const win = BrowserWindow.fromId( event.sender.id );
    win?.blur();
} );

ipcMain.on( 'death-recap:find-deaths',
    /**
     * 
     * @param {any} event The event args.
     * @param {IpcMessage<string>} message The log file to parse.
     */
    ( event, message ) => {
        winManager.findPlayerDeaths( message.value, message.id );
    }
);

ipcMain.on( 'death-recap:find-deaths:results',
    /**
     * 
     * @param {any} event The event args.
     * @param {IpcMessage<LogFileLocation[]>} message The log file to parse.
     */
     ( event, message ) => {
        mainWindow.webContents.send( `death-recap:find-deaths:${message.id}`, message.value );
    }
);

ipcMain.on( 'main:archive:progress',
    /**
     * Passes the backup progress event to the main window.
     * 
     * @param {any} event Event args.
     * @param {Progress} progress The current backup progress.
     */
    ( event, progress ) => {
        mainWindow.webContents.send( 'archive:progress', progress );
    }
);

// TODO: Update the github pages with a list of available console commands.
ipcMain.on( 'console:command',
    /**
     * Executes the given console command.
     * 
     * @param {Electron.IpcMainEvent} event The event args.
     * @param {string | undefined} command The command to execute.
     */
    async ( event, command ) => {
        let commands = command?.split( ' ' ) ?? [];
        if ( commands.length > 0 ) {
            if ( commands[ 0 ] === 'log' ) {
                if ( commands.length > 1 ) {
                    if ( commands[ 1 ] === 'backup' ) {
                        try {
                            await logBootstrap.backupLogFiles( userPreferences.logMaintenanceRules, userPreferences.logMaintenanceHistory?.length ?? 0 );
                            event.sender.send( 'console:success', { label: 'Backup Event', message: 'Log backup completed successfully.', timestamp: new Date() } );
                        } catch ( error ) {
                            log.error( error );
                            event.sender.send( 'console:error', { label: 'Backup Event', message: 'Log backup failed.', timestamp: new Date(), payload: error } );
                        }
                    }
                }
            } else if ( commands[ 0 ] === 'ping' ) {
                if ( commands.length === 1 ) {
                    event.sender.send( 'console:success', { label: 'Ping', message: 'Ping received.', timestamp: new Date() } );
                } else {
                    event.sender.send( 'console:success', { label: 'Text Ping', message: `Ping received: ${commands.slice( 1 ).join( ' ' )}`, timestamp: new Date() } );
                }
            } else if ( commands[ 0 ] === 'chat' ) {
                if ( commands[ 1 ] === 'create' ) {
                    logBootstrap.sendToCombatWatcher( 'chat-room:start-chat-room', null );
                } else if ( commands[ 1 ] === 'join' ) {
                    logBootstrap.sendToCombatWatcher( 'chat-room:join-chat-room', commands[ 2 ] );
                } else if ( commands[ 1 ] === 'leave' ) {
                    logBootstrap.sendToCombatWatcher( 'chat-room:disconnect', null );
                }
            }
        }
    } );

ipcMain.on( 'chat-room:server-event',
    /**
     * Forwards server events to the main window.
     * 
     * @param {Electron.IpcMainEvent} event The event args.
     * @param {{type: 'handshake' | 'disconnect', payload: any}} data The message data.
     */
    ( event, data ) => mainWindow.webContents.send( 'chat-room:server-event', data ) );

ipcMain.on( 'chat-room:server-log',
    /**
     * Forwards the chat room log event to the main window.
     * 
     * @param {Electron.IpcMainEvent} event The event args.
     * @param {string} data The chat room id.
     */
    ( event, data ) => mainWindow?.webContents.send( 'chat-room:server-log', data ) );

ipcMain.on( 'chat-room:start-chat-room',
    /**
     * Sends the create chat room event to the combat watcher.
     * 
     * @param {Electron.IpcMainEvent} event The event args.
     */
    ( event ) => logBootstrap.sendToCombatWatcher( 'chat-room:start-chat-room', null ) );

ipcMain.on( 'chat-room:join-chat-room',
    /**
     * Sends the create chat room event to the combat watcher.
     * 
     * @param {Electron.IpcMainEvent} event The event args.
     * @param {string} data The chat room link.
     */
    ( event, data ) => logBootstrap.sendToCombatWatcher( 'chat-room:join-chat-room', data ) );

ipcMain.on( 'chat-room:connected',
    /**
     * Forwards the chat room connected event to the main window.
     * 
     * @param {Electron.IpcMainEvent} event The event args.
     * @param {string} data The chat room id.
     */
    ( event, data ) => mainWindow.webContents.send( 'chat-room:connected', data ) );

ipcMain.on( 'chat-room:disconnect',
    /**
     * Disconnects from the chat room.
     * 
     * @param {Electron.IpcMainEvent} event The event args.
     */
    ( event ) => logBootstrap.sendToCombatWatcher( 'chat-room:disconnect', null ) );

ipcMain.on( 'chat-room:disconnected',
    /**
     * Sends the chat room disconnected event to the main window.
     * 
     * @param {Electron.IpcMainEvent} event The event args.
     * @param {string} reason The reason for the disconnect.
     */
    ( event, reason ) => mainWindow?.webContents.send( 'chat-room:disconnected', reason ) );

/**
* Sends the console message to the debug console.
* 
* @param {string | {label: string, message: string} | undefined} data The message to send.
*/
const consoleMessage = async ( data ) => {
    if ( typeof data === 'string' ) {
        mainWindow?.webContents.send( 'console:success', { label: 'System Message', message: data, timestamp: new Date() } );
    } else if ( data?.message ) {
        mainWindow?.webContents.send( 'console:success', { label: data.label ?? 'System Message', message: data.message, payload: data.payload, timestamp: new Date() } );
    }
 }

ipcMain.on( 'console:message',
    /**
     * Sends the console message to the debug console.
     * 
     * @param {Electron.IpcMainEvent} event The event args.
     * @param {string | {label: string, message: string} | undefined} data The message to send.
     */
    async ( event, data ) => {
        await consoleMessage( data );
    } );

var memoryCache = {};
ipcMain.on( 'cache:store',
    /**
     * Caches the given value with the given key.
     * 
     * @param {Electron.IpcMainEvent} event The event args.
     * @param {{key: string, value: any}} data 
     */
    ( event, data ) => {
        memoryCache[ data.key ] = data.value;
    } );

ipcMain.handle( 'get:nag-service-url', ( event, data ) => {
    let nagServiceUri = config.apiEndPoint;
    return nagServiceUri;
} );

ipcMain.on( 'cache:retrieve',
    /**
     * Retrieves the cached item with the given key.
     * 
     * @param {Electron.IpcMainEvent} event The event args.
     * @param {string} key The cache key.
     */
    ( event, key ) => {
        event.sender.send( `cache:retrieve:${key}`, memoryCache[ key ] );
    } );

ipcMain.on( 'cache:clear',
    /**
     * Clears the cached item with the given key.
     * 
     * @param {Electron.IpcMainEvent} event The event args.
     * @param {string} key The cache key.
     */
    ( event, key ) => {
        delete memoryCache[ key ];
    } );

var mainWindowRef = new ForwardRef( () => mainWindow ? mainWindow : null );
var logBootstrapRef = new ForwardRef( () => logBootstrap ? logBootstrap : null );

/**
 * Executes the scheduled backup.
 * 
 * @param {Date} intervalDate The interval date.
 * @param {LogMaintenanceRules} rules The log maintenance rules.
 * @param {string} cronSchedule The log cron schedule.
 */
const executeScheduledLogMaintenance = async ( intervalDate, rules, cronSchedule ) => {
    
    try {
        await logBootstrap.backupLogFiles( rules, userPreferences.logMaintenanceHistory?.length ?? 0 );
        userPreferences.addLogMaintenanceHistory( intervalDate, cronSchedule, true );
        
    } catch ( error ) {
        log.error( error );

    }

}

const scheduler = async () => {
    if ( userPreferences.logMaintenanceRules?.enableLogFileMaintenance === true && userPreferences.logMaintenanceRules?.logSchedule != null && userPreferences.logMaintenanceRules.maintenancePlan === LogMaintenancePlanTypes.BySchedule && !logBootstrap.isBackupProcessing ) {
        const logSchedule = Object.assign( new ScheduledTask(), userPreferences.logMaintenanceRules.logSchedule );
        const lastMaintained = userPreferences.lastMaintenanceCycleDate;
        var interval = cronParser.parseExpression( logSchedule.toCronSchedule() );

        if ( interval.hasPrev() ) {
            var prevInterval = interval.prev().toDate();
            
            if ( lastMaintained == null || lastMaintained.getTime() < prevInterval.getTime() ) {
                // Time to execute a backup!
                executeScheduledLogMaintenance( prevInterval, userPreferences.logMaintenanceRules, logSchedule.toCronSchedule() );
            }
            
        }

    }

    setTimeout( () => {
        scheduler();
    }, 1000 * 60 );
};

app.on( 'ready', function () {

    userPreferences.attachIpcEvents( mainWindowRef, sendTick, logBootstrapRef );
    winManager.attachIpcEvents( mainWindowRef, overlayDatabase, userPreferences, characterDatabase );
    dkpDatabase.attachIpcEvents( mainWindowRef, sendTick );
    fileDatabase.attachIpcEvents( mainWindowRef );
    triggerDatabase.attachIpcEvents( mainWindowRef, sendTick, fileDatabase, userPreferences );
    overlayDatabase.attachIpcEvents( mainWindowRef, sendTick, triggerDatabase, userPreferences );
    characterDatabase.attachIpcEvents( mainWindowRef, sendTick );
    logBootstrap.boostrapLogWatchers( mainWindowRef, app.isDev(), characterDatabase, sendTick, userPreferences, appLogException );
    gameResources.attachIpcEvents( mainWindowRef, userPreferences );
    ginaImporter.initGinaImporter( mainWindowRef, app.isDev() );
    combatDatabase.attachIpcEvents( mainWindowRef, sendTick );

    // TODO: Update this method with the new mouse.js implementation.
    // TODO: There may still be some renderer forwarding that needs to be removed.
    winManager.configureRendererMouseBlockingOnMoveResize( mainWindow ); 

    winManager.loadRenderer();

    triggerDatabase.onTriggerCreated( ( trigger ) => {
        characterDatabase.addToDisabledByDefaultTriggers( trigger.triggerId );
        sendTick( true );
    } );

    triggerDatabase.onTriggerDeleted( ( trigger ) => {
        characterDatabase.removeFromDisabledTriggers( trigger.triggerId );
        sendTick( true );
    } );

    setTimeout( () => {
        scheduler();
    }, 1000 );
} );

/** @type {Electron.WebContents[]} */
const activeWindowSubscribers = [];
/** @type {WinInfo} */
let activeWinInfo = undefined;

ipcMain.on( 'main:active-window:subscribe', ( event ) => {
    if ( !activeWindowSubscribers.includes( event.sender ) ) {
        activeWindowSubscribers.push( event.sender );
        activeWinInfo && event.sender.send( 'active-window:changed', activeWinInfo );
    }
} );

ipcMain.on( 'main:active-window:unsubscribe', ( event ) => {
    if ( activeWindowSubscribers.includes( event.sender ) ) {
        activeWindowSubscribers.splice( activeWindowSubscribers.indexOf( event.sender ), 1 );
    }
} );

const checkActiveWindow = async () => {
    let data = await activeWindow();

    if ( nagProcessId == undefined && (data?.owner?.name === 'Electron' || data?.owner?.name === 'EQ Nag') && data?.title === 'Nag' ) {
        nagProcessId = data?.owner?.processId;
    }
    
    if ( activeWinInfo?.id !== data?.id ) {
        activeWinInfo = new WinInfo( data, nagProcessId );

        for ( let i = activeWindowSubscribers.length - 1; i >= 0; i-- ) {
            const webContents = activeWindowSubscribers[ i ];
            if ( !webContents?.isDestroyed() ) {
                webContents.send( 'active-window:changed', activeWinInfo );
            } else {
                activeWindowSubscribers.splice( i, 1 );
            }
        }
    }

    setTimeout( checkActiveWindow, 100 );
};

// let x = userPreferences.everquestInstallFolder;

// Pulls the spell name
// document.querySelector('meta[property="og:title"]').getAttribute('content')

// Pulls the duration text
// document.evaluate("//strong[contains(., 'Duration:')]", document, null, XPathResult.ANY_TYPE, null ).iterateNext().nextSibling.nextSibling

// spell class, replace NEC with current character's class.
// document.evaluate("//div[contains(@class, 'db-infobox')]/table/tbody/tr/td/strong[contains(., 'NEC')]", document, null, XPathResult.ANY_TYPE, null ).iterateNext().textContent

// spell level, used to calculate duration based on current dur ext focus.
// +document.evaluate("//div[contains(@class, 'db-infobox')]/table/tbody/tr/td/strong[contains(., 'NEC')]", document, null, XPathResult.ANY_TYPE, null ).iterateNext().parentNode.nextSibling.textContent

// Get landing text
// document.evaluate("//blockquote[contains(., 'Cast on other')]", document, null, XPathResult.ANY_TYPE, null ).iterateNext().textContent.split('Cast on other: ')[1].split('Effect Fades: ')[0]

// https://forums.daybreakgames.com/eq/index.php?threads/focus-degradation-math.247916/#post-3642649
// Math.round(48/6*1.15)*6;
// Math.round(baseDuration/6 * (1 + extBonus/100))*6
// things needed: Name, Duration, spell level, current extended affliction amount and decay level