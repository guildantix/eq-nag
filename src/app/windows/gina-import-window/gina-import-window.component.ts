import { animate, state, style, transition, trigger } from '@angular/animations';
import { Component, OnInit } from '@angular/core';
import { DialogService } from 'src/app/dialogs/dialog.service';
import { IpcService } from 'src/app/ipc.service';

@Component( {
    selector: 'app-gina-import-window',
    templateUrl: 'gina-import-window.component.html',
    styleUrls: [ 'gina-import-window.component.scss', '../../core.scss', '../../modal.scss' ],
    animations: [
        trigger( 'detailExpand', [
            state( 'collapsed', style( { height: '0px', minHeight: '0' } ) ),
            state( 'expanded', style( { height: '*' } ) ),
            transition( 'expanded <=> collapsed', animate( '225ms cubic-bezier(0.4, 0.0, 0.2, 1)' ) ),
        ] ),
    ],
} )
export class GinaImportWindowComponent implements OnInit {

    public loadingGinaConfig: boolean = false;

    constructor( private ipcService: IpcService, private dialogService: DialogService ) { }

    ngOnInit() {
        this.loadGinaConfig();
    }

    public loadGinaConfig(): void {

        this.loadingGinaConfig = true;

        this.ipcService
            .getGinaConfiguration()
            .subscribe( ginaConfig => {
                this.loadingGinaConfig = false;
                if ( ginaConfig == null ) {
                    this.dialogService.showWarningDialog( 'GINA failure', 'Could not find the GINA data directory' );
                } else {
                    console.log( 'derp', ginaConfig );
                }
            } );

    }

    public closeModal(): void {
        this.ipcService.closeThisChild();
    }

}
