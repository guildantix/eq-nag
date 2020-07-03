const electron = require( 'electron' );
const path = require( 'path' );
const fs = require( 'fs' );

class Store {

    #path;
    #userDataPath;

    constructor( configName, opts ) {
        // Renderer process has to get `app` module via `remote`, whereas the main process can get it directly
        // app.getPath('userData') will return a string of the user's app data directory path.
        this.#userDataPath = ( electron.app || electron.remote.app ).getPath( 'userData' );
        // We'll use the `configName` property to set the file name and path.join to bring it all together as a string
        this.#path = path.join( this.#userDataPath, configName + '.json' );

        // this.data = parseDataFile( this.path, opts.defaults );
    }
    

    parseDataFile( defaults ) {
        // We'll try/catch it in case the file doesn't exist yet, which will be the case on the first application run.
        // `fs.readFileSync` will return a JSON string which we then parse into a Javascript object
        try {
            return JSON.parse( fs.readFileSync( this.#path ) );
        } catch ( error ) {
            // if there was some kind of error, return the passed in defaults instead.
            return defaults;
        }
    }

}

module.exports = Store;
