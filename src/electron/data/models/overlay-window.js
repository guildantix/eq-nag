const { ActionTypes, TriggerAction } = require( './trigger' );

var TimerSortTypes = {
    '0': 'None',
    '1': 'Ascending',
    '2': 'Descending',
    None: 0,
    Ascending: 1,
    Descending: 2,
}

class OverlayWindow {

    overlayId = null;
    windowHeight = null;
    windowWidth = null;
    x = null;
    y = null;
    name = '';
    overlayType = '';
    fontFamily = 'Roboto';
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
    /** @type {number} */
    voiceIndex = -1;
    /** @type {boolean} */
    hidden = false;
    /** @type {() => void} */
    removeComponent;
}

module.exports = { OverlayWindow, OverlayComponent, TimerSortTypes };
