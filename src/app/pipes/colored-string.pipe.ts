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
            let value = msg.value
            value = value.replace( /\*\*(.*?)\*\*/gi, '<strong>$1</strong>' );
            value = value.replace( /\~\~(.*?)\~\~/gi, '<i>$1</i>' );
            value = value.replace( /\^\^(.*?)\^\^/gi, '<sup>$1</sup>' );
            value = value.replace( /\>\>(.*?)\<\</gi, '<center>$1</center>' );
            value = value.replace( /\*t/gi, '<span style="display: inline-block; width: 20px;">&nbsp;</span>' );
            let content = `<span style="color: ${msg.color}; font-weight: ${msg.bold ? 'bold' : 'unset'}">${value}</span>`;

            return this.sanitizer.bypassSecurityTrustHtml( content );
        } else {
            return msg;
        }
    }
}