const { app, BrowserWindow, ipcMain, screen } = require( "electron" );
const ForwardRef = require( './forward-ref' );
const OverlayDatabaseStore = require( "./data/overlay-database" );
const UserPreferencesStore = require( "./data/user-preferences" );
const { OverlayWindow } = require( "./data/models/overlay-window" );
const ArrayUtilities = require( "./utilities/arrays" );
const log = require( 'electron-log' );

/** @type {Record<string, {window: BrowserWindow, interval: NodeJS.Timer, model: OverlayWindow, editMode: boolean}>} */
var overlayDictionary = {};
var criticalPadding = 300;

/** @type {Electron.Size} */
var defaultSize;

class WindowManager {

    /** @type {BrowserWindow} */
    ginaImportWindow;

    /** @type {BrowserWindow} */
    triggerLibraryWindow;

    /** @type {BrowserWindow} */
    #mainWindow;

    #dirname;

    /** @type {UserPreferencesStore} */
    #userPrefDb;

    constructor( dirname ) {
        this.#dirname = dirname;
    }










    /**
     * Initialize on ready variables.
     */
    onReady() {
        defaultSize = screen.getPrimaryDisplay().workAreaSize;
    }










    /**
     * Attaches store events to ipc main and dispatches react events to the main window.
     * 
     * @param {ForwardRef} mainWindowRef The main window of the application.
     * @param {OverlayDatabaseStore} overlayDatabase The overlay database.
     * @param {UserPreferencesStore} userPreferencesDatabase The user pref database.
     */
    attachIpcEvents( mainWindowRef, overlayDatabase, userPreferencesDatabase ) {

        this.#userPrefDb = userPreferencesDatabase;
        this.#mainWindow = mainWindowRef.reference;

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
            let url = `file://${this.#dirname}/dist/index.html#/trigger/new`;
            if ( arg ) {
                url += `/${arg}`;
            }
            triggerWindow.loadURL( url );
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
            let model = overlayDatabase.find( overlayId );

            if ( overlayDictionary && overlayDictionary[ overlayId ] ) {
                overlayDictionary[ overlayId ].window.setIgnoreMouseEvents( false );
                overlayDictionary[ overlayId ].window.webContents.send( 'overlay:window:enable-edit' );
                overlayDictionary[ overlayId ].editMode = true;
            } else {
                if ( model ) {
                    loadOverlay( model, overlayDatabase, true, () => {
                        if ( model.overlayType === 'FCT' ) {
                            overlayDictionary[ overlayId ].window.webContents.send( 'fctStyles', this.#userPrefDb.fctStyles );
                        }
                    } );
                } else {
                    console.error( `Could not find over lay ${overlayId}` );
                    return;
                }
            }
            
            if ( model?.overlayType === 'FCT' ) {
                overlayDictionary[ overlayId ].window.setBounds( {
                    x: model.x,
                    y: model.y,
                    width: model.windowWidth,
                    height: model.windowHeight
                } );
            }
        } );
        
        ipcMain.on( 'overlay:disable-edit', ( event, overlayId ) => {
            let model = overlayDatabase.find( overlayId );
            
            if ( overlayDictionary && overlayDictionary[ overlayId ] ) {
                overlayDictionary[ overlayId ].window.setIgnoreMouseEvents( true );
                overlayDictionary[ overlayId ].window.webContents.send( 'overlay:window:disable-edit' );
            } else {
                if ( model ) {
                    loadOverlay( model, overlayDatabase, false, () => { } );
                } else {
                    console.error( `Could not find over lay ${overlayId}` );
                    return;
                }
            }
            
            if ( model?.overlayType === 'FCT' ) {
                overlayDictionary[ overlayId ].window.setBounds( {
                    x: model.x - criticalPadding,
                    y: model.y - criticalPadding,
                    width: model.windowWidth + criticalPadding * 2,
                    height: model.windowHeight + criticalPadding * 2
                } );
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
            let posData = userPreferencesDatabase.getOverlayEditorPosition( overlayId );
            let overlayEditorDialog = new BrowserWindow( {
                parent: mainWindowRef.reference,
                modal: false,
                show: false,
                width: 700,
                height: 870,
                frame: false,
                x: posData == null ? null : posData.x,
                y: posData == null ? null : posData.y,
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
            overlayEditorDialog.on( 'move', function () {
                let bounds = overlayEditorDialog.webContents.getOwnerBrowserWindow().getBounds();
                userPreferencesDatabase.setOverlayeEditorPosition( overlayId, bounds.x, bounds.y );
            } );
        } );
        
        ipcMain.on( 'overlay:dialog:arrange', ( event ) => {
            let overlayMoveDialog = new BrowserWindow( {
                parent: mainWindowRef.reference,
                modal: false,
                show: false,
                width: 400,
                height: 225,
                frame: false,
                resizable: false,
                movable: true,
                webPreferences: {
                    nodeIntegration: true,
                    devTools: app.isDev(),
                }
            } );
            overlayMoveDialog.loadURL( `file://${this.#dirname}/dist/index.html#/overlay/arrange` );
            overlayMoveDialog.once( 'dom-read', () => {
                
            } );

            ArrayUtilities.enumerateDictionary( overlayDictionary, ( item, key ) => clearInterval( item.interval ) );
            let moveInterval = setInterval( () => {
                overlayMoveDialog.setAlwaysOnTop( true, "screen-saver" );
            }, 500 );

            overlayMoveDialog.on( 'close', function () {
                clearInterval( moveInterval );
                ArrayUtilities.enumerateDictionary( overlayDictionary, ( item, key ) => {
                    item.interval = setInterval( () => {
                        item.window.setAlwaysOnTop( true, "screen-saver" )
                    }, 1000 );
                } );
            } );

            overlayMoveDialog.once( "ready-to-show", () => {
                overlayMoveDialog.show();
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
        
        ipcMain.on( 'overlay:destroy:component', ( event, instanceId ) => {
            for ( var overlayId in overlayDictionary ) {
                if ( overlayDictionary.hasOwnProperty( overlayId ) ) {
                    overlayDictionary[ overlayId ].window.send( 'component:destroy', instanceId );
                }
            }
        } );

        ipcMain.on( 'gina:dialog:import', ( event, arg ) => {
            this.ginaImportWindow = new BrowserWindow( {
                parent: mainWindowRef.reference,
                modal: false,
                show: false,
                width: 1000,
                height: 800,
                frame: false,
                webPreferences: {
                    nodeIntegration: true,
                    devTools: app.isDev(),
                }
            } );
            let url = `file://${this.#dirname}/dist/index.html#/gina/import`;
            if ( arg ) {
                url += `/${arg}`;
            }
            this.ginaImportWindow.loadURL( url );
            this.ginaImportWindow.once( "ready-to-show", () => {
                this.ginaImportWindow.show();
                event.sender.webContents.send( 'gina:dialog:import', true );
            } );
            this.ginaImportWindow.on( 'closed', () => {
                this.ginaImportWindow = null;
            } );

        } );

        ipcMain.on( 'trigger:dialog:library', ( event, arg ) => {
            this.triggerLibraryWindow = new BrowserWindow( {
                parent: mainWindowRef.reference,
                modal: false,
                show: false,
                width: 1000,
                height: 800,
                frame: false,
                webPreferences: {
                    nodeIntegration: true,
                    devTools: app.isDev(),
                }
            } );
            if ( app.isDev() ) {
                this.triggerLibraryWindow.webContents.openDevTools();
            }
            let url = `file://${this.#dirname}/dist/index.html#/trigger/library`;
            if ( arg ) {
                url += `/${arg}`;
            }
            this.triggerLibraryWindow.loadURL( url );
            this.triggerLibraryWindow.once( "ready-to-show", () => {
                this.triggerLibraryWindow.show();
                event.sender.webContents.send( 'trigger:dialog:library', true );
            } );
            this.triggerLibraryWindow.on( 'closed', () => {
                this.triggerLibraryWindow = null;
            } );

        } );

        overlayDatabase.registerOverlayPositionHandler( overlays => this.updateOverlayPositions( overlays ) );
        
        userPreferencesDatabase.onFctStyleChanges.push( fctStyles => {
          
            for ( let overlayId in overlayDictionary ) {

                if ( overlayDictionary[ overlayId ].model.overlayType === 'FCT' ) {
                    // Send each overlay the FCT styles if they're an fct overlay type.
                    overlayDictionary[ overlayId ].window.webContents.send( 'fctStyles', fctStyles );
                }

            }

        } );
    }










    /**
     * Updates all overlay window positions.
     * 
     * @param {OverlayWindow[]} overlays Overlays
     */
    updateOverlayPositions( overlays ) {
        overlays.forEach( overlay => {

            if ( overlay.overlayType === 'FCT' ) {

                overlayDictionary[ overlay.overlayId ].window.setBounds( {
                    x: overlay.x - criticalPadding,
                    y: overlay.y - criticalPadding,
                    width: overlay.windowWidth + criticalPadding * 2,
                    height: overlay.windowHeight + criticalPadding * 2
                } );

            } else {

                overlayDictionary[ overlay.overlayId ].window.setBounds( {
                    x: overlay.x,
                    y: overlay.y,
                    width: overlay.windowWidth,
                    height: overlay.windowHeight
                } );

            }

        } );
    }










    /**
     * Loads all overlays.
     * 
     * @param {OverlayDatabaseStore} overlayDatabase The overlay database.
     * @param {UserPreferencesStore} overlayDatabase The user preferences database.
     */
    loadOverlays( overlayDatabase ) {

        let overlays = overlayDatabase.getAll();
        let loadedCount = 0;
        overlays?.forEach( m => {
            loadOverlay( m, overlayDatabase, false, () => {

                loadedCount += 1;
                
                if ( loadedCount >= overlays.length ) {
                    // If all of the overlay windows have been loaded.

                    for ( let overlayId in overlayDictionary ) {

                        if ( overlayDictionary[ overlayId ].model.overlayType === 'FCT' ) {
                            // Send each overlay the FCT styles if they're an fct overlay type.
                            overlayDictionary[ overlayId ].window.webContents.send( 'fctStyles', this.#userPrefDb.fctStyles );
                        }

                    }

                }

            } );
        } );

    }
    

    loadRenderer() {
        
        let displays = screen.getAllDisplays();
        let left = 0, right = 0;
        let top = 0, bottom = 0;

        displays.forEach( display => {

            let absLeft = display.bounds.x;
            let absRight = display.bounds.x + display.bounds.width;
            let absTop = display.bounds.y;
            let absBottom = display.bounds.y + display.bounds.height;


            left = absLeft < left ? absLeft : left;
            right = absRight > right ? absRight : right;
            top = absTop < top ? absTop : top;
            bottom = absBottom > bottom ? absBottom : bottom;

        } );

        let bounds = {
            x: left,
            y: top,
            width: right - left,
            height: bottom - top,
        };

        let renderer = new BrowserWindow( {
            width: bounds.width,
            height: bounds.height,
            x: bounds.x,
            y: bounds.y,
            transparent: true,
            frame: false,
            resizable: true,
            webPreferences: {
                nodeIntegration: true,
                devTools: app.isDev(),
            },
            skipTaskbar: true,
            maximizable: false,
        } );
        
        renderer.setBounds( {
            width: bounds.width,
            height: bounds.height,
            x: bounds.x,
            y: bounds.y,
        } );
        
        renderer.loadURL( `file://${__dirname}/threads/renderer.html?originX=${0 - bounds.x}&originY=${0 - bounds.y}` );
        renderer.setIgnoreMouseEvents( true );
        renderer.setAlwaysOnTop( true, "screen-saver" );
        
        // Open the DevTools.
        if ( app.isDev() ) {
            renderer.webContents.openDevTools();
        }
    
        let interval = setInterval( () => {
            renderer.setAlwaysOnTop( true, "screen-saver" );
        }, 1000 );
    }










    /**
     * Unloads all windows.
     */
    unload() {
        if ( overlayDictionary ) {
            for ( let key in overlayDictionary ) {
                if ( overlayDictionary.hasOwnProperty( key ) ) {
                    clearInterval( overlayDictionary[ key ].interval );
                    overlayDictionary[ key ].window?.close();
                    overlayDictionary[ key ].window = null;
                }
            }
        }
    }









    
    /**
     * Iterates each active window and executes function.
     * 
     * @param {( window: BrowserWindow, identifier: string ) => void} fn Iteratee
     */
    eachWindow( fn ) {

        if ( this.ginaImportWindow ) {
            fn( this.ginaImportWindow, 'ginaImportWindow' );
        }

        if ( this.triggerLibraryWindow ) {
            fn( this.triggerLibraryWindow, 'triggerLibraryWindow' );
        }

        if ( overlayDictionary ) {
            for ( let overlayId in overlayDictionary ) {
                fn( overlayDictionary[ overlayId ].window, overlayDictionary[ overlayId ].model.name );
            }
        }
    }










    /**
     * Checks all window positions and moves then back if the window isn't in 
     * edit  mode.
     */
    checkWindowPosition() {
        var currentSize = screen.getPrimaryDisplay().workAreaSize;
        
        if ( overlayDictionary ) {
            for ( let overlayId in overlayDictionary ) {
                if ( currentSize.width != defaultSize.width || currentSize.height != defaultSize.height ) {
                    // We ignore this and will move the window back to it's correct 
                    // position when the resolution changes back to previous.
                    log.info( '(checkWindowPosition) Screen size has changed, will not move window back to defined positions.' );
        
                } else {
                    log.info( '(checkWindowPosition) Resetting overlay to the correct position.' );

                    let bounds = {
                        x: overlayDictionary[ overlayId ].model.x > 0 ? overlayDictionary[ overlayId ].model.x : null,
                        y: overlayDictionary[ overlayId ].model.y > 0 ? overlayDictionary[ overlayId ].model.y : null,
                        width: overlayDictionary[ overlayId ].model.windowWidth > 0 ? overlayDictionary[ overlayId ].model.windowWidth : 800,
                        height: overlayDictionary[ overlayId ].model.windowHeight > 0 ? overlayDictionary[ overlayId ].model.windowHeight : 800,
                    };

                    if ( overlayDictionary[ overlayId ].model.overlayType === 'FCT' ) {
                        overlayDictionary[ overlayId ].window.setSize( bounds.width + criticalPadding * 2, bounds.height + criticalPadding * 2 );
                        overlayDictionary[ overlayId ].window.setPosition( bounds.x - criticalPadding, bounds.y - criticalPadding );
        
                    } else {
                        overlayDictionary[ overlayId ].window.setSize( bounds.width, bounds.height );
                        overlayDictionary[ overlayId ].window.setPosition( bounds.x, bounds.y );
        
                    }
        
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
 * @param {() => void} afterLoaded Executed after the Dom is loaded.
 */
function loadOverlay( model, overlayDatabase, enableEdit, afterLoaded ) {
    let bounds = {
        x: model.x > 0 ? model.x : null,
        y: model.y > 0 ? model.y : null,
        width: model.windowWidth > 0 ? model.windowWidth : 800,
        height: model.windowHeight > 0 ? model.windowHeight : 800,
    };
    let overlay = new BrowserWindow( {
        width: bounds.width,
        height: bounds.height,
        x: bounds.x,
        y: bounds.y,
        transparent: true,
        frame: false,
        resizable: true,
        webPreferences: {
            nodeIntegration: true,
            devTools: app.isDev(),
        },
        skipTaskbar: true,
        maximizable: false,
    } );
    if ( model.overlayType === 'FCT' ) {
        overlay.setSize( bounds.width + criticalPadding * 2, bounds.height + criticalPadding * 2 );
        overlay.setPosition( bounds.x - criticalPadding, bounds.y - criticalPadding );
        overlay.loadFile( "./src/electron/threads/overlay-fct.html" );
    } else {
        overlay.loadFile( "./src/electron/threads/overlay.html" );
    }
    overlay.setIgnoreMouseEvents( true );
    overlay.setAlwaysOnTop( true, "screen-saver" );

    let interval = setInterval( () => {
        overlay.setAlwaysOnTop( true, "screen-saver" );
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

    overlay.on( 'move', e => {

        if ( !overlayDictionary[ model.overlayId ].editMode ) {
            log.info( '(loadOverlay:move) Overlay has moved outside of edit mode.', model.overlayId );
            // If the window has moved outside of edit mode, this is definitely 
            // invalid.

            var currentSize = screen.getPrimaryDisplay().workAreaSize;
            if ( currentSize.width != defaultSize.width || currentSize.height != defaultSize.height ) {
                // We ignore this and will move the window back to it's correct 
                // position when the resolution changes back to previous.
                log.info( '(loadOverlay:move) Screen size has changed, will not move window back to defined positions.' );

            } else {
                log.info( '(loadOverlay:move) Resetting overlay to the correct position.' );
                if ( model.overlayType === 'FCT' ) {
                    overlay.setSize( bounds.width + criticalPadding * 2, bounds.height + criticalPadding * 2 );
                    overlay.setPosition( bounds.x - criticalPadding, bounds.y - criticalPadding );

                } else {
                    overlay.setSize( bounds.width, bounds.height );
                    overlay.setPosition( bounds.x, bounds.y );

                }

            }
        } else {
            // This move may be valid.

        }
    } );

    overlay.on( 'will-resize', function ( e ) {
        setTimeout( () => {
            let bounds = overlay.webContents.getOwnerBrowserWindow().getBounds();
            model.x = bounds.x;
            model.y = bounds.y;
            model.windowWidth = bounds.width;
            model.windowHeight = bounds.height;
            overlayDatabase.update( model );
        } );
    } );

    overlay.on( 'will-move', function () {
        setTimeout( () => {
            let bounds = overlay.webContents.getOwnerBrowserWindow().getBounds();
            model.x = bounds.x;
            model.y = bounds.y;
            model.windowWidth = bounds.width;
            model.windowHeight = bounds.height;
            overlayDatabase.update( model );
        } );
    } );

    overlay.webContents.once( 'dom-ready', () => {
        if ( afterLoaded ) {
            afterLoaded();
        }
    } );

    overlayDictionary[ model.overlayId ] = { window: overlay, interval: interval, model: model, editMode: enableEdit };
    
}

module.exports = WindowManager;
