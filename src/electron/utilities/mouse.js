const { getCurrentWindow, screen } = require( '@electron/remote' );
const { ipcRenderer } = require( 'electron' );
const { mouseZIndex } = require( './constants' );

var mouseEnabled = false;
var trackingDynamicMouse = false;
var origin = { x: 0, y: 0 };
const _domRefreshMs = 5000;
var _lastDomRefresh = 0;
/** @type {{x: number, y: number} | null} The last cursor position sent by the main process. */
var _lastCursor = null;
/** @type {NodeListOf<Element> | undefined} */
var mouseEnabledDoms = undefined;









/**
 * Disables mouse events.
 */
function setIgnoreMouseEvents() {
    if ( mouseEnabled ) {
        mouseEnabled = false;
        getCurrentWindow().setIgnoreMouseEvents( true, { forward: false } );
        if ( !trackingDynamicMouse ) {
            trackingDynamicMouse = true;
        }
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
            trackingDynamicMouse = false;
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
    if ( _lastCursor == null ) {
        return;
    }
    if ( Date.now() - _lastDomRefresh > _domRefreshMs ) {
        mouseEnabledDoms = undefined;
    }
    if ( mouseEnabledDoms == null ) {
        mouseEnabledDoms = document.querySelectorAll( '.dynamic-mouse' );
        _lastDomRefresh = Date.now();
    }
    mouseEnabledDoms.forEach( dom => dom.style.zIndex = dom.classList.contains('overlay-container') ? dom.style.zIndex : undefined );
    let mouseCoords = _lastCursor;

    // If the mouse is over a dynamic-mouse element, then we want to set the mouse events to be handled.
    let mouseEnabled = false;
    
    for ( let i = 0; i < mouseEnabledDoms.length; i++ ) {
        const dom = mouseEnabledDoms[i];
        // If the dom is a child of .no-mouse, then we want to ignore it.
        if ( dom.closest( '.no-mouse' ) ) {
            continue;
        }
        let rect = dom.getBoundingClientRect();
        if ( (rect.x - origin.x) <= mouseCoords.x && (rect.x - origin.x) + rect.width >= mouseCoords.x && (rect.y - origin.y) <= mouseCoords.y && (rect.y - origin.y) + rect.height >= mouseCoords.y ) {
            setHandleMouseEvents();
            mouseEnabled = true;
            dom.style.zIndex = dom.classList.contains('overlay-container') ? dom.style.zIndex : mouseZIndex;
            break;
        }
    }

    // Otherwise, we want to ignore mouse events.
    if ( mouseEnabled === false ) {
        setIgnoreMouseEvents();
    }
}

// The main process sends the cursor position when it moves (and every half
// second regardless), so the check only runs when there's something to check.
ipcRenderer.on( 'renderer:cursor', ( event, cursor ) => {
    _lastCursor = cursor;
    if ( trackingDynamicMouse ) {
        trackDynamicMouse();
    }
} );










const MouseUtilities = {
    mouseEnabled: mouseEnabled,
    dynamicMouseIntervalId: null,
    /**
     * Enables dynamic mouse tracking.
     * @param {{x: number, y: number}} screenOrigin The screen coordinates of the origin of the window.
     */
    trackDynamicMouse: ( screenOrigin ) => {
        origin = screenOrigin;
        mouseEnabledDoms = undefined;
        trackingDynamicMouse = true;
        trackDynamicMouse();
    },
    /**
     * Disables dynamic mouse tracking.
     */
    stopTrackingDynamicMouse: () => {
        trackingDynamicMouse = false;
    },
    getMouseUpdate: getMouseUpdate,
    setHandleMouseEvents: setHandleMouseEvents,
    setIgnoreMouseEvents: setIgnoreMouseEvents,
    /**
     * Refreshes the dom elements that are being tracked for mouse events, immediately enabling/disabling mouse events.
     */
    refreshDom: () => {
        mouseEnabledDoms = undefined;
    }
};

module.exports = MouseUtilities;
