import { Component, Input, OnInit } from '@angular/core';
import { MatTable } from '@angular/material/table';
import { ContextService } from 'src/app/context-menu/context.service';
import { OverlayWindowModel, Phrase, TriggerAction } from 'src/app/core.model';
import { DialogService } from '../dialog.service';
import { customAlphabet } from 'nanoid';
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const nanoid = customAlphabet( alphabet, 16 );

@Component( {
    selector: 'app-trigger-action-counter',
    templateUrl: 'trigger-action-counter.component.html',
    styleUrls: [ 'trigger-action-counter.component.scss', '../../core.scss', '../../modal.scss' ]
} )
export class TriggerActionCounterComponent implements OnInit {
    
    public phraseTableColumns = [ 'phrase', 'regEx', 'delete' ];
    @Input( 'action' ) public action: TriggerAction;
    @Input( 'overlayOptions' ) public timerOverlays: OverlayWindowModel[] = [];

    constructor( private dialogService: DialogService, private contextService: ContextService ) { }

    ngOnInit() { }

    public addNewResetCounterPhrase( table: MatTable<any> ): void {
        let phrase: Phrase = new Phrase();
        phrase.phraseId = nanoid();
        this.action.resetCounterPhrases?.push( phrase );
        table?.renderRows();
    }

    public deleteResetCounterPhrase( deleteIndex: number, table: MatTable<any> ): void {
        this.dialogService.showConfirmDialog(
            'Are you certain you want to delete this phrase?',
            'Click "Yes" to delete the phrase.',
            'Click "No" to cancel and close this dialog without deleting the phrase.',
            ( confirmed ) => {
                if ( confirmed ) {
                    this.action.resetCounterPhrases?.splice( deleteIndex, 1 );
                    table?.renderRows();
                }
            } );
    }
    
}
