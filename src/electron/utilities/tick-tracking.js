

/** @type {number|null} */
let eqTick = null;

/** @type {number[]} */
let outOfSyncEqTicks = [];

const resetEqTickOnCount = 3;

/** @type {number} */
let eqTickUpdate = 0;

/** @type {number|null} */
let eqTickIntervalId = null;

const eqTickMaxUpdateDistance = 60 * 1000;
const eqTickVariance = 1500;

/** @type {number|null} */
let eqTickTimeoutId = null;

/**
 * Starts tracking the server tick.
 * 
 * @param {number} time The eq tick time in milliseconds since midnight, January 1, 1970 UTC.
 */
let startEqTickTracking = ( time ) => {
    
    if ( eqTickTimeoutId > 0 ) {
        window.clearTimeout( eqTickTimeoutId );
    }
    if ( eqTickIntervalId > 0 ) {
        window.clearInterval( eqTickIntervalId );
    }

    // Set a timeout that will start the interval at the next server tick.
    eqTickTimeoutId = window.setTimeout( () => {

        // Set the current eq tick time.
        eqTick = new Date().getTime();

        // We should be synced with EQ time (for a bit at least) so let's start the 6 second interval tracking ticks.
        eqTickIntervalId = window.setInterval( () => {
            // Set the current eq tick time.
            eqTick = new Date().getTime();
        }, 6000 );

    // The duration of the timeout needs to sync the computer clock with the timestamp given from the log entry.
    }, time + ( 6 * 1000 ) - ( new Date().getTime() ) );
}

/**
 * Returns the next estimated EQ Server Tick for this character.
 * 
 * @returns {Date}
 */
let nextEqTick = () => {
    if ( eqTick > 0 ) {
        return new Date( eqTick + 6 * 1000 );
    } else {
        return null;
    }
}

/**
 * Sets the current tick value.
 * 
 * @param {Date} timestamp The timestamp of the tick.
 */
let setEqTick = ( timestamp ) => {
    if ( timestamp ) {
        let time = timestamp.getTime();

        let updateTime = new Date().getTime();
        let updateDistance = Math.abs( eqTickUpdate - updateTime );
        let nextTickTime = eqTick + 6 * 1000;

        let update = () => {
            eqTick = time;
            startEqTickTracking( time );
        }

        if ( updateDistance >= eqTickMaxUpdateDistance || Math.abs( nextTickTime - time ) > eqTickVariance ) {
            // If we haven't had a tick update in a while or the tick is way out of variance, then we'll just go with it.
            update();

        } else {

            if ( !outOfSyncEqTicks.includes( time ) ) {
                outOfSyncEqTicks.push( time );
            }

            // If the tick time is inside the variance amount for more than the configured number of distinct ticks, then let's update the tick timer.
            if ( outOfSyncEqTicks.length >= resetEqTickOnCount ) {
                update();
            }
        }
        


    }
}