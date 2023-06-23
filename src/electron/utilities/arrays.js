
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










/**
 * Enumerates through the givne dictionary, executing predicate for each item.
 * 
 * @param {Record<string, T>} dictionary The dictionary object.
 * @param {(item: T, key: string) => void} fn Predicate executed on each item.
 * @template T
 */
function _enumerateDictionary(dictionary, fn) {
    for ( let key in dictionary ) {
        if ( dictionary.hasOwnProperty( key ) ) {
            fn( dictionary[ key ], key );
        }
    }
}










/**
 * Returns the content size of the given list of strings.
 * 
 * @param {string[]} value The array of strings.
 */
function _getSize( value ) {
    let n = 0;
    value?.forEach( line => {
        n += line?.length ?? 0;
    } );
    return n;
}










/**
 * Pushes value into values, if values doesn't already contain value.
 * 
 * @template T
 * @param {T[]} values The array of T.
 * @param {T} value The value to push.
 */
function _distinctPush( values, value ) {
    if ( values != null && values.indexOf( value ) === -1 ) {
        values.push( value );
    }
}










/**
 * Combines the given arrays.
 * @returns {T[]}
 * @template T
 * @param {...T[]|T} arrays The array of T.
 */
function _concat( ...arrays ) {
    /** @type {T[]} */
    let output = [];

    for ( let i = 0; i < arrays?.length; i++ ) {
        if ( arrays[ i ] !== undefined && arrays[ i ] !== null ) {
            if ( arrays[ i ] instanceof Array ) {
                for ( let j = 0; j < arrays[ i ].length; j++ ) {
                    output.push( arrays[ i ][ j ] );
                }
            } else {
                output.push( arrays[ i ] );
            }
        }
    }

    return output;
}










const ArrayUtilities = {
    remove: remove,
    findIndex: findIndex,
    enumerateDictionary: _enumerateDictionary,
    getSize: _getSize,
    distinctPush: _distinctPush,
    concat: _concat,
};

module.exports = ArrayUtilities;
