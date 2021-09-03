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
    private noChangesOverlays: OverlayWindowModel[];

    @HostListener( 'window:beforeunload' ) doSomething() {
        this.overlays.forEach( overlay => this.ipcService.disableOverlayEditMode( overlay.overlayId ) );
    }
    
    constructor( private ipcService: IpcService ) { }

    ngOnInit() {
        this.ipcService.getOverlayWindows().subscribe( overlays => {
            this.overlays = overlays;
            this.noChangesOverlays = _.cloneDeep( overlays );

            this.overlays.forEach( overlay => this.ipcService.enableOverlayEditMode( overlay.overlayId ) );
        } );
    }









    
    /**
     * Closes this dialog.
     */
    closeModal(): void {
        this.ipcService.closeThisChild();
    }









    
    /**
     * Cancels any changes and then closes this dialog.
     */
    cancel() {
        this.ipcService.updateOverlaysPositions( this.noChangesOverlays ).subscribe( updated => {
            this.closeModal();
        } );
    }










    /**
     * Closes this dialog.
     */
    save() {
        this.closeModal();
    }
}
