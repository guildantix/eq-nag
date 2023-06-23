import { Component, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core';
import { MatTable } from '@angular/material/table';
import { OperatorTypes, TriggerCondition, TriggerConditionTypes } from 'src/app/core.model';
import { DialogService } from 'src/app/dialogs/dialog.service';
import { IpcService } from 'src/app/ipc.service';

@Component({
    selector: 'app-conditions',
    templateUrl: 'conditions.component.html',
    styleUrls: ['conditions.component.scss', '../../core.scss']
})

export class ConditionsComponent implements OnInit {

    @Input() public conditions: TriggerCondition[];
    @Input() public conditionType: TriggerConditionTypes = TriggerConditionTypes.VariableValue;
    @Input() public lighter: boolean = false;
    @Output() public conditionsChange: EventEmitter<TriggerCondition[]> = new EventEmitter<TriggerCondition[]>();

    public triggerConditionTypes: typeof TriggerConditionTypes = TriggerConditionTypes;
    public operatorTypes: typeof OperatorTypes = OperatorTypes;
    public storedVariables: string[] = [];
    public conditionTableColumns = [ 'variable', 'operator', 'value', 'delete' ];

    @ViewChild( 'conditionsTable' ) private conditionsTable: MatTable<any>;

    constructor( private ipcService: IpcService, private dialogService: DialogService ) { }

    ngOnInit() {
        this.ipcService.getStoredVariables().subscribe( variables => this.storedVariables = variables );
    }

    public addNewCondition(): void {
        let condition: TriggerCondition = new TriggerCondition();
        condition.conditionType = this.conditionType;
        this.conditions.push( condition );
        this.conditionsChange.emit( this.conditions );
        this.conditionsTable?.renderRows();
    }

    public deleteCondition( index: number ): void {
        this.dialogService.showConfirmDialog(
            'Are you certain you want to delete this condition?',
            'Click "Yes" to delete the condition.',
            'Click "No" to cancel and close this dialog without deleting the condition.',
            ( confirmed ) => {
                if ( confirmed ) {
                    this.doDeleteCondition( index );
                }
            } );
    }

    private doDeleteCondition( index: number ): void {
        this.conditions?.splice( index, 1 );
        this.conditionsChange.emit( this.conditions );
        this.conditionsTable?.renderRows();
    }

}