import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MaterialModule } from '../material.module';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { FormInputModule } from '../form-inputs/form-inputs.module';
import { ContextMenuModule } from '../context-menu/context-menu.module';

// Services imports
import { EditorsService } from './editors.service';

// Component imports
import { ConditionsComponent } from './conditions/conditions.component';
import { CapturePhrasesComponent } from './capture-phrases/capture-phrases.component';
import { PhrasesComponent } from './phrases/phrases.component';
import { TriggerActionCounterComponent } from './trigger-action-counter/trigger-action-counter.component';
import { TriggerActionTimerComponent } from './trigger-action-timer/trigger-action-timer.component';
import { TriggerActionDotTimerComponent } from './trigger-action-dotTimer/trigger-action-dotTimer.component';
import { TriggerActionAudioComponent } from './trigger-action-audio/trigger-action-audio.component';
import { TriggerActionClipboardComponent } from './trigger-action-clipboard/trigger-action-clipboard.component';
import { TriggerActionDisplayTextComponent } from './trigger-action-displayText/trigger-action-displayText.component';
import { TriggerActionStoreVariableComponent } from './trigger-action-storeVariable/trigger-action-storeVariable.component';
import { TriggerActionClearVariableComponent } from './trigger-action-clearVariable/trigger-action-clearVariable.component';
import { TriggerActionSpeakComponent } from './trigger-action-speak/trigger-action-speak.component';
import { TriggerActionsComponent } from './trigger-actions/trigger-actions.component';
import { TriggerClassesComponent } from './trigger-classes/trigger-classes.component';
import { StylePropertiesComponent } from './style-properties/style-properties.component';
import { TriggerActionDeathRecapComponent } from './trigger-action-death-recap/trigger-action-death-recap.component';

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
        ConditionsComponent,
        CapturePhrasesComponent,
        PhrasesComponent,
        TriggerClassesComponent,
        TriggerActionCounterComponent,
        TriggerActionTimerComponent,
        TriggerActionDotTimerComponent,
        TriggerActionAudioComponent,
        TriggerActionClipboardComponent,
        TriggerActionDisplayTextComponent,
        TriggerActionStoreVariableComponent,
        TriggerActionClearVariableComponent,
        TriggerActionSpeakComponent,
        TriggerActionsComponent,
        StylePropertiesComponent,
        TriggerActionDeathRecapComponent,
    ],
    declarations: [
        ConditionsComponent,
        CapturePhrasesComponent,
        PhrasesComponent,
        TriggerClassesComponent,
        TriggerActionCounterComponent,
        TriggerActionTimerComponent,
        TriggerActionDotTimerComponent,
        TriggerActionAudioComponent,
        TriggerActionClipboardComponent,
        TriggerActionDisplayTextComponent,
        TriggerActionStoreVariableComponent,
        TriggerActionClearVariableComponent,
        TriggerActionSpeakComponent,
        TriggerActionsComponent,
        StylePropertiesComponent,
        TriggerActionDeathRecapComponent,
    ],
    providers: [],
})
export class EditorsModule { }
