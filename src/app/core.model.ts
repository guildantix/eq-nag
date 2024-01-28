import { Color, StringUtility } from './utilities';
import * as _ from 'lodash-es';
import { nagId } from './core/nag-id.util';
import { TriggerPackageExportTypes, TriggerPackageProperty } from './core.decorators';

export const ErrorCodes = {
    EqFolderNotFound: {
        code: 'EQDIRNULL',
        message: 'Could not locate your EverQuest folder.',
    }
};

export enum LogTypes {
    
    info = 0,
    error = 1,
    success = 2,
    warning = 3,
    debug = 4,

}

export enum SettingsKeys {
    
    logMaintenanceRules = 'logMaintenanceRules',
    allowPrerelease = 'allowPrerelease',
    voiceIndex = 'voiceIndex',
    enableCheckWindowPosition = 'enableCheckWindowPosition',
    sharedTriggerPermissions = 'sharedTriggerPermissions',
    speechVolume = 'speechVolume',
    audioVolume = 'audioVolume',
    baseSpeakingRate = 'baseSpeakingRate',
    enableGpuAcceleration = 'enableGpuAcceleration',

};

export enum ActionTypes {
    
    DisplayText = 0,
    PlayAudio = 1,
    Speak = 2,
    Timer = 3,
    Countdown = 4,
    StoreVariable = 5,
    DotTimer = 6,
    ClearVariable = 7,
    Counter = 8,
    Clipboard = 9,
    BeneficialTimer = 10,
    DisplayDeathRecap = 11,
    ScreenGlow = 12,
    ClearAll = 13,
    Stopwatch = 14,

}

export enum QuickShareAuthorListTypes {
    
    Disabled = 0,
    Whitelist = 1,
    Blacklist = 2,

}

export const actionOverlayMap: Record<number, 'Log' | 'Alert' | 'Timer' | 'FCT' | 'Chart' | ''> = {
    0: 'Alert',
    1: '',
    2: '',
    3: 'Timer',
    4: 'Timer',
    5: '',
    6: 'Timer',
    7: '',
    8: '',
    9: '',
    10: 'Timer',
    11: '',
    12: '',
};

export function ActionTypeLabels(actionType: ActionTypes): string {
    

    return actionType === ActionTypes.DisplayText ? 'Display Text' :
        actionType === ActionTypes.PlayAudio ? 'Play Audio' :
        actionType === ActionTypes.Speak ? 'Speak' :
        actionType === ActionTypes.Timer ? 'Timer' :
        actionType === ActionTypes.Countdown ? 'Countdown' :
        actionType === ActionTypes.StoreVariable ? 'Store Variable' :
        actionType === ActionTypes.DotTimer ? 'DoT Timer' :
        actionType === ActionTypes.ClearVariable ? 'Clear Variable' :
        actionType === ActionTypes.Counter ? 'Counter' :
        actionType === ActionTypes.Clipboard ? 'Clipboard' :
        actionType === ActionTypes.BeneficialTimer ? 'Beneficial Timer' :
        actionType === ActionTypes.DisplayDeathRecap ? 'Display Death Recap' :
        actionType === ActionTypes.ScreenGlow ? 'Screen Glow' :
        actionType === ActionTypes.ClearAll ? 'Clear All' :
        actionType === ActionTypes.Stopwatch ? 'Stopwatch' :
        'Unset Action';
    
}

export function ActionTypeIcons( actionType: ActionTypes ): string {
    return actionType === ActionTypes.DisplayText ? 'text_format' :
        actionType === ActionTypes.PlayAudio ? 'audiotrack' :
        actionType === ActionTypes.Speak ? 'volume_up' :
        actionType === ActionTypes.Timer ? 'alarm' :
        actionType === ActionTypes.Countdown ? 'watch' :
        actionType === ActionTypes.StoreVariable ? 'sd_storage' :
        actionType === ActionTypes.DotTimer ? 'watch_later' :
        actionType === ActionTypes.ClearVariable ? 'sd_storage' :
        actionType === ActionTypes.Counter ? 'exposure_plus_1' :
        actionType === ActionTypes.Clipboard ? 'content_copy' :
        actionType === ActionTypes.BeneficialTimer ? 'watch_later' :
        actionType === ActionTypes.DisplayDeathRecap ? 'sick' :
        actionType === ActionTypes.ScreenGlow ? 'brightness_5' :
        actionType === ActionTypes.ClearAll ? 'layers_clear' :
        actionType === ActionTypes.Stopwatch ? 'timer' :
        'block';
}

export enum MediaTypes {
    
    Unknown = 0,
    Image = 1,
    Audio = 2,
    Text = 3,

}

export enum TimerSortTypes {

    None = 0,
    Ascending = 1,
    Descending = 2,

}

export enum CharacterClasses {
    Bard = 'BRD',
    Beastlord = 'BST',
    Berserker = 'BER',
    Cleric = 'CLR',
    Druid = 'DRU',
    Enchanter = 'ENC',
    Magician = 'MAG',
    Monk = 'MNK',
    Necromancer = 'NEC',
    Paladin = 'PAL',
    Ranger = 'RNG',
    Rogue = 'ROG',
    Shadowknight = 'SHD',
    Shaman = 'SHM',
    Warrior = 'WAR',
    Wizard = 'WIZ',
}

export enum ExternalDataSources {
    Allakhazam = 'ZAM',
    EqSpellResources = 'EQSR',
}

export enum ImportTypes {
    None = 0,
    DotTimer = 1,
    Ability = 2,
    Npc = 3,
    Buff = 4,
    OthersBuff = 5,
}

export enum TimerRestartBehaviors {
    
    StartNewTimer = 0,
    RestartOnDuplicate = 1,
    RestartTimer = 2,
    DoNothing = 3,

}

export class Point {
    constructor(
        public x: number,
        public y: number ) { }
}

export class Rectangle {
    constructor(
        public x: number,
        public y: number,
        public width: number,
        public height: number ) { }
}

export class TriggerFolder {
    public folderId: string;
    public name: string;
    public expanded: boolean = false;
    public active: boolean = true;
    public comments: string;
    public children: TriggerFolder[] = [];
    public folderConditions: TriggerCondition[] = [];

    /**
     * Returns the specified trigger folder in the given hierarchy.
     * 
     * @param folderId The id of the desired folder.
     * @param search The list of folders to query.
     * @returns 
     */
    public static findFolderById( folderId: string, search: TriggerFolder[] ): TriggerFolder {
        // TODO: Update all find folder by id methods to use this method.
        
        for ( let i = 0; i < search?.length; i++ ) {
            let folder = search[ i ].folderId === folderId ? search[ i ] : this.findFolderById( folderId, search[ i ].children );
    
            if ( folder ) {
                return folder;
            }
        }
    
    }

    /**
     * Returns the direct ancestry of the specified folder.
     * 
     * @comments This method will strip all siblings from the hierarchy, 
     *           returning only the direct ancestors of the specified folder.
     * 
     * @param folderId The desired folder id.
     * @param rootFolders The root list of folders.
     */
    public static getFolderAncestry( folderId: string, rootFolders: TriggerFolder[] ): TriggerFolder[] {
        let flat: string[] = [ folderId ];
        let ancestryMap: Record<string, string> = this.getFolderAncestryMap( rootFolders );

        // Traverse up the ancestry, stopping at the parent root folder id.
        let t: string = ancestryMap[ folderId ];
        while ( t != null ) {
            flat.push( t );
            t = ancestryMap[ t ];
        }

        let output: TriggerFolder[] = [];
        let generation: TriggerFolder[] = rootFolders;
        let outputGeneration = output;

        for ( let i = flat.length - 1; i >= 0; i-- ) {

            let folder = generation.find( f => f.folderId === flat[ i ] );
            let ancestor = new TriggerFolder();

            ancestor.folderId = folder.folderId;
            ancestor.name = folder.name;
            ancestor.expanded = folder.expanded;
            ancestor.active = folder.active;
            ancestor.comments = folder.comments;
            ancestor.children = [];

            outputGeneration.push( ancestor );

            // Setup the next generation.
            outputGeneration = ancestor.children;
            generation = folder.children;

        }

        return output;
    }

    /**
     * Builds a flat ancestry map to quickly lookup the parent folder id of any 
     * folder in the given folder hierarchy.
     * 
     * @param folders The folder hierarchy.
     * @returns Returns the ancestry map.
     */
    public static getFolderAncestryMap( folders: TriggerFolder[] ): Record<string, string> {
        // TODO: Ancestry map gen should be using this method.
        let ancestryMap: Record<string, string> = {};

        for ( let i = 0; i < folders.length; i++ ) {
            ancestryMap[ folders[ i ].folderId ] = null;

            if ( folders[ i ].children?.length > 0 ) {
                this._recursiveBuildAncestryMap( ancestryMap, folders[ i ].children, folders[ i ].folderId );
            }
        }

        return ancestryMap;
    }

    /**
     * The recursive function that generates the ancestry map.
     * 
     * @param ancestryMap The current ancestry map, which will be modified by reference.
     * @param children The children of the current parent folder.
     * @param parentId The id of the parent folder.
     */
    private static _recursiveBuildAncestryMap( ancestryMap: Record<string, string>, children: TriggerFolder[], parentId: string ) {

        for ( let i = 0; i < children.length; i++ ) {
            ancestryMap[ children[ i ].folderId ] = parentId;
            
            if ( children[ i ].children?.length > 0 ) {
                this._recursiveBuildAncestryMap( ancestryMap, children[ i ].children, children[ i ].folderId );
            }
        }

    }
}

export class CharacterClassLevel {
    public class: string;
    public level: number;
}

export class BasicError {
    
    public errorCode: string;
    public message: string;

}

export class TriggerModel {
    
    public triggerId: string = null;
    public folderId: string = null;
    public packageId: string = null;
    public name: string = '';
    public capturePhrases: CapturePhrase[] = [];
    public comments: string = '';
    public actions: TriggerAction[] = [];
    public captureMethod: string = 'Any match';
    public conditions: TriggerCondition[] = [];
    public classLevels: CharacterClassLevel[] = [];
    public predefined: boolean = false;
    public onlyExecuteInDev: boolean = false;
    public allakhazamUrl: string = null;
    public externalSource: ExternalDataSources | undefined = undefined;
    public importIdentifier: string = null;
    public importType: ImportTypes;
    public useCooldown: boolean = false;
    public cooldownDuration: number = 0;
    public enabled: boolean = true;
    public sequentialRestartBehavior: string = 'none';
    
}

export enum TriggerConditionTypes {
    
    VariableValue = 1,
    NamedGroupValue = 2,

}

export enum OperatorTypes {
    
    IsNull =                0,
    Equals =                1 << 0,
    DoesNotEqual =          1 << 1,
    LessThan =              1 << 2,
    GreaterThan =           1 << 3,
    Contains =              1 << 4,

}

export class TriggerConditionProperties {

    public conditionType: TriggerConditionTypes = TriggerConditionTypes.VariableValue;
    public operatorType: OperatorTypes;
    public variableName: string;
    public variableValue: string;

}

export class TriggerCondition extends TriggerConditionProperties {
    
    public conditionId: string = null;

}

export class PhraseProperties {

    public phrase: string;
    public useRegEx: boolean;

}

export class Phrase extends PhraseProperties {

    public phraseId: string;

}

export class CapturePhrase extends Phrase {
    public requirePreviousPhrase: boolean = false;
    public duration: number = null;
}

export class Tag {
    public tagId: string;
    public name: string;
    public description: string;
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

export class StylePropertiesModel {
    
    public fontFamily: string = 'Roboto';
    public fontSize: number = 14;
    public lineHeight: number = 90;
    public fontWeight: number = 400;
    public fontColor: string = '#ffffff';
    public fontTransparency: number = 1;
    public showBorder: boolean = true;
    public borderColor: string = '#000000';
    public borderIntensity: number = 1;
    public showGlow: boolean = true;
    public glowColor: string = '#000000';
    public glowIntensity: number = 1;
    public glowSize: number = 5;
    public paddingLeft: number = 0;
    public paddingRight: number = 0;
    public paddingTop: number = 0;
    public paddingBottom: number = 0;
    public position: 'inline' | 'block' = 'inline';
    public justify: 'left' | 'center' | 'right' = 'left';

    public static applyStyles( el: HTMLElement, style: StylePropertiesModel ): void {
        // TODO: This method should execute the method from core.js, via the api.
        if ( el ) {
            el.style.fontFamily = `"${style.fontFamily}"`;
            el.style.fontSize = `${style.fontSize}px`;
            el.style.lineHeight = `${( style.lineHeight > 10 ? style.lineHeight : 90 ) / 100}em`;
            el.style.fontWeight = `${style.fontWeight > 0 ? style.fontWeight : 300}`;
            el.style.color = style.fontColor;
            el.style.opacity = style.fontTransparency.toString();

            el.style.paddingLeft = style.paddingLeft > 0 ? `${style.paddingLeft}px` : null;
            el.style.paddingRight = style.paddingRight > 0 ? `${style.paddingRight}px` : null;
            el.style.paddingTop = style.paddingTop > 0 ? `${style.paddingTop}px` : null;
            el.style.paddingBottom = style.paddingBottom > 0 ? `${style.paddingBottom}px` : null;

            el.style.fontWeight = style.fontWeight.toString();
            el.style.display = style.position === 'inline' ? 'inline-block' : 'block';
            
            let textShadow = '';

            if ( style.showBorder ) {
                textShadow += window.api.utils.styles.textOutline( style.borderColor, style.borderIntensity );
            }

            if ( style.showGlow ) {
                textShadow += `${style.showBorder ? ', ' : ''}${window.api.utils.styles.textGlow( style.glowColor, style.glowSize, style.glowIntensity )}`;
            }

            el.style.textShadow = textShadow.trim();
            el.style.textAlign = style.justify;
        }
    }

    public static getHashValue( styles: StylePropertiesModel ): string {
        return `${styles.fontFamily}${styles.fontSize}${styles.lineHeight}${styles.fontWeight}${styles.fontColor}${styles.fontTransparency}${styles.showBorder}${styles.borderColor}${styles.borderIntensity}${styles.showGlow}${styles.glowColor}${styles.glowIntensity}${styles.glowSize}${styles.paddingLeft}${styles.paddingRight}${styles.paddingTop}${styles.paddingBottom}${styles.position}${styles.justify}`;
    }
}

export class FctStylesModel {

    public fctDmgOutStyle: StylePropertiesModel = null;
    public fctDmgInStyle: StylePropertiesModel = null;
    public fctSpellDmgOutStyle: StylePropertiesModel = null;
    public fctSpellDmgInStyle: StylePropertiesModel = null;
    public fctHealingOutStyle: StylePropertiesModel = null;
    public fctHealingInStyle: StylePropertiesModel = null;
    public fctSkillStyle: StylePropertiesModel = null;

}

export class OverlayWindowModel {

    public overlayId: string = null;
    public windowHeight: number = null;
    public windowWidth: number = null;
    public x: number = null;
    public y: number = null;
    public name: string = '';
    public description: string;
    public overlayType: 'Log' | 'Alert' | 'Timer' | 'FCT' | 'Chart' | '' = '';
    public fontFamily: string = 'Roboto';
    public horizontalAlignment: string = 'center';
    public verticalAlignment: string = 'bottom';
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
    public timerBackgroundColor: string = '#0080004b';
    public displayId: number;
    public displayBounds: Electron.Rectangle;
    
    public showTextBorder: boolean = false;
    public textBorderColor: string = '#000000';
    public textBorderIntensity: number = 1;

    public showTextGlow: boolean = false;
    public textGlowColor: string = '#000000';
    public textGlowIntensity: number = 1;
    public textGlowSize: number = 10;

    public groupByTarget: boolean = false;
    public groupHeaderSize: number = 40;
    public groupHeaderWeight: number = 400;
    public groupHeaderColor: string = '#ffffff';
    public showTimeRemaining: boolean = false;
    public hideTargetLabel: boolean = false;

    public reverse: boolean = false;

    public isValid (): boolean {
        return name != null && this.overlayType != null;
    }

}

export class DataTickModel {

    public dkpEntries: DkpEntryModel[] = [];
    public logFile: string;
    public voiceIndex: number;
    public masterVolume: number = 100;
    public speechVolume: number = 100;
    public audioVolume: number = 100;
    public triggers: TriggerModel[] = [];
    public overlays: OverlayWindowModel[] = [];
    public enableFct: boolean = false;
    public fctShowCriticalsInline: boolean = false;
    public damageDealtOverlayId: string;
    public damageReceivedOverlayId: string;
    public hasExtendedDotFocus: boolean = false;
    public extendedDotFocusPercent: number = 0;
    public extendedDotFocusDecayLevel: number = 1;
    public phoneticTransforms: Record<string, string> = {};
    public ignoredGinaObjects: string[] = [];
    public folders: TriggerFolder[] = [];
    public fctStyles: FctStylesModel;
    public enableQuickShareImports: boolean = true;
    public quickShareAuthorsListType: QuickShareAuthorListTypes;
    public quickShareAuthorsList: string[] = [];
    public baseSpeakingRate: number = 1;
    public characterDisabledTriggers: {
        characterId: any;
        disabledTriggers: string[];
    }[] | undefined = undefined;
    public triggerProfileDisabledTriggers: {
        triggerProfileId: any;
        disabledTriggers: string[];
    }[] | undefined = undefined;
    public triggerChanges: boolean = false;
    
}

export class VariableAssignment {
    public name: string;
    public value: string;
}

export class TriggerSubAction {
    
    public actionId: string;
    public variableValues: VariableAssignment[] = [];

}

export class TriggerActionProperties {
    
    @TriggerPackageProperty( {
        propertyType: TriggerPackageExportTypes.OverlayId,
        name: 'Action Primary Overlay',
        description: 'For timer time actions, this will be where the timer displays.  For text type actions, this is where the text will be displayed.'
    } )
    public overlayId: string = null;

    public duration: number = null;
    public storageDuration: string = null;
    /** @deprecated Use showDuration instead. */
    public showRemainingDuration: boolean = false;
    public showDuration: boolean = false;
    public repeatTimer: boolean = false;
    public repeatCount: number = null;
    public variableName: string = null;
    public storeLiteralDefinition: string = null;
    public onlyStoreUsedValues: boolean = false;
    public loopBackForValue: boolean = false;
    public restartBehavior: TimerRestartBehaviors = null;
    public onlyExecuteInDev: boolean = false;
    public overrideTimerColor: string = null;
    public timerBackgroundColor: string = null;
    public useCustomColor: boolean = false;
    public timerIcon: string = null;
    public timerIconDef: string = null;
    public interruptSpeech: boolean = false;
    public speechVolume: number = 100;
    public speechRate: number = 1;
    public speakNext: boolean = false;
    public hideTimer: boolean = false;
    public hideConditions: TriggerCondition[] = [];
    public castTime: number = null;
    public onlyUseAaBeneficialFocus: boolean = false;
    public skipBenCastingTimeFocus: boolean = false;
    public variableStorageType: string = 'localVariable';
    public flash: boolean = false;
    public storeDuration: boolean = false;

    public endingSoonSubActions: TriggerSubAction[] = [];
    public endedSubActions: TriggerSubAction[] = [];

    public ifEndingSoon: boolean = false;
    public endingSoonShowTimer: boolean = false;
    public endingDuration: number = null;
    public endingSoonChangeColor: boolean = false;
    public endingSoonColor: string = null;
    public endingSoonBackgroundColor: string = null;
    
    public endingSoonDisplayText: boolean = false;
    @TriggerPackageProperty( {
        propertyType: TriggerPackageExportTypes.OverlayId,
        name: 'Ending Soon Text Overlay',
        description: 'For timer type actions, when text is displayed when ending soon, this is the overlay that text will appear.'
    } )
    public endingSoonTextOverlayId: string = null;
    public endingSoonText: string = null;
    public endingSoonTextDuration: number = null;

    public endingSoonSpeak: boolean = false;
    public endingSoonSpeakPhrase: string = null;
    public endingSoonInterruptSpeech: boolean = false;

    public endingClipboard: boolean = false;
    public endingClipboardText: string = null;

    public endingPlayAudio: boolean = false;
    @TriggerPackageProperty( {
        propertyType: TriggerPackageExportTypes.AudioFileId,
        name: 'Ending Soon Audio File',
        description: 'For timer type actions, when audio is played when ending soon, this is the audio file to play.'
    } )
    public endingPlayAudioFileId: string = null;

    public remainAfterEnded: boolean = false;
    public notifyWhenEnded: boolean = false;
    public remainDuration: number = null;
    public remainUnlessEndedEarly: boolean = false;
    
    public endedDisplayText: boolean = false;
    @TriggerPackageProperty( {
        propertyType: TriggerPackageExportTypes.OverlayId,
        name: 'Ended Text Overlay',
        description: 'For timer type actions, when text is displayed when the timer ends, this is the overlay that text will appear.'
    } )
    public endedTextOverlayId: string = null;
    public endedText: string = null;
    public endedTextDuration: number = null;
    
    public endedClipboard: boolean = false;
    public endedClipboardText: string = null;

    public endedSpeak: boolean = false;
    public endedSpeakPhrase: string = null;
    public endedInterruptSpeech: boolean = false;

    public endedPlayAudio: boolean = false;
    @TriggerPackageProperty( {
        propertyType: TriggerPackageExportTypes.AudioFileId,
        name: 'Ended Audio File',
        description: 'For timer type actions, when audio is played when the timer ends, this is the audio file to play.'
    } )
    public endedPlayAudioFileId: string = null;

    public endedChangeColor: boolean = false;
    public endedColor: string = null;
    public endedBackgroundColor: string = null;
    
    public excludeTargets: Phrase[] = [];
    public endEarlyPhrases: Phrase[] = [];
    public resetCounterPhrases: Phrase[] = [];

    @TriggerPackageProperty( {
        propertyType: TriggerPackageExportTypes.AudioFileId,
        name: 'Audio File',
        description: 'For audio actions, this is the audio file that plays.'
    } )
    public audioFileId: string = null;
    public audioVolume: number = 100;

    public textUseCustomFont: boolean = false;
    public textFont: string = null;
    public textWeight: number = null;

    public textUseCustomSize: boolean = false;
    public textSize: number = null;
    public textSpacing: number = null;

    public textUseCustomColor: boolean = false;
    public textColor: string = null;

    public textUseCustomBorder: boolean = false;
    public textBorderColor: string = null;
    public textBorderIntensity: number = null;
    
    public textUseCustomGlow: boolean = false;
    public textGlowColor: string = null;
    public textGlowIntensity: number = null;
    public textGlowSize: number = null;

}

export class TriggerAction extends TriggerActionProperties {

    public actionId: string;
    public actionType: ActionTypes;
    public phrases: string[] = [];
    public name: string;
    public displayText: string;
    public secondaryPhrases: string[] = [];








    
    /**
     * Returns a list of all variable names used in the given action.
     * 
     * @param action The action to query.
     */
    public static findVariableNames( action: TriggerAction ): string[] {
        let r = /(?<variableName>[$|#]\{\S+?\})/gi;

        let variableNames = StringUtility.MatchAll( action.displayText, r, 'variableName' );
        action.excludeTargets.forEach( f => {
            variableNames = Array.prototype.concat( variableNames, StringUtility.MatchAll( f.phrase, r, 'variableName' ) );
        } );
        action.endEarlyPhrases.forEach( f => {
            variableNames = Array.prototype.concat( variableNames, StringUtility.MatchAll( f.phrase, r, 'variableName' ) );
        } );
        action.resetCounterPhrases.forEach( f => {
            variableNames = Array.prototype.concat( variableNames, StringUtility.MatchAll( f.phrase, r, 'variableName' ) );
        } );

        return _.uniq( variableNames );
    }
}

export class OwnedTriggerAction extends TriggerAction {
    public triggerId: string;
    public triggerName: string;
    public phrase: string;
    public storeLocation: 'gina' | 'nag';
}

export class DuplicateTriggerAction {

    public triggerId: string = null;
    public phrase: string = null;
    public actions: OwnedTriggerAction[] = [];
    public subjectAction: TriggerAction;

}

export class OutsideResource {

    public get allakhazam(): boolean {
        return this.url.match( /^(http|https):\/\/.*\.allakhazam\.com.*/gi )?.length > 0;
    }

    public get eqSpellResources(): boolean {
        return this.url.match( /^(http|https):\/\/.*\.eqresource\.com.*/gi )?.length > 0;
    }
    
    public url: string;
    public name: string;
    public selected: boolean = false;

}

export class ScrapedClickEffect {
    public name: string;
    /** The cast time, in milliseconds. */
    public castTime: number;
    public classes: CharacterClassLevel[] = [];
}

export class ScrapedSpell {
    
    public name: string;
    public duration: number;
    public classes: CharacterClassLevel[] = [];
    public castOnOther: string;
    public castOnYou: string;
    public youCast: string;
    public gemIndex: number;
    public gemSrc: string;
    public targetType: string;
    /** The cast time, in milliseconds. */
    public castTime: number;
    public effectFades: string;
    public itemsWithEffect: OutsideResource[] = [];
    public itemClickOnly: boolean = false;
    
}

export class ScrapedAbility {
    
    public name: string;
    public duration: number;
    public castOnOther: string;
    public castOnYou: string;
    public gemIndex: number;
    public gemSrc: string;
    public cureType: string;
    public counters: number;
    public resistType: string;
    public resistMod: number;
    public stun: boolean;
    public manaDrain: boolean;
    public silence: boolean;
    public deathTouch: boolean;
    public deathTouchDuration: number;
    public npcsWithAbility: ScrapedNpc[] = [];
    public castTime: number;

}

export class ScrapedNpc {
    
    public name: string;
    public url: string;
    public zones: string[];
    public recast: number;

}

export class FocusEffectSettings {
    
    public hasExtendedDotFocus: boolean = false;
    public extendedDotFocusPercent: number = 0;
    public extendedDotFocusDecayLevel: number = 1;

}

export class TriggersProfileModel {
    
    public profileId: string;
    public name: string;
    public disabledTriggers: string[] = [];
    public disableTriggersByDefault: boolean = false;

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
    public hasExtendedBeneficialFocus: boolean;
    public extendedBeneficialFocusPercent: number;
    public extendedBeneficialFocusDecayLevel: number;
    public extendedBeneficialFocusAaPercent: number;
    public hasBeneficialCastingSpeedFocus: boolean;
    public beneficialCastingSpeedFocusPercent: number;
    public beneficialCastingSpeedFocusAaPercent: number;
    public beneficialCastingSpeedFocusAaDurationLimit: number;
    public beneficialCastingSpeedFocusDecayLevel: number;
    public p99: boolean = false;
    public takp: boolean = false;
    public daybreak: boolean = false;
    public triggerProfile: string | undefined = undefined;
    public disabledTriggers: string[] = [];
    public disableTriggersByDefault: boolean = false;
    
}

export class NewCharacterOptionModel {
    
    public server: string;
    public options: CharacterModel[] = [];

}

export class BaseFileModel {
    
    public fileId: string = null;
    public mediaType: MediaTypes = MediaTypes.Unknown;
    public fileName: string = null;

}

export class FileModel extends BaseFileModel {

    public physicalName: string = null;

}

export class PackageFileModel extends BaseFileModel {
    
    public contents: string;

}

export class QuickShareFileModel extends PackageFileModel { }

export class AuthorModel {
    public authorId: string;
    public name: string;
    public discord: string;
}

export class TriggerPackageVersion {
    
    public packageId: string;
    public versionId: string;
    public timestamp: Date;
    public name: string;
    public description: string;
    public author: string;
    public authorDiscord: string;

}

export class VersionHistory {

    public versionId: string;
    public timestamp: Date;
    public notes: string;

}

export class TriggerPackageVersionInfoModel {
    
    public TriggerPackageId: string;
    public CurrentVersionId: string;
    public TimeStamp: Date;

}

export class TriggerPackageTransferModel {

    public model: any;
    public notes: string;
    public name: string;
    public description: string;
    public files: PackageFileModel[] = [];
    public category: string;
    public tags: string[] = [];
    
}

export class PackageFolder {

    public folderId: string;
    public name: string;
    public children: PackageFolder[] = [];

    /**
     * Returns the specified trigger folder in the given hierarchy.
     * 
     * @param folderId The id of the desired folder.
     * @param search The list of folders to query.
     * @returns 
     */
    public static findFolderById( folderId: string, search: PackageFolder[] ): PackageFolder {

        for ( let i = 0; i < search?.length; i++ ) {
            let folder = search[ i ].folderId === folderId ? search[ i ] : this.findFolderById( folderId, search[ i ].children );

            if ( folder ) {
                return folder;
            }
        }

    }

    /**
     * Returns a list of all direct and descendant child folders.
     * 
     * @param folder The starting folder.
     * @param descendantIds The current list of descendant folder ids.
     * @returns 
     */
     public static getDescendantFolderIds( folder: PackageFolder, descendantIds: string[] = null ): string[]{
        descendantIds = descendantIds ? descendantIds : [];

        descendantIds.push( folder.folderId );

        folder.children.forEach( c => this.getDescendantFolderIds( c, descendantIds ) );

        return descendantIds;
    }

}

export class PackageTrigger {

    public triggerId: string = null;
    public folderId: string = null;
    public name: string = '';
    public capturePhrases: CapturePhrase[] = [];
    public comments: string = '';
    public actions: TriggerAction[] = [];
    public captureMethod: string = 'Any match';
    public conditions: TriggerCondition[] = [];
    public classLevels: CharacterClassLevel[] = [];
    public useCooldown: boolean = false;
    public cooldownDuration: number = 0;
    public sequentialRestartBehavior: string = 'none';










    /**
     * Creates a new package trigger object from the given trigger model.
     * 
     * @returns Returns the created package trigger.
     * 
     * @param trigger The base trigger.
     */
    public static FromTrigger( trigger: TriggerModel ): PackageTrigger {
        let pTrg = new PackageTrigger();

        pTrg.triggerId = trigger.triggerId;
        pTrg.folderId = trigger.folderId;
        pTrg.name = trigger.name;
        pTrg.capturePhrases = _.cloneDeep( trigger.capturePhrases );
        pTrg.comments = _.cloneDeep( trigger.comments );
        pTrg.actions = _.cloneDeep( trigger.actions );
        pTrg.captureMethod = _.cloneDeep( trigger.captureMethod );
        pTrg.conditions = _.cloneDeep( trigger.conditions );
        pTrg.classLevels = _.cloneDeep( trigger.classLevels );
        pTrg.useCooldown = trigger.useCooldown;
        pTrg.cooldownDuration = trigger.cooldownDuration;

        return pTrg;
    }










    /**
     * Converts the given package trigger to a trigger model.
     * 
     * @returns Returns the converted trigger model.
     * 
     * @param packageTrigger The package trigger to convert.
     */
    public static ToTrigger( packageTrigger: PackageTrigger ): TriggerModel {
        let trg = new TriggerModel();

        trg.triggerId = packageTrigger.triggerId;
        trg.folderId = packageTrigger.folderId;
        trg.name = packageTrigger.name;
        trg.capturePhrases = _.cloneDeep( packageTrigger.capturePhrases ) ?? [];
        trg.comments = _.cloneDeep( packageTrigger.comments ) ?? '';
        trg.actions = _.cloneDeep( packageTrigger.actions ) ?? [];
        trg.captureMethod = _.cloneDeep( packageTrigger.captureMethod ) ?? 'Any match';
        trg.conditions = _.cloneDeep( packageTrigger.conditions ) ?? [];
        trg.classLevels = _.cloneDeep( packageTrigger.classLevels ) ?? [];
        trg.useCooldown = packageTrigger.useCooldown === true;
        trg.cooldownDuration = packageTrigger.cooldownDuration;
        trg.sequentialRestartBehavior = packageTrigger.sequentialRestartBehavior;

        return trg;
    }










    /**
     * Returns true if the details of the package trigger match the details of 
     * the installed trigger.
     * 
     * @param packageTrigger The package trigger.
     * @param trigger The trigger to check against.
     */
    public static matchesTrigger( packageTrigger: PackageTrigger, trigger: TriggerModel ): string[] {
        let changes: string[] = [];
        
        if ( packageTrigger.triggerId !== trigger.triggerId ) {
            return changes;
        }
        
        if ( packageTrigger.folderId !== trigger.folderId ) {
            changes.push( 'Folder' );
        }

        if ( packageTrigger.name !== trigger.name ) {
            changes.push( 'Name' );
        }

        if ( packageTrigger.useCooldown !== trigger.useCooldown ) {
            changes.push( 'Use Cooldown' );
        }

        if ( packageTrigger.cooldownDuration !== trigger.cooldownDuration ) {
            changes.push( 'Cooldown Duration' );
        }

        if ( packageTrigger.comments !== trigger.comments ) {
            changes.push( 'Comments' );
        }

        if ( packageTrigger.captureMethod !== trigger.captureMethod ) {
            changes.push( 'Capture Method' );
        }

        if ( !_.isEqual( packageTrigger.capturePhrases, trigger.capturePhrases ) ) {
            changes.push( 'Capture Phrase(es)' );
        }

        if ( !_.isEqual( packageTrigger.actions, trigger.actions ) ) {
            changes.push( 'Action(s)' );
        }

        if ( !_.isEqual( packageTrigger.conditions, trigger.conditions ) ) {
            changes.push( 'Condition(s)' );
        }

        if ( !_.isEqual( packageTrigger.classLevels, trigger.classLevels ) ) {
            changes.push( 'Class Info' );
        }
        
        
        return changes;
    }
}

export const TriggerPackageCategories: string[] = [ 'Raids', 'Spells', 'Community', 'Other' ];

export class TriggerPackageModel {
    public triggers: PackageTrigger[] = [];
    public folders: PackageFolder[] = [];
    public detrimentalOverlayId: string;
    public beneficialOverlayId: string;
    public textOverlayId: string;
    public packageOverlays: OverlayWindowModel[] = [];
    public primaryDisplaySize: Electron.Size;
}

export class TriggerPackageListModel {
    
    public triggerPackageId: string;
    public versionId: string;
    public timestamp: Date;
    public files: PackageFileModel[] = [];
    public author: string;
    public authorDiscord: string;
    public trustedAuthor: boolean = false;
    public name: string;
    public description: string;
    public category: string;
    public tags: string[] = [];

}

export class TriggerPackageMetaModel {
    
    public triggerPackageId: string;
    public versionId: string;
    public timestamp: Date;
    public model: TriggerPackageModel = new TriggerPackageModel();
    public files: PackageFileModel[] = [];
    public author: string;
    public authorDiscord: string;
    public trustedAuthor: boolean = false;
    public name: string;
    public versionHistory: VersionHistory[];
    public description: string;
    public category: string;
    public tags: string[] = [];

}

export class QuickShareFctModel {

    public fctGroups: FctCombatGroup[] = [];
    public overlays: OverlayWindowModel[] = [];
    public primaryDisplaySize: Electron.Size;

}

export class QuickShareModel {
    
    public triggers: PackageTrigger[] = [];
    public folders: PackageFolder[] = [];
    public detrimentalOverlayId: string;
    public beneficialOverlayId: string;
    public textOverlayId: string;
    public overlays: OverlayWindowModel[] = [];
    public primaryDisplaySize: Electron.Size;

}

export class QuickShareFctMetaModel {

    public quickShareId: string;
    public versionId: string;
    public timeStamp: Date;
    public model: QuickShareFctModel = new QuickShareFctModel();
    public author: string;
    public authorDiscord: string;
    public trustedAuthor: boolean = false;

}

export class QuickShareMetaModel {

    public quickShareId: string;
    public versionId: string;
    public timeStamp: Date;
    public model: QuickShareModel = new QuickShareModel();
    public author: string;
    public authorDiscord: string;
    public trustedAuthor: boolean = false;
    public stageNewTriggers: boolean = false;

}

export class QuickShareTransferModel {

    public model: any;
    public notes: string;
    public files: QuickShareFileModel[] = [];
    
}

export class QuickShareFctTransferModel {

    public model: any;
    public notes: string;
    
}

export class QuickShareVersion {
    
    public quickShareId: string;
    public versionId: string;
    public timestamp: Date;

}

export class OverlayBoundsChangedEventArgs {

    public overlayId: string;
    public bounds: Rectangle;
    public displayId: number;
    public displayBounds: Electron.Rectangle;

}

export class DialogEventArgs {
    
    public code: string;

}

export class LogFileLocation {

    public lineNo: number;
    public description: string;
    public raw: string;
    public timestamp: Date;
    public logFilePath: string;

}

export class IpcMessage<T> {

    public id: string;

    constructor( public value: T ) {
        this.id = nagId();
    }

}

export class DeathRecapPreferences {
    triggerId: string;
    engageMode: 'hotkey' | 'automatic';
    hotkeyPhrase: string;
}

export class VersionNumber {
    
    public major: number;
    public minor: number;
    public revision: number;

    constructor( private version: string ) {
        if ( version == null )
            throw new Error( 'Version number not provided!' );
        
        let parts = version.split( /\./gi );
        if ( parts?.length !== 3 ) {
            throw new Error( 'Invalid version number!' );
        }
        this.major = +parts[ 0 ];
        this.minor = +parts[ 1 ];
        this.revision = +parts[ 2 ];
    }

    /**
     * Returns -1 if a is less than b, 0 if a equals b, 1 if a is greater than b.
     * 
     * @param a Version number a.
     * @param b Version number b.
     */
    public static CompareVersions( a: VersionNumber, b: VersionNumber ): number {
        let aMj = a.major * 1000000;
        let bMj = b.major * 1000000;
        let aMn = a.minor * 1000;
        let bMn = b.minor * 1000;
        let aRv = a.revision;
        let bRv = b.revision;
        let aV = aMj + aMn + aRv;
        let bV = bMj + bMn + bRv;
        
        if ( aV < bV ) {
            return -1;
        } else if ( aV === bV ) {
            return 0;
        } else {
            return 1;
        }

    }
}

export class QuitFailureData {
    code: 'backup' | null;
}

export class Progress {
    
    public completePercent: number;
    public label: string;
    public isComplete: boolean = false;

}

export class SimulationProgress extends Progress {
    
    public lineIndex: number;
    public msRemaining: number;
    public simulationPaused: boolean = false;

}

export class Range {
    
    constructor( public start?: number, public end?: number ) {
        this.start = this.start === null || this.start === undefined ? 0 : this.start;
        this.end = this.end === null || this.end === undefined ? 0 : this.end;
    }
    public inclusive: boolean = true;

    public static toArray(value: Range): number[] {
        let n: number[] = [];

        for ( let i = value.start ?? 0; i <= value.end ?? 0; i++ ) {
            n.push( i );
        }

        return n;
    }
}

export class ScheduledTask {

    public label: string;

    public second: undefined | number | number[] | Range;
    public secondNth: undefined | number;

    public minute: undefined | number | number[] | Range;
    public minuteNth: undefined | number;

    public hour: undefined | number | number[] | Range;
    public hourNth: undefined | number;

    public dayOfMonth: undefined | number | number[] | Range;
    public dayOfMonthNth: undefined | number;

    public month: undefined | number | number[] | Range;
    public monthNth: undefined | number;

    public dayOfWeek: undefined | number | number[] | Range;
    public dayOfWeekNth: undefined | number;

}

export enum LogMaintenancePlanTypes {
    
    BySize = 0,
    BySchedule = 1,

}

export class LogMaintenanceRules {

    public enableLogFileMaintenance: boolean = false;
    public maintenancePlan: LogMaintenancePlanTypes = LogMaintenancePlanTypes.BySize;
    public includeAllWatched: boolean = true;
    public includeLogFiles: string[] = [];
    public excludeLogFiles: string[] = [];
    public logSchedule: ScheduledTask | null;
    public maxLogFileSizeMb: number = 50;

}

export class SharedTriggerPermissions {

    public disableSharedGlowEffects: boolean = false;
    public disableAllGlowEffects: boolean = false;

}

export class ConsoleMessageModel {

    public timestamp: Date;
    public label: string;
    public message: string;
    public logType: LogTypes = LogTypes.info;
    public logId: string;
    public payload: any;

}

export class TriggerParseHistoryModel extends ConsoleMessageModel {

    public parseId: string;
    public triggerId: string;
    public triggerName: string;
    public actionId: string;
    public actionTypeLabel: string;
    public phraseId: string;
    public renderedPhrase: string | string[];
    public unrenderedPhrase: string | string[];
    public conditionResults: Record<string, string[]>;
    public storedVariables: Record<string, string[]>;
    public counters: Record<string, {value: number, lastUpdate: Date, resetDelay: number}>;
    public regexResult: RegExpExecArray | undefined;
    public dependencyRegexResult: RegExpExecArray | undefined;
    public parseType: string;
    public deltaTime: number;
    public characterId: string;
    public characterName: string;
    public rawLogEntry: string;
    public error: any;
    public errorDescription: string;
    public duplicateCount: number = 0;

    public _modelHtml: string;

    public static sameError( a: TriggerParseHistoryModel, b: TriggerParseHistoryModel ): boolean {
        return a.logType === LogTypes.error &&
            b.logType === LogTypes.error &&
            a.triggerId === b.triggerId &&
            a.error === b.error &&
            a.errorDescription === b.errorDescription;
    }
    
}

// Flags for where the FCT hit should be displayed.
export enum HitStartPositionTypes {
    unset   = 0,
    left    = 1<<0,
    right   = 1<<1,
    bottom  = 1<<2,
    top     = 1<<3,
    random  = 1<<4,
}

export class CombatAnimations {

    public fountain: boolean = false;
    public scroll: boolean = false;

    public blowout: boolean = false;
    public fadeIn: boolean = false;
    public fadeOut: boolean = false;
    public grow: boolean = false;
    public shrink: boolean = false;

    public static getHashValue( animations: CombatAnimations ): string {
        let hash = '';

        hash += animations.fountain ? '1' : '0';
        hash += animations.scroll ? '1' : '0';
        hash += animations.blowout ? '1' : '0';
        hash += animations.fadeIn ? '1' : '0';
        hash += animations.fadeOut ? '1' : '0';
        hash += animations.grow ? '1' : '0';
        hash += animations.shrink ? '1' : '0';

        return hash;
    }

}

export class CombatTypes {
    
    public myHits: boolean = false;
    public otherHitsOnMe: boolean = false;
    public mySpellHits: boolean = false;
    public otherSpellHitsOnMe: boolean = false;
    public myHealing: boolean = false;
    public otherHealingOnMe: boolean = false;

    public static getHashValue( combatTypes: CombatTypes ): string {
        let hash = '';

        hash += combatTypes.myHits ? '1' : '0';
        hash += combatTypes.otherHitsOnMe ? '1' : '0';
        hash += combatTypes.mySpellHits ? '1' : '0';
        hash += combatTypes.otherSpellHitsOnMe ? '1' : '0';
        hash += combatTypes.myHealing ? '1' : '0';
        hash += combatTypes.otherHealingOnMe ? '1' : '0';

        return hash;
    }
}

export const CombatModifiers: string[] = [
    'unset',
    'normal',
    'critical',
    'crippling_blow',
    'flurry',
    'lucky',
    'twincast',
    'riposte',
    'strikethrough',
    'wild_rampage',
    'rampage',
    'assassinate',
    'headshot',
    'double_bow_shot',
    'deadly_strike',
    'finishing_blow',
];

export class FctCombatGroup {

    public combatGroupId: string;
    public name: string;
    public overlayId: string;
    public combatTypes: CombatTypes = new CombatTypes();
    public valueStyles: StylePropertiesModel = new StylePropertiesModel();
    public sourceStyles: StylePropertiesModel = new StylePropertiesModel();
    public startingPosition: HitStartPositionTypes = HitStartPositionTypes.unset;
    public accumulateHits: boolean = false;
    public ignoreHits: boolean = false;
    public thresholdType: 'percent' | 'value' | 'dynamic' = 'percent';
    public thresholdValue: number | undefined = undefined;
    public thresholdPercent: number = 60;
    public combatAnimations: CombatAnimations = new CombatAnimations();
    public combatModifiers: string[] = [];

    public displayValue: number = 255;
    public displayType: string = 'hit';
    public displayBackground: 'light' | 'dark' = 'dark';
    public editStylesType: 'value' | 'source' | 'animations' = 'value';

    public _animationCompletePercent: number = 0;
    public _animationComplete: boolean = true;
    public _animationIntervalId: number | undefined = undefined;
    public _animationResetTimeoutId: number | undefined = undefined;
    public _editorTabIndex: number = -1;
    public get editorTabIndex(): number {
        this._editorTabIndex = this._editorTabIndex > -1 ? this._editorTabIndex : this.overlayId?.length > 0 ? 0 : 1;
        return this._editorTabIndex;
    }

    public static getHashValue( group: FctCombatGroup ): string {
        let hash = '';

        hash += group.name;
        hash += group.overlayId;
        
        hash += CombatTypes.getHashValue( group.combatTypes );
        hash += StylePropertiesModel.getHashValue( group.valueStyles );
        hash += StylePropertiesModel.getHashValue( group.sourceStyles );

        hash += group.startingPosition;
        hash += group.accumulateHits ? '1' : '0';
        hash += group.ignoreHits ? '1' : '0';
        hash += group.thresholdType;
        hash += group.thresholdValue;
        hash += group.thresholdPercent;

        hash += CombatAnimations.getHashValue( group.combatAnimations );

        hash += group.combatModifiers.join( '' );

        return hash;
    }










    /**
     * Hydrates the model with the given data.
     * 
     * @returns Returns a new object of FctCombatGroup.
     * 
     * @param data The data to hydrate the model with.
     */
    public static hydrateModel( data: any ): FctCombatGroup {
        let m = Object.assign( new FctCombatGroup(), data );

        m.combatTypes = Object.assign( new CombatTypes(), data.combatTypes );
        m.valueStyles = Object.assign( new StylePropertiesModel(), data.valueStyles );
        m.sourceStyles = Object.assign( new StylePropertiesModel(), data.sourceStyles );
        m.combatAnimations = Object.assign( new CombatAnimations(), data.combatAnimations );
        
        m._animationCompletePercent = 0;
        m._animationComplete = true;
        m._animationIntervalId = undefined;
        m._animationResetTimeoutId = undefined;

        return m;
    }
}
