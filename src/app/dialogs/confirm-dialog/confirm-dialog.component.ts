import { Component, OnInit, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

@Component( {
    selector: 'app-confirm-dialog',
    templateUrl: 'confirm-dialog.component.html',
    styleUrls: [ 'confirm-dialog.component.scss', '../../core.scss' ]
} )
export class ConfirmDialogComponent implements OnInit {

    public messages: string[] = [];

    constructor(
        public dialogRef: MatDialogRef<ConfirmDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public data: any ) { }

    ngOnInit(): void {
        if ( this.data.message instanceof Array ) {
            this.messages = this.data.message;
        } else if ( this.data.message ) {
            this.messages.push( this.data.message );
        } else {
            this.messages.push( 'Are you sure?' );
        }
    }
    
}
