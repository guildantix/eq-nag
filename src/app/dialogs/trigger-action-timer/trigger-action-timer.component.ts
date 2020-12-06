import { Component, ElementRef, Input, OnInit, ViewChild } from '@angular/core';
import { MatTable } from '@angular/material/table';
import { ContextMenuModel } from 'src/app/context-menu/context-menu.model';
import { ContextService } from 'src/app/context-menu/context.service';
import { OverlayWindowModel, Phrase, TriggerAction } from 'src/app/core.model';
import { ImageUtility } from 'src/app/utilities';
import { DialogService } from '../dialog.service';
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
    public phraseTableColumns = [ 'phrase', 'regEx', 'delete' ];
    @Input( 'action' ) public action: TriggerAction;
    @Input( 'overlayOptions' ) public timerOverlays: OverlayWindowModel[] = [];
    @Input( 'alertOverlays' ) public alertOverlays: OverlayWindowModel[] = [];

    @ViewChild( 'iconFileSelector' ) private iconFileSelector: ElementRef<HTMLInputElement>;

    private onIconFileSelected: ( e: any ) => void = null;

    constructor( private dialogService: DialogService, private contextService: ContextService ) { }

    ngOnInit() { }

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

    public addNewEndEarlyPhrase( table: MatTable<any> ): void {
        let phrase: Phrase = new Phrase();
        phrase.phraseId = nanoid();
        this.action.endEarlyPhrases?.push( phrase );
        table?.renderRows();
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
}
