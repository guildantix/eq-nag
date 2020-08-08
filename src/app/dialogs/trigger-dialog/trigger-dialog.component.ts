import { Component, OnInit, ViewChild } from '@angular/core';

import { IpcService } from 'src/app/ipc.service';
import { TriggerModel, CapturePhrase, ActionTypes, TriggerAction, OverlayWindowModel } from 'src/app/core.model';
import { animate, state, style, transition, trigger } from '@angular/animations';
import { MatTableDataSource, MatTable } from '@angular/material/table';
import { ActivatedRoute } from '@angular/router';
import { DialogService } from '../dialog.service';
import { customAlphabet } from 'nanoid';
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
    public phraseTableColumns = [ 'number', 'phrase', 'regEx', 'delete' ];
    public actionTableColumns = [ 'number', 'actionType', 'delete' ];
    public triggerId: string = null;
    public actionTypes: typeof ActionTypes = ActionTypes;
    public overlays: OverlayWindowModel[] = [];

    public get logOverlays(): OverlayWindowModel[] {
        return this.overlays.filter( f => f.overlayType === 'Log' );
    }
    
    @ViewChild( 'capturePhrasesTable' ) capturePhrasesTable: MatTable<any>;

    constructor( private ipcService: IpcService, private route: ActivatedRoute, private dialogService: DialogService ) { }

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
     
            // In a real app: dispatch action to load the details here.
        } );
        this.addNewCapturePhrase();
    }

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

    public save(): void {
        if ( this.triggerId == null ) {
            this.ipcService.createNewTrigger( this.model ).subscribe( triggerId => { } );
            this.closeModal();
        } else {
            this.ipcService.updateTrigger( this.model ).subscribe( success => { } );
            this.closeModal();
        }
    }
}
