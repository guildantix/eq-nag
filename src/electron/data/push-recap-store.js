const fs = require( 'fs' );
const fsp = fs.promises;
const path = require( 'path' );
const crypto = require( 'crypto' );

const fileName = 'push-recaps.json';
const badFileName = 'push-recaps.json.bad';
const maxRecaps = 200;
const maxPlayers = 60;
const maxSpells = 30;
const maxProcs = 200;

/**
 * @typedef {Object} PushRecapSpellCount
 * @property {number} events The number of push events.
 * @property {number} assumed The number of events that were assumed to have landed.
 * @property {number} [push] The push value of one hit, when known.
 */

/**
 * @typedef {Object} PushRecapPlayerSummary
 * @property {string} name The player name.
 * @property {number} events The number of push events.
 * @property {number} assumed The number of assumed events.
 * @property {number} pushValue The total push value.
 * @property {Object<string, PushRecapSpellCount>} spells The counts by spell name.
 */

/**
 * @typedef {Object} PushRecapProc
 * @property {string} name The label of the proc.
 * @property {number | null} push The push value of one hit, or null when the spell is ambiguous.
 * @property {number | null} pushMin The lowest push value the proc can have.
 * @property {number | null} pushMax The highest push value the proc can have.
 * @property {number} count The number of times the proc landed.
 */

/**
 * @typedef {Object} PushRecapSummary
 * @property {string} id The id of the recap.
 * @property {string} savedAt When the recap was saved, as an ISO date.
 * @property {string} characterName The character that viewed the recap.
 * @property {string} mob The name of the mob.
 * @property {string} killTime The kill time as an ISO date.
 * @property {number} fightSeconds The length of the fight.
 * @property {number} damageTaken The damage the mob took.
 * @property {boolean} named True when the mob is a named mob.
 * @property {number} events The number of push events.
 * @property {number} assumed The number of assumed events.
 * @property {number} pushValue The total push value.
 * @property {string | null} topPusher The player with the most events.
 * @property {PushRecapPlayerSummary[]} players The players that pushed.
 * @property {{ events: number, pushValue: number, procs?: PushRecapProc[] }} unattributed The events with no player.
 */










/**
 * Returns the given value as a finite, non-negative number.
 *
 * @returns {number} The number.
 *
 * @param {any} value The value.
 */
function toCount( value ) {
    let n = +value;
    return Number.isFinite( n ) && n > 0 ? n : 0;
}










/**
 * Returns the given value as a finite, non-negative number, or null when it is missing.
 *
 * @returns {number | null} The number.
 *
 * @param {any} value The value.
 */
function toOptionalCount( value ) {
    let n = value == null ? NaN : +value;
    return Number.isFinite( n ) && n >= 0 ? n : null;
}










/**
 * Returns the given value as a short string.
 *
 * @returns {string} The string.
 *
 * @param {any} value The value.
 */
function toText( value ) {
    return typeof value === 'string' ? value.substring( 0, 200 ) : '';
}










/**
 * Builds a clean recap summary from the given data, or null when it is not a valid recap.
 *
 * @returns {PushRecapSummary | null} The summary.
 *
 * @param {any} data The data to clean.
 */
function sanitize( data ) {

    if ( data == null || typeof data !== 'object' ) {
        return null;
    }

    let killTime = new Date( data.killTime );
    let mob = toText( data.mob );
    if ( isNaN( killTime.getTime() ) || mob === '' ) {
        return null;
    }

    let players = ( Array.isArray( data.players ) ? data.players : [] ).slice( 0, maxPlayers ).map( p => {
        let spells = {};
        Object.keys( p?.spells ?? {} ).slice( 0, maxSpells ).forEach( name => {
            if ( name !== '__proto__' ) {
                let spell = { events: toCount( p.spells[ name ]?.events ), assumed: toCount( p.spells[ name ]?.assumed ) };
                let push = toOptionalCount( p.spells[ name ]?.push );
                if ( push != null ) {
                    spell.push = push;
                }
                spells[ name.substring( 0, 200 ) ] = spell;
            }
        } );
        return { name: toText( p?.name ), events: toCount( p?.events ), assumed: toCount( p?.assumed ), pushValue: toCount( p?.pushValue ), spells: spells };
    } );

    let unattributed = { events: toCount( data.unattributed?.events ), pushValue: toCount( data.unattributed?.pushValue ) };
    if ( Array.isArray( data.unattributed?.procs ) ) {
        unattributed.procs = data.unattributed.procs.slice( 0, maxProcs ).map( p => ( {
            name: toText( p?.name ),
            push: toOptionalCount( p?.push ),
            pushMin: toOptionalCount( p?.pushMin ),
            pushMax: toOptionalCount( p?.pushMax ),
            count: toCount( p?.count ),
        } ) );
    }

    return {
        id: typeof data.id === 'string' && data.id !== '' ? data.id.substring( 0, 64 ) : crypto.randomUUID(),
        savedAt: new Date().toISOString(),
        characterName: toText( data.characterName ),
        mob: mob,
        killTime: killTime.toISOString(),
        fightSeconds: toCount( data.fightSeconds ),
        damageTaken: toCount( data.damageTaken ),
        named: data.named === true,
        events: toCount( data.events ),
        assumed: toCount( data.assumed ),
        pushValue: toCount( data.pushValue ),
        topPusher: data.topPusher == null ? null : toText( data.topPusher ),
        players: players,
        unattributed: unattributed,
    };
}










/**
 * Keeps the saved push recaps.  The file is read the first time a recap is requested,
 * then kept in memory and written when it changes.
 */
class PushRecapStore {

    /** @type {string} */
    #path;
    /** @type {string} */
    #badPath;
    /** @type {PushRecapSummary[] | null} */
    #recaps = null;
    /** @type {Promise<boolean> | null} */
    #loading = null;
    /** @type {Promise<void> | null} */
    #writing = null;
    #dirty = false;
    #closed = false;
    #tempCounter = 0;
    /** @type {any} */
    #mainWindowRef = null;

    /**
     * @param {string} directory The folder to keep the file in.
     */
    constructor( directory ) {
        this.#path = path.join( directory, fileName );
        this.#badPath = path.join( directory, badFileName );
    }

    /**
     * Attaches the ipc events of the store.
     *
     * @param {any} mainWindowRef The main window of the application.
     */
    attachIpcEvents( mainWindowRef ) {

        const { ipcMain } = require( 'electron' );
        this.#mainWindowRef = mainWindowRef;

        ipcMain.on( 'push-recaps:list', async ( event, request ) => {
            let recaps = await this.list();
            if ( !event.sender.isDestroyed() ) {
                event.sender.send( 'push-recaps:reply', { requestId: request?.requestId, data: recaps } );
            }
        } );

        ipcMain.on( 'push-recaps:get', async ( event, request ) => {
            let recap = await this.get( request?.id );
            if ( !event.sender.isDestroyed() ) {
                event.sender.send( 'push-recaps:reply', { requestId: request?.requestId, data: recap } );
            }
        } );

        ipcMain.on( 'push-recaps:save', async ( event, summary ) => {
            let ok = await this.save( summary );
            if ( ok ) {
                this.#notifyChanged();
            }
            if ( !event.sender.isDestroyed() ) {
                event.sender.send( 'push-recaps:saved', { key: summary?.saveKey, ok: ok } );
            }
        } );

        ipcMain.on( 'push-recaps:delete', async ( event, id ) => {
            if ( await this.delete( id ) ) {
                this.#notifyChanged();
            }
        } );

        ipcMain.on( 'push-recaps:clear', async ( event ) => {
            await this.clear();
            this.#notifyChanged();
        } );

    }

    /**
     * Returns the saved recaps without their players and proc breakdown.
     *
     * @returns {Promise<Omit<PushRecapSummary, 'players'>[]>} The recaps.
     */
    async list() {
        if ( !await this.#load() ) {
            return [];
        }
        return this.#recaps.map( ( { players, unattributed, ...row } ) => ( { ...row, unattributed: { events: unattributed.events, pushValue: unattributed.pushValue } } ) );
    }

    /**
     * Returns the recap with the given id, with its players.
     *
     * @returns {Promise<PushRecapSummary | null>} The recap.
     *
     * @param {string} id The id of the recap.
     */
    async get( id ) {
        if ( !await this.#load() ) {
            return null;
        }
        return this.#recaps.find( r => r.id === id ) ?? null;
    }

    /**
     * Saves the given recap, replacing a recap of the same character, mob and kill time.
     *
     * @returns {Promise<boolean>} True when the recap was saved.
     *
     * @param {any} data The recap summary.
     */
    async save( data ) {
        let summary = sanitize( data );
        if ( summary == null ) {
            return false;
        }
        if ( !await this.#load() ) {
            return false;
        }
        let same = r => r.characterName === summary.characterName && r.mob === summary.mob && r.killTime === summary.killTime;
        let existing = this.#recaps.find( same );
        if ( existing != null ) {
            summary.id = existing.id;
        }
        this.#recaps = this.#recaps.filter( r => !same( r ) );
        this.#recaps.push( summary );
        if ( this.#recaps.length > maxRecaps ) {
            this.#recaps.splice( 0, this.#recaps.length - maxRecaps );
        }
        this.#persist();
        return true;
    }

    /**
     * Deletes the recap with the given id.
     *
     * @returns {Promise<boolean>} True when a recap was deleted.
     *
     * @param {string} id The id of the recap.
     */
    async delete( id ) {
        if ( !await this.#load() ) {
            return false;
        }
        let count = this.#recaps.length;
        this.#recaps = this.#recaps.filter( r => r.id !== id );
        if ( this.#recaps.length === count ) {
            return false;
        }
        this.#persist();
        return true;
    }

    /**
     * Deletes all saved recaps.
     */
    async clear() {
        if ( !await this.#load() ) {
            return;
        }
        this.#recaps = [];
        this.#persist();
    }

    /**
     * Resolves when all pending writes are done.
     *
     * @returns {Promise<void>} The promise.
     */
    async flush() {
        while ( this.#writing != null ) {
            await this.#writing;
        }
    }

    /**
     * Tells the main window that the saved recaps changed.
     */
    #notifyChanged() {
        let win = this.#mainWindowRef?.reference;
        if ( win != null && !win.isDestroyed() ) {
            win.webContents.send( 'push-recaps:changed' );
        }
    }

    /**
     * Writes any pending change right away.  For use when the app quits.
     */
    flushSync() {
        if ( this.#closed || this.#recaps == null || !( this.#dirty || this.#writing != null ) ) {
            return;
        }
        this.#closed = true;
        this.#dirty = false;
        let tempPath = this.#nextTempPath();
        try {
            fs.mkdirSync( path.dirname( this.#path ), { recursive: true } );
            fs.writeFileSync( tempPath, JSON.stringify( { version: 1, recaps: this.#recaps } ) );
            fs.renameSync( tempPath, this.#path );
        } catch ( error ) {
            console.error( 'Could not save the push recaps.', error );
            fs.rmSync( tempPath, { force: true } );
        }
    }

    /**
     * Loads the file once.  A missing file gives an empty list.  A file that cannot be read
     * leaves the store unloaded, so nothing is written over it and the next request tries again.
     * A file that is not a valid recap file is moved aside to a .bad file first.
     *
     * @returns {Promise<boolean>} True when the store is loaded.
     */
    #load() {
        if ( this.#recaps != null ) {
            return Promise.resolve( true );
        }
        if ( this.#loading == null ) {
            this.#loading = this.#read().finally( () => this.#loading = null );
        }
        return this.#loading;
    }

    /**
     * Reads the file.
     *
     * @returns {Promise<boolean>} True when the recaps are loaded.
     */
    async #read() {
        let text;
        try {
            text = await fsp.readFile( this.#path, 'utf8' );
        } catch ( error ) {
            if ( error.code === 'ENOENT' ) {
                this.#recaps = [];
                return true;
            }
            return false;
        }

        let data = null;
        try {
            data = JSON.parse( text );
        } catch ( error ) {
            data = null;
        }

        if ( data != null && data.version === 1 && Array.isArray( data.recaps ) ) {
            this.#recaps = data.recaps.map( r => {
                let summary = sanitize( r );
                if ( summary != null && typeof r.savedAt === 'string' && !isNaN( new Date( r.savedAt ).getTime() ) ) {
                    summary.savedAt = r.savedAt;
                }
                return summary;
            } ).filter( r => r != null ).slice( -maxRecaps );
            return true;
        }

        try {
            await fsp.rm( this.#badPath, { force: true } );
            await fsp.rename( this.#path, this.#badPath );
        } catch ( error ) {
            return false;
        }
        this.#recaps = [];
        return true;
    }

    /**
     * Returns a temp file name that no other write uses.
     *
     * @returns {string} The path.
     */
    #nextTempPath() {
        return `${this.#path}.${process.pid}.${++this.#tempCounter}.tmp`;
    }

    /**
     * Writes the file, one write at a time.  Changes made during a write are written right after.
     */
    #persist() {
        if ( this.#closed ) {
            return;
        }
        this.#dirty = true;
        if ( this.#writing != null ) {
            return;
        }
        this.#writing = ( async () => {
            while ( this.#dirty && !this.#closed ) {
                this.#dirty = false;
                let tempPath = this.#nextTempPath();
                try {
                    await fsp.mkdir( path.dirname( this.#path ), { recursive: true } );
                    if ( this.#closed ) {
                        break;
                    }
                    await fsp.writeFile( tempPath, JSON.stringify( { version: 1, recaps: this.#recaps } ) );
                    if ( this.#closed ) {
                        await fsp.rm( tempPath, { force: true } );
                        break;
                    }
                    await fsp.rename( tempPath, this.#path );
                } catch ( error ) {
                    console.error( 'Could not save the push recaps.', error );
                    await fsp.rm( tempPath, { force: true } ).catch( () => { } );
                }
            }
            this.#writing = null;
        } )();
    }

}

module.exports = PushRecapStore;
