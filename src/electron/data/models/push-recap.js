class PushRecapPreferences {
    /** @type {string} */
    triggerId;
    /** @type {boolean} */
    enabled = false;
    /** @type {number} */
    quietGapSeconds = 30;
}

module.exports = { PushRecapPreferences };
