import { FormControl } from "@angular/forms";
import { TriggerModel } from "./core.model";
import { Observable } from "rxjs";

export interface GinaPhoneticTransform {
    ActualWord: string;
    PhoneticWord: string;
}

export interface GinaPhoneticTransforms {
    Transform: GinaPhoneticTransform[];
}

export interface GinaSettings {
    PhoneticTransforms: GinaPhoneticTransforms;
}

export interface GinaTimerEndsTrigger {
    DisplayText: string;
    InterruptSpeech: string;
    MediaFileName: string;
    PlayMediaFile: string;
    TextToVoiceText: string;
    UseText: string;
    UseTextToVoice: string;
}

export interface GinaTimerEarlyEnder {
    EarlyEndText: string;
    EnableRegex: string;
}

export interface GinaTimerEarlyEnders {
    EarlyEnder: GinaTimerEarlyEnder[];
}

export enum GinaTimerTypes {
    NoTimer = 'NoTimer',
    Timer = 'Timer',
    RepeatingTimer = 'RepeatingTimer',
    Stopwatch = 'Stopwatch',
    // This is a custom type that is not part of the Gina XML
    Countup = 'Countup',
}

export enum GinaTimerStartBehaviors {
    StartNewTimer = 'StartNewTimer',
    RestartTimer = 'RestartTimer',
    IgnoreIfRunning = 'IgnoreIfRunning',
}

export interface GinaTrigger {
    Name: string;
    TriggerText: string;
    Comments: string;
    EnableRegex: string;
    UseText: string;
    DisplayText: string;
    CopyToClipboard: string;
    ClipboardText: string;
    UseTextToVoice: string;
    InterruptSpeech: string;
    TextToVoiceText: string;
    PlayMediaFile: string;
    MediaFileName: string;
    TimerType: GinaTimerTypes;
    TimerName: string;
    RestartBasedOnTimerName: string;
    TimerMillisecondDuration: string;
    TimerDuration: string;
    TimerVisibleDuration: string;
    TimerStartBehavior: GinaTimerStartBehaviors;
    TimerEndingTime: string;
    UseTimerEnding: string;
    UseTimerEnded: string;
    TimerEndingTrigger: GinaTimerEndsTrigger;
    TimerEndedTrigger: GinaTimerEndsTrigger;
    UseCounterResetTimer: string;
    CounterResetDuration: string;
    Category: string;
    Modified: string;
    UseFastCheck: string;
    TimerEarlyEnders: GinaTimerEarlyEnders;
}

export interface GinaTriggers {
    Trigger: GinaTrigger[];
}

export interface GinaTriggerGroup {
    Name: string;
    Comments: string;
    SelfCommented: string;
    GroupId: string;
    EnableByDefault: string;
    Triggers: GinaTriggers;
    TriggerGroups: GinaTriggerGroups;
}

export interface GinaTriggerGroups {
    TriggerGroup: GinaTriggerGroup[];
}

export interface GinaNormalPosition {
    Left: string;
    Top: string;
    Right: string;
    Bottom: string;
}

export interface GinaPosition {
    X: string;
    Y: string;
}

export interface GinaWindowPlacement {
    length: string;
    flags: string;
    showCmd: string;
    minPosition: GinaPosition;
    maxPosition: GinaPosition;
    normalPosition: GinaNormalPosition;
}

export interface GinaWindowLayout {
    WINDOWPLACEMENT: GinaWindowPlacement;
}

export enum GinaBehaviorTypes {
    Text = 'Text',
    Timer = 'Timer',
}

export enum GinaSortMethods {
    OrderTriggered = 'OrderTriggered',
    TimeRemaining = 'TimeRemaining',
}

export interface GinaBehavior {
    BehaviorType: GinaBehaviorTypes;
    FontName: string;
    FontSize: string;
    GroupByCharacter: string;
    SortMethod: GinaSortMethods;
    TextFadeTime: string;
    ShowTimerBar: string;
    EmptyBarColor: string;
    StandardizeTimerBars: string;
    BackgroundColor: string;
    BackgroundFadedColor: string;
    WindowLayout: GinaWindowLayout;
}

export interface GinaBehaviors {
    Behavior: GinaBehavior[];
}

export interface GinaCategory {
    IsDefault: 'True' | 'False';
    Name: string;
    TextOverlay: string;
    TextStyle: any;
    TextStyleSource: string;
    TimerOverlay: string;
    TimerStyle: any;
    TimerStyleSource: string;
}

export interface GinaCategories {
    Category: GinaCategory[];
}

export class GinaToNagOverlay {
    GinaOverlayType: 'text' | 'timer';
    GinaOverlay: string;
    NagOverlay: string;
}

export interface GinaConfiguration {
    Settings: GinaSettings;
    TriggerGroups: GinaTriggerGroups;
    BehaviorGroups: GinaBehaviors;
    Categories: GinaCategories;
}

export interface GinaTreeNode {
    expandable: boolean;
    name: string;
    level: number;
    item: GinaTrigger | GinaPhoneticTransform;
    ginaName: string;
    imported: boolean;
    folders: string[];
    selected: boolean;
    id: string;
}

export class GinaTreeObject {
    name: string;
    children: GinaTreeObject[] = [];
    trigger: GinaTrigger;
    phoneticTransform: GinaPhoneticTransform;
    ginaName: string;
    imported: boolean;
    folders: string[] = [];
    selected: boolean;
    id: string;
}

export interface GinaOverlayIds {
    textOverlayName: string;
    timerOverlayName: string;
}

export interface GinaMultiSelectDataModel {
    model: GinaTreeObject;
    folderFamily: string;
}

export class TriggerIdNameModel {
    constructor( triggerId: string, name: string ) { }
}

export class TriggerReviewModel {
    public zoneName: string;
    public zoneNameInputControl: FormControl<string>;
    public zoneNameFilteredOptions: Observable<string[]>;
    constructor( public nagTrigger: TriggerModel, public ginaData: GinaTreeObject, public folderFamilyName: string ) { }
}
