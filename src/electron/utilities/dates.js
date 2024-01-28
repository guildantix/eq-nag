
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











/**
 * Adds the given millseconds to the given date value.
 * 
 * @param {Date} value The original date value.
 * @param {number} milliseconds The number of milliseconds to add.
 * @returns Returns a new Date instance.
 */
function _addMilliseconds( value, milliseconds ) {
    return new Date( value.getTime() + milliseconds );
}










/**
 * Adds the given days to the given date value.
 * 
 * @param {Date} value The original date value.
 * @param {number} seconds The number of seconds to add.
 * @returns Returns a new Date instance.
 */
function _addDays( value, days ) {
    return new Date( value.getTime() + days * 1000 * 60 * 60 * 24 );
}










/**
 * Returns a label for the given duration.
 * 
 * @param {number} duration The duration, in seconds.
 */
function _getDurationLabel( duration ) {
    if ( duration > 60 ) {
        let d = Math.ceil( duration );
        let hrs = Math.floor( d / 3600 );
        let mins = Math.floor( ( d % 3600 ) / 60 );
        let secs = d % 60;
        
        let label = '';
        if ( hrs > 0 ) {
            label += `${hrs}h ${mins}m ${secs}s`;
        } else if ( mins > 0 ) {
            label += `${mins}m ${secs}s`;
        } else if ( secs > 0 ) {
            label += `${secs}s`;
        }

        return label;
    } else {
        return `${Math.ceil(duration)}s`;
    }
}










const DateUtilities = {
    timeSince: _timeSince,
    addSeconds: _addSeconds,
    addMilliseconds: _addMilliseconds,
    addDays: _addDays,
    getDurationLabel: _getDurationLabel,
};

module.exports = { DateUtilities, TimeSpan };
