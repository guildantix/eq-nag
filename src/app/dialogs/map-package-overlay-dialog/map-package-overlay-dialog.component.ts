import { Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { OverlayWindowModel } from 'src/app/core.model';
import { nagId } from 'src/app/core/nag-id.util';
import { IpcService } from 'src/app/ipc.service';
import { StringUtility } from 'src/app/utilities';
import { NotificationDialogComponent } from '../notification-dialog/notification-dialog.component';
import { NotificationDialogModel, NotificationTypes } from '../notification-dialog/notification-dialog.model';

@Component( {
    selector: 'app-map-package-overlay-dialog',
    templateUrl: 'map-package-overlay-dialog.component.html',
    styleUrls: [ './map-package-overlay-dialog.component.scss', '../dialog.styles.scss' ],
} )
export class MapPackageOverlayDialogComponent implements OnInit, OnDestroy {

    public missingOverlay: OverlayWindowModel;
    public mappedOverlay: OverlayWindowModel;
    private existingOverlays: OverlayWindowModel[] = [];
    public get matchingOverlays(): OverlayWindowModel[] {
        return this.existingOverlays.filter( f => f.overlayType === this.missingOverlay.overlayType );
    }

    public useExisting: boolean = false;
    public copyOverlay: boolean = false;
    private _newOverlayId: string = null;

    public get overlayDescriptionShort(): string {
        return StringUtility.LimitLength( this.missingOverlay.description, 53, true );
    }

    constructor(
        public dialogRef: MatDialogRef<MapPackageOverlayDialogComponent>,
        private ipcService: IpcService,
        private dialog: MatDialog,
        @Inject( MAT_DIALOG_DATA ) public data: OverlayWindowModel,
    ) { }

    ngOnDestroy(): void {
        if ( this.copyOverlay && this._newOverlayId) {
            this.ipcService.disableOverlayEditMode( this._newOverlayId );
        }
    }

    ngOnInit() {
        this.missingOverlay = this.data;
        this.ipcService.getOverlayWindows().subscribe( overlays => this.existingOverlays = overlays );
    }









    
    /**
     * Displays the package overlay's description.
     */
    public displayOverlayDescription() {
        let data: NotificationDialogModel = new NotificationDialogModel();
        
        data.title = this.missingOverlay?.name ?? 'Error, missing overlay details!';
        data.message = this.missingOverlay.description;
        data.notificationType = NotificationTypes.Information;

        let ref = this.dialog.open( NotificationDialogComponent, {
            width: '550px',
            data: data,
            panelClass: 'app-dialog',
        } );
        
        ref.afterClosed().subscribe();
    }









    
    /**
     * Copies the package overlay and allows the user to move/resize the copied 
     * overlay.
     */
    public copyPackageOverlay() {
        this.copyOverlay = true;
        let newOverlay = Object.assign( new OverlayWindowModel(), this.missingOverlay );
        newOverlay.overlayId = nagId();
        this.ipcService
            .createNewOverlayWindow( newOverlay )
            .subscribe( overlayId => {

                this._newOverlayId = overlayId;
                this.ipcService.enableOverlayEditMode( this._newOverlayId );
                this.mappedOverlay = newOverlay;

                this.ipcService.overlayBoundsChanged().subscribe( e => {
                    if ( e.overlayId === this._newOverlayId ) {
                        this.mappedOverlay.x = e.bounds.x;
                        this.mappedOverlay.y = e.bounds.y;
                        this.mappedOverlay.windowWidth = e.bounds.width;
                        this.mappedOverlay.windowHeight = e.bounds.height;
                        this.mappedOverlay.displayBounds = e.displayBounds;
                        this.mappedOverlay.displayId = e.displayId;
                    }
                } );
            } );
    }









    
    /**
     * Maps the package overlay to the provided overlay.
     * 
     * @param overlay The overlay to map.
     */
    public accept( overlay: OverlayWindowModel ) {
        this.dialogRef.close( overlay );
    }









    
    /**
     * Maps the package overlay to the provided overlay, after saving changes to the position.
     * 
     * @param overlay The overlay to map.
     */
    public updateAndAccept( overlay: OverlayWindowModel ) {
        this.ipcService.updateOverlayWindow( overlay ).subscribe( success => this.dialogRef.close( overlay ) );
    }









    
    /**
     * Cancels the map package overlay and the package import process.
     */
    public cancel() {
        if ( this._newOverlayId ) {
            this.ipcService.deleteOverlayWindow( this._newOverlayId ).subscribe( deleted => this.dialogRef.close( null ) );
        } else {
            this.dialogRef.close( null );
        }
    }










}
