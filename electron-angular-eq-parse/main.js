const { app, BrowserWindow, ipcMain } = require("electron");
const url = require( "url" );
const path = require( "path" );
const UserPreferencesStore = require( './data/user-preferences' );

// const Store = require( './data/store' );
// const StoreTs = require( "./data/store-ts" );

// const chokidar = require( "chokidar" );
// const testMethod = require( './threads/testing' );
// const test = new StoreTs();
let mainWindow, fileWatcherWindow;
const userPreferences = new UserPreferencesStore( {} );
// const preferences = new Store( {
//     // We'll call our data file 'user-preferences'
//     configName: 'user-preferences',
//     defaults: {
//         // 800x600 is the default size of our window
//         windowBounds: { width: 800, height: 600 }
//     }
// } );


function createWindow() {
    mainWindow = new BrowserWindow({
      width: 800,
      height: 600,
    //   transparent: true,
    //   frame: false,
      webPreferences: {
        nodeIntegration: true,
      },
    });

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
        mainWindow = null
        fileWatcherWindow = null;
    } );

      // create hidden worker window
    fileWatcherWindow = new BrowserWindow({
      width: 800,
      height: 600,
      webPreferences: { nodeIntegration: true, webSecurity: false },
    });
    fileWatcherWindow.webContents.openDevTools();
    fileWatcherWindow.loadFile("./threads/file-watcher.html");

    // testMethod();
    // mainWindow.setIgnoreMouseEvents( true );
    // mainWindow.setAlwaysOnTop( true, "screen" );

    // setInterval( () => {
    //     mainWindow.setAlwaysOnTop( true, "screen" );
    // }, 1000 );
    // chokidar.watch( "E:\\everquest\\Logs\\eqlog_Halindar_aradune.txt" ).on( "all", ( event, path ) => {
    //     console.log( event, path );
    // } );
};

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

