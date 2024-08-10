import { Component, Input, OnInit } from '@angular/core';
import { OverlayWindowModel, Phrase, TriggerAction } from 'src/app/core.model';
import { StringUtility } from 'src/app/utilities';

@Component( {
    selector: 'app-trigger-action-list',
    templateUrl: './trigger-action-list.component.html',
    styleUrls: [ './trigger-action-list.component.scss' ]
} )
export class TriggerActionListComponent implements OnInit {
    
    @Input( 'action' ) public action: TriggerAction;
    @Input( 'triggerActions' ) public actionOptions: TriggerAction[] = [];
    @Input( 'overlayOptions' ) public timerOverlays: OverlayWindowModel[] = [];
    @Input( 'alertOverlays' ) public alertOverlays: OverlayWindowModel[] = [];
    @Input( 'phrases' ) public phrases: Phrase[] = [];

    public variableNames: string[] = [];

    constructor() { }

    ngOnInit(): void {
        if ( this.action ) {
            if ( this.action.createListPhrase ) {
                this.onListCapturePhraseChange( this.action.createListPhrase );
            }
        }
    }
    
    onListCapturePhraseChange( phraseId: string ): void {
        const phrase = this.phrases.find( f => f.phraseId === phraseId );
        // https://regex101.com/r/0oqQFD/1
        let variables = StringUtility.MatchAll( phrase.phrase, /(?:\(\?\<(?<variableName>\S+?)\>.+?\))/gi, 'variableName' );
        // https://regex101.com/r/do6cil/2
        variables = Array.prototype.concat( variables, StringUtility.MatchAll( phrase.phrase, /\{(?<variableName>\S+?)\}/gi, 'variableName' ) );

        this.variableNames = variables;
    }

}
