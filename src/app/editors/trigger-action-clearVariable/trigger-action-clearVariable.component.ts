import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { TriggerAction } from 'src/app/core.model';
import { IpcService } from 'src/app/ipc.service';

@Component( {
    selector: 'app-trigger-action-clear-variable',
    templateUrl: 'trigger-action-clearVariable.component.html',
    styleUrls: ['trigger-action-clearVariable.component.scss']
} )
export class TriggerActionClearVariableComponent implements OnInit {

    @Input() public action: TriggerAction;
    
    public storedVariables: string[] = [];

    constructor( private ipcService: IpcService ) { }

    ngOnInit() {
        this.ipcService.getStoredVariables().subscribe( variables => this.storedVariables = variables );
    }

}