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
    public skipVariableNames: string[] = [];
    public removeVariableNames: string[] = [];
    public addVariableNames: string[] = [];

    constructor() { }

    ngOnInit(): void {
        if ( this.action ) {
            if ( this.action.createListPhrase ) {
                this.onListCapturePhraseChange( this.action.createListPhrase );
            }
            if ( this.action.listEnrollmentSkipPhrase ) {
                this.onSkipCapturePhraseChange( this.action.listEnrollmentSkipPhrase );
            }
            if ( this.action.listEnrollmentRemovePhrase ) {
                this.onRemoveCapturePhraseChange( this.action.listEnrollmentRemovePhrase );
            }
            if ( this.action.listEnrollmentAddPhrase ) {
                this.onAddCapturePhraseChange( this.action.listEnrollmentAddPhrase );
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

    onSkipCapturePhraseChange( phraseId: string ): void {
        
        if ( !phraseId ) {
            this.skipVariableNames = [];
            this.action.listEnrollmentSkipVarName = null;
            return;
        }

        const phrase = this.phrases.find( f => f.phraseId === phraseId );
        // https://regex101.com/r/0oqQFD/1
        let variables = StringUtility.MatchAll( phrase.phrase, /(?:\(\?\<(?<variableName>\S+?)\>.+?\))/gi, 'variableName' );
        // https://regex101.com/r/do6cil/2
        variables = Array.prototype.concat( variables, StringUtility.MatchAll( phrase.phrase, /\{(?<variableName>\S+?)\}/gi, 'variableName' ) );

        this.skipVariableNames = variables;
    }

    onRemoveCapturePhraseChange( phraseId: string ): void {

        if ( !phraseId ) {
            this.removeVariableNames = [];
            this.action.listEnrollmentRemoveVarName = null;
            return;
        }

        const phrase = this.phrases.find( f => f.phraseId === phraseId );
        // https://regex101.com/r/0oqQFD/1
        let variables = StringUtility.MatchAll( phrase.phrase, /(?:\(\?\<(?<variableName>\S+?)\>.+?\))/gi, 'variableName' );
        // https://regex101.com/r/do6cil/2
        variables = Array.prototype.concat( variables, StringUtility.MatchAll( phrase.phrase, /\{(?<variableName>\S+?)\}/gi, 'variableName' ) );

        this.removeVariableNames = variables;
    }

    onAddCapturePhraseChange( phraseId: string ): void {

        if ( !phraseId ) {
            this.addVariableNames = [];
            this.action.listEnrollmentAddVarName = null;
            return;
        }

        const phrase = this.phrases.find( f => f.phraseId === phraseId );
        // https://regex101.com/r/0oqQFD/1
        let variables = StringUtility.MatchAll( phrase.phrase, /(?:\(\?\<(?<variableName>\S+?)\>.+?\))/gi, 'variableName' );
        // https://regex101.com/r/do6cil/2
        variables = Array.prototype.concat( variables, StringUtility.MatchAll( phrase.phrase, /\{(?<variableName>\S+?)\}/gi, 'variableName' ) );

        this.addVariableNames = variables;
    }

    onChangeAutoEnumerationSpecifyTime(): void {
        if ( this.action.autoEnumerateSpecifyTime ) {
            this.action.autoEnumerateUseVariable = false;
        }
    }

    onChangeAutoEnumerationVariable(): void {
        if ( this.action.autoEnumerateUseVariable ) {
            this.action.autoEnumerateSpecifyTime = false;
        }
    }

}
