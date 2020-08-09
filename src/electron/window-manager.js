const { app, BrowserWindow, ipcMain, screen } = require( "electron" );
const ForwardRef = require( './forward-ref' );
const OverlayDatabaseStore = require( "./data/overlay-database" );

var overlayDictionary = {};

class WindowManager {

    #dirname;

    constructor(dirname) {
        this.#dirname = dirname;
    }










    /**
     * Attaches store events to ipc main and dispatches react events to the main window.
     * 
     * @param {ForwardRef} mainWindowRef The main window of the application.
     * @param {function} sendTick The send tick method.
     * @param {OverlayDatabaseStore} overlayDatabase The overlay database.
     */
    attachIpcEvents( mainWindowRef, sendTick, overlayDatabase ) {

        ipcMain.on( 'trigger:dialog:new', ( event, arg ) => {
            let triggerWindow = new BrowserWindow( {
                parent: mainWindowRef.reference,
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
            triggerWindow.loadURL( `file://${this.#dirname}/dist/index.html#/trigger/new` );
            triggerWindow.once( "ready-to-show", () => {
                triggerWindow.show();
            } );
        } );
        
        ipcMain.on( 'trigger:dialog:edit', ( event, arg ) => {
            let triggerWindow = new BrowserWindow( {
                parent: mainWindowRef.reference,
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
            triggerWindow.loadURL( `file://${this.#dirname}/dist/index.html#/trigger/${arg}` );
            triggerWindow.once( "ready-to-show", () => {
                triggerWindow.show();
            } );
        } );

        ipcMain.on( 'trigger:dialog:resize', ( event, size ) => {
            let bwin = BrowserWindow.fromWebContents( event.sender );

            if ( size?.width && size?.height ) {
                bwin.setSize( size.width, size.height );
                bwin.setPosition( ( screen.getPrimaryDisplay().workAreaSize.width / 2 ) - ( size.width / 2 ), ( screen.getPrimaryDisplay().workAreaSize.height / 2 ) - ( size.height / 2 ) );
            } else {
                bwin.setSize( 700, 870 );
                bwin.setPosition( ( screen.getPrimaryDisplay().workAreaSize.width / 2 ) - ( 700 / 2 ), ( screen.getPrimaryDisplay().workAreaSize.height / 2 ) - ( 870 / 2 ) );
            }

        } );
        
        ipcMain.on( 'window:child:close', ( event, arg ) => {
            let bwin = BrowserWindow.fromWebContents( event.sender );
            bwin?.close();
        } );

        ipcMain.on( 'overlay:enable-edit', ( event, overlayId ) => {
            if ( overlayDictionary && overlayDictionary[ overlayId ] ) {
                overlayDictionary[ overlayId ].window.setIgnoreMouseEvents( false );
                overlayDictionary[ overlayId ].window.webContents.send( 'overlay:window:enable-edit' );
            } else {
                let model = overlayDatabase.find( overlayId );
                if ( model ) {
                    loadOverlay( model, overlayDatabase, true );
                } else {
                    console.error( `Could not find over lay ${overlayId}` );
                }
            }
        } );
        
        ipcMain.on( 'overlay:disable-edit', ( event, overlayId ) => {
            
            if ( overlayDictionary && overlayDictionary[ overlayId ] ) {
                overlayDictionary[ overlayId ].window.setIgnoreMouseEvents( true );
                overlayDictionary[ overlayId ].window.webContents.send( 'overlay:window:disable-edit' );
            } else {
                let model = overlayDatabase.find( overlayId );
                if ( model ) {
                    loadOverlay( model, overlayDatabase, false );
                } else {
                    console.error( `Could not find over lay ${overlayId}` );
                }
            }
        } );

        ipcMain.on( 'overlay:highlight', ( event, overlayId ) => {
            if ( overlayDictionary && overlayDictionary[ overlayId ] ) {
                overlayDictionary[ overlayId ].window.webContents.send( 'overlay:window:highlight' );
            }
        } );
        
        ipcMain.on( 'overlay:dim', ( event, overlayId ) => {
            if ( overlayDictionary && overlayDictionary[ overlayId ] ) {
                overlayDictionary[ overlayId ].window.webContents.send( 'overlay:window:dim' );
            }
        } );
        
        ipcMain.on( 'overlay:dialog:edit', ( event, overlayId ) => {
            let overlayEditorDialog = new BrowserWindow( {
                parent: mainWindowRef.reference,
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
            overlayEditorDialog.loadURL( `file://${this.#dirname}/dist/index.html#/overlay/${overlayId}` );
            overlayEditorDialog.once( 'dom-read', () => {
                
            } );
            overlayEditorDialog.once( "ready-to-show", () => {
                overlayEditorDialog.show();
            } );
        } );
        
        ipcMain.on( 'overlay:broadcast', ( event, model ) => {
            if ( overlayDictionary && overlayDictionary[ model.overlayId ] ) {
                overlayDictionary[ model.overlayId ].window.send( 'overlay:window:model', model );
            }
        } );
        
        ipcMain.on( 'overlay:send:component', ( event, component ) => {
            if ( overlayDictionary && overlayDictionary[ component.overlayId ] ) {
                overlayDictionary[ component.overlayId ].window.send( 'overlay:receive:component', component );
            }
        } );

    }










    /**
     * Loads all overlays.
     * 
     * @param {OverlayDatabaseStore} overlayDatabase The overlay database.
     */
    loadOverlays( overlayDatabase ) {

        let overlays = overlayDatabase.getAll();
        overlays?.forEach( m => {
            loadOverlay( m, overlayDatabase );
        } );

    }










    /**
     * Unloads all windows.
     */
    unload() {
        if ( overlayDictionary ) {
            for ( let key in overlayDictionary ) {
                if ( overlayDictionary.hasOwnProperty( key ) ) {
                    clearInterval( overlayDictionary[ key ].interval );
                    overlayDictionary[ key ].window.close();
                    overlayDictionary[ key ].window = null;
                }
            }
        }
    }
}










/**
 * Displays the given overlay window.
 * 
 * @param {OverlayWindow} model The overlay settings object.
 * @param {OverlayDatabaseStore} overlayDatabase The overlay database.
 * @param {boolean} enableEdit If true, edit mode will be enabled.
 */
function loadOverlay( model, overlayDatabase, enableEdit ) {
    
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
    overlay.loadFile( "./src/electron/threads/overlay.html" );
    overlay.setIgnoreMouseEvents( true );
    overlay.setAlwaysOnTop( true, "screen" );

    let interval = setInterval( () => {
        overlay.setAlwaysOnTop( true, "screen" );
    }, 1000 );

    if ( enableEdit ) {
        overlay.webContents.once( 'dom-ready', () => {
            overlay.webContents.send( 'overlay:window:enable-edit' );
            overlay.setIgnoreMouseEvents( false );
            overlay.webContents.send( 'overlay:window:model', model );
        } );
    } else {
        overlay.webContents.once( 'dom-ready', () => {
            overlay.webContents.send( 'overlay:window:model', model );
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
        model.x = bounds.x;
        model.y = bounds.y;
        overlayDatabase.update( model );
    } );

    overlayDictionary[ model.overlayId ] = { window: overlay, interval: interval };
    
}

module.exports = WindowManager;
