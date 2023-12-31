const { getCurrentWindow, screen } = require( '@electron/remote' );
const { ipcRenderer } = require( 'electron' );

var mouseEnabled = false;
var dynamicMouseIntervalId = null;
var origin = { x: 0, y: 0 };
const _domRefreshMs = 5000;
const _intervalMs = 33;
var _intervalCount = 0;
/** @type {NodeListOf<Element> | undefined} */
var mouseEnabledDoms = undefined;









/**
 * Disables mouse events.
 */
function setIgnoreMouseEvents() {
    if ( mouseEnabled ) {
        mouseEnabled = false;
        getCurrentWindow().setIgnoreMouseEvents( true, { forward: false } );
        if ( dynamicMouseIntervalId == null ) {
            dynamicMouseIntervalId = window.setInterval( trackDynamicMouse, 33 );
        }
        ipcRenderer.send( 'window:unfocus' );
    }
}










/**
 * Enables mouse events.
 * 
 * @param {boolean | undefined} keepEnabled If true, mouse events will not be disabled dynamically.
 */
function setHandleMouseEvents( keepEnabled ) {
    if ( !mouseEnabled ) {
        mouseEnabled = true;
        getCurrentWindow().setIgnoreMouseEvents( false );
        if ( keepEnabled ) {
            window.clearInterval( dynamicMouseIntervalId );
            dynamicMouseIntervalId = null;
        }
    }
}










/**
 * Returns the current mouse screen coordinates.
 * 
 * @returns {{x: number, y: number}} The mouse coordinates.
 */
function getMouseUpdate() {
    const { x, y } = screen.getCursorScreenPoint();
    return { x, y };
}










/**
 * Dynamically tracks the mouse, and enables/disables mouse events based on the mouse's position.
 */
function trackDynamicMouse() {
    mouseEnabledDoms = mouseEnabledDoms ?? document.querySelectorAll( '.dynamic-mouse' );
    let mouseCoords = getMouseUpdate();

    // If the mouse is over a dynamic-mouse element, then we want to set the mouse events to be handled.
    let mouseEnabled = false;
    
    for ( let i = 0; i < mouseEnabledDoms.length; i++ ) {
        const dom = mouseEnabledDoms[i];
        let rect = dom.getBoundingClientRect();
        if ( (rect.x - origin.x) <= mouseCoords.x && (rect.x - origin.x) + rect.width >= mouseCoords.x && (rect.y - origin.y) <= mouseCoords.y && (rect.y - origin.y) + rect.height >= mouseCoords.y ) {
            setHandleMouseEvents();
            mouseEnabled = true;
            break;
        }
    }

    // Otherwise, we want to ignore mouse events.
    if ( mouseEnabled === false ) {
        setIgnoreMouseEvents();
    }

    _intervalCount++;
    if ( _intervalCount > (_domRefreshMs / _intervalMs) ) {
        mouseEnabledDoms = undefined;
        _intervalCount = 0;
    }
}










const MouseUtilities = {
    mouseEnabled: mouseEnabled,
    dynamicMouseIntervalId: dynamicMouseIntervalId,
    /**
     * Enables dynamic mouse tracking.
     * @param {{x: number, y: number}} screenOrigin The screen coordinates of the origin of the window.
     */
    trackDynamicMouse: ( screenOrigin ) => {
        origin = screenOrigin;
        mouseEnabledDoms = undefined;
        _intervalCount = 0;
        dynamicMouseIntervalId = window.setInterval( trackDynamicMouse, 33 );
    },
    /**
     * Disables dynamic mouse tracking.
     */
    stopTrackingDynamicMouse: () => {
        window.clearInterval( dynamicMouseIntervalId );
        dynamicMouseIntervalId = null;
    },
    getMouseUpdate: getMouseUpdate,
    setHandleMouseEvents: setHandleMouseEvents,
    setIgnoreMouseEvents: setIgnoreMouseEvents,
    refreshDom: () => {
        mouseEnabledDoms = undefined;
        _intervalCount = 0;
    }
};

module.exports = MouseUtilities;
