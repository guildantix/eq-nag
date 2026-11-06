import { Pipe, PipeTransform } from '@angular/core';

@Pipe( {
    name: 'localeTime'
} )
export class LocaleTimePipe implements PipeTransform {

    private formats: Record<string, Intl.DateTimeFormat> = {
        'short': new Intl.DateTimeFormat( undefined, { hour: 'numeric', minute: '2-digit' } ),
        'medium': new Intl.DateTimeFormat( undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' } ),
    };

    transform( value: number | Date | null | undefined, style: 'short' | 'medium' = 'medium' ): string {
        return value == null ? '' : this.formats[ style ].format( value );
    }
}
