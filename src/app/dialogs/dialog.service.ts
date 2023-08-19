import { Injectable, NgZone, OnDestroy } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { ConfirmDialogComponent } from './confirm-dialog/confirm-dialog.component';
import { ExternalDataSources, OverlayWindowModel, QuickShareFileModel, QuickShareMetaModel, ScrapedSpell, TriggerAction, TriggerCondition, TriggerFolder, TriggerModel } from '../core.model';
import { Observable, Observer } from 'rxjs';
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
import { ColoredString, NewTriggerDialogModel, PrepareQuickShareModel } from './dialog.model';
import { NewTriggerBuffDialogComponent } from './new-trigger-buff-dialog/new-trigger-buff-dialog.component';
import { NamedGroupConditionsModel } from './named-group-conditions-dialog/named-group-conditions.model';
import { NamedGroupConditionsDialogComponent } from './named-group-conditions-dialog/named-group-conditions-dialog.component';
import { PrepareQuickShareDialogComponent } from './quick-share/prepare-quick-share.component';
import { ReceiveQuickShareDialogComponent } from './quick-share/receive-quick-share.component';
import { DeathRecapDialogComponent } from './death-recap-dialog/death-recap-dialog.component';
import { MapPackageOverlayDialogComponent } from './map-package-overlay-dialog/map-package-overlay-dialog.component';
import { ActionOverlayReviewModel, ActionOverlayUseModel, OverlayReassignments } from './action-overlay-reassignment-dialog/action-overlay-reassignment.model';
import { ActionOverlayReassignmentDialogComponent } from './action-overlay-reassignment-dialog/action-overlay-reassignment-dialog.component';
import * as _ from 'lodash-es';
import { MonitorSelectDialogComponent } from './monitor-select-dialog/monitor-select-dialog.component';
import { QuestionDialogAnswerModel, QuestionDialogModel } from './question-dialog/question-dialog.model';
import { QuestionDialogComponent } from './question-dialog/question-dialog.component';

@Injectable()
export class DialogService {

    /**
     * Workaround to prevent expression error when modals are closed.
     */
    private _afc = () => {
        if ( document.activeElement instanceof HTMLElement ) {
            // This is a workaround to prevent the error:
            // 
            //      ExpressionChangedAfterItHasBeenCheckedError: Expression has changed after it was checked. Previous value for 'mat-form-field-should-float': 'false'. Current value: 'true'.
            //
            // I'm sure there's some deeper meaning behind it, but for some 
            // reason when the confirm dialog's `Yes` button is still the 
            // active element at this point, that error is written to the 
            // console.
            // This error only happens when a list is reloaded after.
            document.activeElement.blur();
        }
    };

    private hiddenModalIds: string[] = [];
    private getHiddenModalIds(): Observable<string[]> {
        let obs: Observable<string[]> = new Observable<string[]>( ( observer: Observer<string[]> ) => {
            
            window.api.ipc.once( 'settings:get:hidden-modal-ids', ( e, hiddenModalIds: string[] ) => {
                this.ngZone.run( () => {
                    observer.next( hiddenModalIds );
                    observer.complete();
                } );
            } );
            window.api.ipc.send( 'settings:get:hidden-modal-ids', null );

        } );

        return obs;
    }

    private addHiddenModalIds( modalId: string ): void {
        this.hiddenModalIds.push( modalId );
        window.api.ipc.send( 'settings:set:hidden-modal-ids:add', modalId );
    }

    constructor( private dialog: MatDialog, private ngZone: NgZone ) {
        
        window.api.ipc.on( 'settings:changed:hidden-modal-ids', ( event: any, data: string[] ) => {
            ngZone.run( () => {
                this.hiddenModalIds = data;
            } );
        } );

        this.getHiddenModalIds().subscribe( data => this.hiddenModalIds = data );
    }










    /**
     * Displays the display selector dialog.
     * 
     * @param messages The messages to display to the user.
     * @param displayId The id of the selected display.
     */
    public showMonitorSelect( messages: ( string | ColoredString )[] | string | ColoredString, displayId: number | null ): Observable<number|null> {
        
        return this.dialog.open<MonitorSelectDialogComponent, any, number|null>( MonitorSelectDialogComponent, {
            width: '750px',
            data: {
                message: messages,
                displayId: displayId,
            },
            panelClass: 'app-dialog',
        } ).afterClosed();

    }
    








    
    /**
     * Displays the Quetion dialog to the user.
     * 
     * @param title The dialog title.
     * @param messages The general question to ask the user.
     * @param questions The question answers with descriptions.
     * @param cancellable If true, the user can cancel out of the dialog.
     */
    public showQuestionDialog( title: string, messages: ( string | ColoredString )[], questions: QuestionDialogAnswerModel[], cancellable: boolean = true, size: 'narrow' | 'normal' | 'wide' = 'normal' ): void {
        size = size ? size : 'normal';
        let m = new QuestionDialogModel();

        m.title = title;
        m.message = messages;
        m.cancellable = cancellable === false ? false : true;
        m.questions = questions;
        
        let dialogRef: MatDialogRef<QuestionDialogComponent> = this.dialog.open( QuestionDialogComponent, {
            width: size === 'narrow' ? '450px' : size === 'wide' ? '750px' : '650px',
            data: m,
            panelClass: 'app-dialog',
        } );

        dialogRef.afterClosed().subscribe( e => {

            if ( document.activeElement instanceof HTMLElement ) {
                // This is a workaround to prevent the error:
                // 
                //      ExpressionChangedAfterItHasBeenCheckedError: Expression has changed after it was checked. Previous value for 'mat-form-field-should-float': 'false'. Current value: 'true'.
                //
                // I'm sure there's some deeper meaning behind it, but for some 
                // reason when the confirm dialog's `Yes` button is still the 
                // active element at this point, that error is written to the 
                // console.
                // This error only happens when a list is reloaded after.
                document.activeElement.blur();
            }

        } );
        
    }









    
    /**
     * Displays a confirmation dialog to the user.  The observable resolves to, yes = true, no = false, cancel = null.
     * 
     * @param message The question to display to the user.
     * @param yesText The description of the action taken when the user confirms the question.
     * @param noText The description of the action taken when the user declines the question.
     * @param cancelText The description of the action taken when the user declines the question. If no value is provided, the cancel button is not rendered.
     */
    public showConfirmationDialog( message: string | (string|ColoredString)[], yesText: string, noText: string, cancelText: string|null = null, size: 'narrow'|'normal'|'wide' = 'normal', moreInfo: () => void|null = null ): Observable<boolean|null> {
        size = size ? size : 'normal';
        let dialogRef: MatDialogRef<ConfirmDialogComponent, boolean|null> = this.dialog.open<ConfirmDialogComponent, any, boolean|null>( ConfirmDialogComponent, {
            width: size === 'narrow' ? '450px' : size === 'wide' ? '650px' : '550px',
            data: {
                message: message,
                yesMessage: yesText,
                noMessage: noText,
                cancelMessage: cancelText,
                moreInfo: moreInfo,
            },
            panelClass: 'app-dialog',
        } );

        let af = dialogRef.afterClosed();

        af.subscribe( this._afc );

        return af;
    }









    
    /**
     * Displays a confirmation dialog to the user.
     * 
     * @deprecated Use showConfirmationDialog instead.
     * 
     * @param message The question to display to the user.
     * @param yesText The description of the action taken when the user confirms the question.
     * @param noText The description of the action taken when the user declines the question.
     * @param onClose This function is executed after the user makes their decision and the decision is passed as the confirmed parameter.
     */
    public showConfirmDialog( message: string | (string|ColoredString)[], yesText: string, noText: string, onClose: ( confirmed: boolean ) => void ): void {
        
        let dialogRef: MatDialogRef<ConfirmDialogComponent> = this.dialog.open( ConfirmDialogComponent, {
            width: '550px',
            data: {
                message: message,
                yesMessage: yesText,
                noMessage: noText
            },
            panelClass: 'app-dialog',
        } );

        let af = dialogRef.afterClosed();

        af.subscribe( confirmed => {
            onClose( confirmed === true ? true : undefined );
        } );
        af.subscribe( e => {

            if ( document.activeElement instanceof HTMLElement ) {
                // This is a workaround to prevent the error:
                // 
                //      ExpressionChangedAfterItHasBeenCheckedError: Expression has changed after it was checked. Previous value for 'mat-form-field-should-float': 'false'. Current value: 'true'.
                //
                // I'm sure there's some deeper meaning behind it, but for some 
                // reason when the confirm dialog's `Yes` button is still the 
                // active element at this point, that error is written to the 
                // console.
                // This error only happens when a list is reloaded after.
                document.activeElement.blur();
            }

        } );
        
    }










    /**
     * Displays a confirmation dialog to the user.
     * 
     * @param title The title of the confirmation dialog.
     * @param message The question to display to the user.
     * @param yesText The description of the action taken when the user confirms the question.
     * @param noText The description of the action taken when the user declines the question.
     * @param onClose This function is executed after the user makes their decision and the decision is passed as the confirmed parameter.
     */
    public showAskDialog( title: string, message: string | (string|ColoredString)[], yesText: string, noText: string, onClose: ( confirmed: boolean ) => void ): void {
        
        let dialogRef: MatDialogRef<ConfirmDialogComponent> = this.dialog.open( ConfirmDialogComponent, {
            width: '550px',
            data: {
                title: title ?? 'Confirm',
                message: message,
                yesMessage: yesText,
                noMessage: noText
            },
            panelClass: 'app-dialog',
        } );

        let af = dialogRef.afterClosed();

        af.subscribe( onClose );
        af.subscribe( e => {

            if ( document.activeElement instanceof HTMLElement ) {
                // This is a workaround to prevent the error:
                // 
                //      ExpressionChangedAfterItHasBeenCheckedError: Expression has changed after it was checked. Previous value for 'mat-form-field-should-float': 'false'. Current value: 'true'.
                //
                // I'm sure there's some deeper meaning behind it, but for some 
                // reason when the confirm dialog's `Yes` button is still the 
                // active element at this point, that error is written to the 
                // console.
                // This error only happens when a list is reloaded after.
                document.activeElement.blur();
            }

        } );
        
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
            data: model,
            panelClass: 'app-dialog',
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
    public showNewDotTimerDialog( folderId?: string, externalSource?: ExternalDataSources | undefined ): void {
        
        externalSource = externalSource ? externalSource : ExternalDataSources.Allakhazam;

        this.dialog.open( NewTriggerDialogComponent, {
            width: '750px',
            panelClass: 'app-dialog',
            data: <NewTriggerDialogModel>{ selectedFolderId: folderId, trigger: null, dataSource: externalSource },
        } ).afterClosed();
    }










    /**
     * Opens the new dot timer trigger dialog.
     */
    public showNewRaidAbilityDialog( folderId?: string ): void {
        this.dialog.open( NewTriggerRaidAbilityComponent, {
            width: '750px',
            data: <NewTriggerDialogModel>{ selectedFolderId: folderId, trigger: null },
            panelClass: 'app-dialog',
        } ).afterClosed();
    }










    /**
     * Opens the new dot timer trigger dialog.
     */
    public showNewBuffTimerDialog( folderId?: string, externalSource?: ExternalDataSources | undefined ): void {

        externalSource = externalSource ? externalSource : ExternalDataSources.Allakhazam;

        this.dialog.open( NewTriggerBuffDialogComponent, {
            width: '750px',
            data: <NewTriggerDialogModel>{ selectedFolderId: folderId, trigger: null, dataSource: externalSource },
            panelClass: 'app-dialog',
        } ).afterClosed();
    }










    /**
     * Opens the new dot timer trigger dialog.
     */
    public showReimportDotTimerDialog( model: TriggerModel, externalSource: ExternalDataSources ): void {
        this.dialog.open( NewTriggerDialogComponent, {
            width: '750px',
            data: <NewTriggerDialogModel>{ selectedFolderId: null, trigger: model, dataSource: externalSource },
            panelClass: 'app-dialog',
        } ).afterClosed();
    }










    /**
     * Opens the new dot timer trigger dialog.
     */
    public showReimportRaidAbilityDialog( model: TriggerModel, externalSource: ExternalDataSources ): void {
        this.dialog.open( NewTriggerRaidAbilityComponent, {
            width: '750px',
            data: <NewTriggerDialogModel>{ selectedFolderId: null, trigger: model, dataSource: externalSource },
            panelClass: 'app-dialog',
        } ).afterClosed();
    }










    /**
     * Opens the new dot timer trigger dialog.
     */
    public showReimportBuffDialog( model: TriggerModel, externalSource: ExternalDataSources ): void {
        this.dialog.open( NewTriggerBuffDialogComponent, {
            width: '750px',
            data: <NewTriggerDialogModel>{ selectedFolderId: null, trigger: model, dataSource: externalSource },
            panelClass: 'app-dialog',
        } ).afterClosed();
    }










    /**
     * Opens the new character dialog.
     */
    public showNewCharacterDialog( afterClosed: (characterId: string) => void ): void {
        this.dialog.open( NewCharacterDialogComponent, {
            width: '750px',
            panelClass: 'app-dialog',
        } ).afterClosed().subscribe( afterClosed );
    }










    /**
     * Opens the new character dialog.
     */
    public showNewTriggerFolderDialog(): Observable<TriggerFolder> {
        return this.dialog.open<NewTriggerFolderDialogComponent, any, TriggerFolder>( NewTriggerFolderDialogComponent, {
            width: '750px',
            panelClass: 'app-dialog',
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
     * @param title The dialog window title.
     * @param description If provided, renders a p tag at the top with "description".
     */
    public showSelectTriggerFolderDialog( folderId?: string, title?: string, description?: string ): Observable<string> {
        return this.dialog.open<SelectTriggerFolderDialogComponent, any, string>( SelectTriggerFolderDialogComponent, {
            width: '450px',
            data: { folderId: folderId, title: title, description: description },
            panelClass: 'app-dialog',
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
    public showSelectTriggerFoldersDialog( folderId?: string, title?: string ): Observable<string> {
        return this.dialog.open<SelectTriggerFolderDialogComponent, any, string>( SelectTriggerFolderDialogComponent, {
            width: '450px',
            data: { folderId: folderId, title: title },
            panelClass: 'app-dialog',
        } ).afterClosed();
    }










    /**
     * Opens the new character dialog.
     */
    public showSelectIconDialog( afterClosed: ( icon: string ) => void ): void {
        this.dialog.open( SelectIconDialogComponent, {
            width: '750px',
            panelClass: 'app-dialog',
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
            },
            panelClass: 'app-dialog',
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
    public showInputDialog( title: string, message: string | string[], label?: string, hint?: string, initialValue?: string, textArea?: boolean ): Observable<string> {
        let data: InputDialogModel = new InputDialogModel();
        
        data.title = title;
        data.message = message;
        data.label = label;
        data.hint = hint;
        data.initialValue = initialValue;
        data.useTextArea = textArea === true;

        return this.dialog.open<InputDialogComponent, any, string>( InputDialogComponent, {
            width: data.useTextArea ? '80vw' : '450px',
            data: data,
            panelClass: 'app-dialog',
        } ).afterClosed();
        
    }










    /**
     * Shows a simple dialog with an input.
     * 
     * @param title The title for the dialog.
     * @param message Instructions to the user.
     * @param conditions The conditions to edit.
     */
    public showNamedGroupConditionsDialog( title: string, message: string | string[], conditions: TriggerCondition[] ): Observable<TriggerCondition[]> {
        let data: NamedGroupConditionsModel = new NamedGroupConditionsModel();
        
        data.title = title;
        data.message = message;
        data.conditions = conditions;

        return this.dialog.open<NamedGroupConditionsDialogComponent, any, TriggerCondition[]>( NamedGroupConditionsDialogComponent, {
            width: '650px',
            data: data,
            panelClass: 'app-dialog',
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
            data: data,
            panelClass: 'app-dialog',
        } ).afterClosed();
        
    }
    









    /**
     * Shows a notification dialog to the user.
     * 
     * @param data The dialog display model.
     */
    public showNotificationDialog( data: NotificationDialogModel ): void {
        this.dialog.open( NotificationDialogComponent, {
            data: data,
            panelClass: 'app-dialog',
        } ).afterClosed().subscribe();
    }









    
    /**
     * Shows a warning dialog to the user.
     * 
     * @param title The dialog title.
     * @param message The message(s) to display to the user.
     */
    public showWarningDialog( title: string, message: string | ( string | ColoredString )[] ): void {
        let data: NotificationDialogModel = new NotificationDialogModel();
        
        data.title = title;
        data.message = message;
        data.notificationType = NotificationTypes.Warning;

        this.dialog.open( NotificationDialogComponent, {
            maxWidth: '60vw',
            data: data,
            panelClass: 'app-dialog',
        } ).afterClosed().subscribe();
    }
    








    
    /**
     * Shows an info dialog to the user.
     * 
     * @param title The dialog title.
     * @param message The message(s) to display to the user.
     */
    public showInfoDialog( title: string, message: string | ( string | ColoredString )[], size: 'narrow' | 'normal' | 'wide' = 'narrow', modalId: string | null = null ) {
        
        if ( modalId && this.hiddenModalIds.includes( modalId ) ) {
            return;
        }

        size = size ? size : 'narrow';

        let data: NotificationDialogModel = new NotificationDialogModel();
        
        data.title = title;
        data.message = message;
        data.notificationType = NotificationTypes.Information;
        data.modalId = modalId;

        let ref = this.dialog.open( NotificationDialogComponent, {
            width: size === 'narrow' ? '450px' : size === 'wide' ? '650px' : '550px',
            data: data,
            panelClass: 'app-dialog',
        } );
        
        ref.afterClosed().subscribe( modalId => {
            if ( modalId ) {
                if ( !this.hiddenModalIds.includes( modalId ) ) {
                    this.addHiddenModalIds( modalId );
                }
            }
        } );

    }
    








    
    /**
     * Shows a custom notification dialog to the user.
     * 
     * @param title The dialog title.
     * @param message The message(s) to display to the user.
     * @param icon The mat icon name to use in the custom dialog.
     */
    public showCustomNotificationDialog( title: string, message: string | ( string | ColoredString )[], icon: string ): void {
        let data: NotificationDialogModel = new NotificationDialogModel();
        
        data.title = title;
        data.message = message;
        data.notificationType = NotificationTypes.Custom;
        data.icon = icon;

        this.dialog.open( NotificationDialogComponent, {
            width: '450px',
            data: data,
            panelClass: 'app-dialog',
        } ).afterClosed().subscribe();
    }
    








    
    /**
     * Shows an error dialog to the user.
     * 
     * @param title The dialog title.
     * @param message The message(s) to display to the user.
     */
    public showErrorDialog( title: string, message: string | ( string | ColoredString )[] ): void {
        let data: NotificationDialogModel = new NotificationDialogModel();
        
        data.title = title;
        data.message = message;
        data.notificationType = NotificationTypes.Error;

        this.dialog.open( NotificationDialogComponent, {
            width: '450px',
            data: data,
            panelClass: 'app-dialog',
        } ).afterClosed().subscribe();
    }
    








    
    /**
     * Shows the prepare quickshare dialog to the user.
     * 
     * @returns Returns the quick share id, in share format.  ie: {NAG:asdff1234QWER7654}
     * 
     * @param triggers The triggers to share.
     * @param folders The trigger folders to include in the share.
     */
    public showPrepareQuickShareDialog( triggers: TriggerModel[], folders: TriggerFolder[] ): Observable<string> {

        return this.dialog.open<PrepareQuickShareDialogComponent, PrepareQuickShareModel, string>( PrepareQuickShareDialogComponent, {
            width: '750px',
            maxHeight: '80vh', 
            height : 'auto',
                data: Object.assign( new PrepareQuickShareModel(), {
                    triggers: triggers,
                    folders: folders,
                } ),
                panelClass: 'app-dialog',
                autoFocus: false,
            } )
            .afterClosed();

    }









    
    /**
     * Shows the import quickshare dialog to the user.
     * 
     * @returns Returns true if the user has imported any folders/triggers.
     * 
     * @param quickShareId The quick share id, in share format.
     */
    public showReceiveQuickShareDialog(quickShares: QuickShareMetaModel[], files: QuickShareFileModel[]): Observable<boolean> {

        return this.dialog.open<ReceiveQuickShareDialogComponent, any, boolean>( ReceiveQuickShareDialogComponent, {
            width: '750px',
            maxHeight: '80vh', 
            height : 'auto',
            data: { quickShares: quickShares, files: files },
            panelClass: 'app-dialog',
            autoFocus: false,
        } ).afterClosed();

    }










    /**
     * Opens the new character dialog.
     */
    public showDeathRecapDialog(): void {
        this.dialog.open( DeathRecapDialogComponent, {
            width: '750px',
            panelClass: 'app-dialog',
        } ).afterClosed().subscribe();
    }










    /**
     * Opens the map package overlay dialog.
     * 
     * @returns Returns the user overlay mapped to the missing overlay.
     * 
     * @param missingOverlay The overlay that is missing.
     */
    public showMapPackageOverlayDialog( missingOverlay: OverlayWindowModel ): Observable<OverlayWindowModel> {
        return this.dialog.open<MapPackageOverlayDialogComponent, OverlayWindowModel, OverlayWindowModel>( MapPackageOverlayDialogComponent, {
            width: '750px',
            data: missingOverlay,
            panelClass: 'app-dialog',
        } ).afterClosed();
    }










    /**
     * Opens the overlay use details and reassignment modal.
     * 
     * @returns Returns the user overlay reassignment details.
     * 
     * @param missingOverlay The overlay that is missing.
     */
    public showOverlayReassignment( overlay: OverlayWindowModel, overlayUses: ActionOverlayUseModel[], showDeleteWarning?: boolean ): Observable<OverlayReassignments> {
        let af =  this.dialog.open<ActionOverlayReassignmentDialogComponent, ActionOverlayReviewModel, OverlayReassignments>( ActionOverlayReassignmentDialogComponent, {
            width: '750px',
            data: {
                overlay: overlay,
                actionUses: _.orderBy( overlayUses, [ f => f.trigger.triggerId, f => f.actionId ], [ 'asc', 'asc' ] ),
                showDeleteWarning: showDeleteWarning === true,
                hideReassignment: false,
            },
            panelClass: 'app-dialog',
        } ).afterClosed();

        af.subscribe( e => {

            if ( document.activeElement instanceof HTMLElement ) {
                // This is a workaround to prevent the error:
                // 
                //      ExpressionChangedAfterItHasBeenCheckedError: Expression has changed after it was checked. Previous value for 'mat-form-field-should-float': 'false'. Current value: 'true'.
                //
                // I'm sure there's some deeper meaning behind it, but for some 
                // reason when the confirm dialog's `Yes` button is still the 
                // active element at this point, that error is written to the 
                // console.
                // This error only happens when a list is reloaded after.
                document.activeElement.blur();
            }

        } );

        return af;
    }










    /**
     * Opens the overlay use details and reassignment modal.
     * 
     * @returns Returns the user overlay reassignment details.
     * 
     * @param missingOverlay The overlay that is missing.
     */
    public showOverlayAssignment( overlayUses: ActionOverlayUseModel[] ): Observable<OverlayReassignments> {
        let af =  this.dialog.open<ActionOverlayReassignmentDialogComponent, ActionOverlayReviewModel, OverlayReassignments>( ActionOverlayReassignmentDialogComponent, {
            width: '750px',
            data: {
                overlay: null,
                actionUses: _.orderBy( overlayUses, [ f => f.trigger.triggerId, f => f.actionId ], [ 'asc', 'asc' ] ),
                showDeleteWarning: false,
                hideReassignment: true,
            },
            panelClass: 'app-dialog',
        } ).afterClosed();

        af.subscribe( e => {

            if ( document.activeElement instanceof HTMLElement ) {
                // This is a workaround to prevent the error:
                // 
                //      ExpressionChangedAfterItHasBeenCheckedError: Expression has changed after it was checked. Previous value for 'mat-form-field-should-float': 'false'. Current value: 'true'.
                //
                // I'm sure there's some deeper meaning behind it, but for some 
                // reason when the confirm dialog's `Yes` button is still the 
                // active element at this point, that error is written to the 
                // console.
                // This error only happens when a list is reloaded after.
                document.activeElement.blur();
            }

        } );

        return af;
    }
    
}
