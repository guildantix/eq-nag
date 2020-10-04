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

@NgModule( {
    imports: [
        BrowserModule,
        FormsModule,
        ReactiveFormsModule,
        MaterialModule,
        BrowserAnimationsModule,
        FormInputModule,
    ],
    exports: [
        TriggerDialogComponent,
        ConfirmDialogComponent,
        OverlayDetailsDialogComponent,
        OverlayEditorDialogComponent,
        TriggerActionWizardModalComponent,
        NewTriggerDialogComponent,
    ],
    declarations: [
        TriggerDialogComponent,
        ConfirmDialogComponent,
        OverlayDetailsDialogComponent,
        OverlayEditorDialogComponent,
        TriggerActionWizardModalComponent,
        NewTriggerDialogComponent,
    ],
    providers: [
        DialogService,
        IpcService,
    ],
} )
export class DialogModule { }
