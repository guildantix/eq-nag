import { AfterViewInit, Component, Inject, OnInit } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialog } from '@angular/material/dialog';
import { IpcService } from 'src/app/ipc.service';
import { ColoredString } from '../dialog.model';
// import * as Electron from 'electron';

@Component( {
    selector: 'app-monitor-select-dialog',
    templateUrl: 'monitor-select-dialog.component.html',
    styleUrls: [ 'monitor-select-dialog.component.scss', '../dialog.styles.scss' ],
} )
export class MonitorSelectDialogComponent implements OnInit {

    public messages: ( string | ColoredString )[] = [];
    public renderWidth: number = 400;
    public selectedDisplay: Electron.Display | null = null;
    public defaultDisplayId: number | null = null;

    constructor(
        public dialogRef: MatDialogRef<MonitorSelectDialogComponent>,
        @Inject( MAT_DIALOG_DATA ) public data: any,
        public dialog: MatDialog ) {
        
        if ( data.message instanceof Array ) {
            this.messages = data.message;
        } else {
            this.messages.push( data.message );
        }

        this.defaultDisplayId = data.displayId;
    }

    ngOnInit() { }









    
    /**
     * Closes the monitor select dialog and sends the monitor id.
     */
    accept() {
        this.dialogRef.close( this.selectedDisplay?.id ?? null );
    }









    
    /**
     * Closes the monitor select dialog without selecting a monitor.
     */
    cancel() {
        this.dialogRef.close( null );
    }










}
