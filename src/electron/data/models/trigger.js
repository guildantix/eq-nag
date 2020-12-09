
var ActionTypes = {
    '0': 'DisplayText',
    '1': 'PlayAudio',
    '2': 'Speak',
    '3': 'Timer',
    '4': 'Countdown',
    '5': 'StoreVariable',
    '6': 'DotTimer',
    '7': 'ClearVariable',
    '8': 'Counter',
    '9': 'Clipboard',
    DisplayText: 0,
    PlayAudio: 1,
    Speak: 2,
    Timer: 3,
    Countdown: 4,
    StoreVariable: 5,
    DotTimer: 6,
    ClearVariable: 7,
    Counter: 8,
    Clipboard: 9,
}

var TriggerConditionTypes = {
    '0': 'Unknown',
    '1': 'VariableValue',
    Unknown: 0,
    VariableValue: 1,
}

var MediaTypes = {
    '0': 'Unknown',
    '1': 'Image',
    '2': 'Audio',
    '3': 'Text',
    Unknown: 0,
    Image: 1,
    Audio: 2,
    Text: 3,
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

class TriggerFolder {
    /** @type {string} */
    folderId;
    /** @type {string} */
    name;
    /** @type {boolean} */
    expanded;
    /** @type {boolean} */
    active;
    /** @type {string} */
    comments;
    /** @type {TriggerFolder[]} */
    children = [];
}

class CharacterClassLevel {
    /** @type {string} */
    class;
    /** @type {number} */
    level;
}

class Phrase {

    /** @type {string} */
    phraseId;
    /** @type {string} */
    phrase;
    /** @type {boolean} */
    useRegEx;

}

class CapturePhrase extends Phrase {

    /** @type boolean */
    requirePreviousPhrase;
    /** @type number */
    duration;

}

class TriggerAction {

    actionId = null;
    actionType = ActionTypes.DisplayText;
    overlayId;
    /** @type {string} */
    name;
    displayText;
    /** @type number */
    duration = null;
    /** @type boolean */
    showRemainingDuration = false;
    /** @type boolean */
    repeatTimer = false;
    /** @type number */
    repeatCount = null;
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
    interruptSpeech = false;

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
    endingClipboard = false;
    /** @type string */
    endingClipboardText = null;

    /** @type boolean */
    endingPlayAudio = false;
    /** @type string */
    endingPlayAudioFileId = null;

    /** @type boolean */
    endingSoonSpeak = false;
    /** @type string */
    endingSoonSpeakPhrase = null;
    /** @type boolean */
    endingSoonInterruptSpeech = false;

    /** @type boolean */
    remainAfterEnded = false;
    /** @type boolean */
    notifyWhenEnded = false;
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
    endedInterruptSpeech = false;
    
    /** @type boolean */
    endedClipboard = false;
    /** @type string */
    endedClipboardText = null;

    /** @type boolean */
    endedPlayAudio = false;
    /** @type string */
    endedPlayAudioFileId = null;

    /** @type boolean */
    endedChangeColor = false;
    /** @type string */
    endedColor = null;
    /** @type string */
    endedBackgroundColor = null;

    /** @type {Phrase[]} */
    excludeTargets = [];

    /** @type {Phrase[]} */
    endEarlyPhrases = [];

    /** @type {Phrase[]} */
    resetCounterPhrases = [];

    /** @type string */
    audioFileId = null;
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
    folderId = null;
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
    /** @type {CharacterClassLevel[]} */
    classLevels = [];
    predefined = false;
    /** @type boolean */
    onlyExecuteInDev = false;
    /** @type {string} */
    allakhazamUrl = null;
}

class FileModel {
    
    /** @type {string} */
    fileId = null;
    /** @type {MediaTypes} */
    mediaType = MediaTypes.Unknown;
    /** @type {string} */
    fileName = null;
    /** @type {string} */
    physicalName = null;

}

module.exports = { Trigger, TriggerAction, ActionTypes, CapturePhrase, TriggerConditionTypes, OperatorTypes, Phrase, TriggerFolder, MediaTypes, FileModel };
