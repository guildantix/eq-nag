const electron = require( 'electron' );
const { app, BrowserWindow, ipcMain, screen } = require( "electron" );
const ForwardRef = require( '../electron/forward-ref' );
const fs = require( 'fs' );
const path = require( "path" );
const log = require( 'electron-log' );
// const parser = require( 'xml2json' );
const parseStringPromise = require( 'xml2js' ).parseStringPromise;

/** @type {string} */
var ginaDataPath = null;

/** @type {string} */
var ginaConfigFileName = 'GINAConfig.xml';

/** @type {string[]} */
var importedGinaTriggers = [];

class GinaImporter {

    /** @type {string} */
    #storePath;

    constructor() {
        let userDataPath = ( electron.app || electron.remote.app ).getPath( 'userData' );
        this.#storePath = path.join( userDataPath, 'imported.json' );
        this.loadDataFile();
    }
    









    /**
     * Initializes the GINA importer service.
     * 
     * @param {ForwardRef} mainWindowRef The main window of the application.
     * @param {boolean} isDev Sets up the log watcher window for development environment if true.
     */
    initGinaImporter( mainWindowRef, isDev ) {
        
        mainWindowRef.whenReady( () => {
            
            mainWindowRef.reference.webContents.once( 'did-finish-load', () => {
                queryGina( app.getPath( 'home' ), ginaPath => {
                    ginaDataPath = ginaPath;
                    var nameMatch = /\\Users\\(?<userName>.*)\\AppData/gi.exec( ginaDataPath );
                    
                    var logPath = ginaPath + '';
                    if ( nameMatch?.groups?.userName ) {
                        logPath = ginaPath.replace( nameMatch.groups.userName, '****' );
                    }
                    
                    log.info( `gina path: ${logPath}` );
                } );
            } );

        } );
        
        ipcMain.on( 'gina:get:configuration', ( event, triggerId ) => {
            getGinaConfig( jsonData => {
                if ( jsonData ) {
                    event.sender.send( 'gina:get:configuration', jsonData.Configuration );
                } else {
                    event.sender.send( 'gina:get:configuration', null );
                }
            } );
        } );
        
    }
    









    /**
     * Loads the list of GINA triggers already imported.
     */
    loadDataFile() {
        try {
            let data = JSON.parse( fs.readFileSync( this.#storePath ) );

            if ( data ) {
                importedGinaTriggers = data.importedGinaTriggers;
            }

        } catch ( error ) {
            
        }
    }










    /**
     * Saves the imported gina information, preventing those triggers from 
     * appearing in the list.
     */
    storeDataFile() {
        try {
            fs.writeFile( this.#storePath, JSON.stringify( { importedGinaTriggers: importedGinaTriggers } ), () => { } );
        } catch ( error ) {
            console.error( 'Error storing ' + this.#storePath, error );
        }
    }

}










/**
 * Parses the gina config file.
 * 
 * @param {(json: any) => void} onLoaded This method is executed when the config file is loaded and parsed into a json string.
 */
function getGinaConfig( onLoaded ) {
    // TODO: This should be done in a thread, with a direct reference to the GINA importer window.
    let ginaConfigPath = path.join( ginaDataPath, ginaConfigFileName );
    fs.readFile( ginaConfigPath, { encoding: 'utf8' }, ( err, data ) => {
        parseStringPromise( data, { normalize: true, normalizeTags: false, explicitArray: false, ignoreAttrs: true } ).then( result => onLoaded( result ) );
    } );
}










/**
 * Recursively searchs folder for installed GINA.
 * 
 * @param {string} folder The starting folder path.
 * @param {(path: string) => void} onFound Executed when the gina folder has been found.
 */
function queryGina( folder, onFound ) {
    fs.readdir( folder, { withFileTypes: true }, ( err, entities ) => {
        if ( entities ) {
            let folders = entities.filter( dirent => dirent.isDirectory() ).map( dirent => dirent.name );
            for ( let dir of folders ) {
                let childPath = path.join( folder, dir );
                if ( childPath.indexOf( 'GimaSoft\\GINA' ) > -1 ) {
                    onFound( childPath );
                } else {
                    try {
                        queryGina( childPath, onFound );
                    } catch ( error ) {
                        // Usually directory read permissions, just ignore it.
                    }
                }
            }
        }
    } );
}










module.exports = GinaImporter;