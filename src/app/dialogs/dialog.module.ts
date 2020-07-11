import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

// import { DialogComponent } from './dialog.component';
import { DialogService } from './dialog.service';
import { FormsModule } from '@angular/forms';
import { MaterialModule } from '../material.module';

@NgModule( {
    imports: [
        BrowserModule,
        FormsModule,
        MaterialModule,
    ],
    exports: [],
    declarations: [],
    providers: [ DialogService ],
} )
export class DialogModule { }
