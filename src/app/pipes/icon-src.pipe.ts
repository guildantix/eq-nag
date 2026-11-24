import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { isDisplayableTimerIcon } from '../utilities/timer-icons';

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
     *  Angular's URL sanitizer rejects data URLs it does not know, so base64
     *  image data URLs are trusted here.  Anything else is not shown.
     *
     * @param value The icon, an image data URL.
     */
    transform( value: string ): SafeUrl | null {
        return isDisplayableTimerIcon( value ) ? this.sanitizer.bypassSecurityTrustUrl( value ) : null;
    }

}
