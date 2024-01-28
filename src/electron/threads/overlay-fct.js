const DomUtilities = require( '../utilities/dom' );
const StringUtilities = require( '../utilities/string' );
const NumberUtilities = require( '../utilities/numbers' );
const { OverlayWindow, OverlayComponent } = require( '../data/models/overlay-window' );
const { ActionTypes, TriggerAction } = require( '../data/models/trigger' );
const { ipcRenderer } = require( 'electron' );
const Handlebars = require( "handlebars" );
const StyleSheetUtil = require( '../utilities/style-sheet' );
const { FctStylesModel, FctModel, FctTypes } = require( '../data/models/fct' );

// TODO: Delete this overlay from the project.

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
var styleSheetUtil = new StyleSheetUtil();

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

    ipcRenderer.on( 'fctStyles',
        /**
         * Handles the sendTick data from main.
         * 
         * @param {any} event The event args?
         * @param {FctStylesModel} fctStyles The tick data.
         */
        ( event, fctStyles ) => {
            let style = styleSheetUtil.createStyleSheet( document, 'fct-styles' );

            style.sheet.insertRule( styleSheetUtil.createTextRule( fctStyles.fctDmgOutStyle, 'fct-dmg-out' ) );
            style.sheet.insertRule( styleSheetUtil.createTextRule( fctStyles.fctDmgInStyle, 'fct-dmg-in' ) );
            style.sheet.insertRule( styleSheetUtil.createTextRule( fctStyles.fctSpellDmgOutStyle, 'fct-spell-dmg-out' ) );
            style.sheet.insertRule( styleSheetUtil.createTextRule( fctStyles.fctSpellDmgInStyle, 'fct-spell-dmg-in' ) );
            style.sheet.insertRule( styleSheetUtil.createTextRule( fctStyles.fctHealingOutStyle, 'fct-healing-out' ) );
            style.sheet.insertRule( styleSheetUtil.createTextRule( fctStyles.fctHealingInStyle, 'fct-healing-in' ) );
            style.sheet.insertRule( styleSheetUtil.createTextRule( fctStyles.fctSkillStyle, 'fct-skill' ) );
            
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
            let healingContentArea = document.querySelector( '.healing-content-area' );
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

            width = contentArea.clientWidth;
            height = contentArea.clientHeight;
            fontSize = model.fontSize;

            quadrants = [];
            criticals = [];

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

        } );
}

var lastFctWidth = 0;
var lastFctLeft = 0;
var fctWidth = 100;
var delayBetweenCrits = 500;
var delayVariance = 0.50;
var delayAdd = 0;

/**
 * Renders the overlayComponents to the overlay window.
 * 
 * @param {FctModel} comp Tells the renderer to forcefully redraw the overlayComponents.
 */
function render( comp ) {
    
    let contentArea = document.querySelector( '.content-area' );
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

    if ( comp.critical ) {
        let content = fctCriticalTemplate( { value: comp.text, damageSource: comp.attack } );
        div.innerHTML = content;

        div.classList.add( 'animate-fade-shrink' );

        comp.dom = div;
        comp.delayAmount = NumberUtilities.randomBounded( delayBetweenCrits - ( delayBetweenCrits * delayVariance ), delayBetweenCrits + ( delayBetweenCrits * delayVariance ) + 1 );
        
        window.setTimeout( () => {
            contentArea.appendChild( div );
    
            comp.pos = getRandomLocation();
            criticals[ comp.pos.x ][ comp.pos.y ] = true;

            try {
                div.style.left = `${quadrants[ comp.pos.x ][ comp.pos.y ].x + ( div.clientWidth / 2 )}px`; // Cannot read property 'x' of undefined
                div.style.top = `${quadrants[ comp.pos.x ][ comp.pos.y ].y - ( div.clientHeight * 1.25 )}px`;
            } catch ( error ) {
                logInfo( `criticals: ${JSON.stringify( criticals ?? '' )}` );
                logInfo( `quadrants: ${JSON.stringify( quadrants ?? '' )}` );
            }
                
            comp.intervalId = window.setTimeout( () => {
                comp.dom.parentNode.removeChild( comp.dom );
                if ( criticals.length > comp.pos.x && criticals[ comp.pos.x ]?.length > comp.pos.y ) {
                    criticals[ comp.pos.x ][ comp.pos.y ] = false;
                }
            }, 4000 );

            delayAdd -= comp.delayAmount;
        }, delayAdd );

        delayAdd += comp.delayAmount;

    } else {
        let content = fctTemplate( { value: comp.text, damageSource: comp.attack } );
        div.innerHTML = content;

        div.classList.add( 'animate-fade-out' );

        comp.dom = div;

        if ( comp.fctType === FctTypes.healingOut || comp.fctType === FctTypes.healingIn ) {
            // div.classList.add( 'fct-healing-out' );
            // contentArea.appendChild( div );
            document.querySelector( '.healing-content-area' ).appendChild( div );
        } else {
            contentArea.appendChild( div );
        }
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
    var hex = Math.round(c).toString( 16 );
    return hex.length == 1 ? "0" + hex : hex;
}

module.exports = OverlayFct;
