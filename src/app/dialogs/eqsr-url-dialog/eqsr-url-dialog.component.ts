import { Component, HostListener } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';

/** Accepts EQ Spell Resources spell pages, e.g. https://spells.eqresource.com/spells.php?id=1447 */
const eqsrSpellUrlRegex = /^https?:\/\/spells\.eqresource\.com\/spells\.php\?id=\d+$/i;

@Component( {
    selector: 'app-eqsr-url-dialog',
    templateUrl: 'eqsr-url-dialog.component.html',
    styleUrls: [ 'eqsr-url-dialog.component.scss', '../dialog.styles.scss' ],
} )
export class EqsrUrlDialogComponent {

    public url: string = '';

    public get urlValid(): boolean {
        return eqsrSpellUrlRegex.test( this.url?.trim() ?? '' );
    }

    @HostListener( 'keyup', [ '$event' ] ) public onKeyUp( e: KeyboardEvent ) {
        if ( e.key === 'Enter' && this.urlValid ) {
            this.accept();
        } else if ( e.key === 'Escape' ) {
            this.cancel();
        }
    }

    constructor(
        public dialogRef: MatDialogRef<EqsrUrlDialogComponent, string>,
    ) { }










    /**
     * Closes the dialog without a url.
     */
    public cancel(): void {
        this.dialogRef.close( null );
    }










    /**
     * Closes the dialog with the EQ Spell Resources url.
     */
    public accept(): void {
        this.dialogRef.close( this.url.trim() );
    }

}
