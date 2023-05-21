; 'use strict'
const DomUtilities = require( '../utilities/dom' );
const StringUtilities = require( '../utilities/string' );
const NumberUtilities = require( '../utilities/numbers' );
const ArrayUtilities = require( '../utilities/arrays' );
const { OverlayDimensions, OverlayWindow, OverlayComponent, TimerSortTypes, TriggerSecondaryActionModel } = require( '../data/models/overlay-window' );
const { ActionTypes, TriggerAction, TriggerConditionTypes, OperatorTypes, TimerRestartBehaviors } = require( '../data/models/trigger' );
const { ipcRenderer } = require( 'electron' );
const Handlebars = require( "handlebars" );
const _ = require( 'lodash' );
const customAlphabet = require( 'nanoid' ).customAlphabet;
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const nanoid = customAlphabet( alphabet, 16 );
const StyleSheetUtil = require( '../utilities/style-sheet' );
const { FctStylesModel, FctModel, FctTypes } = require( '../data/models/fct' );
const ElectronUtilities = require( '../utilities/electron' );
const { StyleProperties } = require( '../data/models/common' );
const { screen } = require( '@electron/remote' );
const { DateUtilities } = require( '../utilities/dates' );

/**
 * Sends the error information to the main thread for logging.
 * 
 * @param {any} err The error object.
 * @param {'fct'|'trigger'|null} renderType The render type is either fct or trigger.
 * @param {string} overlayId The id of the overlay.
 * @param {FctModel|OverlayComponent} component True if we're simulating a log file.
 */
const logError = ( err, renderType, overlayId, component ) => {

    if ( renderType === 'fct' ) {
        ipcRenderer.send( 'app:log:exception', {
            source: 'renderer.js',
            error: err,
            overlayId: overlayId,
            fctModel: component,
        } );

    } else if ( renderType === 'trigger' ) {
        ipcRenderer.send( 'app:log:exception', {
            source: 'renderer.js',
            error: err,
            overlayId: overlayId,
            overlayComponent: component,
        } );

    } else {
        ipcRenderer.send( 'app:log:exception', err );

    }

};

window.onerror = ( error, url, line ) => {
    ipcRenderer.send( 'app:log:exception', `$${error}\r\n    at ${url}:${line}` );
};

function logInfo( data ) {
    ipcRenderer.send( 'app:log:info', data );
}

// <!-- Roboto(i): 100, 300, 400, 500, 700, 900 -->
// <!-- Red Rose: 300, 400, 700 -->
// <!-- Oswald: 200, 300, 400, 500, 600, 700 -->
// <!-- Roboto Mono (i): 100, 200, 300, 400, 500, 600, 700 -->
// <!-- Open Sans Condensed: 300(i), 700 -->
// <!-- Ranchers: 400 -->
// <!-- Press Start 2P: 400 -->

class TimerGroup {
    /** @type {boolean} */
    visible;
    /** @type {string} */
    name;
    /** @type {HTMLDivElement} */
    dom;
    /** @type {OverlayComponent[]} */
    components;
    /** @type {() => void} */
    updateVisibility;
}

class OverlayInstance {
    /** @type {HTMLDivElement} */
    dom;
    /** @type {HTMLElement} */
    title;
    /** @type {OverlayWindow} */
    model;
    /** @type {Object.<string, TimerGroup>} */
    overlayGroups;
    /** @type {number} */
    sortDirection;
    /** @type {number} */
    dotTextHeight;
    /** @type {boolean} */
    showRemainingDuration;
    /** @type {boolean} */
    groupByTarget;
    /** @type {number} */
    groupHeaderSize;
    /** @type {string} */
    groupHeaderColor;
    /** @type {number} */
    groupHeaderWeight;
    /** @type {boolean} */
    hideTargetLabel;
    /** @type {OverlayComponent[]} */
    overlayComponents;
    /** @type {string} */
    encapsulationId;
    /** @type {number} */
    width;
    /** @type {number} */
    height;
    /** @type {number} */
    fontSize;
    /** @type {boolean[][]} */
    criticals;
    /** @type {{x: number, y: number}[][]} */
    quadrants;
}

class ReceivedOverlayComponent {
    /** @type {OverlayComponent} */
    component;
    /** @type  {string} */
    overlayId;
}

/** @type {Record<string, OverlayInstance>} */
var overlayInstances = {};

var mobGroups = [];
var overlayTemplate;
var overlayFctTemplate;
var displayTextTemplate;
var timerTemplate;
var timerIconTemplate;
var targetGroupTemplate;
var targetGroupTimerTemplate;
var voiceOptions = [];
/** @type {Record<number, number>} */
var destroySchedule = {};

const dragBorderSize = 6;
const dragCornerSize = 12;
let resizeHandles = [ 'resize-n', 'resize-s', 'resize-e', 'resize-w', 'resize-ne', 'resize-se', 'resize-sw', 'resize-nw' ];
/** @type {import('electron').Point} */
let origin = { x: 0, y: 0 };
const stopTrackingMoveResizeEvent = new Event( 'stop-tracking-mr' );
const styleSheetUtil = new StyleSheetUtil();
const fctCssEncapsulationId = '_' + nanoid();
const delayBetweenCrits = 500;
const delayVariance = 0.50;
let delayAdd = 0;
const criticalPadding = 0;
var mouseForwardingPaused = false;
/** @type {HTMLDivElement} */
var screenGlower = null;
/** @type {number} */
var screenGlowTimerId = null;
let showCriticalsInline = false;
const intMaxValue = 9007199254740991;










function Renderer( originX, originY, glowOnStart ) {

    origin.x = originX;
    origin.y = originY;

    DomUtilities.docReady( f => {
        
        overlayTemplate = Handlebars.compile( document.querySelector( '#overlay' ).innerHTML );
        overlayFctTemplate = Handlebars.compile( document.querySelector( '#overlayFct' ).innerHTML );
        displayTextTemplate = Handlebars.compile( document.querySelector( '#displayTextTemplate' ).innerHTML );
        timerTemplate = Handlebars.compile( document.querySelector( '#timerTemplate' ).innerHTML );
        timerIconTemplate = Handlebars.compile( document.querySelector( '#timerIconTemplate' ).innerHTML );
        fctTemplate = Handlebars.compile( document.querySelector( '#fctTemplate' ).innerHTML );
        fctCriticalTemplate = Handlebars.compile( document.querySelector( '#fctCriticalTemplate' ).innerHTML );
        targetGroupTemplate = Handlebars.compile( document.querySelector( '#targetGroupTemplate' ).innerHTML );
        targetGroupTimerTemplate = Handlebars.compile( document.querySelector( '#targetGroupTimerTemplate' ).innerHTML );

        logInfo( '[Info:Renderer:Templates] (Renderer docReady) Templates have been compiled!' );

        if ( glowOnStart ) {
            renderGlow( '#4c0e67', 4000, false );
        }
    
        /** Tell the main thread that we need a list of all overlays. */
        ipcRenderer.send( 'overlay:get', null );

    } );

    ipcRenderer.on( 'renderer:resolution-changed',
        /**
         * Updates the position of each overlay.
         * 
         * @param {any} event 
         * @param {{overlays: OverlayWindow[], origin: import('electron').Point}} data The list of overlays.
         */
        function ( event, data ) {
            origin = data.origin;
            
            data.overlays.forEach( function ( overlay ) {
                let div = overlayInstances[ overlay.overlayId ]?.dom;

                // TODO: This runs too early when the overlays haven't been loaded yet.
                if ( div ) {
                    div.style.left = ( overlay.x + origin.x + overlay.displayBounds.x ) + 'px';
                    div.style.top = ( overlay.y + origin.y + overlay.displayBounds.y ) + 'px';
                    div.style.height = ( overlay.windowHeight ) + 'px';
                    div.style.width = ( overlay.windowWidth ) + 'px';
                }
            } );
        } );

    ipcRenderer.on( 'overlay:get',
        /**
         * Gets all overlay models.
         * 
         * @param {any} event 
         * @param {OverlayWindow[]} overlays The list of overlays.
         */
        function ( event, overlays ) {
            overlays.forEach( overlay => {
                initializeOverlay( overlay );
            } );
            
        } );
    
    ipcRenderer.on( 'renderer:overlay:new',
        /**
         * Gets all overlay models.
         * 
         * @param {any} event 
         * @param {OverlayWindow} overlay The new overlay.
         */
        ( data, overlay ) => {
            initializeOverlay( overlay );
        } );
    
    ipcRenderer.on( 'renderer:overlay:delete',
        /**
         * Removes the specified overlay from the dom.
         * 
         * @param {any} event 
         * @param {string} overlayId The new overlay.
         */
        ( event, overlayId ) => {
            deleteOverlay( overlayId );
        } );

    ipcRenderer.on( 'renderer:receive:component',
        /**
         * Handles receiving a new trigger action.
         * @param {*} event The event object.
         * @param {OverlayComponent} model The trigger action.
         */
        function ( event, model ) {
            model.added = new Date();
            render( model.overlayId, model );
        } );

    ipcRenderer.on( 'renderer:receive:secondary-action',
        /**
         * Handles receiving a secondary trigger action.
         * @param {*} event The event object.
         * @param {TriggerSecondaryActionModel} model The trigger secondary action token.
         */
        function ( event, model ) {
            const component = findComponent( c => c.instanceId === model.instanceId );
            
            if ( component ) {
                if ( model.action === 'setStart' ) {
                    component.start = model.timestamp;
                } else if ( model.action === 'extendDuration' ) {
                    component.start = DateUtilities.addSeconds( component.start, model.duration );
                } else if ( model.action === 'clipTimer' ) {
                    let noticeMe = DateUtilities.timeSince( component.start, model.timestamp ).totalSeconds - component.action.duration < 0;
                    component.start = DateUtilities.addSeconds( component.start, DateUtilities.timeSince( component.start, model.timestamp ).totalSeconds - component.action.duration );
                    if ( noticeMe ) {
                        component.dom.classList.remove( 'notice-me' );
                        component.dom.classList.add( 'notice-me' );
                    }
                }
            }
        } );

    ipcRenderer.on( 'renderer:receive:fct-component',
        /**
         * Handles receiving a new trigger action.
         * @param {*} event The event object.
         * @param {OverlayComponent} model The trigger action.
         */
        function ( event, model ) {
            model.added = new Date();
            renderFct( model.overlayId, model );
        } );

    ipcRenderer.on( 'renderer:window:enable-edit', function ( event, overlayId ) {
        moveToTop( overlayInstances[ overlayId ].dom );
        enableMoveResize( overlayInstances[ overlayId ].dom );
    } );

    ipcRenderer.on( 'renderer:overlay:move',
        /**
         * Handles the overlay move event.
         * 
         * @param {any} event The event args.
         * @param {{overlayId: string, x: number, y: number}} data The event data.
         */
        function ( event, data ) {

            if ( !overlayInstances[ data.overlayId ] ) {
                logInfo( `[Error:Undefined:Overlay] (renderer:overlay:move) Overlay does not exit! {overlayId: '${data.overlayId}'}` );
                logInfo( ElectronUtilities.getRecordKeys( overlayInstances ) );
                return;
            }
            
            overlayInstances[ data.overlayId ].dom.style.left = `${data.x + origin.x + data.displayBounds.x}px`;
            overlayInstances[ data.overlayId ].dom.style.top = `${data.y + origin.y + data.displayBounds.y}px`;
        } );

    ipcRenderer.on( 'renderer:window:disable-edit', function ( event, overlayId ) {
        if ( overlayInstances[ overlayId ] ) {
            disableMoveResize( overlayInstances[ overlayId ].dom );
        }
    } );

    ipcRenderer.on( 'renderer:arrange-overlays', function ( event ) {
        eachOverlay( function ( overlay ) {
            enableMoveResize( overlay.dom );
        } );
    } );

    ipcRenderer.on( 'renderer:end-arrange-overlays', function ( event ) {
        eachOverlay( function ( overlay ) {
            disableMoveResize( overlay.dom );
        } );
    } );

    ipcRenderer.on( 'renderer:window:highlight', function ( event, overlayId ) {
        overlayInstances[ overlayId ]?.dom.classList.add( 'highlight-border' );
    } );

    ipcRenderer.on( 'renderer:window:dim', function ( event, overlayId ) {
        overlayInstances[ overlayId ]?.dom.classList.remove( 'highlight-border' );
    } );

    ipcRenderer.on( 'renderer:mouse-forwarding:pause', function ( event, overlayId ) {
        mouseForwardingPaused = true;
    } );

    ipcRenderer.on( 'renderer:mouse-forwarding:resume', function ( event, overlayId ) {
        mouseForwardingPaused = false;
    } );

    ipcRenderer.on( 'component:destroy', function ( event, instanceId ) {
        
        for ( let overlayId in overlayInstances ) {
            if ( overlayInstances.hasOwnProperty( overlayId ) ) {
                
                if ( overlayInstances[ overlayId ].groupByTarget ) {

                    for ( let key in overlayInstances[ overlayId ].overlayGroups ) {
                        if ( overlayInstances[ overlayId ].overlayGroups.hasOwnProperty( key ) ) {
                    
                            let i = _.findIndex( overlayInstances[ overlayId ].overlayGroups[ key ].components, comp => comp.instanceId === instanceId );
                            if ( i > -1 ) {
                                let comp = overlayInstances[ overlayId ].overlayGroups[ key ].components[ i ];
                                let timerType = comp.action.actionType === ActionTypes.BeneficialTimer || comp.action.actionType === ActionTypes.Countdown || comp.action.actionType === ActionTypes.Timer;
                                let endNaturally = timerType === true && ( comp.action.remainAfterEnded || comp.action.notifyWhenEnded ) && !comp.action.remainUnlessEndedEarly;
                        
                                if ( endNaturally ) {
                                    comp.start = new Date( new Date().getTime() - comp.action.duration * 1000 );
                                } else {
                                    comp.removeComponent();
                                }
                            }
                    
                        }
                    }
            
                } else {
                    let i = _.findIndex( overlayInstances[ overlayId ].overlayComponents, comp => comp.instanceId === instanceId );

                    if ( i > -1 ) {
                        let timerType = overlayInstances[ overlayId ].overlayComponents[ i ].action.actionType === ActionTypes.BeneficialTimer || overlayInstances[ overlayId ].overlayComponents[ i ].action.actionType === ActionTypes.Countdown || overlayInstances[ overlayId ].overlayComponents[ i ].action.actionType === ActionTypes.Timer;
                        let endNaturally = timerType === true && ( overlayInstances[ overlayId ].overlayComponents[ i ].action.remainAfterEnded || overlayInstances[ overlayId ].overlayComponents[ i ].action.notifyWhenEnded );

                        if ( endNaturally ) {
                            overlayInstances[ overlayId ].overlayComponents[ i ].start = new Date( new Date().getTime() - overlayInstances[ overlayId ].overlayComponents[ i ].action.duration * 1000 );
                        } else {
                            overlayInstances[ overlayId ].overlayComponents[ i ].removeComponent();
                        }
                    }

                }
            }
        }

    } );

    ipcRenderer.on( 'renderer:overlay:update',
        /**
         * Handles the event.
         * 
         * @param {any} event The event args.
         * @param {OverlayWindow[]} model The overlay window model.
         */
        function ( event, model ) {
            model.forEach( overlay => {
                updateOverlay( overlay.overlayId, overlay );
            } );
        } );
    
    ipcRenderer.on( 'fctStyles',
        /**
         * Handles receiving updates to FCT styles.
         * 
         * @param {any} event The event args?
         * @param {FctStylesModel} fctStyles The user-specified FCT styles.
         */
        ( event, fctStyles ) => {
            let style = styleSheetUtil.createStyleSheet( document, nanoid() );

            style.sheet.insertRule( styleSheetUtil.createTextRule( fctStyles.fctDmgOutStyle, 'fct-dmg-out', fctCssEncapsulationId ) );
            style.sheet.insertRule( styleSheetUtil.createTextRule( fctStyles.fctDmgInStyle, 'fct-dmg-in', fctCssEncapsulationId ) );
            style.sheet.insertRule( styleSheetUtil.createTextRule( fctStyles.fctSpellDmgOutStyle, 'fct-spell-dmg-out', fctCssEncapsulationId ) );
            style.sheet.insertRule( styleSheetUtil.createTextRule( fctStyles.fctSpellDmgInStyle, 'fct-spell-dmg-in', fctCssEncapsulationId ) );
            style.sheet.insertRule( styleSheetUtil.createTextRule( fctStyles.fctHealingOutStyle, 'fct-healing-out', fctCssEncapsulationId ) );
            style.sheet.insertRule( styleSheetUtil.createTextRule( fctStyles.fctHealingInStyle, 'fct-healing-in', fctCssEncapsulationId ) );
            style.sheet.insertRule( styleSheetUtil.createTextRule( fctStyles.fctSkillStyle, 'fct-skill', fctCssEncapsulationId ) );
            
        } );

    ipcRenderer.on( 'renderer:get:overlayDimensions',
        /**
         * Handles the event.
         * 
         * @param {any} event The event args.
         * @param {OverlayDimensions[]} overlayDimensions The overlay dimension info.
         */
        function ( event, overlayDimensions ) {
            overlayDimensions.forEach( d => {

                if ( !overlayInstances[ d.overlayId ] ) {
                    logInfo( `[Error:Undefined:Overlay] (renderer:get:overlayDimensions) Overlay does not exit! {overlayId: '${d.overlayId}'}` );
                    logInfo( ElectronUtilities.getRecordKeys( overlayInstances ) );
                    return;
                }
                
                overlayInstances[ d.overlayId ].dom.style.left = `${d.x + origin.x + d.displayBounds.x}px`;
                overlayInstances[ d.overlayId ].dom.style.top = `${d.y + origin.y + d.displayBounds.y}px`;
                overlayInstances[ d.overlayId ].dom.style.width = `${d.windowWidth}px`;
                overlayInstances[ d.overlayId ].dom.style.height = `${d.windowHeight}px`;
            } );
        } );
    
    ipcRenderer.on( 'renderer:reset:overlayDimensions',
        /**
         * Resets the overlay dimenions via a reload.
         * 
         * @param {any} event The event args?
         */
        ( event ) => {
            ipcRenderer.send( 'overlay:get:overlayDimensions', null );
        } );
    
    ipcRenderer.on( 'renderer:save:overlayDimensions',
        /**
         * Compiles and sends the main thread a list of all overlay positions.
         * 
         * @param {any} event The event args?
         */
        ( event ) => {

            /** @type {OverlayDimensions[]} */
            let model = [];

            for ( let overlayId in overlayInstances ) {
                if ( overlayInstances.hasOwnProperty( overlayId ) ) {
                    let d = new OverlayDimensions();
                    d.overlayId = overlayId;
                    d.x = overlayInstances[ overlayId ].dom.offsetLeft - origin.x;
                    d.y = overlayInstances[ overlayId ].dom.offsetTop - origin.y;
                    d.windowWidth = overlayInstances[ overlayId ].dom.offsetWidth;
                    d.windowHeight = overlayInstances[ overlayId ].dom.offsetHeight;
                    model.push( d );
                }
            }

            ipcRenderer.send( 'overlay:set:overlayDimensions', model );
        } );
    
    ipcRenderer.on( 'fct:change:fctShowCriticalsInline',
        ( event, fctShowCriticalsInline ) => {
            showCriticalsInline = fctShowCriticalsInline === true;
        } );

    ipcRenderer.on( 'renderer:clear-all', function () {
        clearAll();
    } );
    
    speechSynthesis.onvoiceschanged = () => {
        voiceOptions = speechSynthesis.getVoices();
    };

}










/**
 * Initializes the given overlay.
 * 
 * @param {OverlayWindow} overlay The overlay to initialize.
 */
function initializeOverlay( overlay ) {
    let content;
    let div = document.createElement( 'div' );

    if ( overlay.overlayType === 'FCT' ) {
        content = overlayFctTemplate( {} );
        div.setAttribute( fctCssEncapsulationId, '' );
    } else {
        if ( !overlayTemplate ) {
            logInfo( '[Error:Undefined:Template] (initializeOverlay) overlayTemplate fn is not a function!' );
            return;
        }

        content = overlayTemplate( {} );
    }

    div.innerHTML = content;
    div.style.position = 'absolute';

    div.style.left = ( overlay.x + overlay.displayBounds.x + origin.x ) + 'px';
    div.style.top = ( overlay.y + overlay.displayBounds.y + origin.y ) + 'px';
    div.style.height = ( overlay.windowHeight ) + 'px';
    div.style.width = ( overlay.windowWidth ) + 'px';
                
    document.body.appendChild( div );

    overlayInstances[ overlay.overlayId ] = {
        dom: div,
        title: div.querySelector( '#overlay-title' ),
        model: overlay,
        overlayGroups: {},
        sortDirection: TimerSortTypes.None,
        dotTextHeight: 0,
        showRemainingDuration: false,
        groupByTarget: false,
        groupHeaderSize: 12,
        groupHeaderColor: '#ffffff',
        groupHeaderWeight: 400,
        hideTargetLabel: false,
        overlayComponents: [],
    };

    overlayInstances[ overlay.overlayId ].encapsulationId = '_' + nanoid();
    overlayInstances[ overlay.overlayId ].title.innerHTML = overlay.name;

    div.addEventListener( 'click', function ( e ) {
        moveToTop( div );
    } );

    div.setAttribute( overlayInstances[ overlay.overlayId ].encapsulationId, '' );

    updateOverlay( overlay.overlayId, overlay );
}










/**
 * Deletes the specified overlay from the dom.
 * 
 * @param {string} overlayId The overlay id.
 */
function deleteOverlay( overlayId ) {
    overlayInstances[ overlayId ].dom.remove();
    delete overlayInstances[ overlayId ];
}










/**
 * Updates the model and default properties/styles of the specified overlay.
 * 
 * @param {string} overlayId The id of the overlay.
 * @param {OverlayWindow} model The overlay window model.
 */
function updateOverlay( overlayId, model ) {
    
    overlayInstances[ overlayId ].model = model;
    overlayInstances[ overlayId ].title.innerText = model.name ? model.name : 'Overlay';

    overlayInstances[ overlayId ].dom.style.left = `${model.x + origin.x + model.displayBounds.x}px`;
    overlayInstances[ overlayId ].dom.style.top = `${model.y + origin.y + model.displayBounds.y}px`;
    overlayInstances[ overlayId ].dom.style.width = `${model.windowWidth}px`;
    overlayInstances[ overlayId ].dom.style.height = `${model.windowHeight}px`;

    /** @type {HTMLElement} */
    let contentArea = overlayInstances[ overlayId ].dom.querySelector( '.overlay-content-area' );

    // Sets the size of the header to fit the content area.
    let renderWidth = DomUtilities.getInnerContentArea( contentArea );
    const titleContainer = overlayInstances[ overlayId ].dom.querySelector( '.overlay-name-watermark' );
    const title = overlayInstances[ overlayId ].title;
    
    titleContainer.style.display = 'block';
    
    const style = window.getComputedStyle( title );
    const font = /(\d+(?:\.\d{1,2})?)\s?(.*)/.exec( style.fontSize );
    let fntSize = parseFloat( font[ 1 ] );
    const fntUnit = font[ 2 ];
    
    while ( title.offsetWidth > renderWidth.width ) {
        fntSize -= 0.1;
        title.style.fontSize = `${fntSize}${fntUnit}`;
    }
    titleContainer.style.display = '';

    if ( model.overlayType !== 'FCT' ) {
        contentArea.classList.add( 'no-overflow' );

        // Content area display styles, the defaults.
        contentArea.style.fontFamily = `"${model.fontFamily}"`;
        contentArea.style.fontSize = `${model.fontSize}px`;
        contentArea.style.lineHeight = `${( model.lineHeight > 10 ? model.lineHeight : 90 ) / 100}em`;
        contentArea.style.fontWeight = model.fontWeight > 0 ? model.fontWeight : 300;
    
        if ( model.overlayType === 'Alert' ) {
            contentArea.style.textAlign = model.horizontalAlignment;
            if ( model.verticalAlignment === 'bottom' ) {
                contentArea.style.display = 'flex';
                contentArea.style.flexDirection = 'column';
                contentArea.style.justifyContent = 'flex-end';
            } else if ( model.verticalAlignment === 'middle' ) {
                contentArea.style.display = 'flex';
                contentArea.style.flexDirection = 'column';
                contentArea.style.justifyContent = 'center';
            } else {
                contentArea.style.display = 'block';
                contentArea.style.flexDirection = undefined;
                contentArea.style.justifyContent = undefined;
            }
        }
    
        contentArea.querySelectorAll( '.progress' ).forEach( f => f.style.marginBottom = contentArea.style.lineHeight );
    
        if ( model.fontColor ) {
            if ( model.fontTransparency < 1 ) {
                contentArea.style.color = `${model.fontColor}${componentToHex( Math.round( model.fontTransparency * 255 ) )}`;
            } else {
                contentArea.style.color = `${model.fontColor}`;
            }
        }
        if ( model.backgroundTransparency && model.backgroundTransparency > 0 && model.backgroundColor ) {
            contentArea.style.backgroundColor = `${model.backgroundColor}${componentToHex( Math.round( model.backgroundTransparency * 255 ) )}`;
        } else {
            contentArea.style.backgroundColor = null;
        }
        if ( model.borderTransparency && model.borderTransparency > 0 && model.borderColor ) {
            contentArea.style.border = `3px solid ${model.borderColor}${componentToHex( Math.round( model.borderTransparency * 255 ) )}`;
        } else {
            contentArea.style.border = null;
        }
    
        overlayInstances[ overlayId ].sortDirection = model.timerSortType;
    
        contentArea.style.textShadow = null;
        let textShadow = null;
    
        if ( model.showTextBorder === true ) {
            textShadow = `0px 0px 1px ${model.textBorderColor}, -1px -1px 0 ${model.textBorderColor}, 1px -1px 0 ${model.textBorderColor}, -1px 1px 0 ${model.textBorderColor}, 1px 1px 0 ${model.textBorderColor}`;
        } else if ( model.overlayType === 'Log' ) {
            textShadow = `0px 0px 1px #000000, -1px -1px 0 #000000, 1px -1px 0 #000000, -1px 1px 0 #000000, 1px 1px 0 #000000`;
            model.showTextGlow = true;
            model.textGlowSize = 3;
            model.textGlowColor = '#000000';
        }
    
        if ( model.showTextGlow ) {
            if ( textShadow?.length > 0 ) {
                textShadow += ',';
            } else {
                textShadow = '';
            }
    
            textShadow += `0px 0px ${model.textGlowSize}px ${model.textGlowColor}, -1px -1px ${model.textGlowSize}px ${model.textGlowColor}, 1px -1px ${model.textGlowSize}px ${model.textGlowColor}, -1px 1px ${model.textGlowSize}px ${model.textGlowColor}, 1px 1px ${model.textGlowSize}px ${model.textGlowColor}`;
        }
        contentArea.style.textShadow = textShadow;
    
        // Calculate the height of dot texts.
        let pDot = document.createElement( 'p' );
        pDot.classList.add( 'dot-text' );
        pDot.style.visibility = 'hidden';
        pDot.innerHTML = '&nbsp;';
        contentArea.appendChild( pDot );
        overlayInstances[ overlayId ].dotTextHeight = pDot.clientHeight;
        contentArea.style.paddingLeft = `${overlayInstances[ overlayId ].dotTextHeight + 2}px`;
        contentArea.removeChild( pDot );
    
        // Update any active elements
        overlayInstances[ overlayId ].dom.querySelectorAll( '.overlay-content-area .dot-icon' ).forEach( icon => {
            icon.style.marginLeft = `-${overlayInstances[ overlayId ].dotTextHeight + 2}px`;
            icon.style.height = `${overlayInstances[ overlayId ].dotTextHeight}px`;
        } );
    
        overlayInstances[ overlayId ].showRemainingDuration = model.showTimeRemaining === true;
    
        if ( model.groupByTarget ) {
            contentArea.classList.add( 'grouped-mobs' );
            overlayInstances[ overlayId ].groupByTarget = true;
        } else {
            contentArea.classList.remove( 'grouped-mobs' );
            overlayInstances[ overlayId ].groupByTarget = false;
        }
    
        overlayInstances[ overlayId ].groupHeaderSize = model.groupHeaderSize > 0 ? model.groupHeaderSize : 12;
        overlayInstances[ overlayId ].groupHeaderColor = !StringUtilities.isNullOrWhitespace( model.groupHeaderColor ) ? model.groupHeaderColor : '#ffffff';
        overlayInstances[ overlayId ].groupHeaderWeight = model.groupHeaderWeight > 0 ? model.groupHeaderWeight : 400;
    
        overlayInstances[ overlayId ].hideTargetLabel = model.hideTargetLabel;
    
        for ( let key in overlayInstances[ overlayId ].overlayGroups ) {
            if ( overlayInstances[ overlayId ].overlayGroups.hasOwnProperty( key ) ) {
                        
                let h6 = overlayInstances[ overlayId ].overlayGroups[ key ].dom.querySelector( 'h6' );
    
                h6.style.fontSize = `${overlayInstances[ overlayId ].groupHeaderSize}px`;
                h6.style.color = overlayInstances[ overlayId ].groupHeaderColor;
                h6.style.fontWeight = overlayInstances[ overlayId ].groupHeaderWeight;
    
                if ( overlayInstances[ overlayId ].hideTargetLabel ) {
                    h6.style.display = 'none';
                } else {
                    delete h6.style.display;
                }
            }
        }
    } else {
        
        let healingContentArea = overlayInstances[ overlayId ].dom.querySelector( '.healing-content-area' );
        contentArea.style.fontFamily = `"${model.fontFamily}"`;
        contentArea.style.fontSize = `${model.fontSize}px`;
        contentArea.style.lineHeight = `${( model.lineHeight > 10 ? model.lineHeight : 90 ) / 100}em`;
        contentArea.style.fontWeight = model.fontWeight > 0 ? model.fontWeight : 300;
        
        healingContentArea.style.fontFamily = `"${model.fontFamily}"`;
        healingContentArea.style.fontSize = `${model.fontSize}px`;
        healingContentArea.style.lineHeight = `${( model.lineHeight > 10 ? model.lineHeight : 90 ) / 100}em`;
        healingContentArea.style.fontWeight = model.fontWeight > 0 ? model.fontWeight : 300;

        if ( model.fontColor ) {
            if ( model.fontTransparency < 1 ) {
                contentArea.style.color = `${model.fontColor}${componentToHex( Math.round( model.fontTransparency * 255 ) )}`;
            } else {
                contentArea.style.color = `${model.fontColor}`;
            }
        }
        if ( model.fontColor ) {
            if ( model.fontTransparency < 1 ) {
                healingContentArea.style.color = `${model.fontColor}${componentToHex( Math.round( model.fontTransparency * 255 ) )}`;
            } else {
                healingContentArea.style.color = `${model.fontColor}`;
            }
        }
        if ( model.backgroundTransparency && model.backgroundTransparency > 0 && model.backgroundColor ) {
            contentArea.style.backgroundColor = `${model.backgroundColor}${componentToHex( Math.round( model.backgroundTransparency * 255 ) )}`;
        } else {
            contentArea.style.backgroundColor = null;
        }
        if ( model.backgroundTransparency && model.backgroundTransparency > 0 && model.backgroundColor ) {
            healingContentArea.style.backgroundColor = `${model.backgroundColor}${componentToHex( Math.round( model.backgroundTransparency * 255 ) )}`;
        } else {
            healingContentArea.style.backgroundColor = null;
        }
        if ( model.borderTransparency && model.borderTransparency > 0 && model.borderColor ) {
            contentArea.style.border = `3px solid ${model.borderColor}${componentToHex( Math.round( model.borderTransparency * 255 ) )}`;
        } else {
            contentArea.style.border = null;
        }
        if ( model.borderTransparency && model.borderTransparency > 0 && model.borderColor ) {
            healingContentArea.style.border = `3px solid ${model.borderColor}${componentToHex( Math.round( model.borderTransparency * 255 ) )}`;
        } else {
            healingContentArea.style.border = null;
        }

        contentArea.classList.add( 'fct-content' );
        contentArea.style.margin = `${criticalPadding}px`;

        healingContentArea.classList.add( 'fct-content' );
        healingContentArea.style.margin = `${criticalPadding}px`;

        let width = contentArea.clientWidth;
        let height = contentArea.clientHeight;
        let fontSize = model.fontSize;

        let quadrants = overlayInstances[ overlayId ].quadrants?.length > 0 ? overlayInstances[ overlayId ].quadrants :[];
        let criticals = overlayInstances[ overlayId ].criticals?.length > 0 ? overlayInstances[ overlayId ].criticals :[];

        // we could calculate the specific size of critical fct, but it's 'good enough' to estimate.  A little overlapping is fine.
        let qw = fontSize / 2 * 4.6875 * 2.5;
        let qh = fontSize / 2 * 3.125 * 2;

        for ( let x = 0; x < Math.floor( width / qw ); x++ ) {
            quadrants[ x ] = [];
            criticals[ x ] = [];
            for ( let y = 0; y < Math.floor( height / qh ); y++ ) {
                quadrants[ x ][ y ] = { x: x * qw, y: y * qh };
                criticals[ x ][ y ] = false;
            }
        }

        overlayInstances[ overlayId ].width = width;
        overlayInstances[ overlayId ].height = height;
        overlayInstances[ overlayId ].fontSize = fontSize;

        overlayInstances[ overlayId ].quadrants = quadrants;
        overlayInstances[ overlayId ].criticals = criticals;
    }
            
}










/**
 * Renders the FCT component.
 *
 * @param {string} overlayId The id of the desired overlay.
 * @param {FctModel} comp Tells the renderer to forcefully redraw the overlayComponents.
 */
function renderFct( overlayId, comp ) {

    try {
        
        let fctOverlay = overlayInstances[ overlayId ];
        let contentArea = fctOverlay.dom.querySelector( '.overlay-content-area' );
        let div = document.createElement( 'div' );

        if ( comp.fctType === FctTypes.dmgOut ) {
            div.classList.add( 'fct-dmg-out' );

        } else if ( comp.fctType === FctTypes.dmgIn ) {
            div.classList.add( 'fct-dmg-in' );

        } else if ( comp.fctType === FctTypes.spellDmgOut ) {
            div.classList.add( 'fct-spell-dmg-out' );

        } else if ( comp.fctType === FctTypes.spellDmgIn ) {
            div.classList.add( 'fct-spell-dmg-in' );

        } else if ( comp.fctType === FctTypes.healingOut ) {
            div.classList.add( 'fct-healing-out' );

        } else if ( comp.fctType === FctTypes.healingIn ) {
            div.classList.add( 'fct-healing-in' );

        } else if ( comp.fctType === FctTypes.skill ) {
            div.classList.add( 'fct-skill' );

        }

        if ( comp.critical && !showCriticalsInline ) {
            let content = fctCriticalTemplate( { value: comp.text, damageSource: comp.attack } );
            div.innerHTML = content;

            div.classList.add( 'animate-fade-shrink' );

            comp.dom = div;
            comp.delayAmount = NumberUtilities.randomBounded( delayBetweenCrits - ( delayBetweenCrits * delayVariance ), delayBetweenCrits + ( delayBetweenCrits * delayVariance ) + 1 );
        
            window.setTimeout( () => {
                contentArea.appendChild( div );
    
                comp.pos = getRandomLocation( overlayId );
                overlayInstances[ overlayId ].criticals[ comp.pos.x ][ comp.pos.y ] = true;

                try {
                    div.style.left = `${overlayInstances[ overlayId ].quadrants[ comp.pos.x ][ comp.pos.y ].x + ( div.clientWidth / 2 )}px`; // Cannot read property 'x' of undefined
                    div.style.top = `${overlayInstances[ overlayId ].quadrants[ comp.pos.x ][ comp.pos.y ].y - ( div.clientHeight * 1.25 )}px`;
                } catch ( error ) {
                    logInfo( `criticals: ${JSON.stringify( overlayInstances[ overlayId ].criticals ?? '' )}` );
                    logInfo( `quadrants: ${JSON.stringify( overlayInstances[ overlayId ].quadrants ?? '' )}` );
                }
                
                comp.intervalId = window.setTimeout( () => {
                    comp.dom.parentNode.removeChild( comp.dom );
                    if ( overlayInstances[ overlayId ].criticals.length > comp.pos.x && overlayInstances[ overlayId ].criticals[ comp.pos.x ]?.length > comp.pos.y ) {
                        overlayInstances[ overlayId ].criticals[ comp.pos.x ][ comp.pos.y ] = false;
                    }
                }, 4000 );

                delayAdd -= comp.delayAmount;
            }, delayAdd );

            delayAdd += comp.delayAmount;

        } else {
            let damageSourceText = comp.attack;

            if ( comp.critical ) {
                damageSourceText = `Critical, ${damageSourceText}`;
            }
        
            let content = fctTemplate( { value: comp.text, damageSource: damageSourceText } );
            div.innerHTML = content;

            div.classList.add( 'animate-fade-out' );

            if ( comp.critical ) {
                div.classList.add( 'fct-dmg-out-critical' );
            }

            comp.dom = div;

            if ( comp.fctType === FctTypes.healingOut || comp.fctType === FctTypes.healingIn ) {
                overlayInstances[ overlayId ].dom.querySelector( '.healing-content-area' ).appendChild( div );
            } else {
                contentArea.appendChild( div );
            }
            comp.intervalId = window.setTimeout( () => {
                comp.dom.parentNode.removeChild( comp.dom );
            }, 7000 );

        }

    } catch ( error ) {
        logError( error, 'fct', overlayId, comp );

    }

}










/**
 * Renders the overlayComponents to the overlay window.
 *
 * @param {string} overlayId The id of the desired overlay.
 * @param {OverlayComponent} comp Tells the renderer to forcefully redraw the overlayComponents.
 */
function render( overlayId, comp ) {

    try {

        if ( comp?.action?.actionType === ActionTypes.ScreenGlow ) {
            // Non overlay components

            if ( comp?.action?.actionType === ActionTypes.ScreenGlow ) {
                renderGlow( comp.action.textColor, comp.action.duration * 1000, comp.action.flash );

            }
        } else {

            if ( overlayInstances[ overlayId ] == null ) {
                console.error( 'Could not render to overlay, overlay not found!', comp, overlayId );
                return;
            }

            let contentArea = overlayInstances[ overlayId ].dom.querySelector( '.overlay-content-area' );
            let now = new Date();

            if ( comp?.action?.actionType === ActionTypes.DisplayText ) {
                comp.removeAt = new Date( now.setSeconds( comp.action.duration ) );
                let content = displayTextTemplate( { value: StringUtilities.format( comp.action.displayText, comp.matches ) } );
                let div = document.createElement( 'div' );
                div.innerHTML = content;
                div.style.animation = `animate-fadeout ${comp.action.duration * 1.05}s ease`;
                comp.dom = div;

                // Custom display logic.
                if ( comp.action.textUseCustomFont ) {
                    div.style.fontFamily = `"${comp.action.textFont}"`;

                    if ( comp.action.textWeight ) {
                        div.style.fontWeight = comp.action.textWeight > 0 ? comp.action.textWeight : 300;
                    }
                }

                if ( comp.action.textUseCustomSize ) {
                    div.style.fontSize = `${comp.action.textSize}px`;

                    if ( comp.action.textSpacing ) {
                        div.style.lineHeight = `${( comp.action.textSpacing > 10 ? comp.action.textSpacing : 90 ) / 100}em`;
                    }
                }
                if ( comp.action.textUseCustomColor ) {
                    div.style.color = `${comp.action.textColor}`;
                }
                let textShadow = null;
                if ( comp.action.textUseCustomBorder ) {
                    textShadow = `0px 0px 1px ${comp.action.textBorderColor}, -1px -1px 0 ${comp.action.textBorderColor}, 1px -1px 0 ${comp.action.textBorderColor}, -1px 1px 0 ${comp.action.textBorderColor}, 1px 1px 0 ${comp.action.textBorderColor}`;
                }
                if ( comp.action.textUseCustomGlow ) {
                    textShadow = textShadow ? textShadow + ',' : '';
                    textShadow += `0px 0px ${comp.action.textGlowSize}px ${comp.action.textGlowColor}, -1px -1px ${comp.action.textGlowSize}px ${comp.action.textGlowColor}, 1px -1px ${comp.action.textGlowSize}px ${comp.action.textGlowColor}, -1px 1px ${comp.action.textGlowSize}px ${comp.action.textGlowColor}, 1px 1px ${comp.action.textGlowSize}px ${comp.action.textGlowColor}`;
                }
                if ( textShadow ) {
                    div.style.textShadow = textShadow;
                }

                contentArea.appendChild( comp.dom );
                comp.intervalId = window.setTimeout( () => {
                    comp.dom.parentNode.removeChild( comp.dom );
                    ArrayUtilities.remove( overlayInstances[ overlayId ].overlayComponents, f => f.instanceId == comp.instanceId );
                }, comp.action.duration * 1000 );
                
                // Create a method that will remove the component from the overlay.
                comp.removeComponent = () => {
                    window.clearInterval( comp.intervalId );
                    comp.dom.parentNode && comp.dom.parentNode.removeChild( comp.dom );
                    ArrayUtilities.remove( overlayInstances[ overlayId ].overlayComponents, f => f.instanceId == comp.instanceId );
                };

                overlayInstances[ overlayId ].overlayComponents.push( comp );

            } else if ( comp?.action?.actionType === ActionTypes.Timer
                || comp?.action?.actionType === ActionTypes.Countdown
                || comp?.action?.actionType === ActionTypes.DotTimer
                || comp?.action?.actionType === ActionTypes.BeneficialTimer ) {
        
                if ( restartTimerComponent( overlayId, comp ) ) {
                    return;
                }
        
                if ( overlayInstances[ overlayId ].groupByTarget ) {
            
                    /** @type {TimerGroup} */
                    let group;
            
                    if ( comp.action.actionType === ActionTypes.DotTimer || comp.action.actionType === ActionTypes.BeneficialTimer ) {
                        group = getTimerGroup( overlayId, contentArea, comp.matches.groups.target );
            
                        createGroupedDotTimer( overlayId, contentArea, group, comp );

                    } else {
                        group = getTimerGroup( overlayId, contentArea, 'General' );
                
                        createGroupedTimer( overlayId, contentArea, group, comp );
                
                    }
            
                    sortGroupComponents( overlayId, group );
                    group.updateVisibility();
            
                } else {

                    if ( comp.action.actionType === ActionTypes.DotTimer || comp.action.actionType === ActionTypes.BeneficialTimer ) {
                        createUngroupedDotTimer( overlayId, contentArea, comp );
                    } else {
                        createUngroupedTimer( overlayId, contentArea, comp );
                    }
            
                    sortOverlayComponents( overlayId );
            
                }

            }
        }
        
    } catch ( error ) {
        logError( error, 'trigger', overlayId, comp );
    
    }
    
}










/**
 * Disables resize events on the given dom element.
 * 
 * @param {HTMLElement} dom The element to enable resize event on.
 */
function disableMoveResize( dom ) {
    for ( let i = 0; i < resizeHandles.length; i++ ) {
        let handle = dom.querySelector( `.${resizeHandles[ i ]}` );
        if ( handle ) {
            dom.removeChild( handle );
            handle.remove();
        }
    }

    dom.classList.remove( 'drag' );
    dom.classList.remove( 'mouse-enabled' );
    const domContentArea = dom.querySelectorAll( ':scope *' );
    domContentArea.forEach( d => d.classList.remove( 'mouse-enabled' ) );
    dom.dispatchEvent( stopTrackingMoveResizeEvent );
}










/**
 * Enables resize events on the given dom element.
 * 
 * @param {HTMLElement} dom The element to enable resize event on.
 */
function enableMoveResize( dom ) {

    dom.classList.add( 'mouse-enabled' );
    const domContentArea = dom.querySelectorAll( ':scope *' );
    domContentArea.forEach( d => d.classList.add( 'mouse-enabled' ) );
    
    /** @type {import('electron').Rectangle} */
    let bounds = {
        x: dom.offsetLeft,
        y: dom.offsetTop,
        width: dom.offsetWidth,
        height: dom.offsetHeight,
    };

    /** @type {import('electron').Point} */
    let relMousePos = {
        x: 0,
        y: 0,
    };
    
    let trackN = function ( evt ) {
        dom.style.top = `${evt.y}px`;
        const dy = bounds.y - dom.offsetTop;
        bounds.y = dom.offsetTop;
        bounds.height += dy;
        dom.style.height = `${bounds.height}px`;
    }

    let trackS = function ( evt ) {
        const dy = evt.y - (bounds.y + bounds.height);
        bounds.height += dy;
        dom.style.height = `${bounds.height}px`;
    }

    let trackE = function ( evt ) {
        const dx = evt.x - ( bounds.x + bounds.width );
        bounds.width += dx;
        dom.style.width = `${bounds.width}px`;
    }

    let trackW = function ( evt ) {
        dom.style.left = `${evt.x}px`;
        const dx = bounds.x - dom.offsetLeft;
        bounds.x = dom.offsetLeft;
        bounds.width += dx;
        dom.style.width = `${bounds.width}px`;
    }

    let trackMove = function ( evt ) {
        bounds.x = evt.x - relMousePos.x;
        bounds.y = evt.y - relMousePos.y;
        dom.style.left = `${bounds.x}px`;
        dom.style.top = `${bounds.y}px`;
    }

    let onMouseDown = function ( evt ) {
        const dx = evt.x - bounds.x;
        const dy = evt.y - bounds.y;

        const n = dy >= 0 - dragBorderSize && dy < 0;
        const s = dy <= bounds.height + dragBorderSize && dy >= bounds.height;
        const e = dx <= bounds.width + dragBorderSize && dx >= bounds.width;
        const w = dx >= 0 - dragBorderSize && dx < 0;

        // Janky if clause (only works in javascript), but it's easy to read in
        // this format: 
        // 
        //      if 'n' then attach the 'trackN' event.
        // 
        n && document.addEventListener( 'pointermove', trackN );
        s && document.addEventListener( 'pointermove', trackS );
        e && document.addEventListener( 'pointermove', trackE );
        w && document.addEventListener( 'pointermove', trackW );

        const ne = ( dy >= dragBorderSize - dragCornerSize && dy < dragBorderSize ) && ( dx <= bounds.width + dragBorderSize && dx >= bounds.width - dragBorderSize );
        const se = ( dy <= bounds.height + dragBorderSize && dy >= bounds.height - dragBorderSize ) && ( dx <= bounds.width + dragBorderSize && dx >= bounds.width - dragBorderSize );
        const sw = ( dy <= bounds.height + dragBorderSize && dy >= bounds.height - dragBorderSize ) && ( dx >= dragBorderSize - dragCornerSize && dx < dragBorderSize );
        const nw = ( dy >= dragBorderSize - dragCornerSize && dy < dragBorderSize ) && ( dx >= dragBorderSize - dragCornerSize && dx < dragBorderSize );

        ne && !n && document.addEventListener( 'pointermove', trackN );
        ne && !e && document.addEventListener( 'pointermove', trackE );
        se && !s && document.addEventListener( 'pointermove', trackS );
        se && !e && document.addEventListener( 'pointermove', trackE );
        sw && !s && document.addEventListener( 'pointermove', trackS );
        sw && !w && document.addEventListener( 'pointermove', trackW );
        nw && !n && document.addEventListener( 'pointermove', trackN );
        nw && !w && document.addEventListener( 'pointermove', trackW );

        if ( !n && !s && !e && !w && !ne && !se && !sw && !nw ) {
            relMousePos.x = dx;
            relMousePos.y = dy;
            document.addEventListener( 'pointermove', trackMove );
        }
    }

    let onMouseUp = function ( evt ) {
        // We'll be using the fact that we can happily call remove event 
        // listener all day long and the js engine doesn't care if it's 
        // actually attached.
        document.removeEventListener( 'pointermove', trackN );
        document.removeEventListener( 'pointermove', trackS );
        document.removeEventListener( 'pointermove', trackE );
        document.removeEventListener( 'pointermove', trackW );
        document.removeEventListener( 'pointermove', trackMove );

        // Next, lets check if the user made any changes.  If they have, then 
        // we need to let the overlay database know.
        for ( let overlayId in overlayInstances ) {
            if ( overlayId && overlayInstances.hasOwnProperty( overlayId ) ) {
                if ( dom === overlayInstances[ overlayId ].dom ) {
                    let changes = false;

                    changes = changes ? changes : overlayInstances[ overlayId ].model.x !== ( bounds.x - origin.x - overlayInstances[ overlayId ].model.displayBounds.x );
                    changes = changes ? changes : overlayInstances[ overlayId ].model.y !== ( bounds.y - origin.y - overlayInstances[ overlayId ].model.displayBounds.y );
                    changes = changes ? changes : overlayInstances[ overlayId ].model.windowWidth !== bounds.width;
                    changes = changes ? changes : overlayInstances[ overlayId ].model.windowHeight !== bounds.height;

                    if ( changes ) {
                        overlayInstances[ overlayId ].model.x = bounds.x - origin.x;
                        overlayInstances[ overlayId ].model.y = bounds.y - origin.y;
                        overlayInstances[ overlayId ].model.windowWidth = bounds.width;
                        overlayInstances[ overlayId ].model.windowHeight = bounds.height;
                        
                        ipcRenderer.send( 'overlay:event:bounds-changed', {
                            overlayId: overlayId,
                            displayId: null, // This is not known at this point, as the coordinates are in renderer space.  This will be calculated and bounds translated by the window manager.
                            bounds: {
                                x: overlayInstances[ overlayId ].model.x,
                                y: overlayInstances[ overlayId ].model.y,
                                width: overlayInstances[ overlayId ].model.windowWidth,
                                height: overlayInstances[ overlayId ].model.windowHeight
                            }
                        } );
                    }
                }
            }
        }
    }

    let stopTracking = function ( evt ) {
        dom.removeEventListener( 'pointerdown', onMouseDown );
        dom.removeEventListener( 'stop-tracking-mr', stopTracking );
        document.removeEventListener( 'pointerup', onMouseUp );
        document.removeEventListener( 'pointermove', trackN );
        document.removeEventListener( 'pointermove', trackS );
        document.removeEventListener( 'pointermove', trackE );
        document.removeEventListener( 'pointermove', trackW );
        document.removeEventListener( 'pointermove', trackMove );
    }

    dom.classList.add( 'drag' );

    for ( let i = 0; i < resizeHandles.length; i++ ) {
        let handle = document.createElement( 'span' );
        handle.classList.add( resizeHandles[ i ] );
        handle.classList.add( 'mouse-enabled' );
        dom.appendChild( handle );
    }

    dom.addEventListener( 'pointerdown', onMouseDown );
    dom.addEventListener( 'stop-tracking-mr', stopTracking );
    document.addEventListener( 'pointerup', onMouseUp );
}










/**
 * Modifies the given element so that it is on top of other elements (z-index: 2).
 * 
 * @param {HTMlElement} dom The DOM element to modify.
 */
function moveToTop( dom ) {
    for ( let overlayId in overlayInstances ) {
        if ( overlayId && overlayInstances.hasOwnProperty( overlayId ) ) {
            if ( dom === overlayInstances[ overlayId ].dom ) {
                overlayInstances[ overlayId ].dom.style.zIndex = 2;
            } else {
                overlayInstances[ overlayId ].dom.style.zIndex = 1;
            }
        }
    }
}










/**
 * Executes the given handler on each overlay instance.
 * 
 * @param {(overlay: OverlayInstance) => void} fn 
 */
function eachOverlay( fn ) {
    for ( let overlayId in overlayInstances ) {
        if ( overlayId && overlayInstances.hasOwnProperty( overlayId ) ) {
            fn( overlayInstances[ overlayId ] );
        }
    }
}










/**
 * Sorts the overlay components according to the user specified sort direction.
 * 
 * @param {string} overlayId The id of the desired overlay.
 */
function sortOverlayComponents( overlayId ) {
    // If the user has specified a sort direction.
    if ( overlayInstances[ overlayId ].sortDirection > 0 ) {
        // Every time a new timer is added, reorganize the timers so that the 
        // timer ending first will appear in the order in which the user has
        // specified.

        let dir = overlayInstances[ overlayId ].sortDirection === TimerSortTypes.Ascending ? -1 : 1;
        let sorted = _.sortBy( overlayInstances[ overlayId ].overlayComponents, [ c => dir * c.timeRemaining ] );
        for ( let i = 0; i < sorted.length; i++ ) {
            sorted[ i ].dom.parentNode.prepend( sorted[ i ].dom );
        }

    }
}










/**
 * Sorts the given timer group's overlay components according to the user 
 * specified sort direction.
 * 
 * @param {string} overlayId The id of the desired overlay.
 * @param {TimerGroup} group The overlay component group.
 */
function sortGroupComponents( overlayId, group ) {
    // If the user has specified a sort direction.
    if ( overlayInstances[ overlayId ].sortDirection > 0 ) {
        // Every time a new timer is added, reorganize the timers so that the 
        // timer ending first will appear in the order in which the user has
        // specified.

        let dir = overlayInstances[ overlayId ].sortDirection === TimerSortTypes.Ascending ? -1 : 1;
        let hdr = group.dom.querySelector( 'h6' );
        group.components = _.sortBy( group.components, [ c => dir * c.timeRemaining ] );
        for ( let i = 0; i < group.components.length; i++ ) {
            group.dom.insertBefore( group.components[ i ].dom, hdr.nextSibling );
        }

    }
}










/**
 * Returns the label for the given timer overlay component.
 * 
 * @param {string} overlayId The id of the desired overlay.
 * @param {OverlayComponent} comp The overlay component of the timer.
 */
function getTimerLabel( overlayId, comp ) {
    let label = '';

    if ( comp.action.actionType === ActionTypes.Timer || comp.action.actionType === ActionTypes.Countdown ) {
        label = comp.action.displayText || comp.triggerName;
    } else if ( comp.action.actionType === ActionTypes.DotTimer || comp.action.actionType === ActionTypes.BeneficialTimer ) {
        if ( overlayInstances[ overlayId ].groupByTarget || overlayInstances[ overlayId ].hideTargetLabel ) {
            label = comp.triggerName;
        } else {
            label = comp.action.displayText || comp.triggerName;
        }
    }

    return label;
}










/**
 * Creates a new grouped overlay component.
 * 
 * @param {string} overlayId The id of the desired overlay.
 * @param {Node} contentArea The content area for dot timers.
 * @param {{dom: HTMLDivElement, components: OverlayComponent[]}} group The component group.
 * @param {OverlayComponent} comp The overlay component.
 */
function createGroupedDotTimer( overlayId, contentArea, group, comp ) {
    let displayText = getTimerLabel( overlayId, comp );
    let content = targetGroupTimerTemplate( { value: displayText } );

    let div = document.createElement( 'div' );
    div.innerHTML = content;
    comp.dom = div;
    
    if ( comp.action.timerIcon != null ) {
        div.innerHTML = timerIconTemplate( { icon: comp.action.timerIcon, iconStyle: `"style="position: absolute; margin-left: -${overlayInstances[ overlayId ].dotTextHeight + 2}px;  height: ${overlayInstances[ overlayId ].dotTextHeight}px;` } ) + div.innerHTML;
    }

    comp.dom = div;
    comp.description = displayText;

    // Create a method that will remove the component from the overlay.
    let groupKey = group.name;
    comp.removeComponent = () => {
        comp.dom.parentNode && comp.dom.parentNode.removeChild( comp.dom );
        window.clearInterval( comp.intervalId );
        ArrayUtilities.remove( overlayInstances[ overlayId ].overlayGroups[ groupKey ].components, f => f.instanceId == comp.instanceId );

        window.setTimeout( () => {
            // We delay execution of this code and move it to the end of the stack 
            // because other overlay components may be added to this group.
            if ( overlayInstances[ overlayId ].overlayGroups[ groupKey ]?.components?.length === 0 ) {
                overlayInstances[ overlayId ].overlayGroups[ groupKey ].dom.parentNode && overlayInstances[ overlayId ].overlayGroups[ groupKey ].dom.parentNode.removeChild( overlayInstances[ overlayId ].overlayGroups[ groupKey ].dom );
                delete overlayInstances[ overlayId ].overlayGroups[ groupKey ];
            }
        } );
    };
    
    applyTimerSettings( overlayId, contentArea, comp, group );

    group.dom.appendChild( comp.dom );
    group.components.push( comp );

}










/**
 * Creates a new grouped timer component.
 * 
 * @param {string} overlayId The id of the desired overlay.
 * @param {Node} contentArea The content area for dot timers.
 * @param {{dom: HTMLDivElement, components: OverlayComponent[]}} group The component group.
 * @param {OverlayComponent} comp The overlay component.
 */
function createGroupedTimer( overlayId, contentArea, group, comp ) {
    let displayText = getTimerLabel( overlayId, comp );
    let content = targetGroupTimerTemplate( { value: displayText } );

    let div = document.createElement( 'div' );
    div.innerHTML = content;
    comp.dom = div;
    
    if ( comp.action.timerIcon != null ) {
        div.innerHTML = timerIconTemplate( { icon: comp.action.timerIcon, iconStyle: `"style="position: absolute; margin-left: -${overlayInstances[ overlayId ].dotTextHeight + 2}px;  height: ${overlayInstances[ overlayId ].dotTextHeight}px;` } ) + div.innerHTML;
    }

    comp.dom = div;
    comp.description = displayText;

    // Create a method that will remove the component from the overlay.
    let groupKey = group.name;
    comp.removeComponent = () => {
        comp.dom.parentNode && comp.dom.parentNode.removeChild( comp.dom );
        window.clearInterval( comp.intervalId );
        ArrayUtilities.remove( overlayInstances[ overlayId ].overlayGroups[ groupKey ]?.components, f => f.instanceId == comp.instanceId );

        window.setTimeout( () => {
            // We delay execution of this code and move it to the end of the stack 
            // because other overlay components may be added to this group.
            if ( overlayInstances[ overlayId ].overlayGroups[ groupKey ]?.components?.length === 0 ) {
                overlayInstances[ overlayId ].overlayGroups[ groupKey ].dom.parentNode && overlayInstances[ overlayId ].overlayGroups[ groupKey ].dom.parentNode.removeChild( overlayInstances[ overlayId ].overlayGroups[ groupKey ].dom );
                delete overlayInstances[ overlayId ].overlayGroups[ groupKey ];
            }
        } );
    };
    
    applyTimerSettings( overlayId, contentArea, comp, group );

    group.dom.appendChild( comp.dom );
    group.components.push( comp );

}










/**
 * Returns the group for the specified name.  If the group is not found, 
 * then a new group is created.
 * 
 * @param {string} overlayId The id of the desired overlay.
 * @param {Node} contentArea The content area for timers.
 * @param {string} groupName The name of the desired group.
 */
function getTimerGroup( overlayId, contentArea, groupName ) {

    for ( let key in overlayInstances[ overlayId ].overlayGroups ) {
        if ( key === groupName && overlayInstances[ overlayId ].overlayGroups.hasOwnProperty( key ) ) {
            return overlayInstances[ overlayId ].overlayGroups[ key ];
        }
    }

    let content = targetGroupTemplate( { name: groupName } );
    let div = document.createElement( 'div' );
    div.classList.add( 'mob-dot-group' );
    div.innerHTML = content;
    let h6 = div.querySelector( 'h6' );

    h6.style.fontSize = `${overlayInstances[ overlayId ].groupHeaderSize}px`;
    h6.style.color = overlayInstances[ overlayId ].groupHeaderColor;
    h6.style.fontWeight = overlayInstances[ overlayId ].groupHeaderWeight;
    let h6BorderColor = '#000000'
    h6.style.textShadow = `0px 0px 1px ${h6BorderColor}, -1px -1px 0 ${h6BorderColor}, 1px -1px 0 ${h6BorderColor}, -1px 1px 0 ${h6BorderColor}, 1px 1px 0 ${h6BorderColor}`;

    if ( overlayInstances[ overlayId ].hideTargetLabel ) {
        h6.style.display = 'none';
    } else {
        delete h6.style.display;
    }

    contentArea.appendChild( div );

    overlayInstances[ overlayId ].overlayGroups[ groupName ] = {
        visible: true,
        name: groupName,
        dom: div,
        components: [],
        updateVisibility: () => {
            let g = overlayInstances[ overlayId ].overlayGroups[ groupName ];

            if ( g.components?.length > 0 ) {
                let visible = _.some( g.components, c => !c.hidden );

                if ( visible && !g.visible ) {
                    contentArea.appendChild( g.dom );
                    g.visible = true;

                } else if ( !visible && g.visible ) {
                    contentArea.removeChild( g.dom );
                    g.visible = false;

                }

            } else {
                contentArea.removeChild( g.dom );
                g.visible = false;

            }

        }
    };
    return overlayInstances[ overlayId ].overlayGroups[ groupName ];
}










/**
 * Creates a new dot timer and places it in the content area.
 * 
 * @param {string} overlayId The id of the desired overlay.
 * @param {Node} contentArea The content area for dot timers.
 * @param {OverlayComponent} comp The dot timer component.
 */
function createUngroupedDotTimer( overlayId, contentArea, comp ) {
    let displayText = getTimerLabel( overlayId, comp );
    let content = timerTemplate( { value: displayText } );

    // Create the component's dom element and append it to the content area.
    let div = document.createElement( 'div' );
    div.innerHTML = content;
    
    if ( comp.action.timerIcon != null ) {
        div.innerHTML = timerIconTemplate( { icon: comp.action.timerIcon, iconStyle: `"style="position: absolute; margin-left: -${overlayInstances[ overlayId ].dotTextHeight + 2}px;  height: ${overlayInstances[ overlayId ].dotTextHeight}px;` } ) + div.innerHTML;
    }

    comp.dom = div;
    comp.description = displayText;

    // Create a method that will remove the component from the overlay.
    comp.removeComponent = () => {
        comp.dom.parentNode && comp.dom.parentNode.removeChild( comp.dom );
        window.clearInterval( comp.intervalId );
        ArrayUtilities.remove( overlayInstances[ overlayId ].overlayComponents, f => f.instanceId == comp.instanceId );
    };
    
    applyTimerSettings( overlayId, contentArea, comp );
    
    contentArea.appendChild( comp.dom );
    overlayInstances[ overlayId ].overlayComponents.push( comp );

}










/**
 * Creates a new timer and places it in the content area.
 * 
 * @param {string} overlayId The id of the desired overlay.
 * @param {Node} contentArea The content area for dot timers.
 * @param {OverlayComponent} comp The dot timer component.
 */
function createUngroupedTimer( overlayId, contentArea, comp ) {
    let displayText = getTimerLabel( overlayId, comp );
    let content = timerTemplate( { value: displayText } );

    // Create the component's dom element and append it to the content area.
    let div = document.createElement( 'div' );
    div.innerHTML = content;
    
    if ( comp.action.timerIcon != null ) {
        div.innerHTML = timerIconTemplate( { icon: comp.action.timerIcon, iconStyle: `"style="position: absolute; margin-left: -${overlayInstances[ overlayId ].dotTextHeight + 2}px;  height: ${overlayInstances[ overlayId ].dotTextHeight}px;` } ) + div.innerHTML;
    }

    comp.dom = div;
    comp.description = displayText;

    // Create a method that will remove the component from the overlay.
    comp.removeComponent = () => {
        comp.dom.parentNode && comp.dom.parentNode.removeChild( comp.dom );
        window.clearInterval( comp.intervalId );
        ArrayUtilities.remove( overlayInstances[ overlayId ].overlayComponents, f => f.instanceId == comp.instanceId );
    };
    
    applyTimerSettings( overlayId, contentArea, comp );
    
    contentArea.appendChild( comp.dom );
    overlayInstances[ overlayId ].overlayComponents.push( comp );

}










/**
 * Applies the general timer settings to the given component.
 * 
 * @param {string} overlayId The id of the desired overlay.
 * @param {Node} contentArea The content area for timers.
 * @param {OverlayComponent} comp Applies the general timer settings to the given timer component.
 * @param {TimerGroup} group The containing group, if available.
 */
function applyTimerSettings( overlayId, contentArea, comp, group ) {
    // Apply the styles required to make the progress bar height match the 
    // specified number in the overlay settings.
    comp.dom.querySelector( '.progress' ).style.marginBottom = contentArea.style.lineHeight;
    if ( comp.action.overrideTimerColor ) {
        comp.dom.querySelector( '.determinate' ).style.backgroundColor = comp.action.overrideTimerColor;
        comp.dom.querySelector( '.progress' ).style.backgroundColor = comp.action.timerBackgroundColor;
    } else {
        let overlayInstance = overlayInstances[ comp.action.overlayId ];
        
        if ( overlayInstance?.model?.timerColor && overlayInstance?.model?.timerBackgroundColor ) {
            comp.dom.querySelector( '.determinate' ).style.backgroundColor = overlayInstance.model.timerColor;
            comp.dom.querySelector( '.progress' ).style.backgroundColor = overlayInstance.model.timerBackgroundColor;
        } else {
            comp.dom.querySelector( '.determinate' ).style.backgroundColor = '#008000';
            comp.dom.querySelector( '.progress' ).style.backgroundColor = 'rgba(0,33,0,.75)';
        }
    }

    // Set the starting conditions for the timer.
    comp.start = comp.timestamp;
    comp.timeRemaining = comp.action.duration;

    if ( comp.start == null ) {
        comp.dom.querySelector( 'span.time-remaining' ).innerHTML = `(??)&nbsp;`;
    } else if ( overlayInstances[ overlayId ].showRemainingDuration || comp.action.showRemainingDuration ) {
        comp.dom.querySelector( 'span.time-remaining' ).innerHTML = `(${comp.action.duration})&nbsp;`;
    } else {
        comp.dom.querySelector( 'span.time-remaining' ).innerHTML = ``;
    }

    // Update visibility
    if ( comp.action.hideTimer ) {
        let doHide = true;

        if ( comp.action.hideConditions?.length > 0 ) {
            let namedGroups = Object.keys( comp.matches?.groups );

            for ( let i = 0; i < comp.action.hideConditions.length; i++ ) {
                let hc = comp.action.hideConditions[ i ];

                if ( hc.operatorType === OperatorTypes.Equals ) {
                    // If it does not exist or the values do not match, then bad.
                    if ( namedGroups.indexOf( hc.variableName ) === -1 || !StringUtilities.compare( hc.variableValue, comp.matches.groups[ hc.variableName ] ) ) {
                        doHide = false;
                        break;
                    }

                } else if ( hc.operatorType === OperatorTypes.DoesNotEqual ) {
                    // If it exists and the value matches, then bad.
                    if ( namedGroups.indexOf( hc.variableName ) > -1 && StringUtilities.compare( hc.variableValue, comp.matches.groups[ hc.variableName ] ) ) {
                        doHide = false;
                        break;
                    }

                }

            }

        }

        if ( doHide ) {
            comp.hidden = comp.action.hideTimer;
            comp.dom.style.display = 'none';
        }
    }

    // Setting the initial state of the determinate will prevent the progress 
    // bar from jumping from the end to the beginning when shown.
    if ( comp.action.actionType === ActionTypes.Countdown || comp.action.actionType === ActionTypes.BeneficialTimer ) {
        comp.dom.querySelector( 'div.determinate' ).style.width = `100%`;
    } else {
        comp.dom.querySelector( 'div.determinate' ).style.width = `0%`;
    }

    // Set the update method.
    comp.intervalId = window.setInterval( () => {

        let perc = 0;
        let infinite = false;

        if ( comp.start == null ) {
            infinite = true;
            comp.timeRemaining = intMaxValue;
        } else {
            perc = ( Math.abs( ( new Date() ) - comp.start ) / 1000 ) / comp.action.duration;
            comp.timeRemaining = comp.action.duration - ( comp.action.duration * perc );
        }

        if ( infinite ) {
            // Do nothing.
        } else if ( comp.action.actionType === ActionTypes.Countdown || comp.action.actionType === ActionTypes.BeneficialTimer ) {
            comp.dom.querySelector( 'div.determinate' ).style.width = `${100 - ( perc * 100 )}%`;
        } else {
            comp.dom.querySelector( 'div.determinate' ).style.width = `${perc * 100}%`;
        }

        if ( infinite ) {
            comp.dom.querySelector( 'span.time-remaining' ).innerHTML = `(??)&nbsp;`;
        } else if ( overlayInstances[ overlayId ].showRemainingDuration || comp.action.showRemainingDuration ) {
            comp.dom.querySelector( 'span.time-remaining' ).innerHTML = `(${getDurationLabel( overlayId, comp.timeRemaining )})&nbsp;`;
        } else {
            comp.dom.querySelector( 'span.time-remaining' ).innerHTML = ``;
        }

        if ( comp.action.ifEndingSoon && comp.action.endingDuration > 0 && comp.timeRemaining > 0 && comp.timeRemaining <= comp.action.endingDuration ) {
            // Apply any ending soon condition effects.

            if ( comp.action.endingSoonChangeColor ) {
                comp.dom.querySelector( 'div.determinate' ).style.backgroundColor = comp.action.endingSoonColor;
                comp.dom.querySelector( 'div.progress' ).style.backgroundColor = comp.action.endingSoonBackgroundColor;
            }

            if ( comp.hidden && comp.action.endingSoonShowTimer ) {
                comp.hidden = false;
                comp.dom.style.display = null;
                if ( overlayInstances[ overlayId ].groupByTarget && group ) {
                    group.updateVisibility();
                }
            }

            if ( !comp.endingSoonSpoken && comp.action.endingSoonSpeak ) {
                comp.endingSoonSpoken = true;
                speakPhrase( comp.action.endingSoonSpeakPhrase, comp.action.endingSoonInterruptSpeech, comp.matches, comp.action.duration );
            }

            if ( !comp.endingAudioPlayed && comp.action.endingPlayAudio ) {
                comp.endingAudioPlayed = true;
                playAudioFile( comp.action.endingPlayAudioFileId );
            }

            if ( !comp.endingCopied && comp.action.endingClipboard ) {
                comp.endingCopied = true;
                ipcRenderer.send( 'clipboard:writeText', comp.action.endingClipboardText );
            }

            if ( !comp.endingSoonTextDisplayed && comp.action.endingSoonDisplayText ) {
                comp.endingSoonTextDisplayed = true;
                sendDisplayTextToOverlay( comp.action.endingSoonTextOverlayId, comp.action.endingSoonText, comp.action.endingSoonTextDuration );
            }

            // Execute ending soon sub actions.
            if ( !comp.endingSoonSubActionsExecuted && comp.action.endingSoonSubActions?.length > 0 ) {
                comp.action.endingSoonSubActions.forEach( f => {
                    ipcRenderer.send( 'log:action:execute-sub-action', { subAction: f, instanceId: comp.instanceId } );
                } );
                comp.endingSoonSubActionsExecuted = true;
            }

        }
        
        if ( comp.timeRemaining <= 0 ) {
            // If the timer has ended, but is required to remain for a
            // duration, apply the ended conditions to the timer.

            if ( !comp.action.repeatTimer && ( comp.action.remainAfterEnded || comp.action.notifyWhenEnded ) ) {
                if ( comp.action.endedChangeColor ) {
                    comp.dom.querySelector( 'div.determinate' ).style.backgroundColor = comp.action.endedColor;
                    comp.dom.querySelector( 'div.progress' ).style.backgroundColor = comp.action.endedBackgroundColor;
                }

                if ( comp.hidden && comp.action.remainAfterEnded ) {
                    comp.hidden = false;
                    comp.dom.style.display = null;
                    if ( overlayInstances[ overlayId ].groupByTarget && group ) {
                        group.updateVisibility();
                    }
                }

                if ( !comp.endedSpoken && comp.action.endedSpeak ) {
                    comp.endedSpoken = true;
                    speakPhrase( comp.action.endedSpeakPhrase, comp.action.endedInterruptSpeech, comp.matches, comp.action.duration );
                }

                if ( !comp.endedAudioPlayed && comp.action.endedPlayAudio ) {
                    comp.endedAudioPlayed = true;
                    playAudioFile( comp.action.endedPlayAudioFileId );
                }

                if ( !comp.endedCopied && comp.action.endedClipboard ) {
                    comp.endedCopied = true;
                    ipcRenderer.send( 'clipboard:writeText', comp.action.endedClipboardText );
                }

                if ( !comp.endedTextDisplayed && comp.action.endedDisplayText ) {
                    comp.endedTextDisplayed = true;
                    sendDisplayTextToOverlay( comp.action.endedTextOverlayId, comp.action.endedText, comp.action.endedTextDuration );
                }
            }

            // Execute ended sub actions or clear stored instance data in the log watcher.
            if ( comp.action.notifyWhenEnded && !comp.endedSubActionsExecuted && comp.action.endedSubActions?.length > 0 ) {
                comp.action.endedSubActions.forEach( f => {
                    ipcRenderer.send( 'log:action:execute-sub-action', { subAction: f, instanceId: comp.instanceId } );
                } );
                comp.endedSubActionsExecuted = true;
            }

        }

        if ( ( comp.timeRemaining <= 0 && !comp.action.remainAfterEnded && !comp.action.repeatTimer ) || ( comp.timeRemaining <= -1 * comp.action.remainDuration && !comp.action.repeatTimer ) ) {
            // When conditions met that require the timer be removed from the 
            // overlay, then call the remove comonponent method.
            
            delayRemoveComponent( overlayId, comp );

        } else if ( comp.timeRemaining <= 0 && comp.action.repeatTimer ) {
            
            comp.repeatCount = comp.repeatCount > 0 ? comp.repeatCount + 1 : 1;
            
            if ( comp.action.repeatCount == null || comp.repeatCount <= comp.action.repeatCount ) {
                comp = resetTimerComponentClock( overlayId, comp, comp.repeatCount );
            } else {
                delayRemoveComponent( overlayId, comp );
            }
        }

    }, 250 );
}










/**
 * Removes the given component after the specified number of milliseconds have 
 * passed.
 * 
 * @param {string} overlayId The id of the desired overlay.
 * @param {OverlayComponent} comp The component to remove.
 * @param {number} delay The number of milliseconds to delay removal.
 */
function delayRemoveComponent( overlayId, comp, delay ) {

    if ( destroySchedule[ comp.instanceId ] == null ) {
    
        delay = delay > 0 ? delay : 1000;
    
        let timeoutId = window.setTimeout( () => {
            comp.removeComponent();
            ipcRenderer.send( 'log:destroy:component', comp.instanceId );
            destroySchedule[ comp.instanceId ] = null;
        }, delay );

        destroySchedule[ comp.instanceId ] = timeoutId;
    }
    
}










/**
 * Resets the timer clock and styles on the give overlay component.
 * 
 * @param {string} overlayId The id of the desired overlay.
 * @param {OverlayComponent} comp The overlay component to reset the clock.
 */
function resetTimerComponentClock( overlayId, comp, repeatCount ) {
    
    repeatCount = repeatCount > 0 ? repeatCount : 1;

    // Reset the start duration
    comp.start = new Date( comp.timestamp.getTime() + ( repeatCount * comp.action.duration ) * 1000 );
    comp.timeRemaining = comp.action.duration;

    // Reset the ending conditions
    comp.endingSoonSpoken = false;
    comp.endingSoonTextDisplayed = false;
    comp.endedSpoken = false;
    comp.endedTextDisplayed = false;
    comp.instanceId = comp.instanceId;
    comp.endingSoonSubActionsExecuted = false;
    comp.endedSubActionsExecuted = false;

    // Reset the background color
    if ( comp.action.overrideTimerColor ) {
        comp.dom.querySelector( '.determinate' ).style.backgroundColor = comp.action.overrideTimerColor;
        comp.dom.querySelector( '.progress' ).style.backgroundColor = comp.action.timerBackgroundColor;
    } else {
        let overlayInstance = overlayInstances[ comp.action.overlayId ];
        
        if ( overlayInstance?.model?.timerColor && overlayInstance?.model?.timerBackgroundColor ) {
            comp.dom.querySelector( '.determinate' ).style.backgroundColor = overlayInstance.model.timerColor;
            comp.dom.querySelector( '.progress' ).style.backgroundColor = overlayInstance.model.timerBackgroundColor;
        } else {
            comp.dom.querySelector( '.determinate' ).style.backgroundColor = '#008000';
            comp.dom.querySelector( '.progress' ).style.backgroundColor = 'rgba(0,33,0,.75)';
        }
    }

    return comp;
}










/**
 * Restarts a named timer component.  Using this method, only the description/text of the timer is considered when restarting.
 * 
 * @returns {boolean} Returns true if the given component should not be created.
 * 
 * @param {string} overlayId The id of the desired overlay.
 * @param {OverlayComponent} comp The overlay component to restart.
 */
function restartTimerComponent( overlayId, comp ) {

    if ( comp.action.restartBehavior === TimerRestartBehaviors.RestartOnDuplicate ) {
        
        if ( comp.action.actionType === ActionTypes.BeneficialTimer || comp.action.actionType === ActionTypes.DotTimer ) {
            destroyComponents( overlayId, c => c.action.actionId == comp.action.actionId && c.matches.groups?.target === comp.matches.groups?.target );

        } else if ( comp.action.actionType === ActionTypes.Timer || comp.action.actionType === ActionTypes.Countdown ) {
            // If a timer's displayText property was not supplied by the user, 
            // then the description (which is the text that is rendered on the 
            // progress bar) of a timer is set to the trigger's name.  If the 
            // parameter component's display text is null, it would then match 
            // the description (Trigger's Name, by default) of the same action 
            // id.
            destroyComponents( overlayId, c => c.action.actionId == comp.action.actionId && ( comp.action.displayText == null || c.description === comp.action.displayText ) );
            
        }

    } else if ( comp.action.restartBehavior === TimerRestartBehaviors.RestartTimer ) {
        destroyComponents( overlayId, c => c.action.actionId == comp.action.actionId );
        
    } else if ( comp.action.restartBehavior === TimerRestartBehaviors.DoNothing ) {
        // I realize this is bad practice, I'm tired, it's late, and it's documented.
        // If the timer exists, then we tell the caller that the timer was restarted so that the timer isn't recreated.
        return timerExists( overlayId, c => c.action.actionId == comp.action.actionId );
    }

    return false;
}










/**
 * Finds all overlay components that satisfy the given predicate.
 * 
 * @description This method will search all overlays.
 * 
 * @returns {Record<string, OverlayComponent[]>} Returns a record of all 
 *      overlay components that satisfy the predicate, from all overlays.
 * 
 * @param {(component: OverlayComponent) => boolean} predicate Invoked per iteration, if true the component is included in the results.
 */
function findComponents( predicate ) {
    /** @type {Record<string, OverlayComponent[]>} */
    let results = {};

    for ( let overlayId in overlayInstances ) {
        if ( overlayInstances.hasOwnProperty( overlayId ) ) {
            let ocs = [];

            if ( overlayInstances[ overlayId ].groupByTarget ) {

                for ( let key of Object.keys( overlayInstances[ overlayId ].overlayGroups ) ) {
                    overlayInstances[ overlayId ].overlayGroups[ key ].components?.forEach( c => {
                        if ( predicate( c ) ) {
                            ocs.push( c );
                        }
                    } );
                }
        
            } else {
        
                overlayInstances[ overlayId ].overlayComponents?.forEach( c => {
                    if ( predicate( c ) ) {
                        ocs.push( c );
                    }
                } );
        
            }

            if ( ocs.length > 0 ) {
                results[ overlayId ] = ocs;
            }
        }
    }

    return results;
}










/**
 * Finds the first overlay component that satisfies the given predicate.
 * 
 * @description This method will search all overlays.
 * 
 * @returns {OverlayComponent|null} Returns the first overlay components that satisfies the predicate.  Searches all overlays.
 * 
 * @param {(component: OverlayComponent) => boolean} predicate Invoked per iteration, if true the component is immediately returned.
 */
function findComponent( predicate ) {
    for ( let overlayId in overlayInstances ) {
        if ( overlayInstances.hasOwnProperty( overlayId ) ) {

            if ( overlayInstances[ overlayId ].groupByTarget ) {

                for ( let key of Object.keys( overlayInstances[ overlayId ].overlayGroups ) ) {

                    for ( let i = 0; i < overlayInstances[ overlayId ].overlayGroups[ key ].components?.length; i++ ){
                        const c = overlayInstances[ overlayId ].overlayGroups[ key ].components[ i ];
                        if ( predicate( c ) ) {
                            return c;
                        }
                    }

                }
        
            } else {
        
                for ( let i = 0; i < overlayInstances[ overlayId ].overlayComponents?.length; i++ ){
                    const c = overlayInstances[ overlayId ].overlayComponents[ i ];
                    if ( predicate( c ) ) {
                        return c;
                    }
                }
        
            }

        }
    }

    return null;
}










/**
 * Destroys all overlay components predicate returns truthy for.
 * 
 * @param {string} overlayId The id of the desired overlay.
 * @param {(component: OverlayComponent) => boolean} predicate Executed per iteration, passing in the overlay component as the first argument.
 */
function destroyComponents( overlayId, predicate ) {
    let ocs = [];

    if ( overlayInstances[ overlayId ].groupByTarget ) {

        for ( let key of Object.keys( overlayInstances[ overlayId ].overlayGroups ) ) {
            overlayInstances[ overlayId ].overlayGroups[ key ].components?.forEach( c => {
                if ( predicate( c ) ) {
                    ocs.push( c );
                }
            } );
        }

    } else {

        overlayInstances[ overlayId ].overlayComponents?.forEach( c => {
            if ( predicate( c ) ) {
                ocs.push( c );
            }
        } );

    }

    ocs.forEach( c => {
        c.removeComponent();
        ipcRenderer.send( 'log:destroy:component', c.instanceId );
    } );
    
    ocs = null;
}










/**
 * Returns true if the specified overlay component exists on the specified overlay.
 * 
 * @param {string} overlayId The id of the desired overlay.
 * @param {(component: OverlayComponent) => boolean} predicate Executed per iteration, passing in the overlay component as the first argument.
 */
function timerExists( overlayId, predicate ) {

    if ( overlayInstances[ overlayId ].groupByTarget ) {

        for ( let key of Object.keys( overlayInstances[ overlayId ].overlayGroups ) ) {
            overlayInstances[ overlayId ].overlayGroups[ key ].components?.forEach( c => {
                if ( predicate( c ) ) {
                    return true;
                }
            } );
        }

    } else {

        overlayInstances[ overlayId ].overlayComponents?.forEach( c => {
            if ( predicate( c ) ) {
                return true;
            }
        } );

    }

    return false;
}










/**
 * Returns a hex number for the given value.
 * 
 * @param {number} c The value to convert.
 */
function componentToHex( c ) {
    var hex = c.toString( 16 );
    return hex.length == 1 ? "0" + hex : hex;
}










/**
 * Sends the given text to the specified overlay.
 * 
 * @param {string} overlayId The id of the overlay.
 * @param {string} text The text value to display.
 * @param {number} duration The number of seconds to display text.
 */
function sendDisplayTextToOverlay( overlayId, text, duration ) {
    let comp = new OverlayComponent();

    comp.instanceId = nanoid();
    comp.action = new TriggerAction();
    comp.action.displayText = text;
    comp.action.duration = duration;
    comp.overlayId = overlayId;
    comp.matches = [];
    comp.timestamp = new Date();

    render( overlayId, comp );
}










/**
 * Sends the given message to a log watcher to speak.
 * 
 * @param {string} phrase The phrase to speak.
 * @param {boolean} interruptSpeech If true, any speech will be interrupted.  If false, this text is added to the end of the queue.
 * @param {RegExpExecArray} parseResult The results of the regular expression match.
 * @param {number} timerDuration If this text is associated with a timer, this is the natural duration, in seconds, of the timer.
 */
function speakPhrase( phrase, interruptSpeech, parseResult, timerDuration ) {
    ipcRenderer.send( 'log:speak:phrase', { phrase: phrase, interruptSpeech: interruptSpeech, parseResult: parseResult, timerDuration: timerDuration } );
}










/**
 * Returns a label for the given duration.
 * 
 * @param {string} overlayId The id of the desired overlay.
 * @param {number} duration The duration, in seconds.
 */
function getDurationLabel( overlayId, duration ) {
    if ( duration > 60 ) {
        let d = Math.ceil( duration );
        let hrs = Math.floor( d / 3600 );
        let mins = Math.floor( ( d % 3600 ) / 60 );
        let secs = d % 60;
        
        let label = '';
        if ( hrs > 0 ) {
            label += `${hrs}h ${mins}m ${secs}s`;
        } else if ( mins > 0 ) {
            label += `${mins}m ${secs}s`;
        } else if ( secs > 0 ) {
            label += `${secs}s`;
        }

        return label;
    } else {
        return `${Math.ceil(duration)}s`;
    }
}










/**
 * Plays the specified audio file.
 * 
 * @param {string} fileId The id of the desired file.
 */
function playAudioFile( fileId ) {
    ipcRenderer.once( 'audio-file:get:url', ( e, url ) => {
        if ( url ) {
            let player = new Audio( url );
            player.play();
        }
    } );
    ipcRenderer.send( 'audio-file:get:url', fileId );
}










/**
 * Shows a full glow on the primary monitor.
 * 
 * @param {string} color The color hex code.
 * @param {number} duration The duration, in milliseconds.
 * @param {boolean} flash If true, the glow will flash.
 */
function renderGlow( color, duration, flash ) {
    duration = duration > 0 ? duration : 5000;
    duration = flash ? duration : duration - 1000;
    duration = duration < 2000 ? 2000 : duration;
    duration = flash && duration % 2000 > 0 ? duration + ( 2000 - duration % 2000 ) : duration;

    if ( !screenGlower ) {
        let bounds = screen.getPrimaryDisplay().bounds;
        let content = document.createElement( 'div' );

        // box-shadow: inset 0 0 30px #00f;
        content.classList.add( 'screen-glow' );
        if ( flash ) {
            content.classList.add( 'animate-fadeinout-inf' );
        } else {
            content.classList.add( 'animate-glow-fadein' );
        }
        // 
        content.style.boxShadow = `inset 0 0 133px ${color}`;
        content.style.position = 'absolute';
        content.style.left = `${origin.x}px`;
        content.style.top = `${origin.y}px`;
        content.style.width = `${bounds.width}px`;
        content.style.height = `${bounds.height}px`;
        
        document.body.appendChild( content );
        screenGlower = content;

        screenGlowTimerId = window.setTimeout( () => {
            if ( !flash ) {
                content.classList.add( 'animate-glow-fadeout' );
                screenGlowTimerId = window.setTimeout( () => {
                    screenGlower = null;
                    document.body.removeChild( content );
                }, 1000);
            } else {
                screenGlower = null;
                document.body.removeChild( content );
            }
        }, duration );
    } else {
        window.clearTimeout( screenGlowTimerId );
        
        screenGlower.style.boxShadow = `inset 0 0 133px ${color}`;
        
        screenGlowTimerId = window.setTimeout( () => {
            if ( !flash ) {
                screenGlower.classList.add( 'animate-glow-fadeout' );
                screenGlowTimerId = window.setTimeout( () => {
                    document.body.removeChild( screenGlower );
                    screenGlower = null;
                }, 1000);
            } else {
                document.body.removeChild( screenGlower );
                screenGlower = null;
            }
        }, duration );

    }
}










/**
 * Returns a random critical location that's free.
 * 
 * @param {string} overlayId The overlay id.
 */
function getRandomLocation( overlayId ) {
    let c = getCompCount( overlayId );
    let xs = Math.floor( c / overlayInstances[ overlayId ].criticals.length );
    // let yx = Math.floor( c / overlayInstances[ overlayId ].criticals[ 0 ].length );
    let x = -1;
    let y = -1;

    let crazy = 0;
    while ( x === -1 && crazy < overlayInstances[ overlayId ].criticals.length * overlayInstances[ overlayId ].criticals[ 0 ].length ) {
        crazy++;

        let t = NumberUtilities.randomBounded( 0, overlayInstances[ overlayId ].criticals.length );
        if ( countCritX( overlayId, t ) <= xs ) {
            x = t;
        }
    }

    if ( crazy === overlayInstances[ overlayId ].criticals.length * overlayInstances[ overlayId ].criticals[ 0 ].length ) {
        return { x: NumberUtilities.randomBounded( 0, overlayInstances[ overlayId ].criticals.length ), y: NumberUtilities.randomBounded( 0, overlayInstances[ overlayId ].criticals[ 0 ].length ) };
    }

    crazy = 0;
    while ( y === -1 && crazy < overlayInstances[ overlayId ].criticals[ x ].length ) {
        crazy++;

        let t = NumberUtilities.randomBounded( 0, overlayInstances[ overlayId ].criticals[ x ].length );
        if ( !overlayInstances[ overlayId ].criticals[ x ][ t ] ) {
            y = t;
        }
    }

    return { x: x, y: y };
}










/**
 * Returns the total number of criticals on the display.
 * 
 * @param {string} overlayId The overlay id.
 * @returns 
 */
function getCompCount( overlayId ) {
    let c = 0;
    for ( let x = 0; x < overlayInstances[ overlayId ].criticals.length; x++ ) {
        for ( let y = 0; y < overlayInstances[ overlayId ].criticals[ x ].length; y++ ) {
            c += overlayInstances[ overlayId ].criticals[ x ][ y ] === true ? 1 : 0;
        }
    }
    return c;
}










/**
 * Returns the number of criticals in the x position.
 * 
 * @param {string} overlayId The overlay id.
 * @param {number} x The x position.
 */
function countCritX( overlayId, x ) {
    let c = 0;
    overlayInstances[ overlayId ].criticals[ x ].forEach( pos => c += pos ? 1 : 0 );
    return c;
}










/**
 * Instantly removes all trigger elements from the renderer and cancels all cancellable components.
 */
function clearAll() {

    // Instantly removes the screen glow.
    if ( screenGlowTimerId > -1 ) {
        window.clearTimeout( screenGlowTimerId );
    }

    if ( screenGlower ) {
        document.body.removeChild( screenGlower );
        screenGlower = null;
    }

    // Loop through each overlay and destroy each component.
    let components = [];
    for ( const overlayId of Object.keys( overlayInstances ) ) {

        if ( overlayInstances[ overlayId ].groupByTarget ) {

            for ( const key of Object.keys( overlayInstances[ overlayId ].overlayGroups ) ) {
                overlayInstances[ overlayId ].overlayGroups[ key ].components?.forEach( comp => components.push( comp ) );
            }
        
        } else {
    
            overlayInstances[ overlayId ].overlayComponents?.forEach( comp => components.push( comp ) );

        }

    }
    
    components.forEach( comp => {
        comp.removeComponent();
        ipcRenderer.send( 'log:destroy:component', comp.instanceId );
    } );
    
    ipcRenderer.send( 'log:clear-all:done', null );
}

module.exports = Renderer;
