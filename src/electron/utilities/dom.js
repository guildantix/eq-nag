
function docReady( fn ) {
    if ( document.readyState === "complete" || document.readyState === "interactive" ) {
        setTimeout( fn, 1 );
    } else {
        document.addEventListener( "DOMContentLoaded", fn );
    }
}










/**
 * Updates the given dom element's text value without changing any child nodes.
 * 
 * @param {HTMLElement} dom The DOM element.
 * @param {string} text THe new text content for the element.
 */
function updateDomTextOnly( dom, text ) {
    console.log( 'updateDomTextOnly', dom );
    if ( dom && dom.childNodes?.length > 0 ) {
        for ( let i = 0; i < dom.childNodes.length; i++ ) {
            if ( dom.childNodes[ i ].nodeType === Node.TEXT_NODE ) {
                dom.childNodes[ i ].nodeValue = text;
                break;
            }
        }
    }
}










/**
 * Returns the inner content area, in pixels, of the given dom element.
 * 
 * @returns {{width: number, height: number}}
 * 
 * @param {HTMLElement} dom The dom element.
 */
function getInnerContentArea( dom ) {
    const computedStyle = window.getComputedStyle( dom );
    /** @type {string} */
    let pl = computedStyle[ 'padding-left' ];
    let pr = computedStyle[ 'padding-right' ];
    let pt = computedStyle[ 'padding-top' ];
    let pb = computedStyle[ 'padding-bottom' ];
    let emPx = 0;
    let pctWPx = ( 1 / 100 ) * dom.offsetWidth;
    let pctHPx = ( 1 / 100 ) * dom.offsetHeight;

    // Calculate em to px
    let div = document.createElement( 'div' );
    div.style.height = '1em';
    div.style.width = '0';
    div.style.outline = 'none';
    div.style.border = 'none';
    div.style.padding = 'none';
    div.style.margin = 'none';
    div.style.boxSizing = 'content-box';
    document.body.appendChild( div );
    emPx = div.offsetHeight;
    document.body.removeChild( div );

    let padding = { left: 0, right: 0, top: 0, bottom: 0 };

    if ( pl.indexOf( 'em' ) > -1 ) {
        padding.left = parseFloat( pl ) * emPx;
    } else if ( pl.indexOf( '%' ) > -1 ) {
        padding.left = parseFloat( pl ) * pctWPx;
    } else {
        padding.left = parseFloat( pl );
    }

    if ( pr.indexOf( 'em' ) > -1 ) {
        padding.right = parseFloat( pr ) * emPx;
    } else if ( pr.indexOf( '%' ) > -1 ) {
        padding.right = parseFloat( pr ) * pctWPx;
    } else {
        padding.right = parseFloat( pr );
    }

    if ( pt.indexOf( 'em' ) > -1 ) {
        padding.top = parseFloat( pt ) * emPx;
    } else if ( pt.indexOf( '%' ) > -1 ) {
        padding.top = parseFloat( pt ) * pctHPx;
    } else {
        padding.top = parseFloat( pt );
    }

    if ( pb.indexOf( 'em' ) > -1 ) {
        padding.bottom = parseFloat( pb ) * emPx;
    } else if ( pb.indexOf( '%' ) > -1 ) {
        padding.bottom = parseFloat( pb ) * pctHPx;
    } else {
        padding.bottom = parseFloat( pt );
    }

    return {
        width: dom.clientWidth - padding.left - padding.right,
        height: dom.clientHeight - padding.top - padding.bottom,
    }
}










const DomUtilities = {
    docReady: docReady,
    updateDomTextOnly: updateDomTextOnly,
    getInnerContentArea: getInnerContentArea,
};

module.exports = DomUtilities;
