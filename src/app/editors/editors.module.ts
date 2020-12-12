import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MaterialModule } from '../material.module';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { FormInputModule } from '../form-inputs/form-inputs.module';
import { ContextMenuModule } from '../context-menu/context-menu.module';
import { ConditionsComponent } from './conditions/conditions.component';
import { EditorsService } from './editors.service';
import { CapturePhrasesComponent } from './capture-phrases/capture-phrases.component';

@NgModule({
    imports: [
        BrowserModule,
        FormsModule,
        ReactiveFormsModule,
        MaterialModule,
        BrowserAnimationsModule,
        FormInputModule,
        ContextMenuModule,
    ],
    exports: [
        ConditionsComponent,
        CapturePhrasesComponent,
    ],
    declarations: [
        ConditionsComponent,
        CapturePhrasesComponent,
    ],
    providers: [
        EditorsService,
    ],
})
export class EditorsModule { }
