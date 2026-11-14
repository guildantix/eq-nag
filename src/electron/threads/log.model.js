const { OverlayComponent } = require( "../data/models/overlay-window" );
const { RendererComponent } = require( "../data/models/renderer" );
const { Trigger, TriggerFolder, TriggerCondition, TriggerAction } = require( "../data/models/trigger" );

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

class LogList {
    /** @type {string} */
    name;
    /** @type {string} */
    instanceId;
    /** @type {Trigger} */
    trigger;
    /** @type {TriggerAction} */
    action;
    /** @type {'created'|'running'|'stopped'} */
    state = 'created';
    /** @type {RendererComponent} */
    component;
    /** @type {(options: {setName?: string, actName?: string} | undefined) => void} */
    updateListFn;
    /** @type {number} */
    timestamp;
    /** @type {string} */
    timerInstanceId;
    /** @type {number} */
    actionTrackIntervalId = -1;
    /** @type {string} */
    actedName = undefined;
}










/**
 * Phrases an active timer watches the log for after it starts: its End Early phrases, its
 * secondary action phrases or its DoT worn off phrase.
 */
class WatchedPhrases {

    /** The instance id of the overlay component the phrases belong to. */
    instanceId = '';

    /**
     * Checks the given log entry against the phrases.
     *
     * @type {(logEntry: string) => boolean}
     */
    _parse;

    /**
     * Runs when a phrase matches: starts the secondary action, or ends the DoT timer. End Early
     * phrases don't have one; the log watcher removes their component instead.
     *
     * @type {((instanceId: string, timestamp: Date) => void) | undefined}
     */
    _trigger;

    /**
     * Creates the watched phrases for an overlay component.
     *
     * @param {string} instanceId The instance id of the overlay component the phrases belong to.
     * @param {(logEntry: string) => boolean} parse Checks a log entry against the phrases, and
     *                                              returns true when one matched.
     * @param {(instanceId: string, timestamp: Date) => void} [trigger] Runs when a phrase matches.
     */
    constructor( instanceId, parse, trigger ) {
        this.instanceId = instanceId;
        this._parse = parse;
        this._trigger = trigger;
    }
}

module.exports = { PhraseParse, LogTrigger, LogList, WatchedPhrases };
