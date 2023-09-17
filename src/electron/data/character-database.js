const { app, BrowserWindow, ipcMain } = require( "electron" );
const Store = require( './store' );
const ForwardRef = require( '../forward-ref' );
const _ = require( 'lodash' );
const customAlphabet = require( 'nanoid' ).customAlphabet;
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const idLen = 16;
const nanoid = customAlphabet( alphabet, 16 );
const { CharacterModel, CharacterStoreModel, TriggersProfileModel } = require( "./models/character" );
const fs = require( 'fs' );
const { migrateCharacterData } = require( "./migrations/character-database-migration" );

/** @type {((character: CharacterModel) => void)[]} */
var onCreatedHandlers = [];
/** @type {((character: CharacterModel) => void)[]} */
var onRemovedHandlers = [];

class CharacterDatabaseStore extends Store {

    /** The data store for this object.
     * @type {CharacterStoreModel}
     * */
    #data;

    get count() {
        return this.#data?.characters?.length;
    }

    constructor() {
        super( {
            configName: "characters-database",
            defaults: { characters: [], version: 1 },
        } );
        
        this.#data = this.parseDataFile();

        app.on( 'ready', () => {
            migrateCharacterData( this.#data, this.configName, data => {
                this.#data = data;
                this.storeDataFile( this.#data );
            } );
        } );

    }
    
    /**
     * Adds the given character to the store.
     * 
     * @returns {string} Returns the generated character id.
     * 
     * @param {CharacterModel} character The character to add to the store.
     */
    add( character ) {

        // Init the characters array.
        this.#data.characters = this.#data.characters ? this.#data.characters : [];

        // Generate a new id for the character.
        character.characterId = nanoid();

        // Add it to the store.
        this.#data.characters.push( character );

        // Save changes to the data.
        this.storeDataFile( this.#data );

        // Execute any callback functions for the on created event.
        onCreatedHandlers.forEach( fn => fn( character ) );

        return character.characterId;
    }
    
    /**
     * Removes the specified character.
     * 
     * @param {string} characterId The character to remove.
     */
    remove( characterId ) {
        if ( this.#data?.characters?.length > 0 ) {

            // Find the index of the character.
            let i = _.findIndex( this.#data.characters, ( e ) => e.characterId === characterId );
            
            // Remove the character by index.
            return this.removeIndex( i );
        }
    }
    
    /**
     * Removes the character at the specified index.
     * 
     * @param {number} i The index of the character to remove.
     */
    removeIndex( i ) {
        if ( this.#data?.characters?.length > i ) {

            // Remove the character by index.
            let removed = this.#data.characters.splice( i, 1 );

            // Save the changes to the data.
            this.storeDataFile( this.#data );

            // Execute any callback functions for the on removed event.
            removed?.forEach( chr => onRemovedHandlers.forEach( fn => fn( chr ) ) );

            // Return true if at least 1 item was removed.
            return removed?.length > 0;
        }
    }
    
    /**
     * Returns the character with the given id.
     * 
     * @returns {CharacterModel} Returns the specified character.
     * 
     * @param {string} characterId The character id of the desired character.
     */
    find( characterId ) {

        // Find the index of the character by Id.
        let i = _.findIndex( this.#data.characters, ( e ) => e.characterId === characterId );

        // If the index is valid, then return the found character.
        if ( i > -1 && i < this.#data?.characters?.length ) {
            return this.#data.characters[ i ];
        }
    }

    findCharacterIdByLogFile( logFile ) {
        
        // Find the index of the character by Id.
        let i = _.findIndex( this.#data.characters, ( e ) => e.logFile === logFile );

        // If the index is valid, then return the found character.
        if ( i > -1 && i < this.#data?.characters?.length ) {
            return this.#data.characters[ i ].characterId;
        } else {
            return null;
        }
    }

    /**
     * Updates the given character in the store.
     * 
     * @returns {boolean} Returns true if the character was updated.
     * 
     * @param {CharacterModel} character The character to update.
     */
    update( character ) {

        // Find the index of the character by Id.
        let i = _.findIndex( this.#data.characters, ( e ) => e.characterId === character.characterId );

        // If the index is valid, then update the found character.
        if ( i > -1 && i < this.#data?.characters?.length ) {
            this.#data.characters[ i ] = character;

            // Save changes to the data.
            this.storeDataFile( this.#data );

            return true;
        } else {
            return false;
        }
        
    }
    
    /**
     * Returns all characters.
     * 
     * @returns {CharacterModel[]} Returns the list of all character.
     */
    getAll() {
        return this.#data.characters;
    }

    /**
     * Returns all trigger profiles.
     * 
     * @returns {TriggersProfileModel[]} Returns the list of all trigger profiles.
     */
    getAllTriggerProfiles() {
        return this.#data.triggerProfiles;
    }

    /**
     * Adds the given trigger id to all profiles and characters that have disable by default on.
     * 
     * @param {string} triggerId The id of the trigger.
     */
    addToDisabledByDefaultTriggers( triggerId ) {
        
        // Update all trigger profiles.
        this.#data.triggerProfiles.forEach( tp => {
            if ( tp.disableTriggersByDefault === true && tp.disabledTriggers.indexOf( triggerId ) < 0 ) {
                tp.disabledTriggers.push( triggerId );
            }
        } );

        // Update all characters.
        this.#data.characters.forEach( c => {
            let profile = this.#data.triggerProfiles.find( tp => tp.profileId === c.triggerProfileId );
            if ( ( c.disableTriggersByDefault === true || profile?.disableTriggersByDefault === true ) && c.disabledTriggers.indexOf( triggerId ) < 0 ) {
                c.disabledTriggers.push( triggerId );
            }
        } );
        
        this.storeDataFile( this.#data );
    }

    /**
     * Removes the given trigger id from all profiles and character disabled lists.
     * 
     * @param {string} triggerId The id of the trigger to remove.
     */
    removeFromDisabledTriggers( triggerId ) {
            
        // Update all trigger profiles.
        this.#data.triggerProfiles.forEach( profile => {
            let i = profile.disabledTriggers.indexOf( triggerId );
            if ( i > -1 ) {
                profile.disabledTriggers.splice( i, 1 );
            }
        } );
    
        // Update all characters.
        this.#data.characters.forEach( character => {
            let i = character.disabledTriggers.indexOf( triggerId );
            if ( i > -1 ) {
                character.disabledTriggers.splice( i, 1 );
            }
        } );
            
        this.storeDataFile( this.#data );
    }










    /**
     * Attaches store events to ipc main and dispatches react events to the main window.
     * 
     * @param {ForwardRef} mainWindowRef The main window of the application.
     * @param {function} sendTick The send tick method.
     */
    attachIpcEvents( mainWindowRef, sendTick ) {

        ipcMain.on( 'character:create', ( event, character ) => {
            let characterId = this.add( character );
            event.sender.send( 'character:create', characterId );
            sendTick();
        } );

        ipcMain.on( 'character:get', ( event, characterId ) => {
            if ( characterId != null && characterId.length > 0 ) {
                event.sender.send( 'character:get', this.find( characterId ) );
            } else {
                event.sender.send( 'character:get', this.getAll() );
            }
        } );

        ipcMain.on( 'character:update', ( event, character ) => {
            event.sender.send( 'character:update', this.update( character ) );
            sendTick();
        } );

        ipcMain.on( 'character:delete', ( event, characterId ) => {
            let deleted = this.remove( characterId );
            event.sender.send( 'character:delete', deleted );
            sendTick();
        } );

        ipcMain.handle( 'character:get:options', async ( event, logsPath ) => {
            return await this.getCharacterOptions( logsPath );
        } );

        ipcMain.on( 'character:get:triggerProfiles',
            /**
             * Returns a list of all trigger profiles.
             * 
             * @param {Electron.IpcMainEvent} event The event args.
             */
            ( event ) => {
                event.sender.send( 'character:get:triggerProfiles', this.#data.triggerProfiles );
            } );

        ipcMain.on( 'character:save:triggerProfile',
            /**
             * Saves the trigger profile.
             * 
             * @param {Electron.IpcMainEvent} event The event args.
             * @param {TriggersProfileModel} profile The trigger profile.
             */
            ( event, profile ) => {
                let triggerProfile = this.#data.triggerProfiles.find( tp => tp.profileId === profile.profileId );

                if ( triggerProfile ) {
                    triggerProfile.disabledTriggers = profile.disabledTriggers;
                    this.storeDataFile( this.#data );
                } else {
                    profile.profileId = profile.profileId ?? nanoid();
                    this.#data.triggerProfiles.push( profile );
                    this.storeDataFile( this.#data );
                }
                
                event.sender.send( 'character:save:triggerProfile', profile.profileId );
            } );
        
        ipcMain.on( 'character:delete:triggerProfile',
            /**
             * Deletes the specified trigger profile.
             * 
             * @param {Electron.IpcMainEvent} event The event args.
             * @param {string} profileId The id of the profile.
             */
            ( event, profileId ) => {
                let i = this.#data.triggerProfiles.findIndex( tp => tp.profileId === profileId );
                if ( i > -1 ) {
                    this.#data.triggerProfiles.splice( i, 1 );
                    this.storeDataFile( this.#data );
                }
                event.sender.send( 'character:delete:triggerProfile', this.#data.triggerProfiles.findIndex( tp => tp.profileId === profileId ) === -1 );
            } );

        ipcMain.on( 'character:save:combatGroupHits',
            /**
             * Updates the combat group hits.
             * 
             * @param {Electron.IpcMainEvent} event The event args.
             * @param {{characterId: string, combatGroupHits: Record<string, number[]>}} data The updated combat group hits.
             */
            ( event, data ) => {
                let character = this.find( data.characterId );
                if ( character ) {
                    character.combatGroupHits = data.combatGroupHits;
                    this.update( character );
                }
            } );

        ipcMain.on( 'character:save:combatGroupMedian',
            /**
             * Updates the combat group median values.
             * 
             * @param {Electron.IpcMainEvent} event The event args.
             * @param {{characterId: string, combatGroupHits: Record<string, number>}} data The updated combat group median values.
             */
            ( event, data ) => {
                let character = this.find( data.characterId );
                if ( character ) {
                    character.combatGroupMedian = data.combatGroupMedian;
                    this.update( character );
                }
            } );
        
        ipcMain.on( 'character:get:combatGroupHits',
            /**
             * Returns the combat group hits object to the sender.
             * 
             * @param {Electron.IpcMainEvent} event The event args.
             */
            ( event ) => {
                /** @type {Record<string, Record<string, number[]>>} */
                let combatGroupHits = {};

                this.#data.characters.forEach( c => {
                    combatGroupHits[ c.characterId ] = c.combatGroupHits;
                } );

                event.sender.send( 'character:get:combatGroupHits', combatGroupHits );
            } );
        
        ipcMain.on( 'character:get:combatGroupMedian',
            /**
             * Returns the combat group median values object to the sender.
             * 
             * @param {Electron.IpcMainEvent} event The event args.
             */
            ( event ) => {
                /** @type {Record<string, Record<string, number[]>>} */
                let combatGroupMedian = {};

                this.#data.characters.forEach( c => {
                    combatGroupMedian[ c.characterId ] = c.combatGroupMedian;
                } );

                event.sender.send( 'character:get:combatGroupMedian', combatGroupMedian );
            } );

    }

    /**
     * Returns a list of options available from the known eq log file path.
     * 
     * @param {string} logsPath The path to the logs file.
     */
    async getCharacterOptions( logsPath ) {
        let dictionary = {};

        if ( fs.existsSync( logsPath ) ) {
            var files = await fs.promises.readdir( logsPath );
            files.forEach( file => {
                let results = /eqlog_(?<Character>.*)_(?<Server>[a-z]*)\.txt$/gi.exec( file );
                if ( results != null && results?.groups?.Character != null && results?.groups?.Server != null ) {
                    if ( dictionary[ results.groups.Server ] == null ) {
                        dictionary[ results.groups.Server ] = [];
                    }
                    let option = {};

                    option.name = results.groups.Character;
                    option.server = results.groups.Server;
                    option.logFile = `${logsPath}\\${file}`;
                    option.characterId = this.findCharacterIdByLogFile( option.logFile );
                    
                    dictionary[ results.groups.Server ].push( option );
                }

            } );
        }
        
        return dictionary;
    }

    /**
     * Executes the given function, passing in the new character, when a new character is added.
     * 
     * @param {(character: CharacterModel) => void} fn The callback function.
     */
    onCharacterCreated( fn ) {
        let i = onCreatedHandlers.indexOf( fn );
        if ( i < 0 ) {
            onCreatedHandlers.push( fn );
        } else {
            onCreatedHandlers[ i ] = fn;
        }
    }

    /**
     * Executes the given function, passing in the removed character, when a character is removed.
     * 
     * @param {(character: CharacterModel) => void} fn The callback function.
     */
    onCharacterRemoved( fn ) {
        let i = onRemovedHandlers.indexOf( fn );
        if ( i < 0 ) {
            onRemovedHandlers.push( fn );
        } else {
            onRemovedHandlers[ i ] = fn;
        }
    }

}

module.exports = CharacterDatabaseStore;
