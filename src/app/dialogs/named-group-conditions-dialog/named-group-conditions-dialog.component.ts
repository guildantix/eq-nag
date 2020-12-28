import { Component, Inject, OnInit } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { TriggerConditionTypes } from 'src/app/core.model';
import { IpcService } from 'src/app/ipc.service';
import { NamedGroupConditionsModel } from './named-group-conditions.model';

@Component( {
    selector: 'app-input-dialog',
    templateUrl: 'named-group-conditions-dialog.component.html',
    styleUrls: [ 'named-group-conditions-dialog.component.scss' ],
} )
export class NamedGroupConditionsDialogComponent implements OnInit {

    public messages: string[] = [];
    public conditionType: TriggerConditionTypes = TriggerConditionTypes.NamedGroupValue;

    constructor(
        public dialogRef: MatDialogRef<NamedGroupConditionsDialogComponent>,
        @Inject( MAT_DIALOG_DATA ) public data: NamedGroupConditionsModel,
        public dialog: MatDialog,
        private ipcService: IpcService ) {
        if ( data.message instanceof Array ) {
            this.messages = data.message;
        } else {
            this.messages.push( data.message );
        }
    }

    ngOnInit() { }
}
