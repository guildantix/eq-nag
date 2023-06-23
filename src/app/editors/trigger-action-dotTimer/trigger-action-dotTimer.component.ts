import { Component, ElementRef, Input, OnInit, ViewChild } from '@angular/core';
import { CapturePhrase, FileModel, OverlayWindowModel, TimerRestartBehaviors, TriggerAction } from 'src/app/core.model';
import { ImageUtility } from 'src/app/utilities';
import * as _ from 'lodash-es';
import { ContextMenuModel } from 'src/app/context-menu/context-menu.model';
import { ContextService } from 'src/app/context-menu/context.service';
import { IpcService } from 'src/app/ipc.service';
import { DialogService } from 'src/app/dialogs/dialog.service';

@Component( {
    selector: 'app-trigger-action-dotTimer',
    templateUrl: 'trigger-action-dotTimer.component.html',
    styleUrls: [ 'trigger-action-dotTimer.component.scss', '../../core.scss', '../../modal.scss' ]
} )
export class TriggerActionDotTimerComponent implements OnInit {

    public Math: typeof Math = Math;
    public audioFiles: FileModel[] = [];
    public timerRestartBehaviors: typeof TimerRestartBehaviors = TimerRestartBehaviors;
    @Input( 'action' ) public action: TriggerAction;
    @Input( 'overlayOptions' ) public timerOverlays: OverlayWindowModel[] = [];
    @Input( 'alertOverlays' ) public alertOverlays: OverlayWindowModel[] = [];
    @Input( 'capturePhrases' ) public capturePhrases: CapturePhrase[] = [];

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
            if ( this.iconFileSelector.nativeElement?.files?.length > 0 ) {
                ImageUtility.toDataUrl( this.iconFileSelector.nativeElement.files[ 0 ] ).subscribe( dataUrl => action.timerIcon = dataUrl );
            }
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

}
