/**
 * Settings for the Push Recap hotkey pop-up, stored in the user preferences file.
 */
class PushRecapPreferences {
    /** @type {string} */
    triggerId;
    /** @type {boolean} */
    enabled = false;
    /** @type {number} */
    quietGapSeconds = 30;
}

module.exports = { PushRecapPreferences };
