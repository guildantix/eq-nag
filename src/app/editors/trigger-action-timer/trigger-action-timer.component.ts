import { Component, ElementRef, Input, OnInit, ViewChild } from '@angular/core';
import { ContextMenuModel } from 'src/app/context-menu/context-menu.model';
import { ContextService } from 'src/app/context-menu/context.service';
import { ActionTypeIcons, ActionTypeLabels, ActionTypes, FileModel, OverlayWindowModel, Phrase, TimerRestartBehaviors, TriggerAction, TriggerSubAction } from 'src/app/core.model';
import { ImageUtility, StringUtility } from 'src/app/utilities';
import { IpcService } from 'src/app/ipc.service';
import { DialogService } from 'src/app/dialogs/dialog.service';
import * as _ from 'lodash-es';

@Component( {
    selector: 'app-trigger-action-timer',
    templateUrl: 'trigger-action-timer.component.html',
    styleUrls: [ 'trigger-action-timer.component.scss', '../../core.scss', '../../modal.scss' ]
} )
export class TriggerActionTimerComponent implements OnInit {
    
    public Math: typeof Math = Math;
    public audioFiles: FileModel[] = [];
    public actionTypes: typeof ActionTypes = ActionTypes;
    public timerRestartBehaviors: typeof TimerRestartBehaviors = TimerRestartBehaviors;
    public actionTypeLabels = ActionTypeLabels;
    public actionTypeIcons = ActionTypeIcons;

    @Input( 'action' ) public action: TriggerAction;
    @Input( 'triggerActions' ) public actionOptions: TriggerAction[] = [];
    @Input( 'overlayOptions' ) public timerOverlays: OverlayWindowModel[] = [];
    @Input( 'alertOverlays' ) public alertOverlays: OverlayWindowModel[] = [];
    @Input( 'phrases' ) public phrases: Phrase[] = [];

    @ViewChild( 'iconFileSelector' ) private iconFileSelector: ElementRef<HTMLInputElement>;
    @ViewChild( 'audioFileSelector' ) private audioFileSelector: ElementRef<HTMLInputElement>;

    private _audioFileSelected: ( e: any ) => void = null;

    private onIconFileSelected: ( e: any ) => void = null;

    constructor( public dialogService: DialogService, private contextService: ContextService, private ipcService: IpcService ) { }

    ngOnInit() {
        this.ipcService.getAudioFiles().subscribe( files => this.audioFiles = files );
    }

    public actionLabel( action: TriggerAction ): string {
        let actionTypeLabel = ActionTypeLabels( action.actionType );
        return actionTypeLabel;
    }

    public actionDesc( action: TriggerAction ): String {
        return action.displayText;
    }

    public addSubAction( property: TriggerSubAction[] ) {
        property.unshift( new TriggerSubAction() );
        console.log( 'testing', property );
    }

    public removeSubAction( property: TriggerSubAction[], index: number ) {
        property.splice( index, 1 );
    }

    public assignSubAction( subAction: TriggerSubAction, action: TriggerAction ) {
        subAction.actionId = action.actionId;

        // {TS} in the phrase is dynamic duration, variableName == duration
        // search properties: displayText, if phrase captures {TS}, excludeTargets, endEarlyPhrases, resetCounterPhrases.

        // TODO: Executing a counter sub-action should increment the counter.

        // Notes:
        //  *  Named groups will match against ${name_of_group} and indexed results will 
        //  *  match against #{index}
        
        // https://regex101.com/r/wX7lp1/1
        // ${ - Named literal
        // #{ - Indexed literal
        
        // +{ - Counter value >>-----> counters are stored globally, so this is not needed.

        // Discover non-matching variables.
        // We have to scan all properties of the action for variable uses.
        let subActionVariableNames = TriggerAction.findVariableNames( action );
        let actionVariableNames = TriggerAction.findVariableNames( this.action );

        let missingVariableNames = subActionVariableNames.filter( f => actionVariableNames.indexOf( f ) === -1 );
        missingVariableNames.forEach( v => {
            subAction.variableValues.push( {
                name: v,
                value: '',
            } );
        } );
        
    }

    public getSubActionAction( actionId: string ): TriggerAction {
        return this.actionOptions.find( f => f.actionId === actionId );
    }

    public helpVariableAssignment() {
        // This sub-action uses variables from capture phrases that are not available in all of the phrases that trigger the calling action.

        // When an action executes another action, you have the triggered action, which is the action executed by a capture phrase, and the executed action, which is executed by the triggered action (for example, when a timer ends it can execute another action).
        // Variable assignment allows actions to execute other actions even if the triggered action is missing variables used by the executed action.
        // When this happens, we can assign override values to the unused variables.
        // For example, if the triggerd action is missing a value for {timerName}, you could assign the value of "Timer" to the executed action's {timerName}.
        this.dialogService.showInfoDialog(
            'Variable Assignment', [
                // 'This sub-action uses variables from capture phrases that are not available in all of the phrases that trigger the calling action.',
                // 'When this happens, we can assign override values to the unused variables.',
                'When an action executes another action, you have the triggered action, which is the action executed by a capture phrase, and the executed action, which is executed by the triggered action (for example, when a timer ends it can execute another action).', 
                'Variable assignment allows actions to execute other actions even if the triggered action is missing variables used by the executed action.', 
                'For example, if the triggerd action is missing a value for {timerName}, you could assign the value of "Timer" (or "${timerDescription}" if the triggered action has a variabled named "timerDescription") to the executed action\'s {timerName}.',
            ] );
    }









    
    /**
     * Opens the file selector for the icon file for the targeted action.
     * 
     * @param action The target action.
     */
    openIconFileModal( action: TriggerAction ) {
        this.onIconFileSelected = () => {
            if ( this.iconFileSelector.nativeElement?.files?.length > 0 ) {
                ImageUtility.toDataUrl( this.iconFileSelector.nativeElement.files[ 0 ] ).subscribe( dataUrl => action.timerIcon = dataUrl );
            }
        };
        this.iconFileSelector.nativeElement.click();
    }









    
    /**
     * Opens the EQ Spell Icon modal to select an icon for the targeted action.
     * 
     * @param action The target action.
     */
    public selectEqSpellIcon( action: TriggerAction ): void {
        this.dialogService.showSelectIconDialog( icon => {
            if ( icon != null ) {
                action.timerIcon = icon;
            }
        } );
    }









    
    /**
     * Opens an input dialog for the user to enter a storage formula.
     */
    public enterStorageDurationFormula() {
        this.dialogService
            .showInputDialog( 'Timer Storage Duration', [ 'Enter the persistent storage formula, or stored variable name, for the timer duration' ], 'Persistent Storage Formula / Stored Variable Name', null, this.action.storageDuration ).subscribe( value => {
                if ( value !== null ) {
                    // This is weird, but if the user clicks on cancel, the 
                    // dialog returns exactly null. However, if they delete 
                    // the content of the input and hit Ok, then we assume 
                    // they intend to remove the storageDuration.
                    this.action.storageDuration = value ?? null;
                }
            } );
    }









    
    /**
     * Executes the on icon file selected dynamic event handler.
     * 
     * @param e The file input event args.
     */
    iconFileSelected( e: any ) {
        this.onIconFileSelected( e );
        this.onIconFileSelected = null;
    }









    
    /**
     * Returns the right-click menu for the targeted action.
     * 
     * @param action The targeted action.
     */
    public getActionEndedCtxMenu( action: TriggerAction ): ContextMenuModel[] {
        return [ <ContextMenuModel>{
            label: 'Copy Timer Ended Properties',
            action: () => this.contextService.copyActionEndedProperties( action ),
            disabled: () => false,
            hide: () => false,
            matIcon: 'content_copy',
        }, <ContextMenuModel>{
            label: 'Paste Timer Ended Properties',
            action: () => this.contextService.pasteActionEndedProperties( action ),
            disabled: () => !this.contextService.hasActionEnded,
            hide: () => false,
            matIcon: 'content_paste',
        } ];
    }









    
    /**
     * Copies the trigger action properties to the clipboard.
     * 
     * @param action The source trigger action.
     */
    public copyActionEndedProperties( action: TriggerAction ): void {
        this.contextService.copyActionEndedProperties( action );
    }









    
    /**
     * Pastes the clipboard trigger action properties to the target action.
     * 
     * @param action The target trigger action.
     */
    public pasteActionEndedProperties( action: TriggerAction ): void {
        this.contextService.pasteActionEndedProperties( action );
    }









    
    /**
     * Opens the file selector for the ending audio file.
     */
    public openEndingAudioFileModal() {
        this._audioFileSelected = () => {
            this.ipcService
                .saveAudioFile( this.audioFileSelector.nativeElement.files[ 0 ] )
                .subscribe( fileId => {
                    this.ipcService.getAudioFiles().subscribe( files => {
                        this.audioFiles = files;
                        this.action.endingPlayAudioFileId = fileId;
                    } );
                } );
        };
        this.audioFileSelector.nativeElement.click();
    }









    
    /**
     * Opens the file selector for the ended audio file.
     */
    public openEndedAudioFileModal() {
        this._audioFileSelected = () => {
            this.ipcService
                .saveAudioFile( this.audioFileSelector.nativeElement.files[ 0 ] )
                .subscribe( fileId => {
                    this.ipcService.getAudioFiles().subscribe( files => {
                        this.audioFiles = files;
                        this.action.endedPlayAudioFileId = fileId;
                    } );
                } );
        };
        this.audioFileSelector.nativeElement.click();
    }









    
    /**
     * Executes the on audio file selected dynamic event handler.
     * 
     * @param e The file input event args.
     */
    public onAudioFileSelected( e: any ) {
        this._audioFileSelected( e );
        this._audioFileSelected = null;
    }









    
    /**
     * Plays the specified audio file.
     * 
     * @param fileId The id of the desired audio file.
     */
    public playAudioFile( fileId: string ): void {
        if ( fileId ) {

            this.ipcService.getAudioFileUrl( fileId ).subscribe( url => {
                if ( url ) {
                    let player = new Audio( url );
                    player.play();
                }
            } );
            
        }
    }










    /**
     * Shows the hide timer conditions dialog.
     */
    public editHideTimerConditions(): void {
        this.dialogService.showNamedGroupConditionsDialog( 'Edit hide conditions', [ 'If you only want to hide the timer under specific conditions, you can enter them here.', 'These conditions evaluate based on the named groups in the capture phrase regular expression.' ], this.action.hideConditions ).subscribe( conditions => this.action.hideConditions = conditions );
    }

}
