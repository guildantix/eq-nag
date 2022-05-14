import { Component, OnInit, Inject } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

@Component( {
    selector: 'app-receive-quick-share-dialog',
    templateUrl: 'receive-quick-share.component.html',
    styleUrls: [ 'receive-quick-share.component.scss', '../../core.scss' ]
} )
export class ReceiveQuickShareDialogComponent implements OnInit {

    constructor(
        public dialogRef: MatDialogRef<ReceiveQuickShareDialogComponent, boolean>,
        @Inject( MAT_DIALOG_DATA ) public data: string,
        public dialog: MatDialog ) { }

    ngOnInit(): void {
        
    }
    
    receiveSelectedTriggers(): void {
        this.dialogRef.close( true );
    }
}
