import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { DialogService } from './dialog.service';
import { FormsModule } from '@angular/forms';
import { MaterialModule } from '../material.module';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { TriggerDialogComponent } from './trigger-dialog/trigger-dialog.component';
import { IpcService } from '../ipc.service';

@NgModule( {
    imports: [
        BrowserModule,
        FormsModule,
        MaterialModule,
        BrowserAnimationsModule,
    ],
    exports: [
        TriggerDialogComponent
    ],
    declarations: [
        TriggerDialogComponent
    ],
    providers: [
        DialogService,
        IpcService
    ],
} )
export class DialogModule { }
