const crypto = require( 'crypto' );
const { serverShareLimits, fileShareLimits } = require( './share-trigger-fields' );

/**
 * The most file read tokens remembered; the oldest is forgotten first. Generous so a big file, or
 * several files with receive dialogs still open, never loses tokens of shares in use.
 */
const maxRememberedTokens = 2000;
/** @type {Set<string>} The tokens the main process handed out for shares it read from a file. */
const fileShareTokens = new Set();





/**
 * Tags every quick share of a successfully read share file with a fresh random token, and
 * remembers the token. The token is how the main process later recognises a share that came from
 * a file, since the renderer sends the share back unchanged for cleaning and installing.
 * A token a file or a server share carries on its own is never remembered, so it grants nothing.
 *
 * @returns {object} Returns the same result.
 *
 * @param {any} result The result of reading a share file.
 */
function markFileShares( result ) {

    if ( result?.ok !== true || !Array.isArray( result.payload?.quickShares ) ) {
        return result;
    }

    const issuedTokens = new Set();

    for ( const quickShare of result.payload.quickShares ) {
        const token = crypto.randomUUID();

        quickShare.fileShareToken = token;
        fileShareTokens.add( token );
        issuedTokens.add( token );
    }

    // Evict only older tokens, so no share of this file silently falls back to the server limits.
    for ( const rememberedToken of fileShareTokens ) {
        if ( fileShareTokens.size <= maxRememberedTokens ) {
            break;
        }

        if ( !issuedTokens.has( rememberedToken ) ) {
            fileShareTokens.delete( rememberedToken );
        }
    }

    return result;

}










/**
 * Returns the field limits for a quick share: the file limits when the share carries a token the
 * main process issued for a file read, otherwise the server limits.
 *
 * @returns {{ maxTextLength: number, maxIconLength: number }} Returns the limits to clean with.
 *
 * @param {any} quickShare The quick share sent by the renderer.
 */
function getShareLimits( quickShare ) {

    const token = quickShare?.fileShareToken;

    return typeof token === 'string' && fileShareTokens.has( token ) ? fileShareLimits : serverShareLimits;

}










module.exports = {
    markFileShares,
    getShareLimits,
};
