import { Component, OnInit, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { ColoredString } from '../dialog.model';

@Component( {
    selector: 'app-confirm-dialog',
    templateUrl: 'confirm-dialog.component.html',
    styleUrls: [ 'confirm-dialog.component.scss', '../dialog.styles.scss', '../../core.scss' ]
} )
export class ConfirmDialogComponent implements OnInit {

    public title: string = 'Confirm';
    public messages: ( string | ColoredString )[] = [];
    public noText: string = 'No';
    public yesText: string = 'Yes';
    public cancelText: string = 'Cancel';

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

        if ( this.data.buttonTexts ) {
            let buttonTexts = this.data.buttonTexts as { 'Yes'?: string, 'No'?: string, 'Cancel'?: string };

            this.yesText = buttonTexts.Yes ?? this.yesText;
            this.noText = buttonTexts.No ?? this.noText;
            this.cancelText = buttonTexts.Cancel ?? this.cancelText;
        }

        if ( this.data.title ) {
            this.title = this.data.title;
        }
    }
    
}
