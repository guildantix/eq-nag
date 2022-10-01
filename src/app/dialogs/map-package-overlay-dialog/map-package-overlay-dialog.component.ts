import { Component, OnInit } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
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

    public overlayName: string = 'Tertiary Text Overlay';
    public mappedOverlay: OverlayWindowModel;
    public existingOverlays: OverlayWindowModel[] = [];

    public useExisting: boolean = false;
    public copyOverlay: boolean = false;

    constructor(
        public dialogRef: MatDialogRef<MapPackageOverlayDialogComponent>,
        private ipcService: IpcService,
        private dialog: MatDialog,
    ) { }

    ngOnInit() {
        this.ipcService.getOverlayWindows().subscribe( overlays => this.existingOverlays = overlays );
    }

    public displayOverlayDescription() {
        let data: NotificationDialogModel = new NotificationDialogModel();
        
        data.title = this.overlayName;
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
