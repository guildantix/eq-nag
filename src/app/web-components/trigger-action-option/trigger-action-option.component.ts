import { Component, Input, OnInit } from '@angular/core';
import { ActionTypeIcons, ActionTypeLabels, TriggerAction } from 'src/app/core.model';

@Component( {
    selector: 'app-trigger-action-option',
    templateUrl: 'trigger-action-option.component.html',
    styleUrls: [ './trigger-action-option.component.scss' ]
} )
export class TriggerActionOptionComponent implements OnInit {

    @Input( 'action' ) public action: TriggerAction;
    public actionTypeLabels = ActionTypeLabels;
    public actionTypeIcons = ActionTypeIcons;
    
    constructor() { }

    ngOnInit() { }

}
