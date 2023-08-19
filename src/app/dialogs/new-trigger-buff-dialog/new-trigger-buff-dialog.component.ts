import { Component, Inject, OnInit, ViewChild } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatStepper } from '@angular/material/stepper';
import { ActionTypes, CapturePhrase, ExternalDataSources, ImportTypes, OperatorTypes, OverlayWindowModel, Phrase, ScrapedClickEffect, ScrapedSpell, TimerRestartBehaviors, TriggerAction, TriggerCondition, TriggerConditionTypes, TriggerModel } from 'src/app/core.model';
import { IpcService } from 'src/app/ipc.service';
import { ScraperService } from 'src/app/scraper.service';
import { NewTriggerDialogModel } from '../dialog.model';
import { customAlphabet } from 'nanoid';
import { SelectIconDialogComponent } from '../select-icon-dialog/select-icon-dialog.component';
import { ColorUtility } from 'src/app/utilities';
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const nanoid = customAlphabet( alphabet, 16 );
import * as _ from 'lodash-es';
import { forkJoin, Observable } from 'rxjs';

// TODO: When adding a buff from an item click, if the user selects multiple items then they will may be getting multiple timers.

@Component( {
    selector: 'app-new-trigger-buff-dialog',
    templateUrl: 'new-trigger-buff-dialog.component.html',
    styleUrls: [ 'new-trigger-buff-dialog.component.scss', '../dialog.styles.scss', '../../modal.scss', '../../core.scss' ],
} )
export class NewTriggerBuffDialogComponent implements OnInit {
    
    public url: string;
    public overlays: OverlayWindowModel[] = [];
    public cancelTimerIfTargetDies: boolean = false;
    public useSelfTimer: boolean = false;
    public useTargetTimer: boolean = false;
    public alertWhenBuffFades: boolean = false;
    public alertWhenBuffOverwritten: boolean = false;
    public alertEndingSoon: boolean = false;
    public showTimerWhenEndingSoon: boolean = false;
    public timerOverlayId: string;
    public endingSoonDuration: number = null;
    public readyForImport: boolean = false;
    public selectedItems: ScrapedClickEffect[] = [];
    public loadingItemDetails: boolean = false;
    public trackType: 'mine' | 'others' = 'mine';
    public lockTrackType: boolean = false;
    public hideTimer: boolean = true;

    public get serviceName(): string {
        return this.data.dataSource === ExternalDataSources.Allakhazam ? 'Allakhazam' : 'EQ Spell Resources';
    }

    public get cannotTrack(): boolean {
        return this.trackType === 'others' && this.spell != null && this.spell.castOnYou == null;
    }

    public get timerOverlays(): OverlayWindowModel[] {
        return this.overlays.filter( f => f.overlayType === 'Timer' );
    }
    
    @ViewChild( 'stepper', { static: false, read: MatStepper } ) public stepper: MatStepper;

    public spell: ScrapedSpell;
    
    constructor(
        public readonly dialogRef: MatDialogRef<NewTriggerBuffDialogComponent>,
        @Inject( MAT_DIALOG_DATA ) public readonly data: NewTriggerDialogModel,
        public readonly scraper: ScraperService,
        public readonly ipcService: IpcService,
        public readonly dialog: MatDialog ) { }

    ngOnInit() {

        if ( this.data?.trigger?.triggerId != null ) {
            this.url = this.data.trigger.allakhazamUrl;
            let timerAction: TriggerAction = _.find( this.data.trigger.actions, ( action: TriggerAction ) => action.actionType === ActionTypes.BeneficialTimer || action.actionType === ActionTypes.Countdown );
            if ( timerAction ) {
                this.timerOverlayId = timerAction.overlayId;
            }
            this.lockTrackType = true;
            if ( this.data.trigger.importType === ImportTypes.OthersBuff ) {
                this.trackType = 'others';
            } else {
                this.trackType = 'mine';
            }
        }

        this.ipcService.getOverlayWindows().subscribe( overlays => this.overlays = overlays );
    }









    
    /**
     * Scrapes the entered URL for spell data.
     */
    public scrape(): void {

        let complete = ( spell: ScrapedSpell ) => {
            this.spell = spell;

            this.endingSoonDuration = this.spell.duration <= 120 ? 12 :
                this.spell.duration > 120 && this.spell.duration <= 600 ? 60 :
                    this.spell.duration > 600 && this.spell.duration < 900 ? 120 :
                        600;

            this.stepper.next();
        }

        if ( this.data.dataSource === ExternalDataSources.Allakhazam ) {

            this.scraper.ScrapeAllakhazamSpell( this.url ).subscribe( spell => complete( spell ) );

        } else if ( this.data.dataSource === ExternalDataSources.EqSpellResources ) {

            this.ipcService.scrapeEqSpellResourceSpell( this.url ).subscribe( spell => complete( spell ) );

        }
        
    }









    
    /**
     * Scrapes item click information from each selected item with this spell 
     * as a click effect.
     */
    public processSelectedItemClickies() {
        this.loadingItemDetails = true;

        let observables: Observable<ScrapedClickEffect>[] = [];
        
        this.spell.itemsWithEffect.forEach( item => {
            if ( item.selected ) {

                if ( this.data.dataSource === ExternalDataSources.Allakhazam ) {
                    observables.push( this.scraper.ScrapeAllakhazamItemClickInfo( item.url ) );
                } else if ( this.data.dataSource === ExternalDataSources.EqSpellResources ) {
                    observables.push( this.ipcService.scrapeEqSpellResourceItemClickInfo( item.url ) );
                }
                
            }
        } );

        if ( observables.length > 0 ) {
            forkJoin( observables ).subscribe( items => {
                this.selectedItems = items;
                this.loadingItemDetails = false;
                this.stepper.next();
            } );
        } else {
            this.stepper.next();
        }
    }










    /**
     * Uses the parsed data to create the trigger for others casting on self.
     */
    public importOthers(): void {

        let trigger: TriggerModel;

        if ( this.data?.trigger?.triggerId != null ) {
            trigger = this.data.trigger;
        } else {
            trigger = new TriggerModel();
            trigger.comments = `Buff timer ${this.spell.name} for others casting on self.`;
            trigger.folderId = this.data?.selectedFolderId;
        }

        trigger.name = `${this.spell.name} from Others`;
        trigger.classLevels = [];
        trigger.allakhazamUrl = this.url;
        trigger.externalSource = this.data.dataSource;
        trigger.importType = ImportTypes.OthersBuff;
        
        trigger.actions = [];
        trigger.capturePhrases = [];
        trigger.conditions = [];

        trigger.conditions.push( <TriggerCondition>{
            conditionId: nanoid(),
            conditionType: TriggerConditionTypes.VariableValue,
            variableName: 'SpellBeingCast',
            operatorType: OperatorTypes.DoesNotEqual,
            // Gorgon Skin|Gorgon Skin Rk. II|Gorgon Skin Rk. III
            variableValue: `${this.spell.name}|${this.spell.name} Rk\. II|${this.spell.name} Rk\. III`,
        } );

        let castOnYouPhraseId: string = null;
        let iconTimerIds: string[] = [];
        
        trigger.captureMethod = 'Any match';

        if ( this.spell.castOnYou?.length > 0 ) {
            castOnYouPhraseId = nanoid();
            trigger.capturePhrases.push( <CapturePhrase>{
                phraseId: castOnYouPhraseId,
                useRegEx: true,
                requirePreviousPhrase: false,
                duration: null,
                // /^(?<target>You) feel armored\.$/
                // /^(?<target>You)r balls feel armored\.$/
                phrase: '^' + this.spell.castOnYou.replace( /\.$/, '\\.$' ).replace( /you/mi, '(?<target>You)' ),
            } );
        }
        
        let buffTimers: TriggerAction[] = [];

        if ( !this.spell.itemClickOnly ) {
            buffTimers.push( <TriggerAction>{
                phrases: [ castOnYouPhraseId ],
                actionType: ActionTypes.Countdown,
                overlayId: this.timerOverlayId,
                duration: this.spell.duration,
                actionId: nanoid(),
                restartBehavior: TimerRestartBehaviors.RestartOnDuplicate,
                displayText: this.spell.name,
                useCustomColor: true,
                overrideTimerColor: '#0288d1',
                timerBackgroundColor: ColorUtility.FromHex( '#0288d1' ).darken( 0.93 ).toString( 0.75 ),
                endEarlyPhrases: [],
                hideTimer: this.hideTimer,
                hideConditions: [],
                castTime: this.spell.castTime,
            } );
        }
        
        this.selectedItems.forEach( item => {
            
            item.classes.forEach( chrClass => {
                let i = trigger.classLevels.findIndex( f => f.class === chrClass.class );
                if ( i == -1 ) {
                    trigger.classLevels.push( chrClass );
                }
            } );

            buffTimers.push( <TriggerAction>{
                phrases: [ castOnYouPhraseId ],
                actionType: ActionTypes.Countdown,
                overlayId: this.timerOverlayId,
                duration: this.spell.duration,
                actionId: nanoid(),
                restartBehavior: TimerRestartBehaviors.RestartOnDuplicate,
                displayText: `${this.spell.name}`,
                useCustomColor: true,
                overrideTimerColor: '#0288d1',
                timerBackgroundColor: ColorUtility.FromHex( '#0288d1' ).darken( 0.93 ).toString( 0.75 ),
                endEarlyPhrases: [],
                hideTimer: this.hideTimer,
                hideConditions: [],
                castTime: item.castTime,
                onlyUseAaBeneficialFocus: true,
                skipBenCastingTimeFocus: true,
            } );
        } );

        buffTimers.forEach( timer => trigger.actions.push( timer ) );
        buffTimers.forEach( timer => iconTimerIds.push( timer.actionId ) );

        if ( this.cancelTimerIfTargetDies ) {
                
            buffTimers.forEach( timer => timer.endEarlyPhrases.push( <Phrase>{
                phraseId: nanoid(),
                // You have been slain by a lightning warrior staticfist!
                phrase: '^You have been slain by [^!]*!$',
                useRegEx: true,
            } ) );
            buffTimers.forEach( timer => timer.endEarlyPhrases.push( <Phrase>{
                phraseId: nanoid(),
                // You have been slain by a lightning warrior staticfist!
                phrase: '^You died\\.$',
                useRegEx: true,
            } ) );

        }

        if ( this.spell.effectFades ) {
            // End when the buff ends early.
            buffTimers.forEach( timer => timer.endEarlyPhrases.push( <Phrase>{
                phraseId: nanoid(),
                phrase: '^' + this.spell.effectFades.replace( /\.$/, '\\.$' ),
                useRegEx: true,
            } ) );
        }

        if ( this.alertWhenBuffFades ) {

            // Using the timer method until I come up with a way to allow the simple capture of the faded msg to work alongside the condition that the spell is currently being cast.
            buffTimers.forEach( timer => timer.notifyWhenEnded = true );
            buffTimers.forEach( timer => timer.endedSpeak = true );
            buffTimers.forEach( timer => timer.endedSpeakPhrase = `Your ${this.spell.name} buff has ended.` );
            
        }

        if ( this.alertEndingSoon ) {
            buffTimers.forEach( timer => timer.ifEndingSoon = true );
            buffTimers.forEach( timer => timer.endingDuration = this.endingSoonDuration );
            buffTimers.forEach( timer => timer.endingSoonSpeak = true );
            buffTimers.forEach( timer => timer.endingSoonSpeakPhrase = `Your ${this.spell.name} buff is ending soon.` );
            buffTimers.forEach( timer => timer.endingSoonShowTimer = this.showTimerWhenEndingSoon );
        }

        if ( this.spell.gemIndex > -1 ) {
                
            this.dialog.open( SelectIconDialogComponent, {
                width: '750px',
                data: {
                    iconIndex: this.spell.gemIndex,
                }
            } ).afterClosed().subscribe( icon => {
                
                if ( iconTimerIds?.length > 0 ) {
                    trigger.actions?.forEach( f => {
                        if ( iconTimerIds.indexOf( f.actionId ) > -1 ) {
                            f.timerIcon = icon;
                        }
                    } );
                }

                if ( trigger.triggerId != null ) {
                    this.ipcService.updateTrigger( trigger ).subscribe( updated => { } );
                } else {
                    this.ipcService.createNewTrigger( trigger ).subscribe( triggerId => { trigger.triggerId = triggerId; } );
                }

                this.dialogRef.close();
            } );

        } else {

            if ( trigger.triggerId != null ) {
                this.ipcService.updateTrigger( trigger ).subscribe( updated => { } );
            } else {
                this.ipcService.createNewTrigger( trigger ).subscribe( triggerId => { trigger.triggerId = triggerId; } );
            }
            
            this.dialogRef.close();
        }
    }










    /**
     * Uses the parsed data to create the trigger for tracking mine.
     */
    public import(): void {

        let trigger: TriggerModel;

        if ( this.data?.trigger?.triggerId != null ) {
            trigger = this.data.trigger;
        } else {
            trigger = new TriggerModel();
            trigger.comments = `Buff timer ${this.spell.name}.`;
            trigger.folderId = this.data?.selectedFolderId;
        }

        trigger.name = this.spell.name;
        trigger.classLevels = this.spell.classes;
        trigger.allakhazamUrl = this.url;
        trigger.externalSource = this.data.dataSource;
        trigger.importType = ImportTypes.Buff;
        
        trigger.actions = [];
        trigger.capturePhrases = [];
        trigger.conditions = [];

        let glyphType = this.spell.castTime == 0 && !this.spell.castOnYou;

        if ( !glyphType ) {
            trigger.conditions.push( <TriggerCondition>{
                conditionId: nanoid(),
                conditionType: TriggerConditionTypes.VariableValue,
                variableName: 'SpellBeingCast',
                operatorType: OperatorTypes.Equals,
                // Gorgon Skin|Gorgon Skin Rk. II|Gorgon Skin Rk. III
                variableValue: `${this.spell.name}|${this.spell.name} Rk\. II|${this.spell.name} Rk\. III`,
            } );
        }

        let castOnYouPhraseId: string = null;
        let castOnOtherPhraseId: string = null;
        let buffTimerPhrases: string[] = [];
        let iconTimerIds: string[] = [];
        
        trigger.captureMethod = 'Any match';

        if ( this.useSelfTimer && !glyphType ) {
            let rawPhrase = this.spell.castOnYou ? this.spell.castOnYou : this.spell.youCast;
            if ( rawPhrase?.length > 0 ) {
                castOnYouPhraseId = nanoid();
                trigger.capturePhrases.push( <CapturePhrase>{
                    phraseId: castOnYouPhraseId,
                    useRegEx: true,
                    requirePreviousPhrase: false,
                    duration: null,
                    // /^(?<target>You) feel armored\.$/
                    // /^(?<target>You)r balls feel armored\.$/
                    phrase: '^' + rawPhrase.replace( /\.$/, '\\.$' ).replace( /you/mi, '(?<target>You)' ),
                } );
                buffTimerPhrases.push( castOnYouPhraseId );
            }
        } else if ( this.useSelfTimer && glyphType ) {
            let glyphPhrase = `^(?<target>You) begin casting ${this.spell.name}\\.`;
            castOnYouPhraseId = nanoid();
            trigger.capturePhrases.push( <CapturePhrase>{
                phraseId: castOnYouPhraseId,
                useRegEx: true,
                requirePreviousPhrase: false,
                duration: null,
                // /^(?<target>You) feel armored\.$/
                // /^(?<target>You)r balls feel armored\.$/
                phrase: glyphPhrase,
            } );
            buffTimerPhrases.push( castOnYouPhraseId );
        }
        
        if ( this.useTargetTimer ) {
            const captureReplaceRegex = this.data.dataSource === ExternalDataSources.Allakhazam ? /soandso's|soandso\s's|soandso/gmi : /target's|target\s's|target/gmi;
            castOnOtherPhraseId = nanoid();
            trigger.capturePhrases.push( <CapturePhrase>{
                phraseId: castOnOtherPhraseId,
                useRegEx: true,
                requirePreviousPhrase: false,
                duration: null,
                // /^(?<target>.+?)\b\s{0,1}'{0,1}s{0,1}\b is covered in necrotic sores\.$/
                phrase: this.spell.castOnOther.replace( /\.$/, '\\.$' ).replace( captureReplaceRegex, '^(?!Your\\s)(?<target>.+?)\\b\\s{0,1}\'{0,1}s{0,1}\\b' ),
            } );
            buffTimerPhrases.push( castOnOtherPhraseId );
        }
        
        let hideTimer = !this.useSelfTimer || ( this.spell?.targetType !== 'Self' && !this.useTargetTimer );
        let buffTimers: TriggerAction[] = [];

        if ( !this.spell.itemClickOnly ) {
            buffTimers.push( <TriggerAction>{
                phrases: [].concat( buffTimerPhrases ),
                actionType: ActionTypes.BeneficialTimer,
                overlayId: this.timerOverlayId,
                duration: this.spell.duration,
                actionId: nanoid(),
                restartBehavior: TimerRestartBehaviors.RestartOnDuplicate,
                displayText: this.spell.name,
                useCustomColor: true,
                overrideTimerColor: '#0288d1',
                timerBackgroundColor: ColorUtility.FromHex( '#0288d1' ).darken( 0.93 ).toString( 0.75 ),
                endEarlyPhrases: [],
                hideTimer: hideTimer,
                hideConditions: [],
                castTime: this.spell.castTime,
            } );
        }
        
        this.selectedItems.forEach( item => {
            
            item.classes.forEach( chrClass => {
                let i = trigger.classLevels.findIndex( f => f.class === chrClass.class );
                if ( i == -1 ) {
                    trigger.classLevels.push( chrClass );
                }
            } );

            buffTimers.push( <TriggerAction>{
                phrases: [].concat( buffTimerPhrases ),
                actionType: ActionTypes.BeneficialTimer,
                overlayId: this.timerOverlayId,
                duration: this.spell.duration,
                actionId: nanoid(),
                restartBehavior: TimerRestartBehaviors.RestartOnDuplicate,
                displayText: `${this.spell.name}`,
                useCustomColor: true,
                overrideTimerColor: '#0288d1',
                timerBackgroundColor: ColorUtility.FromHex( '#0288d1' ).darken( 0.93 ).toString( 0.75 ),
                endEarlyPhrases: [],
                hideTimer: hideTimer,
                hideConditions: [],
                castTime: item.castTime,
                onlyUseAaBeneficialFocus: true,
                skipBenCastingTimeFocus: true,
            } );
        } );

        // Add hide timer conditions.  I'm being overly verbose here so that it 
        // works when adding other options that may hide/show the timer in the 
        // future.
        if ( hideTimer && this.useSelfTimer && ( this.spell?.targetType !== 'Self' && !this.useTargetTimer ) ) {
            // Hide the timer when the target !== 'You'
            buffTimers.forEach( timer => timer.hideConditions.push( <TriggerCondition>{
                conditionId: nanoid(),
                conditionType: TriggerConditionTypes.NamedGroupValue,
                operatorType: OperatorTypes.DoesNotEqual,
                variableName: 'target',
                variableValue: 'You',
            } ) );
        } else if ( hideTimer && this.useTargetTimer && ( !this.useSelfTimer && this.spell?.targetType === 'Self' ) ) {
            // Hide the timer when the target === 'You'
            buffTimers.forEach( timer => timer.hideConditions.push( <TriggerCondition>{
                conditionId: nanoid(),
                conditionType: TriggerConditionTypes.NamedGroupValue,
                operatorType: OperatorTypes.Equals,
                variableName: 'target',
                variableValue: 'You',
            } ) );
        }

        buffTimers.forEach( timer => trigger.actions.push( timer ) );
        buffTimers.forEach( timer => iconTimerIds.push( timer.actionId ) );

        trigger.actions.push( <TriggerAction>{
            phrases: [ castOnYouPhraseId ],
            actionType: ActionTypes.ClearVariable,
            variableName: 'SpellBeingCast',
            actionId: nanoid(),
        } );

        if ( this.useSelfTimer && this.cancelTimerIfTargetDies ) {
                
            buffTimers.forEach( timer => timer.endEarlyPhrases.push( <Phrase>{
                phraseId: nanoid(),
                // You have been slain by a lightning warrior staticfist!
                phrase: '^You have been slain by [^!]*!$',
                useRegEx: true,
            } ) );
            buffTimers.forEach( timer => timer.endEarlyPhrases.push( <Phrase>{
                phraseId: nanoid(),
                // You have been slain by a lightning warrior staticfist!
                phrase: '^You died\\.$',
                useRegEx: true,
            } ) );

        }

        if ( this.useTargetTimer && this.cancelTimerIfTargetDies ) {
            
            buffTimers.forEach( timer => timer.endEarlyPhrases.push( <Phrase>{
                phraseId: nanoid(),
                phrase: '^${target} has been slain by [^!]*!$',
                useRegEx: true,
            } ) );
            buffTimers.forEach( timer => timer.endEarlyPhrases.push( <Phrase>{
                phraseId: nanoid(),
                phrase: '^You have slain ${target}!$',
                useRegEx: true,
            } ) );
            // This is apparently just for players
            buffTimers.forEach( timer => timer.endEarlyPhrases.push( <Phrase>{
                phraseId: nanoid(),
                // Jhinx dies.
                phrase: '^${target} dies\\.$',
                useRegEx: true,
            } ) );
            buffTimers.forEach( timer => timer.endEarlyPhrases.push( <Phrase>{
                phraseId: nanoid(),
                // A Valorian Guardian died.
                phrase: '^${target} died\\.$',
                useRegEx: true,
            } ) );

        }

        if ( this.spell.effectFades ) {
            // End when the buff ends early.
            buffTimers.forEach( timer => timer.endEarlyPhrases.push( <Phrase>{
                phraseId: nanoid(),
                phrase: '^' + this.spell.effectFades.replace( /\.$/, '\\.$' ),
                useRegEx: true,
            } ) );
        }

        if ( this.spell.targetType !== 'Self' ) {
            // End when the buff is overwritten.
            buffTimers.forEach( timer => timer.endEarlyPhrases.push( <Phrase>{
                phraseId: nanoid(),
                // Your Dead Men Floating spell on Xeraphine has been overwritten.
                phrase: `^Your ${this.spell.name}(?: Rk\. II| Rk\. III){0,1} spell on \${target} has been overwritten\\.$`,
                useRegEx: true,
            } ) );

            // End when the buff fades
            buffTimers.forEach( timer => timer.endEarlyPhrases.push( <Phrase>{
                phraseId: nanoid(),
                // Your Dead Men Floating spell has worn off of Rodus.
                phrase: `Your ${this.spell.name}(?: Rk\. II| Rk\. III){0,1} spell has worn off of \${target}\\.$`,
                useRegEx: true,
            } ) );
        }

        if ( this.spell.targetType === 'Pet' || this.spell.targetType === 'Undead' ) {

            // End when the buff fades
            buffTimers.forEach( timer => timer.endEarlyPhrases.push( <Phrase>{
                phraseId: nanoid(),
                // Your pet's Sigil of Decay spell has worn off.
                phrase: `Your pet's ${this.spell.name}(?: Rk\. II| Rk\. III){0,1} spell has worn off\\.$`,
                useRegEx: true,
            } ) );

        }

        if ( this.alertWhenBuffFades ) {

            // Using the timer method until I come up with a way to allow the simple capture of the faded msg to work alongside the condition that the spell is currently being cast.
            buffTimers.forEach( timer => timer.notifyWhenEnded = true );
            buffTimers.forEach( timer => timer.endedSpeak = true );
            buffTimers.forEach( timer => timer.endedSpeakPhrase = `Your ${this.spell.name} on \${target} has ended.` );
            
        }

        if ( this.alertEndingSoon ) {
            buffTimers.forEach( timer => timer.ifEndingSoon = true );
            buffTimers.forEach( timer => timer.endingDuration = this.endingSoonDuration );
            buffTimers.forEach( timer => timer.endingSoonSpeak = true );
            buffTimers.forEach( timer => timer.endingSoonSpeakPhrase = `Your ${this.spell.name} on \${target} is ending soon.` );
            buffTimers.forEach( timer => timer.endingSoonShowTimer = this.showTimerWhenEndingSoon );
        }

        // Leaving this here to enable it when the alert when ended is decoupled from the timer.
        // if ( this.showTimerWhenEndingSoon || this.useSelfTimer || this.useTargetTimer || this.alertEndingSoon ) {
        //     trigger.actions.push( buffTimer );
        // }

        if ( this.spell.gemIndex > -1 ) {
                
            this.dialog.open( SelectIconDialogComponent, {
                width: '750px',
                data: {
                    iconIndex: this.spell.gemIndex,
                }
            } ).afterClosed().subscribe( icon => {
                
                if ( iconTimerIds?.length > 0 ) {
                    trigger.actions?.forEach( f => {
                        if ( iconTimerIds.indexOf( f.actionId ) > -1 ) {
                            f.timerIcon = icon;
                        }
                    } );
                }

                if ( trigger.triggerId != null ) {
                    this.ipcService.updateTrigger( trigger ).subscribe( updated => { } );
                } else {
                    this.ipcService.createNewTrigger( trigger ).subscribe( triggerId => { trigger.triggerId = triggerId; } );
                }

                this.dialogRef.close();
            } );

        } else {

            if ( trigger.triggerId != null ) {
                this.ipcService.updateTrigger( trigger ).subscribe( updated => { } );
            } else {
                this.ipcService.createNewTrigger( trigger ).subscribe( triggerId => { trigger.triggerId = triggerId; } );
            }
            
            this.dialogRef.close();
        }
    }

}
