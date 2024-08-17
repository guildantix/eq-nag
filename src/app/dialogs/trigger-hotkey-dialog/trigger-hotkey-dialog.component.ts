import { Component, Inject, OnInit, ViewChild } from '@angular/core';
import { NgForm } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialog } from '@angular/material/dialog';
import { TriggerHotkey } from 'src/app/core.model';
import { IpcService } from 'src/app/ipc.service';
import { NotificationDialogModel, NotificationTypes } from '../notification-dialog/notification-dialog.model';
import { NotificationDialogComponent } from '../notification-dialog/notification-dialog.component';
import { StringUtility } from 'src/app/utilities';

@Component( {
    selector: 'app-trigger-hotkey-dialog',
    templateUrl: './trigger-hotkey-dialog.component.html',
    styleUrls: [ './trigger-hotkey-dialog.component.scss', '../dialog.styles.scss' ]
} )
export class TriggerHotkeyDialogComponent implements OnInit {

    public model: TriggerHotkey;

    @ViewChild( NgForm ) form: NgForm | undefined;

    constructor(
        public dialogRef: MatDialogRef<TriggerHotkeyDialogComponent>,
        @Inject( MAT_DIALOG_DATA ) public data: TriggerHotkey,
        public dialog: MatDialog,
        private ipcService: IpcService,
    ) {
        this.model = { ...data };

        if ( this.model.lines?.length < 5 ) {
            // Ensure there are at least 5 lines.
            for ( let i = this.model.lines.length; i < 5; i++ ) {
                this.model.lines.push( '' );
            }
        } else if ( this.model.lines?.length > 5 ) {
            // Ensure there are no more than 20 lines.
            this.model.lines = this.model.lines.slice( 0, 5 );
        }
    }

    ngOnInit(): void {
    }









    
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
        if ( this.form?.valid && this.model.lines?.some( line => line.length > 0 ) ) {
            this.dialogRef.close( this.model );
        } else {
            let data: NotificationDialogModel = new NotificationDialogModel();
        
            data.title = 'Required Fields';
            data.message = [ 'Please enter all required fields before continuing.' ];
            data.notificationType = NotificationTypes.Error;

            if ( !this.model.lines?.some( line => line.length > 0 ) ) {
                data.message.push( 'At least one line of text is required.' );
            }

            if ( StringUtility.isNullOrWhitespace( this.model.name ) ) {
                data.message.push( 'A name is required.' );
            }

            if ( StringUtility.isNullOrWhitespace( this.model.description ) ) {
                data.message.push( 'A description is required.' );
            }
    
            this.dialog.open( NotificationDialogComponent, {
                maxWidth: '60vw',
                data: data,
                panelClass: 'app-dialog',
            } ).afterClosed().subscribe();
        }
    }
}
