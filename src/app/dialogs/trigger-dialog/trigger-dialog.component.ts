import { Component, OnInit } from '@angular/core';
import { IpcService } from 'src/app/ipc.service';

@Component( {
    selector: 'app-trigger-dialog',
    templateUrl: 'trigger-dialog.component.html',
    styleUrls: ['trigger-dialog.component.scss', '../../core.scss', '../../modal.scss']
} )
export class TriggerDialogComponent implements OnInit {
    
    constructor( private ipcService: IpcService ) { }

    ngOnInit () { }

    public closeModal (): void {
        this.ipcService.closeNewTriggerDialog();
    }

    public onChangeTabs ( index: number ): void {
        
    }
}
