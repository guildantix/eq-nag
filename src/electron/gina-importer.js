const electron = require( 'electron' );
const { app, BrowserWindow, ipcMain, screen } = require( "electron" );
const ForwardRef = require( '../electron/forward-ref' );
const fs = require( 'fs' );
const path = require( "path" );
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
                    // console.log( 'gina data path', app.getPath( 'home' ) );
                    // getGinaConfig( jsonData => {
                    //     if ( jsonData ) {
                    //         mainWindowRef.reference.webContents.send( 'console:log', jsonData );
                    //     } else {
                            
                    //     }
                    // } );
                } );
            } );

        } );
        
        ipcMain.on( 'gina:get:configuration', ( event, triggerId ) => {
            getGinaConfig( jsonData => {
                if ( jsonData ) {
                    event.sender.webContents.send( 'gina:get:configuration', jsonData.Configuration );
                } else {
                    event.sender.webContents.send( 'gina:get:configuration', null );
                }
            } );
        } );
        
    }
    

    loadDataFile() {
        try {
            let data = JSON.parse( fs.readFileSync( this.#storePath ) );

            if ( data ) {
                importedGinaTriggers = data.importedGinaTriggers;
            }

        } catch ( error ) {
            
        }
    }

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
    let ginaConfigPath = path.join( ginaDataPath, ginaConfigFileName );
    fs.readFile( ginaConfigPath, { encoding: 'utf8' }, ( err, data ) => {
        parseStringPromise( data, { normalize: true, normalizeTags: false, explicitArray: false, ignoreAttrs: true } ).then( result => onLoaded( result ) );
    } );
}

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