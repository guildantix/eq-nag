import { Injectable } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { ConfirmDialogComponent } from './confirm-dialog/confirm-dialog.component';
import { OverlayWindowModel } from '../core.model';
import { Observable } from 'rxjs';
import { OverlayDetailsDialogComponent } from './overlay-details-dialog/overlay-details-dialog.component';

@Injectable()
export class DialogService {

    constructor( private dialog: MatDialog ) { }










    /**
     * Displays a confirmation dialog to the user.
     * 
     * @param message The question to display to the user.
     * @param yesText The description of the action taken when the user confirms the question.
     * @param noText The description of the action taken when the user declines the question.
     * @param onClose This function is executed after the user makes their decision and the decision is passed as the confirmed parameter.
     */
    public showConfirmDialog( message: string, yesText: string, noText: string, onClose: ( confirmed: boolean ) => void ): void {
        
        let dialogRef: MatDialogRef<ConfirmDialogComponent> = this.dialog.open( ConfirmDialogComponent, {
            width: '550px',
            data: {
                message: message,
                yesMessage: yesText,
                noMessage: noText
            }
        } );

        dialogRef.afterClosed().subscribe( onClose );
        
    }










    /**
     * Shows the overlay window details.
     * 
     * @param model The overlay window model to edit.
     */
    public showOverlayDetailsDialog ( model: OverlayWindowModel ): Observable<OverlayWindowModel> {
        return this.dialog.open( OverlayDetailsDialogComponent, {
            width: '550px',
            data: model
        } ).afterClosed();
    }
    
}
