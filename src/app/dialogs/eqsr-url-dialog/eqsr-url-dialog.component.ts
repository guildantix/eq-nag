import { Component, HostListener, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { IpcService } from 'src/app/ipc.service';

export class EqsrUrlDialogModel {
    /** The spell's name, used to search EQ Spell Resources. */
    public spellName: string;
    /** The EverQuest spell id from the old Allakhazam url, if there was one. */
    public spellId: number | null = null;
}

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
        @Inject( MAT_DIALOG_DATA ) public data: EqsrUrlDialogModel,
        private ipcService: IpcService,
    ) { }










    /**
     * Opens the spell's page on EQ Spell Resources in the user's browser.
     */
    public openSpell(): void {
        this.ipcService.openEqSpellResources( this.data.spellId );
    }










    /**
     * Opens an EQ Spell Resources search for the spell in the user's browser.
     */
    public openSearch(): void {
        this.ipcService.openEqSpellResources( null, this.data.spellName );
    }










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
