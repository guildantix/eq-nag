import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { DialogService } from './dialog.service';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MaterialModule } from '../material.module';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { TriggerDialogComponent } from './trigger-dialog/trigger-dialog.component';
import { IpcService } from '../ipc.service';
import { ConfirmDialogComponent } from './confirm-dialog/confirm-dialog.component';
import { OverlayDetailsDialogComponent } from './overlay-details-dialog/overlay-details-dialog.component';
import { OverlayEditorDialogComponent } from './overlay-editor-dialog/overlay-editor-dialog.component';
import { FormInputModule } from '../form-inputs/form-inputs.module';
import { TriggerActionWizardModalComponent } from './trigger-action-wizard-modal/trigger-action-wizard-modal.component';
import { NewTriggerDialogComponent } from './new-trigger-dialog/new-trigger-dialog.component';
import { NewCharacterDialogComponent } from './new-character-dialog/new-character-dialog.component';
import { SelectIconDialogComponent } from './select-icon-dialog/select-icon-dialog.component';
import { NewTriggerFolderDialogComponent } from './new-trigger-folder-dialog/new-trigger-folder-dialog.component';
import { SelectTriggerFolderDialogComponent } from './select-trigger-folder-dialog/select-trigger-folder-dialog.component';
import { ContextMenuModule } from '../context-menu/context-menu.module';
import { InputDialogComponent } from './input-dialog/input-dialog.component';
import { NotificationDialogComponent } from './notification-dialog/notification-dialog.component';
import { TriggerActionDotTimerComponent } from './trigger-action-dotTimer/trigger-action-dotTimer.component';
import { TriggerActionTimerComponent } from './trigger-action-timer/trigger-action-timer.component';
import { TriggerActionCounterComponent } from './trigger-action-counter/trigger-action-counter.component';
import { TriggerActionAudioComponent } from './trigger-action-audio/trigger-action-audio.component';
import { EditorsModule } from '../editors/editors.module';

@NgModule( {
    imports: [
        BrowserModule,
        FormsModule,
        ReactiveFormsModule,
        MaterialModule,
        BrowserAnimationsModule,
        FormInputModule,
        ContextMenuModule,
        EditorsModule,
    ],
    exports: [
        TriggerDialogComponent,
        ConfirmDialogComponent,
        OverlayDetailsDialogComponent,
        OverlayEditorDialogComponent,
        TriggerActionWizardModalComponent,
        NewTriggerDialogComponent,
        NewCharacterDialogComponent,
        SelectIconDialogComponent,
        NewTriggerFolderDialogComponent,
        SelectTriggerFolderDialogComponent,
        InputDialogComponent,
        NotificationDialogComponent,
    ],
    declarations: [
        TriggerDialogComponent,
        ConfirmDialogComponent,
        OverlayDetailsDialogComponent,
        OverlayEditorDialogComponent,
        TriggerActionWizardModalComponent,
        NewTriggerDialogComponent,
        NewCharacterDialogComponent,
        SelectIconDialogComponent,
        NewTriggerFolderDialogComponent,
        SelectTriggerFolderDialogComponent,
        InputDialogComponent,
        NotificationDialogComponent,
        TriggerActionDotTimerComponent,
        TriggerActionTimerComponent,
        TriggerActionCounterComponent,
        TriggerActionAudioComponent,
    ],
    providers: [
        DialogService,
        IpcService,
    ],
} )
export class DialogModule { }
