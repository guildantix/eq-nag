const { app, BrowserWindow, ipcMain } = require( "electron" );
const Store = require( './store' );
const _ = require( 'lodash' );
const { Trigger, TriggerAction, ActionTypes } = require( './models/trigger' );
const ForwardRef = require( '../forward-ref' );
const customAlphabet = require( 'nanoid' ).customAlphabet;
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const idLen = 16;
const nanoid = customAlphabet( alphabet, 16 );

class TriggerDatabaseStore extends Store {

    /** The data store for this object. */
    #data;

    get count() {
        return this.#data?.triggers?.length;
    }

    constructor() {
        super( {
            configName: "trigger-database",
            defaults: { triggers: [] },
        } );

        this.#data = this.parseDataFile();
        if ( !this.#data.version || this.#data.version < 3 ) {
            this.#data?.triggers?.forEach( f => {
                f.capturePhrases?.forEach( p => p.phraseId = p.phraseId == null ? nanoid() : p.phraseId );
            } );
            this.#data.version = 3;
            this.storeDataFile( this.#data );
        }
    }










    /**
     * Attaches store events to ipc main and dispatches react events to the main window.
     * 
     * @param {ForwardRef} mainWindowRef The main window of the application.
     * @param {TriggerDatabaseStore} _store The store object.
     * @param {function} sendTick The send tick method.
     */
    attachIpcEvents( mainWindowRef, sendTick ) {
        ipcMain.on( 'trigger:create', ( event, trigger ) => {
            let triggerId = this.add( trigger );
            event.sender.webContents.send( 'trigger:create', triggerId );
            sendTick();
        } );

        ipcMain.on( 'trigger:get', ( event, triggerId ) => {
            if ( triggerId != null && triggerId.length > 0 ) {
                event.sender.webContents.send( 'trigger:get', this.find( triggerId ) );
            } else {
                event.sender.webContents.send( 'trigger:get', this.getAll() );
            }
        } );

        ipcMain.on( 'trigger:update', ( event, trigger ) => {
            let updated = this.update( trigger );
            event.sender.webContents.send( 'trigger:update', updated );
            sendTick();
        } );

        ipcMain.on( 'trigger:delete', ( event, triggerId ) => {
            let deleted = this.remove( triggerId );
            event.sender.webContents.send( 'trigger:delete', deleted );
            sendTick();
        } );

    }










    /**
     * Adds the given trigger to the store.
     * 
     * @returns {string} Returns the generated trigger id.
     * 
     * @param {Trigger} trigger The trigger to add to the store.
     */
    add( trigger ) {
        // Init the triggers array.
        this.#data.triggers = this.#data.triggers ? this.#data.triggers : [];

        // Generate a new id for the trigger.
        trigger.triggerId = nanoid();
        trigger.actions?.forEach( f => f.actionId = f.actionId ? f.actionId : nanoid() );
        trigger.capturePhrases?.forEach( f => f.phraseId = f.phraseId ? f.phraseId : nanoid() );

        // Add it to the store.
        this.#data.triggers.push( trigger );

        // Save changes to the data.
        this.storeDataFile( this.#data );

        return trigger.triggerId;
    }









    
    /**
     * Removes the given trigger.
     * 
     * @param {Trigger} trigger The trigger to remove.
     */
    removeTrigger( trigger ) {
        if ( this.#data?.triggers?.length > 0 ) {

            // Find the index of the trigger.
            let i = _.findIndex( this.#data.triggers, ( e ) => e.triggerId === trigger.triggerId );

            // Remove the trigger by index.
            return this.removeIndex( i );

        }
    }









    
    /**
     * Removes the specified trigger.
     * 
     * @param {string} triggerId The trigger to remove.
     */
    remove( triggerId ) {
        if ( this.#data?.triggers?.length > 0 ) {

            // Find the index of the trigger.
            let i = _.findIndex( this.#data.triggers, ( e ) => e.triggerId === triggerId );

            // Remove the trigger by index.
            return this.removeIndex( i );

        }
    }
    








    
    /**
     * Removes the trigger at the specified index.
     * 
     * @param {number} i The index of the trigger to remove.
     */
    removeIndex( i ) {
        if ( this.#data?.triggers?.length > i ) {

            // Remove the trigger by index.
            let removed = this.#data.triggers.splice( i, 1 );

            // Save the changes to the data.
            this.storeDataFile( this.#data );

            // Return true if at least 1 item was removed.
            return removed?.length > 0;
        }
    }
    








    
    /**
     * Returns the trigger with the given id.
     * 
     * @param {string} triggerId The trigger id of the desired trigger.
     */
    find( triggerId ) {

        // Find the index of the trigger by Id.
        let i = _.findIndex( this.#data.triggers, ( e ) => e.triggerId === triggerId );

        // If the index is valid, then return the found trigger.
        if ( i > -1 && i < this.#data?.triggers?.length ) {
            return this.#data.triggers[ i ];
        }
    }










    /**
     * Updates the given trigger in the store.
     * 
     * @returns {boolean} Returns true if the trigger was updated.
     * 
     * @param {TriggerModel} trigger The trigger to update.
     */
    update( trigger ) {

        trigger.actions?.forEach( f => f.actionId = f.actionId ? f.actionId : nanoid() );
        trigger.capturePhrases?.forEach( f => f.phraseId = f.phraseId ? f.phraseId : nanoid() );

        // Find the index of the trigger by Id.
        let i = _.findIndex( this.#data.triggers, ( e ) => e.triggerId === trigger.triggerId );

        // If the index is valid, then update the found trigger.
        if ( i > -1 && i < this.#data?.triggers?.length ) {
            this.#data.triggers[ i ] = trigger;

            // Save changes to the data.
            this.storeDataFile( this.#data );

            return true;
        } else {
            return false;
        }
        
    }










    /**
     * Returns a list of triggers predicate returns truthy for.
     * 
     * @param {(x: Trigger) => true} fn The predicate trigger returns truthy for.
     */
    filter( fn ) {
        return _.filter( this.#data.triggers, fn );
    }









    
    /**
     * Returns all triggers.
     */
    getAll() {
        return this.#data.triggers;
    }
    








    
    /**
     * Removes the given list of triggers.
     * 
     * @param {Trigger[]} triggers The triggers to remove.
     */
    removeRange( triggers ) {
        if ( this.#data?.triggers?.length > 0 ) {

            // Remove all triggers that satisfy the condition.
            _.remove( this.#data.triggers, ( f ) => {
                // If the Id of the current trigger exists in the given list of triggers.
                _.some( triggers, ( x ) => x.triggerId == f.triggerId );
            } );

            // Save the changes to the data.
            this.storeDataFile( this.#data );
        }
    }
}

module.exports = TriggerDatabaseStore;
