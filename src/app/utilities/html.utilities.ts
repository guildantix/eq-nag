import DOMPurify from 'dompurify';

// Matches src/electron/utilities/html.js: formatting and styles are kept,
// anything that can run code is removed.
const sanitizeConfig = {
    FORBID_TAGS: [ 'style', 'form', 'input', 'button', 'textarea', 'select', 'option', 'dialog' ],
};

/**
 * Removes anything that can run code from the given HTML, keeping formatting
 * and styles.
 * 
 * @param html The html to sanitize.
 */
export function sanitizeHtml( html: string ): string {
    if ( html === null || html === undefined || html === '' ) {
        return '';
    }
    return DOMPurify.sanitize( String( html ), sanitizeConfig ) as string;
}

/**
 * Escapes the given text so it is shown as-is when inserted as HTML.
 * 
 * @param text The text to escape.
 */
export function escapeHtml( text: string ): string {
    return String( text ?? '' ).replace( /&/g, '&amp;' ).replace( /</g, '&lt;' ).replace( />/g, '&gt;' ).replace( /"/g, '&quot;' ).replace( /'/g, '&#39;' );
}
