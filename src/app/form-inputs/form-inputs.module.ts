import { NgModule } from '@angular/core';
import { ColorPickerComponent } from './color-picker/color-picker.component';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MaterialModule } from '../material.module';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { CommonModule } from '@angular/common';
import { DurationComponent } from './duration/duration.component';

@NgModule({
    imports: [
        CommonModule,
        FormsModule,
        MaterialModule,
        BrowserAnimationsModule,
    ],
    exports: [
        ColorPickerComponent,
        DurationComponent,
    ],
    declarations: [
        ColorPickerComponent,
        DurationComponent,
    ],
    providers: [],
})
export class FormInputModule { }
