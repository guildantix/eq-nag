
/**
 * Converts the given value into a shorthand string.
 * 
 *  ex:
 *      1234 => 1,234
 *      16457 => 16.5k
 *      102345 => 102k
 * 
 * @returns {string} Returns the string representation of the given value.
 * 
 * @param {string|number} value The value to convert.
 */
function toShorthandString( value ) {
    if ( value ) {
        let numeric = +value;
        if ( numeric < 1000 ) {
            return `${value}`;
        } else if ( numeric >= 1000 && numeric < 10000 ) {
            return numeric.toString().replace( /\B(?=(\d{3})+(?!\d))/g, "," );
        } else if ( numeric >= 10000 && numeric < 100000 ) {
            return `${round(numeric / 1000, 1)}k`;
        } else if ( numeric >= 100000 && numeric < 1000000 ) {
            return `${round(numeric / 1000, 0)}k`;
        } else if ( numeric >= 1000000 && numeric < 10000000 ) {
            return `${round(numeric / 1000000, 1)}m`;
        } else if ( numeric >= 10000000 ) {
            return `${round(numeric / 1000000, 0).toString().replace( /\B(?=(\d{3})+(?!\d))/g, "," )}m`;
        }
    }
}

/**
 * Rounds the given value to the given precision.
 * 
 * @param {number} value The value to round.
 * @param {number} precision The number of decimal places.
 */
function round( value, precision ) {
    var multiplier = Math.pow( 10, precision || 0 );
    return Math.round( value * multiplier ) / multiplier;
}

let NumberUtilities = {
    round: round,
    toShorthandString: toShorthandString,
};

module.exports = NumberUtilities;