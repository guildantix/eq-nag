
function docReady( fn ) {
    if ( document.readyState === "complete" || document.readyState === "interactive" ) {
        setTimeout( fn, 1 );
    } else {
        document.addEventListener( "DOMContentLoaded", fn );
    }
}

let DomUtilities = {
    docReady: docReady
};

module.exports = DomUtilities;
