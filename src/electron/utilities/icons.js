// A timer icon is an image data url: spell icons are png, and files the user
// picks are png, jpeg, gif, webp or svg (an svg is only ever the source of an
// img, which runs nothing and loads nothing).  Shared triggers carry the icon
// as a free string, so anything else would let a trigger point the app at a
// remote or local file.
const iconPattern = /^data:image\/(?:png|jpe?g|gif|webp|svg\+xml);base64,[A-Za-z0-9+/=]*$/i;
// Before 0.2.29 the icon picker took any file, so a player's own profile can hold
// other image types (bmp, ico, avif).  Showing those is as harmless as showing a
// png, so the display rule accepts any embedded image.
const displayIconPattern = /^data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]*$/i;
const maxIconLength = 256 * 1024;










/**
 * Returns true when the icon may be installed from a share, package, .nag file or
 * GINA import: an embedded png, jpeg, gif, webp or svg image within the size cap.
 * Strict because the icon comes from a stranger and is stored in the profile.
 *
 * @param {string} icon The timer icon.
 * @param {number} [maxLength] The largest accepted length of the data url.
 * @returns {boolean} True when the icon is accepted.
 */
function isShareableTimerIcon( icon, maxLength = maxIconLength ) {
    return typeof icon === 'string' && icon.length <= maxLength && iconPattern.test( icon );
}










/**
 * Returns true when the icon may be drawn: any embedded base64 image, of any size.
 * Wider than the install rule so icons already in a player's profile keep showing,
 * while remote urls, file paths and anything that is not an image data url stay hidden.
 *
 * @param {string} icon The timer icon.
 * @returns {boolean} True when the icon may be displayed.
 */
function isDisplayableTimerIcon( icon ) {
    return typeof icon === 'string' && displayIconPattern.test( icon );
}










/**
 * Returns the given timer icon if it is an image data url that is small
 * enough to share, otherwise null.
 *
 * @param {string} icon The icon from a shared trigger.
 * @param {number} [maxLength] The largest accepted length of the data url.
 * @returns {string|null} The icon, or null when it is not accepted.
 */
function sanitizeTimerIcon( icon, maxLength = maxIconLength ) {
    return isShareableTimerIcon( icon, maxLength ) ? icon : null;
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










module.exports = { iconPattern, maxIconLength, isShareableTimerIcon, isDisplayableTimerIcon, sanitizeTimerIcon, sanitizeTriggerIcons };
