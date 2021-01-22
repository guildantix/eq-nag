import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { OverlayWindowModel, TriggerAction } from 'src/app/core.model';

@Component( {
    selector: 'app-trigger-action-display-text',
    templateUrl: 'trigger-action-displayText.component.html',
    styleUrls: ['trigger-action-displayText.component.scss']
} )
export class TriggerActionDisplayTextComponent implements OnInit {

    @Input() public action: TriggerAction;
    @Input() public overlayOptions: OverlayWindowModel[] = [];

    constructor() { }

    ngOnInit() { }

}