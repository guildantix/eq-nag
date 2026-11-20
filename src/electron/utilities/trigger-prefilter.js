// Trigger prefilter: answers only "this trigger can't match this log line".
//
// Every phrase gives one required literal (or a few, one per top-level
// alternative of a regex).  A phrase whose literal isn't in the line can't
// match it, so its trigger doesn't need to run.  Anything that can't be
// reduced to a literal for sure is never filtered out: a candidate list may
// have extra triggers but must never miss one.
//
// Literals are compared in lower case and cut to maxLiteralLength characters
// (a prefix of a required literal is also required).

const minRegexLiteralLength = 3;
const maxLiteralLength = 16;
// Matches a numeric quantifier such as {2} or {0,3} at the sticky position, but
// not a shortcode such as {C}.  Example phrase: ^You gain (\d+) exp{2,4}\.$
const braceQuantifier = /\{(\d+)(?:,\d*)?\}/y;
// Matches a shortcode such as {C}, {N1}, {N>5} or {N(1,5)} at the sticky position.
const braceShortcode = /\{[A-Za-z][^{}|]*\}/y;

/**
 * Returns the literal a plain phrase needs in the log line, in lower case, or
 * null if the phrase can't be filtered (empty, or uses stored variables).
 *
 * @param {string} phrase The phrase.
 * @returns {string|null}
 */
function extractPlainLiteral( phrase ) {
    if ( typeof phrase !== 'string' || phrase.length === 0 || phrase.includes( '${' ) ) {
        return null;
    }

    return phrase.toLowerCase().slice( 0, maxLiteralLength );
}










/**
 * Returns the index after the group that starts at the given index, or -1 if
 * it isn't closed.
 *
 * @param {string} source The regex source.
 * @param {number} start The index of the opening parenthesis.
 * @returns {number} The index after the closing parenthesis, or -1.
 */
function skipGroup( source, start ) {
    let depth = 0;
    let position = start;

    while ( position < source.length ) {
        const character = source[ position ];

        if ( character === '\\' ) {
            position += 2;
        } else if ( character === '[' ) {
            position = skipClass( source, position );
            if ( position < 0 ) {
                return -1;
            }
        } else if ( character === '(' ) {
            depth++;
            position++;
        } else if ( character === ')' ) {
            depth--;
            position++;
            if ( depth === 0 ) {
                return position;
            }
        } else {
            position++;
        }
    }

    return -1;
}










/**
 * Returns the index after the character class that starts at the given index,
 * or -1 if it isn't closed.
 *
 * @param {string} source The regex source.
 * @param {number} start The index of the opening bracket.
 * @returns {number} The index after the closing bracket, or -1.
 */
function skipClass( source, start ) {
    let position = start + 1;

    if ( source[ position ] === '^' ) {
        position++;
    }

    while ( position < source.length ) {
        if ( source[ position ] === '\\' ) {
            position += 2;
        } else if ( source[ position ] === ']' ) {
            return position + 1;
        } else {
            position++;
        }
    }

    return -1;
}










/**
 * Returns the index after an escape that starts with a letter or digit, so
 * the characters it takes as arguments are never read as literal text, or -1
 * if the escape isn't complete.  Example: \x41, \u{41}, \p{L}, \k<who>, \12
 *
 * @param {string} source The regex source.
 * @param {number} start The index of the backslash.
 * @returns {number} The index after the escape, or -1.
 */
function skipLetterEscape( source, start ) {
    const escaped = source[ start + 1 ];
    let position = start + 2;

    if ( /[0-9]/.test( escaped ) ) {
        // Backreference or octal: swallowing every digit can only lose literal text.
        while ( /[0-9]/.test( source[ position ] ?? '' ) ) {
            position++;
        }
    } else if ( escaped === 'x' ) {
        position += 2;
    } else if ( escaped === 'c' ) {
        position += 1;
    } else if ( escaped === 'u' && source[ position ] !== '{' ) {
        position += 4;
    } else if ( escaped === 'u' || escaped === 'p' || escaped === 'P' || escaped === 'k' ) {
        const opener = escaped === 'k' ? '<' : '{';
        if ( source[ position ] !== opener ) {
            // Without its argument it is a plain letter in a non-unicode regex; unknown either way.
            return position;
        }
        const close = source.indexOf( escaped === 'k' ? '>' : '}', position );
        return close < 0 ? -1 : close + 1;
    }

    return position > source.length ? -1 : position;
}










/**
 * Returns one required literal per top-level alternative of a regex phrase, in
 * lower case, or null if any alternative has none (or the source can't be
 * scanned), in which case the phrase can't be filtered.  Only literal text
 * that every match must contain is used: shortcodes, groups, classes, anchors,
 * optional characters and non-ASCII characters all end a literal.
 *
 * @param {string} source The phrase, as the user wrote it.
 * @returns {string[]|null}
 */
function extractRegexLiterals( source ) {
    if ( typeof source !== 'string' || source.length === 0 ) {
        return null;
    }










    /** @type {string[]} */
    const literals = [];
    let bestLiteral = '';
    let run = '';
    let atBranchStart = true;
    let position = 0;

    const endCurrentRun = () => {
        if ( run.length > bestLiteral.length ) {
            bestLiteral = run;
        }
        run = '';
    };

    while ( position < source.length ) {
        const character = source[ position ];

        if ( character === '|' ) {
            endCurrentRun();
            if ( bestLiteral.length < minRegexLiteralLength ) {
                return null;
            }
            literals.push( bestLiteral.slice( 0, maxLiteralLength ).toLowerCase() );
            bestLiteral = '';
            atBranchStart = true;
            position++;
            continue;
        }

        if ( character === '{' ) {
            // A shortcode such as {C} is skipped.  Any other brace group, for example
            // {foo|bar}, can't be read for sure, so the phrase always runs.  A numeric
            // quantifier never gets here: it is taken together with its atom below.
            braceShortcode.lastIndex = position;
            const match = braceShortcode.exec( source );
            endCurrentRun();
            atBranchStart = false;
            if ( match ) {
                position += match[ 0 ].length;
            } else if ( source.indexOf( '}', position ) < 0 ) {
                // Never closed, so it is plain text in a regex.
                position++;
            } else {
                return null;
            }
            continue;
        }

        if ( character === '*' || character === '+' || character === '?' ) {
            if ( atBranchStart ) {
                return null;
            }
            endCurrentRun();
            position++;
            continue;
        }

        if ( character === ')' ) {
            return null;
        }










        /** @type {string|null} */
        let literal = null;
        let next = position + 1;

        if ( character === '\\' ) {
            if ( position + 1 >= source.length ) {
                return null;
            }
            const escaped = source[ position + 1 ];
            next = position + 2;
            if ( /[A-Za-z0-9]/.test( escaped ) ) {
                next = skipLetterEscape( source, position );
                if ( next < 0 ) {
                    return null;
                }
            } else if ( escaped.charCodeAt( 0 ) < 128 ) {
                literal = escaped;
            }
        } else if ( character === '(' ) {
            next = skipGroup( source, position );
            if ( next < 0 ) {
                return null;
            }
        } else if ( character === '[' ) {
            next = skipClass( source, position );
            if ( next < 0 ) {
                return null;
            }
        } else if ( character.charCodeAt( 0 ) < 128 && !'^$.]}'.includes( character ) ) {
            literal = character;
        }

        atBranchStart = false;

        // Take the quantifier that follows the atom, if any.
        let quantifier = null;
        const quantifierCharacter = source[ next ];
        if ( quantifierCharacter === '*' || quantifierCharacter === '+' || quantifierCharacter === '?' ) {
            quantifier = quantifierCharacter;
            next++;
            if ( source[ next ] === '?' ) {
                next++;
            }
            if ( source[ next ] === '*' || source[ next ] === '+' || source[ next ] === '?' ) {
                return null;
            }
        } else if ( quantifierCharacter === '{' ) {
            // A numeric quantifier; other braces are shortcodes, which the main loop skips.
            braceQuantifier.lastIndex = next;
            const match = braceQuantifier.exec( source );
            if ( match ) {
                quantifier = +match[ 1 ] === 0 ? '*' : '+';
                next += match[ 0 ].length;
                if ( source[ next ] === '?' ) {
                    next++;
                }
            }
        }

        if ( literal === null ) {
            endCurrentRun();
        } else if ( quantifier === '*' || quantifier === '?' ) {
            endCurrentRun();
        } else if ( quantifier === '+' ) {
            run += literal;
            endCurrentRun();
        } else {
            run += literal;
        }

        position = next;
    }

    endCurrentRun();
    if ( bestLiteral.length < minRegexLiteralLength ) {
        return null;
    }
    literals.push( bestLiteral.slice( 0, maxLiteralLength ).toLowerCase() );

    return literals;
}










/**
 * Builds an Aho-Corasick automaton over the given literals.
 *
 * @param {{literal: string, key: number}[]} entries The literals, each with the
 *     key to mark when it's found.
 * @returns {{nodeCount: number, candidates: Function}} The automaton.
 */
function build( entries ) {
    // Plain trie first.
    /** @type {Map<number, number>[]} */
    const children = [ new Map() ];
    /** @type {(number[]|undefined)[]} */
    const keysAt = [ undefined ];

    entries.forEach( entry => {
        if ( !entry.literal ) {
            return;
        }

        let node = 0;
        for ( let i = 0; i < entry.literal.length; i++ ) {
            const code = entry.literal.charCodeAt( i );
            let child = children[ node ].get( code );
            if ( child === undefined ) {
                child = children.length;
                children.push( new Map() );
                keysAt.push( undefined );
                children[ node ].set( code, child );
            }
            node = child;
        }

        ( keysAt[ node ] ??= [] ).push( entry.key );
    } );

    const count = children.length;
    const failureLinks = new Int32Array( count );
    const outputLinks = new Int32Array( count );

    // Single-child nodes keep one char code and one target; only branching
    // nodes get a Map.  singleChar: -1 no children, -2 branching, else the code.
    const singleChar = new Int32Array( count ).fill( -1 );
    const singleNext = new Int32Array( count );
    /** @type {(Map<number, number>|undefined)[]} */
    const branches = new Array( count );

    for ( let n = 0; n < count; n++ ) {
        const childNodes = children[ n ];
        if ( childNodes.size === 1 ) {
            const [ code, next ] = childNodes.entries().next().value;
            singleChar[ n ] = code;
            singleNext[ n ] = next;
        } else if ( childNodes.size > 1 ) {
            singleChar[ n ] = -2;
            branches[ n ] = childNodes;
        }
    }

    const step = ( node, code ) => {
        const singleChildCode = singleChar[ node ];
        if ( singleChildCode === code ) {
            return singleNext[ node ];
        }
        if ( singleChildCode === -2 ) {
            const next = branches[ node ].get( code );
            if ( next !== undefined ) {
                return next;
            }
        }
        return -1;
    };

    // Failure links, breadth first.
    const queue = [];
    children[ 0 ].forEach( child => queue.push( child ) );

    for ( let queueIndex = 0; queueIndex < queue.length; queueIndex++ ) {
        const node = queue[ queueIndex ];

        children[ node ].forEach( ( child, code ) => {
            let failureNode = failureLinks[ node ];
            let target = step( failureNode, code );
            while ( target < 0 && failureNode !== 0 ) {
                failureNode = failureLinks[ failureNode ];
                target = step( failureNode, code );
            }
            failureLinks[ child ] = target < 0 ? 0 : target;
            outputLinks[ child ] = keysAt[ failureLinks[ child ] ] ? failureLinks[ child ] : outputLinks[ failureLinks[ child ] ];
            queue.push( child );
        } );
    }

    children.length = 0;

    return {
        nodeCount: count,

        /**
         * Sets marks[ key ] = stamp for every literal found in the line.
         *
         * @param {string} lowerLine The log line, in lower case.
         * @param {{[key: number]: number}} marks The marks, indexed by key.
         * @param {number} stamp The value to mark with.
         */
        candidates( lowerLine, marks, stamp ) {
            let state = 0;

            for ( let i = 0; i < lowerLine.length; i++ ) {
                const code = lowerLine.charCodeAt( i );
                let next = step( state, code );
                while ( next < 0 && state !== 0 ) {
                    state = failureLinks[ state ];
                    next = step( state, code );
                }
                state = next < 0 ? 0 : next;

                let out = keysAt[ state ] ? state : outputLinks[ state ];
                while ( out > 0 ) {
                    const keys = keysAt[ out ];
                    for ( let k = 0; k < keys.length; k++ ) {
                        marks[ keys[ k ] ] = stamp;
                    }
                    out = outputLinks[ out ];
                }
            }
        },
    };
}

module.exports = { extractPlainLiteral, extractRegexLiterals, build, minRegexLiteralLength, maxLiteralLength };
