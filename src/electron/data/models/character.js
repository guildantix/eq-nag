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

    /** @type {boolean} True if the character has an extended beneficial focus item. */
    hasExtendedBeneficialFocus = false;

    /** @type {number} The amount of bonus from the extended beneficial focus effect. */
    extendedBeneficialFocusPercent = null;

    /** @type {number} The level at which the extended beneficial focus effect will begin to decay. */
    extendedBeneficialFocusDecayLevel = null;

    /** @type {number} The amount of bonus from the extended beneficial focus AA. */
    extendedBeneficialFocusAaPercent = null;

    /** @type {boolean} True if the character has an extended dot focus item. */
    hasBeneficialCastingSpeedFocus = false;

    /** @type {number} The amount of bonus from the beneficial spell haste focus effect. */
    beneficialCastingSpeedFocusPercent = null;

    /** @type {number} The amount of bonus from the beneficial spell haste AA. */
    beneficialCastingSpeedFocusAaPercent = null;

    /** @type {number} The beneficial spell duration from the spell haste AA. */
    beneficialCastingSpeedFocusAaDurationLimit = null;

    /** @type {number} The level at which the extended dot focus effect will begin to decay. */
    beneficialCastingSpeedFocusDecayLevel = null;

    /** @type {boolean} If true, this character is on a P1999 server. */
    p99 = false;

    /** @type {boolean} If true, this character is on a P1999 server. */
    daybreak = false;

    /** @type {boolean} If true, this character is on a TAKP server. */
    takp = false;

    /** @type {Record<string, number[]>} A record of the combat hits of this character. */
    combatGroupHits = {};

    /** @type {Record<string, number>} A record of the combat median values of this character. */
    combatGroupMedian = {};

    /** @type {string | undefined} */
    triggerProfile = undefined;

    /** @type {string[]} */
    disabledTriggers = [];

    /** @type {boolean} */
    disableTriggersByDefault = false;
    
}

class TriggersProfileModel {

    /** @type {string} */
    profileId;
    
    /** @type {string} */
    name;

    /** @type {string[]} */
    disabledTriggers;

    /** @type {boolean} */
    disableTriggersByDefault = false;

}

class CharacterStoreModel {

    /** @type {number} */
    version;
    
    /** @type {CharacterModel[]} */
    characters;
    
    /** @type {TriggersProfileModel[]} */
    triggerProfiles;

    /** @type {boolean} */
    disableTriggersByDefault = false;

}

module.exports = { CharacterModel, TriggersProfileModel, CharacterStoreModel };
