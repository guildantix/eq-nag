import { Component, Inject, OnInit } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { TriggerCondition, TriggerFolder } from 'src/app/core.model';
import { DialogService } from 'src/app/dialogs/dialog.service';
import { IpcService } from 'src/app/ipc.service';

@Component( {
    selector: 'app-folder-conditions-dialog',
    templateUrl: 'folder-conditions-dialog.component.html',
    styleUrls: [ 'folder-conditions-dialog.component.scss' ],
} )
export class FolderConditionsDialogComponent implements OnInit {

    public conditions: TriggerCondition[] = [];
    public title: string = 'Folder';

    constructor(
        public dialogRef: MatDialogRef<FolderConditionsDialogComponent>,
        @Inject( MAT_DIALOG_DATA ) public data: TriggerFolder,
    ) { }

    ngOnInit() {
        this.title = this.data.name ?? this.title;
        this.conditions = [].concat( this.data.folderConditions );
    }

    public confirm() {
        this.data.folderConditions = this.conditions;
        this.dialogRef.close( true );
    }

    public cancel() {
        this.dialogRef.close( false );
    }

}
