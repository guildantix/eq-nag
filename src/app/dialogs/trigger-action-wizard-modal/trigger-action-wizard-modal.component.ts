import { Component, OnInit, Inject, OnDestroy } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { IpcService } from 'src/app/ipc.service';
import { TriggerAction, ActionTypes, OverlayWindowModel } from 'src/app/core.model';

@Component( {
    selector: 'app-confirm-dialog',
    templateUrl: 'trigger-action-wizard-modal.component.html',
    styleUrls: [ 'trigger-action-wizard-modal.component.scss', '../dialog.styles.scss', '../../core.scss' ]
} )
export class TriggerActionWizardModalComponent implements OnInit, OnDestroy {

    public model: TriggerAction;

    public ActionTypes: typeof ActionTypes = ActionTypes;
    public overlays: OverlayWindowModel[] = [];

    constructor(
        public dialogRef: MatDialogRef<TriggerActionWizardModalComponent>,
        private ipcService: IpcService,
        @Inject( MAT_DIALOG_DATA ) public data: TriggerAction ) { }
    
    ngOnDestroy(): void {
        this.ipcService.resizeTriggerWindow();
    }

    ngOnInit(): void {
        this.model = new TriggerAction();
        this.ipcService.resizeTriggerWindow( 1000, 870 );
        this.ipcService.getOverlayWindows().subscribe( overlays => this.overlays = overlays );
    }

    public highlightOverlay( overlayId: string ): void {
        this.ipcService.highlightOverlay( overlayId );
    }

    public dimOverlay( overlayId: string ): void {
        this.ipcService.dimOverlay( overlayId );
    }
    
}
