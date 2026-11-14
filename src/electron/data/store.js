const electron = require( 'electron' );
const path = require( 'path' );
const fs = require( 'fs' );
const fsp = fs.promises;
const archiver = require( 'archiver' );
const log = require( 'electron-log' );
const FsUtilities = require( '../utilities/file-system' );

const retryCodes = [ 'EPERM', 'EACCES', 'EBUSY' ];
const renameAttempts = 10;
const readAttempts = 5;
const retryDelayMs = 20;

/**
 * Blocks the thread for the given time. Uses Atomics.wait, so it is for the main process only.
 *
 * @param {number} ms The time to wait in milliseconds.
 */
function sleepSync( ms ) {
    Atomics.wait( new Int32Array( new SharedArrayBuffer( 4 ) ), 0, 0, ms );
}

/** Thrown when a data file exists but cannot be read, so the caller can stop instead of overwriting it. */
class StoreReadError extends Error {
    constructor( filePath, cause ) {
        super( `Could not read ${filePath}: ${cause?.code || cause?.message}` );
        this.name = 'StoreReadError';
        this.filePath = filePath;
        this.code = cause?.code;
        this.cause = cause;
    }
}

class Store {
    /** The stored file path and location for this object. */
    #path;
    /** The folder for the current user data store. */
    userDataPath;
    /** This object's default values. */
    #defaults;
    /** Virtual properties */
    #virtual = [];
    /** The config name of this object. */
    configName;

    constructor( opts ) {
        // Renderer process has to get `app` module via `remote`, whereas the main process can get it directly
        // app.getPath('userData') will return a string of the user's app data directory path.
        this.userDataPath = ( electron.app || electron.remote.app ).getPath( 'userData' );
        // We'll use the `configName` property to set the file name and path.join to bring it all together as a string
        this.#path = path.join( this.userDataPath, opts.configName + '.json' );
        this.#defaults = opts.defaults;
        this.configName = opts.configName;
        this.#virtual = opts.virtual || [];
        // this.data = parseDataFile( this.path, opts.defaults );
        this.#removeStaleTempFiles();
    }
    

    /**
     * Reads the data file, returning the defaults when it is missing and moving it aside when it is corrupt.
     * Any other read error is retried briefly and then thrown, so the defaults never replace a valid file.
     *
     * @returns {any} Returns the parsed data, or the defaults if the file does not exist or was corrupt.
     */
    parseDataFile() {
        // We'll try/catch it in case the file doesn't exist yet, which will be the case on the first application run.
        // `fs.readFileSync` will return a JSON string which we then parse into a Javascript object
        let raw;

        for ( let attempt = 1; ; attempt++ ) {
            try {
                raw = fs.readFileSync( this.#path );
                break;
            } catch ( error ) {
                // A missing file is a normal first run.
                if ( error?.code === 'ENOENT' ) {
                    return this.#defaults;
                }

                if ( !retryCodes.includes( error?.code ) || attempt >= readAttempts ) {
                    log.error( `Store > Could not read ${this.configName}, the file was left in place.`, error );
                    throw new StoreReadError( this.#path, error );
                }

                sleepSync( retryDelayMs * attempt );
            }
        }

        try {
            return JSON.parse( raw );
        } catch ( error ) {
            if ( !( error instanceof SyntaxError ) ) {
                throw error;
            }

            // The file is not valid JSON, so move it aside before the next save overwrites it.
            let corruptPath = `${this.#path}.corrupt-${FsUtilities.getFileTimestamp()}-${Math.random().toString( 36 ).slice( 2, 8 )}`;

            try {
                fs.renameSync( this.#path, corruptPath );
                log.error( `Store > Could not parse ${this.configName}, the file was moved to ${corruptPath}`, error );
            } catch ( renameError ) {
                log.error( `Store > Could not parse ${this.configName}, and the file could not be moved aside`, error, renameError );
            }

            return this.#defaults;
        }
    }

    /**
     * Deletes leftover temporary files from interrupted saves.
     */
    #removeStaleTempFiles() {
        try {
            let prefix = `${path.basename( this.#path )}.`;

            for ( let name of fs.readdirSync( this.userDataPath ) ) {
                if ( name.startsWith( prefix ) && name.endsWith( '.tmp' ) ) {
                    fs.rmSync( path.join( this.userDataPath, name ), { force: true } );
                }
            }
        } catch ( error ) {
            // Stale temporary files are harmless.
        }
    }

    /**
     * Clones the given data and strips the virtual properties so it is ready to be written.
     *
     * @param {any} data The data to store.
     * @returns {any} Returns the data to write to the file.
     */
    #prepareStoreData( data ) {

        let storeData = JSON.parse( JSON.stringify( data ) );

        if ( !storeData ) {
            throw 'Attmept to store null data file!';
        }

        if ( this.#virtual.length > 0 ) {
            for ( let i = 0; i < this.#virtual.length; i++ ) {
                let virtual = this.#virtual[i];
                if ( storeData[virtual] ) {
                    delete storeData[virtual];
                }
            }
        }

        return storeData;
    }

    /**
     * Returns a unique temporary file path next to the data file.
     *
     * @returns {string} Returns the temporary file path.
     */
    #getTempPath() {
        return `${this.#path}.${process.pid}-${Date.now()}-${Math.random().toString( 36 ).slice( 2 )}.tmp`;
    }

    /**
     * Writes the data file by writing a temporary file and renaming it over the data file.
     * If the rename keeps failing, the data file is written directly. Failures are logged, not thrown.
     *
     * @param {any} data The data to store.
     */
    storeDataFile( data ) {

        let json = JSON.stringify( this.#prepareStoreData( data ) );
        let tempPath = this.#getTempPath();

        try {
            fs.writeFileSync( tempPath, json );

            for ( let attempt = 1; ; attempt++ ) {
                try {
                    fs.renameSync( tempPath, this.#path );
                    return;
                } catch ( error ) {
                    if ( !retryCodes.includes( error?.code ) || attempt >= renameAttempts ) {
                        throw error;
                    }

                    sleepSync( retryDelayMs * attempt );
                }
            }
        } catch ( error ) {
            log.warn( `Store > Could not replace ${this.configName} atomically, writing it directly.`, error );

            try {
                fs.writeFileSync( this.#path, json );
            } catch ( writeError ) {
                log.error( 'Error storing ' + this.configName, writeError );
            }

            try {
                fs.rmSync( tempPath, { force: true } );
            } catch ( removeError ) {
                // Nothing more can be done about the temporary file.
            }
        }
    }

    /**
     * Writes the data file asynchronously by writing a temporary file and renaming it over the data file.
     * If the rename keeps failing, the data file is written directly.
     *
     * @param {any} data The data to store.
     * @returns {Promise<void>} Returns a promise that resolves when the data file is written and rejects if it could not be written.
     */
    async storeDataFileAsync( data ) {

        let json = JSON.stringify( this.#prepareStoreData( data ) );
        let tempPath = this.#getTempPath();

        try {
            await fsp.writeFile( tempPath, json );

            for ( let attempt = 1; ; attempt++ ) {
                try {
                    await fsp.rename( tempPath, this.#path );
                    return;
                } catch ( error ) {
                    if ( !retryCodes.includes( error?.code ) || attempt >= renameAttempts ) {
                        throw error;
                    }

                    await new Promise( resolve => setTimeout( resolve, retryDelayMs * attempt ) );
                }
            }
        } catch ( error ) {
            log.warn( `Store > Could not replace ${this.configName} atomically, writing it directly.`, error );

            try {
                await fsp.writeFile( this.#path, json );
            } catch ( writeError ) {
                log.error( 'Error storing ' + this.configName, writeError );
                throw writeError;
            } finally {
                try {
                    await fsp.rm( tempPath, { force: true } );
                } catch ( removeError ) {
                    // Nothing more can be done about the temporary file.
                }
            }
        }
    }

    /**
     * Creates a backup of the database.
     * 
     * @param {(string) => void)} onComplete Callback function executed when the backup file is created that receives the backup file location.
     */
    backupDatafile( onComplete ) {
        let backupFile = path.join( this.userDataPath, `-${FsUtilities.getFileTimestamp()}-backup.zip` );
        let output = fs.createWriteStream( backupFile );
        let zip = archiver( 'zip' );

        output.on( 'close', () => {
            onComplete( backupFile );
        } );

        zip.pipe( output );
        zip.file( this.#path, { name: this.configName + '.json' } );
        zip.finalize();
    }

}

Store.StoreReadError = StoreReadError;

module.exports = Store;
