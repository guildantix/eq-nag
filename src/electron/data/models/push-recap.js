const maxHiddenTexts = 500;
const maxHiddenTextLength = 200;

/**
 * @typedef {Object} PushTabView What the Push tab remembers between sessions.
 * @property {number} scanFloor The damage step of the Analyze slider.
 * @property {number} minDamage The damage step of the Show slider.
 * @property {Object<string, { key: string, direction: string }>} sorts The sort of each table.
 */

const maxSortKeyLength = 120;
const sortTables = [ 'fights', 'totals', 'grid' ];
const defaultScanFloor = 1000000;
const defaultMinDamage = 1000;

/**
 * The damage amounts the Push tab sliders offer: 1, 2.5 and 5 for every power of ten from 1K to 5B,
 * then 10B.  Kept in step with the list in the Push tab.
 *
 * @type {number[]}
 */
const damageSteps = ( () => {
    const steps = [];
    for ( let exponent = 3; exponent <= 9; exponent++ ) {
        [ 1, 2.5, 5 ].forEach( multiplier => steps.push( multiplier * Math.pow( 10, exponent ) ) );
    }
    steps.push( 1e10 );
    return steps;
} )();

/**
 * Settings for the Push Recap hotkey pop-up, stored in the user preferences file.
 */
class PushRecapPreferences {
    /** @type {number} */
    quietGapSeconds = 30;
    /** @type {boolean} */
    showTab = false;
    /** @type {boolean} */
    saveRecaps = true;
    /** @type {string[]} */
    hiddenProcTexts = [];
    /**
     * What the Push tab remembers between sessions: its two sliders and how each table is sorted.
     *
     * @type {PushTabView}
     */
    tabView = sanitizePushTabView( null );
}










/**
 * Returns the given list as a clean list of hidden proc messages.  The newest messages are kept
 * when the list is too long.
 *
 * @returns {string[]} The messages.
 *
 * @param {any} value The list.
 */
function sanitizeHiddenProcTexts( value ) {
    const texts = Array.isArray( value ) ? value.filter( t => typeof t === 'string' && t !== '' && t.length <= maxHiddenTextLength ) : [];
    return Array.from( new Set( texts ) ).slice( -maxHiddenTexts );
}










/**
 * Returns the damage step closest to the given amount, or the fallback when it is not a number.
 *
 * @returns {number} The step.
 *
 * @param {any} value The amount.
 * @param {number} fallback The step to use when the amount is not a finite number.
 */
function snapDamageStep( value, fallback ) {
    if ( typeof value !== 'number' || !Number.isFinite( value ) ) {
        return fallback;
    }
    return damageSteps.reduce( ( best, step ) => Math.abs( step - value ) < Math.abs( best - value ) ? step : best, damageSteps[ 0 ] );
}










/**
 * Returns the given Push tab view as a clean one: slider values snapped to a step and only the
 * sorts that have a table, a text key and a direction.  The tab drops sort keys of columns that
 * no longer exist.
 *
 * @returns {PushTabView} The view.
 *
 * @param {any} value The stored view.
 */
function sanitizePushTabView( value ) {
    const sorts = {};
    sortTables.forEach( table => {
        const sort = value?.sorts?.[ table ];
        if ( typeof sort?.key === 'string' && sort.key !== '' && sort.key.length <= maxSortKeyLength && ( sort.direction === 'asc' || sort.direction === 'desc' ) ) {
            sorts[ table ] = { key: sort.key, direction: sort.direction };
        }
    } );
    return {
        scanFloor: snapDamageStep( value?.scanFloor, defaultScanFloor ),
        minDamage: snapDamageStep( value?.minDamage, defaultMinDamage ),
        sorts: sorts,
    };
}

module.exports = { PushRecapPreferences, sanitizeHiddenProcTexts, sanitizePushTabView };
