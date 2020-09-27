const { app, BrowserWindow, ipcMain } = require( "electron" );
const { autoUpdater } = require('electron-updater');
const url = require( "url" );
const path = require( "path" );
const { clipboard } = require( 'electron' );
const UserPreferencesStore = require( './src/electron/data/user-preferences' );
const DkpDatabaseStore = require( './src/electron/data/dkp-database' );
const TriggerDatabaseStore = require( './src/electron/data/trigger-database' );
const OverlayDatabaseStore = require( "./src/electron/data/overlay-database" );
const ForwardRef = require( './src/electron/forward-ref' );
const WindowManager = require( './src/electron/window-manager' );

var mainWindow, logWatcherWindow, testWindow;
const winManager = new WindowManager(__dirname);
const userPreferences = new UserPreferencesStore( {} );
const dkpDatabase = new DkpDatabaseStore();
const triggerDatabase = new TriggerDatabaseStore();
const overlayDatabase = new OverlayDatabaseStore();
// var overlayDictionary = {};

GH_TOKEN = "e3460400ae1273a5cac83e1b86a5aceae7f8bab7";

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
    } );

    mainWindow.loadURL(
        url.format( {
            pathname: path.join( __dirname, `/dist/index.html` ),
            protocol: "file:",
            slashes: true
        } )
    );
    // Open the DevTools.
    if ( app.isDev() ) {
        mainWindow.webContents.openDevTools();
    }

    mainWindow.on( 'closed', function () {
        mainWindow = null
        logWatcherWindow = null;
    } );

    mainWindow.on( 'close', function () {
        logWatcherWindow?.close();
        winManager.unload();
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

    // create hidden worker window
    logWatcherWindow = new BrowserWindow( {
        //   width: 800,
        //   height: 600,
        show: true,
        webPreferences: { nodeIntegration: true, webSecurity: false },
    } );
    logWatcherWindow.webContents.openDevTools();
    logWatcherWindow.loadFile("./src/electron/threads/log-watcher.html");

    logWatcherWindow.on( 'closed', function () {
        logWatcherWindow = null;
    } );

    logWatcherWindow.webContents.once( 'dom-ready', () => {
        if ( userPreferences.logFile != null ) {
            logWatcherWindow.webContents.send( 'log:changed', userPreferences.logFile );
        }
        sendTick();
    } );
    logWatcherWindow.setPosition( 100, 500 );

    mainWindow.webContents.once( 'dom-ready', () => {
        autoUpdater.checkForUpdatesAndNotify().then( result => {
            mainWindow.webContents.send( 'console:log', result );
        }, error => {
            mainWindow.webContents.send( 'console:log', error );
        } );
        sendTick();
    } );

    winManager.loadOverlays( overlayDatabase );
    
};

app.isDev = () => process.defaultApp === true;

app.commandLine.appendSwitch( 'enable-speech-dispatcher' );

app.on( 'ready', createWindow )

app.on( 'window-all-closed', function () {
    if ( process.platform !== 'darwin' ) app.quit()
} );

app.on( 'activate', function () {
    if ( mainWindow === null ) createWindow()
} );

ipcMain.on( 'app:quit', ( event, data ) => { app.quit(); } );

function sendTick() {
    let _triggers = triggerDatabase.getAll();
    mainWindow.webContents.send( 'tick', {
        dkpEntries: dkpDatabase.getAllUnentered(),
        logFile: userPreferences.logFile,
        voiceIndex: userPreferences.voiceIndex,
        triggers: _triggers,
        overlays: overlayDatabase.getAll(),
        damageDealtOverlayId: userPreferences.damageDealtOverlayId,
        damageReceivedOverlayId: userPreferences.damageReceivedOverlayId,
        enableFct: userPreferences.enableFct,
    } );
    logWatcherWindow.webContents.send( 'tick', {
        triggers: _triggers,
        damageDealtOverlayId: userPreferences.damageDealtOverlayId,
        damageReceivedOverlayId: userPreferences.damageReceivedOverlayId,
        enableFct: userPreferences.enableFct,
    } );
}

autoUpdater.signals.updateDownloaded( () => {
    mainWindow.webContents.send( 'update_downloaded' );
} );

autoUpdater.on( 'update-available', () => {
    mainWindow.webContents.send( 'update_available' );
} );

ipcMain.on( 'app:restart', () => {
    autoUpdater.quitAndInstall();
} );

ipcMain.on( 'app:version', ( event ) => {
    event.sender.send( 'app:version', { version: app.getVersion() } );
} );

ipcMain.on( 'clipboard:writeText', ( event, value ) => {
    clipboard.writeText( value );
} );

var mainWindowRef = new ForwardRef( () => mainWindow ? mainWindow : null );
var logWatcherRef = new ForwardRef( () => logWatcherWindow ? logWatcherWindow : null );

userPreferences.attachIpcEvents( mainWindowRef, logWatcherRef, sendTick );
winManager.attachIpcEvents( mainWindowRef, sendTick, overlayDatabase );
dkpDatabase.attachIpcEvents( mainWindowRef, sendTick );
triggerDatabase.attachIpcEvents( mainWindowRef, sendTick );
overlayDatabase.attachIpcEvents( mainWindowRef, sendTick );
