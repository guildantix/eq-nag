const { app, BrowserWindow, ipcMain } = require( "electron" );
const Store = require( './store' );
const ForwardRef = require( '../forward-ref' );
const _ = require( 'lodash' );
const customAlphabet = require( 'nanoid' ).customAlphabet;
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const idLen = 16;
const nanoid = customAlphabet( alphabet, 16 );
const CharacterModel = require( "./models/character" );


class CharacterDatabaseStore extends Store {

    /** The data store for this object. */
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
        // if ( !this.#data.version || this.#data.version < 3 ) {
        //     this.#data?.characters?.forEach( f => {
        //         // Set properties.
        //     } );
        //     this.#data.version = 3;
        //     this.storeDataFile( this.#data );
        // }
        
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
        return this.#data.character;
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
            event.sender.webContents.send( 'character:create', characterId );
            sendTick();
        } );

        ipcMain.on( 'character:get', ( event, characterId ) => {
            if ( characterId != null && characterId.length > 0 ) {
                event.sender.webContents.send( 'character:get', this.find( characterId ) );
            } else {
                event.sender.webContents.send( 'character:get', this.getAll() );
            }
        } );

        ipcMain.on( 'character:update', ( event, character ) => {
            event.sender.webContents.send( 'character:update', this.update( character ) );
            sendTick();
        } );

        ipcMain.on( 'character:delete', ( event, characterId ) => {
            let deleted = this.remove( characterId );
            event.sender.webContents.send( 'character:delete', deleted );
            sendTick();
        } );

    }

}

module.exports = CharacterDatabaseStore;
