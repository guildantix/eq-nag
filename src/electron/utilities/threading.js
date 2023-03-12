
/**
 * Sleeps the given number of milliseconds.
 * 
 * @param {number} duration The number of milliseconds to sleep.
 */
function sleep( duration ) {

    let p = new Promise( resolve => {
        setTimeout( () => {
            resolve();
        }, duration );
    } );

    return p;
}

const ThreadUtilities = {
    sleep: sleep,
};

module.exports = ThreadUtilities;
