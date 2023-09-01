const DomUtilities = require( '../utilities/dom' );
const StringUtilities = require( '../utilities/string' );
const NumberUtilities = require( '../utilities/numbers' );
const ArrayUtilities = require( '../utilities/arrays' );
const { DateUtilities } = require( '../utilities/dates' );
const { OverlayWindow, OverlayComponent, TimerSortTypes } = require( '../data/models/overlay-window' );
const { ActionTypes, TriggerAction, TriggerConditionTypes, OperatorTypes, TimerRestartBehaviors } = require( '../data/models/trigger' );
const { ipcRenderer } = require( 'electron' );
const Handlebars = require( "handlebars" );
const _ = require( 'lodash' );
const customAlphabet = require( 'nanoid' ).customAlphabet;
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const nanoid = customAlphabet( alphabet, 16 );

// TODO: Delete this overlay from the project.

window.onerror = ( error, url, line ) => {
    ipcRenderer.send( 'app:log:exception', `$${error}\r\n    at ${url}:${line}` );
};

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


/** @type {OverlayComponent[]} */
var overlayComponents = [];
/** @type {Object.<string, TimerGroup>} */
var overlayGroups = {};

var mobGroups = [];
var displayTextTemplate;
var timerTemplate;
var timerIconTemplate;
var targetGroupTemplate;
var targetGroupTimerTemplate;
const fctFps = 1000 / 60;
var fctRenderQueue = [];
var fctRenderInterval = 250;
var width = 1;
var height = 1;
var fontSize = 1;
var sortDirection = TimerSortTypes.None;
var voiceOptions = [];
var dotTextHeight = 0;
var showDuration = false;
var groupByTarget = false;
var groupHeaderSize = 12;
var groupHeaderColor = '#ffffff';
var groupHeaderWeight = 400;
var hideTargetLabel = false;
/** @type {Record<number, number>} */
var destroySchedule = {};










function Overlay() {
    
    DomUtilities.docReady( f => {
        displayTextTemplate = Handlebars.compile( document.querySelector( '#displayTextTemplate' ).innerHTML );
        timerTemplate = Handlebars.compile( document.querySelector( '#timerTemplate' ).innerHTML );
        timerIconTemplate = Handlebars.compile( document.querySelector( '#timerIconTemplate' ).innerHTML );
        fctTemplate = Handlebars.compile( document.querySelector( '#fctTemplate' ).innerHTML );
        fctCriticalTemplate = Handlebars.compile( document.querySelector( '#fctCriticalTemplate' ).innerHTML );
        targetGroupTemplate = Handlebars.compile( document.querySelector( '#targetGroupTemplate' ).innerHTML );
        targetGroupTimerTemplate = Handlebars.compile( document.querySelector( '#targetGroupTimerTemplate' ).innerHTML );
    } );

    ipcRenderer.on( 'overlay:receive:component',
        /**
         * Handles receiving a new trigger action.
         * @param {*} event The event object.
         * @param {OverlayComponent} model The trigger action.
         */
        function ( event, model ) {
            model.added = new Date();
            render( model );
        } );

    ipcRenderer.on( 'overlay:window:enable-edit', function ( event ) {
        document.querySelector( 'section.body' ).classList.add( 'drag' );
        document.querySelector( 'body' ).classList.add( 'show-border' );
    } );

    ipcRenderer.on( 'overlay:window:disable-edit', function ( event ) {
        document.querySelector( 'section.body' ).classList.remove( 'drag' );
        document.querySelector( 'body' ).classList.remove( 'show-border' );
    } );

    ipcRenderer.on( 'overlay:window:highlight', function ( event ) {
        document.querySelector( 'body' ).classList.add( 'highlight-border' );
    } );

    ipcRenderer.on( 'overlay:window:dim', function ( event ) {
        document.querySelector( 'body' ).classList.remove( 'highlight-border' );
    } );

    ipcRenderer.on( 'component:destroy', function ( event, instanceId ) {
        
        if ( groupByTarget ) {
            for ( let key in overlayGroups ) {
                if ( overlayGroups.hasOwnProperty( key ) ) {
                    
                    let i = _.findIndex( overlayGroups[ key ].components, comp => comp.instanceId === instanceId );
                    if ( i > -1 ) {
                        let comp = overlayGroups[ key ].components[ i ];
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
            let i = _.findIndex( overlayComponents, comp => comp.instanceId === instanceId );
            if ( i > -1 ) {
                let timerType = overlayComponents[ i ].action.actionType === ActionTypes.BeneficialTimer || overlayComponents[ i ].action.actionType === ActionTypes.Countdown || overlayComponents[ i ].action.actionType === ActionTypes.Timer;
                let endNaturally = timerType === true && ( overlayComponents[ i ].action.remainAfterEnded || overlayComponents[ i ].action.notifyWhenEnded );

                if ( endNaturally ) {
                    overlayComponents[ i ].start = new Date( new Date().getTime() - overlayComponents[ i ].action.duration * 1000 );
                } else {
                    overlayComponents[ i ].removeComponent();
                }
            }
        }

    } );

    ipcRenderer.on( 'overlay:window:model',
        /**
         * Changes the window properties based on the given model.
         * @param {any} event The event object.
         * @param {OverlayWindow} model The overlay window model.
         */
        function ( event, model ) {
            
            document.querySelector( '#overlay-title' ).textContent = model.name ? model.name : 'Overlay';
            let contentArea = document.querySelector( '.content-area' );

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

            width = contentArea.clientWidth;
            height = contentArea.clientHeight;
            fontSize = model.fontSize;
            sortDirection = model.timerSortType;

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
            dotTextHeight = pDot.clientHeight;
            contentArea.style.paddingLeft = `${dotTextHeight + 2}px`;
            contentArea.removeChild( pDot );

            // Update any active elements
            document.querySelectorAll( '.content-area .dot-icon' ).forEach( icon => {
                icon.style.marginLeft = `-${dotTextHeight + 2}px`;
                icon.style.height = `${dotTextHeight}px`;
            } );

            showDuration = model.showTimeRemaining === true;

            if ( model.groupByTarget ) {
                contentArea.classList.add( 'grouped-mobs' );
                groupByTarget = true;
            } else {
                contentArea.classList.remove( 'grouped-mobs' );
                groupByTarget = false;
            }

            groupHeaderSize = model.groupHeaderSize > 0 ? model.groupHeaderSize : 12;
            groupHeaderColor = !StringUtilities.isNullOrWhitespace( model.groupHeaderColor ) ? model.groupHeaderColor : '#ffffff';
            groupHeaderWeight = model.groupHeaderWeight > 0 ? model.groupHeaderWeight : 400;

            hideTargetLabel = model.hideTargetLabel;

            for ( let key in overlayGroups ) {
                if ( overlayGroups.hasOwnProperty( key ) ) {
                    
                    let h6 = overlayGroups[ key ].dom.querySelector( 'h6' );

                    h6.style.fontSize = `${groupHeaderSize}px`;
                    h6.style.color = groupHeaderColor;
                    h6.style.fontWeight = groupHeaderWeight;

                    if ( hideTargetLabel ) {
                        h6.style.display = 'none';
                    } else {
                        delete h6.style.display;
                    }
                }
            }
            
        } );

    speechSynthesis.onvoiceschanged = () => {
        voiceOptions = speechSynthesis.getVoices();
    };
}










/**
 * Renders the overlayComponents to the overlay window.
 * 
 * @param {OverlayComponent} comp Tells the renderer to forcefully redraw the overlayComponents.
 */
function render( comp ) {
    let contentArea = document.querySelector( '.content-area' );
    let now = new Date();
    if ( comp.action.actionType === ActionTypes.DisplayText ) {
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
            ArrayUtilities.remove( overlayComponents, f => f.instanceId == comp.instanceId );
        }, comp.action.duration * 1000 );
        overlayComponents.push( comp );

    } else if ( comp.action.actionType === ActionTypes.Timer
        || comp.action.actionType === ActionTypes.Countdown
        || comp.action.actionType === ActionTypes.DotTimer
        || comp.action.actionType === ActionTypes.BeneficialTimer ) {
        
        if ( restartTimerComponent( comp ) ) {
            return;
        }
        
        if ( groupByTarget ) {
            
            /** @type {TimerGroup} */
            let group;
            
            if ( comp.action.actionType === ActionTypes.DotTimer || comp.action.actionType === ActionTypes.BeneficialTimer ) {
                group = getTimerGroup( contentArea, comp.matches.groups.target );
            
                createGroupedDotTimer( contentArea, group, comp );

            } else {
                group = getTimerGroup( contentArea, 'General' );
                
                createGroupedTimer( contentArea, group, comp );
                
            }
            
            sortGroupComponents( group );
            group.updateVisibility();
            
        } else {

            if ( comp.action.actionType === ActionTypes.DotTimer || comp.action.actionType === ActionTypes.BeneficialTimer ) {
                createUngroupedDotTimer( contentArea, comp );
            } else {
                createUngroupedTimer( contentArea, comp );
            }
            
            sortOverlayComponents();
            
        }
    }
}










/**
 * Sorts the overlay components according to the user specified sort direction.
 */
function sortOverlayComponents() {
    // If the user has specified a sort direction.
    if ( sortDirection > 0 ) {
        // Every time a new timer is added, reorganize the timers so that the 
        // timer ending first will appear in the order in which the user has
        // specified.

        let dir = sortDirection === TimerSortTypes.Ascending ? -1 : 1;
        let sorted = _.sortBy( overlayComponents, [ c => dir * c.timeRemaining ] );
        for ( let i = 0; i < sorted.length; i++ ) {
            sorted[ i ].dom.parentNode.prepend( sorted[ i ].dom );
        }

    }
}










/**
 * Sorts the given timer group's overlay components according to the user 
 * specified sort direction.
 * 
 * @param {TimerGroup} group The overlay component group.
 */
function sortGroupComponents( group ) {
    // If the user has specified a sort direction.
    if ( sortDirection > 0 ) {
        // Every time a new timer is added, reorganize the timers so that the 
        // timer ending first will appear in the order in which the user has
        // specified.

        let dir = sortDirection === TimerSortTypes.Ascending ? -1 : 1;
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
 * @param {OverlayComponent} comp The overlay component of the timer.
 */
function getTimerLabel( comp ) {
    let label = '';

    if ( comp.action.actionType === ActionTypes.Timer || comp.action.actionType === ActionTypes.Countdown ) {
        label = comp.action.displayText || comp.triggerName;
    } else if ( comp.action.actionType === ActionTypes.DotTimer || comp.action.actionType === ActionTypes.BeneficialTimer ) {
        if ( groupByTarget || hideTargetLabel ) {
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
 * @param {Node} contentArea The content area for dot timers.
 * @param {{dom: HTMLDivElement, components: OverlayComponent[]}} group The component group.
 * @param {OverlayComponent} comp The overlay component.
 */
function createGroupedDotTimer( contentArea, group, comp ) {
    let displayText = getTimerLabel( comp );
    let content = targetGroupTimerTemplate( { value: displayText } );

    let div = document.createElement( 'div' );
    div.innerHTML = content;
    comp.dom = div;
    
    if ( comp.action.timerIcon != null ) {
        div.innerHTML = timerIconTemplate( { icon: comp.action.timerIcon, iconStyle: `"style="position: absolute; margin-left: -${dotTextHeight + 2}px;  height: ${dotTextHeight}px;` } ) + div.innerHTML;
    }

    comp.dom = div;
    comp.description = displayText;

    // Create a method that will remove the component from the screen.
    let groupKey = group.name;
    comp.removeComponent = () => {
        comp.dom.parentNode && comp.dom.parentNode.removeChild( comp.dom );
        window.clearInterval( comp.intervalId );
        ArrayUtilities.remove( overlayGroups[ groupKey ].components, f => f.instanceId == comp.instanceId );

        window.setTimeout( () => {
            // We delay execution of this code and move it to the end of the stack 
            // because other overlay components may be added to this group.
            if ( overlayGroups[ groupKey ].components?.length === 0 ) {
                overlayGroups[ groupKey ].dom.parentNode && overlayGroups[ groupKey ].dom.parentNode.removeChild( overlayGroups[ groupKey ].dom );
                delete overlayGroups[ groupKey ];
            }
        } );
    };
    
    applyTimerSettings( contentArea, comp, group );

    group.dom.appendChild( comp.dom );
    group.components.push( comp );

}










/**
 * Creates a new grouped timer component.
 * 
 * @param {Node} contentArea The content area for dot timers.
 * @param {{dom: HTMLDivElement, components: OverlayComponent[]}} group The component group.
 * @param {OverlayComponent} comp The overlay component.
 */
function createGroupedTimer( contentArea, group, comp ) {
    let displayText = getTimerLabel( comp );
    let content = targetGroupTimerTemplate( { value: displayText } );

    let div = document.createElement( 'div' );
    div.innerHTML = content;
    comp.dom = div;
    
    if ( comp.action.timerIcon != null ) {
        div.innerHTML = timerIconTemplate( { icon: comp.action.timerIcon, iconStyle: `"style="position: absolute; margin-left: -${dotTextHeight + 2}px;  height: ${dotTextHeight}px;` } ) + div.innerHTML;
    }

    comp.dom = div;
    comp.description = displayText;

    // Create a method that will remove the component from the screen.
    let groupKey = group.name;
    comp.removeComponent = () => {
        comp.dom.parentNode && comp.dom.parentNode.removeChild( comp.dom );
        window.clearInterval( comp.intervalId );
        ArrayUtilities.remove( overlayGroups[ groupKey ]?.components, f => f.instanceId == comp.instanceId );

        window.setTimeout( () => {
            // We delay execution of this code and move it to the end of the stack 
            // because other overlay components may be added to this group.
            if ( overlayGroups[ groupKey ]?.components?.length === 0 ) {
                overlayGroups[ groupKey ].dom.parentNode && overlayGroups[ groupKey ].dom.parentNode.removeChild( overlayGroups[ groupKey ].dom );
                delete overlayGroups[ groupKey ];
            }
        } );
    };
    
    applyTimerSettings( contentArea, comp, group );

    group.dom.appendChild( comp.dom );
    group.components.push( comp );

}










/**
 * Returns the group for the specified name.  If the group is not found, 
 * then a new group is created.
 * 
 * @param {Node} contentArea The content area for timers.
 * @param {string} groupName The name of the desired group.
 */
function getTimerGroup( contentArea, groupName ) {

    for ( let key in overlayGroups ) {
        if ( key === groupName && overlayGroups.hasOwnProperty( key ) ) {
            return overlayGroups[ key ];
        }
    }

    let content = targetGroupTemplate( { name: groupName } );
    let div = document.createElement( 'div' );
    div.classList.add( 'mob-dot-group' );
    div.innerHTML = content;
    let h6 = div.querySelector( 'h6' );

    h6.style.fontSize = `${groupHeaderSize}px`;
    h6.style.color = groupHeaderColor;
    h6.style.fontWeight = groupHeaderWeight;
    let h6BorderColor = '#000000'
    h6.style.textShadow = `0px 0px 1px ${h6BorderColor}, -1px -1px 0 ${h6BorderColor}, 1px -1px 0 ${h6BorderColor}, -1px 1px 0 ${h6BorderColor}, 1px 1px 0 ${h6BorderColor}`;

    if ( hideTargetLabel ) {
        h6.style.display = 'none';
    } else {
        delete h6.style.display;
    }

    contentArea.appendChild( div );

    overlayGroups[ groupName ] = {
        visible: true,
        name: groupName,
        dom: div,
        components: [],
        updateVisibility: () => {
            let g = overlayGroups[ groupName ];

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
    return overlayGroups[ groupName ];
}










/**
 * Creates a new dot timer and places it in the content area.
 * 
 * @param {Node} contentArea The content area for dot timers.
 * @param {OverlayComponent} comp The dot timer component.
 */
function createUngroupedDotTimer( contentArea, comp ) {
    let displayText = getTimerLabel( comp );
    let content = timerTemplate( { value: displayText } );

    // Create the component's dom element and append it to the content area.
    let div = document.createElement( 'div' );
    div.innerHTML = content;
    
    if ( comp.action.timerIcon != null ) {
        div.innerHTML = timerIconTemplate( { icon: comp.action.timerIcon, iconStyle: `"style="position: absolute; margin-left: -${dotTextHeight + 2}px;  height: ${dotTextHeight}px;` } ) + div.innerHTML;
    }

    comp.dom = div;
    comp.description = displayText;

    // Create a method that will remove the component from the screen.
    comp.removeComponent = () => {
        comp.dom.parentNode && comp.dom.parentNode.removeChild( comp.dom );
        window.clearInterval( comp.intervalId );
        ArrayUtilities.remove( overlayComponents, f => f.instanceId == comp.instanceId );
    };
    
    applyTimerSettings( contentArea, comp );
    
    contentArea.appendChild( comp.dom );
    overlayComponents.push( comp );

}










/**
 * Creates a new timer and places it in the content area.
 * 
 * @param {Node} contentArea The content area for dot timers.
 * @param {OverlayComponent} comp The dot timer component.
 */
function createUngroupedTimer( contentArea, comp ) {
    let displayText = getTimerLabel( comp );
    let content = timerTemplate( { value: displayText } );

    // Create the component's dom element and append it to the content area.
    let div = document.createElement( 'div' );
    div.innerHTML = content;
    
    if ( comp.action.timerIcon != null ) {
        div.innerHTML = timerIconTemplate( { icon: comp.action.timerIcon, iconStyle: `"style="position: absolute; margin-left: -${dotTextHeight + 2}px;  height: ${dotTextHeight}px;` } ) + div.innerHTML;
    }

    comp.dom = div;
    comp.description = displayText;

    // Create a method that will remove the component from the screen.
    comp.removeComponent = () => {
        comp.dom.parentNode && comp.dom.parentNode.removeChild( comp.dom );
        window.clearInterval( comp.intervalId );
        ArrayUtilities.remove( overlayComponents, f => f.instanceId == comp.instanceId );
    };
    
    applyTimerSettings( contentArea, comp );
    
    contentArea.appendChild( comp.dom );
    overlayComponents.push( comp );

}










/**
 * Applies the general timer settings to the given component.
 * 
 * @param {Node} contentArea The content area for timers.
 * @param {OverlayComponent} comp Applies the general timer settings to the given timer component.
 * @param {TimerGroup} group The containing group, if available.
 */
function applyTimerSettings( contentArea, comp, group ) {
    // Apply the styles required to make the progress bar height match the 
    // specified number in the overlay settings.
    comp.dom.querySelector( '.progress' ).style.marginBottom = contentArea.style.lineHeight;
    if ( comp.action.overrideTimerColor ) {
        comp.dom.querySelector( '.determinate' ).style.backgroundColor = comp.action.overrideTimerColor;
        comp.dom.querySelector( '.progress' ).style.backgroundColor = comp.action.timerBackgroundColor;
    }

    if ( showDuration || comp.action.showDuration ) {
        comp.dom.querySelector( 'span.time-remaining' ).innerHTML = `(${comp.action.duration})&nbsp;`;
    } else {
        comp.dom.querySelector( 'span.time-remaining' ).innerHTML = ``;
    }

    // Set the starting conditions for the timer.
    comp.start = comp.timestamp;
    comp.timeRemaining = comp.action.duration;

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
        let perc = ( Math.abs( ( new Date() ) - comp.start ) / 1000 ) / comp.action.duration;

        comp.timeRemaining = comp.action.duration - ( comp.action.duration * perc );

        if ( comp.action.actionType === ActionTypes.Countdown || comp.action.actionType === ActionTypes.BeneficialTimer ) {
            comp.dom.querySelector( 'div.determinate' ).style.width = `${100 - ( perc * 100 )}%`;
        } else {
            comp.dom.querySelector( 'div.determinate' ).style.width = `${perc * 100}%`;
        }

        if ( showDuration || comp.action.showDuration ) {
            comp.dom.querySelector( 'span.time-remaining' ).innerHTML = `(${DateUtilities.getDurationLabel( comp.timeRemaining )})&nbsp;`;
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
                if ( groupByTarget && group ) {
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

        }
        
        if ( comp.timeRemaining <= 0 && !comp.action.repeatTimer && ( comp.action.remainAfterEnded || comp.action.notifyWhenEnded ) ) {
            // If the timer has ended, but is required to remain for a 
            // duration, apply the ended conditions to the timer.

            if ( comp.action.endedChangeColor ) {
                comp.dom.querySelector( 'div.determinate' ).style.backgroundColor = comp.action.endedColor;
                comp.dom.querySelector( 'div.progress' ).style.backgroundColor = comp.action.endedBackgroundColor;
            }

            if ( comp.hidden && comp.action.remainAfterEnded ) {
                comp.hidden = false;
                comp.dom.style.display = null;
                if ( groupByTarget && group ) {
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

        if ( ( comp.timeRemaining <= 0 && !comp.action.remainAfterEnded && !comp.action.repeatTimer ) || ( comp.timeRemaining <= -1 * comp.action.remainDuration && !comp.action.repeatTimer ) ) {
            // When conditions met that require the timer be removed from the 
            // screen, then call the remove comonponent method.
            
            delayRemoveComponent( comp );

        } else if ( comp.timeRemaining <= 0 && comp.action.repeatTimer ) {
            
            comp.repeatCount = comp.repeatCount > 0 ? comp.repeatCount + 1 : 1;
            
            if ( comp.action.repeatCount == null || comp.repeatCount <= comp.action.repeatCount ) {
                comp = resetTimerComponentClock( comp, comp.repeatCount );
            } else {
                delayRemoveComponent( comp );
            }
        }

    }, 250 );
}










/**
 * Removes the given component after the specified number of milliseconds have 
 * passed.
 * 
 * @param {OverlayComponent} comp The component to remove.
 * @param {number} delay The number of milliseconds to delay removal.
 */
function delayRemoveComponent( comp, delay ) {

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
 * @param {OverlayComponent} comp The overlay component to reset the clock.
 */
function resetTimerComponentClock(comp, repeatCount) {
    
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

    // Reset the background color
    if ( comp.action.overrideTimerColor ) {
        comp.dom.querySelector( '.determinate' ).style.backgroundColor = comp.action.overrideTimerColor;
        comp.dom.querySelector( '.progress' ).style.backgroundColor = comp.action.timerBackgroundColor;
    } else {
        comp.dom.querySelector( '.determinate' ).style.backgroundColor = '#008000';
        comp.dom.querySelector( '.progress' ).style.backgroundColor = 'rgba(0,33,0,.75)';
    }

    return comp;
}










/**
 * Restarts a named timer component.  Using this method, only the description/text of the timer is considered when restarting.
 * 
 * @returns {boolean} Returns true if the given component should not be created.
 * 
 * @param {OverlayComponent} comp The overlay component to restart.
 */
function restartTimerComponent( comp ) {

    if ( comp.action.restartBehavior === TimerRestartBehaviors.RestartOnDuplicate ) {
        
        if ( comp.action.actionType === ActionTypes.BeneficialTimer || comp.action.actionType === ActionTypes.DotTimer ) {
            destroyComponents( c => c.action.actionId == comp.action.actionId && c.matches.groups.target === comp.matches.groups.target );

        } else if ( comp.action.actionType === ActionTypes.Timer || comp.action.actionType === ActionTypes.Countdown ) {
            // If a timer's displayText property was not supplied by the user, 
            // then the description (which is the text that is rendered on the 
            // progress bar) of a timer is set to the trigger's name.  If the 
            // parameter component's display text is null, it would then match 
            // the description (Trigger's Name, by default) of the same action 
            // id.
            destroyComponents( c => c.action.actionId == comp.action.actionId && ( comp.action.displayText == null || c.description === comp.action.displayText ) );
            
        }

    } else if ( comp.action.restartBehavior === TimerRestartBehaviors.RestartTimer ) {
        destroyComponents( c => c.action.actionId == comp.action.actionId );
        
    } else if ( comp.action.restartBehavior === TimerRestartBehaviors.DoNothing ) {
        // I realize this is bad practice, I'm tired, it's late, and it's documented.
        return true;
    }

    return false;
}










/**
 * Finds all overlay components of the specified action.
 * 
 * @returns {OverlayComponent[]}
 * 
 * @param {(component: OverlayComponent) => boolean} predicate Invoked per iteration, if true the component is included in the results.
 */
function findComponents( predicate ) {
    let ocs = [];

    if ( groupByTarget ) {

        for ( let key of Object.keys( overlayGroups ) ) {
            overlayGroups[ key ].components?.forEach( c => {
                if ( predicate( c ) ) {
                    ocs.push( c );
                }
            } );
        }

    } else {

        overlayComponents?.forEach( c => {
            if ( predicate( c ) ) {
                ocs.push( c );
            }
        } );

    }

    return ocs;
}










/**
 * Destroys all overlay components predicate returns truthy for.
 * 
 * @param {(component: OverlayComponent) => boolean} predicate Executed per iteration, passing in the overlay component as the first argument.
 */
function destroyComponents( predicate ) {
    let ocs = [];

    if ( groupByTarget ) {

        for ( let key of Object.keys( overlayGroups ) ) {
            overlayGroups[ key ].components?.forEach( c => {
                if ( predicate( c ) ) {
                    ocs.push( c );
                }
            } );
        }

    } else {

        overlayComponents?.forEach( c => {
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
 * Restarts the given overlay component.
 * 
 * @param {OverlayComponent} oldComp The overlay component to restart.
 * @param {OverlayComponent} newComp The new overlay component.
 */
function _restartTimerComponent( oldComp, newComp ) {

    // Tell log watchers to remove any hooks they have for the old component.
    ipcRenderer.send( 'log:destroy:component', oldComp.instanceId );

    // Reset the start duration
    oldComp.start = newComp.timestamp;
    oldComp.timeRemaining = newComp.action.duration;

    // Reset the ending conditions
    oldComp.endingSoonSpoken = false;
    oldComp.endingSoonTextDisplayed = false;
    oldComp.endedSpoken = false;
    oldComp.endedTextDisplayed = false;
    oldComp.instanceId = newComp.instanceId;

    // Reset the background color
    if ( oldComp.action.overrideTimerColor ) {
        oldComp.dom.querySelector( '.determinate' ).style.backgroundColor = oldComp.action.overrideTimerColor;
        oldComp.dom.querySelector( '.progress' ).style.backgroundColor = oldComp.action.timerBackgroundColor;
    } else {
        oldComp.dom.querySelector( '.determinate' ).style.backgroundColor = '#008000';
        oldComp.dom.querySelector( '.progress' ).style.backgroundColor = 'rgba(0,33,0,.75)';
    }

    return true;
}










/**
 * Returns a hex number for the given value.
 * 
 * @param {number} c The value to convert.
 */
function componentToHex( c ) {
    var hex = Math.round(c).toString( 16 );
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

    ipcRenderer.send( 'overlay:send:component', comp );
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

module.exports = Overlay;
