import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { ContextMenuModule } from '../context-menu/context-menu.module';
import { FormInputModule } from '../form-inputs/form-inputs.module';
import { MaterialModule } from '../material.module';
import { AccordionPanelComponent } from './accordion/accordion-panel.component';
import { AccordionComponent } from './accordion/accordion.component';

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
        AccordionComponent,
        AccordionPanelComponent,
    ],
    declarations: [
        AccordionComponent,
        AccordionPanelComponent,
    ],
    providers: [],
})
export class WebComponentsModule { }
