import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { ActionTypes, CapturePhrase, TriggerAction } from 'src/app/core.model';

@Component( {
    selector: 'app-trigger-actions',
    templateUrl: 'trigger-actions.component.html',
    styleUrls: ['trigger-actions.component.scss']
} )
export class TriggerActionsComponent implements OnInit {

    @Input() public actions: TriggerAction[];
    @Output() public actionsChange: EventEmitter<TriggerAction[]> = new EventEmitter<TriggerAction[]>();

    @Input() public isDev: boolean = false;
    @Input() public capturePhrases: CapturePhrase[] = [];

    public actionTypes: typeof ActionTypes = ActionTypes;

    constructor() { }

    ngOnInit() { }

    public addNewAction(): void {
        this.actions.push( new TriggerAction() );
        this.actionsChange.emit( this.actions );
    }

}