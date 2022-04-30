import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { ContextMenuModule } from '../context-menu/context-menu.module';
import { EditorsModule } from '../editors/editors.module';
import { FormInputModule } from '../form-inputs/form-inputs.module';
import { MaterialModule } from '../material.module';
import { SetupWizardComponent } from './setup-wizard/setup-wizard.component';
import { SetupService } from './setup.service';

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
    ],
    declarations: [
        // TODO: Why is setup wizard directly imported to the app module?
        
    ],
    providers: [
        
    ],
} )
export class SetupModule { }
