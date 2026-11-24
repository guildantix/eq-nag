/**
 * Cleans the triggers and folders that arrive from outside the app (server quick
 * shares, trigger packages, and later shared files) before they are stored. A share
 * is written by a stranger, so a field can hold the wrong type (a number or object
 * where text is expected), which would crash the watcher, the renderer or the UI.
 *
 * Each trigger is rebuilt from a list of known fields. Known fields with a safe
 * type slip (a number where text is expected) are converted, fields with an unusable
 * type and unknown fields are dropped, and so are keys such as __proto__, because
 * they are never on the list. Fields that are missing or null are left alone, as
 * older versions exported triggers without many of them. A trigger that can not work
 * (no id, no name, no usable capture phrase) is skipped. Nothing here ever throws.
 */

const { ActionTypes } = require( '../data/models/trigger' );
const { nagId } = require( './nag-id' );
const { serverShareLimits, fileShareLimits } = require( './share-limits' );

/** The most folder levels a share may nest, matching the limit of a shared file. */
const maxFolderDepth = 50;
/**
 * The most triggers one share may carry. The largest real libraries hold about 1,500, so this
 * only stops a crafted share from making the install run for minutes.
 */
const maxSharedTriggers = 10000;
/** The most actions one trigger may carry. Real triggers have a handful, long ones a few dozen. */
const maxActionsPerTrigger = 200;
/** The most entries any other list may carry (capture phrases, exclusions, hotkeys, folders). */
const maxListEntries = 1000;
/** The most overlays one share may carry. */
const maxSharedOverlays = 200;
/** The most skipped trigger names that are reported back, so the message stays short. */
const maxSkippedNamesReported = 3;
/** The longest skipped trigger name that is reported back. */
const maxSkippedNameLength = 60;
/**
 * The highest action type number, read from the ActionTypes model so a new action type is
 * accepted by shares as soon as it is added there, with no second list to keep in step.
 */
const highestActionType = Math.max( ...Object.values( ActionTypes ).filter( value => typeof value === 'number' ) );
/** Returned by a field cleaner when the value can not be kept. */
const dropField = Symbol( 'dropField' );
/**
 * Action fields that hold text. phraseId is a field of old exports (one phrase per action) that
 * the data migration still turns into the phrases list, so it must survive.
 */
const actionTextFields = [
    'phraseId',
    'actionId',
    'overlayId',
    'name',
    'displayText',
    'storageDuration',
    'variableName',
    'storeLiteralDefinition',
    'overrideTimerColor',
    'timerBackgroundColor',
    'timerIconDef',
    'variableStorageType',
    'endingSoonColor',
    'endingSoonBackgroundColor',
    'endingSoonTextOverlayId',
    'endingSoonText',
    'endingSoonSpeakPhrase',
    'endingClipboardText',
    'endingPlayAudioFileId',
    'endedTextOverlayId',
    'endedText',
    'endedSpeakPhrase',
    'endedClipboardText',
    'endedPlayAudioFileId',
    'endedColor',
    'endedBackgroundColor',
    'audioFileId',
    'textFont',
    'textColor',
    'textBorderColor',
    'textGlowColor',
    'listRegexVarName',
    'autoEnumerateListTimerName',
    'listEnrollmentSkipPhrase',
    'listEnrollmentSkipVarName',
    'listEnrollmentRemovePhrase',
    'listEnrollmentRemoveVarName',
    'listEnrollmentAddPhrase',
    'listEnrollmentAddVarName',
    'listEnumerateBeginPhrase',
    'listEnumerateEndPhrase',
    'listManualEnumeratePhrase',
    'listActionTrackingVarName',
    'listTimerActionId',
    'listBoxName',
    'listEnrollmentDeactivatePhrase',
    'listEnrollmentActivatePhrase',
];
/** Action fields that hold a number. */
const actionNumberFields = [
    'duration',
    'repeatCount',
    'ticks',
    'restartBehavior',
    'speechVolume',
    'speechRate',
    'castTime',
    'endingDuration',
    'endingSoonTextDuration',
    'remainDuration',
    'endedTextDuration',
    'audioVolume',
    'textSize',
    'textSpacing',
    'textWeight',
    'textBorderIntensity',
    'textGlowIntensity',
    'textGlowSize',
    'listTopTimerDuration',
    'listBottomTimerDuration',
];
/**
 * Action fields that hold true or false. restartOnDuplicate is a field of old exports, migrated
 * at load.
 */
const actionBooleanFields = [
    'restartOnDuplicate',
    'showRemainingDuration',
    'showDuration',
    'repeatTimer',
    'onlyStoreUsedValues',
    'loopBackForValue',
    'onlyExecuteInDev',
    'useCustomColor',
    'interruptSpeech',
    'hideTimer',
    'speakNext',
    'onlyUseAaBeneficialFocus',
    'skipBenCastingTimeFocus',
    'flash',
    'storeDuration',
    'ifEndingSoon',
    'endingSoonShowTimer',
    'endingSoonChangeColor',
    'endingSoonDisplayText',
    'endingClipboard',
    'endingPlayAudio',
    'endingSoonSpeak',
    'endingSoonInterruptSpeech',
    'remainAfterEnded',
    'notifyWhenEnded',
    'remainUnlessEndedEarly',
    'endedDisplayText',
    'endedSpeak',
    'endedInterruptSpeech',
    'endedClipboard',
    'endedPlayAudio',
    'endedChangeColor',
    'textUseCustomFont',
    'textUseCustomSize',
    'textUseCustomWeight',
    'textUseCustomColor',
    'textUseCustomBorder',
    'textUseCustomGlow',
    'autoEnumerateList',
    'manualEnumerateList',
    'autoEnumerateSpecifyTime',
    'autoEnumerateUseVariable',
    'enableListEnrollment',
    'listEnrollmentShowTimer',
    'listEnableActionTracking',
    'useBackground',
    'listEnableTopTimer',
    'listTopTimerEnum',
    'listTopTimerClearOnDeactivate',
    'listTopHide',
    'listEnableBottomTimer',
    'listBottomTimerEnum',
    'listBottomTimerClearOnDeactivate',
    'listBottomHide',
];
/** Action fields that hold a list of text. */
const actionTextListFields = [
    'phrases',
    'secondaryPhrases',
    'createListPhrases',
    'listActionTrackingPhrase',
    'listTopTimerPhrase',
    'listBottomTimerPhrase',
];
/** Action fields that hold a list of phrases. */
const actionPhraseListFields = [
    'excludeTargets',
    'endEarlyPhrases',
    'resetCounterPhrases',
];
/** Action fields that hold a list of conditions. */
const actionConditionListFields = [
    'hideConditions',
];
/** Action fields that hold a list of sub-actions. */
const actionSubActionListFields = [
    'endingSoonSubActions',
    'endedSubActions',
];

/** Trigger fields and how each one is cleaned. A key not listed here is dropped. */
const triggerFieldTypes = {
    triggerId: 'text',
    folderId: 'text',
    packageId: 'text',
    name: 'text',
    comments: 'text',
    captureMethod: 'text',
    allakhazamUrl: 'text',
    importIdentifier: 'text',
    sequentialRestartBehavior: 'text',
    externalSource: 'text',
    useRegEx: 'boolean',
    predefined: 'boolean',
    onlyExecuteInDev: 'boolean',
    useCooldown: 'boolean',
    enabled: 'boolean',
    cooldownDuration: 'number',
    importType: 'number',
    capturePhrases: 'phraseList',
    actions: 'actionList',
    conditions: 'conditionList',
    classLevels: 'classLevelList',
    hotkeys: 'hotkeyList',
};










/** Phrase fields and how each one is cleaned. */
const phraseFieldTypes = {
    phraseId: 'text',
    phrase: 'text',
    useRegEx: 'boolean',
    ignoreCase: 'boolean',
    dynamic: 'boolean',
    requirePreviousPhrase: 'boolean',
    duration: 'number',
};










/** Condition fields and how each one is cleaned. */
const conditionFieldTypes = {
    conditionId: 'text',
    conditionType: 'number',
    operatorType: 'number',
    variableName: 'text',
    variableValue: 'text',
};










/** Class level fields and how each one is cleaned. */
const classLevelFieldTypes = {
    class: 'text',
    level: 'number',
};










/** Hotkey fields and how each one is cleaned. */
const hotkeyFieldTypes = {
    hotkeyId: 'text',
    name: 'text',
    description: 'text',
    lines: 'textList',
    simpleCommand: 'boolean',
    quickAction: 'boolean',
};










/** Sub-action fields and how each one is cleaned. */
const subActionFieldTypes = {
    actionId: 'text',
    variableValues: 'variableAssignmentList',
};










/** Variable assignment fields and how each one is cleaned. */
const variableAssignmentFieldTypes = {
    name: 'text',
    value: 'text',
};










/** Folder fields and how each one is cleaned. Children are cleaned separately. */
const folderFieldTypes = {
    folderId: 'text',
    name: 'text',
};










/** Overlay fields that hold text. */
const overlayTextFields = [
    'overlayId',
    'name',
    'description',
    'overlayType',
    'fontFamily',
    'horizontalAlignment',
    'verticalAlignment',
    'fontColor',
    'backgroundColor',
    'borderColor',
    'timerColor',
    'timerBackgroundColor',
    'displayLabel',
    'textBorderColor',
    'textGlowColor',
    'groupHeaderColor',
];










/** Overlay fields that hold a number. */
const overlayNumberFields = [
    'windowHeight',
    'windowWidth',
    'x',
    'y',
    'fontSize',
    'lineHeight',
    'fontWeight',
    'fontTransparency',
    'backgroundTransparency',
    'borderTransparency',
    'timerSortType',
    'displayId',
    'textBorderIntensity',
    'textGlowIntensity',
    'textGlowSize',
    'groupHeaderSize',
    'groupHeaderWeight',
    'groupMinWidth',
];










/** Overlay fields that hold true or false. */
const overlayBooleanFields = [
    'showTextBorder',
    'showTextGlow',
    'groupByTarget',
    'showTimeRemaining',
    'hideTargetLabel',
    'reverse',
];










/** Text overflow fields and how each one is cleaned. */
const textOverflowFieldTypes = {
    whiteSpace: 'text',
    overflow: 'text',
    textOverflow: 'text',
};










/** Overlay fields and how each one is cleaned, built from the field lists above. */
const overlayFieldTypes = {
    displayBounds: 'rectangle',
    position: 'rectangle',
    textOverflow: 'textOverflow',
};
overlayTextFields.forEach( fieldName => overlayFieldTypes[ fieldName ] = 'text' );
overlayNumberFields.forEach( fieldName => overlayFieldTypes[ fieldName ] = 'number' );
overlayBooleanFields.forEach( fieldName => overlayFieldTypes[ fieldName ] = 'boolean' );
/** Action fields and how each one is cleaned, built from the field lists above. */
const actionFieldTypes = {
    staticPosition: 'rectangle',
    actionType: 'number',
};

actionFieldTypes.timerIcon = 'icon';
actionTextFields.forEach( fieldName => actionFieldTypes[ fieldName ] = 'text' );
actionNumberFields.forEach( fieldName => actionFieldTypes[ fieldName ] = 'number' );
actionBooleanFields.forEach( fieldName => actionFieldTypes[ fieldName ] = 'boolean' );
actionTextListFields.forEach( fieldName => actionFieldTypes[ fieldName ] = 'textList' );
actionPhraseListFields.forEach( fieldName => actionFieldTypes[ fieldName ] = 'phraseList' );
actionConditionListFields.forEach( fieldName => actionFieldTypes[ fieldName ] = 'conditionList' );
actionSubActionListFields.forEach( fieldName => actionFieldTypes[ fieldName ] = 'subActionList' );










/**
 * Every field table above, by the model it describes. The drift check in tools compares these
 * with the model classes, so a field added to a model can not be silently stripped from shares.
 */
const shareFieldAllowlists = {
    trigger: triggerFieldTypes,
    action: actionFieldTypes,
    phrase: phraseFieldTypes,
    condition: conditionFieldTypes,
    classLevel: classLevelFieldTypes,
    subAction: subActionFieldTypes,
    variableAssignment: variableAssignmentFieldTypes,
    folder: folderFieldTypes,
    overlay: overlayFieldTypes,
};










/**
 * Returns true when the value is a plain object (not null, not a list).
 *
 * @param {any} value The value to test.
 */
function isPlainObject( value ) {
    return typeof value === 'object' && value !== null && !Array.isArray( value );
}










/**
 * Returns true when the object has the key as its own property, so inherited names
 * such as constructor never count as a known field.
 *
 * @param {object} owner The object to look in.
 * @param {string} key The key to look for.
 */
function hasOwnKey( owner, key ) {
    return Object.prototype.hasOwnProperty.call( owner, key );
}










/**
 * Returns true when the value is neither null nor undefined.
 *
 * @param {any} value The value to test.
 */
function isPresent( value ) {
    return value !== null && value !== undefined;
}










/**
 * Cleans a text value. Numbers and booleans become text, long text is cut, the rest is dropped.
 *
 * @param {any} value The value to clean.
 * @param {{ repairCount: number }} tally Counts each change made.
 * @param {{ maxTextLength: number, maxIconLength: number }} limits The size caps to apply.
 */
function cleanText( value, tally, limits ) {
    if ( typeof value === 'string' && value.length <= limits.maxTextLength ) {
        return value;
    }

    tally.repairCount++;

    if ( typeof value === 'string' ) {
        return value.slice( 0, limits.maxTextLength );
    }

    if ( ( typeof value === 'number' && Number.isFinite( value ) ) || typeof value === 'boolean' ) {
        return String( value );
    }

    return dropField;
}










/**
 * Cleans an icon value. An icon is kept whole or dropped, never cut, because a cut data URL
 * still looks like an image but installs as a broken one.
 *
 * @param {any} value The value to clean.
 * @param {{ repairCount: number }} tally Counts each change made.
 * @param {{ maxTextLength: number, maxIconLength: number }} limits The size caps to apply.
 */
function cleanIcon( value, tally, limits ) {
    if ( typeof value === 'string' && value.length <= limits.maxIconLength ) {
        return value;
    }

    tally.repairCount++;

    return dropField;
}










/**
 * Returns true when the text can not be an id, because ids are used as keys of plain objects and
 * a name that plain objects already have (constructor, toString, __proto__) would read an
 * inherited member instead of a missing entry. 'prototype' is not inherited but stays blocked,
 * as it always was, because it is a trap for code that copies objects.
 *
 * @param {any} value The value to test.
 */
function isForbiddenId( value ) {
    return typeof value === 'string' && ( value in Object.prototype || value === 'prototype' );
}










/**
 * Cleans a number value. Text that holds a number becomes a number, anything else is dropped.
 *
 * @param {any} value The value to clean.
 * @param {{ repairCount: number }} tally Counts each change made.
 */
function cleanNumber( value, tally ) {
    if ( typeof value === 'number' && Number.isFinite( value ) ) {
        return value;
    }

    tally.repairCount++;

    if ( typeof value === 'string' && value.trim() !== '' && Number.isFinite( Number( value ) ) ) {
        return Number( value );
    }

    return dropField;
}










/**
 * Cleans a true or false value. Anything that is not true or false is dropped.
 *
 * @param {any} value The value to clean.
 * @param {{ repairCount: number }} tally Counts each change made.
 */
function cleanBoolean( value, tally ) {
    if ( typeof value === 'boolean' ) {
        return value;
    }

    tally.repairCount++;

    return dropField;
}










/**
 * Cleans a screen rectangle, keeping only its four numbers.
 *
 * @param {any} value The value to clean.
 * @param {{ repairCount: number }} tally Counts each change made.
 */
function cleanRectangle( value, tally ) {
    const rectangleKeys = [ 'x', 'y', 'width', 'height' ];

    if ( !isPlainObject( value ) ) {
        tally.repairCount++;
        return dropField;
    }

    const rectangle = {};

    Object.keys( value ).forEach( key => {
        if ( rectangleKeys.includes( key ) && typeof value[ key ] === 'number' && Number.isFinite( value[ key ] ) ) {
            rectangle[ key ] = value[ key ];
        } else {
            tally.repairCount++;
        }
    } );

    return rectangle;
}










/**
 * Cleans a list of text. Entries that are not text are converted or removed.
 *
 * @param {any} value The value to clean.
 * @param {{ repairCount: number }} tally Counts each change made.
 * @param {{ maxTextLength: number, maxIconLength: number }} limits The size caps to apply.
 */
function cleanTextList( value, tally, limits ) {
    if ( !Array.isArray( value ) ) {
        tally.repairCount++;
        return [];
    }

    const cleanedList = [];

    if ( value.length > maxListEntries ) {
        tally.repairCount++;
    }

    value.slice( 0, maxListEntries ).forEach( entry => {
        const cleanedEntry = cleanText( entry, tally, limits );
        if ( cleanedEntry !== dropField ) {
            cleanedList.push( cleanedEntry );
        }
    } );

    return cleanedList;
}










/**
 * Cleans a list of objects with the given cleaner. Entries the cleaner drops are removed.
 *
 * @param {any} value The value to clean.
 * @param {( entry: any, tally: { repairCount: number }, limits: { maxTextLength: number,
 * maxIconLength: number } ) => object | null} cleanEntry Cleans one entry, returns null to drop it.
 * @param {{ repairCount: number }} tally Counts each change made.
 * @param {{ maxTextLength: number, maxIconLength: number }} limits The size caps to apply.
 * @param {number} [maxEntries] The most entries that are kept.
 */
function cleanObjectList( value, cleanEntry, tally, limits, maxEntries = maxListEntries ) {
    if ( !Array.isArray( value ) ) {
        tally.repairCount++;
        return [];
    }

    const cleanedList = [];

    if ( value.length > maxEntries ) {
        tally.repairCount++;
    }

    value.slice( 0, maxEntries ).forEach( entry => {
        const cleanedEntry = cleanEntry( entry, tally, limits );
        if ( cleanedEntry === null ) {
            tally.repairCount++;
        } else {
            cleanedList.push( cleanedEntry );
        }
    } );

    return cleanedList;
}










/**
 * Cleans one field value according to its type name.
 *
 * @param {string} fieldType The type name from one of the field tables.
 * @param {any} value The value to clean.
 * @param {{ repairCount: number }} tally Counts each change made.
 * @param {{ maxTextLength: number, maxIconLength: number }} limits The size caps to apply.
 */
function cleanFieldValue( fieldType, value, tally, limits ) {
    if ( fieldType === 'text' ) {
        return cleanText( value, tally, limits );
    }
    if ( fieldType === 'icon' ) {
        return cleanIcon( value, tally, limits );
    }
    if ( fieldType === 'number' ) {
        return cleanNumber( value, tally );
    }
    if ( fieldType === 'boolean' ) {
        return cleanBoolean( value, tally );
    }
    if ( fieldType === 'rectangle' ) {
        return cleanRectangle( value, tally );
    }
    if ( fieldType === 'textOverflow' ) {
        return cleanKnownFields( value, textOverflowFieldTypes, tally, limits ) ?? dropField;
    }
    if ( fieldType === 'textList' ) {
        return cleanTextList( value, tally, limits );
    }
    if ( fieldType === 'phraseList' ) {
        return cleanObjectList( value, cleanPhrase, tally, limits );
    }
    if ( fieldType === 'actionList' ) {
        return cleanObjectList( value, cleanAction, tally, limits, maxActionsPerTrigger );
    }
    if ( fieldType === 'conditionList' ) {
        return cleanObjectList( value, cleanCondition, tally, limits );
    }
    if ( fieldType === 'classLevelList' ) {
        return cleanObjectList( value, cleanClassLevel, tally, limits );
    }
    if ( fieldType === 'hotkeyList' ) {
        return cleanObjectList( value, cleanHotkey, tally, limits );
    }
    if ( fieldType === 'subActionList' ) {
        return cleanObjectList( value, cleanSubAction, tally, limits );
    }
    if ( fieldType === 'variableAssignmentList' ) {
        return cleanObjectList( value, cleanVariableAssignment, tally, limits );
    }

    return dropField;
}










/**
 * Rebuilds an object from the known fields of a table, in the order they arrived.
 * Missing and null fields are kept as they are, so older exports come through as written.
 *
 * @returns {object | null} The cleaned object, or null when the input is not an object.
 *
 * @param {any} source The object to clean.
 * @param {Record<string, string>} fieldTypes The known fields and their type names.
 * @param {{ repairCount: number }} tally Counts each change made.
 * @param {{ maxTextLength: number, maxIconLength: number }} limits The size caps to apply.
 */
function cleanKnownFields( source, fieldTypes, tally, limits ) {
    if ( !isPlainObject( source ) ) {
        return null;
    }

    const cleaned = {};

    Object.keys( source ).forEach( key => {
        if ( !hasOwnKey( fieldTypes, key ) ) {
            tally.repairCount++;
            return;
        }

        const value = source[ key ];

        if ( value === null ) {
            cleaned[ key ] = null;
            return;
        }

        if ( value === undefined ) {
            return;
        }

        const cleanedValue = cleanFieldValue( fieldTypes[ key ], value, tally, limits );

        // Ids are used as keys of plain objects, so a name like __proto__ is never an id.
        if ( key.endsWith( 'Id' ) && isForbiddenId( cleanedValue ) ) {
            tally.repairCount++;
            return;
        }

        if ( cleanedValue !== dropField ) {
            cleaned[ key ] = cleanedValue;
        }
    } );

    return cleaned;
}










/**
 * Cleans one phrase. A phrase without text is dropped, and one without a usable id gets a new one.
 *
 * @param {any} phrase The phrase to clean.
 * @param {{ repairCount: number }} tally Counts each change made.
 * @param {{ maxTextLength: number, maxIconLength: number }} limits The size caps to apply.
 */
function cleanPhrase( phrase, tally, limits ) {
    const cleaned = cleanKnownFields( phrase, phraseFieldTypes, tally, limits );

    if ( cleaned === null || typeof cleaned.phrase !== 'string' ) {
        return null;
    }

    // The log watcher caches each phrase's compiled pattern by phraseId, so two phrases that
    // share a missing or rejected id would both match with the first one's pattern.
    if ( typeof cleaned.phraseId !== 'string' || cleaned.phraseId === '' ) {
        cleaned.phraseId = nagId();
        tally.repairCount++;
    }

    return cleaned;
}










/**
 * Cleans one condition.
 *
 * @param {any} condition The condition to clean.
 * @param {{ repairCount: number }} tally Counts each change made.
 * @param {{ maxTextLength: number, maxIconLength: number }} limits The size caps to apply.
 */
function cleanCondition( condition, tally, limits ) {
    return cleanKnownFields( condition, conditionFieldTypes, tally, limits );
}










/**
 * Cleans one class level.
 *
 * @param {any} classLevel The class level to clean.
 * @param {{ repairCount: number }} tally Counts each change made.
 * @param {{ maxTextLength: number, maxIconLength: number }} limits The size caps to apply.
 */
function cleanClassLevel( classLevel, tally, limits ) {
    return cleanKnownFields( classLevel, classLevelFieldTypes, tally, limits );
}










/**
 * Cleans one hotkey.
 *
 * @param {any} hotkey The hotkey to clean.
 * @param {{ repairCount: number }} tally Counts each change made.
 * @param {{ maxTextLength: number, maxIconLength: number }} limits The size caps to apply.
 */
function cleanHotkey( hotkey, tally, limits ) {
    return cleanKnownFields( hotkey, hotkeyFieldTypes, tally, limits );
}










/**
 * Cleans one sub-action.
 *
 * @param {any} subAction The sub-action to clean.
 * @param {{ repairCount: number }} tally Counts each change made.
 * @param {{ maxTextLength: number, maxIconLength: number }} limits The size caps to apply.
 */
function cleanSubAction( subAction, tally, limits ) {
    return cleanKnownFields( subAction, subActionFieldTypes, tally, limits );
}










/**
 * Cleans one variable assignment.
 *
 * @param {any} assignment The variable assignment to clean.
 * @param {{ repairCount: number }} tally Counts each change made.
 * @param {{ maxTextLength: number, maxIconLength: number }} limits The size caps to apply.
 */
function cleanVariableAssignment( assignment, tally, limits ) {
    return cleanKnownFields( assignment, variableAssignmentFieldTypes, tally, limits );
}










/**
 * Cleans one action. An action without a known action type is dropped, because the
 * watcher can not run it.
 *
 * @param {any} action The action to clean.
 * @param {{ repairCount: number }} tally Counts each change made.
 * @param {{ maxTextLength: number, maxIconLength: number }} limits The size caps to apply.
 */
function cleanAction( action, tally, limits ) {
    const cleaned = cleanKnownFields( action, actionFieldTypes, tally, limits );

    if ( cleaned === null || !Number.isInteger( cleaned.actionType ) || cleaned.actionType < 0 || cleaned.actionType > highestActionType ) {
        return null;
    }

    return cleaned;
}










/**
 * Cleans one trigger. A trigger with no id, no name or no usable capture phrase is
 * dropped, because it could never fire or would replace another trigger.
 *
 * @returns {object | null} The cleaned trigger, or null when it can not be used.
 *
 * @param {any} trigger The trigger to clean.
 * @param {{ repairCount: number }} tally Counts each change made.
 * @param {{ maxTextLength: number, maxIconLength: number }} limits The size caps to apply.
 */
function cleanTrigger( trigger, tally, limits ) {
    const cleaned = cleanKnownFields( trigger, triggerFieldTypes, tally, limits );

    if ( cleaned === null ) {
        return null;
    }

    const hasId = typeof cleaned.triggerId === 'string' && cleaned.triggerId.trim() !== '';
    const hasName = typeof cleaned.name === 'string' && cleaned.name.trim() !== '';

    if ( !hasId || !hasName ) {
        return null;
    }

    // The install code loops over these two lists, so they must exist.
    cleaned.capturePhrases = cleaned.capturePhrases ?? [];
    cleaned.actions = cleaned.actions ?? [];

    // An empty phrase would match every log line.
    cleaned.capturePhrases = cleaned.capturePhrases.filter( capturePhrase => capturePhrase.phrase.trim() !== '' );

    if ( cleaned.capturePhrases.length === 0 ) {
        return null;
    }

    return cleaned;
}










/**
 * Returns the name to show for a skipped trigger, or 'unnamed' when it has none.
 *
 * @param {any} trigger The trigger that was skipped.
 */
function describeSkippedTrigger( trigger ) {
    try {
        if ( isPlainObject( trigger ) && typeof trigger.name === 'string' && trigger.name.trim() !== '' ) {
            return trigger.name.trim().slice( 0, maxSkippedNameLength );
        }
    } catch ( error ) {
        return 'unnamed';
    }

    return 'unnamed';
}










/**
 * Cleans a list of shared triggers.
 *
 * @returns {{ triggers: object[], fixedCount: number, skippedCount: number,
 * skippedNames: string[] }} The usable triggers, how many of them had a field changed, how many
 * were skipped, and the names of the first few skipped triggers.
 *
 * @param {any} triggers The shared triggers.
 * @param {{ maxTextLength: number, maxIconLength: number }} [limits] The size caps to apply, the
 * server caps when left out.
 */
function normalizeSharedTriggers( triggers, limits = serverShareLimits ) {
    const result = { triggers: [], fixedCount: 0, skippedCount: 0, skippedNames: [] };

    if ( !Array.isArray( triggers ) ) {
        return result;
    }

    // Reading a hostile list can throw (a getter or a proxy), and the install must go on.
    try {
        // Triggers past the limit are never looked at, only counted as skipped.
        if ( triggers.length > maxSharedTriggers ) {
            result.skippedCount += triggers.length - maxSharedTriggers;
        }

        triggers.slice( 0, maxSharedTriggers ).forEach( trigger => {
            const tally = { repairCount: 0 };
            let cleaned = null;

            try {
                cleaned = cleanTrigger( trigger, tally, limits );
            } catch ( error ) {
                cleaned = null;
            }

            if ( cleaned === null ) {
                result.skippedCount++;
                if ( result.skippedNames.length < maxSkippedNamesReported ) {
                    result.skippedNames.push( describeSkippedTrigger( trigger ) );
                }
            } else {
                result.triggers.push( cleaned );
                if ( tally.repairCount > 0 ) {
                    result.fixedCount++;
                }
            }
        } );
    } catch ( error ) {
        result.skippedCount++;
    }

    return result;
}










/**
 * Cleans a list of shared folders and their children. Folders without an id or a
 * name are dropped, and folders nested deeper than the limit are cut off.
 *
 * @param {any} folders The shared folders.
 * @param {{ maxTextLength: number, maxIconLength: number }} [limits] The size caps to apply, the
 * server caps when left out.
 * @param {number} [depth] The level of the list, 1 for the top level.
 */
function normalizeSharedFolders( folders, limits = serverShareLimits, depth = 1 ) {
    if ( !Array.isArray( folders ) || depth > maxFolderDepth ) {
        return [];
    }

    const cleanedFolders = [];

    // Reading a hostile list can throw (a getter or a proxy), and the install must go on.
    try {
        folders.slice( 0, maxListEntries ).forEach( folder => {
            const cleaned = cleanKnownFields( folder, folderFieldTypes, { repairCount: 0 }, limits );

            const hasId = cleaned !== null && typeof cleaned.folderId === 'string' && cleaned.folderId.trim() !== '';
            const hasName = cleaned !== null && typeof cleaned.name === 'string' && cleaned.name.trim() !== '';

            if ( !hasId || !hasName ) {
                return;
            }

            cleaned.children = normalizeSharedFolders( folder.children, limits, depth + 1 );
            cleanedFolders.push( cleaned );
        } );
    } catch ( error ) {
        return cleanedFolders;
    }

    return cleanedFolders;
}










/**
 * Cleans one overlay. An overlay without a usable id is dropped, because triggers use the id.
 *
 * @param {any} overlay The overlay to clean.
 * @param {{ repairCount: number }} tally Counts each change made.
 * @param {{ maxTextLength: number, maxIconLength: number }} limits The size caps to apply.
 */
function cleanOverlay( overlay, tally, limits ) {
    const cleaned = cleanKnownFields( overlay, overlayFieldTypes, tally, limits );

    if ( cleaned === null || typeof cleaned.overlayId !== 'string' || cleaned.overlayId.trim() === '' ) {
        return null;
    }

    return cleaned;
}










/**
 * Cleans a list of shared overlays.
 *
 * @param {any} overlays The shared overlays.
 * @param {{ maxTextLength: number, maxIconLength: number }} [limits] The size caps to apply, the
 * server caps when left out.
 */
function normalizeSharedOverlays( overlays, limits = serverShareLimits ) {
    try {
        return cleanObjectList( overlays, cleanOverlay, { repairCount: 0 }, limits, maxSharedOverlays );
    } catch ( error ) {
        return [];
    }
}










/**
 * Cleans the size of the display a share was made on. A size without a positive width and height is
 * dropped, because the overlay placement divides by it.
 *
 * @returns {{ width: number, height: number } | undefined} The size, or undefined when unusable.
 *
 * @param {any} displaySize The shared display size.
 */
function normalizeSharedDisplaySize( displaySize ) {
    const cleaned = cleanKnownFields( displaySize, { width: 'number', height: 'number' }, { repairCount: 0 }, serverShareLimits );

    if ( cleaned === null || !( cleaned.width > 0 ) || !( cleaned.height > 0 ) ) {
        return undefined;
    }

    return { width: cleaned.width, height: cleaned.height };
}










/**
 * Cleans an overlay id. Anything that is not a usable id becomes undefined.
 *
 * @returns {string | undefined} The id, or undefined when unusable.
 *
 * @param {any} overlayId The shared overlay id.
 * @param {{ maxTextLength: number, maxIconLength: number }} [limits] The size caps to apply, the
 * server caps when left out.
 */
function normalizeSharedOverlayId( overlayId, limits = serverShareLimits ) {
    const cleaned = cleanText( overlayId, { repairCount: 0 }, limits );

    if ( typeof cleaned !== 'string' || cleaned.trim() === '' || isForbiddenId( cleaned ) ) {
        return undefined;
    }

    return cleaned;
}










/**
 * Cleans the overlay part of a share: the packaged overlays, the display size and the default
 * overlay ids. Missing values stay missing, as older packages leave some of them out.
 *
 * @param {any} packageOverlays The shared overlays.
 * @param {any} defaultOverlayIds The shared default overlay ids.
 * @param {any} primaryDisplaySize The shared display size.
 * @param {{ maxTextLength: number, maxIconLength: number }} [limits] The size caps to apply, the
 * server caps when left out.
 */
function normalizeSharedOverlayInput( packageOverlays, defaultOverlayIds, primaryDisplaySize, limits = serverShareLimits ) {
    const cleanedIds = {};

    [ 'detrimentalOverlayId', 'beneficialOverlayId', 'textOverlayId' ].forEach( idName => {
        cleanedIds[ idName ] = isPlainObject( defaultOverlayIds )
            ? normalizeSharedOverlayId( defaultOverlayIds[ idName ], limits )
            : undefined;
    } );

    return {
        packageOverlays: isPresent( packageOverlays ) ? normalizeSharedOverlays( packageOverlays, limits ) : packageOverlays,
        defaultOverlayIds: cleanedIds,
        primaryDisplaySize: isPresent( primaryDisplaySize ) ? normalizeSharedDisplaySize( primaryDisplaySize ) : undefined,
    };
}










/**
 * Cleans the triggers, folders and overlays of a share or package model in place, so the install
 * code only ever sees known fields of the right type.
 *
 * @returns {{ isUsable: boolean, failureReason: string, fixedCount: number, skippedCount: number,
 * skippedNames: string[] }} isUsable is false, and nothing should be installed, when the model is
 * not an object or when it had triggers and none of them survived. failureReason says which of the
 * three ('notAnObject', 'noUsableTriggers' or 'unreadable'). The other values say how many
 * triggers had a field changed, how many were skipped because they were damaged or over the
 * limit, and the names of the first few skipped.
 *
 * @param {{ triggers?: any, folders?: any }} model The package or quick share model.
 * @param {{ maxTextLength: number, maxIconLength: number }} [limits] The size caps to apply. Server
 * shares use the default, a shared file passes fileShareLimits.
 */
function normalizeSharedModel( model, limits = serverShareLimits ) {
    if ( !isPlainObject( model ) ) {
        return { isUsable: false, failureReason: 'notAnObject', fixedCount: 0, skippedCount: 0, skippedNames: [] };
    }

    // The model's own properties can be getters that throw, so the reads are guarded too.
    try {
        // A share with folders or overlays only is fine, but one that had triggers and lost
        // every one of them is damaged.
        const hadTriggers = Array.isArray( model.triggers ) && model.triggers.length > 0;
        const triggerResult = normalizeSharedTriggers( model.triggers, limits );

        model.triggers = triggerResult.triggers;
        model.folders = normalizeSharedFolders( model.folders, limits );

        if ( isPresent( model.overlays ) ) {
            model.overlays = normalizeSharedOverlays( model.overlays, limits );
        }

        const overlayInput = normalizeSharedOverlayInput( model.packageOverlays, model, model.primaryDisplaySize, limits );

        model.packageOverlays = overlayInput.packageOverlays;
        model.primaryDisplaySize = overlayInput.primaryDisplaySize;
        model.detrimentalOverlayId = overlayInput.defaultOverlayIds.detrimentalOverlayId;
        model.beneficialOverlayId = overlayInput.defaultOverlayIds.beneficialOverlayId;
        model.textOverlayId = overlayInput.defaultOverlayIds.textOverlayId;

        const hasNoUsableTriggers = hadTriggers && triggerResult.triggers.length === 0;

        return {
            isUsable: !hasNoUsableTriggers,
            failureReason: hasNoUsableTriggers ? 'noUsableTriggers' : '',
            fixedCount: triggerResult.fixedCount,
            skippedCount: triggerResult.skippedCount,
            skippedNames: triggerResult.skippedNames,
        };
    } catch ( error ) {
        model.triggers = [];
        model.folders = [];

        return { isUsable: false, failureReason: 'unreadable', fixedCount: 0, skippedCount: 1, skippedNames: [ 'unnamed' ] };
    }
}










module.exports = {
    serverShareLimits,
    fileShareLimits,
    shareFieldAllowlists,
    normalizeSharedTriggers,
    normalizeSharedFolders,
    normalizeSharedOverlays,
    normalizeSharedOverlayInput,
    normalizeSharedModel,
};
