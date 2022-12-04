import { AfterViewInit, Component, Inject, OnInit } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialog } from '@angular/material/dialog';
import { IpcService } from 'src/app/ipc.service';
import { ColoredString } from '../dialog.model';
// import * as Electron from 'electron';

@Component( {
    selector: 'app-monitor-select-dialog',
    templateUrl: 'monitor-select-dialog.component.html',
    styleUrls: [ 'monitor-select-dialog.component.scss' ],
} )
export class MonitorSelectDialogComponent implements OnInit {

    public displays: Electron.Display[] = [];
    public messages: ( string | ColoredString )[] = [];
    public selectedMonitorIndex: number = 1;
    public screenSpace: Electron.Rectangle;
    public get screenOrigin(): { x: number, y: number } {
        return { x: 0 - this.screenSpace.x, y: 0 - this.screenSpace.y };
    }
    public renderWidth: number = 400;
    public get renderHeight(): number {
        return this.screenSpace?.width > 0 ? ( this.renderWidth / this.screenSpace.width ) * this.screenSpace.height : 0;
    }

    constructor(
        public dialogRef: MatDialogRef<MonitorSelectDialogComponent>,
        @Inject( MAT_DIALOG_DATA ) public data: any,
        public dialog: MatDialog,
        private ipcService: IpcService ) {
        
        if ( data.message instanceof Array ) {
            this.messages = data.message;
        } else {
            this.messages.push( data.message );
        }

    }

    ngOnInit() {
        this.ipcService.getAllDisplays().subscribe( displays => {
            this.displays = displays;
            this.calculateScreenSpace();
        } );
    }

    accept() {
        let d = this.displays[ this.selectedMonitorIndex ];
        this.dialogRef.close( this.displays[ this.selectedMonitorIndex ].id );
    }

    cancel() {
        this.dialogRef.close( null );
    }

    /**
     * Calculates the full screen space of all monitors.
     */
    calculateScreenSpace() {
        let left = 0, right = 0;
        let top = 0, bottom = 0;

        this.displays.forEach( display => {

            let absLeft = display.bounds.x;
            let absRight = display.bounds.x + display.bounds.width;
            let absTop = display.bounds.y;
            let absBottom = display.bounds.y + display.bounds.height;


            left = absLeft < left ? absLeft : left;
            right = absRight > right ? absRight : right;
            top = absTop < top ? absTop : top;
            bottom = absBottom > bottom ? absBottom : bottom;

        } );

        this.screenSpace = {
            x: left,
            y: top,
            width: right - left,
            height: bottom - top,
        };
    }

    getDisplayWidth( realWidth: number ): number {
        return ( this.renderWidth / this.screenSpace?.width ) * realWidth ?? 0;
    }

    getDisplayHeight( realHeight: number ): number {
        return ( this.renderWidth / this.screenSpace?.width ) * realHeight ?? 0;
    }

    getDisplayLeft( realLeft: number ): number {
        let realPosLeft = this.screenOrigin.x + realLeft;
        return ( this.renderWidth / this.screenSpace?.width ) * realPosLeft ?? 0;
    }

    getDisplayTop( realTop: number ): number {
        let realPosTop = this.screenOrigin.y + realTop;
        return ( this.renderWidth / this.screenSpace?.width ) * realPosTop ?? 0;
    }

}
