import { isDisplayableTimerIcon, isShareableTimerIcon } from '../../electron/utilities/icons';

// The icon rules live in src/electron/utilities/icons.js so the app and main process agree.
export { isDisplayableTimerIcon, isShareableTimerIcon };










/**
 * Returns the names of the triggers that have a timer icon the receiver of a
 * share would drop.
 *
 * @param triggers The triggers to share.
 */
export function findUnshareableIconTriggers(
    triggers: { name?: string, actions?: { timerIcon?: string }[] }[]
): string[] {
    return ( triggers ?? [] )
        .filter( trigger => trigger.actions?.some( action =>
            action.timerIcon !== null && action.timerIcon !== undefined &&
            !isShareableTimerIcon( action.timerIcon ) ) )
        .map( trigger => trigger.name );
}
