/**
 * The size caps for shares, kept in a file with no dependencies so the main process, the field
 * normaliser and the app's timer icon check read one set of numbers (the app bundle must not pull
 * in the trigger models just to learn a size).
 */

/**
 * The size caps for shares that come from, or go to, the share server. The server hosts everything
 * that is uploaded and every user downloads it, so the caps stay tight. Text over maxTextLength is
 * cut. An icon is a data URL, so cutting it would leave something that still looks like an image
 * but never draws: an icon over maxIconLength is dropped whole.
 */
const serverShareLimits = { maxTextLength: 100000, maxIconLength: 262144 };
/**
 * The size caps for shares that come from a file. A file is a private hand-off between friends and
 * is not hosted anywhere, so it gets room for big content such as an animated gif icon. Only the
 * sizes differ: every type and field check still runs.
 */
const fileShareLimits = { maxTextLength: 1000000, maxIconLength: 10000000 };










module.exports = { serverShareLimits, fileShareLimits };
