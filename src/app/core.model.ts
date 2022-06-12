import { StringProtocolResponse } from 'electron';
import { Color } from './utilities';
import * as _ from 'lodash-es';

export const ErrorCodes = {
    EqFolderNotFound: {
        code: 'EQDIRNULL',
        message: 'Could not locate your EverQuest folder.',
    }
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

export enum ImportTypes {
    None = 0,
    DotTimer = 1,
    Ability = 2,
    Npc = 3,
    Buff = 4,
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

export class TriggerCondition {
    
    public conditionId: string = null;
    public conditionType: TriggerConditionTypes = TriggerConditionTypes.VariableValue;
    public operatorType: OperatorTypes;
    public variableName: string;
    public variableValue: string;

}

export class Phrase {
    public phraseId: string;
    public phrase: string;
    public useRegEx: boolean;
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
    public overlayType: string = '';
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
    public phoneticTransforms: Record<string, string> = {};
    public ignoredGinaObjects: string[] = [];
    public folders: TriggerFolder[] = [];
    public fctStyles: FctStylesModel;
    public enableQuickShareImports: boolean = true;
    
}

export class TriggerAction {

    public actionId: string;
    public actionType: ActionTypes;
    public phrases: string[] = [];
    public overlayId: string;
    public name: string;
    public displayText: string;
    public duration: number;
    public storageDuration: string;
    public showRemainingDuration: boolean = false;
    public repeatTimer: boolean = false;
    public repeatCount: number = null;
    public variableName: string;
    public storeLiteralDefinition: string;
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
    public hideTimer: boolean = false;
    public hideConditions: TriggerCondition[] = [];
    public castTime: number = null;
    public onlyUseAaBeneficialFocus: boolean = false;
    public skipBenCastingTimeFocus: boolean = false;
    public variableStorageType: string = 'localVariable';

    public ifEndingSoon: boolean = false;
    public endingSoonShowTimer: boolean = false;
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
    public endingSoonInterruptSpeech: boolean = false;

    public endingClipboard: boolean = false;
    public endingClipboardText: string = null;

    public endingPlayAudio: boolean = false;
    public endingPlayAudioFileId: string = null;

    public remainAfterEnded: boolean = false;
    public notifyWhenEnded: boolean = false;
    public remainDuration: number = null;
    public remainUnlessEndedEarly: boolean = false;
    
    public endedDisplayText: boolean = false;
    public endedTextOverlayId: string = null;
    public endedText: string = null;
    public endedTextDuration: number = null;
    
    public endedClipboard: boolean = false;
    public endedClipboardText: string = null;

    public endedSpeak: boolean = false;
    public endedSpeakPhrase: string = null;
    public endedInterruptSpeech: boolean = false;

    public endedPlayAudio: boolean = false;
    public endedPlayAudioFileId: string = null;

    public endedChangeColor: boolean = false;
    public endedColor: string = null;
    public endedBackgroundColor: string = null;
    
    public excludeTargets: Phrase[] = [];
    public endEarlyPhrases: Phrase[] = [];
    public resetCounterPhrases: Phrase[] = [];

    public audioFileId: string;

    public textUseCustomFont: boolean = false;
    public textFont: string;
    public textWeight: number;

    public textUseCustomSize: boolean = false;
    public textSize: number;
    public textSpacing: number;

    public textUseCustomColor: boolean = false;
    public textColor: string;

    public textUseCustomBorder: boolean = false;
    public textBorderColor: string;
    public textBorderIntensity: number;
    
    public textUseCustomGlow: boolean = false;
    public textGlowColor: string;
    public textGlowIntensity: number;
    public textGlowSize: number;
}

export class OutsideResource {

    public get allakhazam(): boolean {
        return this.url.match( /^(http|https):\/\/.*\.allakhazam\.com.*/gi )?.length > 0;
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
    public gemIndex: number;
    public gemSrc: string;
    public targetType: string;
    /** The cast time, in milliseconds. */
    public castTime: number;
    public effectFades: string;
    public itemsWithEffect: OutsideResource[] = [];
    
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
    public beneficialCastingSpeedFocusDecayLevel: number;
    
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

}

export class TriggerPackageModel {
    public triggers: PackageTrigger[] = [];
    public folders: PackageFolder[] = [];
    public detrimentalOverlayId: string;
    public beneficialOverlayId: string;
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

}

export class QuickShareModel {
    
    public triggers: PackageTrigger[] = [];
    public folders: PackageFolder[] = [];
    public detrimentalOverlayId: string;
    public beneficialOverlayId: string;

}

export class QuickShareMetaModel {

    public quickShareId: string;
    public versionId: string;
    public timeStamp: Date;
    public model: QuickShareModel = new QuickShareModel();
    public author: string;
    public authorDiscord: string;
    public trustedAuthor: boolean = false;
    // public files: QuickShareFileModel[] = [];

}

export class QuickShareTransferModel {

    public model: any;
    public notes: string;
    public files: QuickShareFileModel[] = [];
    
}

export class QuickShareVersion {
    
    public quickShareId: string;
    public versionId: string;
    public timestamp: Date;

}

export class OverlayBoundsChangedEventArgs {

    public overlayId: string;
    public bounds: Rectangle;

}

export class DialogEventArgs {
    
    public code: string;

}
