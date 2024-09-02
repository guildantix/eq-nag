import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Pipe( {
    name: 'safeHtmlContent'
} )
export class SafeHtmlContentPipe implements PipeTransform {

    constructor(
        private readonly sanitizer: DomSanitizer,
    ) { }

    /**
     * Converts the given text to HTML. 
     * 
     * @description
     *  Setting **bold** text, *italic* text, and `code` text. And also 
     *  converts line breaks to `<br>` tags.
     * 
     * @param value The hotkey description.
     */
    transform( value: string ): SafeHtml {
        let source = value;
        
        // Convert bold text.
        source = source.replace( /\*\*(.*?)\*\*/gi, '<strong>$1</strong>' );

        // Convert italic text.
        source = source.replace( /\*(.*?)\*/gi, '<em>$1</em>' );

        // Convert code text.
        source = source.replace( /`(.*?)`/gi, '<code>$1</code>' );

        // Convert line breaks.
        source = source.replace( /\n/gi, '<br />' );

        return this.sanitizer.bypassSecurityTrustHtml( source );
    }

}
