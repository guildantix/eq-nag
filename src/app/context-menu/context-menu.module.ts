import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { MaterialModule } from '../material.module';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

import { ContextMenuComponent } from './context-menu.component';
import { ContextMenuDirective } from './context-menu.directive';

@NgModule({
    imports: [
        CommonModule,
        // BrowserModule,
        // FormsModule,
        MaterialModule,
    ],
    exports: [
        ContextMenuComponent,
        ContextMenuDirective,
    ],
    declarations: [
        ContextMenuComponent,
        ContextMenuDirective,
    ],
    providers: [],
})
export class ContextMenuModule { }
