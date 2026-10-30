const targetBars = 60;
const stepBases = [ 1, 2, 5 ];

/**
 * @typedef {Object} TimelineEvent
 * @property {number} time Seconds into the fight.
 * @property {number} kind 0 for a hit, 1 for an assumed cast, 2 for a proc, 3 for a possible proc.
 * @property {string} who The player, or an empty string for a proc.
 * @property {string} spell The spell of a hit, or the push spell label of a proc.
 * @property {string} text The landing message of a proc.
 * @property {number} push The push value.
 */

/**
 * @typedef {Object} TimelineModel
 * @property {TimelineEvent[]} events The events, without the hidden messages.
 * @property {number} seconds The length of the fight.
 * @property {number} bucket The seconds in one bar.
 * @property {number} count The number of bars.
 * @property {string | null} fightStart The start of the fight as an ISO date.
 */

/**
 * Formats the given seconds as m:ss.
 *
 * @returns {string} The text.
 *
 * @param {number} seconds The seconds.
 */
function formatOffset( seconds ) {
    return `${Math.floor( seconds / 60 )}:${String( seconds % 60 ).padStart( 2, '0' )}`;
}










/**
 * Formats the clock time of the given second of the fight as HH:MM:SS, or an empty string when the start is unknown.
 *
 * @returns {string} The text.
 *
 * @param {string | null} fightStart The start of the fight as an ISO date.
 * @param {number} seconds The seconds into the fight.
 */
function formatClock( fightStart, seconds ) {
    let start = fightStart == null ? NaN : Date.parse( fightStart );
    return isNaN( start ) ? '' : new Date( start + seconds * 1000 ).toISOString().substring( 11, 19 );
}










/**
 * Reads the timeline of a saved summary.  Returns null when the summary has none.
 *
 * @returns {TimelineModel | null} The model.
 *
 * @param {any} summary The saved summary.
 * @param {Set<string>} hidden The landing messages that are hidden.
 */
function buildTimelineModel( summary, hidden ) {
    if ( !Array.isArray( summary?.timeline ) ) {
        return null;
    }
    let players = summary.players ?? [];
    let texts = summary.timelineTexts ?? [];
    let labels = new Map();
    [ ...( summary.unattributed?.procs ?? [] ), ...( summary.unattributed?.possible ?? [] ) ].forEach( p => labels.set( p.text, p.name ) );

    let events = [];
    summary.timeline.forEach( e => {
        let [ time, kind, who, ref, push ] = e;
        if ( kind < 2 ) {
            events.push( { time: time, kind: kind, who: players[ who ]?.name ?? '', spell: ref, text: '', push: push } );
        } else if ( !hidden.has( texts[ ref ] ) ) {
            events.push( { time: time, kind: kind, who: '', spell: labels.get( texts[ ref ] ) ?? '', text: texts[ ref ] ?? '', push: push } );
        }
    } );

    let seconds = Math.max( 1, summary.fightSeconds ?? 1, ...events.map( e => e.time ) );
    let bucket = Math.max( 1, Math.round( seconds / targetBars ) );
    return { events: events, seconds: seconds, bucket: bucket, count: Math.ceil( seconds / bucket ), fightStart: summary.fightStart ?? null };
}










/**
 * Returns the index of the bar an event belongs to.
 *
 * @returns {number} The index.
 *
 * @param {TimelineModel} model The model.
 * @param {TimelineEvent} event The event.
 */
function barOf( model, event ) {
    return Math.min( model.count - 1, Math.floor( event.time / model.bucket ) );
}










/**
 * Adds up the events of each bar, per series: players, procs and possible procs.
 *
 * @returns {{ player: number, proc: number, possible: number }[]} The totals of each bar.
 *
 * @param {TimelineModel} model The model.
 * @param {'hits' | 'push'} measure What to add up.
 * @param {boolean} showPossible True to include the possible procs.
 */
function buildBars( model, measure, showPossible ) {
    let bars = Array.from( { length: model.count }, () => ( { player: 0, proc: 0, possible: 0 } ) );
    model.events.forEach( e => {
        if ( e.kind !== 3 || showPossible ) {
            bars[ barOf( model, e ) ][ e.kind === 3 ? 'possible' : e.kind === 2 ? 'proc' : 'player' ] += measure === 'hits' ? 1 : e.push;
        }
    } );
    return bars;
}










/**
 * Returns the events of one bar, in fight order.
 *
 * @returns {TimelineEvent[]} The events.
 *
 * @param {TimelineModel} model The model.
 * @param {number} index The index of the bar.
 * @param {boolean} showPossible True to include the possible procs.
 */
function barEvents( model, index, showPossible ) {
    return model.events.filter( e => barOf( model, e ) === index && ( e.kind !== 3 || showPossible ) );
}










/**
 * Returns a step for the vertical axis that gives at most 6 gridlines.
 *
 * @returns {number} The step.
 *
 * @param {number} max The highest bar.
 */
function axisStep( max ) {
    for ( let scale = 1; ; scale *= 10 ) {
        for ( let base of stepBases ) {
            if ( Math.ceil( max / ( base * scale ) ) <= 6 ) {
                return base * scale;
            }
        }
    }
}

module.exports = { buildTimelineModel, buildBars, barEvents, barOf, axisStep, formatOffset, formatClock };
