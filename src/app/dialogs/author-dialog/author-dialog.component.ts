import { Component, Inject, OnInit } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { AuthorModel } from 'src/app/core.model';
import { IpcService } from 'src/app/ipc.service';

@Component( {
    selector: 'app-author-dialog',
    templateUrl: 'author-dialog.component.html',
    styleUrls: [ 'author-dialog.component.scss', '../dialog.styles.scss' ],
} )
export class AuthorDialogComponent implements OnInit {

    public model: AuthorModel = new AuthorModel();

    constructor( public dialogRef: MatDialogRef<AuthorDialogComponent> ) { }

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
        this.dialogRef.close( this.model ?? null );
    }
}
