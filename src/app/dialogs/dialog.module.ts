import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { DialogService } from './dialog.service';
import { FormsModule } from '@angular/forms';
import { MaterialModule } from '../material.module';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { TriggerDialogComponent } from './trigger-dialog/trigger-dialog.component';
import { IpcService } from '../ipc.service';
import { ConfirmDialogComponent } from './confirm-dialog/confirm-dialog.component';
import { OverlayDetailsDialogComponent } from './overlay-details-dialog/overlay-details-dialog.component';
import { OverlayEditorDialogComponent } from './overlay-editor-dialog/overlay-editor-dialog.component';

@NgModule( {
    imports: [
        BrowserModule,
        FormsModule,
        MaterialModule,
        BrowserAnimationsModule,
    ],
    exports: [
        TriggerDialogComponent,
        ConfirmDialogComponent,
        OverlayDetailsDialogComponent,
        OverlayEditorDialogComponent,
    ],
    declarations: [
        TriggerDialogComponent,
        ConfirmDialogComponent,
        OverlayDetailsDialogComponent,
        OverlayEditorDialogComponent,
    ],
    providers: [
        DialogService,
        IpcService
    ],
} )
export class DialogModule { }
