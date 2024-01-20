const { PlayerCharacter, PlayerPet } = require( "./models/common" );
const Store = require( './store' );
const _ = require( 'lodash' );
const StringUtilities = require( "../utilities/string" );
const { app, BrowserWindow, ipcMain, screen } = require( "electron" );
const { CombatDb, ServerCombatModel } = require( "./models/combat-parser" );

/*

Only players can do the following:

    Chat
    Loot
    Assassinate
    Banestrike
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

class CombatDatabase extends Store {

    /** The data store for this object.
     * @type {CombatDb}
     * */
    #data;

    constructor() {
        super( {
            configName: "combat-database",
            defaults: { servers: [], encounters: [], version: 1 },
        } );

        this.#data = this.parseDataFile();

        if ( !this.#data.version || this.#data.version < 1 ) {
            
        }
    }









    
    /**
     * Attaches store events to ipc main and dispatches react events to the main window.
     * 
     * @param {ForwardRef} mainWindowRef The main window of the application.
     * @param {function} sendTick The send tick method.
     */
    attachIpcEvents( mainWindowRef, sendTick ) {

        ipcMain.on( 'combat-database:get-server',
            /**
             * @param {import("electron").IpcMainEvent} event The event args.
             * @param {string} serverName The name of the server.
             */
            ( event, serverName ) => {
                event.sender.send( 'combat-database:get-server', this.getOrInitServer( serverName ) );
            } );
         
        ipcMain.on( 'combat-database:get-all',
            /**
             * @param {import("electron").IpcMainEvent} event The event args.
             */
            ( event ) => {
                event.sender.send( 'combat-database:get-all', this.#data.servers );
            } );

        ipcMain.on( 'combat-database:put-server',
            /**
             * @param {import("electron").IpcMainEvent} event The event args.
             * @param {ServerCombatModel} server Theserver combat model.
             */
            ( event, server ) => {
                this.putServer( server );
            } );

    }









    
    /**
     * Updates the database with the given server model.
     * 
     * @param {ServerCombatModel} server The server combat model.
     */
    async putServer( server ) {
        let index = this.#data.servers.findIndex( f => f.server === server.server );
        if ( index >= 0 ) {
            this.#data.servers[ index ] = server;
        } else {
            this.#data.servers.push( server );
        }
        await this.storeDataFileAsync( this.#data );
    }










    /**
     * Gets or creates a new server.
     * 
     * @returns {ServerCombatModel} Returns the existing/new server model.
     * 
     * @param {string} serverName The name of the server.
     */
    getOrInitServer( serverName ) {
        let server = this.#data.servers.find( f => f.server === serverName );
        if ( !server ) {
            server = new ServerCombatModel();
            server.server = serverName;
            this.#data.servers.push( server );
            this.storeDataFile( this.#data );
        }
        return server;
    }










}

module.exports = CombatDatabase;
