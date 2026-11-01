const { result } = require( "lodash" );
const {
    NConditionalModel,
    NConditionalOperationModel,
    VConditionalModel,
    VConditionalOperationModel,
    LConditionalModel,
    LConditionalOperationModel,
    SConditionalModel,
    SConditionalOperationModel,
} = require( "../data/models/common" );
const { nagId } = require( "./nag-id" );










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
    if ( value === null || value === undefined || value.trim().length === 0 ) {
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

                let captureGroupRgx = '(?<' + result[ i ] + '>' + getEscapedString( values[ 0 ] );
                for ( let i = 1; i < values.length; i++ ) {
                    captureGroupRgx += '|' + getEscapedString( values[ i ] );
                }
                captureGroupRgx += ')';
                
                value = value.replace( RegExp( `\\\${${result[ i ]}}`, 'g' ), captureGroupRgx );
            }
        }
    }
    return value;
}

/**
 * Parses the given string, inserting regular expression named groups where matched with ?{name_of_var}.
 * 
 * @returns {VConditionalModel} Returns an VConditionalModel object.
 * 
 * @param {string} value The string value to parse.
 */
function parseStoredVariablesToRegexConditional( value ) {
    // \${(.[^}]*)}     Your ${SpellBeingCast} spell is interrupted.
    //                      Full match	47-63	{SpellBeingCast}
    //                      Group 1.	n/a	SpellBeingCast
    let result = /\${(.[^}]*)}/g.exec( value );
    const output = {
        value: value,
        operations: [],
    };
    
    if ( result?.length > 1 ) {
        for ( let i = 1; i < result.length; i++ ) {

            // What this will do is create a random name for the capture group and build a validator
            // function that will check the stored variables for a match.
            // ex:
            //      storedVariables['SpellBeingCast'] = ['Envenomed Bolt', 'Pyre of Mori']
            //      ${SpellBeingCast} => (?<a1b2c3d4e5f6g7>.+?)
            //      vConditional.key = 'SpellBeingCast'
            //      vConditional.name = 'a1b2c3d4e5f6g7'
            //      vConditional.value = value.replace( /\${SpellBeingCast}/g, '(?<a1b2c3d4e5f6g7>.+?)' );
            //
            // The validator function will then check the stored variables for a match. If a1b2c3d4e5f6g7 is in SpellBeingCast, it will return true.

            /** @type {VConditionalOperationModel} */
            const vConditional = {};

            vConditional.key = result[ i ];
            vConditional.name = 'nag_' + nagId();

            let captureGroupRgx = `(?<${vConditional.name}>.+?)`;
            output.value = value.replace( RegExp( `\\\${${result[ i ]}}`, 'g' ), captureGroupRgx );

            vConditional.validatorFn = ( match, storedVariables ) => {
                if ( match?.groups[ vConditional.name ] ) {
                    const values = storedVariables[ vConditional.key ];
                    if ( values?.length > 0 ) {
                        for ( let i = 0; i < values.length; i++ ) {
                            if ( compare( match.groups[ vConditional.name ], values[ i ] ) ) {
                                // Update the match group, adding a value for the key.
                                match.groups[ vConditional.key ] = values[ i ];
                                return true;
                            }
                        }
                    }
                }
                return false;
            };

            // We are adding a sequential validator function to the vConditional object here because it's already processed the ${name} and cannot do this again.
            // The difference is the sequential validator function will check the match against the sequentialMatch value, which is another RegExpExecArray.
            // So, the name is what matched in the log entry, and the key is what matched in a previous log entry on the same sequential trigger.
            vConditional.seqValidatorFn = ( match, sequentialMatch ) => {
                if ( match?.groups[ vConditional.name ] ) {
                    const value = sequentialMatch?.groups[ vConditional.key ];
                    if ( compare( match.groups[ vConditional.name ], value ) ) {
                        // Update the match group, adding a value for the key.
                        match.groups[ vConditional.key ] = value;
                        return true;
                    }
                }
                return false;
            }
            
            output.operations.push( vConditional );
        }
    }

    return output;
}










/**
 * Returns the given value with escaped regex characters.
 * 
 * @param {string} value The value to escape.
 */
function getEscapedString( value ) {
    return value.replace( /[-\/\\^$*+?.()|[\]{}]/g, '\\$&' );
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
    if ( isNullOrWhitespace( value ) ) {
        return value;
    }

    // \${(.[^}]*)}     Your ${SpellBeingCast} spell is interrupted.
    //                      Full match	47-63	{SpellBeingCast}
    //                      Group 1.	n/a	SpellBeingCast
    let namedResults = [ ...value.matchAll( /\${(.[^}]*)}/g ) ];
    
    if ( namedResults?.length > 0 ) {
        for ( let m = 0; m < namedResults.length; m++ ) {
            let key = namedResults[ m ][ 1 ];
            let values = storedVariables[ key ];
            if ( values?.length > 0 ) {
                let text = values[ 0 ];
                
                for ( let i = 1; i < values.length; i++ ) {
                    text += ',' + values[ i ];
                }
            
                value = value.replace( RegExp( `\\\${${key}}`, 'g' ), text );
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
        'VI': 'six',
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
 * Replaces named group matches in the given string from the dictionary, using static regex named groups and conditionals.
 * 
 * @returns {SConditionalModel} Returns an SConditionalModel object.
 * 
 * @param {string} value The value that may contain references to regex named groups.
 */
function parseSequentialGroupsToRegexConditionals( value ) {
    /** @type {SConditionalModel} */
    const output = {
        value: value,
        operations: [],
    };

    // \${(.[^}]*)}     Your ${SpellBeingCast} spell is interrupted.
    //                      Full match	47-63	{SpellBeingCast}
    //                      Group 1.	n/a	SpellBeingCast
    let namedResults = [ ...value.matchAll( /\?{(.[^}]*)}/g ) ];

    // (?<nag_seq_${key}>.+?)
    // returns a function that takes in the groups, and returns true/false if key matches. This happens after the regex has been executed.
    
    if ( namedResults?.length > 0 ) {
        for ( let m = 0; m < namedResults.length; m++ ) {

            /** @type {SConditionalOperationModel} */
            const sConditional = {};

            sConditional.key = namedResults[ m ][ 1 ];
            sConditional.name = 'nag_' + nagId();

            const captureGroupRgx = `(?<${sConditional.name}>.+?)`;
            output.value = value.replace( RegExp( `\\?{${sConditional.key}}`, 'g' ), captureGroupRgx );

            sConditional.validatorFn = ( match, sequentialMatch ) => {
                if ( match?.groups[ sConditional.name ] ) {
                    const value = sequentialMatch?.groups[ sConditional.key ];
                    if ( compare( match.groups[ sConditional.name ], value ) ) {
                        // Update the match group, adding a value for the key.
                        match.groups[ sConditional.key ] = value;
                        return true;
                    }
                }
                return false;
            }
            
            output.operations.push( sConditional );
        }
    }
    
    return output;
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
    //
    // Having alternate syntax including ${1} and {1}.
    let indexedResults = [ ...value.matchAll( /(:?#|\$)?{([0-9]+?)}/g ) ];

    if ( indexedResults?.length > 0 ) {
        for ( let i = 0; i < indexedResults.length; i++ ) {
            // ex: matches[2] == 'Soandso'
            //  when given the phrase
            //      (.+?) has been slain by (.+?)!
            //  matches the log entry
            //      Mob Name A has been slain by Soandso!
            let index = +indexedResults[ i ][ indexedResults[ i ].length - 1 ];
            if ( matches[ index ] != null ) {
                if ( indexedResults[ i ][ 1 ] === '$' || indexedResults[ i ][ 1 ] === '#' ) {
                    value = value.replace( RegExp( `(#|\\$)\\{${index}\\}`, 'g' ), matches[ index ] );
                } else {
                    value = value.replace( RegExp( `\\{${index}\\}`, 'g' ), matches[ index ] );
                }
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
        let secs = seconds % 60; // Simplified from 'seconds % 3600 % 60' (mathematically equivalent, but cleaner)

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
        let matches = [ ...label.matchAll( /(?<hours>[0-9]+(?:\.[0-9]+)?)\s*h|(?<minutes>[0-9]+(?:\.[0-9]+)?)\s*m|(?<seconds>[0-9]+(?:\.[0-9]+)?)\s*s/gi ) ];
        if ( matches?.length > 0 ) {
            let duration = 0;

            matches.forEach( m => {
                if ( m.groups.hours ) {
                    duration += parseFloat( m.groups.hours ) * 3600;
                } else if ( m.groups.minutes ) {
                    duration += parseFloat( m.groups.minutes ) * 60;
                } else if ( m.groups.seconds ) {
                    duration += parseFloat( m.groups.seconds );
                }
            } );

            return duration;
        }
        // Fixed: Wrap hours and its colon together in optional group to prevent mismatching.
        // Before:   (?<hours>[0-9]+)?:?  would match '9' as hours in '90:00' (treating '0' as the optional colon)
        // After: (?:(?<hours>[0-9]+):)?  requires the colon to be present with hours, so '90:00' correctly matches as MM:SS
        let milMatches = /(?:(?<hours>[0-9]+):)?(?<minutes>[0-9]+):(?<seconds>[0-9]+)/gi.exec( label );
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
    // Keep these patterns in sync with src/app/utilities/regex-highlighter.utilities.ts.

    if ( value ) {
        // {LN} => list name
        // https://regex101.com/r/BpKeMw/1
        value = value.replace( /{LN}/gi, `(?<nag_listname>.+?)` );

        // {TS} => timer duration (hours, minutes, seconds, or time formats)
        // https://regex101.com/r/rsx53o/1
        // Linearized: (?<timerDuration>(?:\b[0-9]+:[0-9]+(?::[0-9]+)?\b|\b[0-9]+(?:\.[0-9]+)?\s*(?:(?:h(?:ou)?r|min(?:ute)?|sec(?:ond)?)(?:[(]s[)]|s)?|[hms])(?![A-Za-z])(?:\s*[0-9]+(?:\.[0-9]+)?\s*(?:(?:h(?:ou)?r|min(?:ute)?|sec(?:ond)?)(?:[(]s[)]|s)?|[hms])(?![A-Za-z]))*(?:\s*[0-9]+(?:\.[0-9]+)?\b)?|\b[0-9]+(?:\.[0-9]+)?\b))
        // Order of alternation matters here. 1) Time format. 2) Unit based. 3) Plain number.
        // Matches timer durations in these formats:
        //  - HH:MM(:SS) with 1+ digits per unit, e.g. "1:23", "12:34:56"
        //  - Unit-based: "<num><unit>" with optional decimals, spaces, repeats
        //      e.g. "5h", "10 min", "2.5hours", "1min(s) 30s", "2h30m"
        //  - Supports plural "s" or "(s)" for hours/minutes/seconds
        //  - Single-letter units h/m/s (not pluralized)
        //  - Plain numbers allowed, e.g. "120", for seconds. Optional decimals.
        const UNIT_PATTERN = 
            '(?:' +
                '(?:h(?:ou)?r|min(?:ute)?|sec(?:ond)?)' + // hr, hour | min, minute | sec, second
                '(?:[(]s[)]|s)?' + // character classes for parenthesis, avoid double escaping, that is just a source for errors 
            '|' +
                '[hms]' + // single char units can not be pluralized. Checked separately.
            ')' +
            '(?![A-Za-z])'; // Not followed by a letter, so "19 more" isn't read as "19 m" but "1h30m" still works.

        value = value.replace(
            /{TS}/i,
            '(?<timerDuration>' +
                '(?:' +
                    
                    // HH:MM:SS or MM:SS format, open for 1+ digit per unit, as the parser accepts that.
                    '\\b' +
                    '[0-9]+' +
                    ':' +
                    '[0-9]+' +
                    '(?:' +
                        ':' +
                        '[0-9]+' +
                    ')?' +
                    '\\b' +
                    
                '|' +
                    
                    // Unit-based formats
                    '\\b' +
                    '[0-9]+' +
                    '(?:' +
                        '\\.' +
                        '[0-9]+' +
                    ')?' +
                    '\\s*' +
                    UNIT_PATTERN +
                    '(?:' + 
                        '\\s*' +
                        '[0-9]+' +
                        '(?:' +
                            '\\.' +
                            '[0-9]+' +
                        ')?' +
                        '\\s*' +
                        UNIT_PATTERN +
                    ')*' +  // '*' repeat instead of {,2} allows for some fun styling: Mike tells the guild, 'Timer: 1m 2m 3m 4m ten minute break'
                    // A trailing number without a unit, e.g. "1h30". These matched before
                    // this pattern was rewritten; the number is ignored when the
                    // duration is calculated, as it was then.
                    '(?:' +
                        '\\s*' +
                        '[0-9]+' +
                        '(?:' +
                            '\\.' +
                            '[0-9]+' +
                        ')?' +
                        '\\b' +
                    ')?' +
                    
                '|' +
                    
                    // Plain numbers
                    '\\b' +
                    '[0-9]+' +
                    '(?:' +
                        '\\.' +
                        '[0-9]+' +
                    ')?' +
                    '\\b' +
                    
                ')' +
            ')'
        );


        // {C} => current character name
        value = value.replace( /{C}/gi, characterName );

        // ${Character} => current character name
        value = value.replace( /\${Character}/gi, characterName );

        // {S}, {S1}, {S2}, etc. => lazy captures
        // https://regex101.com/r/k4eq0f/1
        value = value.replace( /{S([0-9]*?)}/gi, '(?<S$1>.+?)' );

        // {N}, {N1}, {N2}, etc. => greedy numeric captures
        value = value.replace( /{N([0-9]*?)}/gi, '(?<N$1>[0-9]+)' );

        /*
        // We may add this in the future, just not sure how to accomplish this.  WE use counter names instead of just {COUNTER} however.
        value = value.replace( /{COUNTER}/gi, '' );
        */
    }

    return value;
}










/**
 * Updates the given phrase, replacing matching list values with the list 
 * values by 1-based index.
 * 
 * @description https://regex101.com/r/jsiqH1/1
 * 
 * @param {string} value The phrase to search.
 * @param {string[] | undefined} list The list of values to search for.
 * @param {string} myCharacterName The name of the current character.
 */
function parseListCodesToLiteral( value, list, myCharacterName ) {

    if ( list != undefined ) {
        let listMatches = [ ...value.matchAll( /{L([0-9]*?)}/gi ) ];

        if ( listMatches?.length > 0 ) {
            for ( let i = listMatches.length - 1; i >= 0; i-- ) {
                let valueIndex = +listMatches[ i ][ 1 ] - 1;
                let strIndex = listMatches[ i ].index;
                let length = listMatches[ i ].length + 2;
                var v = list[ valueIndex ] ?? '';

                if ( v.toLowerCase() == myCharacterName.toLowerCase() ) {
                    v = `(?:y|Y)(?:o|O)(?:u|U)`;
                }

                value = value.substring( 0, strIndex ) + ( v ) + value.substring( strIndex + length );
            }
        }
    }
    
    return value;
}

/**
 * Parses the given phrase and converts any list codes into proper regex conditionals.  If a conversion occurs, a list of validation functions will be included in the result.
 * 
 * @returns {LConditionalModel} Returns an VConditionalModel object.
 * 
 * @param {string} value The phrase to search.
 */
function parseListCodesToRegexConditionals( value ) {
    /** @type {LConditionalModel} */
    const output = {
        value: value,
        operations: [],
    };

    let listMatches = [ ...value.matchAll( /{L([0-9]*?)}/gi ) ];

    if ( listMatches?.length > 0 ) {
        for ( let i = listMatches.length - 1; i >= 0; i-- ) {
            // let valueIndex = +listMatches[ i ][ 1 ] - 1;
            // let strIndex = listMatches[ i ].index;
            // let length = listMatches[ i ].length + 2;
            // var v = list[ valueIndex ] ?? '';

            // if ( v.toLowerCase() == myCharacterName.toLowerCase() ) {
            //     v = `(?:y|Y)(?:o|O)(?:u|U)`;
            // }

            // value = value.substring( 0, strIndex ) + ( v ) + value.substring( strIndex + length );

            /** @type {LConditionalOperationModel} */
            const lConditional = {};

            lConditional.index = +listMatches[ i ][ 1 ] - 1;
            lConditional.name = 'nag_' + nagId();

            const captureGroupRgx = `(?<${lConditional.name}>.+?)`;
            output.value = value.replace( RegExp( `{L${lConditional.index + 1}}`, 'g' ), captureGroupRgx );

            lConditional.validatorFn = ( match, list, myCharacterName ) => {
                if ( match?.groups[ lConditional.name ] ) {
                    const value = list[ lConditional.index ];
                    // If the value is the same as the character name, we want to match it as a "you" value.
                    if ( value.toLowerCase() == myCharacterName.toLowerCase() ) {
                        if ( compare( match.groups[ lConditional.name ], 'you', false ) ) {
                            // Update the match group, adding a value for the key.
                            match.groups[ 'L' + ( lConditional.index + 1 ) ] = 'you';
                            return true;
                        }
                    } else if ( value != null ) {
                        // Otherwise, we want to compare the value to the match.
                        if ( compare( match.groups[ lConditional.name ], value ) ) {
                            // Update the match group, adding a value for the key.
                            match.groups[ 'L' + ( lConditional.index + 1 ) ] = value;
                            return true;
                        }
                    }
                }
                return false;
            };
                
            output.operations.push( lConditional );
        }
    }

    return output;
}










/**
 * Parses the given phrase and converts any conditional n values into proper regular expressions.  If a conversion occurs, a list of validation functions will be included in the result.
 * 
 * @returns {NConditionalModel | undefined} 
 * 
 * @param {string} value The phrase to search.
 */
function parseNConditionalCodesToRegex( value ) {
    if ( isNullOrWhitespace( value ) ) {
        return undefined;
    }
    
    // Functional matches:
    // {N>=9000} => (?<N>[0-9]+?), with a validation function.

    /** @type {NConditionalModel} */
    let output = {};
    let ginaMatches = [ ...value.matchAll( /{N([0-9]*?)(>|>=|<|<=|=|!=)([0-9]*?)}/gi ) ];

    if ( ginaMatches?.length > 0 ) {
        output.value = value.replace( /{N([0-9]*?)(>|>=|<|<=|=|!=)([0-9]*?)}/gi, '(?<N$1>-?[0-9]+)' );
        output.operations = [];
        ginaMatches.forEach( m => {
            let operator = m[ 2 ];
            let opVal = +m[ 3 ];
            /** @type {NConditionalOperationModel} */
            let operation = {
                nIndex: +m[ 1 ] > 0 ? +m[ 1 ] : undefined,
                validateFns: [],
            };

            if ( operator === '>' ) {
                operation.validateFns.push( ( nValue ) => {
                    return nValue > opVal;
                } );
            } else if ( operator === '>=' ) {
                operation.validateFns.push( ( nValue ) => {
                    return nValue >= opVal;
                } );
            } else if ( operator === '<' ) {
                operation.validateFns.push( ( nValue ) => {
                    return nValue < opVal;
                } );
            } else if ( operator === '<=' ) {
                operation.validateFns.push( ( nValue ) => {
                    return nValue <= opVal;
                } );
            } else if ( operator === '=' ) {
                operation.validateFns.push( ( nValue ) => {
                    return nValue == opVal;
                } );
            } else if ( operator === '!=' ) {
                operation.validateFns.push( ( nValue ) => {
                    return nValue != opVal;
                } );
            }

            output.operations.push( operation );
        } );
        return output;
    }

    let nagMatches = [ ...value.matchAll( /{N([0-9]*?)(\[|\()(.*?),(.*?)(\]|\))}/gi ) ];
    
    if ( nagMatches?.length > 0 ) {
        output.value = value.replace( /{N([0-9]*?)(\[|\()(.*?),(.*?)(\]|\))}/gi, '(?<N$1>-?[0-9]+)' );
        output.operations = [];
        nagMatches.forEach( m => {
            let nIndex = +m[ 1 ];
            let leftHandeOp = m[ 2 ];
            let opVal1 = m[ 3 ].match( /[A-z]+/ ) || m[ 3 ] === '' ? undefined : +m[ 3 ];
            let opVal2 = m[ 4 ].match( /[A-z]+/ ) || m[ 4 ] === '' ? undefined : +m[ 4 ];
            let rightHandeOp = m[ 5 ];

            /** @type {NConditionalOperationModel} */
            let operation = {
                nIndex: nIndex > 0 ? nIndex : undefined,
                validateFns: [],
            };

            if ( leftHandeOp === '[' ) {
                operation.validateFns.push( ( nValue ) => {
                    return opVal1 === undefined || nValue >= opVal1;
                } );
            } else if ( leftHandeOp === '(' ) {
                operation.validateFns.push( ( nValue ) => {
                    return opVal1 === undefined || nValue > opVal1;
                } );
            }

            if ( rightHandeOp === ']' ) {
                operation.validateFns.push( ( nValue ) => {
                    return opVal2 === undefined || nValue <= opVal2;
                } );
            } else if ( rightHandeOp === ')' ) {
                operation.validateFns.push( ( nValue ) => {
                    return opVal2 === undefined || nValue < opVal2;
                } );
            }

            output.operations.push( operation );
        } );
        return output;
    }

    return undefined;
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










let StringUtilities = {
    format: format,
    isNullOrWhitespace: isNullOrWhitespace,
    parseStoredVariablesToRegex: parseStoredVariablesToRegex,
    parseStoredVariablesToRegexConditional: parseStoredVariablesToRegexConditional,
    parseStoredVariablesToLiteral: parseStoredVariablesToLiteral,
    parseStoredVariablesToLiteralArray: parseStoredVariablesToLiteralArray,
    parseConditionResultsToLiteral: parseConditionResultsToLiteral,
    parseMatchesToLiteral: parseMatchesToLiteral,
    parseCountersToLiteral: parseCountersToLiteral,
    parseSequentialGroups: parseSequentialGroups,
    parsePhoneticTransformsToLiteral: parsePhoneticTransformsToLiteral,
    parseShortCodeValuesToLiteral: parseShortCodeValuesToLiteral,
    parseShortCodesToRegex: parseShortCodesToRegex,
    parseListCodesToLiteral: parseListCodesToLiteral,
    parseSequentialGroupsToRegexConditionals: parseSequentialGroupsToRegexConditionals,
    parseListCodesToRegexConditionals: parseListCodesToRegexConditionals,
    parseNConditionalCodesToRegex: parseNConditionalCodesToRegex,
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