import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MaterialModule } from '../material.module';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { FormInputModule } from '../form-inputs/form-inputs.module';
import { ContextMenuModule } from '../context-menu/context-menu.module';

// Services imports
import { EditorsService } from './editors.service';

// Component imports
import { ConditionsComponent } from './conditions/conditions.component';
import { CapturePhrasesComponent } from './capture-phrases/capture-phrases.component';
import { PhrasesComponent } from './phrases/phrases.component';

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
        PhrasesComponent,
    ],
    declarations: [
        ConditionsComponent,
        CapturePhrasesComponent,
        PhrasesComponent,
    ],
    providers: [
        EditorsService,
    ],
})
export class EditorsModule { }
