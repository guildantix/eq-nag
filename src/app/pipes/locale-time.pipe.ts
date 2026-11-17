import { Pipe, PipeTransform } from '@angular/core';

/**
 * Shows a time of day in the computer's own format, like 3:07 PM.
 */
@Pipe( {
    name: 'localeTime'
} )
export class LocaleTimePipe implements PipeTransform {

    private formats: Record<string, Intl.DateTimeFormat> = {
        'short': new Intl.DateTimeFormat( undefined, { hour: 'numeric', minute: '2-digit' } ),
        'medium': new Intl.DateTimeFormat( undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' } ),
    };










    /**
     * Formats the time, or returns an empty text when there is no time.
     *
     * @param value The time to format, in ms or as a date.
     * @param style Whether to leave out the seconds ('short') or show them ('medium').
     * @returns The formatted time.
     */
    transform( value: number | Date | null | undefined, style: 'short' | 'medium' = 'medium' ): string {
        return value === null || value === undefined ? '' : this.formats[ style ].format( value );
    }
}
