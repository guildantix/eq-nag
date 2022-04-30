import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { DialogService } from './dialog.service';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MaterialModule } from '../material.module';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { TriggerDialogComponent } from './trigger-dialog/trigger-dialog.component';
import { ConfirmDialogComponent } from './confirm-dialog/confirm-dialog.component';
import { OverlayDetailsDialogComponent } from './overlay-details-dialog/overlay-details-dialog.component';
import { OverlayEditorDialogComponent } from './overlay-editor-dialog/overlay-editor-dialog.component';
import { FormInputModule } from '../form-inputs/form-inputs.module';
import { TriggerActionWizardModalComponent } from './trigger-action-wizard-modal/trigger-action-wizard-modal.component';
import { NewTriggerDialogComponent } from './new-trigger-dialog/new-trigger-dialog.component';
import { NewCharacterDialogComponent } from './new-character-dialog/new-character-dialog.component';
import { SelectIconDialogComponent } from './select-icon-dialog/select-icon-dialog.component';
import { NewTriggerFolderDialogComponent } from './new-trigger-folder-dialog/new-trigger-folder-dialog.component';
import { SelectTriggerFolderDialogComponent } from './select-trigger-folder-dialog/select-trigger-folder-dialog.component';
import { ContextMenuModule } from '../context-menu/context-menu.module';
import { InputDialogComponent } from './input-dialog/input-dialog.component';
import { NotificationDialogComponent } from './notification-dialog/notification-dialog.component';
import { EditorsModule } from '../editors/editors.module';
import { AutoCompleteDialogComponent } from './autocomplete-dialog/autocomplete-dialog.component';
import { NewTriggerRaidAbilityComponent } from './new-trigger-raid-ability/new-trigger-raid-ability.component';
import { NewTriggerBuffDialogComponent } from './new-trigger-buff-dialog/new-trigger-buff-dialog.component';
import { NamedGroupConditionsDialogComponent } from './named-group-conditions-dialog/named-group-conditions-dialog.component';
import { MoveOverlaysDialogComponent } from './move-overlays-dialog/move-overlays-dialog.component';
import { ColoredStringPipe } from '../pipes/colored-string.pipe';

@NgModule( {
    imports: [
        BrowserModule,
        FormsModule,
        ReactiveFormsModule,
        MaterialModule,
        BrowserAnimationsModule,
        FormInputModule,
        ContextMenuModule,
        EditorsModule,
    ],
    exports: [
        TriggerDialogComponent,
        ConfirmDialogComponent,
        OverlayDetailsDialogComponent,
        OverlayEditorDialogComponent,
        TriggerActionWizardModalComponent,
        NewTriggerDialogComponent,
        NewCharacterDialogComponent,
        SelectIconDialogComponent,
        NewTriggerFolderDialogComponent,
        SelectTriggerFolderDialogComponent,
        InputDialogComponent,
        NotificationDialogComponent,
        AutoCompleteDialogComponent,
        NewTriggerRaidAbilityComponent,
        NewTriggerBuffDialogComponent,
        NamedGroupConditionsDialogComponent,
        MoveOverlaysDialogComponent,
    ],
    declarations: [
        ColoredStringPipe,
        TriggerDialogComponent,
        ConfirmDialogComponent,
        OverlayDetailsDialogComponent,
        OverlayEditorDialogComponent,
        TriggerActionWizardModalComponent,
        NewTriggerDialogComponent,
        NewCharacterDialogComponent,
        SelectIconDialogComponent,
        NewTriggerFolderDialogComponent,
        SelectTriggerFolderDialogComponent,
        InputDialogComponent,
        NotificationDialogComponent,
        AutoCompleteDialogComponent,
        NewTriggerRaidAbilityComponent,
        NewTriggerBuffDialogComponent,
        NamedGroupConditionsDialogComponent,
        MoveOverlaysDialogComponent,
    ],
    providers: [
        DialogService,
    ],
} )
export class DialogModule { }
