import { Component, Inject, OnInit } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { OverlayWindowModel } from 'src/app/core.model';
import { IpcService } from 'src/app/ipc.service';
import { NotificationDialogComponent } from '../notification-dialog/notification-dialog.component';
import { NotificationDialogModel, NotificationTypes } from '../notification-dialog/notification-dialog.model';

@Component( {
    selector: 'app-map-package-overlay-dialog',
    templateUrl: 'map-package-overlay-dialog.component.html',
    styleUrls: [ './map-package-overlay-dialog.component.scss' ],
} )
export class MapPackageOverlayDialogComponent implements OnInit {

    public missingOverlay: OverlayWindowModel;
    public mappedOverlay: OverlayWindowModel;
    public existingOverlays: OverlayWindowModel[] = [];

    public useExisting: boolean = false;
    public copyOverlay: boolean = false;

    constructor(
        public dialogRef: MatDialogRef<MapPackageOverlayDialogComponent>,
        private ipcService: IpcService,
        private dialog: MatDialog,
        @Inject( MAT_DIALOG_DATA ) public data: OverlayWindowModel,
    ) { }

    ngOnInit() {
        this.missingOverlay = this.data;
        this.ipcService.getOverlayWindows().subscribe( overlays => this.existingOverlays = overlays );
    }

    public displayOverlayDescription() {
        let data: NotificationDialogModel = new NotificationDialogModel();
        
        data.title = this.missingOverlay?.name ?? 'Error, missing overlay details!';
        // TODO: Add the overlay description to this message.
        data.message = 'Overlay descriptions have not been implemented yet!';
        data.notificationType = NotificationTypes.Information;

        let ref = this.dialog.open( NotificationDialogComponent, {
            width: '550px',
            data: data,
            panelClass: 'app-dialog',
        } );
        
        ref.afterClosed().subscribe();

        return ref;
    }

    public accept( overlay: OverlayWindowModel ) {
        this.dialogRef.close( overlay );
    }

    public cancel() {
        this.dialogRef.close( null );
    }

}
