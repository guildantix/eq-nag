import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { ActionTypes, CapturePhrase, OverlayWindowModel, TriggerAction } from 'src/app/core.model';
import { DialogService } from 'src/app/dialogs/dialog.service';
import { IpcService } from 'src/app/ipc.service';

@Component( {
    selector: 'app-trigger-actions',
    templateUrl: 'trigger-actions.component.html',
    styleUrls: ['trigger-actions.component.scss', '../../core.scss', '../../modal.scss']
} )
export class TriggerActionsComponent implements OnInit {

    @Input() public actions: TriggerAction[];
    @Output() public actionsChange: EventEmitter<TriggerAction[]> = new EventEmitter<TriggerAction[]>();

    @Input() public isDev: boolean = false;
    @Input() public predefined: boolean = false;
    @Input() public capturePhrases: CapturePhrase[] = [];

    public actionTypes: typeof ActionTypes = ActionTypes;
    public overlays: OverlayWindowModel[] = [];
    
    public get alertOverlays(): OverlayWindowModel[] {
        return this.overlays.filter( f => f.overlayType === 'Alert' );
    }

    public get logOverlays(): OverlayWindowModel[] {
        return this.overlays.filter( f => f.overlayType === 'Log' );
    }

    public get timerOverlays(): OverlayWindowModel[] {
        return this.overlays.filter( f => f.overlayType === 'Timer' );
    }

    constructor( private dialogService: DialogService, private ipcService: IpcService ) { }

    ngOnInit() {
        
        this.ipcService.getOverlayWindows().subscribe( overlays => this.overlays = overlays );

    }

    public addNewAction(): void {
        this.actions.push( new TriggerAction() );
        this.actionsChange.emit( this.actions );
    }

    // public showActionWizard( action: TriggerAction ): void {
    //     this.dialogService.showTriggerActionWizardDialog( action, model => console.log( 'model', model ) );
    // }

    public deleteAction( index: number ): void {
        this.dialogService.showConfirmDialog(
            'Are you certain you want to delete this action?',
            'Click "Yes" to delete the action.',
            'Click "No" to cancel and close this dialog without deleting the action.',
            ( confirmed ) => {
                if ( confirmed ) {
                    this.actions?.splice( index, 1 );
                    this.actionsChange.emit( this.actions );
                }
            } );
    }

}