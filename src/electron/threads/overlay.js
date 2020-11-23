const DomUtilities = require( '../utilities/dom' );
const StringUtilities = require( '../utilities/string' );
const NumberUtilities = require( '../utilities/numbers' );
const ArrayUtilities = require( '../utilities/arrays' );
const { OverlayWindow, OverlayComponent, TimerSortTypes } = require( '../data/models/overlay-window' );
const { ActionTypes, TriggerAction } = require( '../data/models/trigger' );
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


/** @type {OverlayComponent[]} */
var overlayComponents = [];
var displayTextTemplate;
var dotTimerTemplate;
var dotTimerIconTemplate;
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

function Overlay() {

    DomUtilities.docReady( f => {
        displayTextTemplate = Handlebars.compile( document.querySelector( '#displayTextTemplate' ).innerHTML );
        dotTimerTemplate = Handlebars.compile( document.querySelector( '#dotTimerTemplate' ).innerHTML );
        dotTimerIconTemplate = Handlebars.compile( document.querySelector( '#dotTimerIconTemplate' ).innerHTML );
        fctTemplate = Handlebars.compile( document.querySelector( '#fctTemplate' ).innerHTML );
        fctCriticalTemplate = Handlebars.compile( document.querySelector( '#fctCriticalTemplate' ).innerHTML );
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
            console.log( 'dot text height', dotTextHeight );
            contentArea.style.paddingLeft = `${dotTextHeight + 2}px`;
            contentArea.removeChild( pDot );

            // Update any active elements
            document.querySelectorAll( '.content-area .dot-icon' ).forEach( icon => {
                icon.style.marginLeft = `-${dotTextHeight + 2}px`;
                icon.style.height = `${dotTextHeight}px`;
            } );

            showRemainingDuration = model.showTimeRemaining === true;
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

    } if ( comp.action.actionType === ActionTypes.DotTimer ) {
        // comp.action.duration *= 50;
        let displayText = StringUtilities.format( comp.action.displayText, comp.matches );
        let content;// = dotTimerTemplate( { value: displayText } );

        if ( comp.action.timerIcon != null ) {
            content = dotTimerIconTemplate( { value: displayText, icon: comp.action.timerIcon, iconStyle: `"style="position: absolute; margin-left: -${dotTextHeight + 2}px;  height: ${dotTextHeight}px;` } );
        } else {
            content = dotTimerTemplate( { value: displayText } );
        }

        if ( comp.action.restartOnDuplicate === true ) {
            // If this component needs to restart on duplicate names, then find the index of the first match, and if found reset the start.
            let index = ArrayUtilities.findIndex( overlayComponents, f => f?.description == displayText );
            if ( index > -1 ) {
                // Reset the start duration
                overlayComponents[ index ].start = comp.timestamp;

                // Reset the ending conditions
                overlayComponents[ index ].endingSoonSpoken = false;
                overlayComponents[ index ].endingSoonTextDisplayed = false;
                overlayComponents[ index ].endedSpoken = false;
                overlayComponents[ index ].endedTextDisplayed = false;

                // Reset the background color
                if ( overlayComponents[ index ].action.overrideTimerColor ) {
                    overlayComponents[ index ].dom.querySelector( '.determinate' ).style.backgroundColor = overlayComponents[ index ].action.overrideTimerColor;
                    overlayComponents[ index ].dom.querySelector( '.progress' ).style.backgroundColor = overlayComponents[ index ].action.timerBackgroundColor;
                } else {
                    overlayComponents[ index ].dom.querySelector( '.determinate' ).style.backgroundColor = '#008000';
                    overlayComponents[ index ].dom.querySelector( '.progress' ).style.backgroundColor = 'rgba(0,33,0,.75)';
                }
                return;
            }
        }

        let div = document.createElement( 'div' );
        div.innerHTML = content;
        comp.dom = div;
        contentArea.appendChild( comp.dom );
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
        comp.start = comp.timestamp;
        comp.description = displayText;
        comp.timeRemaining = comp.action.duration;
        comp.intervalId = window.setInterval( () => {
            let perc = ( Math.abs( ( new Date() ) - comp.start ) / 1000 ) / comp.action.duration;

            comp.timeRemaining = comp.action.duration - ( comp.action.duration * perc );

            comp.dom.querySelector( 'div.determinate' ).style.width = `${perc * 100}%`;

            if ( showRemainingDuration || comp.action.showRemainingDuration ) {
                comp.dom.querySelector( 'span.time-remaining' ).innerHTML = `(${Math.ceil( comp.timeRemaining )})&nbsp;`;
            } else {
                comp.dom.querySelector( 'span.time-remaining' ).innerHTML = ``;
            }

            if ( comp.action.ifEndingSoon && comp.action.endingDuration > 0 && comp.timeRemaining > 0 && comp.timeRemaining <= comp.action.endingDuration ) {
                if ( comp.action.endingSoonChangeColor ) {
                    comp.dom.querySelector( 'div.determinate' ).style.backgroundColor = comp.action.endingSoonColor;
                    comp.dom.querySelector( 'div.progress' ).style.backgroundColor = comp.action.endingSoonBackgroundColor;
                }

                if ( !comp.endingSoonSpoken && comp.action.endingSoonSpeak ) {
                    comp.endingSoonSpoken = true;
                    speakPhrase( comp.voiceIndex, comp.action.endingSoonSpeakPhrase );
                }

                if ( !comp.endingSoonTextDisplayed && comp.action.endingSoonDisplayText ) {
                    comp.endingSoonTextDisplayed = true;
                    sendDisplayTextToOverlay( comp.action.endingSoonTextOverlayId, comp.action.endingSoonText, comp.action.endingSoonTextDuration );
                }

            }
            
            if ( ( comp.timeRemaining <= 0 && !comp.action.remainAfterEnded ) || ( comp.timeRemaining <= -1 * comp.action.remainDuration ) ) {
                window.setTimeout( () => {
                    comp.dom.parentNode && comp.dom.parentNode.removeChild( comp.dom );
                    window.clearInterval( comp.intervalId );
                    ArrayUtilities.remove( overlayComponents, f => f.instanceId == comp.instanceId );
                }, 1000 );
            } else if ( comp.timeRemaining <= 0 && comp.action.remainAfterEnded ) {

                if ( comp.action.endedChangeColor ) {
                    comp.dom.querySelector( 'div.determinate' ).style.backgroundColor = comp.action.endedColor;
                    comp.dom.querySelector( 'div.progress' ).style.backgroundColor = comp.action.endedBackgroundColor;
                }

                if ( !comp.endedSpoken && comp.action.endedSpeak ) {
                    comp.endedSpoken = true;
                    speakPhrase( comp.voiceIndex, comp.action.endedSpeakPhrase );
                }

                if ( !comp.endedTextDisplayed && comp.action.endedDisplayText ) {
                    comp.endedTextDisplayed = true;
                    sendDisplayTextToOverlay( comp.action.endedTextOverlayId, comp.action.endedText, comp.action.endedTextDuration );
                }
            }

        }, 250 );
        overlayComponents.push( comp );
        
        if ( sortDirection > 0 ) {
            let dir = sortDirection === TimerSortTypes.Ascending ? -1 : 1;
            let sorted = _.sortBy( overlayComponents, [ c => dir * c.timeRemaining ] );
            for ( let i = 0; i < sorted.length; i++ ) {
                sorted[ i ].dom.parentNode.prepend( sorted[ i ].dom );
            }
        }
    }
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

function speakPhrase( voiceIndex, phrase ) {
    var utter = new SpeechSynthesisUtterance();

    utter.text = phrase;
    utter.voice = voiceOptions[ voiceIndex ];
    utter.onend = function ( event ) { }
    speechSynthesis.speak( utter );
}

module.exports = Overlay;
