const DomUtilities = require( '../utilities/dom' );
const StringUtilities = require( '../utilities/string' );
const NumberUtilities = require( '../utilities/numbers' );
const ArrayUtilities = require( '../utilities/arrays' );
const { OverlayWindow, OverlayComponent, TimerSortTypes } = require( '../data/models/overlay-window' );
const { ActionTypes, TriggerAction, TriggerConditionTypes, OperatorTypes } = require( '../data/models/trigger' );
const { ipcRenderer } = require( 'electron' );
const Handlebars = require( "handlebars" );
const _ = require( 'lodash' );
const customAlphabet = require( 'nanoid' ).customAlphabet;
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const nanoid = customAlphabet( alphabet, 16 );


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
var showRemainingDuration = false;
var groupByTarget = false;
var groupHeaderSize = 12;
var groupHeaderColor = '#ffffff';
var groupHeaderWeight = 400;
var hideTargetLabel = false;










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
                        
                        if ( comp.action.actionType === ActionTypes.BeneficialTimer && ( comp.action.remainAfterEnded || comp.action.notifyWhenEnded ) ) {
                            comp.start = new Date( new Date().getTime() - comp.action.duration * 1000 );
                        } else {
                            comp.removeComponent();
                        }

                    }
                    
                }
            }
            
        } else {
            let i = _.findIndex( overlayComponents, comp => comp.instanceId === instanceId );
            if ( overlayComponents[ i ].action.actionType === ActionTypes.BeneficialTimer && ( overlayComponents[ i ].action.remainAfterEnded || overlayComponents[ i ].action.notifyWhenEnded ) ) {
                overlayComponents[ i ].start = new Date( new Date().getTime() - overlayComponents[ i ].action.duration * 1000 );
            } else {
                overlayComponents[ i ].removeComponent();
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
            contentArea.style.fontFamily = `"${model.fontFamily}"`;
            contentArea.style.fontSize = `${model.fontSize}px`;
            contentArea.style.lineHeight = `${( model.lineHeight > 10 ? model.lineHeight : 90 ) / 100}em`;
            contentArea.style.fontWeight = model.fontWeight > 0 ? model.fontWeight : 300;

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

            showRemainingDuration = model.showTimeRemaining === true;

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
        comp.dom = div;
        contentArea.appendChild( comp.dom );
        comp.intervalId = window.setTimeout( () => {
            comp.dom.parentNode.removeChild( comp.dom );
            ArrayUtilities.remove( overlayComponents, f => f.instanceId == comp.instanceId );
        }, comp.action.duration * 1000 );
        overlayComponents.push( comp );

    } else if ( comp.action.actionType === ActionTypes.Timer || comp.action.actionType === ActionTypes.Countdown ) {
        if ( groupByTarget ) {
            let group = getTimerGroup( contentArea, 'General' );

            if ( comp.action.restartOnDuplicate === true && restartTimerComponent( comp, comp.triggerName, group.components ) ) {
                // Do nothing
            } else {
                createGroupedTimer( contentArea, group, comp );
            }

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
            
            group.updateVisibility();

        } else {

            if ( comp.action.restartOnDuplicate === true && restartTimerComponent( comp, comp.action.displayText, overlayComponents ) ) {
                // Do nothing
            } else {
                createUngroupedTimer( contentArea, comp );
            }

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
    } else if ( comp.action.actionType === ActionTypes.DotTimer || comp.action.actionType === ActionTypes.BeneficialTimer ) {
        // comp.action.duration *= 50;

        if ( groupByTarget ) {
            let group = getTimerGroup( contentArea, comp.matches[ 1 ] );

            if ( comp.action.restartOnDuplicate === true && restartTimerComponent( comp, comp.triggerName, group.components ) ) {
                // Do nothing
            } else {
                createGroupedDotTimer( contentArea, group, comp );
            }

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

            group.updateVisibility();
            
        } else {
            let displayText = '';
            
            if ( hideTargetLabel ) {
                displayText = comp.triggerName;
            } else {
                displayText = StringUtilities.format( comp.action.displayText, comp.matches );
            }

            if ( comp.action.restartOnDuplicate === true && restartTimerComponent( comp, displayText, overlayComponents ) ) {
                // Do nothing
            } else {
                createUngroupedDotTimer( contentArea, comp, displayText );
            }

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

    }
}










/**
 * Creates a new grouped overlay component.
 * 
 * @param {Node} contentArea The content area for dot timers.
 * @param {{dom: HTMLDivElement, components: OverlayComponent[]}} group The component group.
 * @param {OverlayComponent} comp The overlay component.
 */
function createGroupedDotTimer( contentArea, group, comp ) {
    let content = targetGroupTimerTemplate( { value: comp.triggerName } );

    let div = document.createElement( 'div' );
    div.innerHTML = content;
    comp.dom = div;
    
    if ( comp.action.timerIcon != null ) {
        div.innerHTML = timerIconTemplate( { icon: comp.action.timerIcon, iconStyle: `"style="position: absolute; margin-left: -${dotTextHeight + 2}px;  height: ${dotTextHeight}px;` } ) + div.innerHTML;
    }

    comp.dom = div;
    comp.description = comp.triggerName;

    // Create a method that will remove the component from the screen.
    comp.removeComponent = () => {
        comp.dom.parentNode && comp.dom.parentNode.removeChild( comp.dom );
        window.clearInterval( comp.intervalId );
        ArrayUtilities.remove( group.components, f => f.instanceId == comp.instanceId );

        if ( group.components?.length === 0 ) {
            group.dom.parentNode && group.dom.parentNode.removeChild( group.dom );
            delete overlayGroups[ group.name ];
        }
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
    let content = targetGroupTimerTemplate( { value: comp.action.displayText || comp.triggerName } );

    let div = document.createElement( 'div' );
    div.innerHTML = content;
    comp.dom = div;
    
    if ( comp.action.timerIcon != null ) {
        div.innerHTML = timerIconTemplate( { icon: comp.action.timerIcon, iconStyle: `"style="position: absolute; margin-left: -${dotTextHeight + 2}px;  height: ${dotTextHeight}px;` } ) + div.innerHTML;
    }

    comp.dom = div;
    comp.description = comp.action.displayText || comp.triggerName;

    // Create a method that will remove the component from the screen.
    comp.removeComponent = () => {
        comp.dom.parentNode && comp.dom.parentNode.removeChild( comp.dom );
        window.clearInterval( comp.intervalId );
        ArrayUtilities.remove( group.components, f => f.instanceId == comp.instanceId );

        if ( group.components?.length === 0 ) {
            group.dom.parentNode && group.dom.parentNode.removeChild( group.dom );
            delete overlayGroups[ group.name ];
        }
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
 * @param {string} displayText The display text for the visible section of the dot timer.
 */
function createUngroupedDotTimer( contentArea, comp, displayText ) {
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
    let content = timerTemplate( { value: comp.action.displayText } );

    // Create the component's dom element and append it to the content area.
    let div = document.createElement( 'div' );
    div.innerHTML = content;
    
    if ( comp.action.timerIcon != null ) {
        div.innerHTML = timerIconTemplate( { icon: comp.action.timerIcon, iconStyle: `"style="position: absolute; margin-left: -${dotTextHeight + 2}px;  height: ${dotTextHeight}px;` } ) + div.innerHTML;
    }

    comp.dom = div;
    comp.description = comp.action.displayText;

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

    if ( showRemainingDuration || comp.action.showRemainingDuration ) {
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

    // Set the update method.
    comp.intervalId = window.setInterval( () => {
        let perc = ( Math.abs( ( new Date() ) - comp.start ) / 1000 ) / comp.action.duration;

        comp.timeRemaining = comp.action.duration - ( comp.action.duration * perc );

        if ( comp.action.actionType === ActionTypes.Countdown || comp.action.actionType === ActionTypes.BeneficialTimer ) {
            comp.dom.querySelector( 'div.determinate' ).style.width = `${100 - ( perc * 100 )}%`;
        } else {
            comp.dom.querySelector( 'div.determinate' ).style.width = `${perc * 100}%`;
        }

        if ( showRemainingDuration || comp.action.showRemainingDuration ) {
            comp.dom.querySelector( 'span.time-remaining' ).innerHTML = `(${getDurationLabel( comp.timeRemaining )})&nbsp;`;
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
    
    delay = delay > 0 ? delay : 1000;

    window.setTimeout( () => {
        comp.removeComponent();
        ipcRenderer.send( 'log:destroy:component', comp.instanceId );
    }, delay );

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
 * Restarts the given component, if found.
 * 
 * @returns {boolean} Returns true if the component was found and restarted.
 * 
 * @param {OverlayComponent} comp The overlay component to restart.
 * @param {string} displayText The matching display text.
 * @param {OverlayComponent[]} dictionary The dictionary that contains the desired component.
 */
function restartTimerComponent( comp, displayText, dictionary ) {
    // If this component needs to restart on duplicate names, then find the index of the first match, and if found reset the start.
    let index = ArrayUtilities.findIndex( dictionary, f => f?.description == displayText );
    if ( index > -1 ) {

        // Tell log watchers to remove any hooks they have for the old component.
        ipcRenderer.send( 'log:destroy:component', dictionary[ index ].instanceId );

        // dictionary[ index ] = resetTimerComponentClock( dictionary[ index ] );
        // Reset the start duration
        dictionary[ index ].start = comp.timestamp;
        // let perc = ( Math.abs( ( new Date() ) - dictionary[ index ].start ) / 1000 ) / comp.action.duration;

        // dictionary[ index ].timeRemaining = comp.action.duration - ( comp.action.duration * perc );
        dictionary[ index ].timeRemaining = comp.action.duration;

        // Reset the ending conditions
        dictionary[ index ].endingSoonSpoken = false;
        dictionary[ index ].endingSoonTextDisplayed = false;
        dictionary[ index ].endedSpoken = false;
        dictionary[ index ].endedTextDisplayed = false;
        dictionary[ index ].instanceId = comp.instanceId;

        // Reset the background color
        if ( dictionary[ index ].action.overrideTimerColor ) {
            dictionary[ index ].dom.querySelector( '.determinate' ).style.backgroundColor = dictionary[ index ].action.overrideTimerColor;
            dictionary[ index ].dom.querySelector( '.progress' ).style.backgroundColor = dictionary[ index ].action.timerBackgroundColor;
        } else {
            dictionary[ index ].dom.querySelector( '.determinate' ).style.backgroundColor = '#008000';
            dictionary[ index ].dom.querySelector( '.progress' ).style.backgroundColor = 'rgba(0,33,0,.75)';
        }

        return true;
    }

    return false;
}

function componentToHex( c ) {
    var hex = c.toString( 16 );
    return hex.length == 1 ? "0" + hex : hex;
}

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

function speakPhrase( phrase, interruptSpeech, parseResult, timerDuration ) {
    ipcRenderer.send( 'log:speak:phrase', { phrase: phrase, interruptSpeech: interruptSpeech, parseResult: parseResult, timerDuration: timerDuration } );
}

/**
 * Returns a label for the given duration.
 * 
 * @param {number} duration The duration, in seconds.
 */
function getDurationLabel( duration ) {
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

module.exports = Overlay;
