const { app, BrowserWindow, ipcMain, screen } = require( "electron" );
const Store = require( './store' );
const ForwardRef = require( '../forward-ref' );
const _ = require( 'lodash' );
const customAlphabet = require( 'nanoid' ).customAlphabet;
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const idLen = 16;
const nanoid = customAlphabet( alphabet, 16 );
const { OverlayDimensions, OverlayWindow, OverlayStoreModel, CombatTypes, FctCombatGroup, HitStartPositionTypes } = require( './models/overlay-window' );
const { StyleProperties } = require( './models/common' );
const TriggerDatabaseStore = require( "./trigger-database" );
const ElectronUtilities = require( "../utilities/electron" );
const { migrateOverlayData } = require( "./migrations/overlay-database-migration" );
const UserPreferencesStore = require( "./user-preferences" );
const { StylePropertiesModel } = require( "./models/core" );
/** @type {FctCombatGroup} */
const defaultCriticalsGroup = require( "./predefined-fct-groups/my-critical-hits.json" );
/** @type {FctCombatGroup} */
const defaultHitsGroup = require( "./predefined-fct-groups/my-hits.json" );
/** @type {FctCombatGroup} */
const defaultHealingCriticalsGroup = require( "./predefined-fct-groups/my-healing-crits.json" );
/** @type {FctCombatGroup} */
const defaultHealingGroup = require( "./predefined-fct-groups/my-healing.json" );
/** @type {FctCombatGroup} */
const defaultOtherCriticalsGroup = require( "./predefined-fct-groups/other-critical-hits.json" );
/** @type {FctCombatGroup} */
const defaultOtherHitsGroup = require( "./predefined-fct-groups/other-hits.json" );
/** @type {FctCombatGroup} */
const defaultOtherHealingGroup = require( "./predefined-fct-groups/other-healing.json" );

// TODO: Update the installer to walk the user through creating the FCT overlays and combat groups.
// TODO: Add overlay importer for FCT overlays.
// TODO: Add importer for FCT combat groups.
// TODO: Add exporter for FCT combat groups and overlays.
// TODO: Create an api endpoint for getting/creating the FCT combat groups and overlays.

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
     * @type {(combatGroups: FctCombatGroup[]) => void}
     */
    #combatGroupUpdateHandlers = [];

    /** @type {UserPreferencesStore} */
    #userPrefDb;

    /**
     * Registers a combat group handler that executes when the combat groups 
     * are changed.
     * 
     * @param {(combatGroups: FctCombatGroup[]) => void} handler The handler function.
     */
    registerCombatGroupUpdateHandler( handler ) {
        this.#combatGroupUpdateHandlers.push( handler );
    }

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
     * Updates the given combat group in the store.
     * 
     * @returns {string} Returns the combat group id.
     * 
     * @param {FctCombatGroup} combatGroup The combat group to update.
     */
    updateCombatGroup( combatGroup ) {
        let i = this.#data.fctCombatGroups.findIndex( f => f.combatGroupId === combatGroup.combatGroupId );

        if ( i > -1 && i < this.#data?.fctCombatGroups?.length ) {
            this.#data.fctCombatGroups[ i ] = combatGroup;
            this.storeDataFile( this.#data );
        } else if ( i === -1 ) {
            combatGroup.combatGroupId = combatGroup.combatGroupId?.length === 16 ? combatGroup.combatGroupId : nanoid();
            this.#data.fctCombatGroups.push( combatGroup );
            this.storeDataFile( this.#data );
        }

        return combatGroup.combatGroupId;
    }

    /**
     * Returns all combat groups.
     * 
     * @returns {FctCombatGroup[]} Returns the list of all combat groups.
     */
    getCombatGroups() {
        return this.#data.fctCombatGroups;
    }

    /**
     * Removes the specified combat group.
     * 
     * @param {string} combatGroupId The combat group id to remove.
     */
    removeCombatGroup( combatGroupId ) {
        if ( this.#data?.fctCombatGroups?.length > 0 ) {
            let i = this.#data.fctCombatGroups.findIndex( e => e.combatGroupId === combatGroupId );

            if ( i > -1 ) {
                this.#data.fctCombatGroups.splice( i, 1 );
                this.storeDataFile( this.#data );
            }
        }
    }

    /**
     * Initializes and creates the default combat groups.
     */
    initializeFctCombatGroups() {
        let criticalsGroup = Object.assign( new FctCombatGroup(), defaultCriticalsGroup );
        criticalsGroup.combatGroupId = nanoid();
        criticalsGroup.overlayId = this.#userPrefDb.damageDealtOverlayId;

        let hitsGroup = Object.assign( new FctCombatGroup(), defaultHitsGroup );
        hitsGroup.combatGroupId = nanoid();
        hitsGroup.overlayId = this.#userPrefDb.damageDealtOverlayId;

        let healingCriticalsGroup = Object.assign( new FctCombatGroup(), defaultHealingCriticalsGroup );
        healingCriticalsGroup.combatGroupId = nanoid();
        healingCriticalsGroup.overlayId = this.#userPrefDb.damageDealtOverlayId;

        let healingGroup = Object.assign( new FctCombatGroup(), defaultHealingGroup );
        healingGroup.combatGroupId = nanoid();
        healingGroup.overlayId = this.#userPrefDb.damageDealtOverlayId;

        let otherCriticalsGroup = Object.assign( new FctCombatGroup(), defaultOtherCriticalsGroup );
        otherCriticalsGroup.combatGroupId = nanoid();
        otherCriticalsGroup.overlayId = this.#userPrefDb.damageReceivedOverlayId;

        let otherHitsGroup = Object.assign( new FctCombatGroup(), defaultOtherHitsGroup );
        otherHitsGroup.combatGroupId = nanoid();
        otherHitsGroup.overlayId = this.#userPrefDb.damageReceivedOverlayId;

        let otherHealingGroup = Object.assign( new FctCombatGroup(), defaultOtherHealingGroup );
        otherHealingGroup.combatGroupId = nanoid();
        otherHealingGroup.overlayId = this.#userPrefDb.damageReceivedOverlayId;

        
        this.#data.fctCombatGroups.push( criticalsGroup );
        this.#data.fctCombatGroups.push( hitsGroup );
        this.#data.fctCombatGroups.push( healingCriticalsGroup );
        this.#data.fctCombatGroups.push( healingGroup );
        this.#data.fctCombatGroups.push( otherCriticalsGroup );
        this.#data.fctCombatGroups.push( otherHitsGroup );
        this.#data.fctCombatGroups.push( otherHealingGroup );
        
        this.storeDataFile( this.#data );
    }

    /**
     * Migrates existing FCT styles into the new combat groups.
     */
    migrateFctStylesToCombatGroups() {

        if ( this.#userPrefDb.fctStyles?.fctSpellDmgOutStyle || this.#userPrefDb.fctStyles?.fctDmgOutStyle ) {
            // My criticals
            let group = new FctCombatGroup();
            group.combatGroupId = nanoid();
            group.name = 'My Criticals';
            group.overlayId = this.#userPrefDb.damageDealtOverlayId;
            group.combatTypes.myHits = true;
            group.combatTypes.mySpellHits = true;
            group.combatTypes.myHealing = true;

            group.valueStyles = Object.assign( new StylePropertiesModel(), this.#userPrefDb.fctStyles.fctSpellDmgOutStyle );
            group.sourceStyles.fontColor = '#1976d2';
            group.sourceStyles.paddingLeft = 8;
            
            group.startingPosition = HitStartPositionTypes.random;
            group.combatAnimations.blowout = true;

            group.combatModifiers = [
                'critical'
            ];

            this.#data.fctCombatGroups.push( group );
        }

        if ( this.#userPrefDb.fctStyles?.fctDmgOutStyle ) {
            // My Damage group
            let group = new FctCombatGroup();
            group.combatGroupId = nanoid();
            group.name = 'My Damage';
            group.overlayId = this.#userPrefDb.damageDealtOverlayId;
            group.combatTypes.myHits = true;

            group.valueStyles = Object.assign( new StylePropertiesModel(), this.#userPrefDb.fctStyles.fctDmgOutStyle );
            group.sourceStyles.fontColor = '#1976d2';
            group.sourceStyles.paddingLeft = 8;
            
            group.startingPosition = HitStartPositionTypes.left | HitStartPositionTypes.bottom;
            group.combatAnimations.scroll = true;

            group.combatModifiers = [
                'normal',
                'crippling_blow',
                'flurry',
                'lucky',
                'twincast',
                'riposte',
                'strikethrough',
                'wild_rampage',
                'rampage',
                'assassinate',
                'headshot',
                'double_bow_shot',
                'deadly_strike',
                'finishing_blow'
            ];

            this.#data.fctCombatGroups.push( group );
        }

        if ( this.#userPrefDb.fctStyles?.fctSpellDmgOutStyle ) {
            // My Spell Damage group
            let group = new FctCombatGroup();
            group.combatGroupId = nanoid();
            group.name = 'My Spells';
            group.overlayId = this.#userPrefDb.damageDealtOverlayId;
            group.combatTypes.mySpellHits = true;

            group.valueStyles = Object.assign( new StylePropertiesModel(), this.#userPrefDb.fctStyles.fctSpellDmgOutStyle );
            group.sourceStyles.fontColor = '#1976d2';
            group.sourceStyles.paddingLeft = 8;
            
            group.startingPosition = HitStartPositionTypes.left | HitStartPositionTypes.bottom;
            group.combatAnimations.scroll = true;

            group.combatModifiers = [
                'normal',
                'crippling_blow',
                'flurry',
                'lucky',
                'twincast',
                'riposte',
                'strikethrough',
                'wild_rampage',
                'rampage',
                'assassinate',
                'headshot',
                'double_bow_shot',
                'deadly_strike',
                'finishing_blow'
            ];

            this.#data.fctCombatGroups.push( group );
        }

        if ( this.#userPrefDb.fctStyles?.fctHealingOutStyle ) {
            // My Healing group
            let group = new FctCombatGroup();
            group.combatGroupId = nanoid();
            group.name = 'My Healing';
            group.overlayId = this.#userPrefDb.damageDealtOverlayId;
            group.combatTypes.myHealing = true;

            group.valueStyles = Object.assign( new StylePropertiesModel(), this.#userPrefDb.fctStyles.fctHealingOutStyle );
            group.sourceStyles.fontColor = '#1976d2';
            group.sourceStyles.paddingLeft = 8;
            
            group.startingPosition = HitStartPositionTypes.left | HitStartPositionTypes.bottom;
            group.combatAnimations.scroll = true;

            group.combatModifiers = [
                'normal',
                'crippling_blow',
                'flurry',
                'lucky',
                'twincast',
                'riposte',
                'strikethrough',
                'wild_rampage',
                'rampage',
                'assassinate',
                'headshot',
                'double_bow_shot',
                'deadly_strike',
                'finishing_blow'
            ];

            this.#data.fctCombatGroups.push( group );
        }

        if ( this.#userPrefDb.fctStyles?.fctDmgInStyle ) {
            // Other Damage group
            let group = new FctCombatGroup();
            group.combatGroupId = nanoid();
            group.name = 'Other Damage';
            group.overlayId = this.#userPrefDb.damageReceivedOverlayId;
            group.combatTypes.otherHitsOnMe = true;

            group.valueStyles = Object.assign( new StylePropertiesModel(), this.#userPrefDb.fctStyles.fctDmgInStyle );
            group.sourceStyles.fontColor = '#1976d2';
            group.sourceStyles.paddingLeft = 8;
            
            group.startingPosition = HitStartPositionTypes.left | HitStartPositionTypes.bottom;
            group.combatAnimations.scroll = true;

            group.combatModifiers = [
                'normal',
                'critical',
                'crippling_blow',
                'flurry',
                'lucky',
                'twincast',
                'riposte',
                'strikethrough',
                'wild_rampage',
                'rampage',
                'assassinate',
                'headshot',
                'double_bow_shot',
                'deadly_strike',
                'finishing_blow'
            ];

            this.#data.fctCombatGroups.push( group );
        }

        if ( this.#userPrefDb.fctStyles?.fctSpellDmgInStyle ) {
            // Other Spell Damage group
            let group = new FctCombatGroup();
            group.combatGroupId = nanoid();
            group.name = 'Other Spell Damage';
            group.overlayId = this.#userPrefDb.damageReceivedOverlayId;
            group.combatTypes.otherSpellHitsOnMe = true;

            group.valueStyles = Object.assign( new StylePropertiesModel(), this.#userPrefDb.fctStyles.fctSpellDmgInStyle );
            group.sourceStyles.fontColor = '#1976d2';
            group.sourceStyles.paddingLeft = 8;
            
            group.startingPosition = HitStartPositionTypes.left | HitStartPositionTypes.bottom;
            group.combatAnimations.scroll = true;

            group.combatModifiers = [
                'normal',
                'critical',
                'crippling_blow',
                'flurry',
                'lucky',
                'twincast',
                'riposte',
                'strikethrough',
                'wild_rampage',
                'rampage',
                'assassinate',
                'headshot',
                'double_bow_shot',
                'deadly_strike',
                'finishing_blow'
            ];

            this.#data.fctCombatGroups.push( group );
        }

        if ( this.#userPrefDb.fctStyles?.fctHealingInStyle ) {
            // Other healing me group
            let group = new FctCombatGroup();
            group.combatGroupId = nanoid();
            group.name = 'Other Healing';
            group.overlayId = this.#userPrefDb.damageDealtOverlayId;
            group.combatTypes.otherHealingOnMe = true;

            group.valueStyles = Object.assign( new StylePropertiesModel(), this.#userPrefDb.fctStyles.fctHealingInStyle );
            group.sourceStyles.fontColor = '#1976d2';
            group.sourceStyles.paddingLeft = 8;
            
            group.startingPosition = HitStartPositionTypes.right | HitStartPositionTypes.bottom;
            group.combatAnimations.scroll = true;

            group.combatModifiers = [
                'normal',
                'critical',
                'crippling_blow',
                'flurry',
                'lucky',
                'twincast',
                'riposte',
                'strikethrough',
                'wild_rampage',
                'rampage',
                'assassinate',
                'headshot',
                'double_bow_shot',
                'deadly_strike',
                'finishing_blow'
            ];

            this.#data.fctCombatGroups.push( group );
        }
        
        this.storeDataFile( this.#data );
    }









    
    /**
     * Emits the combat group changes to all registered handlers.
     */
    emitCombatGroupChanges() {
        this.#combatGroupUpdateHandlers.forEach( fn => fn( this.#data.fctCombatGroups ) );
    }










    /**
     * Attaches store events to ipc main and dispatches react events to the main window.
     * 
     * @param {ForwardRef} mainWindowRef The main window of the application.
     * @param {function} sendTick The send tick method.
     * @param {TriggerDatabaseStore} triggerDb Trigger database.
     * @param {UserPreferencesStore} userPreferencesDatabase The user pref database.
     */
    attachIpcEvents( mainWindowRef, sendTick, triggerDb, userPreferencesDatabase ) {
        
        this.#userPrefDb = userPreferencesDatabase;

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

        ipcMain.on( 'overlay:migrate-fct', ( event ) => {
            this.migrateFctStylesToCombatGroups();
            event.sender.send( 'overlay:migrate-fct', true );
        } );

        ipcMain.on( 'overlay:initialize-fct', ( event ) => {
            this.initializeFctCombatGroups();
            event.sender.send( 'overlay:initialize-fct', true );
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

        ipcMain.on( 'overlay:get:combatGroups', ( event ) => {
            event.sender.send( 'overlay:get:combatGroups', this.getCombatGroups() );
        } );

        ipcMain.on( 'overlay:get:combatGroup', ( event, combatGroupId ) => {
            event.sender.send( 'overlay:get:combatGroup', this.getCombatGroups().find( f => f.combatGroupId === combatGroupId ) );
        } );

        ipcMain.on( 'overlay:update:combatGroup',
            /**
             * Updates the given combat group, and if provided resorts the combat group order.
             * 
             * @param {Electron.IpcMainEvent} event The event args.
             * @param {{ group: FctCombatGroup, sort: string[] | undefined }} model The update model including the combat group and sort order.
             */
            ( event, model ) => {
                let id = this.updateCombatGroup( model.group );
                if ( model.sort ) {
                    this.#data.fctCombatGroups = _.sortBy( this.#data.fctCombatGroups, f => {
                        return model.sort.findIndex( s => s === f.combatGroupId );
                    } );
                    this.storeDataFile( this.#data );
                }
                event.sender.send( 'overlay:update:combatGroup', id );
                this.emitCombatGroupChanges();
            } );

        ipcMain.on( 'overlay:delete:combatGroup', ( event, combatGroupId ) => {
            this.removeCombatGroup( combatGroupId );
            event.sender.send( 'overlay:delete:combatGroup', true );
            this.emitCombatGroupChanges();
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
        
            ipcMain.on( 'overlay:install-overlays',
                /**
                 * Installs the given overlay data.
                 * 
                 * @param {Electron.IpcMainEvent} event The event args.
                 * @param {{overlays: OverlayWindow[], packagePrimaryDisplaySize: Electron.Size}} data The overlay data.
                 */
                ( event, data ) => {
                    this.installOverlays( data.overlays, data.packagePrimaryDisplaySize, event, () => {
                        event.sender.send( 'overlay:install-overlays', this.getAll() );
                    } );
                } );
        
            ipcMain.on( 'overlay:install-combat-groups',
                /**
                 * Installs the given combat groups.
                 * 
                 * @param {Electron.IpcMainEvent} event The event args.
                 * @param {FctCombatGroup[]} data The combat groups to install.
                 */
                ( event, data ) => {
                    this.installCombatGroups( data );
                    event.sender.send( 'overlay:install-combat-groups', this.getCombatGroups() );
                } );

        this.#sendTickRef.setRefFn( () => sendTick );
    }










    /**
     * Installs the given list of combat groups, removing all previous combat groups, and updates the store.
     * 
     * @param {FctCombatGroup[]} packagedCombatGroups The combat groups to install.
     */
    installCombatGroups( packagedCombatGroups ) {
        let rollback = this.#data.fctCombatGroups.slice();

        try {
            // Clear existing combat groups.
            this.#data.fctCombatGroups = [];

            // Add the new combat groups.
            packagedCombatGroups.forEach( g => {
                g.overlayId = this.#data.overlayMap[ g.overlayId ];
                this.#data.fctCombatGroups.push( g );
            } );

            // Save the changes.
            this.storeDataFile( this.#data );

            // Emit the changes.
            this.emitCombatGroupChanges();

        } catch ( error ) {
            this.#data.fctCombatGroups = rollback;
            throw error;
        }
    }










    /**
     * Ensures that the overlays are installed.
     * 
     * @remarks Install is a bad choice here, when a package overlay is 
     *  missing, it is sent to the main window with the intent to have the user 
     *  step through creating a matching overlay.  Once all overlays have a 
     *  matching overlay in user data, then the package can be installed.
     * 
     * @param {OverlayWindow[]} packageOverlays The packaged overlays.
     * @param {Electron.Size} packagePrimaryDisplaySize The original event args.
     * @param {Electron.IpcMainEvent} event The original event args.
     * @param {(overlayMap: Record<string, string>) => void} callback The callback function executed after all overlay maps have been completed.
     */
    installOverlays( packageOverlays, packagePrimaryDisplaySize, event, callback ) {
        let overlayMap = this.#data.overlayMap ?? {};
        
        let finalize = () => {
            this.#data.overlayMap = overlayMap;
            this.storeDataFile( this.#data );
        }

        let missingOverlays = packageOverlays?.filter( f => overlayMap[ f.overlayId ] == null ) ?? [];
        let myDisplaySize = screen.getPrimaryDisplay().size;
        let sizeRatio = { heightRatio: myDisplaySize.height / packagePrimaryDisplaySize?.height ?? 1, widthRatio: myDisplaySize.width / packagePrimaryDisplaySize?.width ?? 1 };
        
        let installOverlay =
            /**
             * Execute the process for installing trigger overlays.
             * 
             * @param {number} i The index of the overlay.
             */
            ( i ) => {

                if ( i < missingOverlays.length ) {
                    // If we still have more overlays to process, then send that to the sender.
                    ipcMain.once( `trigger:missing-overlay:${missingOverlays[ i ].overlayId}`, ( event, userOverlayId ) => {
                        overlayMap[ missingOverlays[ i ].overlayId ] = userOverlayId;
                        installOverlay( i + 1 );
                    } );

                    if ( packagePrimaryDisplaySize ) {
                        // Because the origin of the renderer is at the top left 
                        // corner of the primary display, these calculations can be 
                        // simplified. If the bounds of the overlay extend past the 
                        // bounds of the primary display, we need to just center 
                        // the new display, otherwise we can adjust by ratio to 
                        // place the copied overlay in the same relative location.

                        let extendsPastHorizontalBounds = missingOverlays[ i ].x < 0 || missingOverlays[ i ].x > ( packagePrimaryDisplaySize.width - missingOverlays[ i ].windowWidth );
                        let extendsPastVerticalBounds = missingOverlays[ i ].y < 0 || missingOverlays[ i ].y > ( packagePrimaryDisplaySize.height - missingOverlays[ i ].windowHeight );

                        if ( extendsPastHorizontalBounds || extendsPastVerticalBounds ) {
                            // Center the new overlay.
                            missingOverlays[ i ].windowWidth = missingOverlays[ i ].windowWidth * sizeRatio.widthRatio;
                            missingOverlays[ i ].windowHeight = missingOverlays[ i ].windowHeight * sizeRatio.heightRatio;
                            missingOverlays[ i ].x = ( myDisplaySize.width / 2 ) - ( missingOverlays[ i ].x / 2 );
                            missingOverlays[ i ].y = ( myDisplaySize.height / 2 ) - ( missingOverlays[ i ].y / 2 );

                        } else {
                            // Position relative to source display.
                            missingOverlays[ i ].x = missingOverlays[ i ].x * sizeRatio.widthRatio;
                            missingOverlays[ i ].y = missingOverlays[ i ].y * sizeRatio.heightRatio;
                            missingOverlays[ i ].windowWidth = missingOverlays[ i ].windowWidth * sizeRatio.widthRatio;
                            missingOverlays[ i ].windowHeight = missingOverlays[ i ].windowHeight * sizeRatio.heightRatio;

                        }
                    }
                    
                    event.sender.send( 'pkg:missing-overlay', missingOverlays[ i ] );

                } else {
                    // We're done, let's continue the normal process.
                    finalize();
                    callback( overlayMap );

                }
            
            };
        
        installOverlay( 0 );
    }









    
}

module.exports = OverlayDatabaseStore;
