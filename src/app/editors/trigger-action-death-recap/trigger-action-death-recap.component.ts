import { Component, Input, OnInit } from '@angular/core';
import { TriggerAction } from 'src/app/core.model';

@Component({
    selector: 'app-trigger-action-death-recap',
    templateUrl: 'trigger-action-death-recap.component.html',
    styleUrls: ['trigger-action-death-recap.component.scss']
})

export class TriggerActionDeathRecapComponent implements OnInit {

    @Input() public action: TriggerAction;

    constructor() { }

    ngOnInit() { }

}
