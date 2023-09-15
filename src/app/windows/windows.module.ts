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
import { WebComponentsModule } from '../web-components/web-components.module';
import { HttpClientModule } from '@angular/common/http';
import { MarkdownModule } from 'ngx-markdown';
import { UpdateNotesWindowComponent } from './update-notes-window/update-notes-window.component';
import { TriggerReviewsComponent } from './gina-import-window/trigger-reviews/trigger-reviews.component';
import { CoreModule } from '../core/core.module';
import { LogSimulatorComponent } from './log-simulator/log-simulator.component';
import { EasyWindowComponent } from './easy-window/easy-window.component';

@NgModule({
    imports: [
        CoreModule,
        BrowserModule,
        FormsModule,
        ReactiveFormsModule,
        MaterialModule,
        BrowserAnimationsModule,
        FormInputModule,
        ContextMenuModule,
        DialogModule,
        EditorsModule,
        WebComponentsModule,
        HttpClientModule,
        MarkdownModule.forRoot(),
    ],
    exports: [
        GinaImportStepperComponent,
        GinaImportWindowComponent,
        TriggerLibraryWindowComponent,
    ],
    declarations: [
        GinaImportStepperComponent,
        TriggerReviewsComponent,
        GinaImportWindowComponent,
        TriggerLibraryWindowComponent,
        NewTriggerPackageComponent,
        TriggerPackageDetailsComponent,
        UpdateNotesWindowComponent,
        LogSimulatorComponent,
        EasyWindowComponent,
    ],
    providers: [
        TriggerLibraryService
    ],
})
export class WindowsModule { }
