import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { ActionTypes, availableFonts, ListObjectModel, OverlayWindowModel, Phrase, RenderTokenModel, TriggerAction } from 'src/app/core.model';
import { IpcService } from 'src/app/ipc.service';
import { StringUtility } from 'src/app/utilities';

@Component( {
    selector: 'app-trigger-action-list',
    templateUrl: './trigger-action-list.component.html',
    styleUrls: [ './trigger-action-list.component.scss' ]
} )
export class TriggerActionListComponent implements OnInit, OnDestroy {
    
    @Input( 'action' ) public action: TriggerAction;
    @Input( 'triggerId' ) public triggerId: string;
    @Input( 'triggerActions' ) public actionOptions: TriggerAction[] = [];
    @Input( 'overlayOptions' ) public timerOverlays: OverlayWindowModel[] = [];
    @Input( 'alertOverlays' ) public alertOverlays: OverlayWindowModel[] = [];
    @Input( 'phrases' ) public phrases: Phrase[] = [];

    public variableNames: string[] = [];
    public skipVariableNames: string[] = [];
    public removeVariableNames: string[] = [];
    public addVariableNames: string[] = [];
    public actionTrackingVariableNames: string[] = [];
    public tokenSubscription: Subscription | null = null;
    public fontWeightIndex: number = 0;
    public actionTypes: typeof ActionTypes = ActionTypes;

    public get timerTypeActions(): TriggerAction[] {
        return this.actionOptions.filter( f => f.actionId && ( f.actionType === ActionTypes.Timer || f.actionType === ActionTypes.Countdown ) );
    }

    public get isRenderingToken(): boolean {
        return this.tokenSubscription ? true : false;
    }

    public get fontFamily(): string {
        if ( this.action.textUseCustomFont && this.action.textFont ) {
            return `${this.action.textFont}`;
        } else {
            return null;
        }
    }

    public get fontWeight(): string {
        if ( this.action.textUseCustomFont && this.action.textWeight ) {
            return `${this.action.textWeight}`;
        } else {
            return null;
        }
    }
    
    public get maxFontWeightIndex(): number {
        if ( this.fontFamily != null ) {
            return availableFonts[ this.fontFamily ].length - 1;
        } else {
            return 1;
        }
    }

    constructor(
        private readonly ipcService: IpcService,
    ) { }

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
            if ( this.action.listActionTrackingPhrase ) {
                this.onActionTrackingPhraseChange( this.action.listActionTrackingPhrase );
            }
        }
        window.addEventListener( 'beforeunload', () => this.ngOnDestroy() );
    }

    ngOnDestroy(): void {
        if ( this.isRenderingToken ) {
            this.destroyRendererToken();
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

    onActionTrackingPhraseChange( phraseId: string ): void {
            
        if ( !phraseId ) {
            this.actionTrackingVariableNames = [];
            this.action.listActionTrackingVarName = null;
            return;
        }
    
        const phrase = this.phrases.find( f => f.phraseId === phraseId );
        // https://regex101.com/r/0oqQFD/1
        let variables = StringUtility.MatchAll( phrase.phrase, /(?:\(\?\<(?<variableName>\S+?)\>.+?\))/gi, 'variableName' );
        // https://regex101.com/r/do6cil/2
        variables = Array.prototype.concat( variables, StringUtility.MatchAll( phrase.phrase, /\{(?<variableName>\S+?)\}/gi, 'variableName' ) );
    
        this.actionTrackingVariableNames = variables;
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

    private generateRenderToken(): RenderTokenModel {
        let token = new RenderTokenModel();

        token.actionId = this.action.actionId;
        token.triggerId = this.triggerId;
        token.actionType = this.action.actionType;

        if ( this.action.actionType === ActionTypes.List ) {
            token.objectModel = new ListObjectModel();
            token.objectModel.listTitle = this.action.displayText;
            token.objectModel.fontSize = this.action.textSize;
            token.objectModel.fontFamily = this.action.textFont;
            token.objectModel.fontWeight = this.action.textWeight;
            token.objectModel.listCssClass = this.action.useBackground ? 'background' : 'no-background';
            token.objectModel.items = [
                { name: 'Player 1', iconCssClass: 'fa-chevron-right', textCssClass: 'success' },
                { name: 'Player 2' },
                { name: 'Player 3' },
                { name: 'Player 4' },
                { name: 'Player 5' },
                { name: 'Player 6' },
                { name: 'Player 7' },
            ];

            if ( this.action.staticPosition != null ) {
                token.objectModel.bounds = this.action.staticPosition;
            }
        }

        return token;
    }

    showRendererToken(): void {
        let token = this.generateRenderToken();

        this.tokenSubscription = this.ipcService
            .renderActionToken( token )
            .subscribe( changeEventArgs => {
                this.action.staticPosition = changeEventArgs.bounds;
            } );
    }

    destroyRendererToken(): void {
        this.tokenSubscription.unsubscribe();
        this.tokenSubscription = null;
        this.ipcService.destroyActionToken( this.action.actionId );
    }

    updateRenderToken(): void {
        if ( !this.isRenderingToken ) {
            return;
        }
        let token = this.generateRenderToken();
        this.ipcService.updateActionToken( token );
    }

    /**
     * When the user changes the font family, this loads the selected font 
     * family's availabe properties.
     */
    public onChangeFontFamily(): void {
        let fi: number = availableFonts[ this.fontFamily ].indexOf( this.action.textWeight );
        this.fontWeightIndex = -1;

        if ( fi > -1 ) {
            this.fontWeightIndex = fi;

        } else {

            for ( let i = 100; i < 500; i += 100 ) {
                let lfi: number = availableFonts[ this.fontFamily ].indexOf( this.action.textWeight - i );
                let ufi: number = availableFonts[ this.fontFamily ].indexOf( this.action.textWeight + i );
                if ( lfi > -1 ) {
                    this.fontWeightIndex = lfi;
                    break;
                } else if ( ufi > -1 ) {
                    this.fontWeightIndex = ufi;
                    break;
                }
            }
            
        }

        this.fontWeightIndex = this.fontWeightIndex > -1 ? this.fontWeightIndex : 0;

        this.updateRenderToken();
    }

    /**
     * Changes the preview's font weight value based on the selected font 
     * weight index.
     */
    onFontWeightChange(): void {
        this.action.textWeight = availableFonts[ this.fontFamily ][ this.fontWeightIndex ];

        this.updateRenderToken();
    }

}
