// Checks the trigger prefilter (src/electron/utilities/trigger-prefilter.js):
// a phrase that matches a log line must always be a candidate for it.
//
//   node tools/perf/prefilter-check.mjs
//       Unit cases and a small synthetic library and log.
//
//   node tools/perf/prefilter-check.mjs --triggers <trigger-database.json copy> --log <log copy>
//       Also runs every phrase of a real library on every line of a real log.
//       Use copies; only counts are printed, never phrases or log lines.

import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const require = createRequire( import.meta.url );
const root = path.resolve( path.dirname( fileURLToPath( import.meta.url ) ), '..', '..' );
const StringUtilities = require( path.join( root, 'src/electron/utilities/string.js' ) );
const Prefilter = require( path.join( root, 'src/electron/utilities/trigger-prefilter.js' ) );

const characterName = 'Soandso';
const timestampRegex = /^\[(.*?)\]\s*/i;

let failures = 0;
let checks = 0;

/**
 * Counts one check and prints a line if it failed.
 *
 * @param {boolean} condition Whether the check passed.
 * @param {string} label What the check was about, shown on failure.
 */
function check( condition, label ) {
    checks++;
    if ( !condition ) {
        failures++;
        console.log( `FAIL: ${label}` );
    }
}










/**
 * Tells whether two values are equal when written as JSON.
 *
 * @param {any} first The first value.
 * @param {any} second The second value.
 * @returns {boolean}
 */
function same( first, second ) {
    return JSON.stringify( first ) === JSON.stringify( second );
}

// ---- Unit cases: literal extraction ----

const regexCases = [
    [ 'caret and plain text', '^Soandso begins to cast', [ 'soandso begins t' ] ],
    [ 'alternation', 'ooze|slime', [ 'ooze', 'slime' ] ],
    [ 'alternation with a short branch', 'ab|cdef', null ],
    [ 'empty branch', 'abcd|', null ],
    [ 'optional char', 'colou?rs here', [ 'rs here' ] ],
    [ 'optional char first', 'a?bcd', [ 'bcd' ] ],
    [ 'star char', 'abcd*efgh', [ 'efgh' ] ],
    [ 'plus char', 'abc+d', [ 'abc' ] ],
    [ 'lazy quantifier', 'abcd+?xy', [ 'abcd' ] ],
    [ 'zero-or-more braces', 'abc{0,2}', null ],
    [ 'zero braces', 'abcd{0}', [ 'abc' ] ],
    [ 'optional group', 'ab(c)?defg', [ 'defg' ] ],
    [ 'escaped punctuation', 'Hit\\.\\d+ now', [ 'hit.' ] ],
    [ 'escaped pipe', 'a\\|bcd', [ 'a|bcd' ] ],
    [ 'escape classes break runs', 'foo\\sbar\\bbaz!', [ 'baz!' ] ],
    [ 'character class', '[Gg]rats everyone', [ 'rats everyone' ] ],
    [ 'class with bracket and pipe', '[\\]|]abcd', [ 'abcd' ] ],
    [ 'group is skipped', '(foo|bar) baz qux', [ ' baz qux' ] ],
    [ 'nested group', '((a|b)c)defg', [ 'defg' ] ],
    [ 'lookahead is skipped', 'foo(?=bar)baz', [ 'foo' ] ],
    [ 'named group', '(?<who>\\w+) hits you', [ ' hits you' ] ],
    [ 'S shortcode', '{S} tells you, \'', [ ' tells you, \'' ] ],
    [ 'S shortcode with number', '{S1}foo{S2}', [ 'foo' ] ],
    [ 'C shortcode', '{C} is here', [ ' is here' ] ],
    [ 'N shortcode', '{N1}/{N2} points', [ ' points' ] ],
    [ 'N conditional', 'You hit for {N>5} damage', [ 'you hit for ' ] ],
    [ 'N range conditional', '{N(1,5)} stacks', [ ' stacks' ] ],
    [ 'TS shortcode', 'Left {TS} remaining', [ ' remaining' ] ],
    [ 'L shortcode', '{L1} joined', [ ' joined' ] ],
    [ 'variable', 'Your ${SpellBeingCast} spell', [ ' spell' ] ],
    [ 'unclosed brace is literal', 'foo{bar', [ 'foo' ] ],
    [ 'non-ASCII breaks runs', 'café open', [ ' open' ] ],
    [ 'non-ASCII leaves too little', 'naïve', null ],
    [ 'case is lowered', 'Ooze Mound', [ 'ooze mound' ] ],
    [ 'truncated to 16', 'abcdefghijklmnopqrstuvwxyz', [ 'abcdefghijklmnop' ] ],
    [ 'longest wins', 'ab.cdef.ghi', [ 'cdef' ] ],
    [ 'numeric quantifier keeps the char', 'abc{2}de', [ 'abc' ] ],
    [ 'numeric range quantifier', 'abc{0,3}defg', [ 'defg' ] ],
    [ 'too short', 'ab', null ],
    [ 'empty', '', null ],
    [ 'unclosed group', '(unclosed', null ],
    [ 'unmatched close', 'foo)', null ],
    [ 'unclosed class', '[abc', null ],
    [ 'nothing to repeat', '*bad', null ],
    [ 'double quantifier', 'a**b', null ],
    [ 'trailing backslash', 'abc\\', null ],
    [ 'named backreference', '^(?<who>\\w+) heals \\k<who> for', [ ' heals ' ] ],
    [ 'named backreference arguments are not literal', '(?<who>x)\\k<who>', null ],
    [ 'hex escape', 'abc\\x27def', [ 'abc' ] ],
    [ 'hex escape arguments are not literal', 'ab\\x27cd', null ],
    [ 'unicode escape', 'abc\\u0041de', [ 'abc' ] ],
    [ 'unicode escape arguments are not literal', 'ab\\u0041cd', null ],
    [ 'unicode brace escape', 'ab\\u{41}defg', [ 'defg' ] ],
    [ 'control escape', 'abc\\cJde', [ 'abc' ] ],
    [ 'control escape argument is not literal', 'ab\\cJ', null ],
    [ 'property escape', 'ab\\p{L}cdef', [ 'cdef' ] ],
    [ 'negated property escape', 'ab\\P{Lu}cdef', [ 'cdef' ] ],
    [ 'numeric backreference', 'ab\\1cdef', [ 'cdef' ] ],
    [ 'multi digit backreference', 'ab\\12cdef', [ 'cdef' ] ],
    [ 'octal escape', 'ab\\0cdef', [ 'cdef' ] ],
    [ 'incomplete hex escape', 'abc\\x', null ],
    [ 'unclosed property escape', 'abc\\p{L', null ],
    [ 'brace group with alternation', 'abc{foo|bar}def', null ],
    [ 'brace group that is not a shortcode', 'abc{ foo }def', null ],
    [ 'brace group without digits before the comma', 'abcd{,3}', null ],
    [ 'quantifier keeps one required char', 'abcd{2,3}ef', [ 'abcd' ] ],
    [ 'zero lower bound drops the char', 'ab{0,3}cdef', [ 'cdef' ] ],
    [ 'open ended zero bound drops the char', 'ab{0,}cdef', [ 'cdef' ] ],
];

regexCases.forEach( ( [ label, source, expected ] ) => {
    const result = Prefilter.extractRegexLiterals( source );
    check( same( result, expected ), `regex literals: ${label}` );
} );

const plainCases = [
    [ 'plain text', 'Hello World', 'hello world' ],
    [ 'short phrase', 'ab', 'ab' ],
    [ 'truncated', 'abcdefghijklmnopqrstuvwxyz', 'abcdefghijklmnop' ],
    [ 'non-ASCII', 'Café', 'café' ],
    [ 'variable', 'Your ${SpellBeingCast} spell', null ],
    [ 'empty', '', null ],
];

plainCases.forEach( ( [ label, phrase, expected ] ) => {
    check( Prefilter.extractPlainLiteral( phrase ) === expected, `plain literal: ${label}` );
} );

// ---- Unit cases: automaton against a plain search ----

{
    const literals = [ 'he', 'she', 'his', 'hers', 'soandso hit', 'soandso', 'abcabcabc', 'bca', 'éa' ];
    const automaton = Prefilter.build( literals.map( ( literal, key ) => ( { literal, key } ) ) );
    const marks = new Int32Array( literals.length );
    let seed = 12345;
    const random = () => ( seed = ( seed * 1103515245 + 12345 ) & 0x7fffffff ) / 0x7fffffff;
    const alphabet = 'hesisoandabc é';
    let stamp = 0;
    let mismatches = 0;

    for ( let n = 0; n < 5000; n++ ) {
        let line = '';
        const length = Math.floor( random() * 40 );
        for ( let i = 0; i < length; i++ ) {
            line += alphabet[ Math.floor( random() * alphabet.length ) ];
        }
        stamp++;
        automaton.candidates( line, marks, stamp );
        literals.forEach( ( literal, key ) => {
            if ( ( marks[ key ] === stamp ) !== line.includes( literal ) ) {
                mismatches++;
            }
        } );
    }
    check( mismatches === 0, `automaton agrees with includes (${mismatches} mismatches)` );

    const empty = Prefilter.build( [] );
    empty.candidates( 'anything', marks, 99 );
    check( true, 'empty automaton runs' );
}

// ---- Compiling phrases the way the app does ----

/**
 * Expands the Nag shortcodes of a regex phrase into plain regex source, so the
 * check matches lines with the same regex the app compiles.
 *
 * @param {string} source The phrase, as the user wrote it.
 * @returns {string}
 */
function expandShortcodes( source ) {
    let value = source;
    value = StringUtilities.parseNConditionalCodesToRegex( value, characterName )?.value ?? value;
    value = StringUtilities.parseShortCodesToRegex( value, characterName );
    value = StringUtilities.parseStoredVariablesToRegexConditional( value, {} ).value;
    value = StringUtilities.parseListCodesToRegexConditionals( value ).value;
    value = StringUtilities.parseSequentialGroupsToRegexConditionals( value ).value;
    return value;
}










/**
 * Returns a function that tells whether the phrase matches a (not lowered)
 * line, or null if it can't be compiled.
 *
 * @param {{phrase: string, useRegEx?: boolean, ignoreCase?: boolean}} phrase The phrase.
 * @returns {((line: string) => boolean)|null}
 */
function compilePhrase( phrase ) {
    if ( !phrase.phrase || typeof phrase.phrase !== 'string' ) {
        return null;
    }

    if ( !phrase.useRegEx ) {
        if ( phrase.phrase.includes( '${' ) ) {
            return null;
        }
        const lower = phrase.phrase.toLowerCase();
        return line => line.toLowerCase().indexOf( lower ) > -1;
    }

    try {
        const regex = new RegExp( expandShortcodes( phrase.phrase ), phrase.ignoreCase ? 'i' : undefined );
        return line => regex.exec( line ) !== null;
    } catch {
        return null;
    }
}










/**
 * Runs every phrase on every line and checks that each match was a candidate.
 * Returns counts only, so a real library or log is never echoed.
 *
 * @param {{phrase: string, useRegEx?: boolean, ignoreCase?: boolean}[]} phrases The phrases.
 * @param {string[]} lines The log lines, without timestamps.
 * @returns {Record<string, number>}
 */
function runLibrary( phrases, lines ) {
    const entries = [];
    const matchers = [];
    let withLiteral = 0;
    let alwaysRun = 0;
    let uncompilable = 0;

    phrases.forEach( ( phrase, key ) => {
        const matcher = compilePhrase( phrase );
        matchers.push( matcher );
        if ( !matcher ) {
            uncompilable++;
            return;
        }

        let found = null;
        if ( phrase.useRegEx ) {
            found = Prefilter.extractRegexLiterals( phrase.phrase );
        } else if ( !/{L([0-9]*?)}/i.test( phrase.phrase ) ) {
            const literal = Prefilter.extractPlainLiteral( phrase.phrase );
            found = literal ? [ literal ] : null;
        }

        if ( found ) {
            withLiteral++;
            found.forEach( literal => entries.push( { literal, key } ) );
        } else {
            alwaysRun++;
        }
    } );

    const automaton = Prefilter.build( entries );
    const marks = new Int32Array( phrases.length );
    const hasLiteral = new Set( entries.map( e => e.key ) );
    let stamp = 0;
    let candidates = 0;
    let matches = 0;
    let misses = 0;

    lines.forEach( line => {
        stamp++;
        automaton.candidates( line.toLowerCase(), marks, stamp );

        for ( let key = 0; key < phrases.length; key++ ) {
            if ( hasLiteral.has( key ) && marks[ key ] === stamp ) {
                candidates++;
            }

            if ( matchers[ key ] && matchers[ key ]( line ) ) {
                matches++;
                if ( hasLiteral.has( key ) && marks[ key ] !== stamp ) {
                    misses++;
                }
            }
        }
    } );

    return {
        lines: lines.length,
        phrases: phrases.length,
        withLiteral,
        alwaysRun,
        uncompilable,
        candidates,
        matches,
        misses,
        nodes: automaton.nodeCount,
    };
}










/**
 * Prints the counts of one run.
 *
 * @param {string} title The name of the run.
 * @param {Record<string, number>} result The counts from runLibrary.
 */
function report( title, result ) {
    const possible = result.lines * result.withLiteral;
    const rate = possible > 0 ? ( 100 * result.candidates / possible ).toFixed( 2 ) : '0';
    console.log( `${title}: ${result.lines} lines, ${result.phrases} phrases, ${result.withLiteral} with a literal ` +
        `(${( 100 * result.withLiteral / Math.max( 1, result.phrases ) ).toFixed( 1 )}%), ${result.alwaysRun} always run, ` +
        `${result.uncompilable} not compiled, ${result.matches} matches, candidate rate ${rate}%, ${result.misses} misses, ${result.nodes} automaton nodes` );
}

// ---- Synthetic library and log ----

const syntheticPhrases = [
    { phrase: 'You have been slain by', useRegEx: false },
    { phrase: 'Soandso tells the guild', useRegEx: false },
    { phrase: 'ooze', useRegEx: false },
    { phrase: '^{S} tells you, \'(?<msg>.+)\'$', useRegEx: true },
    { phrase: '^(?<name>\\w+) hits (YOU|you) for {N>5} points of damage\\.', useRegEx: true },
    { phrase: 'You begin casting (?<spell>.+?)\\.$', useRegEx: true, ignoreCase: true },
    { phrase: '^Your (?<spell>.+?) spell has worn off( of (?<target>.+?))?\\.$', useRegEx: true },
    { phrase: 'Mez|mesmerize|enthrall', useRegEx: true },
    { phrase: '^{C} (feels|looks) better', useRegEx: true },
    { phrase: 'colou?r of the (north|south) wind', useRegEx: true },
    { phrase: 'Timer: {TS}', useRegEx: true },
    { phrase: '(.+) is no longer stunned', useRegEx: true },
    { phrase: 'Soandso is on cooldown {N1}/{N2}', useRegEx: true, ignoreCase: true },
    { phrase: '[Ww]elcome to (the )?Crystal Caverns', useRegEx: true },
    { phrase: 'a\\.b\\+c', useRegEx: true },
    { phrase: 'finé wine', useRegEx: true },
    { phrase: 'Dragon', useRegEx: false },
    { phrase: '(unclosed', useRegEx: true },
    { phrase: '', useRegEx: false },
    { phrase: 'ab', useRegEx: true },
    { phrase: 'Your ${SpellBeingCast} spell is interrupted.', useRegEx: false },
];

const syntheticLines = [
    'Soandso tells the guild, \'hello there\'',
    'Otherguy tells you, \'hi\'',
    'You have been slain by a gooey ooze!',
    'A gooey ooze hits YOU for 12 points of damage.',
    'A gooey ooze hits you for 3 points of damage.',
    'You begin casting Soothing Light.',
    'YOU BEGIN CASTING SOOTHING LIGHT.',
    'Your Soothing Light spell has worn off of Friendo.',
    'Your Soothing Light spell has worn off.',
    'The mez breaks and you MEZ again, to mesmerize and Enthrall.',
    'Soandso feels better',
    'Soandso looks better',
    'The colour of the north wind and the color of the south wind',
    'Timer: 5 minutes',
    'Gobbo is no longer stunned',
    'SOANDSO IS ON COOLDOWN 3/4',
    'Welcome to Crystal Caverns',
    'welcome to the Crystal Caverns',
    'xa.b+cx',
    'A finé wine was served',
    'A Dragon appears!',
    'Nothing relevant happens here.',
    'ab',
    '',
];

report( 'synthetic', ( () => {
    const result = runLibrary( syntheticPhrases, syntheticLines );
    check( result.misses === 0, `synthetic library: ${result.misses} misses` );
    check( result.matches > 20, `synthetic library: ${result.matches} matches seen` );
    check( result.candidates < result.lines * result.withLiteral, 'synthetic library: filters out some lines' );
    return result;
} )() );

// ---- Fuzz: random regex phrases against lines they match ----

/**
 * Builds random regex phrases together with a line each one matches, and
 * reports any whose literals are missing from a matching line (a prefilter
 * miss).  The seed makes a failure repeatable.
 *
 * @param {number} seed The random seed.
 * @param {number} patternCount How many phrases to generate.
 * @returns {object} The counts, and any false negatives found.
 */
function fuzzExtractor( seed, patternCount ) {
    let state = seed >>> 0;
    const random = () => {
        state = ( state + 0x6D2B79F5 ) >>> 0;
        let t = state;
        t = Math.imul( t ^ ( t >>> 15 ), t | 1 );
        t ^= t + Math.imul( t ^ ( t >>> 7 ), t | 61 );
        return ( ( t ^ ( t >>> 14 ) ) >>> 0 ) / 4294967296;
    };
    const int = ( min, max ) => min + Math.floor( random() * ( max - min + 1 ) );
    const pick = list => list[ Math.floor( random() * list.length ) ];
    const chance = p => random() < p;

    const letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGH';
    const punctuation = ' ,\'-:;!@#%&=<>/"_~';
    const nonAscii = [ 'é', 'ñ', 'ß', 'Σ', 'İ', '日' ];
    const metaCharacters = '.+*?^$()[]{}|\\';
    const escapeLiteral = c => ( metaCharacters.includes( c ) ? '\\' + c : c );

    const literalChar = () => {
        const r = random();
        return r < 0.7 ? pick( letters ) : r < 0.85 ? pick( punctuation ) : r < 0.93 ? pick( nonAscii ) : pick( metaCharacters );
    };

    // Each node is { source, make } where make() returns a string the source matches.
    const literalRun = () => {
        const text = Array.from( { length: int( 3, 9 ) }, () => literalChar() ).join( '' );
        return { source: Array.from( text ).map( escapeLiteral ).join( '' ), make: () => text };
    };

    const singleChar = () => {
        const c = literalChar();
        return { source: escapeLiteral( c ), make: () => c };
    };

    const escapes = [
        [ '\\d', () => String( int( 0, 9 ) ) ],
        [ '\\w', () => pick( [ 'x', 'Q', '7', '_' ] ) ],
        [ '\\s', () => ' ' ],
        [ '\\b', () => '' ],
        [ '\\.', () => '.' ],
        [ '\\D', () => 'k' ],
        [ '\\W', () => '-' ],
        [ '\\S', () => 'z' ],
        [ '\\x27', () => '\'' ],
        [ '\\u0041', () => 'A' ],
        [ '\\u{41}', () => 'u'.repeat( 41 ) ],
        [ '\\cJ', () => '\n' ],
        [ '\\p{L}', () => 'p{L}' ],
        [ '\\0', () => '\0' ],
    ];
    const escapeNode = () => {
        const [ source, make ] = pick( escapes );
        return { source, make };
    };

    const classes = [
        [ '[abc]', () => pick( [ 'a', 'b', 'c' ] ) ],
        [ '[a-f]', () => pick( [ 'a', 'c', 'f' ] ) ],
        [ '[Gg]', () => pick( [ 'G', 'g' ] ) ],
        [ '[^x]', () => 'q' ],
        [ '[\\d.]', () => pick( [ '4', '.' ] ) ],
        [ '[|\\]]', () => pick( [ '|', ']' ] ) ],
        [ '[\\w ]', () => pick( [ 'w', ' ' ] ) ],
    ];
    const classNode = () => {
        const [ source, make ] = pick( classes );
        return { source, make };
    };

    const shortcodes = [
        [ '{S}', () => pick( [ 'Bob', 'Soandso', 'a b' ] ) ],
        [ '{S1}', () => 'Gob' ],
        [ '{N}', () => String( int( 0, 99 ) ) ],
        [ '{N1}', () => String( int( 0, 99 ) ) ],
        [ '{C}', () => characterName ],
        [ '{TS}', () => pick( [ '12:30', '5', '1:02:03' ] ) ],
        [ '{L}', () => 'item' ],
        [ '{L1}', () => 'item' ],
        [ '{N>5}', () => String( int( 6, 99 ) ) ],
        [ '{N<5}', () => String( int( 0, 4 ) ) ],
        [ '{N(1,5)}', () => String( int( 1, 5 ) ) ],
    ];
    const shortcodeNode = () => {
        const [ source, make ] = pick( shortcodes );
        return { source, make };
    };

    const quantifiers = [
        [ '?', () => int( 0, 1 ) ],
        [ '*', () => int( 0, 2 ) ],
        [ '+', () => int( 1, 3 ) ],
        [ '{2}', () => 2 ],
        [ '{0,2}', () => int( 0, 2 ) ],
        [ '{1,3}', () => int( 1, 3 ) ],
        [ '{0}', () => 0 ],
        [ '{0,}', () => int( 0, 2 ) ],
        [ '{2,}', () => int( 2, 3 ) ],
    ];
    // Groups only get bounded quantifiers, so nested repeats can't backtrack catastrophically.
    const boundedQuantifiers = quantifiers.filter( q => !'*+'.includes( q[ 0 ] ) && !q[ 0 ].endsWith( ',}' ) );
    const quantify = ( node, bounded ) => {
        const [ suffix, count ] = pick( bounded ? boundedQuantifiers : quantifiers );
        const lazy = chance( 0.2 ) ? '?' : '';
        return { source: node.source + suffix + lazy, make: () => Array.from( { length: count() }, () => node.make() ).join( '' ) };
    };

    // A named group followed by a reference to it.  Names are unique per phrase.
    let referenceCount = 0;
    const backreferencePair = () => {
        const name = 'ref' + ( referenceCount++ );
        const word = Array.from( { length: int( 1, 4 ) }, () => pick( letters ) ).join( '' );
        const separator = Array.from( { length: int( 2, 6 ) }, () => pick( letters + ' ' ) ).join( '' );
        return {
            source: '(?<' + name + '>' + word + ')' + escapeLiteral( separator ) + '\\k<' + name + '>',
            make: () => word + separator + word,
        };
    };

    const alternation = ( depth, allowEmptyBranch ) => {
        const branches = Array.from( { length: int( 1, 3 ) }, () => sequence( depth, allowEmptyBranch ) );
        return { source: branches.map( b => b.source ).join( '|' ), make: () => pick( branches ).make() };
    };

    const group = depth => {
        const inner = alternation( depth + 1, true );
        const r = random();
        const open = r < 0.4 ? '(' : r < 0.65 ? '(?:' : r < 0.85 ? '(?<name' + int( 1, 99 ) + '>' : '(?=';
        return { source: open + inner.source + ')', make: () => ( open === '(?=' ? '' : inner.make() ) };
    };

    const atom = depth => {
        const r = random();
        if ( r < 0.42 ) {
            return literalRun();
        }
        if ( r < 0.50 ) {
            return chance( 0.6 ) ? quantify( singleChar() ) : singleChar();
        }
        if ( r < 0.60 ) {
            return chance( 0.4 ) ? quantify( escapeNode() ) : escapeNode();
        }
        if ( r < 0.68 ) {
            return chance( 0.4 ) ? quantify( classNode() ) : classNode();
        }
        if ( r < 0.78 ) {
            return shortcodeNode();
        }
        if ( r < 0.82 ) {
            return backreferencePair();
        }
        if ( depth < 2 ) {
            const g = group( depth );
            return chance( 0.4 ) ? quantify( g, true ) : g;
        }
        return literalRun();
    };

    const sequence = ( depth, allowEmpty ) => {
        const parts = [];
        const length = allowEmpty && chance( 0.1 ) ? 0 : int( 1, 5 );
        for ( let i = 0; i < length; i++ ) {
            parts.push( atom( depth ) );
        }
        return { source: parts.map( p => p.source ).join( '' ), make: () => parts.map( p => p.make() ).join( '' ) };
    };

    // Anchors go on every top-level branch; the generated instance is the same.
    const pattern = () => {
        if ( chance( 0.06 ) ) {
            // Without the u flag a brace group is plain text, so the pipe inside it
            // splits the whole phrase: the two sides are "before{foo" and "bar}after".
            const before = literalRun();
            const after = literalRun();
            return {
                source: before.source + '{foo|bar}' + after.source,
                make: () => ( chance( 0.5 ) ? before.make() + '{foo' : 'bar}' + after.make() ),
            };
        }

        const branches = Array.from( { length: int( 1, 3 ) }, () => sequence( 0, true ) );
        const start = chance( 0.3 ) ? '^' : '';
        const end = chance( 0.2 ) ? '$' : '';
        return {
            source: branches.map( b => start + b.source + end ).join( '|' ),
            make: () => pick( branches ).make(),
        };
    };

    const randomText = () => Array.from( { length: int( 0, 6 ) }, () => pick( letters + punctuation ) ).join( '' );

    let patterns = 0;
    let compiled = 0;
    let filtered = 0;
    let lines = 0;
    let matched = 0;
    const falseNegatives = [];

    for ( let n = 0; n < patternCount; n++ ) {
        patterns++;
        const { source, make } = pattern();
        const literals = Prefilter.extractRegexLiterals( source );
        if ( literals ) {
            filtered++;
        }

        [ true, false ].forEach( ignoreCase => {
            const matcher = compilePhrase( { phrase: source, useRegEx: true, ignoreCase } );
            if ( !matcher ) {
                return;
            }
            compiled++;

            for ( let k = 0; k < 8; k++ ) {
                let line = make();
                if ( ignoreCase && chance( 0.5 ) ) {
                    line = Array.from( line ).map( c => ( chance( 0.5 ) ? c.toUpperCase() : c.toLowerCase() ) ).join( '' );
                }
                if ( chance( 0.5 ) ) {
                    line = randomText() + line + randomText();
                }
                lines++;
                if ( !matcher( line ) ) {
                    continue;
                }
                matched++;

                const lower = line.toLowerCase();
                if ( literals && !literals.some( literal => lower.includes( literal ) ) ) {
                    falseNegatives.push( { source, ignoreCase, line, literals } );
                }
            }
        } );
    }

    return { patterns, compiled, filtered, lines, matched, falseNegatives };
}

{
    const result = fuzzExtractor( 20240607, 6000 );
    console.log( `fuzz: ${result.patterns} patterns, ${result.compiled} compiled variants, ${result.filtered} with literals, ` +
        `${result.lines} lines, ${result.matched} matched, ${result.falseNegatives.length} false negatives` );
    check( result.matched > 5000, `fuzz: only ${result.matched} matching lines generated` );
    check( result.falseNegatives.length === 0, `fuzz: ${result.falseNegatives.length} false negatives` );
    // The patterns are synthetic, so printing them is safe.
    result.falseNegatives.slice( 0, 10 ).forEach( c => console.log( `  false negative: /${c.source}/${c.ignoreCase ? 'i' : ''} line ${JSON.stringify( c.line )} literals ${JSON.stringify( c.literals )}` ) );
}

// ---- Library mode ----

/**
 * Returns the value after a command line option, or null if it isn't given.
 *
 * @param {string} name The option, such as --log.
 * @returns {string|null}
 */
function argument( name ) {
    const index = process.argv.indexOf( name );
    return index > -1 ? process.argv[ index + 1 ] : null;
}

const triggersFile = argument( '--triggers' );
const logFile = argument( '--log' );

if ( triggersFile || logFile ) {
    if ( !triggersFile || !logFile ) {
        console.log( 'Library mode needs both --triggers <file> and --log <file>.' );
        process.exit( 2 );
    }

    const data = JSON.parse( readFileSync( triggersFile, 'utf8' ) );
    const triggers = Array.isArray( data ) ? data : data.triggers ?? [];
    const phrases = triggers.flatMap( t => t.capturePhrases ?? [] ).filter( p => p?.phrase?.length > 0 );
    const lines = readFileSync( logFile, 'utf8' )
        .split( /\r?\n/ )
        .filter( l => l.length > 0 )
        .map( l => l.replace( timestampRegex, '' ) );

    const result = runLibrary( phrases, lines );
    report( 'library', result );
    check( result.misses === 0, `library: ${result.misses} misses` );
}

console.log( `${checks - failures} of ${checks} checks passed.` );
process.exit( failures > 0 ? 1 : 0 );
