const crypto = require( 'crypto' );
const { serverShareLimits, fileShareLimits } = require( './share-trigger-fields' );

/** The most file read tokens remembered; the oldest is forgotten first. */
const maxRememberedTokens = 200;
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

    for ( const quickShare of result.payload.quickShares ) {
        const token = crypto.randomUUID();

        quickShare.fileShareToken = token;
        fileShareTokens.add( token );

        if ( fileShareTokens.size > maxRememberedTokens ) {
            fileShareTokens.delete( fileShareTokens.values().next().value );
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
