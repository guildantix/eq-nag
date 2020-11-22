
var ActionTypes = {
    '0': 'DisplayText',
    '1': 'PlayAudio',
    '2': 'Speak',
    '3': 'Timer',
    '4': 'Countdown',
    '5': 'StoreVariable',
    '6': 'DotTimer',
    '7': 'ClearVariable',
    DisplayText: 0,
    PlayAudio: 1,
    Speak: 2,
    Timer: 3,
    Countdown: 4,
    StoreVariable: 5,
    DotTimer: 6,
    ClearVariable: 7,
}

var TriggerConditionTypes = {
    '0': 'Unknown',
    '1': 'VariableValue',
    Unknown: 0,
    VariableValue: 1,
}

var OperatorTypes = {
    '0': 'IsNull',
    '1': 'Equals',
    '2': 'DoesNotEqual',
    '4': 'LessThan',
    '8': 'GreaterThan',
    IsNull: 0,
    Equals: 1,
    DoesNotEqual: 2,
    LessThan: 4,
    GreaterThan: 8,
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
    /** @type string[] */
    phrases;
    /** @type boolean */
    restartOnDuplicate = false;
    /** @type boolean */
    onlyExecuteInDev = false;
    /** @type string */
    overrideTimerColor = null;
    /** @type string */
    timerBackgroundColor = null;
    /** @type string */
    timerIcon = null;
    /** @type string */
    timerIconDef = null;

    /** @type boolean */
    ifEndingSoon = false;
    /** @type number */
    endingDuration = null;
    /** @type boolean */
    endingSoonChangeColor = false;
    /** @type string */
    endingSoonColor = null;
    /** @type string */
    endingSoonBackgroundColor = null;
    
    /** @type boolean */
    endingSoonDisplayText = false;
    /** @type string */
    endingSoonTextOverlayId = null;
    /** @type string */
    endingSoonText = null;
    /** @type number */
    endingSoonTextDuration = null;

    /** @type boolean */
    endingSoonSpeak = false;
    /** @type string */
    endingSoonSpeakPhrase = null;

    /** @type boolean */
    remainAfterEnded = false;
    /** @type number */
    remainDuration = null;
    
    /** @type boolean */
    endedDisplayText = false;
    /** @type string */
    endedTextOverlayId = null;
    /** @type string */
    endedText = null;
    /** @type number */
    endedTextDuration = null;

    /** @type boolean */
    endedSpeak = false;
    /** @type string */
    endedSpeakPhrase = null;

    /** @type boolean */
    endedChangeColor = false;
    /** @type string */
    endedColor = null;
    /** @type string */
    endedBackgroundColor = null;
}

class TriggerCondition {
    
    /** @type string */
    conditionId;
    /** @type TriggerConditionTypes */
    conditionType;
    /** @type OperatorTypes */
    operatorType;
    /** @type string */
    variableName;
    /** @type string */
    variableValue;

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
    /** @type TriggerCondition[] */
    conditions = [];
    spellLevel = 0;
    predefined = false;
    /** @type boolean */
    onlyExecuteInDev = false;

}

module.exports = { Trigger, TriggerAction, ActionTypes, CapturePhrase, TriggerConditionTypes, OperatorTypes };
