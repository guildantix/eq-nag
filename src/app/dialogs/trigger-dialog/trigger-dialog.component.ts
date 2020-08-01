import { Component, OnInit, ViewChild } from '@angular/core';
import { IpcService } from 'src/app/ipc.service';
import { TriggerModel, CapturePhrase, ActionTypes, TriggerAction } from 'src/app/core.model';
import { animate, state, style, transition, trigger } from '@angular/animations';
import { MatTableDataSource, MatTable } from '@angular/material/table';
import { ActivatedRoute } from '@angular/router';
import { DialogService } from '../dialog.service';
// import { NgForm } from '@angular/forms';

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
    // public expandedElement: CapturePhrase | null;
    // public capturePhraseKind: string = 'Any match';
    // public dataSource = new MatTableDataSource<CapturePhrase>();
    
    @ViewChild( 'capturePhrasesTable' ) capturePhrasesTable: MatTable<any>;
    // @ViewChild( 'actionsTable' ) actionsTable: MatTable<any>;

    constructor( private ipcService: IpcService, private route: ActivatedRoute, private dialogService: DialogService ) { }

    ngOnInit() {
        this.model = new TriggerModel();

        this.route.params.subscribe( params => {
            
            this.triggerId = params[ 'id' ];

            if ( this.triggerId != null ) {
                this.ipcService.getTrigger( this.triggerId ).subscribe( trigger => {
                    this.model = trigger;
                    console.log( 'result', trigger );
                } );
            }
     
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
        this.model.capturePhrases.push( new CapturePhrase() );
        this.capturePhrasesTable?.renderRows();
        // this.dataSource.data = this.model.capturePhrases;
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
        // this.actionsTable?.renderRows();
        // this.dataSource.data = this.model.capturePhrases;
    }

    public deleteAction( index: number ): void {
        this.dialogService.showConfirmDialog(
            'Are you certain you want to delete this action?',
            'Click "Yes" to delete the action.',
            'Click "No" to cancel and close this dialog without deleting the action.',
            ( confirmed ) => {
                if ( confirmed ) {
                    this.model.actions?.splice( index, 1 );
                    // this.actionsTable?.renderRows();
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
