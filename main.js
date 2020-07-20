const { app, BrowserWindow, ipcMain } = require( "electron" );
const { autoUpdater } = require('electron-updater');
const url = require( "url" );
const path = require( "path" );
const { clipboard } = require( 'electron' );
const UserPreferencesStore = require( './data/user-preferences' );
const DkpDatabaseStore = require( './data/dkp-database' );
const TriggerDatabaseStore = require( './data/trigger-database' );
const OverlayDatabaseStore = require( "./data/overlay-database" );

var mainWindow, logWatcherWindow, testWindow;
const userPreferences = new UserPreferencesStore( {} );
const dkpDatabase = new DkpDatabaseStore();
const triggerDatabase = new TriggerDatabaseStore();
const overlayDatabase = new OverlayDatabaseStore();
var overlayDictionary = {};

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
        if ( overlayDictionary ) {
            for ( let key in overlayDictionary ) {
                if ( overlayDictionary.hasOwnProperty( key ) ) {
                    clearInterval( overlayDictionary[ key ].interval );
                    overlayDictionary[ key ].window.close();
                    overlayDictionary[ key ].window = null;
                }
            }
        }
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

    logWatcherWindow.on( 'closed', function () {
        logWatcherWindow = null;
    } );

    logWatcherWindow.webContents.once( 'dom-ready', () => {
        if ( userPreferences.logFile != null ) {
            logWatcherWindow.webContents.send( 'changeLogFile', userPreferences.logFile );
        }
        sendTick();
    } );

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

    let overlays = overlayDatabase.getAll();
    overlays?.forEach( m => {
        loadOverlay( m );
    } );
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

ipcMain.on( 'trigger:dialog:new', ( event, arg ) => {
    let triggerWindow = new BrowserWindow( {
        parent: mainWindow,
        modal: false,
        show: false,
        width: 700,
        height: 870,
        frame: false,
        webPreferences: {
            nodeIntegration: true,
            devTools: app.isDev(),
        }
    } );
    triggerWindow.loadURL( `file://${__dirname}/dist/index.html#/trigger/new` );
    // modal.loadURL( "https://www.sitepoint.com" );
    triggerWindow.once( "ready-to-show", () => {
        triggerWindow.show();
    } );
} );

ipcMain.on( 'trigger:dialog:edit', ( event, arg ) => {
    let triggerWindow = new BrowserWindow( {
        parent: mainWindow,
        modal: false,
        show: false,
        width: 700,
        height: 870,
        frame: false,
        webPreferences: {
            nodeIntegration: true,
            devTools: app.isDev(),
        }
    } );
    triggerWindow.loadURL( `file://${__dirname}/dist/index.html#/trigger/${arg}` );
    // modal.loadURL( "https://www.sitepoint.com" );
    triggerWindow.once( "ready-to-show", () => {
        triggerWindow.show();
    } );
} );

ipcMain.on( 'window:child:close', ( event, arg ) => {
    let bwin = BrowserWindow.fromWebContents( event.sender );
    bwin?.close();
} );

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
    let _triggers = triggerDatabase.getAll();
    mainWindow.webContents.send( 'tick', {
        dkpEntries: dkpDatabase.getAllUnentered(),
        logFile: userPreferences.logFile,
        voiceIndex: userPreferences.voiceIndex,
        triggers: _triggers,
        overlays: overlayDatabase.getAll()
    } );
    logWatcherWindow.webContents.send( 'tick', {
        triggers: _triggers
    } );
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

ipcMain.on( 'overlay:enable-edit', ( event, overlayId ) => {
    
    if ( overlayDictionary && overlayDictionary[ overlayId ] ) {
        // console.log( 'overlay enable', overlayId );
        // overlayDictionary[ overlayId ].window.transparent = false;
        overlayDictionary[ overlayId ].window.setIgnoreMouseEvents( false );
        overlayDictionary[ overlayId ].window.webContents.send( 'overlay:window:enable-edit' );
    } else {
        let model = overlayDatabase.find( overlayId );
        if ( model ) {
            loadOverlay( model );
        } else {
            console.error( `Could not find over lay ${overlayId}` );
        }
        // loadOverlay()
        // // testMethod();
        // let overlay = new BrowserWindow( {
        //     width: 800,
        //     height: 800,
        //     x: 100,
        //     y: 100,
        //     transparent: true,
        //     frame: false,
        //     webPreferences: {
        //         nodeIntegration: true,
        //     },
        //     skipTaskbar: true,
        // } );
        // overlay.loadFile( "./threads/overlay.html" );
        // // testWindow.loadURL(
        // //     url.format( {
        // //         pathname: path.join( __dirname, `/threads/testing.html` ),
        // //         protocol: "file:",
        // //         slashes: true
        // //     } )
        // // );
        // overlay.setIgnoreMouseEvents( true );
        // overlay.setAlwaysOnTop( true, "screen" );
        // // mainWindow.setIgnoreMouseEvents( true );
        // // mainWindow.setAlwaysOnTop( true, "screen" );

        // let interval = setInterval( () => {
        //     overlay.setAlwaysOnTop( true, "screen" );
        // }, 1000 );
        // // chokidar.watch( "E:\\everquest\\Logs\\eqlog_Halindar_aradune.txt" ).on( "all", ( event, path ) => {
        // //     console.log( event, path );
        // // } );

        // overlay.once( 'dom-ready', () => {
        //     overlay.webContents.send( 'enable-edit' );
        // } );
    
        // overlayDictionary[ overlayId ] = { window: overlay, interval: interval };
    }
} );

ipcMain.on( 'overlay:disable-edit', ( event, overlayId ) => {
    
    if ( overlayDictionary && overlayDictionary[ overlayId ] ) {
        overlayDictionary[ overlayId ].window.setIgnoreMouseEvents( true );
        overlayDictionary[ overlayId ].window.webContents.send( 'overlay:window:disable-edit' );
    } else {
        let model = overlayDatabase.find( overlayId );
        if ( model ) {
            loadOverlay( model, false );
        } else {
            console.error( `Could not find over lay ${overlayId}` );
        }
    }
} );

/**
 * Displays the given overlay window.
 * 
 * @param {OverlayWindow} model The overlay settings object.
 * @param {boolean} enableEdit If true, edit mode will be enabled.
 */
function loadOverlay( model, enableEdit ) {
    
    let overlay = new BrowserWindow( {
        width: model.windowWidth > 0 ? model.windowWidth : 800,
        height: model.windowHeight > 0 ? model.windowHeight : 800,
        x: model.x > 0 ? model.x : null,
        y: model.y > 0 ? model.y : null,
        transparent: true,
        frame: false,
        resizable: true,
        webPreferences: {
            nodeIntegration: true,
            devTools: app.isDev(),
        },
        skipTaskbar: true,
    } );
    overlay.loadFile( "./threads/overlay.html" );
    overlay.setIgnoreMouseEvents( true );
    // overlay.webContents.openDevTools();
    overlay.setAlwaysOnTop( true, "screen" );

    let interval = setInterval( () => {
        overlay.setAlwaysOnTop( true, "screen" );
    }, 1000 );

    if ( enableEdit ) {
        overlay.webContents.once( 'dom-ready', () => {
            console.log( 'sending under edit mode' );
            overlay.webContents.send( 'overlay:window:enable-edit' );
            overlay.setIgnoreMouseEvents( false );
            overlay.webContents.send( 'overlay:window:model', model );
            // overlay.transparent = false;
        } );
    } else {
        console.log( 'not in edit mode' );
        overlay.webContents.once( 'dom-ready', () => {
            // overlay.webContents.send( 'overlay:window:enable-edit' );
            // overlay.setIgnoreMouseEvents( false );
            // console.log( 'sending no edit mode' );
            overlay.webContents.send( 'overlay:window:model', model );
            // overlay.transparent = false;
        } );
    }

    overlay.on( 'resize', function ( e ) {
        let bounds = overlay.webContents.getOwnerBrowserWindow().getBounds();
        model.windowWidth = bounds.width;
        model.windowHeight = bounds.height;
        overlayDatabase.update( model );
    } );

    overlay.on( 'move', function () {
        let bounds = overlay.webContents.getOwnerBrowserWindow().getBounds();
        // console.log( 'moving', bounds.x );
        model.x = bounds.x;
        model.y = bounds.y;
        overlayDatabase.update( model );
    } );

    overlayDictionary[ model.overlayId ] = { window: overlay, interval: interval };
    
}

// var calledCount = 0;
ipcMain.on( 'overlay:close-test', ( event, overlayId ) => {
    if ( overlayDictionary && overlayDictionary[ overlayId ] ) {
        clearInterval( overlayDictionary[ overlayId ].interval );
        overlayDictionary[ overlayId ].window.close();
        overlayDictionary[ overlayId ].window = null;
    }
} );

ipcMain.on( 'overlay:dialog:edit', ( event, overlayId ) => {
    // let overlayModel = overlayDatabase.find( overlayId );
    let overlayEditorDialog = new BrowserWindow( {
        parent: mainWindow,
        modal: false,
        show: false,
        width: 700,
        height: 870,
        frame: false,
        webPreferences: {
            nodeIntegration: true,
            devTools: app.isDev(),
        }
    } );
    overlayEditorDialog.loadURL( `file://${__dirname}/dist/index.html#/overlay/${overlayId}` );
    // modal.loadURL( "https://www.sitepoint.com" );
    overlayEditorDialog.once( 'dom-read', () => {
        // overlayEditorDialog.webContents.send( 'overlay:window:model', overlayModel );
    } );
    overlayEditorDialog.once( "ready-to-show", () => {
        overlayEditorDialog.show();
    } );
} );

ipcMain.on( 'overlay:broadcast', ( event, model ) => {
    if ( overlayDictionary && overlayDictionary[ model.overlayId ] ) {
        overlayDictionary[ model.overlayId ].window.send( 'overlay:window:model', model );
    }
})

triggerDatabase.attachIpcEvents( mainWindow, sendTick );
overlayDatabase.attachIpcEvents( mainWindow, sendTick );
