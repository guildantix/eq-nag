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
import { ContextMenuModule } from './context-menu/context-menu.module';
import { TriggersComponent } from './triggers/triggers.component';
import { ClassNamePipe } from './pipes/class-name.pipe';
import { WindowsModule } from './windows/windows.module';
import { IpcService } from './ipc.service';
import { CoreModule } from './core/core.module';
import { SettingsComponent } from './settings/settings-component/settings.component';
import { SettingsService } from './settings/settings-http.service';
import { SetupModule } from './setup/setup.module';
import { SetupWizardComponent } from './setup/setup-wizard/setup-wizard.component';
import { SetupService } from './setup/setup.service';
import { EditorsModule } from './editors/editors.module';
import { OverlaysComponent } from './overlays/overlays.component';
import { NgxMatTimepickerModule } from 'ngx-mat-timepicker';
import { FolderConditionsDialogComponent } from './triggers/folder-conditions-dialog/folder-conditions-dialog.component';
import { DebugConsoleComponent } from './debug-console/debug-console.component';
import { ConsoleListComponent } from './debug-console/console-list.component';
import { FloatingCombatTextComponent } from './floating-combat-text/floating-combat-text.component';
import { ConsoleTriggerEventComponent } from './debug-console/console-lines/trigger-event.component';
import { ConsoleMessageComponent } from './debug-console/console-lines/message.component';

@NgModule( {
    imports: [
        BrowserModule,
        FormsModule,
        MaterialModule,
        DialogModule,
        BrowserAnimationsModule,
        RouterModule.forRoot( appRoutes, { enableTracing: false, useHash: true, relativeLinkResolution: 'legacy' } ),
        HttpClientModule,
        CoreModule,
        ContextMenuModule,
        WindowsModule,
        // SetupModule,
        EditorsModule,
        NgxMatTimepickerModule,
    ],
    declarations: [
        AppComponent,
        ClassNamePipe,
        FolderConditionsDialogComponent,
        TriggersComponent,
        OverlaysComponent,
        ConsoleTriggerEventComponent,
        ConsoleMessageComponent,
        ConsoleListComponent,
        DebugConsoleComponent,
        MainComponent,
        CharactersListComponent,
        SettingsComponent,
        SetupWizardComponent,
        FloatingCombatTextComponent,
    ],
    providers: [
        ScraperService,
        IpcService,
        SettingsService,
        SetupService,
    ],
    bootstrap: [ AppComponent ],
} )
export class AppModule { }
