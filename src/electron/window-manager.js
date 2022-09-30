const { app, BrowserWindow, ipcMain, screen } = require( "electron" );
const ForwardRef = require( './forward-ref' );
const OverlayDatabaseStore = require( "./data/overlay-database" );
const UserPreferencesStore = require( "./data/user-preferences" );
const { OverlayWindow } = require( "./data/models/overlay-window" );
const ArrayUtilities = require( "./utilities/arrays" );
const log = require( 'electron-log' );
const CharacterModel = require( './data/models/character' );
const { IpcMessage } = require( "./data/models/common" );
const { LogFileLocation } = require( "./data/log-file-location" );

/** 
 * We will occassionally need to disable the 'force on top' of the renderer, so 
 * we keep the interval id as a global value.
 * 
 * @type {number} 
 */
let rendererOnTopId = null;

class WindowManager {

    /** @type {BrowserWindow} */
    ginaImportWindow;

    /** @type {BrowserWindow} */
    triggerLibraryWindow;

    /** @type {ForwardRef<BrowserWindow>} */
    #mainWindow;

    /** @type {BrowserWindow} */
    #renderer;

    /** @type {BrowserWindow} */
    #deathRecap;

    /** @type {BrowserWindow[]} */
    #openOverlayEditors = [];

    #dirname;

    /** @type {UserPreferencesStore} */
    #userPrefDb;

    /** @type {OverlayDatabaseStore} */
    #overlayDatabase;

    constructor( dirname ) {
        this.#dirname = dirname;
    }










    /**
     * Initialize on ready variables.
     */
    onReady() { }










    /**
     * Attaches store events to ipc main and dispatches react events to the main window.
     * 
     * @param {ForwardRef<BrowserWindow>} mainWindowRef The main window of the application.
     * @param {OverlayDatabaseStore} overlayDatabase The overlay database.
     * @param {UserPreferencesStore} userPreferencesDatabase The user pref database.
     */
    attachIpcEvents( mainWindowRef, overlayDatabase, userPreferencesDatabase ) {

        this.#userPrefDb = userPreferencesDatabase;
        this.#mainWindow = mainWindowRef;
        this.#overlayDatabase = overlayDatabase;

        this.#overlayDatabase.registerNewOverlayHandler( overlay => {
            this.#renderer.webContents.send( 'renderer:overlay:new', overlay );
        } );

        this.#overlayDatabase.registerOverlayUpdateHandler( overlays => {
            this.#renderer.webContents.send( 'renderer:overlay:update', overlays );
        } );

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
        
        ipcMain.on( 'window:death-recap',
            /**
             * Loads the death recap for the specified player death.
             * 
             * @param {any} event Event args.
             * @param {IpcMessage<{logFileLoc: LogFileLocation, characterName: string}>} arg The character model.
             */
            ( event, arg ) => {
                this.loadDeathRecap( arg.value.logFileLoc, arg.id, arg.value.characterName );
            }
        );

        ipcMain.on( 'renderer:arrange-overlays', ( event ) => {
            this.#renderer.setIgnoreMouseEvents( false );
            this.#renderer.webContents.send( 'renderer:arrange-overlays' );

            if ( rendererOnTopId ) {
                clearInterval( rendererOnTopId );
            }
        } );

        ipcMain.on( 'renderer:end-arrange-overlays', ( event ) => {
            this.#renderer.setIgnoreMouseEvents( true );
            this.#renderer.webContents.send( 'renderer:end-arrange-overlays' );

            rendererOnTopId = setInterval( () => {
                this.#renderer.setAlwaysOnTop( true, "screen-saver" );
            }, 1000 );
        } );

        ipcMain.on( 'overlay:enable-edit', ( event, overlayId ) => {
            // Note: This is triggered by the NgInit event on the overlay editor window.
            this.#renderer.webContents.send( 'renderer:window:enable-edit', overlayId );
            this.#renderer.setIgnoreMouseEvents( false );
            
            let caller = BrowserWindow.fromWebContents( event.sender );

            const onTopIntervalId = setInterval( () => {
                caller.setAlwaysOnTop( true, "screen-saver" );
            }, 500 );

            caller.on( 'close', () => {
                clearInterval( onTopIntervalId );
                this.#renderer.setIgnoreMouseEvents( true );
            } );
        } );
        
        ipcMain.on( 'overlay:disable-edit', ( event, overlayId ) => {
            this.#renderer.webContents.send( 'renderer:window:disable-edit', overlayId );
        } );

        ipcMain.on( 'overlay:highlight', ( event, overlayId ) => {
            this.#renderer.webContents.send( 'renderer:window:highlight', overlayId );
        } );
        
        ipcMain.on( 'overlay:dim', ( event, overlayId ) => {
            this.#renderer.webContents.send( 'renderer:window:dim', overlayId );
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
                this.#openOverlayEditors.push( overlayEditorDialog );
            } );
            overlayEditorDialog.on( 'close', () => {
                let i = this.#openOverlayEditors.indexOf( overlayEditorDialog );
                if ( i > -1 ) {
                    this.#openOverlayEditors.splice( i, 1 );
                }
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

            let moveInterval = setInterval( () => {
                overlayMoveDialog.setAlwaysOnTop( true, "screen-saver" );
            }, 500 );

            overlayMoveDialog.on( 'close', function () {
                clearInterval( moveInterval );
            } );

            overlayMoveDialog.once( "ready-to-show", () => {
                overlayMoveDialog.show();
            } );

        } );
        
        ipcMain.on( 'overlay:broadcast', ( event, model ) => {
            if ( model?.overlayId ) {
                this.#renderer.webContents.send( 'renderer:overlay:update', [ model ] );
            }
        } );
        
        ipcMain.on( 'overlay:send:component', ( event, component ) => {
            this.#renderer.webContents.send( 'renderer:receive:component', component );
        } );
        
        ipcMain.on( 'overlay:send:fct-component', ( event, component ) => {
            this.#renderer.webContents.send( 'renderer:receive:fct-component', component );
        } );
        
        ipcMain.on( 'overlay:destroy:component', ( event, instanceId ) => {
            this.#renderer.webContents.send( 'component:destroy', instanceId );
        } );
        
        ipcMain.on( 'renderer:reset:overlayDimensions', ( event ) => {
            this.#renderer.webContents.send( 'renderer:reset:overlayDimensions', null );
        } );
        
        ipcMain.on( 'renderer:save:overlayDimensions', ( event ) => {
            this.#renderer.webContents.send( 'renderer:save:overlayDimensions', null );
        } );

        ipcMain.on( 'overlay:send-to-origin', ( event, overlayId ) => this.sendOverlayToMiddle( overlayId ) );

        ipcMain.on( 'overlay:event:bounds-changed', ( event, d ) => {
            this.#openOverlayEditors.forEach( window => {
                window?.webContents.send( 'overlay:event:bounds-changed', d );
            } );
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
        
        userPreferencesDatabase.onFctStyleChanges.push( fctStyles => {
            this.#renderer.webContents.send( 'fctStyles', fctStyles );
        } );
    }
    









    /**
     * Loads the unified renderer window.
     */
    loadRenderer() {

        let savedBounds = this.#userPrefDb.rendererBounds;
        let bounds = savedBounds == null ? this.calculateRendererBounds() : savedBounds;

        let renderer = new BrowserWindow( {
            transparent: true,
            frame: false,
            resizable: false,
            movable: false,
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

        this.#renderer = renderer;

        rendererOnTopId = setInterval( () => {
            this.#renderer.setAlwaysOnTop( true, "screen-saver" );
        }, 1000 );

        ipcMain.once('main:angular-ready', () => {
            this.checkWindowPosition( true );
        } );

    }










    /**
     * Loads a death recap for the specified character.
     * 
     * @param {string} logFilePath The character to view the death recap.
     */
    findPlayerDeaths( logFilePath, messageId ) {

        let deathRecap = new BrowserWindow( {
            transparent: true,
            frame: false,
            resizable: true,
            movable: true,
            webPreferences: {
                nodeIntegration: true,
                devTools: app.isDev(),
            },
            skipTaskbar: true,
            maximizable: false,
        } );
        
        let size = { width: 1100, height: 800 };
        let workAreaSize = screen.getPrimaryDisplay().workAreaSize;

        deathRecap.setBounds( {
            width: size.width,
            height: size.height,
            x: ( workAreaSize.width - size.width ) / 2,
            y: ( workAreaSize.height - size.height ) / 2,
        } );
        
        deathRecap.loadURL( `file://${__dirname}/windows/death-recap.html?logFilePath=${encodeURI( logFilePath )}&lineNo=&messageId=${encodeURI(messageId)}` );
        deathRecap.setIgnoreMouseEvents( true );
        
        // Open the DevTools.
        if ( app.isDev() ) {
            deathRecap.webContents.openDevTools();
        }
        
    }










    /**
     * Loads a death recap for the specified character.
     * 
     * @param {LogFileLocation} logFileLocation The location in the log file where death happened.
     * @param {string} messageId The ipc message id.
     * @param {string} characterName The name of the character.
     */
    loadDeathRecap( logFileLocation, messageId, characterName ) {

        let deathRecap = new BrowserWindow( {
            transparent: true,
            frame: false,
            resizable: true,
            movable: true,
            webPreferences: {
                nodeIntegration: true,
                devTools: app.isDev(),
            },
            skipTaskbar: false,
            maximizable: true,
            minimizable: true,
        } );
        
        let size = { width: 1100, height: 800 };
        let workAreaSize = screen.getPrimaryDisplay().workAreaSize;

        deathRecap.setBounds( {
            width: size.width,
            height: size.height,
            x: ( workAreaSize.width - size.width ) / 2,
            y: ( workAreaSize.height - size.height ) / 2,
        } );
        
        deathRecap.loadURL( `file://${__dirname}/windows/death-recap.html?logFilePath=${encodeURI( logFileLocation.logFilePath )}&lineNo=${logFileLocation.lineNo}&characterName=${encodeURI(characterName)}&messageId=${encodeURI(messageId)}` );
        // deathRecap.setIgnoreMouseEvents( true );
        deathRecap.setAlwaysOnTop( true, "screen-saver" );
        
        // Open the DevTools.
        if ( app.isDev() ) {
            deathRecap.webContents.openDevTools();
        }

        deathRecap.webContents.once( 'dom-ready', () => {
            deathRecap.setAlwaysOnTop( false, "screen-saver" );
        } );

        // TODO: Remove this code or come back and try again.  Cannot get auto-
        //       close to work because settin focus doesn't actually set focus, 
        //       even though Electron reports that focus is set.
        
        // let checkFocus = () => {
        //     let focused = deathRecap.isFocused();
        //     // console.log( 'derp', focused );

        //     if ( focused )
        //         setTimeout( () => checkFocus(), 100 );
        //     else {
        //         deathRecap?.close();
        //         deathRecap = null;
        //     }
        // };
        

        // let c = 0;
        // let limit = 10;
        // let setFocus = () => {
        //     c++;
        //     deathRecap.webContents.focus();
        //     deathRecap.focus();

        //     console.log( 'deathRecap.isFocused()', deathRecap.isFocused() );

        //     if ( deathRecap.isFocused() ) {
        //         deathRecap.minimize();
                
        //         deathRecap.on( 'blur', () => {
        //             console.log( 'window blur called' );
        //         } );
        //         deathRecap.webContents.on( 'blur', () => {
        //             console.log( 'webContents blur called' );
        //         } );

        //         setTimeout( () => {
        //             deathRecap.restore();
        //             deathRecap.focus();
        //             deathRecap.show();
        //             console.log( 'resetting focus' );
        //             setTimeout( () => checkFocus(), 100 );
        //         }, 1000 );
        //     }
        //     else if ( c < limit )
        //         setTimeout( () => setFocus(), 100 );
        // };

        // deathRecap.on( 'show', () => {
        //     setTimeout( () => setFocus(), 100 );
            
        //     // deathRecap.on( 'blur', () => {
        //     //     console.log( 'blur called' );
        //     //     deathRecap?.close();
        //     //     deathRecap = null;
        //     // } );
        // } );

        // deathRecap.on( 'blur', () => this.#mainWindow.reference.webContents.send('console:log', 'shown') );
        // deathRecap.on( 'always-on-top-changed', () => console.log( 'always-on-top-changed' ) );

        this.#deathRecap = deathRecap;
    }










    /**
     * Closes the death recap window.
     */
    closeDeathRecap() {
        this.#deathRecap?.close();
        this.#deathRecap = null;
    }










    /**
     * Returns the bounds for the renderer window.
     * 
     * @returns {import("electron").Rectangle}
     */
    calculateRendererBounds() {
        
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

        return {
            x: left,
            y: top,
            width: right - left,
            height: bottom - top,
        };
    }










    /**
     * Unloads all windows.
     */
    unload() {
        this.#renderer?.close();
        this.#renderer = null;
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

        if ( this.#renderer ) {
            fn( this.#renderer, 'rendererWindow' );
        }

    }










    /**
     * Checks all window positions and moves then back if the window isn't in 
     * edit  mode.
     */
    checkWindowPosition( showWarning ) {
        showWarning = showWarning === true;
        var currentSize = this.#renderer.getBounds();
        let newSize = this.calculateRendererBounds();

        // If the current size of the renderer doesn't match the calculated size, then we need to resize/move our overlays.
        if ( currentSize.x !== newSize.x || currentSize.y !== newSize.y || currentSize.width !== newSize.width || currentSize.height !== newSize.height ) {
            
            // Because the size includes the relative position to the primary 
            // display, we can find the (x0,y0) point of the primary display using 
            // this simple formula.
            let currentOrigin = { x: 0 - currentSize.x, y: 0 - currentSize.y };
            let newOrigin = { x: 0 - newSize.x, y: 0 - newSize.y };
        
            this.#renderer?.setSize( newSize.width, newSize.height );
            this.#renderer?.setPosition( newSize.x, newSize.y );

            // We need to recalculate the x,y coordinates of each overlay, from the
            // origin.
            // Changing the resolution of one monitor doesn't mean that the 
            // relative positions or sizes of overlays on the other monitor should 
            // stay the same or change.
        
            let overlays = this.#overlayDatabase.getAll();

            overlays.forEach( overlay => {
                /** @type {{left: number, top: number, right: number, bottom: number}} */
                let originalBoundaries = {
                    left: overlay.x,
                    top: overlay.y,
                    right: currentSize.width - ( overlay.x + currentOrigin.x + overlay.width ),
                    bottom: currentSize.height - ( overlay.y + currentOrigin.y + overlay.height ),
                };

                // Let's calculate the new boundaries for the new resolution.  We
                // can compare the right/bottom values to determine if the monitor 
                // that contains the overlay has had its resolution changed.

                /** @type {{left: number, top: number, right: number, bottom: number}} */
                let newBoundaries = {
                    left: overlay.x,
                    top: overlay.y,
                    right: newSize.width - ( overlay.x + newOrigin.x + overlay.width ),
                    bottom: newSize.height - ( overlay.y + newOrigin.y + overlay.height ),
                };

                if ( originalBoundaries.bottom !== newBoundaries.bottom || originalBoundaries.right !== newBoundaries.right ) {
                    // The quadrant containing this overlay has had it's resolution changed, and the overlay needs to update to match.
                    let hRatio = ( newSize.x + newOrigin.x ) / ( currentSize.x + currentOrigin.x );
                    let vRatio = ( newSize.y + newOrigin.y ) / ( currentSize.y + currentOrigin.y );

                    overlay.x = overlay.x * hRatio;
                    overlay.height = overlay.height * hRatio;
                    overlay.y = overlay.y * vRatio;
                    overlay.width = overlay.width * vRatio;
                }
            } );

            this.#renderer.webContents.send( 'renderer:resolution-changed', { overlays: overlays, origin: newOrigin } );

            if ( showWarning ) {
                this.#mainWindow.reference.webContents.send( 'dialog:warning', { code: 'Renderer:ResolutionChanged' } );
            }
        }

        this.#userPrefDb.rendererBounds = this.#renderer.getBounds();
    }










    /**
     * Sends the specified overlay to the middle of the main monitor.
     * 
     * @param {string} overlayId The id of the desired overlay.
     */
    sendOverlayToMiddle( overlayId ) {
        const primarySize = screen.getPrimaryDisplay().size;
        let overlay = this.#overlayDatabase.find( overlayId );
        
        overlay.x = ( primarySize.width - overlay.windowWidth ) / 2;
        overlay.y = ( primarySize.height - overlay.windowHeight ) / 2;

        this.#overlayDatabase.update( overlay );

        this.#renderer.webContents.send( 'renderer:overlay:move', { overlayId: overlayId, x: overlay.x, y: overlay.y } );
    }
}

module.exports = WindowManager;
