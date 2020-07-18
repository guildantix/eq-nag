import { Component, OnInit } from '@angular/core';
import { IpcService } from 'src/app/ipc.service';
import { TriggerModel, CapturePhrase } from 'src/app/core.model';

@Component( {
    selector: 'app-trigger-dialog',
    templateUrl: 'trigger-dialog.component.html',
    styleUrls: ['trigger-dialog.component.scss', '../../core.scss', '../../modal.scss']
} )
export class TriggerDialogComponent implements OnInit {

    public model: TriggerModel;
    public phraseTableColumns = ['phrase'];
    
    constructor( private ipcService: IpcService ) { }

    ngOnInit () {
        this.model = new TriggerModel();
        this.addNewCapturePhrase();
    }

    public closeModal (): void {
        this.ipcService.closeNewTriggerDialog();
    }

    public onChangeTabs ( index: number ): void {
        
    }

    public addNewCapturePhrase (): void {
        this.model.capturePhrases.push( new CapturePhrase() );
    }
}
