const { app, BrowserWindow, ipcMain } = require( "electron" );
const Store = require( './store' );
const _ = require( 'lodash' );
const { Trigger, TriggerFolder, TriggerAction, ActionTypes } = require( './models/trigger' );
const ForwardRef = require( '../forward-ref' );
const customAlphabet = require( 'nanoid' ).customAlphabet;
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const idLen = 16;
const nanoid = customAlphabet( alphabet, 16 );
const ArrayUtilities = require( '../utilities/arrays' );
const { FormControlDirective } = require( "@angular/forms" );
const StringUtilities = require( "../utilities/string" );
const Fuse = require( 'fuse.js' );

/** @type {Fuse.fuseOptions_tags} */
const fuseOptions_tags = {
    // isCaseSensitive: false,
    includeScore: true,
    // shouldSort: true,
    // includeMatches: false,
    // findAllMatches: false,
    // minMatchCharLength: 1,
    // location: 0,
    // threshold: 0.6,
    // distance: 100,
    // useExtendedSearch: false,
    // ignoreLocation: false,
    // ignoreFieldNorm: false,
    keys: [
        { name: 'name', weight: 1.0 },
        { name: 'comments', weight: 0.9 },
        { name: 'allakhazamUrl', weight: 0.9 },
        { name: 'capturePhrases.phrase', weight: 0.9 },
        // We provide low weights on the id fields to enforce an exact match.
        { name: 'triggerId', weight: 0.01 },
        { name: 'folderId', weight: 0.01 },
    ]
};

class TriggerDatabaseStore extends Store {

    /** 
     * The data store for this object.
     * @type {{triggers: Trigger[], folders: TriggerFolder[]}}
     * */
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
        if ( this.#data.version < 11 ) {
            this.#data?.triggers?.forEach( trigger => {
                trigger.actions?.forEach( action => action.overrideTimerColor = null );
            } );
            this.#data.version = 11;
            this.storeDataFile( this.#data );
        }
        if ( this.#data.version < 14 ) {
            // 12-13 were iterations on this update.
            this.#data?.triggers?.forEach( trigger => {
                trigger.actions?.forEach( action => {
                    action.ifEndingSoon = false;
                    action.endingDuration = null;
                    action.endingSoonChangeColor = false;
                    action.endingSoonColor = null;
                    action.endingSoonBackgroundColor = null;
                } );
            } );
            this.#data.version = 14;
            this.storeDataFile( this.#data );
        }
        if ( this.#data.version < 15 ) {
            this.#data?.triggers?.forEach( trigger => {
                trigger.actions?.forEach( action => {

                    action.endingSoonDisplayText = false;
                    action.endingSoonTextOverlayId = null;
                    action.endingSoonText = null;
                    action.endingSoonTextDuration = null;

                    action.endingSoonSpeak = false;
                    action.endingSoonSpeakPhrase = null;
                    
                    action.remainAfterEnded = false;
                    action.remainDuration = null;

                    action.endedDisplayText = false;
                    action.endedTextOverlayId = null;
                    action.endedText = null;
                    action.endedTextDuration = null;
                    
                    action.endedSpeak = false;
                    action.endedSpeakPhrase = null;
                } );
            } );
            this.#data.version = 15;
            this.storeDataFile( this.#data );
        }
        if ( this.#data.version < 16 ) {
            // 12-13 were iterations on this update.
            this.#data?.triggers?.forEach( trigger => {
                trigger.actions?.forEach( action => {
                    action.endedChangeColor = false;
                    action.endedColor = null;
                    action.endedBackgroundColor = null;
                } );
            } );
            this.#data.version = 16;
            this.storeDataFile( this.#data );
        }
        if ( this.#data.version < 17 ) {
            this.#data?.triggers?.forEach( trigger => {
                trigger.actions?.forEach( action => {
                    action.timerIcon = null;
                } );
            } );
            this.#data.version = 17;
            this.storeDataFile( this.#data );
        }
        if ( this.#data.version < 18 ) {
            this.#data?.triggers?.forEach( trigger => {
                trigger.actions?.forEach( action => {
                    action.timerIconDef = null;
                } );
            } );
            this.#data.version = 18;
            this.storeDataFile( this.#data );
        }
        if ( this.#data.version < 19 ) {
            this.#data?.triggers?.forEach( trigger => {
                trigger.actions?.forEach( action => {
                    action.showRemainingDuration = false;
                } );
            } );
            this.#data.version = 19;
            this.storeDataFile( this.#data );
        }
        if ( this.#data.version < 20 ) {
            this.#data?.triggers?.forEach( trigger => {
                trigger.actions?.forEach( action => {
                    action.excludeTargets = [];
                } );
            } );
            this.#data.version = 20;
            this.storeDataFile( this.#data );
        }
        if ( this.#data.version < 21 ) {
            this.#data?.triggers?.forEach( trigger => {
                trigger.allakhazamUrl = null;
            } );
            this.#data.version = 21;
            this.storeDataFile( this.#data );
        }
        if ( this.#data.version < 22 ) {
            this.#data?.triggers?.forEach( trigger => {
                trigger.actions?.forEach( action => {
                    action.endEarlyPhrases = [];
                } );
            } );
            this.#data.version = 22;
            this.storeDataFile( this.#data );
        }
        if ( this.#data.version < 23 ) {
            this.#data?.triggers?.forEach( trigger => {
                delete trigger.spellLevel;
                trigger.classLevels = [];
            } );
            this.#data.version = 23;
            this.storeDataFile( this.#data );
        }
        if ( this.#data.version < 24 ) {
            this.#data.folders = [];
            this.#data.version = 24;
            this.storeDataFile( this.#data );
        }
        if ( this.#data.version < 35 ) {
            this.#data?.triggers?.forEach( trigger => {
                trigger.actions?.forEach( action => {
                    action.name = null;
                } );
            } );
            this.#data.version = 35;
            this.storeDataFile( this.#data );
        }
    }










    /**
     * Loads predefined triggers and replaces any changes made by the user with the predfined value.
     */
    processPredefinedTriggers() {
        let captureCastingTrigger = { "triggerId": "trGkfio6z2xs6hAh", "name": "Capture spell casting", "capturePhrases": [ { "useRegEx": true, "requirePreviousPhrase": false, "duration": null, "phrase": "^You begin casting (.*)\\.", "phraseId": "v7GDFrDCcFwhTAOP" }, { "useRegEx": true, "requirePreviousPhrase": false, "duration": null, "phraseId": "SmZAE0oEzuhq1cqh", "phrase": "^Your ${SpellBeingCast} spell is interrupted\\." }, { "useRegEx": true, "requirePreviousPhrase": false, "duration": null, "phraseId": "iNy1LoUUFcXnaHws", "phrase": "^(.*) resisted your ${SpellBeingCast}" }, { "useRegEx": true, "requirePreviousPhrase": false, "duration": null, "phraseId": "CC31CtgDiqwi8xV4", "phrase": "^Your ${SpellBeingCast} spell did not take hold\\. \\(Blocked by (.*)\\.\\)" } ], "comments": "This trigger will capture the spell casting of the caster and store the spell being cast into a variable for use with other triggers.", "actions": [ { "actionType": 0, "actionId": "gUj3jfz2M3PDd0o7", "overlayId": "gx4ySJU9Cj35xR1n", "displayText": "Storing {1} into SpellBeingCast.", "duration": 15, "phraseId": "v7GDFrDCcFwhTAOP", "phrases": [ "v7GDFrDCcFwhTAOP" ], "restartOnDuplicate": false, "onlyExecuteInDev": true }, { "actionType": 5, "variableName": "SpellBeingCast", "actionId": "xygXKRSFpi3vYQ4D", "phraseId": "v7GDFrDCcFwhTAOP", "phrases": [ "v7GDFrDCcFwhTAOP" ], "restartOnDuplicate": false, "onlyExecuteInDev": false }, { "phrases": [ "SmZAE0oEzuhq1cqh", "CC31CtgDiqwi8xV4", "iNy1LoUUFcXnaHws" ], "actionType": 0, "overlayId": "gx4ySJU9Cj35xR1n", "displayText": "${SpellBeingCast} failed.", "duration": 15, "actionId": "ODKkRbroUUtHPf6n", "restartOnDuplicate": false, "onlyExecuteInDev": true }, { "actionType": 7, "phraseId": "SmZAE0oEzuhq1cqh", "overlayId": "gx4ySJU9Cj35xR1n", "duration": 15, "displayText": "Spell ${SpellBeingCast} was interrupted.", "actionId": "2779yyKWjlmJvIhn", "phrases": [ "SmZAE0oEzuhq1cqh", "iNy1LoUUFcXnaHws", "CC31CtgDiqwi8xV4" ], "variableName": "SpellBeingCast", "restartOnDuplicate": false, "onlyExecuteInDev": false } ], "captureMethod": "Any match", "conditions": [], "classLevels": [], "predefined": true, "onlyExecuteInDev": false };

        let castingIndex = ArrayUtilities.findIndex( this.#data?.triggers, f => f.triggerId === captureCastingTrigger.triggerId );
        if ( castingIndex > -1 ) {
            this.#data.triggers[ castingIndex ] = captureCastingTrigger;
        } else {
            this.#data.triggers.push( captureCastingTrigger );
            this.storeDataFile( this.#data );
        }

        let displaySpellBeingCast = { "triggerId": "hzOXzyXsZANWGcJq", "name": "Display Variable SpellBeingCast", "capturePhrases": [ { "useRegEx": true, "requirePreviousPhrase": false, "duration": null, "phraseId": "bi8mXZAgB7zGnSAc", "phrase": "^Eryndhel requests an update." } ], "comments": "", "actions": [ { "phrases": [ "bi8mXZAgB7zGnSAc" ], "actionType": 0, "overlayId": "gx4ySJU9Cj35xR1n", "displayText": "SpellBeingCast == ${SpellBeingCast}", "duration": 15, "actionId": "n95VfakBr8TbCKnE", "restartOnDuplicate": false } ], "captureMethod": "Any match", "conditions": [ { "conditionId": "It3bUfInYVi4aGYB", "conditionType": 1, "variableName": "SpellBeingCast", "operatorType": 2 } ], "classLevels": [], "predefined": true, "onlyExecuteInDev": true };
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

        ipcMain.on( 'trigger:update:batch', ( event, triggers ) => {
            let failed = this.updateAll( triggers );
            event.sender.webContents.send( 'trigger:update:batch', failed );
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
        
        // Folder methods.
        ipcMain.on( 'folders:get', ( event, args ) => {
            event.sender.webContents.send( 'folders:get', this.getFolders() );
        } );

        ipcMain.on( 'folders:update', ( event, folders ) => {
            event.sender.webContents.send( 'folders:update', this.updateFolders( folders ) );
        } );

        ipcMain.on( 'trigger:search', ( event, term ) => {
            event.sender.webContents.send( 'trigger:search', this.searchTriggers( term ) );
        } );

    }

    /**
     * Returns a list of all folders.
     * 
     * @returns {TriggerFolder[]}
     */
    getFolders() {
        return this.#data?.folders?.length > 0 ? this.#data.folders : [];
    }

    /**
     * Updates the store of trigger folders.
     * 
     * @param {TriggerFolder[]} folders The updated folders hierarchy.
     */
    updateFolders( folders ) {
        this.applyFolderIds( folders );
        this.#data.folders = folders;

        // Save changes to the data.
        this.processPredefinedTriggers();
        this.storeDataFile( this.#data );
        
        return this.#data.folders;
    }

    /**
     * Applies folder ids to all folders in the given heirarchy.
     * 
     * @param {TriggerFolder[]} folders The folder hierarchy.
     */
    applyFolderIds( folders ) {
        for ( let i = 0; i < folders?.length; i++ ) {
            if ( folders[ i ].children?.length > 0 ) {
                this.applyFolderIds( folders[ i ].children );
            }

            folders[ i ].folderId = folders[ i ].folderId == null ? nanoid() : folders[ i ].folderId;
        }
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










    // /**
    //  * Adds the given folder to the store.
    //  * 
    //  * @returns {string} Returns the generated folder id.
    //  * 
    //  * @param {TriggerFolder} folder The folder to add to the store.
    //  * @param {string} parentId The folderId of the parent folder.
    //  */
    // addFolder( folder, parentId ) {
    //     // Init the folders array.
    //     this.#data.folders = this.#data.folders ? this.#data.folders : [];

    //     // Generate a new id for the folder.
    //     folder.folderId = nanoid();

    //     if ( parentId == null ) {
    //         // Add it to the store.
    //         this.#data.folders.push( folder );
    //     } else {
    //         // Find the index of the parent folder.
    //         let i = _.findIndex( this.#data.folders, ( e ) => e.folderId === parentId );
    //         this.#data.folders[i]
    //     }

    //     // Save changes to the data.
    //     this.processPredefinedTriggers();
    //     this.storeDataFile( this.#data );

    //     return folder.folderId;
    // }









    
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









    
    // /**
    //  * Removes the given folder.
    //  * 
    //  * @param {TriggerFolder} folder The folder to remove.
    //  */
    // removeFolder( folder ) {
    //     if ( this.#data?.folders?.length > 0 ) {
    //         let folderId = folder.folderId;

    //         // Find the index of the trigger.
    //         let i = _.findIndex( this.#data.folders, ( e ) => e.folderId === folder.folderId );

    //         // Remove the folder by index.
    //         let removed = this.removeFolderIndex( i );

    //         if ( removed ) {
    //             this.#data.triggers?.forEach( trigger => {
    //                 if ( trigger.folderId === folderId ) {
    //                     trigger.folderId = null;
    //                 }
    //             } );
    
    //             // Save changes to the data.
    //             this.processPredefinedTriggers();
    //             this.storeDataFile( this.#data );
    //         }

    //         return removed;
    //     }
    // }









    
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









    
    // /**
    //  * Removes the specified folder.
    //  * 
    //  * @param {string} folderId The folder to remove.
    //  */
    // remove( folderId ) {
    //     if ( this.#data?.folders?.length > 0 ) {

    //         // Find the index of the folder.
    //         let i = _.findIndex( this.#data.folders, ( e ) => e.folderId === folderId );

    //         // Remove the trigger by index.
    //         let removed = this.removeFolderIndex( i );

    //         if ( removed ) {
    //             this.#data.triggers?.forEach( trigger => {
    //                 if ( trigger.folderId === folderId ) {
    //                     trigger.folderId = null;
    //                 }
    //             } );

    //             // Save changes to the data.
    //             this.processPredefinedTriggers();
    //             this.storeDataFile( this.#data );
    //         }

    //         return removed;
    //     }
    // }
    








    
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
    








    
    // /**
    //  * Removes the folder at the specified index.
    //  * 
    //  * @param {number} i The index of the folder to remove.
    //  */
    // removeFolderIndex( i ) {
    //     if ( this.#data?.folders?.length > i ) {

    //         // Remove the folder by index.
    //         let removed = this.#data.folders.splice( i, 1 );

    //         // Save the changes to the data.
    //         this.processPredefinedTriggers();
    //         this.storeDataFile( this.#data );

    //         // Return true if at least 1 item was removed.
    //         return removed?.length > 0;
    //     }
    // }
    








    
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
    








    
    // /**
    //  * Returns the folder with the given id.
    //  * 
    //  * @param {string} folderId The folder id of the desired folder.
    //  */
    // findFolder( folderId ) {

    //     // Find the index of the folder by Id.
    //     let i = _.findIndex( this.#data.folders, ( e ) => e.folderId === folderId );

    //     // If the index is valid, then return the found trigger.
    //     if ( i > -1 && i < this.#data?.folders?.length ) {
    //         return this.#data.folders[ i ];
    //     }
    // }










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
     * Updates the list of given triggers.
     * 
     * @returns {TriggerModel[]} Returns a list of triggers that failed to update.
     * 
     * @param {TriggerModel[]} triggers The triggers to update.
     */
    updateAll( triggers ) {

        /** @type {TriggerModel[]} */
        let failed = [];

        triggers.forEach( trigger => {
            if ( StringUtilities.isNullOrWhitespace( trigger.triggerId ) ) {
                let newId = this.add( trigger );
                
                if ( StringUtilities.isNullOrWhitespace( newId ) ) {
                    failed.push( trigger );
                } else {
                    trigger.triggerId = newId;
                }

            } else {
                if ( !this.update( trigger ) ) {
                    failed.push( trigger );
                }
            }
        } );
        
        return failed;
    }










    // /**
    //  * Updates the given folder in the store.
    //  * 
    //  * @returns {boolean} Returns true if the folder was updated.
    //  * 
    //  * @param {TriggerFolder} folder The folder to update.
    //  */
    // update( folder ) {

    //     // Find the index of the folder by Id.
    //     let i = _.findIndex( this.#data.folders, ( e ) => e.folderId === folder.folderId );

    //     // If the index is valid, then update the found folder.
    //     if ( i > -1 && i < this.#data?.folders?.length ) {
    //         this.#data.folders[ i ] = folder;

    //         // Save changes to the data.
    //         this.processPredefinedTriggers();
    //         this.storeDataFile( this.#data );

    //         return true;
    //     } else {
    //         return false;
    //     }
        
    // }










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









    
    // /**
    //  * Returns all folders.
    //  */
    // getFolders() {
    //     return this.#data.folders;
    // }










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










    /**
     * Searches through all triggers trying to find any match.  This is a fuzzy 
     * search and the results are given in order of best match on top.
     * 
     * @param {string} term The search term to query.
     */
    searchTriggers( term ) {
        let fuse = new Fuse( this.#data.triggers, fuseOptions_tags );

        let results = fuse.search( term );


        if ( results && results.length > 0 ) {

            let scoreLimit = 0.85;
            let scores = _.map( results, item => item.score );
            let minScore = _.min( scores );

            if ( minScore < 0.25 ) {
                scoreLimit = 0.25;
            } else if ( minScore < 0.50 ) {
                scoreLimit = 0.50;
            }

            return _.map( results, fuseResult => {
                let item = fuseResult.item;
                item.score = fuseResult.score;
                item.refIndex = fuseResult.refIndex;
                return item;
            } ).filter( item => item.score <= scoreLimit );

        } else {
            return [];
        }
    }

    // /**
    //  * Adds the given folder to the specified parent folder.
    //  * 
    //  * @param {TriggerFolder[]} folders The list of available folders.
    //  * @param {string} parentId The id of the parent folder.
    //  * @param {TriggerFolder} folder The child folder to add to the parent's children.
    //  */
    // addChildFolder( folders, parentId, folder ) {
    //     for ( let i = 0; i < folders?.length; i++ ) {
    //         if ( folders[ i ].folderId === parentId ) {
    //             folders[ i ].children = folders[ i ].children?.length > 0 ? folders[ i ].children : [];
    //             folders[ i ].children.push( child );
    //         }
    //     }
    // }
}

module.exports = TriggerDatabaseStore;
