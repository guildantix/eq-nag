const fs = require( 'fs' );
const fsp = fs.promises;
const path = require( 'path' );
const crypto = require( 'crypto' );
const { Worker } = require( 'worker_threads' );

const cacheFileName = 'push-scan-cache.json';
const badCacheFileName = 'push-scan-cache.json.bad';
const cacheVersion = 1;
const maxCachedLogs = 10;
const maxResults = 300;
const defaultDamage = 1000000;
const workerPath = path.join( __dirname, '..', 'threads', 'push-scan-worker.js' );

/**
 * @typedef {Object} PushScanStatus
 * @property {'idle' | 'running' | 'done' | 'cancelled' | 'error'} status The state of the scan.
 * @property {string | null} characterId The character that was scanned.
 * @property {string | null} characterName The name of that character.
 * @property {number} minDamage The smallest damage taken that a listed fight has.
 * @property {number} bytes The number of bytes scanned.
 * @property {number} total The number of bytes to scan.
 * @property {number} kills The number of kills found.
 * @property {boolean} capped True when only the most recent kills are kept.
 * @property {boolean} resumed True when the scan continued from a previous scan of the same log.
 * @property {number} elapsedMs How long the scan took.
 * @property {string} message A message about the end of the scan.
 */










/**
 * Returns the status of a service that has not scanned anything.
 *
 * @returns {PushScanStatus} The status.
 */
function idleStatus() {
    return { status: 'idle', characterId: null, characterName: null, minDamage: defaultDamage, bytes: 0, total: 0, kills: 0, capped: false, resumed: false, elapsedMs: 0, message: '' };
}










/**
 * Tells whether the given cached result has the shape of a recap summary.
 *
 * @returns {boolean} True when the result can be used.
 *
 * @param {any} r The cached result.
 */
function isValidResult( r ) {
    return r != null && typeof r === 'object' && typeof r.mob === 'string' && r.mob !== '' && typeof r.killTime === 'string' && !isNaN( new Date( r.killTime ).getTime() )
        && typeof r.characterName === 'string' && Number.isFinite( r.fightSeconds ) && Number.isFinite( r.damageTaken ) && Number.isFinite( r.events )
        && Number.isFinite( r.assumed ) && Number.isFinite( r.pushValue ) && typeof r.named === 'boolean'
        && Array.isArray( r.players ) && r.players.every( p => p != null && typeof p === 'object' && typeof p.name === 'string' && Number.isFinite( p.events ) && p.spells != null && typeof p.spells === 'object' )
        && r.unattributed != null && typeof r.unattributed === 'object';
}










/**
 * Returns the id of a scanned recap, which stays the same when the log is scanned again.
 *
 * @returns {string} The id.
 *
 * @param {any} summary The recap summary.
 */
function buildId( summary ) {
    return crypto.createHash( 'sha1' ).update( `${summary.characterName}|${summary.mob}|${summary.killTime}` ).digest( 'hex' ).substring( 0, 16 );
}










/**
 * Scans whole logs for boss kills, in a worker thread, and keeps the result of the last scan.
 * The result of each log is cached so a later scan only reads what is new.
 */
class PushScanService {

    /** @type {string} */
    #cachePath;
    /** @type {string} */
    #badCachePath;
    /** @type {any} */
    #characterDatabase;
    /** @type {any} */
    #userPreferences;
    /** @type {any} */
    #mainWindowRef = null;
    /** @type {Worker | null} */
    #worker = null;
    #starting = false;
    /** @type {any[]} */
    #results = [];
    /** @type {any[]} */
    #partial = [];
    /** @type {Promise<void>} */
    #writing = Promise.resolve();
    #tempCounter = 0;
    /** @type {PushScanStatus} */
    #status = idleStatus();

    /**
     * @param {string} directory The folder to keep the cache file in.
     * @param {any} characterDatabase The character database.
     * @param {any} userPreferences The user preferences.
     */
    constructor( directory, characterDatabase, userPreferences ) {
        this.#cachePath = path.join( directory, cacheFileName );
        this.#badCachePath = path.join( directory, badCacheFileName );
        this.#characterDatabase = characterDatabase;
        this.#userPreferences = userPreferences;
    }

    /**
     * Attaches the ipc events of the service.
     *
     * @param {any} mainWindowRef The main window of the application.
     */
    attachIpcEvents( mainWindowRef ) {

        const { ipcMain } = require( 'electron' );
        this.#mainWindowRef = mainWindowRef;

        let reply = ( event, request, data ) => {
            if ( !event.sender.isDestroyed() ) {
                event.sender.send( 'push-scan:reply', { requestId: request?.requestId, data: data } );
            }
        };

        ipcMain.on( 'push-scan:start', async ( event, request ) => {
            reply( event, request, await this.start( request?.characterId, request?.minDamage ) );
        } );

        ipcMain.on( 'push-scan:cancel', () => this.cancel() );

        ipcMain.on( 'push-scan:status', ( event, request ) => reply( event, request, this.getStatus() ) );

        ipcMain.on( 'push-scan:results', ( event, request ) => reply( event, request, this.getRows() ) );

        ipcMain.on( 'push-scan:get', ( event, request ) => reply( event, request, this.getResult( request?.id ) ) );

    }

    /**
     * Returns the state of the scan.
     *
     * @returns {PushScanStatus} The status.
     */
    getStatus() {
        return this.#status;
    }

    /**
     * Returns the scanned recaps without their players and proc breakdown.
     *
     * @returns {any[]} The recaps.
     */
    getRows() {
        return this.#results.map( ( { players, unattributed, ...row } ) => ( { ...row, unattributed: { events: unattributed.events, pushValue: unattributed.pushValue } } ) );
    }

    /**
     * Returns the scanned recap with the given id, with its players.
     *
     * @returns {any | null} The recap.
     *
     * @param {string} id The id of the recap.
     */
    getResult( id ) {
        return this.#results.find( r => r.id === id ) ?? null;
    }

    /**
     * Starts a scan of the log of the given character.  Only one scan runs at a time.
     *
     * @returns {Promise<{ started: boolean, message: string }>} Whether the scan started, and why not if it did not.
     *
     * @param {any} characterId The id of the character.
     * @param {any} minDamage The smallest damage taken a fight needs to be listed.
     */
    async start( characterId, minDamage ) {

        if ( this.#worker != null || this.#starting ) {
            return { started: false, message: 'A scan is already running.  Wait for it to finish or cancel it.' };
        }

        let character = typeof characterId === 'string' ? this.#characterDatabase.find( characterId ) : null;
        if ( character == null || typeof character.logFile !== 'string' || character.logFile === '' ) {
            return { started: false, message: 'That character has no log file.' };
        }
        if ( !fs.existsSync( character.logFile ) ) {
            return { started: false, message: `The log file of ${character.name} was not found.` };
        }

        let floor = Number.isFinite( minDamage ) && minDamage >= 1 ? Math.floor( minDamage ) : defaultDamage;
        let quietGap = this.#userPreferences.pushRecap?.quietGapSeconds;
        quietGap = quietGap >= 5 && quietGap <= 300 ? quietGap : 30;

        this.#starting = true;
        try {
            let logs = await this.#readCache();
            let entry = logs?.[ character.logFile ];
            let valid = entry != null && Array.isArray( entry.results ) && Number.isFinite( entry.size ) && Number.isFinite( entry.resumeOffset ) && typeof entry.head === 'string' && Number.isFinite( entry.headLength ) && entry.results.every( isValidResult );
            if ( entry != null && !valid ) {
                logs = this.#dropCache( logs, character.logFile );
            }
            let cache = valid && entry.quietGap === quietGap && entry.minDamage === floor ? entry : null;

            this.#results = [];
            this.#partial = cache != null ? cache.results.slice() : [];
            this.#status = Object.assign( idleStatus(), { status: 'running', characterId: character.characterId, characterName: character.name, minDamage: floor } );

            let worker = new Worker( workerPath, { workerData: {
                logFilePath: character.logFile,
                characterName: character.name,
                eqFolder: this.#userPreferences.everquestInstallFolder ?? '',
                userData: path.dirname( this.#cachePath ),
                quietGapSeconds: quietGap,
                minDamage: floor,
                cache: cache,
            } } );
            this.#worker = worker;

            worker.on( 'message', message => this.#onMessage( worker, message, character, quietGap, floor, logs ) );
            worker.on( 'error', error => {
                if ( worker === this.#worker ) {
                    this.#dropCache( logs, character.logFile );
                }
                this.#finish( worker, 'error', `The log could not be scanned: ${error.message}` );
            } );
            worker.on( 'exit', () => {
                if ( worker === this.#worker ) {
                    this.#dropCache( logs, character.logFile );
                }
                this.#finish( worker, 'error', 'The scan stopped unexpectedly.' );
            } );
        } catch ( error ) {
            this.#worker = null;
            this.#status = Object.assign( idleStatus(), { status: 'error', message: `The scan could not be started: ${error.message}` } );
            return { started: false, message: this.#status.message };
        } finally {
            this.#starting = false;
        }

        return { started: true, message: '' };
    }

    /**
     * Stops the running scan.
     */
    cancel() {
        let worker = this.#worker;
        if ( worker != null ) {
            this.#finish( worker, 'cancelled', 'The scan was cancelled.' );
        }
    }

    /**
     * Stops the running scan, for use when the app quits.
     */
    shutdown() {
        this.cancel();
    }

    /**
     * Handles a message of the worker.
     *
     * @param {Worker} worker The worker.
     * @param {any} message The message.
     * @param {any} character The character that is scanned.
     * @param {number} quietGap The quiet gap of the scan.
     * @param {number} floor The smallest damage of the scan.
     * @param {any} logs The cached logs.
     */
    #onMessage( worker, message, character, quietGap, floor, logs ) {
        let logFile = character.logFile;
        if ( worker !== this.#worker ) {
            return;
        }

        if ( message.type === 'progress' ) {
            this.#status.bytes = message.bytes;
            this.#status.total = message.total;
            this.#status.kills = message.kills;
            this.#send( 'push-scan:progress', { bytes: message.bytes, total: message.total, kills: message.kills } );

        } else if ( message.type === 'kill' ) {
            let key = `${message.summary.mob}|${message.summary.killTime}`;
            this.#partial = this.#partial.filter( r => `${r.mob}|${r.killTime}` !== key );
            this.#partial.push( message.summary );
            if ( this.#partial.length > maxResults ) {
                this.#partial.shift();
            }

        } else if ( message.type === 'done' ) {
            let result = message.result;
            if ( this.#characterDatabase.find( character.characterId ) == null ) {
                this.#status.kills = 0;
                this.#finish( worker, 'done', 'The character was removed during the scan, so the results were discarded.' );
                return;
            }
            this.#results = result.results.map( r => Object.assign( { id: buildId( r ) }, r ) );
            this.#status.bytes = result.size;
            this.#status.total = result.size;
            this.#status.kills = this.#results.length;
            this.#status.capped = result.capped;
            this.#status.resumed = result.resumed;
            this.#status.elapsedMs = result.elapsedMs;
            this.#storeCache( logs, logFile, {
                size: result.size,
                resumeOffset: result.resumeOffset,
                head: result.head,
                headLength: result.headLength,
                quietGap: quietGap,
                minDamage: floor,
                capped: result.capped,
                scannedAt: Date.now(),
                results: result.results,
            } );
            this.#finish( worker, 'done', '' );

        } else if ( message.type === 'error' ) {
            if ( message.code !== 'no-folder' && message.code !== 'no-file' ) {
                this.#dropCache( logs, logFile );
            }
            this.#finish( worker, 'error', message.message );
        }
    }

    /**
     * Ends the scan with the given outcome, stops the worker and tells the main window.  Does nothing
     * when the scan has already ended.
     *
     * @param {Worker} worker The worker.
     * @param {'done' | 'cancelled' | 'error'} status The outcome.
     * @param {string} message A message about the outcome.
     */
    #finish( worker, status, message ) {
        if ( worker !== this.#worker ) {
            return;
        }
        this.#worker = null;
        worker.terminate().catch( () => { } );
        this.#status.status = status;
        this.#status.message = message;
        if ( status === 'cancelled' ) {
            this.#results = this.#partial.map( r => Object.assign( { id: buildId( r ) }, r ) );
            this.#status.kills = this.#results.length;
            this.#status.message = 'The scan was cancelled.  The fights listed are only the ones found so far.';
        } else if ( status === 'error' ) {
            this.#results = [];
        }
        this.#partial = [];
        this.#send( 'push-scan:done', this.#status );
    }

    /**
     * Sends the given event to the main window.
     *
     * @param {string} channel The channel.
     * @param {any} data The data of the event.
     */
    #send( channel, data ) {
        let win = this.#mainWindowRef?.reference;
        if ( win != null && !win.isDestroyed() ) {
            win.webContents.send( channel, data );
        }
    }

    /**
     * Reads the cached logs.  A missing file gives no logs.  A file that is not a valid cache is moved aside.
     * Returns null, and writes nothing later, when the file cannot be read.
     *
     * @returns {Promise<Object<string, any> | null>} The cached logs by log path, or null.
     */
    async #readCache() {
        await this.#writing;
        let text;
        try {
            text = await fsp.readFile( this.#cachePath, 'utf8' );
        } catch ( error ) {
            return error.code === 'ENOENT' ? {} : null;
        }

        let data = null;
        try {
            data = JSON.parse( text );
        } catch ( error ) {
            data = null;
        }
        if ( data != null && data.version === cacheVersion && data.logs != null && typeof data.logs === 'object' ) {
            return data.logs;
        }

        try {
            await fsp.rm( this.#badCachePath, { force: true } );
            await fsp.rename( this.#cachePath, this.#badCachePath );
        } catch ( error ) {
            return null;
        }
        return {};
    }

    /**
     * Removes the given log from the cache file.
     *
     * @returns {Object<string, any> | null} The cached logs without that log.
     *
     * @param {Object<string, any> | null} logs The logs that were read from the file, or null when it could not be read.
     * @param {string} logFile The log path.
     */
    #dropCache( logs, logFile ) {
        if ( logs == null ) {
            return logs;
        }
        this.#storeCache( logs, logFile, null );
        let rest = Object.assign( {}, logs );
        delete rest[ logFile ];
        return rest;
    }

    /**
     * Keeps the result of the given log in the cache file, and drops the logs scanned longest ago.
     *
     * @param {Object<string, any> | null} logs The logs that were read from the file, or null when it could not be read.
     * @param {string} logFile The log path.
     * @param {any} entry The cache entry of the log.
     */
    #storeCache( logs, logFile, entry ) {
        if ( logs == null ) {
            return;
        }
        let kept = Object.assign( {}, logs );
        delete kept[ logFile ];
        if ( entry != null ) {
            kept[ logFile ] = entry;
        }
        Object.keys( kept ).sort( ( a, b ) => ( kept[ b ].scannedAt ?? 0 ) - ( kept[ a ].scannedAt ?? 0 ) ).slice( maxCachedLogs ).forEach( key => delete kept[ key ] );

        this.#writing = this.#writing.then( async () => {
            let tempPath = `${this.#cachePath}.${process.pid}.${++this.#tempCounter}.tmp`;
            try {
                await fsp.mkdir( path.dirname( this.#cachePath ), { recursive: true } );
                await fsp.writeFile( tempPath, JSON.stringify( { version: cacheVersion, logs: kept } ) );
                await fsp.rename( tempPath, this.#cachePath );
            } catch ( error ) {
                console.error( 'Could not save the push scan cache.', error );
                await fsp.rm( tempPath, { force: true } ).catch( () => { } );
            }
        } );
    }

}

module.exports = PushScanService;
