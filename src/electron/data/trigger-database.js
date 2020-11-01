const { app, BrowserWindow, ipcMain } = require( "electron" );
const Store = require( './store' );
const _ = require( 'lodash' );
const { Trigger, TriggerAction, ActionTypes } = require( './models/trigger' );
const ForwardRef = require( '../forward-ref' );
const customAlphabet = require( 'nanoid' ).customAlphabet;
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const idLen = 16;
const nanoid = customAlphabet( alphabet, 16 );
const ArrayUtilities = require( '../utilities/arrays' );

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
        this.processPredefinedTriggers();

        if ( !this.#data.version || this.#data.version < 3 ) {
            this.#data?.triggers?.forEach( f => {
                f.capturePhrases?.forEach( p => p.phraseId = p.phraseId == null ? nanoid() : p.phraseId );
            } );
            this.#data.version = 3;
            this.storeDataFile( this.#data );
        }
        if ( this.#data.version < 4 ) {
            this.#data?.triggers?.forEach( f => {
                f.actions?.forEach( p => p.phrases = p.phraseId ? [ p.phraseId ] : [] );
            } );
            this.#data.version = 4;
            this.storeDataFile( this.#data );
        }
        if ( this.#data.version < 5 ) {
            this.#data?.triggers?.forEach( trigger => {
                trigger.conditions = trigger.conditions ? trigger.conditions : [];
            } );
            this.#data.version = 5;
            this.storeDataFile( this.#data );
        }
        if ( this.#data.version < 6 ) {
            // Added spell level to dot timer triggers.
            this.#data?.triggers?.forEach( trigger => {
                trigger.spellLevel = 0;
            } );
            this.#data.version = 6;
            this.storeDataFile( this.#data );
        }
        if ( this.#data.version < 7 ) {
            this.#data?.triggers?.forEach( trigger => {
                trigger.actions?.forEach( action => action.restartOnDuplicate = action.actionType === ActionTypes.DotTimer );
            } );
            this.#data.version = 7;
            this.storeDataFile( this.#data );
        }
        if ( this.#data.version < 8 ) {
            this.#data?.triggers?.forEach( trigger => {
                trigger.predefined = false;
            } );
            this.#data.version = 8;
            this.storeDataFile( this.#data );
        }
        if ( this.#data.version < 9 ) {
            this.#data?.triggers?.forEach( trigger => {
                trigger.onlyExecuteInDev = false;
            } );
            this.#data.version = 9;
            this.storeDataFile( this.#data );
        }
        if ( this.#data.version < 10 ) {
            this.#data?.triggers?.forEach( trigger => {
                trigger.actions?.forEach( action => action.onlyExecuteInDev = false );
            } );
            this.#data.version = 10;
            this.storeDataFile( this.#data );
        }
    }










    /**
     * Loads predefined triggers and replaces any changes made by the user with the predfined value.
     */
    processPredefinedTriggers() {
        let captureCastingTrigger = { "triggerId": "trGkfio6z2xs6hAh", "name": "Capture spell casting", "capturePhrases": [ { "useRegEx": true, "requirePreviousPhrase": false, "duration": null, "phrase": "^You begin casting (.*)\\.", "phraseId": "v7GDFrDCcFwhTAOP" }, { "useRegEx": true, "requirePreviousPhrase": false, "duration": null, "phraseId": "SmZAE0oEzuhq1cqh", "phrase": "^Your ${SpellBeingCast} spell is interrupted\\." }, { "useRegEx": true, "requirePreviousPhrase": false, "duration": null, "phraseId": "iNy1LoUUFcXnaHws", "phrase": "^(.*) resisted your (${SpellBeingCast})" }, { "useRegEx": true, "requirePreviousPhrase": false, "duration": null, "phraseId": "CC31CtgDiqwi8xV4", "phrase": "^Your (${SpellBeingCast}) spell did not take hold\\. \\(Blocked by (.*)\\.\\)" } ], "comments": "This trigger will capture the spell casting of the caster and store the spell being cast into a variable for use with other triggers.", "actions": [ { "actionType": 0, "actionId": "gUj3jfz2M3PDd0o7", "overlayId": "gx4ySJU9Cj35xR1n", "displayText": "Storing {1} into SpellBeingCast.", "duration": 15, "phraseId": "v7GDFrDCcFwhTAOP", "phrases": [ "v7GDFrDCcFwhTAOP" ], "restartOnDuplicate": false, "onlyExecuteInDev": true }, { "actionType": 5, "variableName": "SpellBeingCast", "actionId": "xygXKRSFpi3vYQ4D", "phraseId": "v7GDFrDCcFwhTAOP", "phrases": [ "v7GDFrDCcFwhTAOP" ], "restartOnDuplicate": false, "onlyExecuteInDev": false }, { "actionType": 7, "phraseId": "SmZAE0oEzuhq1cqh", "overlayId": "gx4ySJU9Cj35xR1n", "duration": 15, "displayText": "Spell ${SpellBeingCast} was interrupted.", "actionId": "2779yyKWjlmJvIhn", "phrases": [ "SmZAE0oEzuhq1cqh", "iNy1LoUUFcXnaHws", "CC31CtgDiqwi8xV4" ], "variableName": "SpellBeingCast", "restartOnDuplicate": false, "onlyExecuteInDev": false }, { "phrases": [ "CC31CtgDiqwi8xV4" ], "actionType": 0, "overlayId": "gx4ySJU9Cj35xR1n", "displayText": "{1} failed, blocked by {2}.", "duration": 15, "actionId": "ODKkRbroUUtHPf6n", "restartOnDuplicate": false, "onlyExecuteInDev": true } ], "captureMethod": "Any match", "conditions": [], "spellLevel": 0, "predefined": true, "onlyExecuteInDev": false };

        let castingIndex = ArrayUtilities.findIndex( this.#data?.triggers, f => f.triggerId === captureCastingTrigger.triggerId );
        if ( castingIndex > -1 ) {
            this.#data.triggers[ castingIndex ] = captureCastingTrigger;
        } else {
            this.#data.triggers.push( captureCastingTrigger );
            this.storeDataFile( this.#data );
        }

        let displaySpellBeingCast = { "triggerId": "hzOXzyXsZANWGcJq", "name": "Display Variable SpellBeingCast", "capturePhrases": [ { "useRegEx": true, "requirePreviousPhrase": false, "duration": null, "phraseId": "bi8mXZAgB7zGnSAc", "phrase": "^Eryndhel requests an update." } ], "comments": "", "actions": [ { "phrases": [ "bi8mXZAgB7zGnSAc" ], "actionType": 0, "overlayId": "gx4ySJU9Cj35xR1n", "displayText": "SpellBeingCast == ${SpellBeingCast}", "duration": 15, "actionId": "n95VfakBr8TbCKnE", "restartOnDuplicate": false } ], "captureMethod": "Any match", "conditions": [ { "conditionId": "It3bUfInYVi4aGYB", "conditionType": 1, "variableName": "SpellBeingCast", "operatorType": 2 } ], "spellLevel": 0, "predefined": true, "onlyExecuteInDev": true };
        let displaySpellIndex = ArrayUtilities.findIndex( this.#data?.triggers, f => f.triggerId === displaySpellBeingCast.triggerId );
        if ( displaySpellIndex > -1 ) {
            this.#data.triggers[ displaySpellIndex ] = displaySpellBeingCast;
        } else {
            this.#data.triggers.push( displaySpellBeingCast );
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

        ipcMain.on( 'trigger:get:stored-variables', ( event, data ) => {
            event.sender.webContents.send( 'trigger:get:stored-variables', this.getVariableNames() );
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
        trigger.conditions?.forEach(f => f.conditionId = f.conditionId ? f.conditionId : nanoid() );

        // Add it to the store.
        this.#data.triggers.push( trigger );

        // Save changes to the data.
        this.processPredefinedTriggers();
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
            this.processPredefinedTriggers();
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
        trigger.conditions?.forEach( f => f.conditionId = f.conditionId ? f.conditionId : nanoid() );

        // Find the index of the trigger by Id.
        let i = _.findIndex( this.#data.triggers, ( e ) => e.triggerId === trigger.triggerId );

        // If the index is valid, then update the found trigger.
        if ( i > -1 && i < this.#data?.triggers?.length ) {
            this.#data.triggers[ i ] = trigger;

            // Save changes to the data.
            this.processPredefinedTriggers();
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
     * Returns all variable names.
     */
    getVariableNames() {
        let variables = [];
        this.#data?.triggers?.forEach( trigger => {
            trigger.actions?.forEach( action => {
                if ( action.actionType === ActionTypes.StoreVariable ) {
                    variables.push( action.variableName );
                }
            } );
        } );
        return variables;
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
            this.processPredefinedTriggers();
            this.storeDataFile( this.#data );
        }
    }
}

module.exports = TriggerDatabaseStore;
