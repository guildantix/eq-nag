
class TimeSpan {
    
    /** @type {number} */
    #millliseconds;
    
    /** @type {number} */
    get totalMilliseconds() {
        return this.#millliseconds;
    }

    /** @type {number} */
    get totalSeconds() {
        return Math.floor( this.#millliseconds / 1000 );
    }
    
    /** @type {number} */
    get totalMinutes() {
        return Math.floor( this.totalSeconds / 60 );
    }
    
    /** @type {number} */
    get totalHours() {
        return Math.floor( this.totalMinutes / 60 );
    }

    /** @type {number} */
    get totalDays() {
        return Math.floor( This.totalHours / 24 );
    }

    constructor( milliseconds ) {
        this.#millliseconds = milliseconds;
    }

}










/**
 * Calculates the amount of time between the two given dates.
 * 
 * @param {Date} start The starting time.
 * @param {Date} end The ending time.
 * @returns {TimeSpan} Returns the amount of time from start to end.
 */
function _timeSince( start, end ) {
    let delta = end.getTime() - start.getTime();

    if ( delta < 0 ) {
        delta = 0;
    }
    
    return new TimeSpan(delta);
}










/**
 * Adds the given seconds to the given date value.
 * 
 * @param {Date} value The original date value.
 * @param {number} seconds The number of seconds to add.
 * @returns Returns a new Date instance.
 */
function _addSeconds( value, seconds ) {
    return new Date( value.getTime() + seconds * 1000 );
}










const DateUtilities = {
    timeSince: _timeSince,
    addSeconds: _addSeconds,
};

module.exports = { DateUtilities, TimeSpan };
