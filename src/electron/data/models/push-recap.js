const maxHiddenTexts = 500;
const maxHiddenTextLength = 200;

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

module.exports = { PushRecapPreferences, sanitizeHiddenProcTexts };
