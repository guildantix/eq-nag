import { Component, ElementRef, Input, OnInit, ViewChild } from '@angular/core';
import { MatTable } from '@angular/material/table';
import { ContextMenuModel } from 'src/app/context-menu/context-menu.model';
import { ContextService } from 'src/app/context-menu/context.service';
import { ActionTypes, FileModel, OverlayWindowModel, Phrase, TimerRestartBehaviors, TriggerAction } from 'src/app/core.model';
import { ImageUtility } from 'src/app/utilities';
import { IpcService } from 'src/app/ipc.service';
import { DialogService } from 'src/app/dialogs/dialog.service';
import { customAlphabet } from 'nanoid';
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const nanoid = customAlphabet( alphabet, 16 );

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

    public copyActionEndedProperties( action: TriggerAction ): void {
        this.contextService.copyActionEndedProperties( action );
    }

    public pasteActionEndedProperties( action: TriggerAction ): void {
        this.contextService.pasteActionEndedProperties( action );
    }

    public openEndingAudioFileModal() {
        this._audioFileSelected = e => {
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

    public openEndedAudioFileModal() {
        this._audioFileSelected = e => {
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

    public onAudioFileSelected( e: any ) {
        this._audioFileSelected( e );
        this._audioFileSelected = null;
    }

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

    public editHideTimerConditions(): void {
        this.dialogService.showNamedGroupConditionsDialog( 'Edit hide conditions', [ 'If you only want to hide the timer under specific conditions, you can enter them here.', 'These conditions evaluate based on the named groups in the capture phrase regular expression.' ], this.action.hideConditions ).subscribe( conditions => this.action.hideConditions = conditions );
    }

}
