const createDOMPurify = require( 'dompurify' );

/** @type {import('dompurify').DOMPurify} */
let purifier = null;

// Trigger authors can style their text with HTML, so only executable content
// is removed (scripts, event handlers, javascript: urls, frames, etc.).  Style
// elements and form controls are also removed, because one overlay's markup
// would otherwise change or cover every other overlay in the same window.
const sanitizeConfig = {
    FORBID_TAGS: [ 'style', 'form', 'input', 'button', 'textarea', 'select', 'option', 'dialog' ],
};









/**
 * Removes anything that can run code from the given HTML, keeping formatting
 * and styles.  Use it for every value assigned to innerHTML that contains
 * trigger, package or log text.
 *
 * @param {string} html The html to sanitize.
 * @returns {string}
 */
function sanitizeHtml( html ) {
    if ( html === null || html === undefined || html === '' ) {
        return '';
    }
    purifier = purifier ?? createDOMPurify( window );
    return purifier.sanitize( String( html ), sanitizeConfig );
}









module.exports = { sanitizeHtml };
