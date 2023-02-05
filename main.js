const { app, BrowserWindow, ipcMain, protocol, session, screen, Tray, Menu } = require( "electron" );
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
const CombatParser = require( "./src/electron/utilities/combat-parser" );
const { IpcMessage } = require( "./src/electron/data/models/common" );
const { LogFileLocation } = require( "./src/electron/data/log-file-location" );
const VerifiedPlayersStore = require( "./src/electron/data/verified-players" );

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
const verifiedPlayersDatabase = new VerifiedPlayersStore();
/** @type {Tray} */
var trayMenu = null;

GH_TOKEN = "e3460400ae1273a5cac83e1b86a5aceae7f8bab7";

autoUpdater.logger = log;

unhandled({
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

function createWindow() {
    mainWindow = new BrowserWindow( {
        width: userPreferences.windowWidth,
        height: userPreferences.windowHeight,
        x: userPreferences.windowX,
        y: userPreferences.windowY,
        //   transparent: true,
        frame: false,
        webPreferences: {
            nodeIntegration: true,
            devTools: app.isDev(),
        },
        show: false,
    } );

    mainWindow.setBackgroundColor( '#1a1a1a' );

    trayMenu = createTray();

    mainWindow.loadURL(
        url.format( {
            pathname: path.join( __dirname, `/dist/index.html` ),
            protocol: "file:",
            slashes: true
        } )
    );
    // Open the DevTools.
    if ( app.isDev() ) {
        mainWindow.webContents.openDevTools( { mode: 'undocked' } );
    }

    mainWindow.on( 'closed', function () {
        mainWindow = null;
    } );

    mainWindow.on( 'close', function () {
        winManager.unload();
        logBootstrap.unload();
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
        autoUpdater.checkForUpdates();
        setInterval( () => {
            autoUpdater.checkForUpdates();
        }, updateCheckInterval );

        // TODO: Remove this in a few versions.
        let overlays = overlayDatabase.getAll();
        overlays.forEach( overlay => {
            mainWindow.webContents.send( 'color:darken', { overlayId: overlay.overlayId, color: overlay.timerColor } );
        } );
    } );

    mainWindow.once( 'ready-to-show', () => {
        if ( !userPreferences.minimizeToTrayOnLoad ) {
            mainWindow.show();
        }
    } );
    
};

app.isDev = () => enableDevMode === true && process.defaultApp === true;

app.commandLine.appendSwitch( 'enable-speech-dispatcher' );

app.on( 'before-quit', () => {
    trayMenu.destroy();
    trayMenu = null;
} );

app.on( 'ready', function () {
    
    winManager.onReady();
    screen.on( 'display-metrics-changed', ( e, newDisplay ) => {
        log.info( 'screen metrics have changed.', e, newDisplay );
        winManager.checkWindowPosition();
    } );
    protocol.interceptFileProtocol( 'file', ( req, callback ) => {
        let filePath = new url.URL( req.url ).pathname;
        if ( process.platform === 'win32' ) {

            if ( filePath.match( /^\/[A-Za-z]:/ ) ) {
                // If it begins with a slash, remove it.
                filePath = filePath.slice( 1 );
            }

            if ( filePath.match( /^[A-Za-z]:\/(css|img|js|fonts)/ ) ) {
                filePath = path.join( app.getAppPath(), 'dist', filePath.slice( 3 ) );
            } else if ( filePath.match( /^[A-Za-z]:\/.*\.(js|css|png|jpeg|jpg|ico|svg|woff|woff2|ttf)$/ ) ) {
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

        callback( path.normalize( filePath ) );
    } );
    createWindow();
} );

app.on( 'window-all-closed', function () {
    if ( process.platform !== 'darwin' ) app.quit()
} );

app.on( 'activate', function () {
    if ( mainWindow === null ) createWindow()
} );

// TODO: Remove this in a few versions.
ipcMain.on( `color:darken`, ( e, data ) => {
    let overlay = overlayDatabase.find( data.overlayId );
    overlay.timerBackgroundColor = data.color;
    overlayDatabase.update( overlay );
} );

ipcMain.on( 'app:log:exception', ( event, data ) => {
    log.error( data );
} );

ipcMain.on( 'app:log:info', ( event, data ) => {
    log.info( data );
} );

ipcMain.on( 'app:quit', ( event, data ) => { app.quit(); } );

ipcMain.on( 'app:minimize', ( event, data ) => {
    mainWindow.minimize();
} );

ipcMain.on( 'app:minimize:tray', ( event, data ) => {
    mainWindow.hide();
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

ipcMain.on( 'main:console:log', ( event, data ) => { mainWindow.webContents.send( 'console:log', data ); } );

function sendTick() {
    let _triggers = triggerDatabase.getAll();
    let _folders = triggerDatabase.getFolders();
    let tickData = {
        dkpEntries: dkpDatabase.getAllUnentered(),
        logFile: userPreferences.logFile,
        voiceIndex: userPreferences.voiceIndex,
        masterVolume: userPreferences.masterVolume,
        triggers: _triggers,
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
    };
    mainWindow.webContents.send( 'tick', tickData );
    logBootstrap.tick( tickData, characterDatabase );

    if ( winManager.ginaImportWindow != null ) {
        winManager.ginaImportWindow.send( 'tick', tickData );
    }
    
}

/** @type {import("electron-updater").UpdateInfo} */
var updateInfo = null;

autoUpdater.on( 'update-downloaded', () => {
    log.info( 'update-downloaded executed' );
    mainWindow.webContents.send( 'update_downloaded', updateInfo );
    winManager.eachWindow( ( window, identifier ) => {
        log.info( `Sending update to ${identifier}` );
        // TODO: Load update notes markdown.
        window.webContents.send( 'update_downloaded', updateInfo );
    } );
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

var mainWindowRef = new ForwardRef( () => mainWindow ? mainWindow : null );
var logBootstrapRef = new ForwardRef( () => logBootstrap ? logBootstrap : null );

app.on( 'ready', function () {

    userPreferences.attachIpcEvents( mainWindowRef, sendTick, logBootstrapRef );
    winManager.attachIpcEvents( mainWindowRef, overlayDatabase, userPreferences );
    dkpDatabase.attachIpcEvents( mainWindowRef, sendTick );
    fileDatabase.attachIpcEvents( mainWindowRef );
    triggerDatabase.attachIpcEvents( mainWindowRef, sendTick, fileDatabase, userPreferences );
    overlayDatabase.attachIpcEvents( mainWindowRef, sendTick, triggerDatabase );
    characterDatabase.attachIpcEvents( mainWindowRef, sendTick );
    logBootstrap.boostrapLogWatchers( mainWindowRef, app.isDev(), characterDatabase, sendTick );
    gameResources.attachIpcEvents( mainWindowRef, userPreferences );
    ginaImporter.initGinaImporter( mainWindowRef, app.isDev() );
    verifiedPlayersDatabase.attachIpcEvents( mainWindowRef, sendTick );

    winManager.configureRendererMouseBlockingOnMoveResize( mainWindow );

    winManager.loadRenderer();
} );

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