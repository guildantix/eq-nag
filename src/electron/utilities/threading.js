
/**
 * Sleeps the given number of milliseconds.
 * 
 * @param {number} duration The number of milliseconds to sleep.
 */
function sleep( duration ) {
    return new Promise( resolve => window.setTimeout( resolve, duration ) );
}

const ThreadUtilities = {
    sleep: sleep,
};

module.exports = ThreadUtilities;
