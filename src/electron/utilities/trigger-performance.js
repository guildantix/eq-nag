// The Performance Monitor (Triggers menu → Performance Monitor) shows how much
// time each trigger costs: each phrase checked against the log, each action
// as it runs, and each action as the overlay draws it.
//
// This file runs inside the windows that do the work (each character's log
// watcher and the overlay window). Each window collects its own numbers and
// sends them to the main process every couple of seconds, where they're
// combined for the Performance Monitor (trigger-performance-monitor.js).
//
// When the monitor is off, nothing here runs per log line: the log watcher
// only adds the timing code to its triggers while the monitor is on.

const { ipcRenderer } = require( 'electron' );
const { ActionTypes, getActionLabel } = require( '../data/models/trigger' );

// Node's clock, not the browser's: Chromium rounds the browser's
// performance.now() to a tenth of a millisecond in these windows, and most
// phrases take about a thousandth of a millisecond.
const { performance } = require( 'perf_hooks' );

/** How often each window sends its numbers to the main process. */
const reportIntervalMilliseconds = 2000;

/** The longest text shown for a phrase or display text. */
const maximumLabelLength = 120;

/**
 * What a measurement is of. The Performance Monitor groups and labels rows
 * by these.
 */
const MeasureKinds = {
    phrase: 'phrase',
    conditions: 'conditions',
    watchedPhrases: 'watched-phrases',
    action: 'action',
    draw: 'draw',
    update: 'update',
};










/**
 * The trigger a measurement belongs to, or a made-up one for work that isn't a trigger's, like
 * combat text.
 */
class PerformanceTrigger {

    /** The trigger's id, or a made-up id like "combat-text". */
    triggerId = '';

    /** The trigger's name, if this window knows it. */
    triggerName = '';

    /** True for the triggers that come with Nag. */
    predefined = false;

    /**
     * Creates the trigger details for a measurement.
     *
     * @param {string} triggerId The trigger's id, or a made-up id like "combat-text".
     * @param {string} [triggerName] The trigger's name, if this window knows it.
     * @param {boolean} [predefined] True for the triggers that come with Nag.
     */
    constructor( triggerId, triggerName, predefined ) {
        this.triggerId = triggerId;
        this.triggerName = triggerName ?? '';
        this.predefined = predefined === true;
    }
}










/**
 * One row of the Performance Monitor: the running totals for one phrase, action or drawing of a
 * trigger.
 */
class MeasureEntry {

    /** The trigger's id, or a made-up id like "combat-text". */
    triggerId = '';

    /** The trigger's name, if this window knows it. */
    triggerName = '';

    /** True for the triggers that come with Nag. */
    predefined = false;

    /** One of MeasureKinds. */
    kind = '';

    /** The phrase or action id, unique within the trigger and kind. */
    id = '';

    /** What to show for this row. */
    label = '';

    /** How many times it ran. */
    count = 0;

    /** How many of those found a match (phrases only). */
    matches = 0;

    /** The time all runs took together. */
    totalMilliseconds = 0;

    /** The slowest single run. */
    maximumMilliseconds = 0;

    /**
     * Creates an empty row for the given trigger and work.
     *
     * @param {PerformanceTrigger} trigger The trigger the work belongs to.
     * @param {string} kind One of MeasureKinds.
     * @param {string} id The phrase or action id, unique within the trigger and kind.
     * @param {string} label What to show for this row.
     */
    constructor( trigger, kind, id, label ) {
        this.triggerId = trigger.triggerId;
        this.triggerName = trigger.triggerName;
        this.predefined = trigger.predefined;
        this.kind = kind;
        this.id = id;
        this.label = label;
    }
}

let enabled = false;
let changedSinceLastReport = false;

/** @type {Map<string, MeasureEntry>} */
const entries = new Map();











/**
 * Starts listening for the Performance Monitor being turned on or off, and
 * starts sending this window's numbers to the main process.
 *
 * @param {string} sourceLabel What to call this window in the Performance Monitor, e.g. "Log
 *                             watcher (Maxx)".
 * @param {(enabled: boolean) => void} [onEnabledChanged] Called when the monitor is turned on or
 *                                                        off.
 */
function start( sourceLabel, onEnabledChanged ) {
    ipcRenderer.on( 'trigger:performance:enabled', ( event, isEnabled ) => {
        const wasEnabled = enabled;
        enabled = isEnabled === true;
        entries.clear();

        if ( enabled !== wasEnabled && onEnabledChanged ) {
            onEnabledChanged( enabled );
        }
    } );

    ipcRenderer.on( 'trigger:performance:reset', () => {
        entries.clear();
        changedSinceLastReport = true;
    } );

    setInterval( () => {
        if ( enabled && changedSinceLastReport ) {
            changedSinceLastReport = false;
            ipcRenderer.send( 'trigger:performance:report', { source: sourceLabel, entries: Array.from( entries.values() ) } );
        }
    }, reportIntervalMilliseconds );

    // The monitor may already be on when this window opens, e.g. when a new
    // character's log watcher starts.
    ipcRenderer.send( 'trigger:performance:hello' );
}










/**
 * Returns the row that measurements of the given thing are added to,
 * creating it the first time.
 *
 * @param {PerformanceTrigger} trigger The trigger the work belongs to.
 * @param {string} kind One of MeasureKinds.
 * @param {string} id The phrase or action id, unique within the trigger and kind.
 * @param {string} label What to show for this row.
 * @returns {MeasureEntry}
 */
function getEntry( trigger, kind, id, label ) {
    const key = `${trigger.triggerId}|${kind}|${id}`;
    let entry = entries.get( key );

    if ( !entry ) {
        entry = new MeasureEntry( trigger, kind, id, shorten( label ) );
        entries.set( key, entry );
    }

    return entry;
}










/**
 * Adds one run to the given row.
 *
 * @param {MeasureEntry} entry The row to add to.
 * @param {number} startTime The now() value from when the work started.
 * @param {boolean} [matched] For phrases, whether the phrase matched.
 */
function record( entry, startTime, matched ) {
    const milliseconds = performance.now() - startTime;

    entry.count++;
    entry.totalMilliseconds += milliseconds;

    if ( milliseconds > entry.maximumMilliseconds ) {
        entry.maximumMilliseconds = milliseconds;
    }

    if ( matched ) {
        entry.matches++;
    }

    changedSinceLastReport = true;
}










/**
 * Returns a version of the given function that records each call's time on
 * the given row. If the function returns a phrase result, the row also
 * counts matches.
 *
 * @param {MeasureEntry} entry The row to record on.
 * @param {Function} measuredFunction The function to time.
 * @returns {Function}
 */
function timeFunction( entry, measuredFunction ) {
    return function ( ...args ) {
        const startTime = performance.now();
        let result;

        try {
            result = measuredFunction.apply( this, args );
            return result;
        } finally {
            // Phrase parsers return { match: boolean }; End Early and counter
            // phrases return true when they match.
            record( entry, startTime, result === true || result?.match === true );
        }
    };
}










/**
 * Returns a short, readable description of a trigger action, e.g.
 * "Timer: Mana Flare".
 *
 * @param {{ actionType: number, displayText?: string }} action The trigger action.
 * @returns {string}
 */
function describeAction( action ) {
    const typeLabel = action?.actionType === ActionTypes.List ? 'List' : getActionLabel( action?.actionType );
    const displayText = action?.displayText?.trim();

    if ( displayText ) {
        return `${typeLabel}: ${displayText}`;
    }

    return typeLabel;
}










/**
 * Shortens long phrases and display text so the report stays readable.
 *
 * @param {string} text The text to shorten.
 * @returns {string}
 */
function shorten( text ) {
    const value = `${text ?? ''}`;

    if ( value.length > maximumLabelLength ) {
        return `${value.slice( 0, maximumLabelLength - 1 )}…`;
    }

    return value;
}










module.exports = {
    MeasureKinds,
    PerformanceTrigger,
    MeasureEntry,
    start,
    getEntry,
    record,
    timeFunction,
    describeAction,
    now: () => performance.now(),
    get enabled() {
        return enabled;
    },
};
