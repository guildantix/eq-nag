import { Component, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core';
import { MatTable } from '@angular/material/table';
import { OperatorTypes, TriggerCondition, TriggerConditionTypes } from 'src/app/core.model';
import { DialogService } from 'src/app/dialogs/dialog.service';
import { EditorsService } from '../editors.service';

@Component({
    selector: 'app-conditions',
    templateUrl: 'conditions.component.html',
    styleUrls: ['conditions.component.scss', '../../core.scss']
})

export class ConditionsComponent implements OnInit {

    @Input() public conditions: TriggerCondition[];
    @Output() public conditionsChange: EventEmitter<TriggerCondition[]> = new EventEmitter<TriggerCondition[]>();

    @Input() public dialogService: DialogService;

    public triggerConditionTypes: typeof TriggerConditionTypes = TriggerConditionTypes;
    public operatorTypes: typeof OperatorTypes = OperatorTypes;
    public storedVariables: string[] = [];
    public conditionTableColumns = [ 'variable', 'operator', 'value', 'delete' ];

    @ViewChild( 'conditionsTable' ) private conditionsTable: MatTable<any>;

    constructor( private editorsService: EditorsService ) { }

    ngOnInit() {
        this.editorsService.getStoredVariables().subscribe( variables => this.storedVariables = variables );
    }

    public addNewCondition(): void {
        let condition: TriggerCondition = new TriggerCondition();
        condition.conditionType = TriggerConditionTypes.VariableValue;
        this.conditions.push( condition );
        this.conditionsTable?.renderRows();
    }

    public deleteCondition( index: number ): void {
        if ( this.dialogService ) {
            this.dialogService.showConfirmDialog(
                'Are you certain you want to delete this condition?',
                'Click "Yes" to delete the condition.',
                'Click "No" to cancel and close this dialog without deleting the condition.',
                ( confirmed ) => {
                    if ( confirmed ) {
                        this.doDeleteCondition( index );
                    }
                } );
        } else {
            this.doDeleteCondition( index );
        }
    }

    private doDeleteCondition( index: number ): void {
        this.conditions?.splice( index, 1 );
        this.conditionsChange.emit( this.conditions );
        this.conditionsTable?.renderRows();
    }

}