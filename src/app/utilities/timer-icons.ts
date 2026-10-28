import { iconPattern, maxIconLength } from '../../electron/utilities/icons';

// The rules for a timer icon in a share are shared with src/electron/utilities/icons.js.
export { iconPattern, maxIconLength };

/**
 * Returns true if the given timer icon is accepted when it is received.
 *
 * @param icon The timer icon.
 */
export function isShareableTimerIcon( icon: string ): boolean {
    return typeof icon === 'string' && icon.length <= maxIconLength && iconPattern.test( icon );
}

/**
 * Returns the names of the triggers that have a timer icon the receiver of a
 * share would drop.
 *
 * @param triggers The triggers to share.
 */
export function findUnshareableIconTriggers( triggers: { name?: string, actions?: { timerIcon?: string }[] }[] ): string[] {
    return ( triggers ?? [] )
        .filter( trigger => trigger.actions?.some( action => action.timerIcon !== null && action.timerIcon !== undefined && !isShareableTimerIcon( action.timerIcon ) ) )
        .map( trigger => trigger.name );
}
