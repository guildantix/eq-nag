
function format( format, args ) {
    return format.replace( /{(\d+)}/g, function ( match, number ) {
        return typeof args[ number ] != 'undefined' ? args[ number ] : match;
    } );
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

function parseStoredVariablesToLiteral( value, storedVariables ) {
    // \${(.[^}]*)}     Your ${SpellBeingCast} spell is interrupted.
    //                      Full match	47-63	{SpellBeingCast}
    //                      Group 1.	n/a	SpellBeingCast
    let result = /\${(.[^}]*)}/g.exec( value );
    
    if ( result?.length > 1 ) {
        for ( let i = 1; i < result.length; i++ ) {
            let values = storedVariables[ result[ i ] ];
            //value = value.replace(/\${SpellBeingCast}/g, 'Envenomed Bolt, Pyre of Mori');
            if ( values?.length > 0 ) {
                let text = values[ 0 ];
                
                for ( let i = 1; i < values.length; i++ ) {
                    text += ',' + values[ i ];
                }
            
                value = value.replace( RegExp( `\\\${${result[ i ]}}`, 'g' ), text );
            }
            // value = value.replace( RegExp( `\\\${${result[ i ]}}`, 'g' ), storedVariables[ result[ i ] ] );
            // let _reg = new RegExp( `{\\$${result[ i ]}}`, 'g' );
            // value = value.replace( _reg, storedVariables[ result[ i ] ] );
        }
        // for ( let key in storedVariables ) {
        //     if ( storedVariables.hasOwnProperty( key ) ) {
        //         let _reg = new RegExp( `{${storedVariables[ matches[ 1 ] ]}}`, 'g' );
        //     }
        // }
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

function parseMatchesToLiteral( value, matches ) {
    if ( isNullOrWhitespace( value ) ) {
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

            if ( matches.groups[ key ] != null ) {
                value = value.replace( RegExp( `\\\${${key}}`, 'g' ), matches.groups[ key ] );
            }
        }
        // for ( let i = 1; i < result.length; i++ ) {
        //     //value = value.replace(/\${target}/g, 'A Slimy Weasel');
        //     //value = value.replace(/\{1}/g, 'A Slimy Weasel');
        //     if ( conditionResults[ result[ i ] ] ) {
        //         value = value.replace( RegExp( `\\\${${result[ i ]}}`, 'g' ), conditionResults[ result[ i ] ] );
        //     }
        // }
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

function parseStoredVariablesToLiteralArray( value, storedVariables ) {
    // \${(.[^}]*)}     Your ${SpellBeingCast} spell is interrupted.
    //                      Full match	47-63	{SpellBeingCast}
    //                      Group 1.	n/a	SpellBeingCast
    let result = /\${(.[^}]*)}/g.exec( value );
    let literals = [];

    if ( result?.length > 1 ) {
        for ( let i = 1; i < result.length; i++ ) {
            let values = storedVariables[ result[ i ] ];
            //value = value.replace(/\${SpellBeingCast}/g, 'Envenomed Bolt');
            if ( values?.length > 0 ) {
                // let text = values[ 0 ];
                for ( let i = 1; i < values.length; i++ ) {
                    literals.push( value.replace( RegExp( `\\\${${result[ i ]}}`, 'g' ), values[ i ] ) );
                    // text += ',' + values[ i ];
                }
                // value = value.replace( RegExp( `\\\${${result[ i ]}}`, 'g' ), text );
            }
            // value = value.replace( RegExp( `\\\${${result[ i ]}}`, 'g' ), storedVariables[ result[ i ] ] );
            // let _reg = new RegExp( `{\\$${result[ i ]}}`, 'g' );
            // value = value.replace( _reg, storedVariables[ result[ i ] ] );
        }
        // for ( let key in storedVariables ) {
        //     if ( storedVariables.hasOwnProperty( key ) ) {
        //         let _reg = new RegExp( `{${storedVariables[ matches[ 1 ] ]}}`, 'g' );
        //     }
        // }
    } else {
        literals.push( value );
    }

    return literals;
}

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
};

module.exports = StringUtilities;

// \${(.[^}]*)}     Your ${SpellBeingCast} spell is interrupted.
//                      Full match	47-63	{SpellBeingCast}
//                      Group 1.	n/a	SpellBeingCast
// \${SpellBeingCast}
// `{${storedVariables[matches[1]]}}`