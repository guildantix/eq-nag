
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
 * Returns true if the given value contains the given flag.
 * 
 * @returns {boolean} Returns true if the given value contains the given flag.
 * 
 * @param {number} value The value that may contain the given flag.
 * @param {number} flag The flag to check for.
 */
function hasFlag( value, flag ) {
    return ( value & flag ) === flag;
}

/**
 * Adds the given flag to the given value.
 * 
 * @returns {number} Returns the value with the flag added.
 * 
 * @param {number} value The value to add the flag to.
 * @param {number} flag The flag to add.
 */
function addFlag( value, flag ) {
    return value | flag;
}

/**
 * Removes the given flag from the given value.
 * 
 * @returns {number} Returns the value with the flag removed.
 * 
 * @param {number} value The value to remove the flag from.
 * @param {number} flag The flag to remove.
 */
function removeFlag( value, flag ) {
    return value & ~flag;
}

/**
 * Toggles the given flag on the given value.
 * 
 * @returns {number} Returns the value with the flag toggled.
 * 
 * @param {number} value The value to toggle the flag on.
 * @param {number} flag The flag to toggle.
 */
function toggleFlag( value, flag ) {
    return value ^ flag;
}

/**
 * Rounds the given value to the given precision.
 * 
 * @param {number} value The value to round.
 * @param {number} precision The number of decimal places.
 */
function round( value, precision ) {
    var multiplier = Math.pow( 10, precision || 0 );
    return Math.round( ( value + Number.EPSILON ) * multiplier ) / multiplier;
}

/**
 * Returns a whole number between the given min and max bounds.
 * 
 * @param {number} min The inclusive minimum bounds of the random number.
 * @param {number} max The exclusive maximum bounds of the random number.
 */
function randomBounded( min, max ) {
    return Math.floor( Math.random() * ( max - min ) ) + min;
}

/**
 * Returns true if the given rectangle contains the specified point.
 * 
 * @param {Electron.Rectangle} rect The containing rectangle
 * @param {number} x The x position.
 * @param {number} y The y position.
 */
function rectContainsPoint( rect, x, y ) {
    let xContained = x >= rect.x && y <= ( rect.x + rect.width );
    let yContained = y >= rect.y && y <= ( rect.y + rect.height );

    return xContained && yContained;
}

let NumberUtilities = {
    round: round,
    toShorthandString: toShorthandString,
    randomBounded: randomBounded,
    rectContainsPoint: rectContainsPoint,
    hasFlag: hasFlag,
    addFlag: addFlag,
    removeFlag: removeFlag,
    toggleFlag: toggleFlag,
};

module.exports = NumberUtilities;
