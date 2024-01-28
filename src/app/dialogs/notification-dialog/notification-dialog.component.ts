import { Component, Inject, OnInit } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { ColoredString, CustomButton } from '../dialog.model';
import { NotificationDialogModel, NotificationTypes } from './notification-dialog.model';

@Component( {
    selector: 'app-notification-dialog',
    templateUrl: 'notification-dialog.component.html',
    styleUrls: [ 'notification-dialog.component.scss', '../dialog.styles.scss' ],
} )
export class NotificationDialogComponent implements OnInit {

    public model: string;
    public messages: ( string | ColoredString )[] = [];
    public notificationTypes: typeof NotificationTypes = NotificationTypes;
    public ignoreThisModal: boolean = false;

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

    ngOnInit() {
        if ( this.data.notificationType === NotificationTypes.Error ) {
            this.dialogRef.addPanelClass( 'red-warn-glow' );
        } else if ( this.data.notificationType === NotificationTypes.Information ) {
            this.dialogRef.addPanelClass( 'blue-glow' );
        }else if ( this.data.notificationType === NotificationTypes.Warning ) {
            this.dialogRef.addPanelClass( 'yellow-glow' );
        }
    }









    
    /**
     * Executes the given button's on click event.
     * 
     * @param btn The clicked button.
     */
    public onClickCustomButton( btn: CustomButton ) {
        let resp = btn.onClick();
        if ( resp === true ) {
            this.dialogRef.close();
        }
    }










    /**
     * Closes the dialog.
     */
    public closeDialog(): void {
        if ( this.ignoreThisModal ) {
            this.dialogRef.close( this.data.modalId );
        } else {
            this.dialogRef.close();
        }
    }
    








    
}
