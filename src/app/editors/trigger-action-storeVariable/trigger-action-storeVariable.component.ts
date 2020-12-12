import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { TriggerAction } from 'src/app/core.model';

@Component( {
    selector: 'app-trigger-action-store-variable',
    templateUrl: 'trigger-action-storeVariable.component.html',
    styleUrls: ['trigger-action-storeVariable.component.scss']
} )
export class TriggerActionStoreVariableComponent implements OnInit {

    @Input() public action: TriggerAction;

    constructor() { }

    ngOnInit() { }

}