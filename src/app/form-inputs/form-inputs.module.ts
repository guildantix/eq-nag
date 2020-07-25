import { NgModule } from '@angular/core';
import { ColorPickerComponent } from './color-picker/color-picker.component';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MaterialModule } from '../material.module';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { CommonModule } from '@angular/common';

@NgModule({
    imports: [
        CommonModule,
        FormsModule,
        // ReactiveFormsModule,
        MaterialModule,
        BrowserAnimationsModule,
    ],
    exports: [
        ColorPickerComponent
    ],
    declarations: [
        ColorPickerComponent
    ],
    providers: [],
})
export class FormInputModule { }
