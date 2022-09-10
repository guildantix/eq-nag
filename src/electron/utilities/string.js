const { result } = require( "lodash" );










/**
 * Formats the given string like the c# equivalent.
 * 
 * @returns {string} Returns the formated string.
 * 
 * @param {string} format The format string
 * @param {any[]} args Any number of arguments.
 */
function format( format, args ) {
    return format.replace( /{(\d+)}/g, function ( match, number ) {
        return typeof args[ number ] != 'undefined' ? args[ number ] : match;
    } );
}










/**
 * Compares the two strings.
 * 
 * @param {string} a 
 * @param {string} b 
 * @param {boolean} caseSensitive If false, ignores case. (default: true)
 */
function compare( a, b, caseSensitive ) {
    let aNil = isNullOrWhitespace( a );
    let bNil = isNullOrWhitespace( b );
    
    if ( ( aNil && bNil ) ) {
        return true;
    } else if ( ( !aNil && bNil ) || ( aNil && !bNil ) ) {
        return false;
    }

    caseSensitive = caseSensitive === false ? false : true;

    if ( caseSensitive ) {
        return a === b;
    } else {
        return a.toLowerCase() === b.toLowerCase();
    }
}










/**
 * Returns true if the given value is null, undefined, or contains only whitespace.
 * 
 * @param {string} value The value to evaluate.
 */
function isNullOrWhitespace( value ) {
    if ( value === null || value === undefined || value.replace( /\s+/gi, '' ).length === 0 ) {
        return true;
    }
}










/**
 * Parses the given string, inserting stored variables where matched with ${name_of_var}.
 * 
 * @example
 *      storedVariables['SpellBeingCast'] = ['Envenomed Bolt', 'Pyre of Mori']
 *      ${SpellBeingCast} => (?<SpellBeingCast>Envenomed Bolt|Pyre of Mori)
 * 
 * @param {string} value The string value to parse.
 * @param {Record<string, string[]>} storedVariables The dictionary of stored variables.
 */
function parseStoredVariablesToRegex(value, storedVariables) {
    // \${(.[^}]*)}     Your ${SpellBeingCast} spell is interrupted.
    //                      Full match	47-63	{SpellBeingCast}
    //                      Group 1.	n/a	SpellBeingCast
    let result = /\${(.[^}]*)}/g.exec( value );
    
    if ( result?.length > 1 ) {
        for ( let i = 1; i < result.length; i++ ) {
            let values = storedVariables[ result[ i ] ];
            //value = value.replace(/\${SpellBeingCast}/g, '(?:Envenomed Bolt|Pyre of Mori)');
            if ( values?.length > 0 ) {

                let captureGroupRgx = '(?<' + result[ i ] + '>' + values[ 0 ];
                for ( let i = 1; i < values.length; i++ ) {
                    captureGroupRgx += '|' + values[ i ];
                }
                captureGroupRgx += ')';
                
                value = value.replace( RegExp( `\\\${${result[ i ]}}`, 'g' ), captureGroupRgx );
            }
        }
    }
    return value;
}










/**
 * Parses the given string, inserting stored variables where matched with ${name_of_var}.
 * 
 * @example
 *      storedVariables['SpellBeingCast'] = 'Minor Shielding'
 *      ${SpellBeingCast} => Minor Shielding
 * 
 * @param {string} value The string value to parse.
 * @param {Record<string, string[]>} storedVariables The dictionary of stored variables.
 */
function parseStoredVariablesToLiteral( value, storedVariables ) {
    // \${(.[^}]*)}     Your ${SpellBeingCast} spell is interrupted.
    //                      Full match	47-63	{SpellBeingCast}
    //                      Group 1.	n/a	SpellBeingCast
    let result = /\${(.[^}]*)}/g.exec( value );
    
    if ( result?.length > 1 ) {
        for ( let i = 1; i < result.length; i++ ) {
            let values = storedVariables[ result[ i ] ];
            if ( values?.length > 0 ) {
                let text = values[ 0 ];
                
                for ( let i = 1; i < values.length; i++ ) {
                    text += ',' + values[ i ];
                }
            
                value = value.replace( RegExp( `\\\${${result[ i ]}}`, 'g' ), text );
            }
        }
    }

    return value;
}










/**
 * Transforms the given phrase, replacing matching named conditions to the values those conditions matched when the trigger was executed.
 * 
 * @description 
 *  For a dot timer, the SpellBeingCast variable may have the value of 
 *  'Envenomed Bolt'.  That value may not exist in the saved variables any 
 *  longer, but that was the value of that variable at the time the trigger was 
 *  executed and that value is stored in the conditionResults dictionary.
 * 
 * @param {string} value The phrase to transform.
 * @param {Record<string, string>} conditionResults The values of conditions(s) when the trigger condition(s) were passed.
 */
function parseConditionResultsToLiteral( value, conditionResults ) {
    // \${(.[^}]*)}     Your ${SpellBeingCast} spell is interrupted.
    //                      Full match	47-63	{SpellBeingCast}
    //                      Group 1.	n/a	SpellBeingCast
    let result = /\${(.[^}]*)}/g.exec( value );
    
    if ( result?.length > 1 ) {
        for ( let i = 1; i < result.length; i++ ) {
            //value = value.replace(/\${SpellBeingCast}/g, 'Envenomed Bolt');
            if ( conditionResults[ result[ i ] ] ) {
                value = value.replace( RegExp( `\\\${${result[ i ]}}`, 'g' ), conditionResults[ result[ i ] ] );
            }
        }
    }

    return value;
}










/**
 * Parses counter values to the given display text.
 * 
 * @param {string} value The original string value
 * @param {Record<string, {value: number, lastUpdate: Date, resetDelay: number, _parse: (logEntry: string) => boolean}>} counters The counters object.
 */
function parseCountersToLiteral( value, counters ) {
    if ( isNullOrWhitespace( value ) ) {
        return value;
    }

    let indexedResults = [ ...value.matchAll( /\+{(.[^}]*)}/g ) ];

    if ( indexedResults?.length > 0 ) {
        for ( let i = 0; i < indexedResults.length; i++ ) {
            // ex: counters['Total Count'] = {..., value: 12, ...}
            //  when given the phrase
            //      Total count: +{Total Count}!
            //  the result will be
            //      Total count: 12
            let key = indexedResults[ i ][ 1 ];
            if ( counters[ key ] != null ) {
                value = value.replace( RegExp( `\\\+{${key}}`, 'g' ), counters[ key ].value );
            }
        }
    }
    
    return value;
}










/**
 * Transforms values in the given string based on the given phonetic transforms.
 * 
 * @param {string} value The phrase to transform.
 * @param {Record<string, string>} phoneticTransforms The phonetic transforms.
 */
function parsePhoneticTransformsToLiteral( value, phoneticTransforms ) {
    if ( phoneticTransforms ) {
        for ( let key of Object.keys( phoneticTransforms ) ) {
            // Escape the regex values in the key
            let rgx = new RegExp( key.replace( /[.*+?^${}()|[\]\\]/g, '\\$&' ), 'gi' );
            value = value.replace( rgx, phoneticTransforms[ key ] );
        }
    }

    // This next part will parse roman numerals into words.
    // For example: https://regex101.com/r/xx1bHM/1

    /** @type {Record<string, string>} */
    let romanNumerals = {
        'I': 'one',
        'II': 'two',
        'III': 'three',
        'IV': 'four',
        'V': 'five',
        'VI': 'size',
        'VII': 'seven',
        'VIII': 'eight',
        'IX': 'nine',
        'X': 'ten',
    };
    // // I is special.  We change all except for lonely I.
    // value = value.replace( /(\s)i([\.|!|,|?])/gi, '$1one$2' );

    for ( let key of Object.keys( romanNumerals ) ) {
        let rgx = new RegExp( `(\\s)${key}([\\.|!|,|?|\\s])`, 'gi' );
        value = value.replace( rgx, `$1${romanNumerals[ key ]}$2` );
    }
    return value;
}










/**
 * Replaces named group matches in the given string from the dictionary.
 * 
 * @param {string} value The value that may contain references to regex named groups.
 * @param {Record<string, string>} groups The named groups dictionary.
 */
function parseSequentialGroups( value, groups ) {
    if ( isNullOrWhitespace( value ) ) {
        return value;
    }
    // \${(.[^}]*)}     Your ${SpellBeingCast} spell is interrupted.
    //                      Full match	47-63	{SpellBeingCast}
    //                      Group 1.	n/a	SpellBeingCast
    let namedResults = [ ...value.matchAll( /\?{(.[^}]*)}/g ) ];
    
    if ( namedResults?.length > 0 && groups != null ) {
        for ( let m = 0; m < namedResults.length; m++ ) {
            // ex: groups.player == 'Soandso'
            //  when given the phrase
            //      ${target} has been slain by ${player}!
            //  matches the log entry
            //      (?<target>Mob Name A) has been slain by (?<player>Soandso)!
            let key = namedResults[ m ][ 1 ];

            if ( groups[ key ] != null ) {
                value = value.replace( RegExp( `\\\?{${key}}`, 'g' ), `(?<${key}>${groups[ key ]})` );
            }
        }
    }
    
    return value;
}










/**
 * Parses the given value as a dictionary literal.
 * 
 * @returns {string[]}
 * 
 * @description
 *  ex: PlayerCastTimes[Eryndhel][Curavita Rk. II] => ['Eryndhel', 'Curavita Rk. II']
 *  https://regex101.com/r/QdKUba/1
 * 
 * @param {string} value The value to parse.
 */
function parseDictionaryKeys( value ) {
    /** @type {RegExpExecArray[]} */
    let keys = [ ...value.matchAll( /(?<=\[)(.*?)(?=\])/g ) ];
    /** @type {string[]} */
    let output = [];
    for ( let i = 0; i < keys?.length ?? 0; i++ ) {
        let key = keys[ i ][ 1 ];
        if ( key ) {
            output.push( key );
        }
    }

    return output;
}










/**
 * Parses the given string, inserting values according to the provided regular 
 * expression exec array.
 * 
 * @description
 *  Named groups will match against ${name_of_group} and indexed results will 
 *  match against #{index}
 * 
 * @param {string} value The string value to parse.
 * @param {RegExpExecArray} matches The regular expression results.
 * @param {number} deltaTime The change in time, in milliseconds, since the previous sequential capture.
 */
function parseMatchesToLiteral( value, matches, deltaTime ) {
    if ( isNullOrWhitespace( value ) || matches == null ) {
        return value;
    }
    // \${(.[^}]*)}     Your ${SpellBeingCast} spell is interrupted.
    //                      Full match	47-63	{SpellBeingCast}
    //                      Group 1.	n/a	SpellBeingCast
    let namedResults = [ ...value.matchAll( /\${(.[^}]*)}/g ) ];// /\${(.[^}]*)}/g.exec( value );
    
    if ( namedResults?.length > 0 && matches?.groups != null ) {
        for ( let m = 0; m < namedResults.length; m++ ) {
            // ex: matches.groups.player == 'Soandso'
            //  when given the phrase
            //      ${target} has been slain by ${player}!
            //  matches the log entry
            //      Mob Name A has been slain by Soandso!
            let key = namedResults[ m ][ 1 ];

            if ( key === 'deltaTime' ) {
                value = value.replace( RegExp( `\\\${${key}}`, 'g' ), deltaTime );
            } else if ( matches.groups[ key ] != null ) {
                value = value.replace( RegExp( `\\\${${key}}`, 'g' ), matches.groups[ key ] );
            }
        }
    }

    // #{([0-9]+?)}     This is a test #{1} so that testing can #{2}.
    //
    //                      Match 1
    //                      Full match	15-19	#{1}
    //                      Group 1.	17-18	1
    //
    //                      Match 2
    //                      Full match	40-44	#{2}
    //                      Group 1.	42-43	2
    let indexedResults = [ ...value.matchAll( /#{([0-9]+?)}/g ) ];

    if ( indexedResults?.length > 0 ) {
        for ( let i = 0; i < indexedResults.length; i++ ) {
            // ex: matches[2] == 'Soandso'
            //  when given the phrase
            //      (.+?) has been slain by (.+?)!
            //  matches the log entry
            //      Mob Name A has been slain by Soandso!
            let index = +indexedResults[ i ][ 1 ];
            if ( matches[ index ] != null ) {
                value = value.replace( RegExp( `#{${index}}`, 'g' ), matches[ index ] );
            }
        }
    }

    return value;
}










/**
 * Parses stored variable values into the given phrase.
 * 
 * @example
 *      storedVariables['SpellBeingCast'] = 'Minor Shielding'
 *      ${SpellBeingCast} => Minor Shielding
 * 
 * @param {string} value The phrase to parse.
 * @param {Record<string, any>} storedVariables The stored variables.
 */
function parseStoredVariablesToLiteralArray( value, storedVariables ) {
    // \${(.[^}]*)}     Your ${SpellBeingCast} spell is interrupted.
    //                      Full match	47-63	{SpellBeingCast}
    //                      Group 1.	n/a	SpellBeingCast
    let result = /\${(.[^}]*)}/g.exec( value );
    let literals = [];

    if ( result?.length > 1 ) {
        for ( let i = 1; i < result.length; i++ ) {
            let values = storedVariables[ result[ i ] ];
            if ( values?.length > 0 ) {
                
                for ( let i = 1; i < values.length; i++ ) {
                    literals.push( value.replace( RegExp( `\\\${${result[ i ]}}`, 'g' ), values[ i ] ) );
                    
                }
                
            }
        }
    } else {
        literals.push( value );
    }

    return literals;
}










/**
 * Transforms the given string so that the matched short code values are rendered into the string.
 * 
 * @param {string} value The string literal.
 * @param {string} characterName The name of the current character.
 * @param {number} duration The duration in seconds.
 * @param {Record<string, string>} groups The named groups dictionary.
 * @param {string} logEntry The unmodified log entry.
 */
function parseShortCodeValuesToLiteral( value, characterName, duration, groups, logEntry ) {
    if ( value ) {
        value = value.replace( /{TS}/gi, getDurationLabel( duration ) );
        value = value.replace( /{C}/gi, characterName );
        value = value.replace( /{L}/gi, logEntry );
        // value = value.replace( /{COUNTER}/gi, counterValue ); // These will have to be converted if pulled from gina.  A single trigger could have multiple counters which necessitates that the counter name be used in nag format: +{CounterName}
        if ( groups ) {
            for ( let key of Object.keys( groups ) ) {
                if ( key.match( /^[N|S][0-9]{0,}$/gi ) ) {
                    let rgx = new RegExp( `{${key}}`, 'gi' );
                    value = value.replace( rgx, groups[ key ] );
                }
            }
        }
    }

    return value;
}










// TODO: Why is this commented out?
// /**
//  * Transforms the given string so that the matched short code values are rendered into the string.
//  * 
//  * @param {string} value The string literal.
//  * @param {string} characterName The name of the current character.
//  * @param {number} counterValue The counter value.
//  * @param {number} duration The duration in seconds.
//  * @param {string[]} nValues Matched {N#} values, having {N} # == 0.
//  * @param {string[]} sValues Matched {S#} values, having {S} # == 0.
//  */
// function parseShortCodeValuesToLiteral( value, characterName, counterValue, duration, nValues, sValues ) {
//     if ( value ) {
//         value = value.replace( /{TS}/gi, getDurationLabel( duration ) );
//         value = value.replace( /{C}/gi, characterName );
//         value = value.replace( /{COUNTER}/gi, counterValue );
//         nValues?.forEach( n, i => {
//             let rgx = new RegExp( `{N${i == 0 ? '0{0,1}' : i}}`, 'gi' );
//             value = value.replace( rgx, n );
//         } );
//         sValues?.forEach( s, i => {
//             let rgx = new RegExp( `{S${i == 0 ? '0{0,1}' : i}}`, 'gi' );
//             value = value.replace( rgx, n );
//         } );
//     }
// }










/**
 * Returns the given duration as a human readable number.
 * 
 * @example
 *  123 => '2m 3s'
 * 
 * @param {number} seconds The duration in seconds.
 */
function getDurationLabel( seconds ) {

    if ( seconds > 0 ) {
        let hours = Math.floor( seconds / 3600 );
        let mins = Math.floor( ( seconds % 3600 ) / 60 );
        let secs = seconds % 3600 % 60;

        let label = '';

        if ( hours > 0 ) {
            label += `${hours}h `;
        }
        if ( mins > 0 ) {
            label += `${mins}m `;
        }
        if ( secs > 0 ) {
            label += `${secs}s `;
        }

        return label;

    } else if (seconds) {
        return `${seconds}s`;

    } else {
        return 'unknown';
    }

}










/**
 * Returns the number of seconds in the given duration label.
 * 
 * @example
 *  '1m 2s' => 62
 * 
 * @param {string} label The duration label.
 */
function getDurationFromLabel( label ) {
    if ( label ) {
        let matches = [ ...label.matchAll( /(?<hours>[0-9]+?h)|(?<minutes>[0-9]+?m)|(?<seconds>[0-9]+?s)/gi ) ];
        if ( matches?.length > 0 ) {
            let duration = 0;

            matches.forEach( m => {
                if ( m.groups.hours ) {
                    duration += parseInt( m.groups.hours ) * 3600;
                } else if ( m.groups.minutes ) {
                    duration += parseInt( m.groups.minutes ) * 60;
                } else if ( m.groups.seconds ) {
                    duration += parseInt( m.groups.seconds );
                }
            } );

            return duration;
        }
        let milMatches = /(?<hours>[0-9]+):(?<minutes>[0-9]+):(?<seconds>[0-9]+)/gi.exec( label );
        if ( milMatches?.length > 0 ) {
            let duration = 0;
            
            if ( milMatches.groups.hours ) {
                duration += parseInt( milMatches.groups.hours ) * 3600;
            }
            if ( milMatches.groups.minutes ) {
                duration += parseInt( milMatches.groups.minutes ) * 60;
            }
            if ( milMatches.groups.seconds ) {
                duration += parseInt( milMatches.groups.seconds );
            }

            return duration;
        }
    }

    return parseFloat( label );
}










/**
 * Parses the given string and converts shortcodes into proper regular expressions or simple text.
 * 
 * @example
 *      {S2} => (?<S2>.+?)
 *      {C} => Eryndhel
 * 
 * @param {string} value The phrase to search.
 * @param {string} characterName The current character's name.
 * @returns 
 */
function parseShortCodesToRegex( value, characterName ) {
    // https://regex101.com/r/g9QIL1/2
    // (?<timerDuration>[0-9]+?[h|hour|hours|hrs]+\s[0-9]*?[m|min|mins|minute|minutes]*?\s?[0-9]+?[s|sec|secs|seconds|second]+?|[0-9]*?[m|min|mins|minute|minutes]*?\s?[0-9]+?[s|sec|secs|seconds|second]+?|[0-9]+:[0-9]+:[0-9]+|[0-9]+)
    // (?<timerDuration>[0-9]*?[h|hour|hours|hrs]*\s?[0-9]*?[m|min|mins|minute|minutes]*?\s?[0-9]*?[s|sec|secs|seconds|second]*?|[0-9]*?[m|min|mins|minute|minutes]*?\s?[0-9]*?[s|sec|secs|seconds|second]*?|[0-9]*)
    
    // https://regex101.com/r/e0CFEL/1
    // ^(?=.*timer)Halindar (?:start timer|starts*|begins*|timer)(?: a |\s)*(?<timerDuration>[0-9]*?[h|hour|hours|hrs]*\s?[0-9]*?[m|min|mins|minute|minutes]*?\s?[0-9]*?[s|sec|secs|seconds|second]*?|[0-9]*?[m|min|mins|minute|minutes]*?\s?[0-9]*?[s|sec|secs|seconds|second]*?|[0-9]*)(?:\stimer)*(?:for Targeting)*\.$

    if ( value ) {
        value = value.replace( /{TS}/i, '(?<timerDuration>[0-9]*?[h|hour|hours|hrs]*\\s?[0-9]*?[m|min|mins|minute|minutes]*?\\s?[0-9]*?[s|sec|secs|seconds|second]*?|[0-9]*?[m|min|mins|minute|minutes]*?\\s?[0-9]*?[s|sec|secs|seconds|second]*?|[0-9]+:[0-9]+:[0-9]+|[0-9.]*)' );
        value = value.replace( /{C}/gi, characterName );
        value = value.replace( /\${Character}/gi, characterName );
        // value = value.replace( /{COUNTER}/gi, '' ); // We may add this in the future, just not sure how to accomplish this.  WE use counter names instead of just {COUNTER} however.
        // value = value.replace( /{N}/gi, '(?<N>[0-9]+?)' );
        value = value.replace( /{S([0-9]*?)}/gi, '(?<S$1>.+?)' );
        value = value.replace( /{N([0-9]*?)}/gi, '(?<N$1>[0-9]+?)' );
        value = parseNConditionalCodesToRegex( value );
        // https://regex101.com/r/k4eq0f/1
    }

    return value;
}










/**
 * Parses any gina conditional n values to regex.
 * 
 * @param {string} value The input value.
 */
function parseNConditionalCodesToRegex( value ) {
    let allMatches = [ ...value.matchAll( /{N([0-9]*?)(>|>=|<|<=|=|!=)([0-9]*?)}/gi ) ];

    if ( allMatches?.length > 0 ) {
        for ( let i = allMatches.length - 1; i >= 0; i-- ) {
            let m = allMatches[ i ];
            let opVal = +m[ 3 ];
            let n = 'cN' + m[ 1 ];
            let rgx = '';

            if ( m[ 2 ] === '>' ) {
                rgx = _getGreaterThanRegex( opVal.toString() );
            } else if ( m[ 2 ] === '>=' ) {
                rgx = _getGreaterThanRegex( ( opVal - 1 ).toString() );
            } else if ( m[ 2 ] === '<' ) {
                rgx = _getLessThanRegex( opVal.toString() );
            } else if ( m[ 2 ] === '<=' ) {
                rgx = _getLessThanRegex( ( opVal + 1 ).toString() );
            } else if ( m[ 2 ] === '=' ) {
                rgx = opVal.toString();
            } else if ( m[ 2 ] === '!=' ) {
                rgx = `${_getLessThanRegex( opVal.toString() )}|${_getGreaterThanRegex( opVal.toString() )}`;
            }
            
            if ( rgx != '' ) {
                value = `${value.substring( 0, m.index )}(?<N${m[ 1 ]}>${rgx})${value.substring( m.index + m[ 0 ].length )}`;
            } else {
                throw `Invalid conditional n format: [${m[ 2 ]}]. Found in phrase: ${value}`;
            }
        }
    }

    return value;
}










// greater than: https://regex101.com/r/cs0xI3/1
// less than: https://regex101.com/r/pWPL4Y/1, https://regex101.com/r/pWPL4Y/2 

/**
 * Returns a regular expression to evaluate numbers greater than the given value.
 * 
 * @param {string} nval The value.
 */
function _getGreaterThanRegex( nval ) {
    let rgx = '';
    if ( nval?.length > 0 ) {
        let len = nval.length;
        rgx = `\\d{${len + 1},}`;
        for ( let i = 0; i < len; i++ ) {
            let str = nval.substring( 0, i );
            let block = `[${+nval[ i ] + 1}-9]`;
            let remain = len - i - 1;
            if ( remain > 0 ) {
                block += '\\d';
                block += `{${remain},${remain}}`;
            }
            rgx = rgx + '|' + str + block;
        }
    }
    return rgx;
}










/**
 * Returns a regular express to evaluate numbers less than the given value.
 * 
 * @param {string} nval The value.
 */
function _getLessThanRegex( nval ) {
    let rgx = '';
    if ( nval?.length > 1 ) {
        let len = nval.length;
        rgx = `[0-9]{1,${len - 1}}|`;
        for ( let i = 0; i < len - 1; i++ ) {
            rgx += `[0-${nval[ i ]}]`;
        }
        rgx += `[0-${+( nval[ len - 1 ] ) - 1}]`;
    } else if ( nval?.length === 1 ) {
        rgx = `[0-${+nval - 1}]`;
    }
    return rgx;
}










// TODO: Why is this commented out?
// /**
//  * Parses any gina conditional n values to regex and returns eval functions for each n-value.
//  * 
//  * @param {string} value The input value.
//  */
// function parseNConditionalCodesToRegex( value ) {
//     let allMatches = [ ...value.matchAll( /{N([0-9]*?)(>|>=|<|<=|=)([0-9]*?)}/gi ) ];
//     let result = {
//         value: value,
//         operations: {}
//     };

//     if ( allMatches?.length > 0 ) {
//         for ( let i = allMatches.length - 1; i >= 0; i-- ) {
//             let m = allMatches[ i ];
//             let opVal = +m[ 3 ];
//             let n = 'cN' + m[ 1 ];

//             if ( m[ 2 ] === '>' ) {
//                 result.operations[ n ] = ( nValue ) => {
//                     return +nValue > opVal;
//                 };
//             } else if ( m[ 2 ] === '>=' ) {
//                 result.operations[ n ] = ( nValue ) => {
//                     return +nValue >= opVal;
//                 };
//             } else if ( m[ 2 ] === '<' ) {
//                 result.operations[ n ] = ( nValue ) => {
//                     return +nValue < opVal;
//                 };
//             } else if ( m[ 2 ] === '<=' ) {
//                 result.operations[ n ] = ( nValue ) => {
//                     return +nValue <= opVal;
//                 };
//             } else if ( m[ 2 ] === '=' ) {
//                 result.operations[ n ] = ( nValue ) => {
//                     return +nValue == opVal;
//                 };
//             }


//             // let op = {
//             //     name: 'cN' + m[ 1 ],
//             //     value: +m[ 3 ],
//             // };

//             // if ( m[ 2 ] === '>' ) {
//             //     op._eval = ( nValue, opValue ) => {
//             //         return +nValue > opValue;
//             //     };
//             // } else if ( m[ 2 ] === '>=' ) {
//             //     op._eval = ( nValue, opValue ) => {
//             //         return +nValue >= opValue;
//             //     };
//             // } else if ( m[ 2 ] === '<' ) {
//             //     op._eval = ( nValue, opValue ) => {
//             //         return +nValue < opValue;
//             //     };
//             // } else if ( m[ 2 ] === '<=' ) {
//             //     op._eval = ( nValue, opValue ) => {
//             //         return +nValue <= opValue;
//             //     };
//             // } else if ( m[ 2 ] === '=' ) {
//             //     op._eval = ( nValue, opValue ) => {
//             //         return +nValue == opValue;
//             //     };
//             // }

//             // // Because we're moving backwards through the matches, we use 
//             // // unshift to put them in the logical order.  This really isn't 
//             // // necessary but will be easier if we're tracking down issues in 
//             // // other areas of the application.
//             // result.operations.unshift( op );

//             result.value = `${result.value.substring( 0, m.index )}(?<cN${m[ 1 ]}>[0-9]+?)${result.value.substring( m.index + m[ 0 ].length )}`;
//         }
//     }

//     return result;
// }










let StringUtilities = {
    format: format,
    isNullOrWhitespace: isNullOrWhitespace,
    parseStoredVariablesToRegex: parseStoredVariablesToRegex,
    parseStoredVariablesToLiteral: parseStoredVariablesToLiteral,
    parseStoredVariablesToLiteralArray: parseStoredVariablesToLiteralArray,
    parseConditionResultsToLiteral: parseConditionResultsToLiteral,
    parseMatchesToLiteral: parseMatchesToLiteral,
    parseCountersToLiteral: parseCountersToLiteral,
    parseSequentialGroups: parseSequentialGroups,
    parsePhoneticTransformsToLiteral: parsePhoneticTransformsToLiteral,
    parseShortCodeValuesToLiteral: parseShortCodeValuesToLiteral,
    parseNConditionalCodesToRegex: parseNConditionalCodesToRegex,
    parseShortCodesToRegex: parseShortCodesToRegex,
    getDurationFromLabel: getDurationFromLabel,
    compare: compare,
    parseDictionaryKeys: parseDictionaryKeys,
};

module.exports = StringUtilities;

// \${(.[^}]*)}     Your ${SpellBeingCast} spell is interrupted.
//                      Full match	47-63	{SpellBeingCast}
//                      Group 1.	n/a	SpellBeingCast
// \${SpellBeingCast}
// `{${storedVariables[matches[1]]}}`