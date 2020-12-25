import { Injectable } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { ConfirmDialogComponent } from './confirm-dialog/confirm-dialog.component';
import { OverlayWindowModel, ScrapedSpell, TriggerAction, TriggerFolder, TriggerModel } from '../core.model';
import { Observable } from 'rxjs';
import { OverlayDetailsDialogComponent } from './overlay-details-dialog/overlay-details-dialog.component';
import { TriggerActionWizardModalComponent } from './trigger-action-wizard-modal/trigger-action-wizard-modal.component';
import { NewTriggerDialogComponent } from './new-trigger-dialog/new-trigger-dialog.component';
import { NewCharacterDialogComponent } from './new-character-dialog/new-character-dialog.component';
import { SelectIconDialogComponent } from './select-icon-dialog/select-icon-dialog.component';
import { NewTriggerFolderDialogComponent } from './new-trigger-folder-dialog/new-trigger-folder-dialog.component';
import { SelectTriggerFolderDialogComponent } from './select-trigger-folder-dialog/select-trigger-folder-dialog.component';
import { InputDialogComponent } from './input-dialog/input-dialog.component';
import { InputDialogModel } from './input-dialog/input-dialog.model';
import { NotificationDialogModel, NotificationTypes } from './notification-dialog/notification-dialog.model';
import { NotificationDialogComponent } from './notification-dialog/notification-dialog.component';
import { AutocompleteDialogModel } from './autocomplete-dialog/autocomplete-dialog.model';
import { AutoCompleteDialogComponent } from './autocomplete-dialog/autocomplete-dialog.component';
import { NewTriggerRaidAbilityComponent } from './new-trigger-raid-ability/new-trigger-raid-ability.component';
import { NewTriggerDialogModel } from './dialog.model';

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
    public showConfirmDialog( message: string | string[], yesText: string, noText: string, onClose: ( confirmed: boolean ) => void ): void {
        
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
     * Displays the trigger action wizard.
     * 
     * @param model The trigger action to edit/create.
     * @param onClose This function is executed after the user makes changes.  If the model is null, the user cancelled their changes.
     */
    public showTriggerActionWizardDialog( model: TriggerAction, onClose: ( model: TriggerAction ) => void ): void {
        
        let dialogRef: MatDialogRef<TriggerActionWizardModalComponent> = this.dialog.open( TriggerActionWizardModalComponent, {
            width: '750px',
            data: model
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










    /**
     * Opens the new dot timer trigger dialog.
     */
    public showNewDotTimerDialog(): void {
        this.dialog.open( NewTriggerDialogComponent, {
            width: '750px'
        } ).afterClosed();
    }










    /**
     * Opens the new dot timer trigger dialog.
     */
    public showNewRaidAbilityDialog( folderId?: string ): void {
        this.dialog.open( NewTriggerRaidAbilityComponent, {
            width: '750px',
            data: <NewTriggerDialogModel>{ selectedFolderId: folderId, trigger: null }
        } ).afterClosed();
    }










    /**
     * Opens the new dot timer trigger dialog.
     */
    public showReimportDotTimerDialog( model: TriggerModel ): void {
        this.dialog.open( NewTriggerDialogComponent, {
            width: '750px',
            data: model,
        } ).afterClosed();
    }










    /**
     * Opens the new dot timer trigger dialog.
     */
    public showReimportRaidAbilityDialog( model: TriggerModel ): void {
        this.dialog.open( NewTriggerRaidAbilityComponent, {
            width: '750px',
            data: <NewTriggerDialogModel>{ selectedFolderId: null, trigger: model }
        } ).afterClosed();
    }










    /**
     * Opens the new character dialog.
     */
    public showNewCharacterDialog( afterClosed: (characterId: string) => void ): void {
        this.dialog.open( NewCharacterDialogComponent, {
            width: '750px'
        } ).afterClosed().subscribe( afterClosed );
    }










    /**
     * Opens the new character dialog.
     */
    public showNewTriggerFolderDialog(): Observable<TriggerFolder> {
        return this.dialog.open<NewTriggerFolderDialogComponent, any, TriggerFolder>( NewTriggerFolderDialogComponent, {
            width: '750px'
        } ).afterClosed();
    }










    /**
     * Opens the select trigger folder dialog.
     * 
     * @returns Returns the selected parent folder id.  If the selected parent 
     *      folder id is the same as the given folder id, then the user has 
     *      selected 'No parent' as their option.
     * 
     * @param folderId If moving a folder, this is the id of the folder to be moved.
     */
    public showSelectTriggerFolderDialog( folderId?: string ): Observable<string> {
        return this.dialog.open<SelectTriggerFolderDialogComponent, any, string>( SelectTriggerFolderDialogComponent, {
            width: '450px',
            data: { folderId: folderId }
        } ).afterClosed();
    }










    /**
     * Opens the new character dialog.
     */
    public showSelectIconDialog( afterClosed: ( icon: string ) => void ): void {
        this.dialog.open( SelectIconDialogComponent, {
            width: '750px'
        } ).afterClosed().subscribe( afterClosed );
    }










    /**
     * Opens the new character dialog.
     */
    public showIconDialog( iconIndex: number, afterClosed: ( icon: string ) => void ): void {
        this.dialog.open( SelectIconDialogComponent, {
            width: '750px',
            data: {
                iconIndex: iconIndex,
            }
        } ).afterClosed().subscribe( afterClosed );
    }










    /**
     * Shows a simple dialog with an input.
     * 
     * @param title The title for the dialog.
     * @param message Instructions to the user.
     * @param label Placeholder/label for the input.
     * @param hint Any additional information related to the request and how to fulfill it.
     */
    public showInputDialog( title: string, message: string | string[], label?: string, hint?: string, ): Observable<string> {
        let data: InputDialogModel = new InputDialogModel();
        
        data.title = title;
        data.message = message;
        data.label = label;
        data.hint = hint;

        return this.dialog.open<InputDialogComponent, any, string>( InputDialogComponent, {
            width: '450px',
            data: data
        } ).afterClosed();
    }










    /**
     * Shows a simple dialog with an input with an autocomplete.
     * 
     * @param title The title for the dialog.
     * @param message Instructions to the user.
     * @param options The available options.
     * @param label Placeholder/label for the input.
     * @param hint Any additional information related to the request and how to fulfill it.
     */
    public showAutocompleteDialog( title: string, message: string | string[], options: string[], label?: string, hint?: string, ): Observable<string> {
        let data: AutocompleteDialogModel = new AutocompleteDialogModel();
        
        data.title = title;
        data.message = message;
        data.label = label;
        data.hint = hint;
        data.options = options;

        return this.dialog.open<AutoCompleteDialogComponent, any, string>( AutoCompleteDialogComponent, {
            width: '450px',
            data: data
        } ).afterClosed();
        
    }
    









    public showWarningDialog( title: string, message: string | string[] ): void {
        let data: NotificationDialogModel = new NotificationDialogModel();
        
        data.title = title;
        data.message = message;
        data.notificationType = NotificationTypes.Warning;

        this.dialog.open( NotificationDialogComponent, {
            width: '450px',
            data: data
        } ).afterClosed().subscribe();
    }
    
    public showInfoDialog( title: string, message: string | string[] ): void {
        let data: NotificationDialogModel = new NotificationDialogModel();
        
        data.title = title;
        data.message = message;
        data.notificationType = NotificationTypes.Information;

        this.dialog.open( NotificationDialogComponent, {
            width: '450px',
            data: data
        } ).afterClosed().subscribe();
    }
    
    public showErrorDialog( title: string, message: string | string[] ): void {
        let data: NotificationDialogModel = new NotificationDialogModel();
        
        data.title = title;
        data.message = message;
        data.notificationType = NotificationTypes.Error;

        this.dialog.open( NotificationDialogComponent, {
            width: '450px',
            data: data
        } ).afterClosed().subscribe();
    }
    
}
