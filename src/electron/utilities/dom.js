
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
    // document.querySelector('.dot-text').childNodes[1].nodeType === Node.TEXT_NODE;
    // document.querySelector('.dot-text').childNodes[1].nodeValue = 'Updated again';
}

let DomUtilities = {
    docReady: docReady,
    updateDomTextOnly: updateDomTextOnly,
};

module.exports = DomUtilities;
