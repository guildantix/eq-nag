import { Component, OnInit, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { OverlayWindowModel } from 'src/app/core.model';

@Component( {
    selector: 'app-overlay-details-dialog',
    templateUrl: 'overlay-details-dialog.component.html',
    styleUrls: [ 'overlay-details-dialog.component.scss', '../dialog.styles.scss' ]
} )
export class OverlayDetailsDialogComponent implements OnInit {

    public model: OverlayWindowModel;
    public enterDescription: boolean;
    public selectedDisplay: Electron.Display | null = null;

    constructor(
        public dialogRef: MatDialogRef<OverlayDetailsDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public data: OverlayWindowModel ) { }

    ngOnInit(): void {
        this.model = Object.assign( new OverlayWindowModel(), this.data );
    }

    cancel (): void {
        this.dialogRef.close( null );
    }

    onDisplaySelected( display: Electron.Display ): void {
        this.selectedDisplay = display;
        this.model.displayId = display.id;
        this.model.displayBounds = display.bounds;
    }

}
