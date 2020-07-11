const { app, BrowserWindow, ipcMain } = require( "electron" );
const { autoUpdater } = require('electron-updater');
const url = require( "url" );
const path = require( "path" );
const { clipboard } = require( 'electron' );
const UserPreferencesStore = require( './data/user-preferences' );
const DkpDatabaseStore = require( './data/dkp-database' );

var mainWindow, logWatcherWindow, testWindow;
const userPreferences = new UserPreferencesStore( {} );
const dkpDatabase = new DkpDatabaseStore();

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
    mainWindow.webContents.openDevTools();

    mainWindow.on( 'closed', function () {
        logWatcherWindow.close();
        mainWindow = null
        logWatcherWindow = null;
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
        show: false,
        webPreferences: { nodeIntegration: true, webSecurity: false },
    } );
    logWatcherWindow.webContents.openDevTools();
    logWatcherWindow.loadFile("./threads/log-watcher.html");

    if ( userPreferences.logFile != null ) {
        logWatcherWindow.webContents.once( 'dom-ready', () => {
            logWatcherWindow.webContents.send( 'changeLogFile', userPreferences.logFile );
        } );
    }

    mainWindow.webContents.once( 'dom-ready', () => {
        autoUpdater.checkForUpdatesAndNotify().then( result => {
            mainWindow.webContents.send( 'console:log', result );
        }, error => {
            mainWindow.webContents.send( 'console:log', error );
        } );
        sendTick();
    } );

    // // testMethod();
    // testWindow = new BrowserWindow( {
    //     width: userPreferences.windowWidth,
    //     height: userPreferences.windowHeight,
    //     x: userPreferences.windowX,
    //     y: userPreferences.windowY,
    //     transparent: true,
    //     frame: false,
    //     webPreferences: {
    //         nodeIntegration: true,
    //     },
    // } );
    // testWindow.loadURL(
    //     url.format( {
    //         pathname: path.join( __dirname, `/threads/testing.html` ),
    //         protocol: "file:",
    //         slashes: true
    //     } )
    // );
    // testWindow.setIgnoreMouseEvents( true );
    // testWindow.setAlwaysOnTop( true, "screen" );
    // mainWindow.setIgnoreMouseEvents( true );
    // mainWindow.setAlwaysOnTop( true, "screen" );

    // setInterval( () => {
    //     mainWindow.setAlwaysOnTop( true, "screen" );
    // }, 1000 );
    // chokidar.watch( "E:\\everquest\\Logs\\eqlog_Halindar_aradune.txt" ).on( "all", ( event, path ) => {
    //     console.log( event, path );
    // } );
};

app.commandLine.appendSwitch( 'enable-speech-dispatcher' );

app.on( 'ready', createWindow )

app.on( 'window-all-closed', function () {
    if ( process.platform !== 'darwin' ) app.quit()
} );

app.on( 'activate', function () {
    if ( mainWindow === null ) createWindow()
} );

function openModal() {
    const { BrowserWindow } = require( "electron" );
    let modal = new BrowserWindow( {
        parent: mainWindow,
        modal: true,
        show: false,
    } );
    modal.loadURL( "https://www.sitepoint.com" );
    modal.once( "ready-to-show", () => {
        modal.show();
    } );
}

ipcMain.on( "openModal", ( event, arg ) => {
    openModal();
    mainWindow.webContents.send( "info", {
        msg: "hello from main process",
    } );
} );

ipcMain.on( 'logSelected', ( event, arg ) => {
    userPreferences.logFile = arg;
    logWatcherWindow.webContents.send( 'changeLogFile', arg );
    event.sender.send( 'changeLogFile', arg );
} );

ipcMain.on( 'selectVoice', ( event, arg ) => {
    userPreferences.voiceIndex = arg;
} );

ipcMain.on( 'addDkpEntry', ( event, data ) => {
    mainWindow.webContents.send( 'addDkpEntry', data );
    dkpDatabase.add( data );
    sendTick();
} );

ipcMain.on( 'removeLastDkpEntry', ( event, data ) => {
    dkpDatabase.removeIndex( dkpDatabase.count - 1 );
    sendTick();
} );

ipcMain.on( 'replaceLastDkpEntry', ( event, data ) => {
    dkpDatabase.removeIndex( dkpDatabase.count - 1 );
    dkpDatabase.add( data );
    sendTick( event );
} );

ipcMain.on( 'requestDkpEntries', ( event, data ) => {
    event.sender.webContents.send( 'transmitDkpDatabase', dkpDatabase.getAllUnentered() );
} );

ipcMain.on( 'removeDkpAward', ( event, data ) => {
    let success = dkpDatabase.remove( data );
    if ( success ) {
        event.sender.webContents.send( 'dkpAwardRemoved', data.entryId );
    }
} );

ipcMain.on( 'quitApp', ( event, data ) => { app.quit(); } );

function sendTick() {
    mainWindow.webContents.send( 'tick', { dkpEntries: dkpDatabase.getAllUnentered(), logFile: userPreferences.logFile, voiceIndex: userPreferences.voiceIndex } );
}

autoUpdater.signals.updateDownloaded( () => {
    mainWindow.webContents.send( 'update_downloaded' );
} );

autoUpdater.on( 'update-available', () => {
    mainWindow.webContents.send( 'update_available' );
} );

ipcMain.on( 'restart_app', () => {
    autoUpdater.quitAndInstall();
} );

ipcMain.on( 'app_version', ( event ) => {
    event.sender.send( 'app_version', { version: app.getVersion() } );
} );

ipcMain.on( 'clipboard:writeText', ( event, value ) => {
    clipboard.writeText( value );
} );

ipcMain.on( 'dkp:reset', ( event, value ) => {
    dkpDatabase.clear();
    sendTick();
} );

ipcMain.on( 'dkp:markAsEntered', ( event, entries ) => {
    dkpDatabase.markRangeEntered( entries );
    sendTick();
} );
