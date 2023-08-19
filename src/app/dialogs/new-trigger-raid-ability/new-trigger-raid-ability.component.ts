import { Component, Inject, OnInit } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialog } from '@angular/material/dialog';
import { ActionTypes, CapturePhrase, ImportTypes, OperatorTypes, OverlayWindowModel, Phrase, ScrapedAbility, ScrapedNpc, TimerRestartBehaviors, TriggerAction, TriggerCondition, TriggerConditionTypes, TriggerModel } from 'src/app/core.model';
import { IpcService } from 'src/app/ipc.service';
import { ScraperService } from 'src/app/scraper.service';
import { NewTriggerDialogComponent } from '../new-trigger-dialog/new-trigger-dialog.component';
import { NewTriggerDialogModel } from '../dialog.model';
import * as _ from 'lodash-es';
import { customAlphabet } from 'nanoid';
import { SelectIconDialogComponent } from '../select-icon-dialog/select-icon-dialog.component';
import { ColorUtility } from 'src/app/utilities';
import { nagId } from 'src/app/core/nag-id.util';
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const nanoid = customAlphabet( alphabet, 16 );

@Component({
    selector: 'app-new-trigger-raid-ability',
    templateUrl: 'new-trigger-raid-ability.component.html',
    styleUrls: [ 'new-trigger-raid-ability.component.scss', '../dialog.styles.scss', '../../core.scss' ]
})
export class NewTriggerRaidAbilityComponent implements OnInit {

    public getUrl: boolean = true;
    public getRecastInfo: boolean = false;
    public getIsDeathTouch: boolean = false;
    public getDeathTouchInfo: boolean = false;
    public getNotificationInfo: boolean = false;
    public readyForImport: boolean = false;
    public url: string;
    public overlays: OverlayWindowModel[] = [];
    public ability: ScrapedAbility;
    public recastDelay: number = null;
    public deathTouch: boolean = false;
    public deathTouchDispellable: boolean = false;
    public deathTouchDuration: number = null;
    public recastNotify: boolean = false;
    public recastNotifyDuration: number = 6;
    public recastNotifySpeak: boolean = false;
    public recastNotifyDisplayText: boolean = false;
    public errorMsg: string = null;
    public recastTimerOverlayId: string = null;
    public effectTimerOverlayId: string = null;
    public alertOverlayId: string = null;
    public trackOther: boolean = false;

    public get timerOverlays(): OverlayWindowModel[] {
        return this.overlays.filter( f => f.overlayType === 'Timer' );
    }
    public get alertOverlays(): OverlayWindowModel[] {
        return this.overlays.filter( f => f.overlayType === 'Alert' );
    }

    constructor(
        public dialogRef: MatDialogRef<NewTriggerDialogComponent>,
        @Inject( MAT_DIALOG_DATA ) public data: NewTriggerDialogModel,
        public scraper: ScraperService,
        public ipcService: IpcService,
        public dialog: MatDialog ) { }

    ngOnInit() {

        if ( this.data?.trigger?.triggerId != null ) {
            this.url = this.data.trigger.allakhazamUrl;
            let countdownAction: TriggerAction = _.find( this.data.trigger.actions, ( action: TriggerAction ) => action.actionType === ActionTypes.Countdown );
            let timerAction: TriggerAction = _.find( this.data.trigger.actions, ( action: TriggerAction ) => action.actionType === ActionTypes.Timer );
            if ( countdownAction ) {
                this.recastTimerOverlayId = countdownAction.overlayId;
                this.alertOverlayId = countdownAction.endingSoonTextOverlayId;
            }
            if ( timerAction ) {
                this.effectTimerOverlayId = timerAction.overlayId;
                this.alertOverlayId = timerAction.endingSoonTextOverlayId ? timerAction.endingSoonTextOverlayId : this.alertOverlayId;
            }
        }
        
        this.ipcService.getOverlayWindows().subscribe( overlays => this.overlays = overlays );

    }









    
    /**
     * Scrapes the entered URL for spell data.
     */
    public scrape(): void {
        // ^You resist (?<caster>.+?)\b\s{0,1}'{0,1}s{0,1}\b Void of Suppression!$
        // ^Warden Hanvar has been slain by (?<player>.+?)!$
        // ^The air stops moving around you\.$
        // Overlord Mata Muram begins casting Mark of Death.
        // Needed from the user: recast per NPC, is this a death touch ability?, When does it DT?
        this.scraper.ScrapeAllakhazamAbility( this.url ).subscribe( ability => {
            
            this.ability = ability;

            this.nextStep();
            
        } );
    }









    
    /**
     * Moves to the next step, setting properties based on parsed information 
     * and user selection.
     */
    public nextStep(): void {
        if ( this.getUrl ) {
            this.getUrl = false;
            this.getRecastInfo = true;
        } else if ( this.getRecastInfo ) {
            this.getRecastInfo = false;
            this.getIsDeathTouch = true;
        } else if ( this.getIsDeathTouch ) {
            this.getIsDeathTouch = false;
            this.getDeathTouchInfo = true;
        } else if ( this.getDeathTouchInfo ) {
            this.getDeathTouchInfo = false;
            this.getNotificationInfo = true;
        } else {
            this.getUrl = false;
            this.getRecastInfo = false;
            this.getIsDeathTouch = false;
            this.getDeathTouchInfo = false;
            this.getNotificationInfo = false;
            this.readyForImport = true;
        }
    }









    
    /**
     * Sets the death touch property to true, and moves to the next step to 
     * enter death touch details.
     */
    public yesIsDeathTouch(): void {
        this.deathTouch = true;
        this.getDeathTouchInfo = true;
        this.deathTouchDuration = this.ability.duration;
        this.nextStep();
    }









    
    /**
     * Sets the death touch property to false and moves to the next step, 
     * twice, to skip the death touch details.
     */
    public noIsDeathTouch(): void {
        this.deathTouch = false;
        this.nextStep();
        this.nextStep();
    }









    
    /**
     * Uses the parsed data to create the trigger.
     */
    public import(): void {
        let trigger: TriggerModel;

        if ( this.data?.trigger?.triggerId != null ) {
            trigger = this.data.trigger;
        } else {
            trigger = new TriggerModel();
            trigger.comments = `${this.ability.name}.`;
            trigger.folderId = this.data?.selectedFolderId;
        }

        trigger.name = this.ability.name;
        trigger.classLevels = [];
        trigger.allakhazamUrl = this.url;
        trigger.externalSource = this.data.dataSource;
        trigger.captureMethod = 'Any match';
        trigger.importType = ImportTypes.Ability;
        // TODO: Enable options for raid abilities to have a cooldown.
        // trigger.useCooldown = true;
        // trigger.cooldownDuration = 1;

        // ^You resist (?<caster>.+?)\b\s{0,1}'{0,1}s{0,1}\b Void of Suppression!$
        // ^Warden Hanvar has been slain by (?<player>.+?)!$
        // ^The air stops moving around you\.$
        // Overlord Mata Muram begins casting Mark of Death.
        trigger.capturePhrases = [];
        let castingPhraseId = nanoid();
        trigger.capturePhrases.push( <CapturePhrase>{
            phraseId: castingPhraseId,
            useRegEx: true,
            requirePreviousPhrase: false,
            duration: null,
            // Aaryonar begins casting Cloud of Disempowerment.
            phrase: `^(?<target>.*) begins casting ${this.ability.name}\\.$`,
        } );
        let hitPhraseId = null;
        if ( this.ability.castOnYou ) {
            hitPhraseId = nanoid();
            trigger.capturePhrases.push( <CapturePhrase>{
                phraseId: hitPhraseId,
                useRegEx: true,
                requirePreviousPhrase: false,
                duration: null,
                // Your eardrums begin to bleed.
                // /^(?<target>You)r eardrums begin to bleed\.$/
                phrase: '^' + this.ability.castOnYou.replace( /\.$/, '\\.$' ).replace( /(You)/i, '(?<target>$1)' ),
            } );
        }
        let resistPhraseId = nanoid();
        trigger.capturePhrases.push( <CapturePhrase>{
            phraseId: resistPhraseId,
            useRegEx: true,
            requirePreviousPhrase: false,
            duration: null,
            // /^You resist (?<caster>.+?)\b\s{0,1}'{0,1}s{0,1}\b Void of Suppression!$/
            phrase: `^You resist (?<caster>.+?)\\b\\s{0,1}'{0,1}s{0,1}\\b ${this.ability.name}!$`,
        } );
        let hitOtherPhraseId = null;
        if ( this.ability.castOnOther ) {
            hitOtherPhraseId = nanoid();
            trigger.capturePhrases.push( <CapturePhrase>{
                phraseId: hitOtherPhraseId,
                useRegEx: true,
                requirePreviousPhrase: false,
                duration: null,
                // /^Your eardrums begin to bleed\.$/
                phrase: this.ability.castOnOther.replace( /\.$/, '\\.$' ).replace( /soandso's|soandso\s's|soandso/gmi, '^(?<target>.+?)\\b\\s{0,1}\'{0,1}s{0,1}\\b' ),
            } );
        }

        trigger.actions = [];

        let trackOtherTimer: TriggerAction = null;
        if ( this.trackOther ) {
            
            let msg = this.deathTouch ? `(\${target}) DT` :
                this.ability.manaDrain ? `(\${target}) Mana Drain` :
                this.ability.silence ? `(\${target}) Silence` :
                `(\${target}) ${this.ability.name}`;

            if ( ( this.deathTouch && this.deathTouchDispellable ) || ( !this.deathTouch && this.ability.cureType ) ) {
                msg += `, ${this.ability.cureType}`;
            } else if ( !this.ability.cureType ) {
                msg += ', Purify/Radiant/Pure Spirit';
            }
                
            let duration = this.deathTouch && this.deathTouchDuration > 0 ? this.deathTouchDuration : this.ability.duration;
            
            trackOtherTimer = <TriggerAction>{
                phrases: [ hitOtherPhraseId ],
                actionType: ActionTypes.Countdown,
                overlayId: this.effectTimerOverlayId,
                duration: duration,
                actionId: nagId(),
                displayText: msg,
                useCustomColor: true,
                overrideTimerColor: '#b71c1c',
                timerBackgroundColor: ColorUtility.FromHex( '#b71c1c' ).darken( 0.93 ).toString( 0.75 ),
                restartBehavior: TimerRestartBehaviors.RestartOnDuplicate,
            };

            trackOtherTimer.endEarlyPhrases = [];
            trackOtherTimer.endEarlyPhrases.push( <Phrase>{
                phraseId: nagId(),
                phrase: '^${target} has been slain by [^!]*!$',
                useRegEx: true,
            }, <Phrase>{
                phraseId: nagId(),
                phrase: '^${target} dies\\.$',
                useRegEx: true,
            }, <Phrase>{
                phraseId: nanoid(),
                phrase: '^${target} died\\.$',
                useRegEx: true,
            }, <Phrase>{
                phraseId: nanoid(),
                // Alora is cured of Mark of Death by Spoilers.
                // https://regex101.com/r/WSLpJc/1
                phrase: `^\${target} is cured of ${this.ability.name}.*?`,
                useRegEx: true,
            } );

            trigger.actions.push( trackOtherTimer );
        }

        // Start by adding recast timers
        let recastCountdowns: TriggerAction[] = [];
        if ( this.recastTimerOverlayId && this.recastDelay > 0 ) {
            
            let act = <TriggerAction>{
                phrases: [ castingPhraseId ],
                actionType: ActionTypes.Countdown,
                overlayId: this.recastTimerOverlayId,
                duration: this.recastDelay,
                actionId: nanoid(),
                displayText: `${this.ability.name} Recast.`,
                useCustomColor: true,
                overrideTimerColor: '#f57f17',
                timerBackgroundColor: ColorUtility.FromHex( '#f57f17' ).darken( 0.93 ).toString( 0.75 ),
                restartBehavior: TimerRestartBehaviors.RestartTimer,
            };

            if ( hitPhraseId ) {
                act.phrases.push( hitPhraseId );
            }
            if ( hitOtherPhraseId ) {
                act.phrases.push( hitOtherPhraseId );
            }
            act.phrases.push( resistPhraseId );

            act.endEarlyPhrases = [];
            act.endEarlyPhrases.push( <Phrase>{
                phraseId: nanoid(),
                // You have been slain by a lightning warrior staticfist!
                phrase: '^You have been slain by [^!]*!$',
                useRegEx: true,
            } );
            this.ability.npcsWithAbility?.forEach( npc => {
                let phrases = this.getRecastTimerEndEarlyPhrases( npc.name );
                act.endEarlyPhrases = act.endEarlyPhrases.concat( phrases );
            } );

            recastCountdowns.push( act );

        } else if ( this.recastTimerOverlayId && this.ability.npcsWithAbility?.length > 0 ) {
            this.ability.npcsWithAbility.forEach( npc => {
                if ( npc.recast > 0 ) {

                    let castPhraseId = nanoid();
                    trigger.capturePhrases.push( <CapturePhrase>{
                        phraseId: castPhraseId,
                        useRegEx: true,
                        requirePreviousPhrase: false,
                        duration: null,
                        // /^Overlord Mata Muram begins casting Mark of Death\.$/
                        phrase: `^${npc.name} begins casting ${this.ability.name}\\.$`
                    } );
                
                    let act = <TriggerAction>{
                        phrases: [ castPhraseId ],
                        actionType: ActionTypes.Countdown,
                        overlayId: this.recastTimerOverlayId,
                        duration: npc.recast,
                        actionId: nanoid(),
                        displayText: `${this.ability.name} Recast.`,
                        endEarlyPhrases: this.getRecastTimerEndEarlyPhrases( npc.name ),
                        useCustomColor: true,
                        overrideTimerColor: '#f57f17',
                        timerBackgroundColor: ColorUtility.FromHex( '#f57f17' ).darken( 0.93 ).toString( 0.75 ),
                        restartBehavior: TimerRestartBehaviors.RestartTimer,
                    };
                    
                    act.endEarlyPhrases.unshift( <Phrase>{
                        phraseId: nanoid(),
                        // You have been slain by a lightning warrior staticfist!
                        phrase: '^You have been slain by (.+?)!',
                        useRegEx: true,
                    } );

                    recastCountdowns.push( act );
                }

            } );
        } else {
            // Ability doesn't recast or the recast is unknowable.
        }

        recastCountdowns.forEach( timer => {
            if ( timer != null ) {
                timer.ifEndingSoon = this.recastNotify;
                timer.endingDuration = this.recastNotifyDuration;
                    
                timer.endingSoonTextOverlayId = this.alertOverlayId;
                timer.endingSoonDisplayText = this.recastNotifyDisplayText;
                timer.endingSoonText = `${this.ability.name} soon.`;
                timer.endingSoonTextDuration = this.recastNotifyDuration;

                timer.endingSoonSpeak = this.recastNotifySpeak;
                timer.endingSoonSpeakPhrase = `${this.ability.name} soon.`;
            }
        } );

        // Now add the hit timer, if needed.
        let hitTimer: TriggerAction;
        if ( this.deathTouch || this.ability.silence || this.ability.duration > 0 ) {
            
            let msg = this.deathTouch ? `Death Touch (${this.ability.name})` :
                this.ability.manaDrain ? `Mana Drain (${this.ability.name})` :
                this.ability.silence ? `Silence (${this.ability.name})` :
                `${this.ability.name}`;

            if ( ( this.deathTouch && this.deathTouchDispellable ) || ( !this.deathTouch && this.ability.cureType ) ) {
                msg += `, Cure ${this.ability.cureType}`;
            }

            let duration = this.deathTouch && this.deathTouchDuration > 0 ? this.deathTouchDuration : this.ability.duration;

            hitTimer = <TriggerAction>{
                phrases: [ hitPhraseId ],
                actionType: ActionTypes.Timer,
                overlayId: this.effectTimerOverlayId,
                duration: duration,
                actionId: nanoid(),
                displayText: msg,
                useCustomColor: true,
                overrideTimerColor: '#b71c1c',
                timerBackgroundColor: ColorUtility.FromHex( '#b71c1c' ).darken( 0.93 ).toString( 0.75 ),
                restartBehavior: TimerRestartBehaviors.RestartTimer,
            };

        }

        
        if ( this.deathTouch || this.ability.manaDrain || this.ability.silence ) {
            let effectSpeak = this.deathTouch ? 'Death Touch!' :
                this.ability.manaDrain ? 'Mana Drain!' :
                this.ability.silence ? 'Silence!' : null;
            let cureSpeak = this.ability.cureType ? `cure ${this.ability.cureType}` : `uncurable`;
            
            trigger.actions.push( <TriggerAction>{
                phrases: [ hitPhraseId ],
                actionType: ActionTypes.Speak,
                displayText: `${effectSpeak} ${cureSpeak}`,
                interruptSpeech: true,
            } );

        }

        trigger.conditions = [];

        if ( this.ability.npcsWithAbility?.length > 0 ) {
            let zones = [];
            this.ability.npcsWithAbility.forEach( npc => {
                npc.zones?.forEach( zone => {
                    if ( zones.indexOf( zone?.trim() ) === -1 ) {
                        zones.push( zone?.trim() );
                    }
                } )
            } );
            let zoneText = zones.length > 1 ? zones.join( '|' ) : zones[ 0 ];
            trigger.conditions.push( <TriggerCondition>{
                conditionId: nanoid(),
                conditionType: TriggerConditionTypes.VariableValue,
                variableName: 'CurrentZone',
                operatorType: OperatorTypes.Contains,
                variableValue: zoneText,
            } );
        }

        if ( this.ability.gemIndex > -1 ) {
            
            this.dialog.open( SelectIconDialogComponent, {
                width: '750px',
                data: {
                    iconIndex: this.ability.gemIndex,
                }
            } ).afterClosed().subscribe( icon => {

                recastCountdowns.forEach( countdown => countdown.timerIcon = icon );
                if ( hitTimer ) {
                    hitTimer.timerIcon = icon;
                }
                if ( trackOtherTimer ) {
                    trackOtherTimer.timerIcon = icon;
                }

                trigger.actions = trigger.actions.concat( recastCountdowns, hitTimer ? [ hitTimer ] : [] );

                if ( trigger.triggerId != null ) {
                    this.ipcService.updateTrigger( trigger ).subscribe( updated => { } );
                } else {
                    this.ipcService.createNewTrigger( trigger ).subscribe( triggerId => { trigger.triggerId = triggerId; } );
                }

                this.dialogRef.close();
            } );

        } else {

            trigger.actions = trigger.actions.concat( recastCountdowns, hitTimer ? [ hitTimer ] : [] );

            if ( trigger.triggerId != null ) {
                this.ipcService.updateTrigger( trigger ).subscribe( updated => { } );
            } else {
                this.ipcService.createNewTrigger( trigger ).subscribe( triggerId => { trigger.triggerId = triggerId; } );
            }
            
            this.dialogRef.close();
        }
        
    }










    /**
     * Returns a list of phrases to end this action early.
     * 
     * @param target The target of the phrase.
     */
    public getRecastTimerEndEarlyPhrases( target: string ): Phrase[] {
        
        let phrases: Phrase[] = [];

        phrases.push( <Phrase>{
            phraseId: nanoid(),
            phrase: `^${target} has been slain by [^!]*!$`,
            useRegEx: true,
        } );
        phrases.push( <Phrase>{
            phraseId: nanoid(),
            phrase: `^You have slain ${target}!`,
            useRegEx: true,
        } );
        phrases.push( <Phrase>{
            phraseId: nanoid(),
            phrase: `^${target} dies\\.$`,
            useRegEx: true,
        } );
        phrases.push( <Phrase>{
            phraseId: nanoid(),
            phrase: `^${target} died\\.$`,
            useRegEx: true,
        } );

        return phrases;
    }

}
