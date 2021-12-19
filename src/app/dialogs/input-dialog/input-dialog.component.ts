import { Component, Inject, OnInit } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { IpcService } from 'src/app/ipc.service';
import { InputDialogModel } from './input-dialog.model';

@Component( {
    selector: 'app-input-dialog',
    templateUrl: 'input-dialog.component.html',
    styleUrls: [ 'input-dialog.component.scss' ],
} )
export class InputDialogComponent implements OnInit {

    public model: string;
    public messages: string[] = [];

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

    cancel() {
        this.dialogRef.close( null );
    }

    accept() {
        this.dialogRef.close( this.model ?? '' );
    }
}
