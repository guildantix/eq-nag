import { NgModule } from '@angular/core';
import { SettingsComponent } from './settings-component/settings.component';
import { DialogModule } from '@angular/cdk/dialog';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { ContextMenuModule } from '../context-menu/context-menu.module';
import { CoreModule } from '../core/core.module';
import { EditorsModule } from '../editors/editors.module';
import { FormInputModule } from '../form-inputs/form-inputs.module';
import { MaterialModule } from '../material.module';
import { WebComponentsModule } from '../web-components/web-components.module';
import { NgxMatTimepickerModule } from 'ngx-mat-timepicker';
import { CombatStatisticsComponent } from './combat-statistics/combat-statistics.component';
import { LogFileComponent } from './log-file/log-file.component';

@NgModule({
    imports: [
        CoreModule,
        BrowserModule,
        FormsModule,
        ReactiveFormsModule,
        MaterialModule,
        BrowserAnimationsModule,
        FormInputModule,
        ContextMenuModule,
        DialogModule,
        EditorsModule,
        WebComponentsModule,
        HttpClientModule,
        NgxMatTimepickerModule,
    ],
    declarations: [
        CombatStatisticsComponent,
        SettingsComponent,
        LogFileComponent,
    ],
    exports: [
        CombatStatisticsComponent,
        SettingsComponent,
    ],
    providers: [],
})
export class SettingsModule { }
