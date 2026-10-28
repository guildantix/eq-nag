// A timer icon is an image data url: spell icons are png, and files the user
// picks are png, jpeg, gif, webp or svg (an svg is only ever the source of an
// img, which runs nothing and loads nothing).  Shared triggers carry the icon
// as a free string, so anything else would let a trigger point the app at a
// remote or local file.
const iconPattern = /^data:image\/(?:png|jpe?g|gif|webp|svg\+xml);base64,[A-Za-z0-9+/=]*$/i;
const maxIconLength = 256 * 1024;










/**
 * Returns the given timer icon if it is an image data url that is small
 * enough to share, otherwise null.
 *
 * @param {string} icon The icon from a shared trigger.
 * @param {number} [maxLength] The largest accepted length of the data url.
 * @returns {string|null} The icon, or null when it is not accepted.
 */
function sanitizeTimerIcon( icon, maxLength = maxIconLength ) {
    return typeof icon === 'string' && icon.length <= maxLength && iconPattern.test( icon ) ? icon : null;
}










/**
 * Sanitizes the timer icon of every action of the given trigger.
 *
 * @param {{ actions?: { timerIcon?: string }[] }} trigger The trigger from a share or import.
 */
function sanitizeTriggerIcons( trigger ) {
    trigger?.actions?.forEach( action => {
        if ( action && action.timerIcon !== null && action.timerIcon !== undefined ) {
            action.timerIcon = sanitizeTimerIcon( action.timerIcon );
        }
    } );
}










module.exports = { iconPattern, maxIconLength, sanitizeTimerIcon, sanitizeTriggerIcons };
