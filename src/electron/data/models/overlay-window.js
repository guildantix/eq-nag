const { TriggerAction } = require( './trigger' );
const { StylePropertiesModel } = require( './core' );

var TimerSortTypes = {
    '0': 'None',
    '1': 'Ascending',
    '2': 'Descending',
    None: 0,
    Ascending: 1,
    Descending: 2,
}

const HitStartPositionTypes = {
    '0': 'unset',
    '1': 'left',
    '2': 'right',
    '4': 'bottom',
    '8': 'top',
    '16': 'random',
    unset : 0,
    left : 1,
    right : 2,
    bottom : 4,
    top : 8,
    random : 16,
}

class OverlayDimensions {
    /** @type string */
    overlayId;
    /** @type {number} */
    windowHeight;
    /** @type {number} */
    windowWidth;
    /** @type {number} */
    x;
    /** @type {number} */
    y;
    /** @type {Electron.Rectangle} */
    displayBounds = null;
}

class OverlayWindow {

    overlayId = null;
    windowHeight = null;
    windowWidth = null;
    x = null;
    y = null;
    name = '';
    description = '';
    overlayType = '';
    fontFamily = 'Roboto';
    horizontalAlignment = 'center';
    verticalAlignment = 'bottom';
    fontSize = 14;
    lineHeight = 90;
    fontWeight = 400;
    fontColor = '#ffffff';
    fontTransparency = 1.0;
    backgroundColor = '#000000';
    backgroundTransparency = 1.0;
    borderColor = '#000000';
    borderTransparency = 1.0;
    timerSortType = TimerSortTypes.None;
    /** @type string */
    timerColor = '#008000';
    /** @type string */
    timerBackgroundColor = '#0080004b';
    /** @type {number|null} */
    displayId = null;
    /** @type {string|null} */
    displayLabel = null;
    /** @type {Electron.Rectangle} */
    displayBounds = null;
    /** @type {{x: number, y: number}|null} */
    position = null;
    
    /** @type {boolean} */
    showTextBorder = false;
    /** @type string */
    textBorderColor = '#000000';
    /** @type {number} */
    textBorderIntensity = 1;
    
    /** @type {boolean} */
    showTextGlow = false;
    /** @type {string} */
    textGlowColor = '#000000';
    /** @type {number} */
    textGlowIntensity = 1;
    /** @type {number} */
    textGlowSize = 10;

    /** @type {boolean} */
    groupByTarget = false;

    /** @type {number} */
    groupHeaderSize = 40;

    /** @type {number} */
    groupHeaderWeight = 400;
    
    /** @type string */
    groupHeaderColor = '#ffffff';
    
    /** @type {boolean} */
    showTimeRemaining = false;
    
    /** @type {boolean} */
    hideTargetLabel = false;

}

class OverlayComponent {

    /** @type {string} */
    instanceId;
    /** @type {string} */
    description;
    /** @type {string} */
    triggerId;
    /** @type {string} */
    triggerName;
    /** @type {TriggerAction} */
    action;
    /** @type {RegExpExecArray} */
    matches = [];
    /** @type {Date} */
    removeAt;
    /** @type {HTMLDivElement} */
    dom;
    overlayId = '';
    intervalId = -1;
    /** @type {Date} */
    start;
    /** @type {Date} */
    timestamp;
    /** @type {number} */
    percentRemaining;
    /** @type {boolean} */
    endingSoonSpoken = false;
    /** @type {boolean} */
    endingSoonTextDisplayed = false;
    /** @type {boolean} */
    endingSoonSubActionsExecuted = false;
    /** @type {boolean} */
    endedSubActionsExecuted = false;
    /** @type {number} */
    voiceIndex = -1;
    /** @type {boolean} */
    hidden = false;
    /** @type {() => void} */
    removeComponent;
}

class OverlayStoreModel {
    /** @type {number} */
    version;
    /** @type {OverlayWindow[]} */
    overlays;
}

class TriggerSecondaryActionModel {
    /** @type {'setStart'|'extendDuration'|'clipTimer'} */
    action;
    /** @type {Date} */
    timestamp;
    /** @type {string} */
    instanceId;
    /** @type {number} */
    duration;
}

class CombatAnimations {
    /** @type {boolean} */
    fountain = false;
    /** @type {boolean} */
    scroll = false;
    /** @type {boolean} */
    pulsate = false;
    /** @type {boolean} */
    fadeIn = false;
    /** @type {boolean} */
    fadeOut = false;
    /** @type {boolean} */
    grow = false;
    /** @type {boolean} */
    shrink = false;
}

class FctCombatGroup {
    /** @type {string} */
    combatGroupId;
    /** @type {string} */
    name;
    /** @type {StylePropertiesModel} */
    valueStyles = new StylePropertiesModel();
    /** @type {StylePropertiesModel} */
    sourceStyles = new StylePropertiesModel();
    startingPosition = HitStartPositionTypes.unset;
    /** @type {boolean} */
    accumulateHits = false;
    /** @type {boolean} */
    ignoreHits = false;
    /** @type {'percent' | 'value' | 'dynamic'} */
    thresholdType = 'percent';
    /** @type {number | undefined} */
    thresholdValue = undefined;
    /** @type {number} */
    thresholdPercent = 60;
    /** @type {CombatAnimations} */
    combatAnimations = new CombatAnimations();
}

module.exports = { OverlayDimensions, OverlayWindow, OverlayComponent, TimerSortTypes, OverlayStoreModel, TriggerSecondaryActionModel, CombatAnimations, FctCombatGroup, HitStartPositionTypes };
