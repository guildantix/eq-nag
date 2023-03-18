const { app, BrowserWindow, ipcMain, screen } = require( "electron" );
const Store = require( './store' );
const ForwardRef = require( '../forward-ref' );
const _ = require( 'lodash' );
const customAlphabet = require( 'nanoid' ).customAlphabet;
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const idLen = 16;
const nanoid = customAlphabet( alphabet, 16 );
const { OverlayDimensions, OverlayWindow, OverlayStoreModel } = require( './models/overlay-window' );
const { StyleProperties } = require( './models/common' );
const TriggerDatabaseStore = require( "./trigger-database" );
const ElectronUtilities = require( "../utilities/electron" );
const { migrateOverlayData } = require( "./migrations/overlay-database-migration" );

const currentOverlayDbVersion = 14;

class OverlayDatabaseStore extends Store {

    /** 
     * The data store for this object.
     * @type {OverlayStoreModel}
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
            migrateOverlayData( this.#data, this.configName, data => {
                this.#data = data;
                this.storeDataFile( this.#data );
            } );
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
     * Attaches store events to ipc main and dispatches react events to the main window.
     * 
     * @param {ForwardRef} mainWindowRef The main window of the application.
     * @param {function} sendTick The send tick method.
     * @param {TriggerDatabaseStore} triggerDb Trigger database.
     */
    attachIpcEvents( mainWindowRef, sendTick, triggerDb ) {
        ipcMain.on( 'overlay:create',
            /**
             * Creates the given overlay window.
             * 
             * @param {any} event The event args.
             * @param {OverlayWindow} overlay The overlay window model to create.
             */
            ( event, overlay ) => {

                // New overlays should be centered on the selected/primary display.
                let displays = screen.getAllDisplays();
                const display = displays.find( f => f.id === overlay.displayId ) ?? screen.getPrimaryDisplay();

                overlay.x = ( display.size.width - overlay.windowWidth ) / 2;
                overlay.y = ( display.size.height - overlay.windowHeight ) / 2;
                overlay.displayId = display.id;
                overlay.displayBounds = display.bounds;

                let overlayId = this.add( overlay );
                event.sender.send( 'overlay:create', overlayId );
                this.#newOverlayHandlers.forEach( fn => fn( overlay ) );
                sendTick();
            } );

        ipcMain.on( 'overlay:get', ( event, overlayId ) => {
            if ( overlayId != null && overlayId.length > 0 ) {
                event.sender.send( 'overlay:get', this.find( overlayId ) );
            } else {
                event.sender.send( 'overlay:get', this.getAll() );
            }
        } );

        ipcMain.on( 'overlay:update', ( event, overlay ) => {
            let updated = this.update( overlay );
            this.#overlayUpdateHandlers.forEach( fn => fn( [ overlay ] ) );
            event.sender.send( 'overlay:update', updated );
            sendTick();
        } );
        
        // TODO: Figure out wtf this was?
        // ipcMain.on( 'overlays:update:position', ( event, overlays ) => {
        //     overlays.forEach( overlay => {
        //         let model = this.find( overlay.overlayId );
        //         model.x = overlay.x;
        //         model.y = overlay.y;
        //         model.windowWidth = overlay.windowWidth;
        //         model.windowHeight = overlay.windowHeight;
        //         this.update( model );
        //     } );
        //     this.#overlayUpdateHandlers.forEach( fn => fn( this.getAll() ) );
        //     event.sender.send( 'overlays:update:position', true );
        //     sendTick();
        // } );

        ipcMain.on( 'overlay:delete', ( event, overlayId ) => {
            let deleted = this.remove( overlayId );
            if ( deleted ) {
                triggerDb.removeOverlayMapping( overlayId );
            }
            this.#overlayDeleteHandlers.forEach( fn => fn( overlayId ) );
            event.sender.send( 'overlay:delete', deleted );
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

                        const display = ElectronUtilities.determineContainingDisplay( d );

                        if ( !display ) {
                            throw `Could not locate display for overlay ${d.overlayId}, dims: ${d.x}, ${d.y}, ${d.windowWidth}, ${d.windowHeight}. displayBounds: ${d.displayBounds}`;
                        }
    
                        model.displayId = display.id;
                        model.displayBounds = display.bounds;
                        model.x = d.x - display.bounds.x;
                        model.y = d.y - display.bounds.y;
                        model.windowWidth = d.windowWidth;
                        model.windowHeight = d.windowHeight;

                        this.update( model );
                    }
                } );
                sendTick();
                // event.sender.send( 'overlays:update:position', true );
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
                event.sender.send( 'renderer:get:overlayDimensions', dims );
            } );

        this.#sendTickRef.setRefFn( () => sendTick );
    }

}

module.exports = OverlayDatabaseStore;
