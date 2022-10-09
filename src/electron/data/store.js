const electron = require( 'electron' );
const path = require( 'path' );
const fs = require( 'fs' );

class Store {
    /** The stored file path and location for this object. */
    #path;
    /** The folder for the current user data store. */
    userDataPath;
    /** This object's default values. */
    #defaults;
    /** The config name of this object. */
    #configName;

    constructor( opts ) {
        // Renderer process has to get `app` module via `remote`, whereas the main process can get it directly
        // app.getPath('userData') will return a string of the user's app data directory path.
        this.userDataPath = ( electron.app || electron.remote.app ).getPath( 'userData' );
        // We'll use the `configName` property to set the file name and path.join to bring it all together as a string
        this.#path = path.join( this.userDataPath, opts.configName + '.json' );
        this.#defaults = opts.defaults;
        this.#configName = opts.configName;
        // this.data = parseDataFile( this.path, opts.defaults );
    }
    

    parseDataFile() {
        // We'll try/catch it in case the file doesn't exist yet, which will be the case on the first application run.
        // `fs.readFileSync` will return a JSON string which we then parse into a Javascript object
        try {
            return JSON.parse( fs.readFileSync( this.#path ) );
        } catch ( error ) {
            // if there was some kind of error, return the passed in defaults instead.
            return this.#defaults;
        }
    }

    storeDataFile( data ) {
        if ( !data )
            throw 'Attmept to store null data file!';
        
        try {
            fs.writeFileSync( this.#path, JSON.stringify( data ) );
        } catch ( error ) {
            console.error( 'Error storing ' + this.#configName, error );
        }
    }

}

module.exports = Store;
