import { Component, Inject, OnInit } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
// import { IpcService } from 'src/app/ipc.service';
import { NotificationDialogModel } from './notification-dialog.model';

@Component( {
    selector: 'app-notification-dialog',
    templateUrl: 'notification-dialog.component.html',
    styleUrls: [ 'notification-dialog.component.scss' ],
} )
export class NotificationDialogComponent implements OnInit {

    public model: string;
    public messages: string[] = [];

    constructor(
        public dialogRef: MatDialogRef<NotificationDialogComponent>,
        @Inject( MAT_DIALOG_DATA ) public data: NotificationDialogModel,
        public dialog: MatDialog ) {
        if ( data.message instanceof Array ) {
            this.messages = data.message;
        } else {
            this.messages.push( data.message );
        }
    }

    ngOnInit() { }
}
