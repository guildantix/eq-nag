import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ColoredString } from '../dialogs/dialog.model';

@Pipe( {
    name: 'coloredString',
} )
export class ColoredStringPipe implements PipeTransform {

    constructor(private sanitizer: DomSanitizer) { }

    transform( msg: string | ColoredString ): string | SafeHtml {
        if ( msg instanceof ColoredString ) {
            let content = `<span style="color: ${msg.color}; font-weight: ${msg.bold ? 'bold' : 'unset'}">${msg.value}</span>`;

            return this.sanitizer.bypassSecurityTrustHtml( content );
        } else {
            return msg;
        }
    }
}