
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
            //value = value.replace(/\${SpellBeingCast}/g, 'Envenomed Bolt');
            if ( storedVariables[ result[ i ] ] ) {
                value = value.replace( RegExp( `\\\${${result[ i ]}}`, 'g' ), storedVariables[ result[ i ] ] );
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
            //value = value.replace(/\${SpellBeingCast}/g, 'Envenomed Bolt');
            if ( storedVariables[ result[ i ] ] ) {
                value = value.replace( RegExp( `\\\${${result[ i ]}}`, 'g' ), storedVariables[ result[ i ] ] );
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

let StringUtilities = {
    format: format,
    parseStoredVariablesToRegex: parseStoredVariablesToRegex,
    parseStoredVariablesToLiteral: parseStoredVariablesToLiteral,
};

module.exports = StringUtilities;

// \${(.[^}]*)}     Your ${SpellBeingCast} spell is interrupted.
//                      Full match	47-63	{SpellBeingCast}
//                      Group 1.	n/a	SpellBeingCast
// \${SpellBeingCast}
// `{${storedVariables[matches[1]]}}`