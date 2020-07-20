import { Component, OnInit, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { OverlayWindowModel } from 'src/app/core.model';

@Component( {
    selector: 'app-overlay-details-dialog',
    templateUrl: 'overlay-details-dialog.component.html',
    styleUrls: [ 'overlay-details-dialog.component.scss' ]
} )
export class OverlayDetailsDialogComponent implements OnInit {

    public model: OverlayWindowModel;

    constructor(
        public dialogRef: MatDialogRef<OverlayDetailsDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public data: OverlayWindowModel ) { }

    ngOnInit(): void {
        this.model = Object.assign( new OverlayWindowModel(), this.data );
    }

    cancel (): void {
        this.dialogRef.close( null );
    }

}