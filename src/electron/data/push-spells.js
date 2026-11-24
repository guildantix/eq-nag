const crypto = require( 'crypto' );
const fs = require( 'fs' );
const path = require( 'path' );
const readline = require( 'readline' );

const legacyCacheFileName = 'push-spells.json';
const cacheVersion = 2;
// e.g. "Color Flux Rk. II" becomes "Color Flux".
const rankRgx = / Rk\. ?I+$/i;

/**
 * @typedef {Object} PushSpell
 * @property {number} push The pushback value.
 * @property {number} pushUp The push up value.
 * @property {number} castTime The cast time in milliseconds.
 * @property {string} landText The text that follows the target name when the spell lands, if any.
 */

/**
 * @typedef {Object} PushSpellTable
 * @property {Record<string, PushSpell>} spells Spells by name, ranks merged under the base name.
 * @property {Record<string, PushSpell>} exact Per-rank entries for the families whose ranks
 *     differ in push.
 */

/**
 * Returns the given spell name without its rank suffix.
 *
 * @returns {string} The base spell name.
 *
 * @param {string} name The spell name.
 */
function stripRank( name ) {
    return name.replace( rankRgx, '' );
}










/**
 * Reads the first n caret-delimited fields of the given line.
 *
 * @returns {string[]} The fields.
 *
 * @param {string} line The line.
 * @param {number} count How many fields to read.
 */
function readFields( line, count ) {
    const fields = [];
    let start = 0;
    for ( let i = 0; i < count; i++ ) {
        const end = line.indexOf( '^', start );
        if ( end === -1 ) {
            fields.push( line.substring( start ) );
            break;
        }
        fields.push( line.substring( start, end ) );
        start = end + 1;
    }
    return fields;
}










/**
 * Streams the given file line by line.
 *
 * @returns {Promise<void>}
 *
 * @param {string} filePath The file to read.
 * @param {( line: string ) => void} onLine Executed for every line.
 */
function streamLines( filePath, onLine ) {
    return new Promise( ( resolve, reject ) => {
        const stream = fs.createReadStream( filePath, { encoding: 'latin1' } );
        const rl = readline.createInterface( { input: stream, crlfDelay: Infinity } );
        stream.on( 'error', reject );
        rl.on( 'line', onLine );
        rl.on( 'close', resolve );
    } );
}










/**
 * Builds the push spell table from spells_us.txt and spells_us_str.txt.
 *
 * @returns {Promise<PushSpellTable>} The push spell table.
 *
 * @param {string} spellsFile The full path to spells_us.txt.
 * @param {string} stringsFile The full path to spells_us_str.txt.
 */
async function buildPushSpellTable( spellsFile, stringsFile ) {

    /** @type {Record<string, { id: string, push: number, pushUp: number, castTime: number }[]>} */
    const rowsByName = {};
    /** @type {Record<string, boolean>} */
    const pushIds = {};

    await streamLines( spellsFile, line => {
        const f = readFields( line, 9 );
        const push = parseFloat( f[ 6 ] );
        if ( !( push > 0 ) || !f[ 1 ] ) {
            return;
        }
        pushIds[ f[ 0 ] ] = true;
        ( rowsByName[ f[ 1 ] ] ??= [] ).push( {
            id: f[ 0 ], push: push, pushUp: parseFloat( f[ 7 ] ) || 0, castTime: parseInt( f[ 8 ] ) || 0
        } );
    } );

    /** @type {Record<string, string>} */
    const landTexts = {};
    if ( fs.existsSync( stringsFile ) ) {
        await streamLines( stringsFile, line => {
            const f = readFields( line, 5 );
            if ( f.length === 5 && f[ 4 ] && pushIds[ f[ 0 ] ] ) {
                landTexts[ f[ 0 ] ] = f[ 4 ];
            }
        } );
    }

    // Duplicate names keep the highest pushback.
    /** @type {Record<string, PushSpell>} */
    const byName = {};
    Object.keys( rowsByName ).forEach( name => {
        const rows = rowsByName[ name ];
        const best = rows.reduce( ( a, b ) => b.push > a.push ? b : a );
        const landId = landTexts[ best.id ] ? best.id : rows.find( r => landTexts[ r.id ] )?.id;
        byName[ name ] = { push: best.push, pushUp: best.pushUp, castTime: best.castTime, landText: landId ? landTexts[ landId ] : '' };
    } );

    /** @type {Record<string, string[]>} */
    const families = {};
    Object.keys( byName ).forEach( name => ( families[ stripRank( name ) ] ??= [] ).push( name ) );

    /** @type {PushSpellTable} */
    const table = { spells: {}, exact: {} };
    Object.keys( families ).forEach( base => {
        const names = families[ base ];
        const best = names.map( n => byName[ n ] ).reduce( ( a, b ) => b.push > a.push ? b : a );
        table.spells[ base ] = best;
        if ( names.some( n => byName[ n ].push !== best.push ) ) {
            names.forEach( n => table.exact[ n ] = byName[ n ] );
        }
    } );

    return table;
}










/**
 * Looks up the push spell with the given name.  Tries the exact name first, then the base name.
 *
 * @returns {PushSpell | undefined} The push spell, or undefined when the spell does not push.
 *
 * @param {PushSpellTable} table The push spell table.
 * @param {string} name The spell name as it appears in the log.
 */
function findPushSpell( table, name ) {
    return table.exact[ name ] ?? table.spells[ stripRank( name ) ];
}










/**
 * Lists the folders that hold spell data for a character, best candidate first.  The install that
 * holds the character's log wins, so a beta or test character reads its own spells and not the
 * live ones; the configured folder is the fallback for logs that live elsewhere.
 *
 * @returns {string[]} The folders that contain spells_us.txt.
 *
 * @param {string} logFilePath The character's log file, e.g. "<install>\Logs\eqlog_Soandso.txt".
 * @param {string} configuredFolder The EverQuest folder Nag found, if any.
 */
function listSpellFolders( logFilePath, configuredFolder ) {
    const candidates = [];
    if ( logFilePath ) {
        candidates.push( path.dirname( path.dirname( logFilePath ) ) );
    }
    if ( configuredFolder && !candidates.some( folder => folder.toLowerCase() === configuredFolder.toLowerCase() ) ) {
        candidates.push( configuredFolder );
    }
    return candidates.filter( folder => fs.existsSync( path.join( folder, 'spells_us.txt' ) ) );
}










/**
 * Tells whether the table holds at least one push spell.  A table without any means the file
 * is in a layout the parser does not understand, such as an older or emulator client.
 *
 * @returns {boolean} True when the table is usable.
 *
 * @param {PushSpellTable} table The push spell table.
 */
function hasPushSpells( table ) {
    return Object.keys( table.spells ).length > 0;
}










/**
 * Loads the push spell table of one install, from the cache when spells_us.txt has not changed.
 * Reading the 35 MB spell file happens only the first time, or after a patch.
 *
 * @returns {Promise<PushSpellTable>} The push spell table, possibly without any push spell.
 *
 * @param {string} spellFolder The install folder that contains spells_us.txt.
 * @param {string} cacheFolder The folder to keep the cache file in.
 */
async function loadFolderTable( spellFolder, cacheFolder ) {

    const spellsFile = path.join( spellFolder, 'spells_us.txt' );
    const stat = fs.statSync( spellsFile );
    const stringsFile = path.join( spellFolder, 'spells_us_str.txt' );
    const stringsStat = fs.existsSync( stringsFile ) ? fs.statSync( stringsFile ) : null;
    const stringsMtimeMs = stringsStat?.mtimeMs ?? null;
    const stringsSize = stringsStat?.size ?? null;
    // One cache per install, so switching beta and live characters doesn't rebuild it.
    const installKey = crypto.createHash( 'sha1' ).update( spellsFile.toLowerCase() ).digest( 'hex' ).slice( 0, 12 );
    const cacheFile = path.join( cacheFolder, `push-spells-${installKey}.json` );

    try {
        const cached = JSON.parse( fs.readFileSync( cacheFile, 'utf8' ) );
        // Windows paths differ in case between the log's location and the settings.
        const sourceUnchanged = cached.version === cacheVersion
            && typeof cached.sourcePath === 'string' && cached.sourcePath.toLowerCase() === spellsFile.toLowerCase()
            && cached.sourceMtimeMs === stat.mtimeMs && cached.sourceSize === stat.size
            && cached.stringsMtimeMs === stringsMtimeMs && cached.stringsSize === stringsSize;
        const tablesPresent = cached.spells !== null && cached.spells !== undefined && typeof cached.spells === 'object'
            && cached.exact !== null && cached.exact !== undefined && typeof cached.exact === 'object';
        if ( sourceUnchanged && tablesPresent ) {
            return { spells: cached.spells, exact: cached.exact };
        }
    } catch ( error ) {
        // No usable cache; rebuild below.
    }

    const table = await buildPushSpellTable( spellsFile, stringsFile );

    // A table without push spells is never cached, so a parser fix takes effect without a patch.
    if ( !hasPushSpells( table ) ) {
        return table;
    }

    try {
        fs.writeFileSync( cacheFile, JSON.stringify( {
            version: cacheVersion,
            sourcePath: spellsFile,
            sourceMtimeMs: stat.mtimeMs,
            sourceSize: stat.size,
            stringsMtimeMs: stringsMtimeMs,
            stringsSize: stringsSize,
            spells: table.spells,
            exact: table.exact
        } ) );
        fs.rmSync( path.join( cacheFolder, legacyCacheFileName ), { force: true } );
    } catch ( error ) {
        // The cache is optional.
    }

    return table;
}










/**
 * Loads the push spell table for a character.  A candidate install whose spell file yields no
 * push spells is skipped, so the next candidate gets its turn.
 *
 * @returns {Promise<PushSpellTable>} The push spell table.
 *
 * @param {string} logFilePath The character's log file, used to find the install it belongs to.
 * @param {string} eqFolder The EverQuest folder Nag found, used when the log's install has no
 *     usable spell data.
 * @param {string} cacheFolder The folder to keep the cache file in.
 */
async function loadPushSpells( logFilePath, eqFolder, cacheFolder ) {

    const spellFolders = listSpellFolders( logFilePath, eqFolder );
    if ( spellFolders.length === 0 ) {
        const folderExists = !!eqFolder && fs.existsSync( eqFolder );
        const error = new Error( "Nag couldn't find the EverQuest spell data (spells_us.txt) next to this character's log or in the EverQuest folder it found." );
        error.code = folderExists ? 'no-file' : 'no-folder';
        throw error;
    }

    for ( const spellFolder of spellFolders ) {
        const table = await loadFolderTable( spellFolder, cacheFolder );
        if ( hasPushSpells( table ) ) {
            return table;
        }
    }

    const error = new Error( "Nag couldn't read the spell data (spells_us.txt) in this EverQuest install. It may be an older or emulator client, whose spell file format Push Recap doesn't support." );
    error.code = 'no-push-spells';
    throw error;
}










module.exports = { loadPushSpells, listSpellFolders, buildPushSpellTable, findPushSpell, stripRank };
