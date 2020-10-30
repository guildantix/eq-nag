
/**
 * Removes all elements the predicate returns truthy for.
 * 
 * @returns {Array} Returns an array of removed elements.
 * 
 * @param {Array} array The array to modify.
 * @param {Function} predicate The function executed per iteration.
 */
function remove( array, predicate ) {
    return _remove( array, predicate, [] );
}

/**
 * Returns the first index the predicate returns truthy for.
 * 
 * @param {Array} array The array to iterate.
 * @param {Function} predicate The function executed per iteration.
 */
function findIndex( array, predicate ) {
    if ( array?.length > 0 ) {
        for ( let i = 0; i < array.length; i++ ) {
            if ( predicate( array[ i ] ) ) {
                return i;
            }
        }
    }
}

/**
 * Removes all elements the predicate returns truthy for.
 * 
 * @param {Array} array The array to modify.
 * @param {Function} predicate The function executed per iteration.
 * @param {Array} removed The list of removed items.
 */
function _remove( array, predicate, removed ) {
    if ( array?.length > 0 ) {
        for ( let i = 0; i < array.length; i++ ) {
            if ( predicate( array[ i ] ) ) {
                removed.push( array.splice( i, 1 ) );
                return _remove( array, predicate, removed );
            }
        }
    }

    return -1;
}

let ArrayUtilities = {
    remove: remove,
    findIndex: findIndex,
};

module.exports = ArrayUtilities;
