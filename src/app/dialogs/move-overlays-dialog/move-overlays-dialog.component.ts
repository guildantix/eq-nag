import { Component, HostListener, OnInit } from '@angular/core';
import { OverlayWindowModel } from 'src/app/core.model';
import { IpcService } from 'src/app/ipc.service';
import * as _ from 'lodash-es';
import { forkJoin, Observable } from 'rxjs';

@Component( {
    selector: 'app-move-overlays-dialog',
    templateUrl: 'move-overlays-dialog.component.html',
    styleUrls: [ 'move-overlays-dialog.component.scss', '../../core.scss', '../../modal.scss' ],
} )
export class MoveOverlaysDialogComponent implements OnInit {

    private overlays: OverlayWindowModel[] = [];

    @HostListener( 'window:beforeunload' ) doSomething() {
        this.overlays.forEach( overlay => this.ipcService.disableOverlayEditMode( overlay.overlayId ) );
    }
    
    constructor( private ipcService: IpcService ) { }

    ngOnInit() {
        this.ipcService.getOverlayWindows().subscribe( overlays => {
            this.overlays = overlays;
            this.ipcService.arrangeOverlays();
        } );
    }









    
    /**
     * Closes this dialog.
     */
    closeModal(): void {
        this.ipcService.endArrangeOverlays();
        this.ipcService.closeThisChild();
    }









    
    /**
     * Cancels any changes and then closes this dialog.
     */
    cancel() {
        this.ipcService.undoOverlayPositionChanges();
        this.closeModal();
    }










    /**
     * Closes this dialog.
     */
    save() {
        this.ipcService.saveUpdatedOverlayPositions();
        this.closeModal();
    }
}
