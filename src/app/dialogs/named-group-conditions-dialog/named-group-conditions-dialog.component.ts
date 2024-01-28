import { Component, Inject, OnInit } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { ContextMenuModel } from 'src/app/context-menu/context-menu.model';
import { OperatorTypes, TriggerCondition, TriggerConditionTypes } from 'src/app/core.model';
import { IpcService } from 'src/app/ipc.service';
import { NamedGroupConditionsModel } from './named-group-conditions.model';

@Component( {
    selector: 'app-input-dialog',
    templateUrl: 'named-group-conditions-dialog.component.html',
    styleUrls: [ 'named-group-conditions-dialog.component.scss', '../dialog.styles.scss', '../../core.scss' ],
} )
export class NamedGroupConditionsDialogComponent implements OnInit {

    public model: TriggerCondition[] = [];
    public messages: string[] = [];
    public conditionType: TriggerConditionTypes = TriggerConditionTypes.NamedGroupValue;
    public operatorTypes: typeof OperatorTypes = OperatorTypes;

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
        this.model = data.conditions.slice();
        if ( this.model == null || this.model.length === 0 ) {
            this.addNewCondition();
        }
    }

    ngOnInit() { }

    public addNewCondition(): void {
        let condition: TriggerCondition = new TriggerCondition();
        condition.conditionType = this.conditionType;
        this.model.push( condition );
    }

    private deleteCondition( index: number ): void {
        this.model?.splice( index, 1 );
    }

    public getCtxMenu( index: number ): ContextMenuModel[] {
        return [ <ContextMenuModel>{
            label: 'Delete',
            action: () => this.deleteCondition( index ),
            disabled: () => false,
            hide: () => false,
            matIcon: 'clear',
        } ];
    }

}
