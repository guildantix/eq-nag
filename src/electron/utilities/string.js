
function format( format, args ) {
    return format.replace( /{(\d+)}/g, function ( match, number ) {
        return typeof args[ number ] != 'undefined' ? args[ number ] : match;
    } );
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

function parseStoredVariablesToLiteral( value, storedVariables ) {
    // \${(.[^}]*)}     Your ${SpellBeingCast} spell is interrupted.
    //                      Full match	47-63	{SpellBeingCast}
    //                      Group 1.	n/a	SpellBeingCast
    let result = /\${(.[^}]*)}/g.exec( value );
    
    if ( result?.length > 1 ) {
        for ( let i = 1; i < result.length; i++ ) {
            let values = storedVariables[ result[ i ] ];
            let text = values[ 0 ];
            for ( let i = 1; i < values.length; i++ ) {
                text += ',' + values[ i ];
            }
            
            //value = value.replace(/\${SpellBeingCast}/g, 'Envenomed Bolt, Pyre of Mori');
            if ( values?.length > 0 ) {
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
    parseStoredVariablesToRegex: parseStoredVariablesToRegex,
    parseStoredVariablesToLiteral: parseStoredVariablesToLiteral,
    parseStoredVariablesToLiteralArray: parseStoredVariablesToLiteralArray,
    parseConditionResultsToLiteral: parseConditionResultsToLiteral,
};

module.exports = StringUtilities;

// \${(.[^}]*)}     Your ${SpellBeingCast} spell is interrupted.
//                      Full match	47-63	{SpellBeingCast}
//                      Group 1.	n/a	SpellBeingCast
// \${SpellBeingCast}
// `{${storedVariables[matches[1]]}}`