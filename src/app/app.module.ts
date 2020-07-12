import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { MaterialModule } from './material.module';
import { DialogModule } from './dialogs/dialog.module';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { AppComponent } from './app.component';
import { FormsModule } from '@angular/forms';
import { MainComponent } from './main.component';
import { RouterModule, Routes } from '@angular/router';
import { appRoutes } from './ng.routes';

@NgModule({
  imports: [
        BrowserModule,
        FormsModule,
        MaterialModule,
        DialogModule,
        BrowserAnimationsModule,
        RouterModule.forRoot( appRoutes, { enableTracing: false, useHash: true } ),
  ],
    declarations: [
        AppComponent,
        MainComponent,
    ],
  providers: [],
  bootstrap: [AppComponent],
})
export class AppModule {}
