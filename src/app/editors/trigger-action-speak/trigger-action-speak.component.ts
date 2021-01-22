import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { TriggerAction } from 'src/app/core.model';

@Component( {
    selector: 'app-trigger-action-speak',
    templateUrl: 'trigger-action-speak.component.html',
    styleUrls: ['trigger-action-speak.component.scss']
} )
export class TriggerActionSpeakComponent implements OnInit {

    @Input() public action: TriggerAction;

    constructor() { }

    ngOnInit() { }

}