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
}

class OverlayComponent {

    /** @type {string} */
    instanceId;
    /** @type {string} */
    description;
    /** @type {TriggerAction} */
    action;
    /** @type {string[]} */
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

}

module.exports = { OverlayWindow, OverlayComponent, TimerSortTypes };
