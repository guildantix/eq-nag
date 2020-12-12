import { Component, Input, OnInit } from '@angular/core';
import { MatTable } from '@angular/material/table';
import { ContextService } from 'src/app/context-menu/context.service';
import { OverlayWindowModel, Phrase, TriggerAction } from 'src/app/core.model';
import { customAlphabet } from 'nanoid';
import { DialogService } from 'src/app/dialogs/dialog.service';
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const nanoid = customAlphabet( alphabet, 16 );

@Component( {
    selector: 'app-trigger-action-counter',
    templateUrl: 'trigger-action-counter.component.html',
    styleUrls: [ 'trigger-action-counter.component.scss', '../../core.scss', '../../modal.scss' ]
} )
export class TriggerActionCounterComponent implements OnInit {
    
    @Input( 'action' ) public action: TriggerAction;
    @Input( 'overlayOptions' ) public timerOverlays: OverlayWindowModel[] = [];

    constructor( public dialogService: DialogService, private contextService: ContextService ) { }

    ngOnInit() { }
    
}
