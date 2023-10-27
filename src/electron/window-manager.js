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
const path = require( "path" );
const ElectronUtilities = require( "./utilities/electron" );

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

    /** @type {BrowserWindow} */
    logSimulatorWindow;

    /** @type {BrowserWindow} */
    easyWindow;

    /** @type {BrowserWindow} */
    updateNotesWindow;

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

    /** @type {NodeJS.Timeout} */
    #resumeRendererMouseForwardingTimeout = null;

    /** @type {number} */
    #windowIndex = 0;

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

        userPreferencesDatabase.onChanges( () => {
            if ( this.#renderer ) {
                this.#renderer.webContents.send( 'fct:change:fctShowCriticalsInline', userPreferencesDatabase.fctShowCriticalsInline );
            }
        } );

        this.#overlayDatabase.registerNewOverlayHandler( overlay => {
            this.#renderer.webContents.send( 'renderer:overlay:new', overlay );
        } );

        this.#overlayDatabase.registerOverlayUpdateHandler( overlays => {
            this.#renderer.webContents.send( 'renderer:overlay:update', overlays );
        } );

        this.#overlayDatabase.registerCombatGroupUpdateHandler( groups => {
            if ( this.#renderer ) {
                this.#renderer.webContents.send( 'renderer:combatGroups', groups );
            }
        } );

        this.#overlayDatabase.registerOverlayDeleteHandler( overlayId => {
            this.#renderer.webContents.send( 'renderer:overlay:delete', overlayId );
        } );

        ipcMain.handle( 'scraper:get:eqsr-spell', async ( event, eqsrUrl ) => {
            return await this.scrapeEqsrResource( eqsrUrl, 'spell' );
        } );

        ipcMain.handle( 'scraper:get:eqsr-itemClick', async ( event, eqsrUrl ) => {
            return await this.scrapeEqsrResource( eqsrUrl, 'clickEffect' );
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
                    nodeIntegration: false,
                    contextIsolation: true,
                    devTools: app.isDev(),
                    sandbox: false,
                    preload: path.join( __dirname, '/preloaders/main.js' ),
                }
            } );

            require( "@electron/remote/main" ).enable( triggerWindow.webContents );

            let url = `file://${this.#dirname}/dist/index.html#/trigger/new`;
            if ( arg ) {
                url += `/${arg}`;
            }
            triggerWindow.loadURL( url );
            triggerWindow.once( "ready-to-show", () => {
                triggerWindow.show();
            } );
            triggerWindow.setBackgroundColor( '#1a1a1a' );
            this.configureRendererMouseBlockingOnMoveResize( triggerWindow );
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
                    nodeIntegration: false,
                    contextIsolation: true,
                    devTools: app.isDev(),
                    sandbox: false,
                    preload: path.join( __dirname, '/preloaders/main.js' ),
                }
            } );

            require( "@electron/remote/main" ).enable( triggerWindow.webContents );

            triggerWindow.loadURL( `file://${this.#dirname}/dist/index.html#/trigger/${arg}` );
            triggerWindow.once( "ready-to-show", () => {
                triggerWindow.show();
            } );
            triggerWindow.setBackgroundColor( '#1a1a1a' );
            this.configureRendererMouseBlockingOnMoveResize( triggerWindow );
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
        
        ipcMain.on( 'window:last-death-recap',
            /**
             * Loads the death recap for the specified player death.
             * 
             * @param {any} event Event args.
             * @param {IpcMessage<{logFilePath: string, characterName: string}>} arg The character model.
             */
            ( event, arg ) => {
                this.loadLastDeathRecap( arg.value.logFilePath, arg.id, arg.value.characterName );
            }
        );

        ipcMain.on( 'renderer:arrange-overlays', ( event ) => {
            this.#renderer.webContents.send( 'renderer:arrange-overlays' );

            if ( rendererOnTopId ) {
                clearInterval( rendererOnTopId );
            }
        } );

        ipcMain.on( 'renderer:end-arrange-overlays', ( event ) => {
            this.#renderer.webContents.send( 'renderer:end-arrange-overlays' );

            rendererOnTopId = setInterval( () => {
                this.#renderer.setAlwaysOnTop( true, "screen-saver" );
            }, 1000 );
        } );

        ipcMain.on( 'overlay:enable-edit', ( event, overlayId ) => {
            // Note: This is triggered by the NgInit event on the overlay editor window.
            this.#renderer.webContents.send( 'renderer:window:enable-edit', overlayId );
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
                    nodeIntegration: false,
                    contextIsolation: true,
                    devTools: app.isDev(),
                    sandbox: false,
                    preload: path.join( __dirname, '/preloaders/main.js' ),
                }
            } );

            require( "@electron/remote/main" ).enable( overlayEditorDialog.webContents );

            overlayEditorDialog.setBackgroundColor( '#1a1a1a' );
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
            this.configureRendererMouseBlockingOnMoveResize( overlayEditorDialog );
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
                    nodeIntegration: false,
                    contextIsolation: true,
                    devTools: app.isDev(),
                    sandbox: false,
                    preload: path.join( __dirname, '/preloaders/main.js' ),
                }
            } );

            require( "@electron/remote/main" ).enable( overlayMoveDialog.webContents );

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
            this.configureRendererMouseBlockingOnMoveResize( overlayMoveDialog );

        } );
        
        ipcMain.on( 'overlay:broadcast', ( event, model ) => {
            if ( model?.overlayId ) {
                this.#renderer.webContents.send( 'renderer:overlay:update', [ model ] );
            }
        } );
        
        ipcMain.on( 'overlay:send:component', ( event, component ) => {
            this.#renderer.webContents.send( 'renderer:receive:component', component );
        } );
        
        ipcMain.on( 'overlay:send:secondary-action', ( event, token ) => {
            this.#renderer.webContents.send( 'renderer:receive:secondary-action', token );
        } );
        
        ipcMain.on( 'overlay:send:fct-component', ( event, component ) => {
            this.#renderer.webContents.send( 'renderer:receive:fct-component', component );
        } );
        
        ipcMain.on( 'overlay:destroy:component', ( event, instanceId ) => {
            this.#renderer.webContents.send( 'component:destroy', instanceId );
        } );
        
        ipcMain.on( 'renderer:stopwatch:stop', ( event, instanceId ) => {
            this.#renderer.webContents.send( 'renderer:stopwatch:stop', instanceId );
        } );
        
        ipcMain.on( 'renderer:reset:overlayDimensions', ( event ) => {
            this.#renderer.webContents.send( 'renderer:reset:overlayDimensions', null );
        } );
        
        ipcMain.on( 'renderer:save:overlayDimensions', ( event ) => {
            this.#renderer.webContents.send( 'renderer:save:overlayDimensions', null );
        } );

        ipcMain.on( 'overlay:send-to-origin',
            /**
             * Moves the specified overlay to the specified display.
             * 
             * @param {any} event The event arguments.
             * @param {{overlayId: string, displayId: number}} data The display move data.
             */
            ( event, data ) => this.sendOverlayToMiddle( data.overlayId, data.displayId ) );

        ipcMain.on( 'overlay:event:bounds-changed',
            /**
             * Handles the renderer's bounds changed event, converting renderer 
             * coords to display coords and sending the translated coords to 
             * subscribers.
             * 
             * @param {any} event The event args.
             * @param {{overlayId: string, bounds: Electron.Rectangle, displayId: number|null}} d Renderer bounds event data.
             */
            ( event, d ) => {
            
                const display = ElectronUtilities.determineContainingDisplay( d.bounds );

                if ( display == undefined ) {
                    // If a display could not be found, then send to the middle of the primary display.
                    const primaryDisplay = screen.getPrimaryDisplay();
                    this.sendOverlayToMiddle( d.overlayId, primaryDisplay.id );

                } else {
                
                    d.displayId = display.id;
                    
                    d.displayBounds = display.bounds;
                    d.bounds.x = d.bounds.x - display.bounds.x;
                    d.bounds.y = d.bounds.y - display.bounds.y;
    
                    this.#mainWindow.reference.webContents.send( 'overlay:event:bounds-changed', d );
                    this.#openOverlayEditors.forEach( window => {
                        window?.webContents.send( 'overlay:event:bounds-changed', d );
                    } );
                    
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
                    nodeIntegration: false,
                    contextIsolation: true,
                    devTools: app.isDev(),
                    sandbox: false,
                    preload: path.join( __dirname, '/preloaders/main.js' ),
                }
            } );

            require( "@electron/remote/main" ).enable( this.ginaImportWindow.webContents );

            let url = `file://${this.#dirname}/dist/index.html#/gina/import`;
            if ( arg ) {
                url += `/${arg}`;
            }
            this.ginaImportWindow.loadURL( url );
            this.ginaImportWindow.once( "ready-to-show", () => {
                this.ginaImportWindow.show();
                event.sender.send( 'gina:dialog:import', true );
            } );
            this.ginaImportWindow.on( 'closed', () => {
                this.ginaImportWindow = null;
            } );
            this.ginaImportWindow.setBackgroundColor( '#1a1a1a' );
            this.configureRendererMouseBlockingOnMoveResize( this.ginaImportWindow );

            // Open the DevTools.
            if ( app.isDev() ) {
                this.ginaImportWindow.webContents.openDevTools( { mode: 'undocked' } );
            }
            
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
                    nodeIntegration: false,
                    contextIsolation: true,
                    devTools: app.isDev(),
                    sandbox: false,
                    preload: path.join( __dirname, '/preloaders/main.js' ),
                }
            } );

            require( "@electron/remote/main" ).enable( this.triggerLibraryWindow.webContents );

            if ( app.isDev() ) {
                this.triggerLibraryWindow.webContents.openDevTools( { mode: 'undocked' } );
            }
            let url = `file://${this.#dirname}/dist/index.html#/trigger/library`;
            if ( arg ) {
                url += `/${arg}`;
            }
            this.triggerLibraryWindow.loadURL( url );
            this.triggerLibraryWindow.once( "ready-to-show", () => {
                this.triggerLibraryWindow.show();
                event.sender.send( 'trigger:dialog:library', true );
            } );
            this.triggerLibraryWindow.on( 'closed', () => {
                this.triggerLibraryWindow = null;
            } );
            this.triggerLibraryWindow.setBackgroundColor( '#1a1a1a' );
            this.configureRendererMouseBlockingOnMoveResize( this.triggerLibraryWindow );
        } );

        ipcMain.on( 'trigger:dialog:log-simulator', ( event, arg ) => {
            this.logSimulatorWindow = new BrowserWindow( {
                parent: mainWindowRef.reference,
                modal: false,
                show: false,
                width: 1000,
                height: 800,
                frame: false,
                webPreferences: {
                    nodeIntegration: false,
                    contextIsolation: true,
                    devTools: app.isDev(),
                    sandbox: false,
                    preload: path.join( __dirname, '/preloaders/main.js' ),
                }
            } );

            require( "@electron/remote/main" ).enable( this.logSimulatorWindow.webContents );

            if ( app.isDev() ) {
                this.logSimulatorWindow.webContents.openDevTools( { mode: 'undocked' } );
            }
            
            let url = `file://${this.#dirname}/dist/index.html#/log/simulator`;
            if ( arg ) {
                url += `/${arg}`;
            }
            this.logSimulatorWindow.loadURL( url );
            this.logSimulatorWindow.once( "ready-to-show", () => {
                this.logSimulatorWindow.show();
                event.sender.send( 'trigger:dialog:log-simulator', true );
            } );
            this.logSimulatorWindow.on( 'closed', () => {
                this.logSimulatorWindow = null;
            } );
            this.logSimulatorWindow.setBackgroundColor( '#1a1a1a' );
            this.configureRendererMouseBlockingOnMoveResize( this.logSimulatorWindow );

        } );

        ipcMain.on( 'trigger:dialog:easy-window', ( event, arg ) => {
            
            if ( this.easyWindow != null ) {
                return;
            }

            this.easyWindow = new BrowserWindow( {
                parent: mainWindowRef.reference,
                modal: false,
                show: false,
                width: 1000,
                height: 800,
                frame: false,
                webPreferences: {
                    nodeIntegration: false,
                    contextIsolation: true,
                    devTools: app.isDev(),
                    sandbox: false,
                    preload: path.join( __dirname, '/preloaders/main.js' ),
                }
            } );

            require( "@electron/remote/main" ).enable( this.easyWindow.webContents );

            if ( app.isDev() ) {
                this.easyWindow.webContents.openDevTools( { mode: 'undocked' } );
            }
            
            let url = `file://${this.#dirname}/dist/index.html#/easy`;
            if ( arg ) {
                url += `/${arg}`;
            }
            this.easyWindow.loadURL( url );
            this.easyWindow.once( "ready-to-show", () => {
                this.easyWindow.show();
                event.sender.send( 'trigger:dialog:easy-window', true );
            } );
            this.easyWindow.on( 'closed', () => {
                this.easyWindow = null;
            } );
            this.easyWindow.setBackgroundColor( '#1a1a1a' );
            this.configureRendererMouseBlockingOnMoveResize( this.easyWindow );

        } );

        ipcMain.on( 'window:update-notes:show', ( event, arg ) => {
            this.showUpdateNotes(event, arg);
        } );

        ipcMain.on( 'renderer:clear-all', ( event, arg ) => {
            this.#renderer.webContents.send( 'renderer:clear-all', null );
        } );
        
        userPreferencesDatabase.onFctStyleChanges.push( fctStyles => {
            this.#renderer.webContents.send( 'fctStyles', fctStyles );
        } );
    }









    
    /**
     * Shows the update notes window.
     * 
     * @param {any} event The ipc message event object.
     * @param {any} arg Passed as a query string to the url.
     */
    showUpdateNotes( event, arg ) {
        this.updateNotesWindow = new BrowserWindow( {
            parent: this.#mainWindow.reference,
            modal: false,
            show: false,
            width: 1000,
            height: 800,
            frame: false,
            webPreferences: {
                nodeIntegration: false,
                devTools: app.isDev(),
                preload: path.join( __dirname, '/preloaders/main.js' ),
                contextIsolation: true,
                sandbox: false,
            }
        } );

        require( "@electron/remote/main" ).enable( this.updateNotesWindow.webContents );

        if ( app.isDev() ) {
            this.updateNotesWindow.webContents.openDevTools( { mode: 'undocked' } );
        }
        let url = `file://${this.#dirname}/dist/index.html#/update-notes`;
        if ( arg ) {
            url += `/${arg}`;
        }
        this.updateNotesWindow.loadURL( url );
        this.updateNotesWindow.once( "ready-to-show", () => {
            this.updateNotesWindow.show();
            event && event.sender.send( 'window:update-notes:show', true );
        } );
        this.updateNotesWindow.on( 'closed', () => {
            this.updateNotesWindow = null;
        } );
        this.updateNotesWindow.setBackgroundColor( '#1a1a1a' );
        this.configureRendererMouseBlockingOnMoveResize( this.updateNotesWindow );
        this.centerBrowserWindowOn( this.updateNotesWindow, this.#mainWindow.reference );
    }










    /**
     * Centers the given centerBWin on top of the given refBWin.
     * 
     * @param {BrowserWindow} centerBWin The browser window to center.
     * @param {BrowserWindow} refBWin The browser window to be centered on.
     */
    centerBrowserWindowOn( centerBWin, refBWin ) {
        let mainWinBounds = refBWin.getBounds();
        let middleX = mainWinBounds.x + ( mainWinBounds.width / 2 );
        let middleY = mainWinBounds.y + ( mainWinBounds.height / 2 );

        let winBounds = centerBWin.getBounds();
        winBounds.x = Math.round( middleX - ( winBounds.width / 2 ) );
        winBounds.y = Math.round( middleY - ( winBounds.height / 2 ) );
        
        centerBWin.setBounds( winBounds );
    }
    









    /**
     * Loads the unified renderer window.
     */
    loadRenderer() {

        let savedBounds = this.#userPrefDb.rendererBounds;
        let bounds = savedBounds == null ? this.calculateRendererBounds() : savedBounds;

        log.info( '[Renderer:loadRenderer] Loading renderer bounds', bounds );

        let renderer = new BrowserWindow( {
            transparent: true,
            frame: false,
            resizable: false,
            movable: false,
            webPreferences: {
                nodeIntegration: false,
                devTools: app.isDev(),
                preload: path.join( __dirname, '/preloaders/renderer.js' ),
                contextIsolation: true,
                sandbox: false,
            },
            skipTaskbar: true,
            maximizable: false,
            enableLargerThanScreen: true,
        } );

        require( "@electron/remote/main" ).enable( renderer.webContents );
        
        // TODO: Put the padding in the size calculations and not here.
        // Reducing the height by 1 pixel will allow access to a hidden taskbar.
        renderer.setBounds( {
            width: bounds.width,
            height: bounds.height - 1,
            x: bounds.x,
            y: bounds.y,
        } );
        
        renderer.loadURL( `file://${__dirname}/threads/renderer.html?originX=${0 - bounds.x}&originY=${0 - bounds.y}&glowOnStart=${this.#userPrefDb.glowOnStartup === true ? 'true' : 'false'}` );
        // renderer.loadURL( `file://${__dirname}/threads/renderer.html` );
        renderer.setIgnoreMouseEvents( true, { forward: false } );

        // https://github.com/electron/electron/issues/10078#issuecomment-331581160
        renderer.setAlwaysOnTop( true, "screen-saver" );
        renderer.setVisibleOnAllWorkspaces( true );
        renderer.setFullScreenable( false );
        
        // renderer.setAlwaysOnTop( true, "screen-saver" );
        
        // Open the DevTools.
        if ( app.isDev() ) {
            renderer.webContents.openDevTools( { mode: 'undocked' } );
        }

        renderer.webContents.once( 'dom-ready', () => {
            renderer.webContents.send( 'fct:change:fctShowCriticalsInline', this.#userPrefDb.fctShowCriticalsInline );
            renderer.webContents.send( 'renderer:combatGroups', this.#overlayDatabase.getCombatGroups() );
        } );

        this.#renderer = renderer;

        rendererOnTopId = setInterval( () => {
            this.#renderer.setAlwaysOnTop( true, "screen-saver" );
            this.#renderer.setVisibleOnAllWorkspaces( true );
            this.#renderer.setFullScreenable( false );
        }, 1000 );

        ipcMain.once( 'main:angular-ready', () => {
            if ( this.#userPrefDb.enableCheckWindowPosition ) {
                log.info( '[WindowManager:main:angular-ready] Initiating overlay position checks.' );
                this.checkOverlayPositions( true );
            }
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
                nodeIntegration: false,
                contextIsolation: true,
                devTools: app.isDev(),
                sandbox: false,
                preload: path.join( __dirname, '/preloaders/death-recap.js' ),
            },
            skipTaskbar: true,
            maximizable: false,
        } );

        require( "@electron/remote/main" ).enable( deathRecap.webContents );

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
            deathRecap.webContents.openDevTools( { mode: 'undocked' } );
        }
        
    }










    /**
     * Loads the last death recap screen.
     * 
     * @param {string} logFilePath The full path to the log file.
     * @param {string} messageId The message id.
     * @param {string} characterName The name of the character that died.
     */
    loadLastDeathRecap( logFilePath, messageId, characterName ) {
        this._loadDeathRecap( logFilePath, 'last', messageId, characterName );
    }










    /**
     * Loads a death recap for the specified character.
     * 
     * @param {LogFileLocation} logFileLocation The location in the log file where death happened.
     * @param {string} messageId The ipc message id.
     * @param {string} characterName The name of the character.
     */
    loadDeathRecap( logFileLocation, messageId, characterName ) {
        this._loadDeathRecap( logFileLocation.logFilePath, logFileLocation.lineNo, messageId, characterName );
    }










    /**
     * Loads the death recap screen.
     * 
     * @param {string} logFilePath The full path to the log file.
     * @param {number|'last'} lineNo The line number of the death, or 'last' to pull the latest death.
     * @param {string} messageId The message id.
     * @param {string} characterName The name of the character that died.
     */
    _loadDeathRecap( logFilePath, lineNo, messageId, characterName ) {
        
        let deathRecap = new BrowserWindow( {
            transparent: true,
            frame: false,
            resizable: true,
            movable: true,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                devTools: app.isDev(),
                sandbox: false,
                preload: path.join( __dirname, '/preloaders/death-recap.js' ),
            },
            skipTaskbar: false,
            maximizable: true,
            minimizable: true,
        } );

        require( "@electron/remote/main" ).enable( deathRecap.webContents );

        let size = { width: 1100, height: 800 };
        let workAreaSize = screen.getPrimaryDisplay().workAreaSize;

        deathRecap.setBounds( {
            width: size.width,
            height: size.height,
            x: ( workAreaSize.width - size.width ) / 2,
            y: ( workAreaSize.height - size.height ) / 2,
        } );
        
        deathRecap.loadURL( `file://${__dirname}/windows/death-recap.html?logFilePath=${encodeURI( logFilePath )}&lineNo=${lineNo}&characterName=${encodeURI(characterName)}&messageId=${encodeURI(messageId)}` );
        deathRecap.setAlwaysOnTop( true, "screen-saver" );
        
        // Open the DevTools.
        if ( app.isDev() ) {
            deathRecap.webContents.openDevTools( { mode: 'undocked' } );
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
        this.configureRendererMouseBlockingOnMoveResize( this.#deathRecap );
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
        if ( rendererOnTopId ) {
            clearTimeout( rendererOnTopId );
        }
        if ( !this.#renderer?.isDestroyed() ) {
            this.#renderer?.close();
        }
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

        if ( this.logSimulatorWindow ) {
            fn( this.logSimulatorWindow, 'logSimulatorWindow' );
        }

        if ( this.updateNotesWindow ) {
            fn( this.updateNotesWindow, 'updateNotesWindow' );
        }

        if ( this.#renderer ) {
            fn( this.#renderer, 'rendererWindow' );
        }

    }










    /**
     * Checks all window positions and moves then back if the window isn't in 
     * edit  mode.
     * 
     * @description 
     *      NOTES:
     *      We won't save changes to the overlay positions here.  If changes 
     *      are made, those changes are sent to the renderer.  If show warning 
     *      is true, then we will display the warning and allow the user to use 
     *      the arrainge window to tweak/save changes to the overlays.
     */
    checkOverlayPositions( showWarning ) {
        showWarning = showWarning === true;
        var currentSize = this.#renderer.getBounds();
        let newSize = this.calculateRendererBounds();
        const displays = screen.getAllDisplays();
        let overlays = this.#overlayDatabase.getAll();

        overlays.forEach( overlay => {
            const display = displays.find( f => f.id === overlay.displayId );

            if ( display ) {
                let boundsChanged = !ElectronUtilities.compareRectangles( overlay.displayBounds, display.bounds, true );

                // First, let's see if the OS has just swapped the display id's around.
                if ( boundsChanged ) {
                    const matchingDisplay = displays.find( f => ElectronUtilities.compareRectangles( overlay.displayBounds, f.bounds, true ) );
                    if ( matchingDisplay != null ) {
                        overlay.displayId = matchingDisplay.id;
                        overlay.displayBounds = matchingDisplay.bounds;
                        overlay.displayLabel = matchingDisplay.label;

                        boundsChanged = false;
                        
                    }
                }

                // If the bounds have changed, and we couldn't find a matching display, then let's attempt to fix the issue.
                if ( boundsChanged ) {
                    let hRatio = display.bounds.width / overlay.displayBounds.width;
                    let vRatio = display.bounds.height / overlay.displayBounds.height;
                    
                    overlay.x = overlay.x * hRatio;
                    overlay.width = overlay.width * hRatio;
                    overlay.y = overlay.y * vRatio;
                    overlay.height = overlay.height * vRatio;
                    overlay.displayBounds = display.bounds;
                    
                }
            } else {
                // If the display no longer exists, then do nothing and the renderer will render it offscreen based on the previous relative display position to origin.
            }

        } );
        
        // If the current size of the renderer doesn't match the calculated size, then we need to resize/move our overlays.
        if ( !ElectronUtilities.compareRectangles( currentSize, newSize, false ) ) {
            
            // Because the size includes the relative position to the primary 
            // display, we can find the (x0,y0) point of the primary display using 
            // this simple formula.
            let newOrigin = { x: 0 - newSize.x, y: 0 - newSize.y };
        
            if ( this.#resizeRenderer( newSize ) ) {

                this.#renderer.webContents.send( 'renderer:resolution-changed', { overlays: overlays, origin: newOrigin } );
    
                if ( showWarning ) {
                    this.#mainWindow.reference.webContents.send( 'dialog:warning', { code: 'Renderer:ResolutionChanged' } );
                }
            }
        }

        this.#userPrefDb.rendererBounds = this.#renderer.getBounds();
    }










    /**
     * Resizes the renderer window.
     * 
     * @returns {boolean} Returns true if the resize was successful.
     * 
     * @param {Electron.Rectangle} newSize The new size for the renderer.
     */
    #resizeRenderer( newSize ) {

        let original = this.#renderer?.getBounds();

        // setSize and setPosition will not work if the window is not movable and resizable.
        this.#renderer.movable = true;
        this.#renderer.resizable = true;

        // Reducing the height by 1 pixel will allow access to a hidden taskbar.
        this.#renderer?.setSize( newSize.width, newSize.height - 1 );
        this.#renderer?.setPosition( newSize.x, newSize.y );

        // Lock this window back down.
        this.#renderer.movable = false;
        this.#renderer.resizable = false;

        let resized = this.#renderer?.getBounds();

        // We only want to return true if the window was actually moved/resized,
        // not if the setSize/setPosition calls didn't cause an exception.
        return ( original?.x !== resized?.x && newSize?.x === resized?.x ) ||
            ( original?.y !== resized?.y && newSize?.y === resized?.y ) ||
            ( original?.width !== resized?.width && newSize?.width === resized?.width ) ||
            ( original?.height !== resized?.height && newSize?.height === resized?.height );
    }










    /**
     * Sends the specified overlay to the middle of the main monitor.
     * 
     * @param {string} overlayId The id of the desired overlay.
     * @param {number} displayId The id of the desired display.
     */
    sendOverlayToMiddle( overlayId, displayId ) {
        const display = screen.getAllDisplays().find( f => f.id === displayId );
        if ( display != null ) {
            let overlay = this.#overlayDatabase.find( overlayId );
            
            log.info( `[Overlay:sendOverlayToMiddle] Sending overlay ${overlayId} to middle of display ${displayId}` );
            
            overlay.x = ( display.size.width - overlay.windowWidth ) / 2;
            overlay.y = ( display.size.height - overlay.windowHeight ) / 2;
            overlay.displayId = displayId;
            overlay.displayBounds = display.bounds;
    
            this.#overlayDatabase.update( overlay );
    
            this.#renderer.webContents.send( 'renderer:overlay:move', { overlayId: overlayId, x: overlay.x, y: overlay.y, displayBounds: display.bounds } );
        }
    }










    /**
     * Attaches event handlers to the given browser window that disables the 
     * mouse forwarding for the renderer while the browser window is being 
     * resized/moved.
     * 
     * @param {BrowserWindow} win The browser window to configure.
     */
    configureRendererMouseBlockingOnMoveResize( win ) {
        
        win.on( 'will-move', e => {

            // If a timeout for resuming mouse forwarding is active, let's cancel it.
            if ( this.#resumeRendererMouseForwardingTimeout != null ) {
                clearTimeout( this.#resumeRendererMouseForwardingTimeout );
                this.#resumeRendererMouseForwardingTimeout = null;
            }

            // Tell renderer to stop capturing mouse capture forwarding.
            this.pauseRendererMouseForwarding();

            // Start a new timeout that will reactivate the mouse forwarding.
            this.#resumeRendererMouseForwardingTimeout = setTimeout( () => {
                this.resumeRendererMouseForwarding();
            }, 500 );
            
        } );

        win.on( 'will-resize', e => {

            // If a timeout for resuming mouse forwarding is active, let's cancel it.
            if ( this.#resumeRendererMouseForwardingTimeout != null ) {
                clearTimeout( this.#resumeRendererMouseForwardingTimeout );
                this.#resumeRendererMouseForwardingTimeout = null;
            }

            // Tell renderer to stop capturing mouse capture forwarding.
            this.pauseRendererMouseForwarding();

            // Start a new timeout that will reactivate the mouse forwarding.
            this.#resumeRendererMouseForwardingTimeout = setTimeout( () => {
                this.resumeRendererMouseForwarding();
            }, 500 );
        } );
        

    }










    /**
     * Pauses mouse forwarding for the renderer.
     */
    pauseRendererMouseForwarding() {
        this.#renderer.webContents.send( 'renderer:mouse-forwarding:pause', {} );
        this.#renderer.setIgnoreMouseEvents( true, { forward: false } );
    }










    /**
     * Resumes mouse forwarding for the renderer.
     */
    resumeRendererMouseForwarding() {
        this.#renderer?.webContents.send( 'renderer:mouse-forwarding:resume', {} );
        this.#renderer?.setIgnoreMouseEvents( true, { forward: true } );
    }


    /**
     * Opens a thread that parses the given url for the eq spell resources resource.
     * 
     * @returns {Promise<string>} Returns the scraped spell.
     * 
     * @param {string} url The EQ Spell Resources url.
     * @param {'spell'|'clickEffect'|undefined} scrapeAction The type of scrape action to execute.
     */
    scrapeEqsrResource( url, scrapeAction ) {
        
        scrapeAction = scrapeAction ? scrapeAction : 'spell';
        let wi = ++this.#windowIndex;

        /** @type {Promise<string>} */
        let p = new Promise( ( resolve, reject ) => {
            
            let scraperWindow = new BrowserWindow( {
                parent: this.#mainWindow.reference,
                modal: false,
                show: false,
                width: 700,
                height: 870,
                frame: false,
                webPreferences: {
                    nodeIntegration: false,
                    contextIsolation: true,
                    devTools: app.isDev(),
                    sandbox: false,
                    preload: path.join( __dirname, '/preloaders/scraper-eqsr.js' ),
                }
            } );
        
            // Open the DevTools.
            if ( app.isDev() ) {
                scraperWindow.webContents.openDevTools( { mode: 'undocked' } );
            }
            
            ipcMain.once( 'scraper:done[' + wi + ']', ( event, spell ) => {
                ipcMain.removeAllListeners( 'scraper:error' );
                scraperWindow.close();
                scraperWindow = null;
                resolve( spell );
            } );

            ipcMain.once( 'scraper:error[' + wi + ']', ( event, error ) => {
                ipcMain.removeAllListeners( 'scraper:done' );
                scraperWindow.close();
                scraperWindow = null;
                reject( error );
            } );

            scraperWindow.loadURL( `file://${__dirname}/threads/scraper-eqsr.html?i=${wi}&action=${scrapeAction}&url=${encodeURI( JSON.stringify( url ) )}` );

        } );
    
        return p;
    }
    









}

module.exports = WindowManager;
