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
import { TriggerLibraryWindowComponent } from './trigger-library-window/trigger-library-window.component';
import { TriggerLibraryService } from './trigger-library.service';
import { NewTriggerPackageComponent } from './new-trigger-package/new-trigger-package.component';
import { TriggerPackageDetailsComponent } from './trigger-package-details/trigger-package-details.component';

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
        TriggerLibraryWindowComponent,
    ],
    declarations: [
        GinaImportStepperComponent,
        GinaImportWindowComponent,
        TriggerLibraryWindowComponent,
        NewTriggerPackageComponent,
        TriggerPackageDetailsComponent,
    ],
    providers: [
        TriggerLibraryService
    ],
})
export class WindowsModule { }
