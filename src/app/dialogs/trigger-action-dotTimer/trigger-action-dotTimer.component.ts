import { Component, ElementRef, Input, OnInit, ViewChild } from '@angular/core';
import { CharacterClasses, CharacterClassLevel, FileModel, OverlayWindowModel, Phrase, TriggerAction, TriggerModel } from 'src/app/core.model';
import { ImageUtility } from 'src/app/utilities';
import { DialogService } from '../dialog.service';
import * as _ from 'lodash';
import { ContextMenuModel } from 'src/app/context-menu/context-menu.model';
import { ContextService } from 'src/app/context-menu/context.service';
import { MatTable } from '@angular/material/table';
import { customAlphabet } from 'nanoid';
import { IpcService } from 'src/app/ipc.service';
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const nanoid = customAlphabet( alphabet, 16 );

@Component( {
    selector: 'app-trigger-action-dotTimer',
    templateUrl: 'trigger-action-dotTimer.component.html',
    styleUrls: [ 'trigger-action-dotTimer.component.scss', '../../core.scss', '../../modal.scss' ]
} )
export class TriggerActionDotTimerComponent implements OnInit {

    public Math: typeof Math = Math;
    public phraseTableColumns = [ 'phrase', 'regEx', 'delete' ];
    public audioFiles: FileModel[] = [];
    @Input( 'action' ) public action: TriggerAction;
    @Input( 'trigger' ) public model: TriggerModel;
    @Input( 'overlayOptions' ) public timerOverlays: OverlayWindowModel[] = [];
    @Input( 'alertOverlays' ) public alertOverlays: OverlayWindowModel[] = [];

    @ViewChild( 'iconFileSelector' ) private iconFileSelector: ElementRef<HTMLInputElement>;
    @ViewChild( 'audioFileSelector' ) private audioFileSelector: ElementRef<HTMLInputElement>;

    private _audioFileSelected: ( e: any ) => void = null;

    private onIconFileSelected: ( e: any ) => void = null;

    constructor( private dialogService: DialogService, private contextService: ContextService, private ipcService: IpcService ) { }

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

    public addClassLevel(): void {
        this.model.classLevels = this.model.classLevels ? this.model.classLevels : [];
        this.model.classLevels.push( new CharacterClassLevel() );
    }

    public deleteClassLevel( index: number ): void {
        let classLabel: string = _.find( Object.keys( CharacterClasses ), f => CharacterClasses[ f ] === this.model.classLevels[ index ].class );
        let action = () => this.model.classLevels?.splice( index, 1 );

        if ( classLabel ) {
            this.dialogService.showConfirmDialog(
                `Are you certain you want to remove ${classLabel} from this trigger?`,
                'Click "Yes" to remove this class.',
                'Click "No" to cancel and close this dialog without removing the class.',
                ( confirmed ) => {
                    if ( confirmed ) {
                        action();
                    }
                } );
        } else {
            action();
        }
        
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

    public addNewExclusionTarget( table: MatTable<any> ): void {
        let phrase: Phrase = new Phrase();
        phrase.phraseId = nanoid();
        this.action.excludeTargets?.push( phrase );
        table?.renderRows();
    }

    public addNewEndEarlyPhrase( table: MatTable<any> ): void {
        let phrase: Phrase = new Phrase();
        phrase.phraseId = nanoid();
        this.action.endEarlyPhrases?.push( phrase );
        table?.renderRows();
    }

    public deleteExcludePhrase( deleteIndex: number, table: MatTable<any> ): void {
        this.dialogService.showConfirmDialog(
            'Are you certain you want to delete this exclusion?',
            'Click "Yes" to delete the exclusion.',
            'Click "No" to cancel and close this dialog without deleting the exclusion.',
            ( confirmed ) => {
                if ( confirmed ) {
                    this.action.excludeTargets?.splice( deleteIndex, 1 );
                    table?.renderRows();
                }
            } );
    }

    public deleteEndEarlyPhrase( deleteIndex: number, table: MatTable<any> ): void {
        this.dialogService.showConfirmDialog(
            'Are you certain you want to delete this phrase?',
            'Click "Yes" to delete the phrase.',
            'Click "No" to cancel and close this dialog without deleting the phrase.',
            ( confirmed ) => {
                if ( confirmed ) {
                    this.action.endEarlyPhrases?.splice( deleteIndex, 1 );
                    table?.renderRows();
                }
            } );
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
