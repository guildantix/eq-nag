const fs = require( 'fs' );
const fsp = fs.promises;
const path = require( 'path' );
const crypto = require( 'crypto' );
const log = require( 'electron-log' );
const { buildListRow, maxTimeline, maxTimelineTexts } = require( '../utilities/push-recap-summary' );

const fileName = 'push-recaps.json';
const badFileName = 'push-recaps.json.bad';
const maxRecaps = 200;
const maxPlayers = 60;
const maxSpells = 30;
const maxProcs = 200;
const maxProcNames = 40;
const maxAlsoNames = 3;
const maxNpcAbilities = 100;

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
 * @property {string} [text] The landing message, after the name of the mob.  Missing on recaps
 *     saved by older versions.
 * @property {string} name The label of the proc.
 * @property {string[]} [names] The spells the landing message can belong to.
 * @property {number | null} push The push value of one hit, or null when the spell is ambiguous.
 * @property {number | null} pushMin The lowest push value the proc can have.
 * @property {number | null} pushMax The highest push value the proc can have.
 * @property {number} count The number of times the proc landed.
 * @property {string[]} [alsoNames] For a possible proc, the first spells with no push that use the
 *     same message.
 * @property {number} [alsoCount] For a possible proc, how many spells with no push use the same
 *     message.
 */

/**
 * @typedef {Object} PushRecapNpcAbility
 * @property {string} actor The NPC that used the ability.
 * @property {string} name The name of the ability.
 * @property {number} count The number of times it was used.
 * @property {number} push The push value of one use.
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
 * @property {{ events: number, pushValue: number, procs?: PushRecapProc[], possibleEvents?: number,
 *     possible?: PushRecapProc[] }} unattributed The events with no player.
 * @property {PushRecapNpcAbility[]} [npcAbilities] The push abilities the NPCs used.
 * @property {boolean} [othersSeen] True when spell damage from other players was in the log.
 * @property {boolean} [startsAtLogEdge] True when the fight may have begun before the part read.
 * @property {boolean} [reachedStart] True when the part read began at the start of the log.
 * @property {string} [fightStart] When the fight started, as an ISO date.
 * @property {any[][]} [timeline] Every counted hit, in fight order: [ seconds into the fight, kind
 *     (0 hit, 1 assumed cast, 2 proc, 3 possible proc), index in players or -1, spell name or index
 *     in timelineTexts, push ].
 * @property {string[]} [timelineTexts] The landing messages the timeline refers to.
 * @property {boolean} [timelineTruncated] True when a long fight had entries left out of the
 *     timeline.
 */










/**
 * Returns the given value as a finite, non-negative number.
 *
 * @returns {number} The number.
 *
 * @param {any} value The value.
 */
function toCount( value ) {
    const n = +value;
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
    const n = ( value === null || value === undefined ) ? NaN : +value;
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
 * Returns the given timeline entry as a clean entry, or null when it is not valid.
 *
 * @returns {any[] | null} The entry.
 *
 * @param {any} entry The entry.
 * @param {number} playerCount The number of players.
 * @param {number} textCount The number of landing messages.
 */
function toTimelineEntry( entry, playerCount, textCount ) {
    if ( !Array.isArray( entry ) || entry.length < 5 ) {
        return null;
    }
    let [ time, kind, who, ref, push ] = entry;
    const badTime = !Number.isFinite( time ) || time < 0;
    const badKind = !Number.isInteger( kind ) || kind < 0 || kind > 3;
    if ( badTime || badKind || !Number.isFinite( push ) || push < 0 ) {
        return null;
    }
    if ( kind < 2 ) {
        if ( typeof ref !== 'string' ) {
            return null;
        }
        ref = toText( ref );
        who = Number.isInteger( who ) && who >= 0 && who < playerCount ? who : -1;
    } else {
        if ( !Number.isInteger( ref ) || ref < 0 || ref >= textCount ) {
            return null;
        }
        who = -1;
    }
    return [ Math.round( time ), kind, who, ref, Math.round( push * 100 ) / 100 ];
}










/**
 * Builds a clean recap summary from the given data, or null when it is not a valid recap.
 *
 * @returns {PushRecapSummary | null} The summary.
 *
 * @param {any} data The data to clean.
 */
function sanitize( data ) {

    if ( ( data === null || data === undefined ) || typeof data !== 'object' ) {
        return null;
    }

    const killTime = new Date( data.killTime );
    const mob = toText( data.mob );
    if ( isNaN( killTime.getTime() ) || mob === '' ) {
        return null;
    }

    const players = ( Array.isArray( data.players ) ? data.players : [] ).slice( 0, maxPlayers ).map( p => {
        const spells = {};
        Object.keys( p?.spells ?? {} ).slice( 0, maxSpells ).forEach( name => {
            if ( name !== '__proto__' ) {
                const spell = { events: toCount( p.spells[ name ]?.events ), assumed: toCount( p.spells[ name ]?.assumed ) };
                const push = toOptionalCount( p.spells[ name ]?.push );
                if ( push !== null && push !== undefined ) {
                    spell.push = push;
                }
                spells[ name.substring( 0, 200 ) ] = spell;
            }
        } );
        return {
            name: toText( p?.name ),
            events: toCount( p?.events ),
            assumed: toCount( p?.assumed ),
            pushValue: toCount( p?.pushValue ),
            spells: spells
        };
    } );

    const unattributed = { events: toCount( data.unattributed?.events ), pushValue: toCount( data.unattributed?.pushValue ) };
    const toProc = p => {
        const proc = {
            name: toText( p?.name ),
            push: toOptionalCount( p?.push ),
            pushMin: toOptionalCount( p?.pushMin ),
            pushMax: toOptionalCount( p?.pushMax ),
            count: toCount( p?.count ),
        };
        if ( Array.isArray( p?.names ) ) {
            proc.names = p.names.slice( 0, maxProcNames ).map( toText );
        }
        if ( typeof p?.text === 'string' && p.text !== '' ) {
            proc.text = toText( p.text );
        }
        if ( Array.isArray( p?.alsoNames ) ) {
            proc.alsoNames = p.alsoNames.slice( 0, maxAlsoNames ).map( toText );
            proc.alsoCount = toCount( p.alsoCount );
        }
        return proc;
    };
    if ( Array.isArray( data.unattributed?.procs ) ) {
        unattributed.procs = data.unattributed.procs.slice( 0, maxProcs ).map( toProc );
    }
    if ( Array.isArray( data.unattributed?.possible ) ) {
        unattributed.possibleEvents = toCount( data.unattributed.possibleEvents );
        unattributed.possible = data.unattributed.possible.slice( 0, maxProcs ).map( toProc );
    }

    const summary = {
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
        topPusher: ( data.topPusher === null || data.topPusher === undefined ) ? null : toText( data.topPusher ),
        players: players,
        unattributed: unattributed,
    };

    if ( Array.isArray( data.npcAbilities ) ) {
        summary.npcAbilities = data.npcAbilities.slice( 0, maxNpcAbilities ).map( a => {
            return { actor: toText( a?.actor ), name: toText( a?.name ), count: toCount( a?.count ), push: toCount( a?.push ) };
        } );
    }
    if ( typeof data.fightStart === 'string' && !isNaN( new Date( data.fightStart ).getTime() ) ) {
        summary.fightStart = new Date( data.fightStart ).toISOString();
    }
    if ( Array.isArray( data.timeline ) ) {
        const rawTexts = Array.isArray( data.timelineTexts ) ? data.timelineTexts : [];
        const texts = rawTexts.slice( 0, maxTimelineTexts ).map( toText );
        summary.timelineTexts = texts;
        summary.timeline = data.timeline.slice( 0, maxTimeline )
            .map( e => toTimelineEntry( e, players.length, texts.length ) )
            .filter( e => ( e !== null && e !== undefined ) );
        if ( data.timelineTruncated === true || data.timeline.length > maxTimeline || rawTexts.length > maxTimelineTexts ) {
            summary.timelineTruncated = true;
        }
    }
    [ 'othersSeen', 'startsAtLogEdge', 'reachedStart' ].forEach( key => {
        if ( typeof data[ key ] === 'boolean' ) {
            summary[ key ] = data[ key ];
        }
    } );

    return summary;
}










/**
 * Tells whether a scanned recap is a worse copy of the saved one.  Log maintenance trims the start
 * of the log, so a rescan of an old fight can see only the end of it, and must not replace the
 * full recap.
 *
 * @returns {boolean} True when the saved recap should be kept.
 *
 * @param {PushRecapSummary} scanned The recap from the scan.
 * @param {PushRecapSummary} saved The recap that is saved.
 */
function isWorseThanSaved( scanned, saved ) {
    if ( scanned.startsAtLogEdge === true && saved.startsAtLogEdge !== true ) {
        return true;
    }
    return scanned.events < saved.events || scanned.fightSeconds < saved.fightSeconds;
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
    #lastWriteFailed = false;
    #closed = false;
    #tempCounter = 0;
    /** @type {any} */
    #mainWindowRef = null;










    /**
     * Remembers where the file lives; nothing is read until the first request.
     *
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
            const recaps = await this.list();
            if ( !event.sender.isDestroyed() ) {
                event.sender.send( 'push-recaps:reply', { requestId: request?.requestId, data: recaps } );
            }
        } );

        ipcMain.on( 'push-recaps:get', async ( event, request ) => {
            const recap = await this.get( request?.id );
            if ( !event.sender.isDestroyed() ) {
                event.sender.send( 'push-recaps:reply', { requestId: request?.requestId, data: recap } );
            }
        } );

        ipcMain.on( 'push-recaps:save', async ( event, summary ) => {
            let ok = await this.save( summary );
            if ( ok ) {
                this.#notifyChanged();
                // save() returns before the file is written.  Wait for the write, so the window
                // never reports Saved for a recap that could not be written.
                await this.flush();
                ok = !this.#lastWriteFailed;
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
     * Returns the saved recaps without their players, procs and NPC abilities.
     *
     * @returns {Promise<Omit<PushRecapSummary, 'players' | 'npcAbilities'>[]>} The recaps.
     */
    async list() {
        if ( !await this.#load() ) {
            return [];
        }
        return this.#recaps.map( buildListRow );
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
        const summary = sanitize( data );
        if ( summary === null || summary === undefined ) {
            return false;
        }
        if ( !await this.#load() ) {
            return false;
        }
        const same = r => r.characterName === summary.characterName && r.mob === summary.mob && r.killTime === summary.killTime;
        const existing = this.#recaps.find( same );
        if ( existing !== null && existing !== undefined ) {
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
     * Replaces the saved recaps that match one of the given summaries by the summary,
     * keeping their id and save date.  Recaps that are not saved yet are not added.
     *
     * @returns {Promise<number>} The number of recaps that changed.
     *
     * @param {any[]} summaries The recap summaries.
     */
    async refresh( summaries ) {
        if ( !Array.isArray( summaries ) || !await this.#load() ) {
            return 0;
        }
        let count = 0;
        summaries.forEach( data => {
            const summary = sanitize( data );
            if ( summary === null || summary === undefined ) {
                return;
            }
            const index = this.#recaps.findIndex( r => {
                return r.characterName === summary.characterName && r.mob === summary.mob && r.killTime === summary.killTime;
            } );
            if ( index > -1 && !isWorseThanSaved( summary, this.#recaps[ index ] ) ) {
                summary.id = this.#recaps[ index ].id;
                summary.savedAt = this.#recaps[ index ].savedAt;
                if ( JSON.stringify( summary ) !== JSON.stringify( this.#recaps[ index ] ) ) {
                    this.#recaps[ index ] = summary;
                    count++;
                }
            }
        } );
        if ( count > 0 ) {
            this.#persist();
            this.#notifyChanged();
        }
        return count;
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
        const count = this.#recaps.length;
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
        // A write that failed left its change pending.  Try it again before waiting.
        if ( this.#dirty && !this.#closed && ( this.#writing === null || this.#writing === undefined ) ) {
            this.#persist();
        }
        while ( this.#writing !== null && this.#writing !== undefined ) {
            await this.#writing;
        }
    }










    /**
     * Tells the main window that the saved recaps changed.
     */
    #notifyChanged() {
        const win = this.#mainWindowRef?.reference;
        if ( win !== null && win !== undefined && !win.isDestroyed() ) {
            win.webContents.send( 'push-recaps:changed' );
        }
    }










    /**
     * Writes any pending change right away.  For use when the app quits.
     */
    flushSync() {
        const nothingToWrite = this.#recaps === null || this.#recaps === undefined
            || !( this.#dirty || ( this.#writing !== null && this.#writing !== undefined ) );
        if ( this.#closed || nothingToWrite ) {
            return;
        }
        this.#closed = true;
        this.#dirty = false;
        const tempPath = this.#nextTempPath();
        try {
            fs.mkdirSync( path.dirname( this.#path ), { recursive: true } );
            fs.writeFileSync( tempPath, JSON.stringify( { version: 1, recaps: this.#recaps } ) );
            fs.renameSync( tempPath, this.#path );
        } catch ( error ) {
            log.error( 'Could not save the push recaps.', error );
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
        if ( this.#recaps !== null && this.#recaps !== undefined ) {
            return Promise.resolve( true );
        }
        if ( this.#loading === null || this.#loading === undefined ) {
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

        if ( data !== null && data !== undefined && data.version === 1 && Array.isArray( data.recaps ) ) {
            this.#recaps = data.recaps.map( r => {
                const summary = sanitize( r );
                if ( summary !== null && summary !== undefined && typeof r.savedAt === 'string' && !isNaN( new Date( r.savedAt ).getTime() ) ) {
                    summary.savedAt = r.savedAt;
                }
                return summary;
            } ).filter( r => ( r !== null && r !== undefined ) ).slice( -maxRecaps );
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
        if ( this.#writing !== null && this.#writing !== undefined ) {
            return;
        }
        this.#writing = ( async () => {
            while ( this.#dirty && !this.#closed ) {
                this.#dirty = false;
                const tempPath = this.#nextTempPath();
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
                    // Synchronous, so a quit cannot slip in between the check above and the rename.
                    fs.renameSync( tempPath, this.#path );
                    this.#lastWriteFailed = false;
                } catch ( error ) {
                    log.error( 'Could not save the push recaps.', error );
                    // Keep the change pending, so the next change, flush or the quit flush writes
                    // it again.  Looping here would retry at once and spin on a locked file.
                    this.#dirty = true;
                    this.#lastWriteFailed = true;
                    await fsp.rm( tempPath, { force: true } ).catch( () => { } );
                    break;
                }
            }
            this.#writing = null;
        } )();
    }

}

module.exports = PushRecapStore;
