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
    unset   : 0,
    left    : 1<<0,
    right   : 1<<1,
    bottom  : 1<<2,
    top     : 1<<3,
    random  : 1<<4,
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

    /** @type {boolean} */
    reverse = false;

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
    /** @type {'pause'|'stop'|'continue'|'running'|'paused'|'ended'} */
    stopwatchState = 'running';
}

class OverlayStoreModel {
    /** @type {number} */
    version;
    /** @type {OverlayWindow[]} */
    overlays;
    /** @type {FctCombatGroup[]} */
    fctCombatGroups;
    /** @type {Record<string, string>} */
    overlayMap = {};
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
    blowout = false;
    /** @type {boolean} */
    fadeIn = false;
    /** @type {boolean} */
    fadeOut = false;
    /** @type {boolean} */
    grow = false;
    /** @type {boolean} */
    shrink = false;
}

/** @type {string[]} */
const combatTypes = [
    'myHits',
    'otherHitsOnMe',
    'mySpellHits',
    'otherSpellHitsOnMe',
    'myHealing',
    'otherHealingOnMe',
    'skillUp',
];

class CombatTypes {
    /** @type {boolean} */
    myHits = false;
    /** @type {boolean} */
    otherHitsOnMe = false;
    /** @type {boolean} */
    mySpellHits = false;
    /** @type {boolean} */
    otherSpellHitsOnMe = false;
    /** @type {boolean} */
    myHealing = false;
    /** @type {boolean} */
    otherHealingOnMe = false;
    /** @type {boolean} */
    skillUp = false;

    /**
     * Returns a unique hash number for the given object.
     * @returns {number}
     * @param {CombatTypes} obj
     */
    static getFlagsValue( obj ) {
        let flags = 0;
        let keys = Object.keys( obj );
        
        for ( let i = 0; i < keys.length; i++ ) {
            if ( obj[ keys[ i ] ] === true ) {
                let o = combatTypes.indexOf( keys[ i ] );
                if ( o >= 0 ) {
                    flags = flags | ( 1 << o );
                }
            }
        }
        
        return flags;
    }
}

/** @type {string[]} */
const combatModifiers = [
    'unset',
    'normal',
    'critical',
    'crippling_blow',
    'flurry',
    'lucky',
    'twincast',
    'riposte',
    'strikethrough',
    'wild_rampage',
    'rampage',
    'assassinate',
    'headshot',
    'double_bow_shot',
    'deadly_strike',
    'finishing_blow',
];

/**
 * Returns a unique hash number for the given combat modifiers.
 * 
 * @param {string[]} modifiers The combat modifiers to hash.
 */
function getCombatModifiersFlags( modifiers ) {
    let flags = 0;
    for ( let i = 0; i < modifiers.length; i++ ) {
        let index = combatModifiers.indexOf( modifiers[ i ] );
        if ( index >= 0 ) {
            flags = flags | ( 1 << index );
        }
    }
    return flags;
}

class FctCombatGroup {
    /** @type {string} */
    combatGroupId;
    /** @type {string} */
    name;
    /** @type {string} */
    overlayId;
    /** @type {CombatTypes} */
    combatTypes = new CombatTypes();
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
    /** @type {string[]} */
    combatModifiers = [];

    /** @type {number} */
    displayValue = 255;
    /** @type {string} */
    displayType = 'hit';
    /** @type {'light' | 'dark'} */
    displayBackground = 'dark';
    /** @type {'value' | 'source' | 'animations'} */
    editStylesType = 'value';

    /** @type {number} */
    _combatTypesFlags = 0;
    /** @type {number} */
    _combatModifiersFlags = 0;
}

module.exports = { OverlayDimensions, OverlayWindow, OverlayComponent, TimerSortTypes, OverlayStoreModel, TriggerSecondaryActionModel, CombatAnimations, CombatTypes, FctCombatGroup, HitStartPositionTypes, getCombatModifiersFlags };
