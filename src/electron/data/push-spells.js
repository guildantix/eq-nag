const crypto = require( 'crypto' );
const fs = require( 'fs' );
const path = require( 'path' );
const readline = require( 'readline' );
const log = require( 'electron-log' );

const legacyCacheFileName = 'push-spells.json';
const cacheVersion = 6;
const maxNoPushNames = 3;
// e.g. "Color Flux Rk. II" becomes "Color Flux".
const rankRgx = / Rk\. ?I+$/i;

/**
 * @typedef {Object} PushSpell
 * @property {number} push The pushback value.
 * @property {number} pushUp The push up value.
 * @property {number} castTime The cast time in milliseconds.
 * @property {string} landText The text that follows the target name when the spell lands, if any.
 * @property {boolean} [instantDamage] True when the spell has no duration and does direct damage,
 *     so it always logs a damage line naming its caster.
 * @property {string[]} [variantTexts] The landing texts of spells with no push that have the same
 *     name, when they differ from landText.
 */

/**
 * @typedef {Object} PushSpellTable
 * @property {Record<string, PushSpell>} spells Spells by name, ranks merged under the base name.
 * @property {Record<string, PushSpell>} exact Per-rank entries for the families whose ranks differ
 *     in push.
 * @property {Record<string, { names: string[], count: number }>} noPushTexts
 *     The landing texts that a push spell shares with a differently named spell that does not push,
 *     with the first names of those spells and how many there are.
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
 * Tells whether the given line of spells_us.txt is a spell with no duration that does direct
 * damage.
 *
 * @returns {boolean} True for an instant damage spell.
 *
 * @param {string} line The line.
 */
function isInstantDamage( line ) {
    const f = line.split( '^' );
    if ( f[ 11 ] !== '0' || f[ 12 ] !== '0' ) {
        return false;
    }
    return ( f[ 165 ] ?? '' ).split( '$' ).some( effect => {
        const e = effect.split( '|' );
        return ( e[ 1 ] === '0' || e[ 1 ] === '79' ) && +e[ 2 ] < 0;
    } );
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

    /**
     * @type {Record<string, { id: string, push: number, pushUp: number, castTime: number,
     *     instant: boolean }[]>}
     */
    const rowsByName = {};
    /** @type {Record<string, boolean>} */
    const pushIds = {};
    /** @type {Record<string, string>} */
    const otherNames = {};

    await streamLines( spellsFile, line => {
        const f = readFields( line, 9 );
        const push = parseFloat( f[ 6 ] );
        if ( !f[ 1 ] ) {
            return;
        }
        if ( !( push > 0 ) ) {
            otherNames[ f[ 0 ] ] = f[ 1 ];
            return;
        }
        pushIds[ f[ 0 ] ] = true;
        ( rowsByName[ f[ 1 ] ] ??= [] ).push( {
            id: f[ 0 ],
            push: push,
            pushUp: parseFloat( f[ 7 ] ) || 0,
            castTime: parseInt( f[ 8 ] ) || 0,
            instant: isInstantDamage( line ),
        } );
    } );

    /** @type {Record<string, string>} */
    const landTexts = {};
    /** @type {Map<string, Set<string>>} */
    const otherTexts = new Map();
    /** @type {Map<string, Set<string>>} */
    const sameNameTexts = new Map();
    const pushBases = new Set( Object.keys( rowsByName ).map( name => stripRank( name ) ) );
    if ( fs.existsSync( stringsFile ) ) {
        await streamLines( stringsFile, line => {
            const f = readFields( line, 5 );
            if ( f.length === 5 && f[ 4 ] ) {
                if ( pushIds[ f[ 0 ] ] ) {
                    landTexts[ f[ 0 ] ] = f[ 4 ];
                } else {
                    const base = stripRank( otherNames[ f[ 0 ] ] ?? '' );
                    if ( pushBases.has( base ) ) {
                        let texts = sameNameTexts.get( base );
                        if ( texts === null || texts === undefined ) {
                            texts = new Set();
                            sameNameTexts.set( base, texts );
                        }
                        texts.add( f[ 4 ] );
                    } else {
                        let names = otherTexts.get( f[ 4 ] );
                        if ( names === null || names === undefined ) {
                            names = new Set();
                            otherTexts.set( f[ 4 ], names );
                        }
                        if ( base !== '' ) {
                            names.add( base );
                        }
                    }
                }
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
        const landText = landId ? landTexts[ landId ] : '';
        byName[ name ] = { push: best.push, pushUp: best.pushUp, castTime: best.castTime, landText: landText };
        if ( best.instant ) {
            byName[ name ].instantDamage = true;
        }
        const variants = Array.from( sameNameTexts.get( stripRank( name ) ) ?? [] ).filter( text => text !== landText ).sort();
        if ( variants.length > 0 ) {
            byName[ name ].variantTexts = variants;
        }
    } );

    /** @type {Record<string, string[]>} */
    const families = {};
    Object.keys( byName ).forEach( name => ( families[ stripRank( name ) ] ??= [] ).push( name ) );

    /** @type {PushSpellTable} */
    const table = { spells: {}, exact: {}, noPushTexts: {} };
    Object.keys( families ).forEach( base => {
        const names = families[ base ];
        const best = names.map( n => byName[ n ] ).reduce( ( a, b ) => b.push > a.push ? b : a );
        table.spells[ base ] = best;
        if ( names.some( n => byName[ n ].push !== best.push ) ) {
            names.forEach( n => table.exact[ n ] = byName[ n ] );
        }
    } );

    const pushTexts = new Set( Object.keys( byName ).map( name => byName[ name ].landText ) );
    otherTexts.forEach( ( names, text ) => {
        if ( pushTexts.has( text ) ) {
            table.noPushTexts[ text ] = { names: Array.from( names ).sort().slice( 0, maxNoPushNames ), count: names.size };
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
 * Finds the folder that holds the spell data for a character.  The install that holds the
 * character's log wins, so a beta or test character reads its own spells and not the live ones;
 * the configured folder is the fallback for logs that live elsewhere.
 *
 * @returns {string | null} The folder that contains spells_us.txt, or null when there is none.
 *
 * @param {string} logFilePath The character's log file, e.g. "<install>\Logs\eqlog_Soandso.txt".
 * @param {string} configuredFolder The EverQuest folder from the Nag settings.
 */
function resolveSpellFolder( logFilePath, configuredFolder ) {
    const candidates = [];
    if ( logFilePath ) {
        candidates.push( path.dirname( path.dirname( logFilePath ) ) );
    }
    if ( configuredFolder ) {
        candidates.push( configuredFolder );
    }
    return candidates.find( folder => fs.existsSync( path.join( folder, 'spells_us.txt' ) ) ) ?? null;
}










/**
 * Loads the push spell table, from the cache when spells_us.txt has not changed.
 * Reading the 35 MB spell file happens only the first time, or after a patch.
 *
 * @returns {Promise<PushSpellTable>} The push spell table.
 *
 * @param {string} logFilePath The character's log file, used to find the install it belongs to.
 * @param {string} eqFolder The EverQuest folder from the Nag settings, used when the log's
 *     install has no spell data.
 * @param {string} cacheFolder The folder to keep the cache file in.
 */
async function loadPushSpells( logFilePath, eqFolder, cacheFolder ) {

    const resolvedFolder = resolveSpellFolder( logFilePath, eqFolder );
    if ( resolvedFolder === null ) {
        const folderExists = !!eqFolder && fs.existsSync( eqFolder );
        const error = new Error( "Nag couldn't find the EverQuest spell data (spells_us.txt) next to this character's log or in your EverQuest folder." );
        error.code = folderExists ? 'no-file' : 'no-folder';
        throw error;
    }

    const spellsFile = path.join( resolvedFolder, 'spells_us.txt' );
    const stat = fs.statSync( spellsFile );
    const stringsFile = path.join( resolvedFolder, 'spells_us_str.txt' );
    const stringsStat = fs.existsSync( stringsFile ) ? fs.statSync( stringsFile ) : null;
    const stringsMtimeMs = stringsStat?.mtimeMs ?? null;
    const stringsSize = stringsStat?.size ?? null;
    // One cache per install, so switching beta and live characters doesn't rebuild it.
    const installKey = crypto.createHash( 'sha1' ).update( spellsFile.toLowerCase() ).digest( 'hex' ).slice( 0, 12 );
    const cacheFile = path.join( cacheFolder, `push-spells-${installKey}.json` );

    try {
        const cached = JSON.parse( fs.readFileSync( cacheFile, 'utf8' ) );
        const sourceUnchanged = cached.version === cacheVersion
            && cached.sourcePath === spellsFile
            && cached.sourceMtimeMs === stat.mtimeMs && cached.sourceSize === stat.size
            && cached.stringsMtimeMs === stringsMtimeMs && cached.stringsSize === stringsSize;
        const tablesPresent = cached.spells !== null && cached.spells !== undefined && typeof cached.spells === 'object'
            && cached.exact !== null && cached.exact !== undefined && typeof cached.exact === 'object'
            && cached.noPushTexts !== null && cached.noPushTexts !== undefined && typeof cached.noPushTexts === 'object'
            && !Array.isArray( cached.noPushTexts );
        if ( sourceUnchanged && tablesPresent ) {
            return { spells: cached.spells, exact: cached.exact, noPushTexts: cached.noPushTexts };
        }
    } catch ( error ) {
        // No usable cache; rebuild below.
    }

    const table = await buildPushSpellTable( spellsFile, stringsFile );
    const spellCount = Object.keys( table.spells ).length;
    const instantCount = Object.values( table.spells ).filter( s => s.instantDamage === true ).length;
    if ( spellCount > 0 && instantCount === 0 ) {
        log.warn( `Push table built: ${spellCount} spells, 0 instant damage. The spell file format may have changed.` );
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
            exact: table.exact,
            noPushTexts: table.noPushTexts,
        } ) );
        fs.rmSync( path.join( cacheFolder, legacyCacheFileName ), { force: true } );
    } catch ( error ) {
        // The cache is optional.
    }

    return table;
}

module.exports = { loadPushSpells, resolveSpellFolder, buildPushSpellTable, findPushSpell, stripRank };
