const { app, BrowserWindow, ipcMain, screen } = require( "electron" );
const Store = require( './store' );
const ForwardRef = require( '../forward-ref' );
const _ = require( 'lodash' );
const customAlphabet = require( 'nanoid' ).customAlphabet;
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const idLen = 16;
const nanoid = customAlphabet( alphabet, 16 );
const { OverlayDimensions, OverlayWindow } = require( './models/overlay-window' );
const { StyleProperties } = require( './models/common' );
const TriggerDatabaseStore = require( "./trigger-database" );

class OverlayDatabaseStore extends Store {

    /** 
     * The data store for this object.
     * @type {{overlays: OverlayWindow[]}}
     * */
    #data;

    /** @type {ForwardRef<() => void>} */
    #sendTickRef = new ForwardRef(() => undefined);

    /**
     * @type {(overlays: OverlayWindow[]) => void}
     */
    #overlayUpdateHandlers = [];

    /**
     * Registers an overlay handler function that executes when position 
     * information is changed.
     * 
     * @param {(overlays: OverlayWindow[]) => void} handler The handler callback
     */
    registerOverlayUpdateHandler( handler ) {
        this.#overlayUpdateHandlers.push( handler );
    }

    /**
     * @type {(overlay: OverlayWindow) => void}
     */
    #newOverlayHandlers = [];

    /**
     * Registers a handler function that is invoked for new overlays.
     * 
     * @param {(overlay: OverlayWindow) => void} handler The handler callback
     */
    registerNewOverlayHandler( handler ) {
        this.#newOverlayHandlers.push( handler );
    }

    /**
     * @type {(overlayId: string) => void}
     */
    #overlayDeleteHandlers = [];

    /**
     * Registers an overlay handler function that executes when the overlay has been deleted.
     * 
     * @param {(overlayId: string) => void} handler The handler callback
     */
    registerOverlayDeleteHandler( handler ) {
        this.#overlayDeleteHandlers.push( handler );
    }

    get count() {
        return this.#data?.overlays?.length;
    }

    constructor() {
        super( {
            configName: "overlays-database",
            defaults: { overlays: [] },
        } );

        this.#data = this.parseDataFile();

        app.on( 'ready', () => {
            let changes = false;

            if ( !this.#data.version || this.#data.version < 3 ) {
                this.#data?.overlays?.forEach( f => {
                    f.timerSortType = f.overlayType === 'Timer' ? 1 : 0;
                } );
                this.#data.version = 3;
                this.storeDataFile( this.#data );
                changes = true;
            }
            if ( !this.#data.version || this.#data.version < 4 ) {
                this.#data?.overlays?.forEach( f => {
                    f.timerColor = '#008000';
                } );
                this.#data.version = 4;
                this.storeDataFile( this.#data );
                changes = true;
            }
            if ( !this.#data.version || this.#data.version < 5 ) {
                this.#data?.overlays?.forEach( f => {
    
                    f.showTextBorder = false;
                    f.textBorderColor = '#000000';
                    f.textBorderIntensity = 1;
            
                    f.showTextGlow = false;
                    f.textGlowColor = '#000000';
                    f.textGlowIntensity = 1;
                    f.textGlowSize = 10;
                
                } );
                this.#data.version = 5;
                this.storeDataFile( this.#data );
                changes = true;
            }
            if ( !this.#data.version || this.#data.version < 6 ) {
                this.#data?.overlays?.forEach( f => {
                    f.showOnlyDotIcons = false;
                    f.dotIconSize = 40;
                    f.showTimeRemaining = false;
                } );
                this.#data.version = 6;
                this.storeDataFile( this.#data );
                changes = true;
            }
            if ( !this.#data.version || this.#data.version < 7 ) {
                this.#data?.overlays?.forEach( f => {
                    f.groupByTarget = f.showOnlyDotIcons;
                    delete f.showOnlyDotIcons;
                } );
                this.#data.version = 7;
                this.storeDataFile( this.#data );
                changes = true;
            }
            if ( !this.#data.version || this.#data.version < 8 ) {
                this.#data?.overlays?.forEach( f => {
                    f.groupHeaderSize = f.dotIconSize;
                    delete f.dotIconSize;
                } );
                this.#data.version = 8;
                this.storeDataFile( this.#data );
                changes = true;
            }
            if ( !this.#data.version || this.#data.version < 9 ) {
                this.#data?.overlays?.forEach( f => {
                    f.groupHeaderWeight = 400;
                    f.groupHeaderColor = '#ffffff';
                } );
                this.#data.version = 9;
                this.storeDataFile( this.#data );
                changes = true;
            }
            if ( !this.#data.version || this.#data.version < 10 ) {
                this.#data?.overlays?.forEach( f => {
                    f.hideTargetLabel = false;
                } );
                this.#data.version = 10;
                this.storeDataFile( this.#data );
                changes = true;
            }
            if ( !this.#data.version || this.#data.version < 11 ) {

                this.#data?.overlays?.forEach( f => {
                    if ( f.overlayType === 'FCT' ) {

                        f.fctDmgOutStyle = new StyleProperties();
                        f.fctDmgOutStyle.fontSize = 32;
                        f.fctDmgOutStyle.lineHeight = 95;
                        f.fctDmgOutStyle.fontWeight = 700;
                        f.fctDmgOutStyle.glowSize = 10;

                        f.fctDmgInStyle = new StyleProperties();
                        f.fctDmgInStyle.fontSize = 32;
                        f.fctDmgInStyle.lineHeight = 95;
                        f.fctDmgInStyle.fontWeight = 700;
                        f.fctDmgInStyle.fontColor = '#b71c1c';
                        f.fctDmgInStyle.glowSize = 10;

                        f.fctSpellDmgOutStyle = new StyleProperties();
                        f.fctSpellDmgOutStyle.fontSize = 32;
                        f.fctSpellDmgOutStyle.lineHeight = 95;
                        f.fctSpellDmgOutStyle.fontWeight = 700;
                        f.fctSpellDmgOutStyle.glowSize = 10;

                        f.fctSpellDmgInStyle = new StyleProperties();
                        f.fctSpellDmgInStyle.fontSize = 32;
                        f.fctSpellDmgInStyle.lineHeight = 95;
                        f.fctSpellDmgInStyle.fontWeight = 700;
                        f.fctSpellDmgInStyle.fontColor = '#b71c1c';
                        f.fctSpellDmgInStyle.glowSize = 10;

                        f.fctHealingOutStyle = new StyleProperties();
                        f.fctHealingOutStyle.fontSize = 32;
                        f.fctHealingOutStyle.lineHeight = 95;
                        f.fctHealingOutStyle.fontWeight = 700;
                        f.fctHealingOutStyle.fontColor = '#42a5f5';
                        f.fctHealingOutStyle.glowSize = 10;

                        f.fctHealingInStyle = new StyleProperties();
                        f.fctHealingInStyle.fontSize = 32;
                        f.fctHealingInStyle.lineHeight = 95;
                        f.fctHealingInStyle.fontWeight = 700;
                        f.fctHealingInStyle.fontColor = '#42a5f5';
                        f.fctHealingInStyle.glowSize = 10;

                        f.fctSkillStyle = new StyleProperties();
                        f.fctSkillStyle.fontSize = 12;
                        f.fctSkillStyle.fontWeight = 400;
                        f.fctSkillStyle.fontColor = '#005aff';
                    }
                } );

                this.#data.version = 11;
                this.storeDataFile( this.#data );
                changes = true;
            }
            if ( !this.#data.version || this.#data.version < 12 ) {

                this.#data?.overlays?.forEach( f => {
                    if ( f.overlayType === 'FCT' ) {

                        delete f.fctDmgOutStyle;
                        delete f.fctDmgInStyle;
                        delete f.fctSpellDmgOutStyle;
                        delete f.fctSpellDmgInStyle;
                        delete f.fctHealingOutStyle;
                        delete f.fctHealingInStyle;
                        delete f.fctSkillStyle;
                    }
                } );

                this.#data.version = 12;
                this.storeDataFile( this.#data );
                changes = true;
            }
            if ( !this.#data.version || this.#data.version < 13 ) {

                this.#data?.overlays?.forEach( f => {
                    f.monitorId = null;
                } );

                this.#data.version = 13;
                this.storeDataFile( this.#data );
                changes = true;
            }
            if ( !this.#data.version || this.#data.version < 14 ) {
            
                let displays = screen.getAllDisplays();

                this.#data?.overlays?.forEach( overlay => {
                    const displayId = this.determineOverlayDisplay( displays, overlay );
                    const display = displays.find( f => f.id === displayId );

                    delete overlay.monitorId;

                    overlay.displayId = displayId;
                    overlay.displayBounds = display.bounds;
                    overlay.x = overlay.x - display.bounds.x;
                    overlay.y = overlay.y - display.bounds.y;

                } );

                this.#data.version = 14;
                this.storeDataFile( this.#data );
                changes = true;
            }
        } );

    }
    
    /**
     * Adds the given overlay to the store.
     * 
     * @returns {string} Returns the generated overlay id.
     * 
     * @param {OverlayWindow} overlay The overlay to add to the store.
     */
    add( overlay ) {

        // Init the overlays array.
        this.#data.overlays = this.#data.overlays ? this.#data.overlays : [];

        // Generate a new id for the overlay.
        overlay.overlayId = overlay.overlayId?.length === 16 ? overlay.overlayId : nanoid();

        // Add it to the store.
        this.#data.overlays.push( overlay );

        // Save changes to the data.
        this.storeDataFile( this.#data );

        return overlay.overlayId;
    }
    
    /**
     * Removes the specified overlay.
     * 
     * @param {string} overlayId The overlay to remove.
     */
    remove( overlayId ) {
        if ( this.#data?.overlays?.length > 0 ) {

            // Find the index of the overlay.
            let i = _.findIndex( this.#data.overlays, ( e ) => e.overlayId === overlayId );

            // Remove the overlay by index.
            return this.removeIndex( i );

        }
    }
    
    /**
     * Removes the overlay at the specified index.
     * 
     * @param {number} i The index of the overlay to remove.
     */
    removeIndex( i ) {
        if ( this.#data?.overlays?.length > i ) {

            // Remove the overlay by index.
            let removed = this.#data.overlays.splice( i, 1 );

            // Save the changes to the data.
            this.storeDataFile( this.#data );

            // Return true if at least 1 item was removed.
            return removed?.length > 0;
        }
    }
    
    /**
     * Returns the overlay with the given id.
     * 
     * @returns {OverlayWindow} Returns the specified overlay window.
     * 
     * @param {string} overlayId The overlay id of the desired overlay.
     */
    find( overlayId ) {

        // Find the index of the overlay by Id.
        let i = _.findIndex( this.#data.overlays, ( e ) => e.overlayId === overlayId );

        // If the index is valid, then return the found overlay.
        if ( i > -1 && i < this.#data?.overlays?.length ) {
            return this.#data.overlays[ i ];
        }
    }

    /**
     * Updates the given overlay in the store.
     * 
     * @returns {boolean} Returns true if the overlay was updated.
     * 
     * @param {TriggerModel} overlay The overlay to update.
     */
    update( overlay ) {

        // Find the index of the overlay by Id.
        let i = _.findIndex( this.#data.overlays, ( e ) => e.overlayId === overlay.overlayId );

        // If the index is valid, then update the found overlay.
        if ( i > -1 && i < this.#data?.overlays?.length ) {
            this.#data.overlays[ i ] = overlay;

            // Save changes to the data.
            this.storeDataFile( this.#data );

            return true;
        } else {
            return false;
        }
        
    }
    
    /**
     * Returns all overlays.
     * 
     * @returns {OverlayWindow[]} Returns the list of all overlay windows.
     */
    getAll() {
        return this.#data.overlays;
    }










    /**
     * Returns the monitor id for the given display, by it's relative position to the screenspace.
     * 
     * @param {Electron.Display[]} displays The displays connected to this session.
     * @param {OverlayWindow} overlay The overlay window to process.
     */
    determineOverlayDisplay( displays, overlay ) {

        for ( let i = 0; i < displays.length; i++ ) {
            const display = displays[ i ];

            let xContained = overlay.x >= display.bounds.x && overlay.y <= ( display.bounds.x + display.bounds.width );
            let yContained = overlay.y >= display.bounds.y && overlay.y <= ( display.bounds.y + display.bounds.height );

            if ( xContained && yContained ) {
                return display.id;
            }

        }

    }










    /**
     * Attaches store events to ipc main and dispatches react events to the main window.
     * 
     * @param {ForwardRef} mainWindowRef The main window of the application.
     * @param {function} sendTick The send tick method.
     * @param {TriggerDatabaseStore} triggerDb Trigger database.
     */
    attachIpcEvents( mainWindowRef, sendTick, triggerDb ) {
        ipcMain.on( 'overlay:create', ( event, overlay ) => {
            let overlayId = this.add( overlay );
            event.sender.webContents.send( 'overlay:create', overlayId );
            this.#newOverlayHandlers.forEach( fn => fn( overlay ) );
            sendTick();
        } );

        ipcMain.on( 'overlay:get', ( event, overlayId ) => {
            if ( overlayId != null && overlayId.length > 0 ) {
                event.sender.webContents.send( 'overlay:get', this.find( overlayId ) );
            } else {
                event.sender.webContents.send( 'overlay:get', this.getAll() );
            }
        } );

        ipcMain.on( 'overlay:update', ( event, overlay ) => {
            let updated = this.update( overlay );
            this.#overlayUpdateHandlers.forEach( fn => fn( [ overlay ] ) );
            event.sender.webContents.send( 'overlay:update', updated );
            sendTick();
        } );
        
        ipcMain.on( 'overlays:update:position', ( event, overlays ) => {
            overlays.forEach( overlay => {
                let model = this.find( overlay.overlayId );
                model.x = overlay.x;
                model.y = overlay.y;
                model.windowWidth = overlay.windowWidth;
                model.windowHeight = overlay.windowHeight;
                this.update( model );
            } );
            this.#overlayUpdateHandlers.forEach( fn => fn( this.getAll() ) );
            event.sender.webContents.send( 'overlays:update:position', true );
            sendTick();
        } );

        ipcMain.on( 'overlay:delete', ( event, overlayId ) => {
            let deleted = this.remove( overlayId );
            if ( deleted ) {
                triggerDb.removeOverlayMapping( overlayId );
            }
            this.#overlayDeleteHandlers.forEach( fn => fn( overlayId ) );
            event.sender.webContents.send( 'overlay:delete', deleted );
            sendTick();
        } );

        ipcMain.on( 'overlay:set:overlayDimensions',
            /**
             * Updates all overlay dimensions.
             * 
             * @param {any} event The event args?
             * @param {OverlayDimensions[]} dims The overlay dimensions
             */
            ( event, dims ) => {
                dims.forEach( d => {
                    let model = this.find( d.overlayId );
                    if ( model ) {
                        model.x = d.x;
                        model.y = d.y;
                        model.windowWidth = d.windowWidth;
                        model.windowHeight = d.windowHeight;
                        this.update( model );
                    }
                } );
                event.sender.webContents.send( 'overlays:update:position', true );
            } );
        
        ipcMain.on( 'overlay:get:overlayDimensions',
            /**
             * Returns a list of all overlay dimensions.
             * 
             * @param {any} event The event args?
             */
            ( event ) => {
                let overlays = this.getAll();
                /** @type {OverlayDimensions[]} */
                let dims = [];
                overlays.forEach( o => {
                    let d = new OverlayDimensions();
                    d.overlayId = o.overlayId;
                    d.x = o.x;
                    d.y = o.y;
                    d.windowWidth = o.windowWidth;
                    d.windowHeight = o.windowHeight;
                    d.displayBounds = o.displayBounds;
                    dims.push( d );
                } );
                event.sender.webContents.send( 'renderer:get:overlayDimensions', dims );
            } );

        this.#sendTickRef.setRefFn( () => sendTick );
    }

}

module.exports = OverlayDatabaseStore;
