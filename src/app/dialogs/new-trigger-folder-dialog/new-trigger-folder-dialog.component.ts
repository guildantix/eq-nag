import { Component, OnInit, Inject } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { TriggerFolder } from '../../core.model';

@Component( {
    selector: 'app-new-trigger-dialog',
    templateUrl: 'new-trigger-folder-dialog.component.html',
    styleUrls: [ 'new-trigger-folder-dialog.component.scss', '../dialog.styles.scss', '../../core.scss' ]
} )
export class NewTriggerFolderDialogComponent implements OnInit {

    public model: TriggerFolder;

    constructor(
        public dialogRef: MatDialogRef<NewTriggerFolderDialogComponent>,
        @Inject( MAT_DIALOG_DATA ) public data: any,
        public dialog: MatDialog ) { }

    ngOnInit(): void {

        this.model = new TriggerFolder();

    }
    
}
