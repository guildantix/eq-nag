const { Trigger, TriggerFolder, TriggerCondition } = require( "../data/models/trigger" );

class PhraseParse {
    /** @type {string} */
    phraseId;
    /** @type {RegExpExecArray} */
    result;
    /** @type {RegExpExecArray | undefined} */
    dependencyResult;
    /** @type {boolean} */
    match;
    /** @type {string} */
    renderedPhrase;
}

class LogTrigger extends Trigger {
    
    /**
     * Parses the given log entry and executes a callback when a match is found.
     * 
     * @param {string} value The full log entry sans timestamp.
     * @param {(match: PhraseParse, deltaTime: number) => void} onMatch This callback is executed when a match is identified.
     */
    _parse = ( value, onMatch ) => { };

    /**
     * Resets any stored values for this trigger.
     * 
     * @param {boolean} forceReset Forces a reset for all tracked phrase positions.  This only applies to sequential phrase parsing.
     */
    _reset = ( forceReset ) => { };

    /**
     * @type {Record<string, string>}
     * @description 
     *  For a dot timer, the SpellBeingCast variable may have the 
     *  value of 'Envenomed Bolt'.  That value may not exist in the 
     *  saved variables any longer, but that was the value of that 
     *  variable at the time the trigger was executed and that 
     *  value is stored in the conditionResults dictionary.
     */
    _conditionResults;

    /** @type {boolean} */
    _onCooldown = false;
    /** @type {Date} */
    _cooldownStart = null;
    
    /** @type {number} */
    _deltaTime = null;

    /** @type {TriggerCondition[]} */
    _folderConditions = [];

    /** @type {boolean|undefined} */
    _passesClassCondition = undefined;

    /** @type {boolean} */
    _profileDisabled = false;
}

module.exports = { PhraseParse, LogTrigger };
