const DomUtilities = require( '../utilities/dom' );
const StringUtilities = require( '../utilities/string' );
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
// var renderInterval = -1;
// var renderFps = 10;
var displayTextTemplate;// = Handlebars.compile( document.querySelector( '#displayTextTemplate' ).innerHTML );

function Overlay() {

    DomUtilities.docReady( f => {
        // document.querySelector( '#header' ).textContent = 'Overlay LOADED';
        displayTextTemplate = Handlebars.compile( document.querySelector( '#displayTextTemplate' ).innerHTML );
        var selectElements = document.querySelectorAll('select');
        var instances = M.FormSelect.init( selectElements, {} );
        // renderInterval = window.setInterval( render, 1000 / renderFps );
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

        } );
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
        }, comp.action.duration * 1000 );
    }
    // // Remove expired components.
    // let count = overlayComponents.length;
    // let expiredIndices = [];
    // overlayComponents.forEach( ( comp, i ) => {
    //     if ( comp.removeAt <= now ) {
    //         expiredIndices.push( i );
    //     }
    // } );
    // for ( let i = expiredIndices.length - 1; i >= 0; i-- ) {
    //     overlayComponents.splice( i, 1 );
    // }

    // // If we're redrawing or components where removed.
    // if ( redraw || count != overlayComponents.length ) {
    //     let content = '';
    //     overlayComponents.forEach( comp => {
    //         if ( comp.action.actionType === ActionTypes.DisplayText ) {
    //             comp.removeAt = new Date( now.setSeconds( comp.action.duration ) );
    //             content += displayTextTemplate( { value: comp.action.displayText } );
    //         }
    //     } );
    //     contentArea.innerHTML = content;
    // }
}

function componentToHex( c ) {
    var hex = c.toString( 16 );
    return hex.length == 1 ? "0" + hex : hex;
}

module.exports = Overlay;
