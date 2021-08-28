import { Component, Inject, OnInit, ViewChild } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatHorizontalStepper } from '@angular/material/stepper';
import { ActionTypes, CapturePhrase, ImportTypes, OperatorTypes, OverlayWindowModel, Phrase, ScrapedSpell, TimerRestartBehaviors, TriggerAction, TriggerCondition, TriggerConditionTypes, TriggerModel } from 'src/app/core.model';
import { IpcService } from 'src/app/ipc.service';
import { ScraperService } from 'src/app/scraper.service';
import { NewTriggerDialogModel } from '../dialog.model';
import { customAlphabet } from 'nanoid';
import { SelectIconDialogComponent } from '../select-icon-dialog/select-icon-dialog.component';
import { ColorUtility } from 'src/app/utilities';
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const nanoid = customAlphabet( alphabet, 16 );
import * as _ from 'lodash-es';

@Component( {
    selector: 'app-new-trigger-buff-dialog',
    templateUrl: 'new-trigger-buff-dialog.component.html',
    styleUrls: [ 'new-trigger-buff-dialog.component.scss', '../../modal.scss', '../../core.scss' ],
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
    
    public get timerOverlays(): OverlayWindowModel[] {
        return this.overlays.filter( f => f.overlayType === 'Timer' );
    }
    
    @ViewChild( 'stepper', { static: false, read: MatHorizontalStepper } ) public stepper: MatHorizontalStepper;

    public spell: ScrapedSpell;
    
    constructor(
        public dialogRef: MatDialogRef<NewTriggerBuffDialogComponent>,
        @Inject( MAT_DIALOG_DATA ) public data: NewTriggerDialogModel,
        public scraper: ScraperService,
        public ipcService: IpcService,
        public dialog: MatDialog ) { }

    ngOnInit() {

        if ( this.data?.trigger?.triggerId != null ) {
            this.url = this.data.trigger.allakhazamUrl;
            let dotAction: TriggerAction = _.find( this.data.trigger.actions, ( action: TriggerAction ) => action.actionType === ActionTypes.BeneficialTimer );
            if ( dotAction ) {
                this.timerOverlayId = dotAction.overlayId;
            }
        }

        this.ipcService.getOverlayWindows().subscribe( overlays => this.overlays = overlays );
    }

    public scrape(): void {
        this.scraper.ScrapeAllakhazamSpell( this.url ).subscribe( spell => {
            console.log( 'spell', spell );
            this.spell = spell;

            this.endingSoonDuration = this.spell.duration <= 120 ? 12 :
                this.spell.duration > 120 && this.spell.duration <= 600 ? 60 :
                    this.spell.duration > 600 && this.spell.duration < 900 ? 120 :
                        600;

            this.stepper.next();
        } );
    }

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
        trigger.importType = ImportTypes.Buff;
        
        trigger.actions = [];
        trigger.capturePhrases = [];
        trigger.conditions = [];

        trigger.conditions.push( <TriggerCondition>{
            conditionId: nanoid(),
            conditionType: TriggerConditionTypes.VariableValue,
            variableName: 'SpellBeingCast',
            operatorType: OperatorTypes.Equals,
            // Gorgon Skin|Gorgon Skin Rk. II|Gorgon Skin Rk. III
            variableValue: `${this.spell.name}|${this.spell.name} Rk\. II|${this.spell.name} Rk\. III`,
        } );


        let castOnYouPhraseId: string = null;
        let castOnOtherPhraseId: string = null;
        let buffTimerPhrases: string[] = [];
        let iconTimerIds: string[] = [];
        // if ( this.spell.targetType === 'Self' ) {
        trigger.captureMethod = 'Any match';

        if ( this.useSelfTimer ) {
            castOnYouPhraseId = nanoid();
            trigger.capturePhrases.push( <CapturePhrase>{
                phraseId: castOnYouPhraseId,
                useRegEx: true,
                requirePreviousPhrase: false,
                duration: null,
                // /^(?<target>You) feel armored\.$/
                // /^(?<target>You)r balls feel armored\.$/
                phrase: this.spell.castOnYou.replace( /\.$/, '\\.$' ).replace( /you/mi, '^(?<target>You)' ),
            } );
            buffTimerPhrases.push( castOnYouPhraseId );
        }
        
        if ( this.useTargetTimer ) {
            castOnOtherPhraseId = nanoid();
            trigger.capturePhrases.push( <CapturePhrase>{
                phraseId: castOnOtherPhraseId,
                useRegEx: true,
                requirePreviousPhrase: false,
                duration: null,
                // /^(?<target>.+?)\b\s{0,1}'{0,1}s{0,1}\b is covered in necrotic sores\.$/
                phrase: this.spell.castOnOther.replace( /\.$/, '\\.$' ).replace( /soandso's|soandso\s's|soandso/gmi, '^(?<target>.+?)\\b\\s{0,1}\'{0,1}s{0,1}\\b' ),
            } );
            buffTimerPhrases.push( castOnOtherPhraseId );
        }
        
        let buffTimer = <TriggerAction>{
            phrases: [].concat( buffTimerPhrases ),
            actionType: ActionTypes.BeneficialTimer,
            overlayId: this.timerOverlayId,
            duration: this.spell.duration,
            actionId: nanoid(),
            restartBehavior: TimerRestartBehaviors.RestartTimer,
            displayText: this.spell.name,
            useCustomColor: true,
            overrideTimerColor: '#0288d1',
            timerBackgroundColor: ColorUtility.FromHex( '#0288d1' ).darken( 0.93 ).toString( 0.75 ),
            endEarlyPhrases: [],
            hideTimer: !this.useSelfTimer || (this.spell?.targetType !== 'Self' && !this.useTargetTimer),
            hideConditions: [],
            castTime: this.spell.castTime,
        };

        // Add hide timer conditions.  I'm being overly verbose here so that it 
        // works when adding other options that may hide/show the timer in the 
        // future.
        if ( buffTimer.hideTimer && this.useSelfTimer && ( this.spell?.targetType !== 'Self' && !this.useTargetTimer ) ) {
            // Hide the timer when the target !== 'You'
            buffTimer.hideConditions.push( <TriggerCondition>{
                conditionId: nanoid(),
                conditionType: TriggerConditionTypes.NamedGroupValue,
                operatorType: OperatorTypes.DoesNotEqual,
                variableName: 'target',
                variableValue: 'You',
            } );
        } else if ( buffTimer.hideTimer && this.useTargetTimer && ( !this.useSelfTimer && this.spell?.targetType === 'Self' ) ) {
            // Hide the timer when the target === 'You'
            buffTimer.hideConditions.push( <TriggerCondition>{
                conditionId: nanoid(),
                conditionType: TriggerConditionTypes.NamedGroupValue,
                operatorType: OperatorTypes.Equals,
                variableName: 'target',
                variableValue: 'You',
            } );
        }

        trigger.actions.push( buffTimer );
        iconTimerIds.push( buffTimer.actionId );

        trigger.actions.push( <TriggerAction>{
            phrases: [ castOnYouPhraseId ],
            actionType: ActionTypes.ClearVariable,
            variableName: 'SpellBeingCast',
            actionId: nanoid(),
        } );

        if ( this.useSelfTimer && this.cancelTimerIfTargetDies ) {
                
            buffTimer.endEarlyPhrases.push( <Phrase>{
                phraseId: nanoid(),
                // You have been slain by a lightning warrior staticfist!
                phrase: '^You have been slain by [^!]*!$',
                useRegEx: true,
            } );

        }

        if ( this.useTargetTimer && this.cancelTimerIfTargetDies ) {
            
            buffTimer.endEarlyPhrases.push( <Phrase>{
                phraseId: nanoid(),
                phrase: '^${target} has been slain by [^!]*!$',
                useRegEx: true,
            } );
            buffTimer.endEarlyPhrases.push( <Phrase>{
                phraseId: nanoid(),
                phrase: '^You have slain ${target}!$',
                useRegEx: true,
            } );
            // This is apparently just for players
            buffTimer.endEarlyPhrases.push( <Phrase>{
                phraseId: nanoid(),
                // Jhinx dies.
                phrase: '^${target} dies\\.$',
                useRegEx: true,
            } );
            buffTimer.endEarlyPhrases.push( <Phrase>{
                phraseId: nanoid(),
                // A Valorian Guardian died.
                phrase: '^${target} died\\.$',
                useRegEx: true,
            } );

        }

        if ( this.spell.effectFades ) {
            // End when the buff ends early.
            buffTimer.endEarlyPhrases.push( <Phrase>{
                phraseId: nanoid(),
                phrase: '^' + this.spell.effectFades.replace( /\.$/, '\\.$' ),
                useRegEx: true,
            } );
        }

        if ( this.spell.targetType !== 'Self' ) {
            // End when the buff is overwritten.
            buffTimer.endEarlyPhrases.push( <Phrase>{
                phraseId: nanoid(),
                // Your Dead Men Floating spell on Xeraphine has been overwritten.
                phrase: `^Your ${this.spell.name}(?: Rk\. II| Rk\. III){0,1} spell on \${target} has been overwritten\\.$`,
                useRegEx: true,
            } );

            // End when the buff fades
            buffTimer.endEarlyPhrases.push( <Phrase>{
                phraseId: nanoid(),
                // Your Dead Men Floating spell has worn off of Rodus.
                phrase: `Your ${this.spell.name}(?: Rk\. II| Rk\. III){0,1} spell has worn off of \${target}\\.$`,
                useRegEx: true,
            } );
        }

        if ( this.spell.targetType === 'Pet' || this.spell.targetType === 'Undead' ) {

            // End when the buff fades
            buffTimer.endEarlyPhrases.push( <Phrase>{
                phraseId: nanoid(),
                // Your pet's Sigil of Decay spell has worn off.
                phrase: `Your pet's ${this.spell.name}(?: Rk\. II| Rk\. III){0,1} spell has worn off\\.$`,
                useRegEx: true,
            } );

        }

        if ( this.alertWhenBuffFades ) {

            // Using the timer method until I come up with a way to allow the simple capture of the faded msg to work alongside the condition that the spell is currently being cast.
            buffTimer.notifyWhenEnded = true;
            buffTimer.endedSpeak = true;
            buffTimer.endedSpeakPhrase = `Your ${this.spell.name} on \${target} has ended.`;

            // let fadedOnOtherPhraseId = nanoid();
            // trigger.capturePhrases.push( <CapturePhrase>{
            //     phraseId: fadedOnOtherPhraseId,
            //     useRegEx: true,
            //     requirePreviousPhrase: false,
            //     duration: null,
            //     // Your Necrotic Cysts spell has worn off of Rodus.
            //     // /^Your Necrotic Cysts spell has worn off of (?<target>[^\.]*)\.$/
            //     phrase: `^Your ${this.spell.name}(?: Rk\. II| Rk\. III){0,1} spell has worn off of (?<target>[^\\.]*)\\.$`,
            // } );

            // trigger.actions.push( <TriggerAction>{
            //     phrases: [ fadedOnOtherPhraseId ],
            //     actionType: ActionTypes.Speak,
            //     actionId: nanoid(),
            //     interruptSpeech: false,
            //     displayText: `Your ${this.spell.name}(?: Rk\. II| Rk\. III){0,1} on \${target} has ended.`,
            // } );
            
            // if ( this.spell.effectFades ) {
            //     let fadeOnSelfPhraseId = nanoid();
            //     trigger.capturePhrases.push( <CapturePhrase>{
            //         phraseId: fadeOnSelfPhraseId,
            //         useRegEx: true,
            //         requirePreviousPhrase: false,
            //         duration: null,
            //         phrase: '^' + this.spell.effectFades.replace( /\.$/, '\\.$' ),
            //     } );

            //     trigger.actions.push( <TriggerAction>{
            //         phrases: [ fadedOnOtherPhraseId ],
            //         actionType: ActionTypes.Speak,
            //         actionId: nanoid(),
            //         interruptSpeech: false,
            //         displayText: `Your ${this.spell.name}(?: Rk\. II| Rk\. III){0,1} has ended.`,
            //     } );

            // }

            // phrases: [].concat( buffTimerPhrases ),
            // actionType: ActionTypes.BeneficialTimer,
            // overlayId: this.timerOverlayId,
            // duration: this.spell.duration,
            // actionId: nanoid(),
            // restartBehavior: TimerRestartBehaviors.RestartTimer,
            // displayText: this.spell.name,
            // useCustomColor: true,
            // overrideTimerColor: '#0288d1',
            // timerBackgroundColor: ColorUtility.FromHex( '#0288d1' ).darken( 0.93 ).toString( 0.75 ),
            // endEarlyPhrases: [],
            // hideTimer: !this.useSelfTimer && !this.useTargetTimer,
            // castTime: this.spell.castTime,

            // buffTimer.notifyWhenEnded = true;
            // buffTimer.endedSpeak = true;
            // buffTimer.endedSpeakPhrase = `Your ${this.spell.name}(?: Rk\. II| Rk\. III){0,1} on \${target} has ended.`;
            
            // if ( this.spell.effectFades ) {
            //     // End when the buff ends early.
            //     buffTimer.endEarlyPhrases.push( <Phrase>{
            //         phraseId: nanoid(),
            //         phrase: '^' + this.spell.effectFades.replace( /\.$/, '\\.$' ),
            //         useRegEx: true,
            //     } );
            // }
            
        }

        if ( this.alertEndingSoon ) {
            buffTimer.ifEndingSoon = true;
            buffTimer.endingDuration = this.endingSoonDuration;
            buffTimer.endingSoonSpeak = true;
            buffTimer.endingSoonSpeakPhrase = `Your ${this.spell.name} on \${target} is ending soon.`;
            buffTimer.endingSoonShowTimer = this.showTimerWhenEndingSoon;
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

        // let castOnOtherPhraseId = nanoid();
        // trigger.capturePhrases.push( <CapturePhrase>{
        //     phraseId: castOnOtherPhraseId,
        //     useRegEx: true,
        //     requirePreviousPhrase: false,
        //     duration: null,
        //     ///^(?<target>.+?)\s?'s has been poisoned\.
        //     phrase: this.spell.castOnOther.replace( /\.$/, '\\.$' ).replace( /soandso's|soandso\s's|soandso/gmi, '^(?<target>.+?)\\b\\s{0,1}\'{0,1}s{0,1}\\b' ),
        // } );
        // trigger.capturePhrases.push( <CapturePhrase>{
        //     phraseId: nanoid(),
        //     useRegEx: true,
        //     requirePreviousPhrase: false,
        //     duration: null,
        //     // ^?{target} has taken (?<damage>[0-9]*) ?damage from your Poison Bolt\.
        //     phrase: `^?{target} has taken (?<damage>[0-9]*) ?damage from your ${this.spell.name}\\.`,
        // } );
    }

}
