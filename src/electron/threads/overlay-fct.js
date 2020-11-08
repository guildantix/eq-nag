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
var quadrants = [];
var criticals = [];
var criticalPadding = 300;

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
        document.querySelector( '.content-area' ).style.margin = null;
    } );

    ipcRenderer.on( 'overlay:window:disable-edit', function ( event ) {
        document.querySelector( 'section.body' ).classList.remove( 'drag' );
        document.querySelector( 'body' ).classList.remove( 'show-border' );
        document.querySelector( '.content-area' ).style.margin = `${criticalPadding}px`;
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
            contentArea.style.margin = `${criticalPadding}px`;

            width = contentArea.clientWidth;
            height = contentArea.clientHeight;
            fontSize = model.fontSize;

            quadrants = [];
            criticals = [];

            // we could calculate the specific size of critical fct, but it's 'good enough' to estimate.  A little overlapping is fine.
            let qw = fontSize / 2 * 4.6875 * 2;
            let qh = fontSize / 2 * 3.125 * 2;

            for ( let x = 0; x < Math.floor( width / qw ); x++ ) {
                quadrants[ x ] = [];
                criticals[ x ] = [];
                for ( let y = 0; y < Math.floor( height / qh ); y++ ) {
                    quadrants[ x ][ y ] = { x: x * qw, y: y * qh };
                    criticals[ x ][ y ] = false;
                }
            }

            console.log( 'quadrants', fontSize, qw, qh, quadrants );
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

        comp.pos = getRandomLocation();
        criticals[ comp.pos.x ][ comp.pos.y ] = true;
        div.style.left = `${quadrants[ comp.pos.x ][ comp.pos.y ].x + ( div.clientWidth / 2 )}px`;
        div.style.top = `${quadrants[ comp.pos.x ][ comp.pos.y ].y - ( div.clientHeight * 1.25 )}px`;
            
        comp.intervalId = window.setTimeout( () => {
            comp.dom.parentNode.removeChild( comp.dom );
            criticals[ comp.pos.x ][ comp.pos.y ] = false;
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

function getRandomLocation() {
    let c = getCompCount();
    let xs = Math.floor( c / criticals.length );
    let yx = Math.floor( c / criticals[ 0 ].length );
    let x = -1;
    let y = -1;

    let crazy = 0;
    while ( x === -1 && crazy < criticals.length * criticals[ 0 ].length ) {
        crazy++;

        let t = NumberUtilities.randomBounded( 0, criticals.length );
        if ( countCritX( t ) <= xs ) {
            x = t;
        }
    }

    if ( crazy === criticals.length * criticals[ 0 ].length ) {
        return { x: NumberUtilities.randomBounded( 0, criticals.length ), y: NumberUtilities.randomBounded( 0, criticals[ 0 ].length ) };
    }

    crazy = 0;
    while ( y === -1 && crazy < criticals[ x ].length ) {
        crazy++;

        let t = NumberUtilities.randomBounded( 0, criticals[ x ].length );
        if ( !criticals[ x ][ t ] ) {
            y = t;
        }
    }

    return { x: x, y: y };
}

function getCompCount() {
    let c = 0;
    for ( let x = 0; x < criticals.length; x++ ) {
        for ( let y = 0; y < criticals[ x ].length; y++ ) {
            c += criticals[ x ][ y ] === true ? 1 : 0;
        }
    }
    return c;
}

function countCritX( x ) {
    let c = 0;
    criticals[ x ].forEach( pos => c += pos ? 1 : 0 );
    return c;
}

function componentToHex( c ) {
    var hex = c.toString( 16 );
    return hex.length == 1 ? "0" + hex : hex;
}

module.exports = OverlayFct;
