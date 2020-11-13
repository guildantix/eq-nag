class CharacterModel {
    
    /** @type {string} The unique identifier for the character. */
    characterId = null;

    /** @type {string} The in-game name of the character. */
    name = null;

    /** @type {string} The 3-character code of the character's class. */
    class = null;

    /** @type {boolean} True if the character has an extended dot focus item. */
    hasExtendedDotFocus = false;

    /** @type {number} The amount of bonus from the extended dot focus effect. */
    extendedDotFocusPercent = null;

    /** @type {number} The level at which the extended dot focus effect will begin to decay. */
    extendedDotFocusDecayLevel = null;

    /** @type {string} The full file location to this character's log file. */
    logFile = null;

    /** @type {string} */
    server = null;

}

module.exports = CharacterModel;
