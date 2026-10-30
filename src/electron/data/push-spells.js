const fs = require( 'fs' );
const path = require( 'path' );
const readline = require( 'readline' );

const cacheFileName = 'push-spells.json';
const cacheVersion = 2;
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
 * @property {Record<string, PushSpell>} exact Per-rank entries for the families whose ranks differ in push.
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
    let fields = [];
    let start = 0;
    for ( let i = 0; i < count; i++ ) {
        let end = line.indexOf( '^', start );
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
        let stream = fs.createReadStream( filePath, { encoding: 'latin1' } );
        let rl = readline.createInterface( { input: stream, crlfDelay: Infinity } );
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
    let rowsByName = {};
    /** @type {Record<string, boolean>} */
    let pushIds = {};

    await streamLines( spellsFile, line => {
        let f = readFields( line, 9 );
        let push = parseFloat( f[ 6 ] );
        if ( !( push > 0 ) || !f[ 1 ] ) {
            return;
        }
        pushIds[ f[ 0 ] ] = true;
        ( rowsByName[ f[ 1 ] ] ??= [] ).push( { id: f[ 0 ], push: push, pushUp: parseFloat( f[ 7 ] ) || 0, castTime: parseInt( f[ 8 ] ) || 0 } );
    } );

    /** @type {Record<string, string>} */
    let landTexts = {};
    if ( fs.existsSync( stringsFile ) ) {
        await streamLines( stringsFile, line => {
            let f = readFields( line, 5 );
            if ( f.length === 5 && f[ 4 ] && pushIds[ f[ 0 ] ] ) {
                landTexts[ f[ 0 ] ] = f[ 4 ];
            }
        } );
    }

    // Duplicate names keep the highest pushback.
    /** @type {Record<string, PushSpell>} */
    let byName = {};
    Object.keys( rowsByName ).forEach( name => {
        let rows = rowsByName[ name ];
        let best = rows.reduce( ( a, b ) => b.push > a.push ? b : a );
        let landId = landTexts[ best.id ] ? best.id : rows.find( r => landTexts[ r.id ] )?.id;
        byName[ name ] = { push: best.push, pushUp: best.pushUp, castTime: best.castTime, landText: landId ? landTexts[ landId ] : '' };
    } );

    /** @type {Record<string, string[]>} */
    let families = {};
    Object.keys( byName ).forEach( name => ( families[ stripRank( name ) ] ??= [] ).push( name ) );

    /** @type {PushSpellTable} */
    let table = { spells: {}, exact: {} };
    Object.keys( families ).forEach( base => {
        let names = families[ base ];
        let best = names.map( n => byName[ n ] ).reduce( ( a, b ) => b.push > a.push ? b : a );
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
 * Loads the push spell table, from the cache when spells_us.txt has not changed.
 * Reading the 35 MB spell file happens only the first time, or after a patch.
 *
 * @returns {Promise<PushSpellTable>} The push spell table.
 *
 * @param {string} eqFolder The EverQuest installation folder.
 * @param {string} cacheFolder The folder to keep the cache file in.
 */
async function loadPushSpells( eqFolder, cacheFolder ) {

    if ( !eqFolder || !fs.existsSync( eqFolder ) ) {
        let error = new Error( 'The EverQuest folder is not set.  Set the EverQuest folder in Nag Settings so the spell data can be read.' );
        error.code = 'no-folder';
        throw error;
    }

    let spellsFile = path.join( eqFolder, 'spells_us.txt' );
    if ( !fs.existsSync( spellsFile ) ) {
        let error = new Error( 'spells_us.txt was not found in the EverQuest folder.  Check that the EverQuest folder is set correctly in Nag Settings.' );
        error.code = 'no-file';
        throw error;
    }

    let stat = fs.statSync( spellsFile );
    let stringsFile = path.join( eqFolder, 'spells_us_str.txt' );
    let stringsStat = fs.existsSync( stringsFile ) ? fs.statSync( stringsFile ) : null;
    let stringsMtimeMs = stringsStat?.mtimeMs ?? null;
    let stringsSize = stringsStat?.size ?? null;
    let cacheFile = path.join( cacheFolder, cacheFileName );

    try {
        let cached = JSON.parse( fs.readFileSync( cacheFile, 'utf8' ) );
        if ( cached.version === cacheVersion && cached.sourceMtimeMs === stat.mtimeMs && cached.sourceSize === stat.size && cached.stringsMtimeMs === stringsMtimeMs && cached.stringsSize === stringsSize && cached.spells != null && typeof cached.spells === 'object' && cached.exact != null && typeof cached.exact === 'object' ) {
            return { spells: cached.spells, exact: cached.exact };
        }
    } catch ( error ) {
        // No usable cache; rebuild below.
    }

    let table = await buildPushSpellTable( spellsFile, stringsFile );

    try {
        fs.writeFileSync( cacheFile, JSON.stringify( { version: cacheVersion, sourceMtimeMs: stat.mtimeMs, sourceSize: stat.size, stringsMtimeMs: stringsMtimeMs, stringsSize: stringsSize, spells: table.spells, exact: table.exact } ) );
    } catch ( error ) {
        // The cache is optional.
    }

    return table;
}

module.exports = { loadPushSpells, buildPushSpellTable, findPushSpell, stripRank };
