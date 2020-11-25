const { app, BrowserWindow, ipcMain } = require( "electron" );
const Store = require( './store' );
const ForwardRef = require( '../forward-ref' );
const _ = require( 'lodash' );
const customAlphabet = require( 'nanoid' ).customAlphabet;
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const idLen = 16;
const nanoid = customAlphabet( alphabet, 16 );
const { OverlayWindow } = require( './models/overlay-window' );

class OverlayDatabaseStore extends Store {

    /** 
     * The data store for this object.
     * @type {{overlays: OverlayWindow[]}}
     * */
    #data;

    get count() {
        return this.#data?.overlays?.length;
    }

    constructor() {
        super( {
            configName: "overlays-database",
            defaults: { overlays: [] },
        } );

        this.#data = this.parseDataFile();
        if ( !this.#data.version || this.#data.version < 3 ) {
            this.#data?.overlays?.forEach( f => {
                f.timerSortType = f.overlayType === 'Timer' ? 1 : 0;
            } );
            this.#data.version = 3;
            this.storeDataFile( this.#data );
        }
        if ( !this.#data.version || this.#data.version < 4 ) {
            this.#data?.overlays?.forEach( f => {
                f.timerColor = '#008000';
            } );
            this.#data.version = 4;
            this.storeDataFile( this.#data );
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
        }
        if ( !this.#data.version || this.#data.version < 6 ) {
            this.#data?.overlays?.forEach( f => {
                f.showOnlyDotIcons = false;
                f.dotIconSize = 40;
                f.showTimeRemaining = false;
            } );
            this.#data.version = 6;
            this.storeDataFile( this.#data );
        }
        if ( !this.#data.version || this.#data.version < 7 ) {
            this.#data?.overlays?.forEach( f => {
                f.groupByTarget = f.showOnlyDotIcons;
                delete f.showOnlyDotIcons;
            } );
            this.#data.version = 7;
            this.storeDataFile( this.#data );
        }
        if ( !this.#data.version || this.#data.version < 8 ) {
            this.#data?.overlays?.forEach( f => {
                f.groupHeaderSize = f.dotIconSize;
                delete f.dotIconSize;
            } );
            this.#data.version = 8;
            this.storeDataFile( this.#data );
        }
        if ( !this.#data.version || this.#data.version < 9 ) {
            this.#data?.overlays?.forEach( f => {
                f.groupHeaderWeight = 400;
                f.groupHeaderColor = '#ffffff';
            } );
            this.#data.version = 9;
            this.storeDataFile( this.#data );
        }
        if ( !this.#data.version || this.#data.version < 10 ) {
            this.#data?.overlays?.forEach( f => {
                f.hideTargetLabel = false;
            } );
            this.#data.version = 10;
            this.storeDataFile( this.#data );
        }
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
        overlay.overlayId = nanoid();

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
     */
    attachIpcEvents( mainWindowRef, sendTick ) {
        ipcMain.on( 'overlay:create', ( event, overlay ) => {
            let overlayId = this.add( overlay );
            event.sender.webContents.send( 'overlay:create', overlayId );
            sendTick();
        } );

        ipcMain.on( 'overlay:get', ( event, overlayId ) => {
            if ( overlayId != null && overlayId.length > 0 ) {
                event.sender.webContents.send( 'overlay:get', this.find( overlayId ) );
            } else {
                event.sender.webContents.send( 'overlay:get', this.getAll() );
            }
        } );

        ipcMain.on( 'overlay:update:meta', ( event, overlay ) => {
            let model = this.find( overlay.overlayId );
            overlay.x = model.x;
            overlay.y = model.y;
            overlay.windowWidth = model.windowWidth;
            overlay.windowHeight = model.windowHeight;
            let updated = this.update( overlay );
            event.sender.webContents.send( 'overlay:update:meta', updated );
            sendTick();
        } );

        ipcMain.on( 'overlay:delete', ( event, overlayId ) => {
            let deleted = this.remove( overlayId );
            event.sender.webContents.send( 'overlay:delete', deleted );
            sendTick();
        } );

    }

}

module.exports = OverlayDatabaseStore;
