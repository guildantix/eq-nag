const DomUtilities = require( '../utilities/dom' );
const StringUtilities = require( '../utilities/string' );
const NumberUtilities = require( '../utilities/numbers' );
const { OverlayWindow, OverlayComponent } = require( '../data/models/overlay-window' );
const { ActionTypes, TriggerAction } = require( '../data/models/trigger' );
const { ipcRenderer } = require( 'electron' );
const Handlebars = require("handlebars");

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
var fct = false;
const fctFps = 1000 / 60;
var fctRenderQueue = [];
var fctRenderInterval = 250;
var width = 1;
var height = 1;
var fontSize = 1;

function OverlayFct() {

    DomUtilities.docReady( f => {
        displayTextTemplate = Handlebars.compile( document.querySelector( '#displayTextTemplate' ).innerHTML );
        dotTimerTemplate = Handlebars.compile( document.querySelector( '#dotTimerTemplate' ).innerHTML );
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
            overlayComponents.push( model );
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

            contentArea.classList.add( 'fct-content' );

            width = contentArea.clientWidth;
            height = contentArea.clientHeight;
            fontSize = model.fontSize;

        } );
}

var lastFctWidth = 0;
var lastFctLeft = 0;
var fctWidth = 100;

/**
 * Renders the overlayComponents to the overlay window.
 * 
 * @param {OverlayComponent} comp Tells the renderer to forcefully redraw the overlayComponents.
 */
function render( comp ) {
    
    let contentArea = document.querySelector( '.content-area' );
    let div = document.createElement( 'div' );

    if ( comp.critical ) {
        let content = fctCriticalTemplate( { value: comp.text, damageSource: comp.attack } );
        div.innerHTML = content;

        div.classList.add( 'animate-fade-shrink' );

        comp.dom = div;
        contentArea.appendChild( div );

        div.style.left = NumberUtilities.randomBounded( fctWidth + ( div.clientWidth / 2 ), width - ( div.clientWidth * 1.5 ) ) + 'px';
        div.style.top = NumberUtilities.randomBounded( div.clientHeight / 2, height - ( div.clientHeight * 1.25 ) ) + 'px';
            
        comp.intervalId = window.setTimeout( () => {
            comp.dom.parentNode.removeChild( comp.dom );
        }, 4000 );

    } else {
        let content = fctTemplate( { value: comp.text, damageSource: comp.attack } );
        div.innerHTML = content;

        div.classList.add( 'animate-fade-out' );

        comp.dom = div;
        contentArea.appendChild( div );
        comp.intervalId = window.setTimeout( () => {
            comp.dom.parentNode.removeChild( comp.dom );
        }, 7000 );

    }
        
}

function componentToHex( c ) {
    var hex = c.toString( 16 );
    return hex.length == 1 ? "0" + hex : hex;
}

module.exports = OverlayFct;
