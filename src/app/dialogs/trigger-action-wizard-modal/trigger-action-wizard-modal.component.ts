import { Component, OnInit, Inject, OnDestroy } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { IpcService } from 'src/app/ipc.service';
import { TriggerAction } from 'src/app/core.model';

@Component( {
    selector: 'app-confirm-dialog',
    templateUrl: 'trigger-action-wizard-modal.component.html',
    styleUrls: [ 'trigger-action-wizard-modal.component.scss' ]
} )
export class TriggerActionWizardModalComponent implements OnInit, OnDestroy {

    constructor(
        public dialogRef: MatDialogRef<TriggerActionWizardModalComponent>,
        private ipcService: IpcService,
        @Inject( MAT_DIALOG_DATA ) public data: TriggerAction ) { }
    
    ngOnDestroy(): void {
        // this.ipcService.resizeTriggerWindow();
    }

    ngOnInit(): void {
        // this.ipcService.resizeTriggerWindow( 1000, 870 );
    }
    
}
