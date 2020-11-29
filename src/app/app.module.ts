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
import { HttpClientModule } from '@angular/common/http';
import { ScraperService } from './scraper.service';
import { CharactersListComponent } from './characters-list/characters-list.component';
import { NgxElectronModule } from 'ngx-electron';
import { ContextMenuModule } from './context-menu/context-menu.module';

@NgModule( {
    imports: [
        BrowserModule,
        FormsModule,
        MaterialModule,
        NgxElectronModule,
        DialogModule,
        BrowserAnimationsModule,
        RouterModule.forRoot( appRoutes, { enableTracing: false, useHash: true } ),
        HttpClientModule,
        ContextMenuModule,
    ],
    declarations: [
        AppComponent,
        MainComponent,
        CharactersListComponent,
    ],
    providers: [
        ScraperService,
    ],
    bootstrap: [ AppComponent ],
} )
export class AppModule { }
