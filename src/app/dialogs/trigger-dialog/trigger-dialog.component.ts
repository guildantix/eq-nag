import { Component, OnInit } from '@angular/core';
import { IpcRenderer } from 'electron';

@Component( {
    selector: 'app-trigger-dialog',
    templateUrl: 'trigger-dialog.component.html',
    styleUrls: ['trigger-dialog.component.scss', '../../core.scss', '../../modal.scss']
} )
export class TriggerDialogComponent implements OnInit {
    
    private ipc: IpcRenderer;

    constructor() {
        if ( ( <any>window ).require ) {
            try {
                this.ipc = ( <any>window ).require( 'electron' ).ipcRenderer;
            } catch ( e ) {
                throw e;
            }
        } else {
            console.warn( 'App not running inside Electron!' );
        }
    }

    ngOnInit () { }

    public closeModal (): void {
        this.ipc.send( 'trigger:dialog:close' );
    }

    public onChangeTabs ( index: number ): void {
        
    }
}
