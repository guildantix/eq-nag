const { OverlayWindow } = require( "./overlay-window" )

const ErrorMessages = {
    generalParsingError: () => 'Failed to parse log entry.',
    triggerParse: () => 'Attempt to execute capture phrases against log entry has failed.',
    triggerGeneration: () => 'An error occurred while generating the trigger parse functions.',
    triggerExecution: () => 'Could not execute trigger.',
    fctException: () => 'An exception occurred while parsing FCT.',
    cancellableParse: () => 'Could not parse cancellable component phrase.',
    secondaryTriggerParse: () => 'Could not parse secondary trigger.',
    secondaryTriggerExecution: () => 'Could not execute secondary trigger.',
    /**
     * @param {string} counterName The name of the counter.
     */
    counterExecution: (counterName) => `Could not execute counter ${counterName}.`,
}

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
    '10': 'BeneficialTimer',
    '11': 'DisplayDeathRecap',
    '12': 'ScreenGlow',
    '13': 'ClearAll',
    '14': 'Stopwatch',
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
    BeneficialTimer: 10,
    DisplayDeathRecap: 11,
    ScreenGlow: 12,
    ClearAll: 13,
    Stopwatch: 14,

}

var LogTypes = {
    
    '0': 'info',
    '1': 'error',
    '2': 'success',
    '3': 'warning',
    '4': 'debug',
    info: 0,
    error: 1,
    success: 2,
    warning: 3,
    debug: 4,

}

/**
 * Returns the label for the given action type.
 * 
 * @param {ActionTypes} actionType The action type to get the label for.
 */
var getActionLabel = ( actionType ) => {
    switch ( actionType ) {
        case ActionTypes.DisplayText:
            return 'Display Text';
        case ActionTypes.PlayAudio:
            return 'Play Audio';
        case ActionTypes.Speak:
            return 'Speak';
        case ActionTypes.Timer:
            return 'Timer';
        case ActionTypes.Countdown:
            return 'Countdown';
        case ActionTypes.StoreVariable:
            return 'Store Variable';
        case ActionTypes.DotTimer:
            return 'Dot Timer';
        case ActionTypes.ClearVariable:
            return 'Clear Variable';
        case ActionTypes.Counter:
            return 'Counter';
        case ActionTypes.Clipboard:
            return 'Clipboard';
        case ActionTypes.BeneficialTimer:
            return 'Beneficial Timer';
        case ActionTypes.DisplayDeathRecap:
            return 'Display Death Recap';
        case ActionTypes.ScreenGlow:
            return 'Screen Glow';
        case ActionTypes.ClearAll:
            return 'Clear All';
        case ActionTypes.Stopwatch:
            return 'Stopwatch';
        default:
            return 'Unknown';
    }
}

var ExternalDataSources = {
    'ZAM': 'Allakhazam',
    'EQSR': 'EqSpellResources',
    Allakhazam: 'ZAM',
    EqSpellResources: 'EQSR',
}

// TODO: Why wasn't this updated?
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
    '16': 'Contains',
    IsNull: 0,
    Equals: 1,
    DoesNotEqual: 2,
    LessThan: 4,
    GreaterThan: 8,
    Contains: 16,
}

var ImportTypes = {
    '0': 'None',
    '1': 'DotTimer',
    '2': 'Ability',
    '3': 'Npc',
    '4': 'Buff',
    None: 0,
    DotTimer: 1,
    Ability: 2,
    Npc: 3,
    Buff: 4,
}

var TimerRestartBehaviors = {
    '0': 'StartNewTimer',
    '1': 'RestartOnDuplicate',
    '2': 'RestartTimer',
    '3': 'DoNothing',
    StartNewTimer: 0,
    RestartOnDuplicate: 1,
    RestartTimer: 2,
    DoNothing: 3,
}

class TriggerCondition {
    
    /** @type {string} */
    conditionId;
    /** @type {TriggerConditionTypes} */
    conditionType;
    /** @type {OperatorTypes} */
    operatorType;
    /** @type {string} */
    variableName;
    /** @type {string} */
    variableValue;

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
    /** @type {TriggerCondition[]} */
    folderConditions = [];
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

class Tag {
    
    /** @type {string} */
    tagId;
    /** @type {string} */
    name;
    /** @type {string} */
    description;

}

class VariableAssignment {

    /** @type {string} */
    name;
    /** @type {string} */
    value;

}

class TriggerSubAction {
    
    /** @type {string} */
    actionId;
    /** @type {VariableAssignment[]} */
    variableValues = [];

}

class TriggerAction {

    /** @type {string} */
    actionId = null;
    /** @type {ActionTypes} */
    actionType = ActionTypes.DisplayText;
    /** @type {string} */
    overlayId;
    /** @type {string} */
    name;
    /** @type {string} */
    displayText;
    /** @type {number} */
    duration = null;
    /** @type {string} */
    storageDuration = null;
    /** @type {boolean} @deprecated Use showDuration instead. */
    showRemainingDuration = false;
    /** @type {boolean} */
    showDuration = false;
    /** @type {boolean} */
    repeatTimer = false;
    /** @type {number} */
    repeatCount = null;
    /** @type {string} */
    variableName = null;
    /** @type {string} */
    storeLiteralDefinition = null;
    /** @type {boolean} */
    onlyStoreUsedValues = false;
    /** @type {boolean} */
    loopBackForValue = false;
    /** @type {number} */
    ticks = null;
    /** @type {string[]} */
    phrases;
    /** @type {string[]} */
    secondaryPhrases;
    /** @type {number} */
    restartBehavior = TimerRestartBehaviors.StartNewTimer;
    /** @type {boolean} */
    onlyExecuteInDev = false;
    /** @type {string} */
    overrideTimerColor = null;
    /** @type {string} */
    timerBackgroundColor = null;
    /** @type {string} */
    timerIcon = null;
    /** @type {string} */
    timerIconDef = null;
    /** @type {boolean} */
    interruptSpeech = false;
    /** @type {number} */
    speechVolume = 100;
    /** @type {number} */
    speechRate = 1;
    /** @type {boolean} */
    hideTimer = false;
    /** @type {boolean} */
    speakNext = false;
    /** @type {TriggerCondition[]} */
    hideConditions = [];
    /** @type {number} */
    castTime = null;
    /** @type {boolean} */
    onlyUseAaBeneficialFocus = false;
    /** @type {boolean} */
    skipBenCastingTimeFocus = false;
    /** @type {string} */
    variableStorageType = 'localVariable';
    /** @type {boolean} */
    flash = false;
    /** @type {boolean} */
    storeDuration = false;

    /** @type {TriggerSubAction[]} */
    endingSoonSubActions = [];
    /** @type {TriggerSubAction[]} */
    endedSubActions = [];

    /** @type boolean */
    ifEndingSoon = false;
    /** @type boolean */
    endingSoonShowTimer = false;
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
    /** @type {boolean} */
    remainUnlessEndedEarly = false;
    
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

    /** @type {string} */
    audioFileId = null;

    /** @type {number} */
    audioVolume = 100;

    /** @type {boolean} */
    textUseCustomFont = false;

    /** @type {boolean} */
    textUseCustomSize = false;

    /** @type {boolean} */
    textUseCustomWeight = false;

    /** @type {boolean} */
    textUseCustomColor = false;

    /** @type {boolean} */
    textUseCustomBorder = false;

    /** @type {boolean} */
    textUseCustomGlow = false;
    
    /** @type {string} */
    textFont = null;
    
    /** @type {number} */
    textSize = null;
    
    /** @type {number} */
    textSpacing = null;
    
    /** @type {number} */
    textWeight = null;
    
    /** @type {string} */
    textColor = null;
    
    /** @type {string} */
    textBorderColor = null;
    
    /** @type {number} */
    textBorderIntensity = null;
    
    /** @type {string} */
    textGlowColor = null;
    
    /** @type {number} */
    textGlowIntensity = null;
    
    /** @type {number} */
    textGlowSize = null;
}

class OwnedTriggerAction extends TriggerAction {

    /** @type {string} */
    triggerId;
    /** @type {string} */
    triggerName;
    /** @type {string} */
    phrase;
    /** @type {'gina'|'nag'} */
    storeLocation;

    /**
     * Creates a new owned trigger action object.
     * 
     * @param {string} targetTriggerId 
     * @param {string} targetTriggerName 
     * @param {string} targetPhrase 
     * @param {'gina'|'nag'} targetStoreLocation 
     * @param {TriggerAction} targetAction 
     */
    constructor( targetTriggerId, targetTriggerName, targetPhrase, targetStoreLocation, targetAction ) {
        super();
        Object.assign( this, targetAction );
        this.triggerId = targetTriggerId;
        this.triggerName = targetTriggerName;
        this.phrase = targetPhrase;
        this.storeLocation = targetStoreLocation;
    }
}

class DuplicateTriggerAction {
    /** @type {string} */
    triggerId;
    /** @type {string} */
    phrase;
    /** @type {OwnedTriggerAction[]} */
    actions;
    /** @type {TriggerAction} */
    subjectAction;
}

class Trigger {
    
    /** @type {string} */
    triggerId = null;
    /** @type {string} */
    folderId = null;
    /** @type {string} */
    packageId = null;
    name = '';
    /** @type {CapturePhrase[]} */
    capturePhrases = [];
    useRegEx = false;
    comments = '';
    /** @type {TriggerAction[]} */
    actions = [];
    captureMethod = 'Any match';
    /** @type {TriggerCondition[]} */
    conditions = [];
    /** @type {CharacterClassLevel[]} */
    classLevels = [];
    predefined = false;
    /** @type boolean */
    onlyExecuteInDev = false;
    /** @type {string} */
    allakhazamUrl = null;
    /** @type {ExternalDataSources} */
    externalSource = null;
    /** @type {string} */
    importIdentifier = null;
    /** @type {ImportTypes} */
    importType = null;
    /** @type {boolean} */
    useCooldown = false;
    /** @type {number} */
    cooldownDuration = 0;
    /** @type {boolean} */
    enabled = true;
    /** @type {string} */
    sequentialRestartBehavior = 'none';
}

class BaseFileModel {
    
    /** @type {string} */
    fileId = null;
    /** @type {MediaTypes} */
    mediaType = MediaTypes.Unknown;
    /** @type {string} */
    fileName = null;

}

class FileModel extends BaseFileModel {

    /** @type {string} */
    physicalName = null;

}

class PackageFileModel extends BaseFileModel {

    /** @type {string} */
    contents = null;

}

class TriggerPackageVersion {
    
    /** @type {string} */
    packageId;
    /** @type {string} */
    versionId;
    /** @type {Date} */
    timestamp;
    /** @type {string} */
    name;
    /** @type {string} */
    description;
    /** @type {string} */
    author = null;
    /** @type {string} */
    authorDiscord = null;

}

class VersionHistory {

    /** @type {string} */
    versionId;
    /** @type {Date} */
    timestamp;
    /** @type {string} */
    notes;

}

class PackageFolder {

    /** @type {string} */
    folderId;
    /** @type {string} */
    name;
    /** @type {PackageFolder[]} */
    children = [];

}

class PackageTrigger {

    /** @type {string} */
    triggerId = null;
    /** @type {string} */
    folderId = null;
    /** @type {string} */
    name = '';
    /** @type {CapturePhrase[]} */
    capturePhrases = [];
    /** @type {string} */
    comments = '';
    /** @type {TriggerAction[]} */
    actions = [];
    /** @type {string} */
    captureMethod = 'Any match';
    /** @type {TriggerCondition[]} */
    conditions = [];
    /** @type {CharacterClassLevel[]} */
    classLevels = [];
    /** @type {boolean} */
    useCooldown = false;
    /** @type {number} */
    cooldownDuration = 0;
    /** @type {string} */
    sequentialRestartBehavior = 'none';

}

class TriggerPackageModel {
    
    /** @type {PackageTrigger[]} */
    triggers = [];
    /** @type {PackageFolder[]} */
    folders = [];
    /** @type {string} */
    detrimentalOverlayId;
    /** @type {string} */
    beneficialOverlayId;
    /** @type {string} */
    textOverlayId;
    /** @type {OverlayWindow[]} */
    packageOverlays;
    /** @type {Electron.Size} */
    primaryDisplaySize;
}

class TriggerPackageMetaModel {
    
    /** @type {string} */
    triggerPackageId;
    /** @type {string} */
    versionId;
    /** @type {string} */
    timestampDate;
    /** @type {TriggerPackageModel} */
    model = new TriggerPackageModel();
    /** @type {PackageFileModel[]} */
    files = [];
    /** @type {string} */
    author;
    /** @type {string} */
    authorDiscord;
    /** @type {boolean} */
    trustedAuthor = false;
    /** @type {string} */
    name;
    /** @type {VersionHistory[]} */
    versionHistory;
    /** @type {string} */
    description;

}

class QuickShareVersion {
    
    /** @type {string} */
    quickShareId;
    /** @type {string} */
    versionId;
    /** @type {Date} */
    timestamp;
    /** @type {string} */
    author = null;
    /** @type {string} */
    authorDiscord = null;

}

class QuickShareModel {
    
    /** @type {PackageTrigger[]} */
    triggers;
    /** @type {PackageFolder[]} */
    folders;
    /** @type {string} */
    detrimentalOverlayId;
    /** @type {string} */
    beneficialOverlayId;
    /** @type {string} */
    textOverlayId;
    /** @type {OverlayWindow[]} */
    overlays;
    /** @type {Electron.Size} */
    primaryDisplaySize;

}

class QuickShareMetaModel {

    /** @type {string} */
    quickShareId;
    /** @type {string} */
    versionId;
    /** @type {Date} */
    timeStamp;
    /** @type {QuickShareModel} */
    model;
    /** @type {string} */
    author;
    /** @type {string} */
    authorDiscord;
    /** @type {boolean} */
    trustedAuthor;
    /** @type {boolean} */
    stageNewTriggers;

}

class TriggerParseHistoryModel {
    
    /** @type {string} */
    parseId;
    /** @type {Date} */
    timestamp;
    /** @type {string} */
    triggerId;
    /** @type {string} */
    triggerName;
    /** @type {string} */
    actionId;
    /** @type {string} */
    actionTypeLabel;
    /** @type {string} */
    phraseId;
    /** @type {string | string[]} */
    renderedPhrase;
    /** @type {string | string[]} */
    unrenderedPhrase;
    /** @type {Record<string, string>} */
    conditionResults;
    /** @type {Record<string, string[]>} */
    storedVariables;
    /** @type {Record<string, {value: number, lastUpdate: Date, resetDelay: number}>} */
    counters;
    /** @type {RegExpExecArray | undefined} */
    regexResult;
    /** @type {RegExpExecArray | undefined} */
    dependencyRegexResult;
    /** @type {string} */
    parseType;
    /** @type {number} */
    deltaTime;
    /** @type {string} */
    characterId;
    /** @type {string} */
    characterName;
    /** @type {string} */
    rawLogEntry;
    /** @type {LogTypes} */
    logType = LogTypes.info;
    /** @type {any} */
    error;
    /** @type {string} */
    errorDescription;

}

class TriggerStoreModel {
    /** @type {number} */
    version;
    /** @type {Trigger[]} */
    triggers;
    /** @type {TriggerFolder[]} */
    folders;
    /** @type {Tag[]} */
    tags;
    /** @type {TriggerPackageVersion[]} */
    installedPackages;
    /** @type {QuickShareVersion[]} */
    installedQuickShares;
    /** @type {Record<string, string>} This maps user overlay ids to author overlay ids. */
    packageOverlayMap;
    /** @type {Record<string, string[]>} This is a record of all package original overlay ids. */
    packageOverlays;
    /** @type {TriggerParseHistoryModel[]} */
    successfulTriggerExecutions = [];
    /** @type {TriggerParseHistoryModel[]} */
    failedTriggerExecutions = [];
    /** @type {TriggerParseHistoryModel[]} */
    exceptionHistory = [];
}

class GinaToNagOverlay {
    /** @type {'text' | 'timer'} */
    GinaOverlayType;
    /** @type {string} */
    GinaOverlay;
    /** @type {string} */
    NagOverlay;
}

module.exports = {
    Trigger,
    TriggerAction,
    ActionTypes,
    LogTypes,
    CapturePhrase,
    ExternalDataSources,
    TriggerConditionTypes,
    OperatorTypes,
    Phrase,
    TriggerFolder,
    MediaTypes,
    FileModel,
    PackageFileModel,
    Tag,
    ImportTypes,
    CharacterClassLevel,
    TimerRestartBehaviors,
    TriggerPackageVersion,
    VersionHistory,
    PackageFolder,
    PackageTrigger,
    TriggerPackageModel,
    TriggerPackageMetaModel,
    QuickShareVersion,
    QuickShareModel,
    QuickShareMetaModel,
    TriggerSubAction,
    VariableAssignment,
    TriggerStoreModel,
    TriggerCondition,
    DuplicateTriggerAction,
    OwnedTriggerAction,
    GinaToNagOverlay,
    TriggerParseHistoryModel,
    getActionLabel,
    ErrorMessages,
};
