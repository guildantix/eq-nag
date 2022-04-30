import { Component, ElementRef, Input, OnInit, ViewChild } from '@angular/core';
import { ContextMenuModel } from 'src/app/context-menu/context-menu.model';
import { ContextService } from 'src/app/context-menu/context.service';
import { ActionTypes, FileModel, OverlayWindowModel, TimerRestartBehaviors, TriggerAction } from 'src/app/core.model';
import { ImageUtility } from 'src/app/utilities';
import { IpcService } from 'src/app/ipc.service';
import { DialogService } from 'src/app/dialogs/dialog.service';

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

    @Input( 'action' ) public action: TriggerAction;
    @Input( 'overlayOptions' ) public timerOverlays: OverlayWindowModel[] = [];
    @Input( 'alertOverlays' ) public alertOverlays: OverlayWindowModel[] = [];

    @ViewChild( 'iconFileSelector' ) private iconFileSelector: ElementRef<HTMLInputElement>;
    @ViewChild( 'audioFileSelector' ) private audioFileSelector: ElementRef<HTMLInputElement>;

    private _audioFileSelected: ( e: any ) => void = null;

    private onIconFileSelected: ( e: any ) => void = null;

    constructor( public dialogService: DialogService, private contextService: ContextService, private ipcService: IpcService ) { }

    ngOnInit() {
        this.ipcService.getAudioFiles().subscribe( files => this.audioFiles = files );
    }









    
    /**
     * Opens the file selector for the icon file for the targeted action.
     * 
     * @param action The target action.
     */
    openIconFileModal( action: TriggerAction ) {
        this.onIconFileSelected = () => {
            ImageUtility.toDataUrl( this.iconFileSelector.nativeElement.files[ 0 ] ).subscribe( dataUrl => action.timerIcon = dataUrl );
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
            .showInputDialog( 'Storage Formula', [ 'Enter the persistent storage formula for the timer duration' ], 'Persistent Storage Formula', null, this.action.storageDuration ).subscribe( value => {
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
