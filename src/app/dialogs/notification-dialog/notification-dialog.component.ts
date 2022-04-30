import { Component, Inject, OnInit } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { ColoredString, CustomButton } from '../dialog.model';
import { NotificationDialogModel, NotificationTypes } from './notification-dialog.model';

@Component( {
    selector: 'app-notification-dialog',
    templateUrl: 'notification-dialog.component.html',
    styleUrls: [ 'notification-dialog.component.scss' ],
} )
export class NotificationDialogComponent implements OnInit {

    public model: string;
    public messages: ( string | ColoredString )[] = [];
    public notificationTypes: typeof NotificationTypes = NotificationTypes;

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

    public onClickCustomButton( btn: CustomButton ) {
        let resp = btn.onClick();
        if ( resp === true ) {
            this.dialogRef.close();
        }
    }

    isColoredString( msg: any ): boolean {
        return msg instanceof ColoredString;
    }
}
