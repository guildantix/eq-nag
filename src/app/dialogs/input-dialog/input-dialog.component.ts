import { Component, HostListener, Inject, OnInit } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { IpcService } from 'src/app/ipc.service';
import { InputDialogModel } from './input-dialog.model';

@Component( {
    selector: 'app-input-dialog',
    templateUrl: 'input-dialog.component.html',
    styleUrls: [ 'input-dialog.component.scss', '../dialog.styles.scss' ],
} )
export class InputDialogComponent implements OnInit {

    public model: string;
    public messages: string[] = [];

    @HostListener( 'keyup', [ '$event' ] ) public onKeyUp( e: KeyboardEvent ) {
        if ( e.key === 'Enter' ) {
            if ( ( e.target as HTMLElement ).tagName === 'TEXTAREA' ) {
                return;
            }
            this.accept();
        } else if ( e.key === 'Escape' ) {
            this.cancel();
        }
    }

    constructor(
        public dialogRef: MatDialogRef<InputDialogComponent>,
        @Inject( MAT_DIALOG_DATA ) public data: InputDialogModel,
        public dialog: MatDialog,
        private ipcService: IpcService ) {
        if ( data.message instanceof Array ) {
            this.messages = data.message;
        } else {
            this.messages.push( data.message );
        }

        if ( data.initialValue ) {
            this.model = data.initialValue;
        }
    }

    ngOnInit() { }









    
    /**
     * Closes the dialog and passes null to the dialog ref.
     */
    cancel() {
        this.dialogRef.close( null );
    }










    /**
     * Closes this dialog and passes the user value to the dialog ref.
     */
    accept() {
        this.dialogRef.close( this.model ?? '' );
    }
}
