const { PlayerCharacter, PlayerPet } = require( "./models/common" );
const Store = require( './store' );
const _ = require( 'lodash' );
const StringUtilities = require( "../utilities/string" );
const { app, BrowserWindow, ipcMain, screen } = require( "electron" );
const { CombatDb, ServerCombatModel, EncounterModel, CombatEncounterModel, combatDbDefault } = require( "./models/combat-parser" );
const path = require( 'path' );
const FsUtilities = require( "../utilities/file-system" );
const fs = require( 'fs' );
const ForwardRef = require( "../forward-ref" );
const fsp = fs.promises;
const log = require( 'electron-log' );
const { migrateCombatData } = require( "./migrations/combat-database-migration" );
// TODO: Unzip with: https://github.com/max-mapper/extract-zip
const archiver = require( 'archiver' );


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

    /** @type {Record<string, Electron.WebContents>} */
    #serverDataListeners = {};

    /** The data store for this object.
     * @type {CombatDb}
     * */
    #data;

    constructor() {
        super( {
            configName: "combat-database",
            defaults: combatDbDefault,
        } );

        this.#data = this.parseDataFile();

        app.on( 'ready', () => {
            migrateCombatData( this.#data, this.configName, data => {
                this.#data = data;
                this.storeDataFile( this.#data );
            } );
        } );

    }









    
    /**
     * Attaches store events to ipc main and dispatches react events to the main window.
     * 
     * @param {ForwardRef<BrowserWindow>} mainWindowRef The main window of the application.
     * @param {function} sendTick The send tick method.
     */
    attachIpcEvents( mainWindowRef, sendTick ) {

        ipcMain.on( 'combat-database:get-server',
            /**
             * @param {import("electron").IpcMainEvent} event The event args.
             * @param {string} serverName The name of the server.
             */
            ( event, serverName ) => {
                event.sender.send( `combat-database:get-server:${serverName}`, this.getOrInitServer( serverName ) );
                this.#serverDataListeners[ serverName ] = event.sender;
            } );

        ipcMain.on( 'combat-database:get-server-names',
            /**
             * @param {import("electron").IpcMainEvent} event The event args.
             * @param {string} serverName The name of the server.
             */
            ( event, serverName ) => {
                event.sender.send( 'combat-database:get-server-names', this.#data.servers.map( f => f.server ) );
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
            async ( event, server ) => {
                await this.putServer( server );

                if ( this.#serverDataListeners[ server.server ] && this.#serverDataListeners[ server.server ] != event.sender ) {
                    this.#serverDataListeners[ server.server ].send( `combat-database:get-server:${server.server}`, server );
                }
            } );

        ipcMain.handle( 'log:save-encounter',
            /**
             * Saves the encounter to disk.
             * 
             * @param {Electron.IpcMainEvent} event Electron event args.
             * @param {EncounterModel} encounter The encounter to save.
             */
            async ( event, encounter ) => {
                return await this.#saveEncounter( encounter, mainWindowRef.reference );
            } );

    }

    /**
     * Saves the encounter to disk.
     * 
     * @returns {Promise<boolean>} Returns true if the encounter was saved.
     * 
     * @param {EncounterModel} encounter The encounter to save.
     * @param {BrowserWindow} mainWindow The main window of the application.
     */
    async #saveEncounter( encounter, mainWindow ) {
        
        try {
            const encountersPath = path.join( this.userDataPath, 'encounters' );
                    
            if ( !fs.existsSync( encountersPath ) ) {
                await fsp.mkdir( encountersPath );
            }


            const name = `${encounter.characterName}_${encounter.serverName}_${FsUtilities.getFileTimestamp( new Date( Date.now() ), 'readable' )}`;
            // ex: encounters/charactername_servername_2021-12-31-12-59-59
            const tempDir = path.join( encountersPath, name );

            if ( !fs.existsSync( tempDir ) ) {
                await fsp.mkdir( tempDir );
            }

            const zip = archiver( 'zip' );

            const myFilename = `eqlog_${encounter.characterName}_${encounter.serverName}.txt`;
            const myFilePath = path.join( tempDir, myFilename );
            // Save my logs to the file.
            await fsp.writeFile( myFilePath, encounter.logs.join( '\r\n' ) );
            // Add the file to the zip.
            zip.file( myFilePath, { name: myFilename } );

            for ( let i = 0; i < encounter.externalEncounterInfos.length; i++ ) {
                const info = encounter.externalEncounterInfos[ i ];
                const filename = `eqlog_${info.characterName}_${encounter.serverName}.txt`;
                const filePath = path.join( tempDir, filename );
                // Save the logs to the file.
                await fsp.writeFile( filePath, info.logs.join( '\r\n' ) );
                // Add the file to the zip.
                zip.file( filePath, { name: filename } );
            }
            
            const zipFilename = `${name}.zip`;
            const zipFilePath = path.join( encountersPath, zipFilename );
            let output = fs.createWriteStream( zipFilePath );

            zip.pipe( output );
            await zip.finalize();

            this.#data.encounters.push( {
                encounterId: encounter.encounterId,
                characterName: encounter.characterName,
                serverName: encounter.serverName,
                filePath: zipFilePath,
                timestamp: new Date(),
                npcs: encounter.npcs,
                externalPlayerNames: encounter.externalEncounterInfos.map( f => f.characterName ),
            } );
            
            await this.storeDataFileAsync( this.#data );

            // Delete the temp directory.
            await fsp.rm( tempDir, { recursive: true } );

            return true;
        } catch ( error ) {

            // Log to the nag log file.
            log.error( error );

            // Send the error to the main window.
            let errorMsg = {
                label: 'Save Error:',
                message: 'Could not save encounter to disk.',
                timestamp: new Date(),
                payload: error,
            };

            mainWindow?.webContents.send( 'console:error', errorMsg );
        }

        return false;
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
