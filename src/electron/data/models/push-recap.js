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
}

module.exports = { PushRecapPreferences };
