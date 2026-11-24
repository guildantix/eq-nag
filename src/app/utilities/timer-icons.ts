import { isDisplayableTimerIcon, isShareableTimerIcon } from '../../electron/utilities/icons';
// A file with no dependencies, so the app bundle shares the main process caps without pulling in
// the trigger models.
import { serverShareLimits, fileShareLimits } from '../../electron/utilities/share-limits';

// The icon rules live in src/electron/utilities/icons.js so the app and main process agree.
export { isDisplayableTimerIcon, isShareableTimerIcon };

/** The largest timer icon a server share keeps, from the same limits the main process applies. */
export const serverMaxIconLength: number = serverShareLimits.maxIconLength;

/** The largest timer icon a share read from a file keeps. */
export const fileMaxIconLength: number = fileShareLimits.maxIconLength;









/**
 * Returns the names of the triggers that have a timer icon the receiver of a
 * share would drop.
 *
 * @param triggers The triggers to share.
 * @param maxIconLength The largest icon the receiver keeps: the server cap for an upload, the
 * file cap for a saved file.
 */
export function findUnshareableIconTriggers(
    triggers: { name?: string, actions?: { timerIcon?: string }[] }[],
    maxIconLength: number = serverMaxIconLength
): string[] {
    return ( triggers ?? [] )
        .filter( trigger => trigger.actions?.some( action =>
            action.timerIcon !== null && action.timerIcon !== undefined &&
            !isShareableTimerIcon( action.timerIcon, maxIconLength ) ) )
        .map( trigger => trigger.name );
}










/**
 * Returns the warning for triggers whose timer icon the receiver would drop, or an empty
 * text when there are none. The size in the text is the cap of the given destination.
 *
 * @param triggers The triggers to share.
 * @param maxIconLength The largest icon the receiver keeps.
 */
export function describeUnshareableIcons(
    triggers: { name?: string, actions?: { timerIcon?: string }[] }[],
    maxIconLength: number = serverMaxIconLength
): string {
    const names = findUnshareableIconTriggers( triggers, maxIconLength );

    if ( names.length === 0 ) {
        return '';
    }

    const capText = maxIconLength >= 1000000 ? `${maxIconLength / 1000000} MB` : `${Math.round( maxIconLength / 1024 )} KB`;
    const nameText = names.slice( 0, 5 ).map( name => `"${name}"` ).join( ', ' ) + ( names.length > 5 ? ' and more' : '' );

    return `The timer icon of ${nameText} is not an embedded image up to ${capText}, so the receiver will not get it.`;
}
