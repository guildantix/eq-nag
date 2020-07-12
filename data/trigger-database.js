const { app, BrowserWindow, ipcMain } = require( "electron" );
const Store = require( './store' );
const _ = require( 'lodash' );
const Trigger = require( './models/trigger' );
const generate = require('nanoid').generate;
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const idLen = 16;

class TriggerDatabaseStore extends Store {

    /** The data store for this object. */
    #data;

    get count() {
        return this.#data?.entries?.length;
    }

    constructor() {
        super( {
            configName: "trigger-database",
            defaults: { triggers: [] },
        } );

        this.#data = this.parseDataFile();
    }










    /**
     * Attaches store events to ipc main and dispatches react events to the main window.
     * 
     * @param {BrowserWindow} mainWindow The main window of the application.
     * @param {TriggerDatabaseStore} _store The store object.
     * @param {function} sendTick The send tick method.
     */
    attachIpcEvents( mainWindow, sendTick ) {
        ipcMain.on( 'trigger:add', ( event, data ) => {
            this.add( data );
            sendTick();
        } );

        ipcMain.on( 'trigger:remove', ( event, data ) => {
            this.remove( data );
            sendTick();
        } );

        ipcMain.on( 'trigger:find', ( event, triggerId ) => {
            event.sender.webContents.send( 'trigger:find', this.find( triggerId ) );
        } );

        ipcMain.on( 'trigger:get', ( event ) => {
            event.sender.webContents.send( 'trigger:find', this.getAll() );
        } );
    }










    /**
     * Adds the given trigger to the store.
     * 
     * @param {Trigger} trigger The trigger to add to the store.
     */
    add( trigger ) {
        // Init the triggers array.
        this.#data.triggers = this.#data.triggers ? this.#data.triggers : [];

        // Generate a new id for the trigger.
        trigger.triggerId = generate( alphabet, idLen );

        // Add it to the store.
        this.#data.triggers.push( trigger );

        // Save changes to the data.
        this.storeDataFile( this.#data );
    }









    
    /**
     * Removes the given trigger.
     * 
     * @param {Trigger} trigger The trigger to remove.
     */
    remove( trigger ) {
        if ( this.#data?.triggers?.length > 0 ) {

            // Find the index of the trigger.
            let i = _.findIndex( this.#data.triggers, ( e ) => e.triggerId === trigger.triggerId );

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
            let removed = this.#data.entries.splice( i, 1 );

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
