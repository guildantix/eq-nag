import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';

@Pipe( {
    name: 'iconSrc'
} )
export class IconSrcPipe implements PipeTransform {

    constructor(
        private readonly sanitizer: DomSanitizer,
    ) { }

    /**
     * Returns an image source for a timer icon.
     *
     * @description
     *  Angular's URL sanitizer rejects `data:image/svg+xml` URLs, because an
     *  SVG can contain script, so SVG icons didn't show in the editors. A
     *  script inside an SVG never runs when the SVG is shown through an
     *  `<img>`, so image data URLs are safe here. Anything else is left to
     *  Angular's normal sanitizing.
     *
     * @param value The icon, usually an image data URL.
     */
    transform( value: string ): SafeUrl | string {
        return typeof value === 'string' && value.startsWith( 'data:image/' ) ? this.sanitizer.bypassSecurityTrustUrl( value ) : value;
    }

}
