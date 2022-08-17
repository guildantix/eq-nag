const { PlayerCharacter, PlayerPet } = require( "./models/common" );
const Store = require( './store' );
const _ = require( 'lodash' );
const StringUtilities = require( "../utilities/string" );

/*

Only players can do the following:

    Chat
    Loot
    Assassinate
    Twincast heals
    Double bow shot
    Headshot
    Slay undead
    Roll die
    Roll using advanced loot
    Appear in /who list
    Targeted (Player) message when click targeting
    joined the raid. -- Mercs have this message
    has joined the group. -- Mercs have this message
    has left the raid. -- Mercs too
    has left the group. -- Mercs too
    is now the leader of your raid.
    
As important: only players can kill NPCs.
    
    Singlemobnamewithcapitol has been slain by Verifiedplayername!

*/

class VerifiedPlayersStore extends Store {

    /** The data store for this object.
     * @type {{players: Record<string, boolean>, pets: Record<string, boolean>, playerClasses: Record<string, string>, petOwner: Record<string, string>}}
     * */
    #data;

    constructor() {
        super( {
            configName: "players-database",
            defaults: { players: {}, pets: {}, playerClasses: {}, petOwner: {}, version: 1 },
        } );

        this.#data = this.parseDataFile();

        if ( !this.#data.version || this.#data.version < 1 ) {
            
        }
    }









    
    /**
     * Adds the given entity to the player's list, and if provided, sets their class.
     * 
     * @param {string} playerName The player character's name.
     * @param {string?} playerClass The player character's class.
     */
    addPlayer( playerName, playerClass ) {
        this.#data.players[ playerName ] = true;
        this.#data.playerClasses[ playerName ] = playerClass;
    }









    
    /**
     * Assigns the specified player's class.
     * 
     * @param {string} playerName The player character's name.
     * @param {string} playerClass The player character's class.
     */
    assignPlayerClass( playerName, playerClass ) {
        this.#data.playerClasses[ playerName ] = playerClass;
    }









    
    /**
     * Keeps a record that the given entity name is not a player.
     * 
     * @param {string} playerName The name of the entity.
     */
    removePlayer( playerName ) {
        this.#data.players[ playerName ] = false;
    }









    
    /**
     * Returns true if the given name is a verified player, false if it is 
     * verifiably not a player, or null if unknown.
     * 
     * @param {string} playerName The name of the entity
     */
    isPlayer( playerName ) {
        return this.#data.players[ playerName ] === true ? true : this.#data.players[ playerName ] === false ? false : null;
    }









    
    /**
     * Adds the given entity as a pet, and if an owner is provided is assigned 
     * to the given owner entity.
     * 
     * @param {string} petName The name of the pet entity.
     * @param {string?} ownerName The name of the owner entity.
     */
    addPet( petName, ownerName ) {
        this.#data.pets[ petName ] = true;
        if ( !StringUtilities.isNullOrWhitespace( ownerName ) ) {
            this.#data.petOwner[ petName ] = ownerName;
        }
    }









    
    /**
     * Assigns the given pet name to the given owner entity.
     * 
     * @remarks The owner entity does not have to be a player.
     * 
     * @param {string} petName The name of the pet entity.
     * @param {string} ownerName The name of the owner entity.
     */
    assignPetOwner( petName, ownerName ) {
        this.#data.petOwner[ petName ] = ownerName;
    }









    
    /**
     * Keeps a record that the given entity name is not a pet.
     * 
     * @param {string} petName The name of the entity.
     */
    removePet( petName ) {
        this.#data.pets[ petName ] = false;
    }









    
    /**
     * Returns true if the given name is a verified pet, false if it is 
     * verifiably not a pet, or null if unknown.
     * 
     * @param {string} petName The name of the entity
     */
    isPet( petName ) {
        return this.#data.pets[ petName ] === true ? true : this.#data.pets[ petName ] === false ? false : null;
    }









    
    /**
     * Returns the name of the owner of the given pet name.
     * 
     * @param {string} petName The name of the pet.
     */
    petOwner( petName ) {
        return this.#data.petOwner[ petName ];
    }










}

module.exports = VerifiedPlayersStore;