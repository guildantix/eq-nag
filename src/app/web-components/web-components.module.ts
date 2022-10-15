import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { ContextMenuModule } from '../context-menu/context-menu.module';
import { FormInputModule } from '../form-inputs/form-inputs.module';
import { MaterialModule } from '../material.module';
import { AccordionPanelComponent } from './accordion/accordion-panel.component';
import { AccordionComponent } from './accordion/accordion.component';
import { LinkButtonComponent } from './link-button/link-button.component';
import { TriggerActionOptionComponent } from './trigger-action-option/trigger-action-option.component';

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
        LinkButtonComponent,
        TriggerActionOptionComponent,
    ],
    declarations: [
        AccordionComponent,
        AccordionPanelComponent,
        LinkButtonComponent,
        TriggerActionOptionComponent,
    ],
    providers: [],
})
export class WebComponentsModule { }
