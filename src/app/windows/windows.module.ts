import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MaterialModule } from '../material.module';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { FormInputModule } from '../form-inputs/form-inputs.module';
import { ContextMenuModule } from '../context-menu/context-menu.module';

import { GinaImportWindowComponent } from './gina-import-window/gina-import-window.component';
import { DialogModule } from '../dialogs/dialog.module';
import { EditorsModule } from '../editors/editors.module';
import { GinaImportStepperComponent } from './gina-import-window/gina-import-stepper.component';

@NgModule({
    imports: [
        BrowserModule,
        FormsModule,
        ReactiveFormsModule,
        MaterialModule,
        BrowserAnimationsModule,
        FormInputModule,
        ContextMenuModule,
        DialogModule,
        EditorsModule,
    ],
    exports: [
        GinaImportStepperComponent,
        GinaImportWindowComponent,
    ],
    declarations: [
        GinaImportStepperComponent,
        GinaImportWindowComponent,
    ],
    providers: [],
})
export class WindowsModule { }
