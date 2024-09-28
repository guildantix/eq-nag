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
    @Input() public lighter: boolean = false;
    @Output() public conditionsChange: EventEmitter<TriggerCondition[]> = new EventEmitter<TriggerCondition[]>();

    public triggerConditionTypes: typeof TriggerConditionTypes = TriggerConditionTypes;
    public operatorTypes: typeof OperatorTypes = OperatorTypes;
    public storedVariables: string[] = [];
    public counters: string[] = [];
    public get storedVariableNames(): string[] {
        return [ ...this.storedVariables, ...this.counters ];
    }
    public conditionTableColumns = [ 'variable', 'operator', 'value', 'delete' ];

    @ViewChild( 'conditionsTable' ) private conditionsTable: MatTable<any>;

    constructor( private ipcService: IpcService, private dialogService: DialogService ) { }

    ngOnInit() {
        this.ipcService.getStoredVariables().subscribe( variables => this.storedVariables = variables );
        this.ipcService.getCounterNames().subscribe( counters => this.counters = counters );
    }

    public addNewCondition(): void {
        let condition: TriggerCondition = new TriggerCondition();
        condition.conditionType = TriggerConditionTypes.VariableValue;
        this.conditions.push( condition );
        this.conditionsChange.emit( this.conditions );
        this.conditionsTable?.renderRows();
    }

    public deleteCondition( index: number ): void {
        this.dialogService.showConfirmationDialog(
            'Are you certain you want to delete this condition?',
            'Click "Yes" to delete the condition.',
            'Click "No" to cancel and close this dialog without deleting the condition.' )
            .subscribe( confirmed => {
                if ( confirmed ) {
                    this.doDeleteCondition( index );
                }
            } );
    }

    private doDeleteCondition( index: number ): void {
        this.conditions?.splice( index, 1 );
        this.onConditionChange();
        this.conditionsTable?.renderRows();
    }

    public onConditionChange(): void {
        for ( let i = 0; i < this.conditions.length; i++ ) {
            const condition = this.conditions[ i ];
            condition.conditionType = this.counters.includes( condition.variableName ) ? TriggerConditionTypes.CounterValue : TriggerConditionTypes.VariableValue;
        }
        this.conditionsChange.emit( this.conditions );
    }

}