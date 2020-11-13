import { StringProtocolResponse } from 'electron';

export class TriggerModel {
    
    public triggerId: string = null;
    public name: string = '';
    public capturePhrases: CapturePhrase[] = [];
    public comments: string = '';
    public actions: TriggerAction[] = [];
    public captureMethod: string = 'Any match';
    public conditions: TriggerCondition[] = [];
    public spellLevel: number = 0;
    public predefined: boolean = false;
    public onlyExecuteInDev: boolean = false;

}

export enum TriggerConditionTypes {
    
    VariableValue = 1,

}

export enum OperatorTypes {
    
    IsNull =                0,
    Equals =                1 << 0,
    DoesNotEqual =          1 << 1,
    LessThan =              1 << 2,
    GreaterThan =           1 << 3,

}

export class TriggerCondition {
    
    public conditionId: string = null;
    public conditionType: TriggerConditionTypes = TriggerConditionTypes.VariableValue;
    public operatorType: OperatorTypes;
    public variableName: string;
    public variableValue: string;

}

export class CapturePhrase {
    public phraseId: string;
    public phrase: string;
    public useRegEx: boolean = false;
    public requirePreviousPhrase: boolean = false;
    public duration: number = null;
}

export class DkpEntryModel {

    public entryId: string = null;
    public timeStamp: Date = new Date();
    public character: string = '';
    public item: string = '';
    public dkp: number = 0;
    public entered: boolean = false;
    public dateEntered: Date = null;

}

export class OverlayWindowModel {

    public overlayId: string = null;
    public windowHeight: number = null;
    public windowWidth: number = null;
    public x: number = null;
    public y: number = null;
    public name: string = '';
    public overlayType: string = '';
    public fontFamily: string = 'Roboto';
    public fontSize: number = 14;
    public lineHeight: number = 90;
    public fontWeight: number = 400;
    public fontColor: string = '#ffffff';
    public fontTransparency: number = 1.0;
    public backgroundColor: string = '#000000';
    public backgroundTransparency: number = 0.0;
    public borderColor: string = '#000000';
    public borderTransparency: number = 0.0;
    public timerSortType: TimerSortTypes = TimerSortTypes.Ascending;
    public timerColor: string = '#008000';
    
    public showTextBorder: boolean = false;
    public textBorderColor: string = '#000000';
    public textBorderIntensity: number = 1;

    public showTextGlow: boolean = false;
    public textGlowColor: string = '#000000';
    public textGlowIntensity: number = 1;
    public textGlowSize: number = 10;

    public isValid (): boolean {
        return name != null && this.overlayType != null;
    }

}

export class DataTickModel {

    public dkpEntries: DkpEntryModel[] = [];
    public logFile: string;
    public voiceIndex: number;
    public triggers: TriggerModel[] = [];
    public overlays: OverlayWindowModel[] = [];
    public enableFct: boolean = false;
    public damageDealtOverlayId: string;
    public damageReceivedOverlayId: string;
    public hasExtendedDotFocus: boolean = false;
    public extendedDotFocusPercent: number = 0;
    public extendedDotFocusDecayLevel: number = 1;

}

export enum ActionTypes {
    
    DisplayText = 0,
    PlayAudio = 1,
    Speak = 2,
    Timer = 3,
    Countdown = 4,
    StoreVariable = 5,
    DotTimer = 6,
    ClearVariable = 7,
    
}

export enum TimerSortTypes {

    None = 0,
    Ascending = 1,
    Descending = 2,

}

export class TriggerAction {

    public actionId: string;
    public actionType: ActionTypes;
    public phrases: string[] = [];
    public overlayId: string;
    public displayText: string;
    public duration: number;
    public variableName: string;
    public restartOnDuplicate: boolean;
    public onlyExecuteInDev: boolean = false;
    public overrideTimerColor: string = null;
    public timerBackgroundColor: string = null;
    public useCustomColor: boolean = false;
    public ifEndingSoon: boolean = false;
    public endingDuration: number = null;
    public endingSoonChangeColor: boolean = false;
    public endingSoonColor: string = null;
    public endingSoonBackgroundColor: string = null;
    
    public endingSoonDisplayText: boolean = false;
    public endingSoonTextOverlayId: string = null;
    public endingSoonText: string = null;
    public endingSoonTextDuration: number = null;

    public endingSoonSpeak: boolean = false;
    public endingSoonSpeakPhrase: string = null;

    public remainAfterEnded: boolean = false;
    public remainDuration: number = null;
    
    public endedDisplayText: boolean = false;
    public endedTextOverlayId: string = null;
    public endedText: string = null;
    public endedTextDuration: number = null;

    public endedSpeak: boolean = false;
    public endedSpeakPhrase: string = null;

    public endedChangeColor: boolean = false;
    public endedColor: string = null;
    public endedBackgroundColor: string = null;
}

export class ScrapedSpell {
    
    public name: string;
    public duration: number;
    // public class: string;
    public level: number;
    public castOnOther: string;

}

export class FocusEffectSettings {
    
    public hasExtendedDotFocus: boolean = false;
    public extendedDotFocusPercent: number = 0;
    public extendedDotFocusDecayLevel: number = 1;

}

export class CharacterModel {

    public characterId: string;
    public name: string;
    public class: string;
    public hasExtendedDotFocus: boolean;
    public extendedDotFocusPercent: number;
    public extendedDotFocusDecayLevel: number;
    public logFile: string;
    public server: string;
    
}

export class NewCharacterOptionModel {
    
    public server: string;
    public options: CharacterModel[] = [];

}
