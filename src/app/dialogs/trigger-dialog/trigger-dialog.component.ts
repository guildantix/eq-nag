import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';

import { IpcService } from 'src/app/ipc.service';
import { TriggerModel, CapturePhrase, ActionTypes, TriggerAction, OverlayWindowModel, OperatorTypes, TriggerCondition, TriggerConditionTypes, Phrase } from 'src/app/core.model';
import { animate, state, style, transition, trigger } from '@angular/animations';
import { MatTableDataSource, MatTable } from '@angular/material/table';
import { ActivatedRoute } from '@angular/router';
import { DialogService } from '../dialog.service';
import { customAlphabet } from 'nanoid';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ColorUtility, ImageUtility } from 'src/app/utilities';
// import { NgForm } from '@angular/forms';
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const nanoid = customAlphabet( alphabet, 16 );

@Component( {
    selector: 'app-trigger-dialog',
    templateUrl: 'trigger-dialog.component.html',
    styleUrls: [ 'trigger-dialog.component.scss', '../../core.scss', '../../modal.scss' ],
    animations: [
        trigger( 'detailExpand', [
            state( 'collapsed', style( { height: '0px', minHeight: '0' } ) ),
            state( 'expanded', style( { height: '*' } ) ),
            transition( 'expanded <=> collapsed', animate( '225ms cubic-bezier(0.4, 0.0, 0.2, 1)' ) ),
        ] ),
    ],
} )
export class TriggerDialogComponent implements OnInit {

    public model: TriggerModel;
    public capturePhraseTableColumns = [ 'moveIndex', 'number', 'phrase', 'regEx', 'delete' ];
    public phraseTableColumns = [ 'phrase', 'regEx', 'delete' ];
    public actionTableColumns = [ 'number', 'actionType', 'delete' ];
    public conditionTableColumns = [ 'variable', 'operator', 'value', 'delete' ];
    public triggerId: string = null;
    public actionTypes: typeof ActionTypes = ActionTypes;
    public operatorTypes: typeof OperatorTypes = OperatorTypes;
    public overlays: OverlayWindowModel[] = [];
    public storedVariables: string[] = [];
    public Math: typeof Math = Math;
    public isDev: boolean = false;

    public get alertOverlays(): OverlayWindowModel[] {
        return this.overlays.filter( f => f.overlayType === 'Alert' );
    }

    public get logOverlays(): OverlayWindowModel[] {
        return this.overlays.filter( f => f.overlayType === 'Log' );
    }

    public get timerOverlays(): OverlayWindowModel[] {
        return this.overlays.filter( f => f.overlayType === 'Timer' );
    }
    
    @ViewChild( 'capturePhrasesTable' ) capturePhrasesTable: MatTable<any>;
    @ViewChild( 'conditionsTable' ) conditionsTable: MatTable<any>;
    @ViewChild( 'iconFileSelector' ) private iconFileSelector: ElementRef<HTMLInputElement>;

    private onIconFileSelected: ( e: any ) => void = null;

    constructor( private ipcService: IpcService, private route: ActivatedRoute, private dialogService: DialogService, private snackBar: MatSnackBar ) { }

    ngOnInit() {
        this.model = new TriggerModel();

        this.route.params.subscribe( params => {
            
            this.triggerId = params[ 'id' ];

            if ( this.triggerId != null ) {
                this.ipcService.getTrigger( this.triggerId ).subscribe( trigger => {
                    this.model = trigger;
                } );
            }

            this.ipcService.getOverlayWindows().subscribe( overlays => this.overlays = overlays );
            this.ipcService.getStoredVariables().subscribe( variables => this.storedVariables = variables );
     
            // In a real app: dispatch action to load the details here.
        } );
        this.addNewCapturePhrase();
        this.ipcService.getAppIsDev().subscribe( isDev => this.isDev = isDev );
    }

    // public hasNamedCaptureGroups( phraseIds: string[] ): boolean {
    //     // let rgx = /\(\?\<(.+?)\>.*?\)/gi;
    //     // https://regex101.com/r/9yssac/1
    //     // ^(?<target>.*) has taken (?<damage>[0-9]*) ?damage from your Funeral Pyre of Kelador\.
    //     // 0: (2) ["?<target>", "target", index: 2, input: "^(?<target>.*) has taken (?<damage>[0-9]*) ?damage from your Funeral Pyre of Kelador\.", groups: undefined]
    //     //    0: ...
    //     //    1: target
    //     // 1: (2) ["?<damage>", "damage", index: 26, input: "^(?<target>.*) has taken (?<damage>[0-9]*) ?damage from your Funeral Pyre of Kelador\.", groups: undefined]
    //     //    0: ...
    //     //    1: damage
    //     let result = false;
    //     phraseIds?.forEach( id => {
    //         let index = this.model.capturePhrases.findIndex( f => f.phraseId === id );
    //         let phrase = this.model.capturePhrases[ index ];
    //         let allMatches = [ ...phrase.phrase.matchAll( /\(\?\<(.+?)\>.*?\)/gi ) ];
            
    //         if ( allMatches?.length > 0 ) {
    //             result = true;
    //         }

    //     } );
    //     return result;
    // }

    // public getNamedCaptureGroups( phraseIds: string[] ): void {
        
    // }

    public closeModal(): void {
        this.ipcService.closeThisChild();
    }

    public onChangeTabs( index: number ): void {
        
    }

    public addNewCapturePhrase(): void {
        let phrase: CapturePhrase = new CapturePhrase();
        phrase.phraseId = nanoid();
        this.model.capturePhrases.push( phrase );
        this.capturePhrasesTable?.renderRows();
    }

    public addNewExclusionTarget( actionIndex: number, table: MatTable<any> ): void {
        let phrase: Phrase = new Phrase();
        phrase.phraseId = nanoid();
        this.model.actions[actionIndex].excludeTargets?.push( phrase );
        table?.renderRows();
    }

    public deleteCapturePhrase( index: number ): void {
        this.dialogService.showConfirmDialog(
            'Are you certain you want to delete this capture phrase?',
            'Click "Yes" to delete the capture phrase.',
            'Click "No" to cancel and close this dialog without deleting the capture phrase.',
            ( confirmed ) => {
                if ( confirmed ) {
                    this.model.capturePhrases?.splice( index, 1 );
                    this.capturePhrasesTable?.renderRows();
                }
            } );
    }

    public deleteExcludePhrase( actionIndex: number, deleteIndex: number, table: MatTable<any> ): void {
        this.dialogService.showConfirmDialog(
            'Are you certain you want to delete this exclusion?',
            'Click "Yes" to delete the exclusion.',
            'Click "No" to cancel and close this dialog without deleting the exclusion.',
            ( confirmed ) => {
                if ( confirmed ) {
                    this.model.actions[ actionIndex ].excludeTargets?.splice( deleteIndex, 1 );
                    table?.renderRows();
                }
            } );
    }

    public addNewAction(): void {
        this.model.actions.push( new TriggerAction() );
    }

    public showActionWizard( action: TriggerAction ): void {
        this.dialogService.showTriggerActionWizardDialog( action, model => console.log( 'model', model ) );
    }

    public deleteAction( index: number ): void {
        this.dialogService.showConfirmDialog(
            'Are you certain you want to delete this action?',
            'Click "Yes" to delete the action.',
            'Click "No" to cancel and close this dialog without deleting the action.',
            ( confirmed ) => {
                if ( confirmed ) {
                    this.model.actions?.splice( index, 1 );
                }
            } );
    }

    public addNewCondition(): void {
        let condition: TriggerCondition = new TriggerCondition();
        condition.conditionType = TriggerConditionTypes.VariableValue;
        this.model.conditions.push( condition );
        this.conditionsTable?.renderRows();
    }

    public deleteCondition( index: number ): void {
        this.dialogService.showConfirmDialog(
            'Are you certain you want to delete this condition?',
            'Click "Yes" to delete the condition.',
            'Click "No" to cancel and close this dialog without deleting the condition.',
            ( confirmed ) => {
                if ( confirmed ) {
                    this.model.conditions?.splice( index, 1 );
                    this.conditionsTable?.renderRows();
                }
            } );
    }

    public save(): void {
        this.model.actions?.forEach( ( action: TriggerAction ) => {
            if ( action.useCustomColor === true ) {
                action.overrideTimerColor = action.overrideTimerColor;
                action.timerBackgroundColor = ColorUtility.FromHex( action.overrideTimerColor ).darken( 0.93 ).toString( 0.75 );
            } else {
                action.overrideTimerColor = null;
                action.timerBackgroundColor = null;
            }

            if ( action.ifEndingSoon === true && action.endingDuration > 0 ) {
                if ( action.endingSoonChangeColor === true ) {
                    action.endingSoonBackgroundColor = ColorUtility.FromHex( action.endingSoonColor ).darken( 0.93 ).toString( 0.75 );
                } else {
                    action.endingSoonBackgroundColor = null;
                }
            } else {
                action.endingDuration = null;
                action.endingSoonColor = null;
            }

            if ( action.remainAfterEnded === true && action.remainDuration > 0 ) {
                if ( action.endedChangeColor === true ) {
                    action.endedBackgroundColor = ColorUtility.FromHex( action.endedColor ).darken( 0.93 ).toString( 0.75 );
                } else {
                    action.endedBackgroundColor = null;
                }
            } else {
                action.remainAfterEnded = false;
                action.remainDuration = null;
                action.endedColor = null;
                action.endedBackgroundColor = null;
            }

        } );
        if ( this.triggerId == null ) {
            this.ipcService.createNewTrigger( this.model ).subscribe( triggerId => { } );
            this.closeModal();
        } else {
            this.ipcService.updateTrigger( this.model ).subscribe( success => { } );
            this.closeModal();
        }
    }

    public movePhraseUp( index: number ): void {
        if ( index > 0 ) {
            this.model.capturePhrases.splice( index - 1, 0, this.model.capturePhrases.splice( index, 1 )[ 0 ] );
            this.capturePhrasesTable?.renderRows();
        }
    }

    public movePhraseDown( index: number ): void {
        if ( index < this.model.capturePhrases.length - 1 ) {
            this.model.capturePhrases.splice( index + 1, 0, this.model.capturePhrases.splice( index, 1 )[ 0 ] );
            this.capturePhrasesTable?.renderRows();
        }
    }

    public copyJson(): void {
        this.ipcService.sendTextToClipboard( JSON.stringify( this.model ) );
        this.snackBar.open( 'Trigger details copied!', 'Dismiss', { duration: 5000 } );
    }

    openIconFileModal( action: TriggerAction ) {
        this.onIconFileSelected = e => {
            ImageUtility.toDataUrl( this.iconFileSelector.nativeElement.files[ 0 ] ).subscribe( dataUrl => action.timerIcon = dataUrl );
            // console.log( 'found', action.actionId, this.iconFileSelector.nativeElement.files[ 0 ].path );
            // action.timerIcon = this.iconFileSelector.nativeElement.files[ 0 ].path;
        };
        this.iconFileSelector.nativeElement.click();
    }

    public selectEqSpellIcon( action: TriggerAction ): void {
        this.dialogService.showSelectIconDialog( icon => {
            if ( icon != null ) {
                action.timerIcon = icon;
            }
        } );
    }

    iconFileSelected( e: any ) {
        this.onIconFileSelected( e );
        this.onIconFileSelected = null;
        // console.log( 'testing', typeof e);
        // this.ipcService.updateLogFile( this.iconFileSelector.nativeElement.files[ 0 ].path );
    }

}
