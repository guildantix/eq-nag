import { Component, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { MatTabGroup } from '@angular/material/tabs';
import { Subscription } from 'rxjs';
import { ActionTypes, availableFonts, ListObjectModel, OverlayWindowModel, Phrase, RenderTokenModel, TriggerAction } from 'src/app/core.model';
import { DialogService } from 'src/app/dialogs/dialog.service';
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

    public get listPhrases(): Phrase[] {
        return this.phrases.filter( f => f.phrase?.indexOf( '{LN}' ) > -1 );
    }

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

    public get invalidDeactivatePhrase(): boolean {

        if ( this.action.listEnrollmentDeactivatePhrase ) {
            const phrase = this.phrases.find( f => f.phraseId === this.action.listEnrollmentDeactivatePhrase );
            if ( phrase ) {
                return phrase.phrase.indexOf( '{LN}' ) === -1;
            }
        }

        return false;
    }

    public get invalidActivatePhrase(): boolean {
            
        if ( this.action.listEnrollmentActivatePhrase ) {
            const phrase = this.phrases.find( f => f.phraseId === this.action.listEnrollmentActivatePhrase );
            if ( phrase ) {
                return phrase.phrase.indexOf( '{LN}' ) === -1;
            }
        }
    
        return false;
    }

    @ViewChild( MatTabGroup, { static: true } ) tabGroup: MatTabGroup;

    constructor(
        private readonly ipcService: IpcService,
        private readonly dialogService: DialogService,
    ) { }

    ngOnInit(): void {
        if ( this.action ) {
            if ( this.action.createListPhrases ) {
                this.onListCapturePhraseChange( this.action.createListPhrases );
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

    onChangeListType(): void {
        // When changing the type of the list from auto enumeration to none, clear the auto enumeration settings.
        if ( !this.action.autoEnumerateList ) {
            this.action.listEnumerateBeginPhrase = null;
            this.action.listEnumerateEndPhrase = null;
            this.action.listTimerActionId = null;
            this.action.listEnrollmentSkipPhrase = null;
            this.action.listEnrollmentShowTimer = false;
            this.action.listEnableActionTracking = false;
            this.action.listActionTrackingPhrase = [];
            this.action.listTopTimerEnum = false;
            this.action.listBottomTimerEnum = false;
        }

        if ( !this.action.manualEnumerateList ) {
            this.action.listEnumerateBeginPhrase = null;
            this.action.listEnumerateEndPhrase = null;
            this.action.listTopTimerClearOnDeactivate = false;
            this.action.listBottomTimerClearOnDeactivate = false;
        }
    }









    
    /**
     * Selects the top timer tab if the top timer is enabled, otherwise
     * selects the timers tab.
     */
    selectTopTimerTab(): void {
        if ( this.action.listEnableTopTimer ) {
            this.tabGroup.selectedIndex = 4;
        } else {
            // Select the Timers tab.
            this.tabGroup.selectedIndex = 3;
        }
    }









    
    /**
     * Selects the bottom timer tab if the top timer is disabled, otherwise
     * selects the top timer tab.
     */
    selectBottomTimerTab(): void {
        let i = this.action.listEnableTopTimer ? 5 : 4;
        if ( this.action.listEnableBottomTimer ) {
            this.tabGroup.selectedIndex = i;
        } else {
            // Select the Timers tab.
            this.tabGroup.selectedIndex = 3;
        }
    }
    








    
    /**
     * When the user changes the action to create a list, this sets the
     * action variable names.
     * 
     * @param phraseId The phrase ID that is selected for the action.
     */
    onListCapturePhraseChange( phraseIds: string[] ): void {
        if ( !phraseIds || phraseIds.length === 0 ) {
            this.variableNames = [];
            this.action.createListPhrases = [];
            return;
        }
        
        /** @type{string[]} */
        let variables = [];
        let validPhrase = true;
        let validVariables = true;

        phraseIds.forEach( phraseId => {
            const phrase = this.phrases.find( f => f.phraseId === phraseId );

            // https://regex101.com/r/0oqQFD/1
            let phraseVariables = StringUtility.MatchAll( phrase.phrase, /(?:\(\?\<(?<variableName>\S+?)\>.+?\))/gi, 'variableName' );

            if ( variables.length > 0 ) {
                validVariables = variables.length === phraseVariables.length && variables.every( v => phraseVariables.includes( v ) );
            } else {
                variables = phraseVariables;
            }
        } );
        
        if ( !validPhrase ) {
            return;
        } else if ( !validVariables || variables.length === 0 ) {
            this.dialogService.showErrorDialog( 'Invalid Phrases', 'The selected phrases must contain at least 1 variable, and must containe the same variables.' );
            return;
        }

        this.variableNames = variables;
    }









    
    /**
     * When the user changes the action to skip a phrase, this sets the
     * action variable names.
     * 
     * @param phraseId The phrase ID that is selected for the action.
     */
    onSkipCapturePhraseChange( phraseId: string ): void {
        
        if ( !phraseId ) {
            this.skipVariableNames = [];
            this.action.listEnrollmentSkipVarName = null;
            return;
        }

        const phrase = this.phrases.find( f => f.phraseId === phraseId );

        if ( !phrase ) {
            return;
        }

        // https://regex101.com/r/0oqQFD/1
        let variables = StringUtility.MatchAll( phrase.phrase, /(?:\(\?\<(?<variableName>\S+?)\>.+?\))/gi, 'variableName' );
        // https://regex101.com/r/do6cil/2
        variables = Array.prototype.concat( variables, StringUtility.MatchAll( phrase.phrase, /\{(?<variableName>\S+?)\}/gi, 'variableName' ) );

        this.skipVariableNames = variables;
    }









    
    /**
     * When the user changes the action to remove a phrase, this sets the
     * action variable names.
     * 
     * @param phraseId The phrase ID that is selected for the action.
     */
    onRemoveCapturePhraseChange( phraseId: string ): void {

        if ( !phraseId ) {
            this.removeVariableNames = [];
            this.action.listEnrollmentRemoveVarName = null;
            return;
        }

        const phrase = this.phrases.find( f => f.phraseId === phraseId );

        if ( !phrase ) {
            return;
        }

        // https://regex101.com/r/0oqQFD/1
        let variables = StringUtility.MatchAll( phrase.phrase, /(?:\(\?\<(?<variableName>\S+?)\>.+?\))/gi, 'variableName' );
        // https://regex101.com/r/do6cil/2
        variables = Array.prototype.concat( variables, StringUtility.MatchAll( phrase.phrase, /\{(?<variableName>\S+?)\}/gi, 'variableName' ) );

        this.removeVariableNames = variables;
    }









    
    /**
     * When the user changes the action to add a phrase, this sets the
     * action variable names.
     * 
     * @param phraseId The phrase ID that is selected for the action.
     */
    onAddCapturePhraseChange( phraseId: string ): void {

        
        if ( !phraseId ) {
            this.addVariableNames = [];
            this.action.listEnrollmentAddVarName = null;
            return;
        }

        const phrase = this.phrases.find( f => f.phraseId === phraseId );

        if ( !phrase ) {
            return;
        }

        // https://regex101.com/r/0oqQFD/1
        let variables = StringUtility.MatchAll( phrase.phrase, /(?:\(\?\<(?<variableName>\S+?)\>.+?\))/gi, 'variableName' );
        // https://regex101.com/r/do6cil/2
        variables = Array.prototype.concat( variables, StringUtility.MatchAll( phrase.phrase, /\{(?<variableName>\S+?)\}/gi, 'variableName' ) );

        this.addVariableNames = variables;
    }









    
    /**
     * When the user changes the action tracking phrases, this sets the
     * action tracking variable names.
     * 
     * @param phraseIds The phrase IDs that are selected for the action tracking.
     */
    onActionTrackingPhraseChange( phraseIds: string[] ): void {
            
        if ( !phraseIds || phraseIds.length === 0 ) {
            this.actionTrackingVariableNames = [];
            this.action.listActionTrackingVarName = null;
            return;
        }
    
        let variables: string[] = [];
        for ( let i = 0; i < phraseIds.length; i++ ) {
            const phraseId = phraseIds[ i ];
            const phrase = this.phrases.find( f => f.phraseId === phraseId );

            if ( !phrase ) {
                continue;
            }

            // https://regex101.com/r/0oqQFD/1
            let vs = StringUtility.MatchAll( phrase.phrase, /(?:\(\?\<(?<variableName>\S+?)\>.+?\))/gi, 'variableName' );
            // https://regex101.com/r/do6cil/2
            vs = Array.prototype.concat( vs, StringUtility.MatchAll( phrase.phrase, /\{(?<variableName>\S+?)\}/gi, 'variableName' ) );

            for (let vi = 0; vi < vs.length; vi++) {
                const v = vs[ vi ];
                if ( i === 0 || variables.includes( v ) ) {
                    variables.push( v );
                }
            }
        }
    
        this.actionTrackingVariableNames = variables;
    }









    
    /**
     * When the user changes the auto-enumeration time, this sets the 
     * variable to false.
     */
    onChangeAutoEnumerationSpecifyTime(): void {
        if ( this.action.autoEnumerateSpecifyTime ) {
            this.action.autoEnumerateUseVariable = false;
        }
    }









    
    /**
     * When the user changes the auto-enumeration variable, this sets the 
     * specify time to false.
     */
    onChangeAutoEnumerationVariable(): void {
        if ( this.action.autoEnumerateUseVariable ) {
            this.action.autoEnumerateSpecifyTime = false;
        }
    }









    
    /**
     * Shows the renderer token for the action.
     */
    showRendererToken(): void {
        let token = this.generateRenderToken();

        this.tokenSubscription = this.ipcService
            .renderActionToken( token )
            .subscribe( changeEventArgs => {
                this.action.staticPosition = changeEventArgs.bounds;
            } );
    }









    
    /**
     * Destroys the renderer token and unsubscribes from the token subscription.
     */
    destroyRendererToken(): void {
        this.tokenSubscription.unsubscribe();
        this.tokenSubscription = null;
        this.ipcService.destroyActionToken( this.action.actionId );
    }









    
    /**
     * Updates the render token with the latest changes to the action.
     */
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
