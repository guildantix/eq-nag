import { Component, OnInit, ViewChild } from '@angular/core';
import { IpcService } from 'src/app/ipc.service';
import { TriggerModel, CapturePhrase } from 'src/app/core.model';
import { animate, state, style, transition, trigger } from '@angular/animations';
import { MatTableDataSource, MatTable } from '@angular/material/table';

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
    // public expandedElement: CapturePhrase | null;
    public capturePhraseKind: string = 'Any match';
    // public dataSource = new MatTableDataSource<CapturePhrase>();
    
    @ViewChild( 'capturePhrasesTable' ) capturePhrasesTable: MatTable<any>;

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
        this.capturePhrasesTable?.renderRows();
        // this.dataSource.data = this.model.capturePhrases;
    }

    public deleteCapturePhrase ( index: number ): void {
        this.model.capturePhrases?.splice( index, 1 );
        this.capturePhrasesTable?.renderRows();
    }
}
