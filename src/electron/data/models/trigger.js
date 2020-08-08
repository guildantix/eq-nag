
var ActionTypes = {
    '0': 'DisplayText',
    '1': 'PlayAudio',
    '2': 'Speak',
    '3': 'Timer',
    '4': 'Countdown',
    '5': 'StoreVariable',
    '6': 'DotTimer',
    DisplayText: 0,
    PlayAudio: 1,
    Speak: 2,
    Timer: 3,
    Countdown: 4,
    StoreVariable: 5,
    DotTimer: 6
}

class CapturePhrase {

    /** @type string */
    phraseId;
    /** @type string */
    phrase;
    /** @type boolean */
    useRegEx;
    /** @type boolean */
    requirePreviousPhrase;
    /** @type number */
    duration;

}

class TriggerAction {

    actionId = null;
    actionType = ActionTypes.DisplayText;
    overlayId;
    displayText;
    /** @type number */
    duration = null;
    /** @type string */
    variableName = null;
    /** @type number */
    ticks = null;
    /** @type string */
    phraseId;

}

class Trigger {
    
    triggerId = null;
    name = '';
    /** @type CapturePhrase[] */
    capturePhrases = [];
    useRegEx = false;
    comments = '';
    /** @type {TriggerAction[]} */
    actions = [];
    captureMethod = 'Any match';

}

module.exports = { Trigger, TriggerAction, ActionTypes, CapturePhrase };
