const { ActionTypes, TriggerAction } = require( './trigger' );

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
}

module.exports = { OverlayWindow, OverlayComponent };
