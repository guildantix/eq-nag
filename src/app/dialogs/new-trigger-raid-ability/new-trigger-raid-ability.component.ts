import { Component, Inject, OnInit } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialog } from '@angular/material/dialog';
import { ActionTypes, CapturePhrase, ImportTypes, OperatorTypes, OverlayWindowModel, Phrase, ScrapedAbility, ScrapedNpc, TriggerAction, TriggerCondition, TriggerConditionTypes, TriggerModel } from 'src/app/core.model';
import { IpcService } from 'src/app/ipc.service';
import { ScraperService } from 'src/app/scraper.service';
import { NewTriggerDialogComponent } from '../new-trigger-dialog/new-trigger-dialog.component';
import { NewTriggerDialogModel } from '../dialog.model';
import * as _ from 'lodash';
import { customAlphabet } from 'nanoid';
import { SelectIconDialogComponent } from '../select-icon-dialog/select-icon-dialog.component';
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const nanoid = customAlphabet( alphabet, 16 );

@Component({
    selector: 'app-new-trigger-raid-ability',
    templateUrl: 'new-trigger-raid-ability.component.html',
    styleUrls: [ 'new-trigger-raid-ability.component.scss', '../../core.scss' ]
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
        
        this.ipcService.getOverlayWindows().subscribe( overlays => this.overlays = overlays );

    }

    public scrape(): void {
        // ^You resist (?<caster>.+?)['s]* Void of Suppression!$
        // ^Warden Hanvar has been slain by (?<player>.+?)!$
        // ^The air stops moving around you\.$
        // Overlord Mata Muram begins casting Mark of Death.
        // Needed from the user: recast per NPC, is this a death touch ability?, When does it DT?
        this.scraper.ScrapeAllakhazamAbility( this.url ).subscribe( ability => {
            console.log( 'ability', ability );
            this.ability = ability;

            this.nextStep();
            // this.getRecastInfo = true;
        } );
    }

    // private resetSteps(): void {
    //     this.getUrl = false;
    //     this.getRecastInfo = false;
    // }

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
            console.log( 'moving on from', 'else' );
            this.getUrl = false;
            this.getRecastInfo = false;
            this.getIsDeathTouch = false;
            this.getDeathTouchInfo = false;
            this.getNotificationInfo = false;
            this.readyForImport = true;
        }
    }

    public yesIsDeathTouch(): void {
        this.deathTouch = true;
        this.getDeathTouchInfo = true;
        this.deathTouchDuration = this.ability.duration;
        this.nextStep();
    }

    public noIsDeathTouch(): void {
        this.deathTouch = false;
        this.nextStep();
        this.nextStep();
    }

    public import(): void {

        let trigger: TriggerModel;

        if ( this.data?.trigger?.triggerId != null ) {
            trigger = this.data.trigger;
        } else {
            trigger = new TriggerModel();
            trigger.comments = `${this.ability.name}.`;
        }

        trigger.name = this.ability.name;
        trigger.classLevels = [];
        trigger.allakhazamUrl = this.url;
        trigger.captureMethod = 'Any match';
        trigger.importType = ImportTypes.Ability;
        trigger.folderId = this.data?.selectedFolderId;

        // ^You resist (?<caster>.+?)['s]* Void of Suppression!$
        // ^Warden Hanvar has been slain by (?<player>.+?)!$
        // ^The air stops moving around you\.$
        // Overlord Mata Muram begins casting Mark of Death.
        trigger.capturePhrases = [];
        let hitPhraseId = nanoid();
        trigger.capturePhrases.push( <CapturePhrase>{
            phraseId: hitPhraseId,
            useRegEx: true,
            requirePreviousPhrase: false,
            duration: null,
            // /^Your eardrums begin to bleed\.$/
            phrase: '^' + this.ability.castOnYou.replace(/\.$/, '\\.$').replace( /soandso's|soandso\s's|soandso/gmi, '^(?<target>.+?)\'?s?' ),
        } );
        let resistPhraseId = nanoid();
        trigger.capturePhrases.push( <CapturePhrase>{
            phraseId: resistPhraseId,
            useRegEx: true,
            requirePreviousPhrase: false,
            duration: null,
            // /^You resist (?<caster>.+?)['s]* Void of Suppression!$/
            phrase: `^You resist (?<caster>.+?)['s]* ${this.ability.name}!$`,
        } );
        let hitOtherPhraseId = nanoid();
        trigger.capturePhrases.push( <CapturePhrase>{
            phraseId: hitOtherPhraseId,
            useRegEx: true,
            requirePreviousPhrase: false,
            duration: null,
            // /^Your eardrums begin to bleed\.$/
            phrase: this.ability.castOnOther.replace(/\.$/, '\\.$').replace( /soandso's|soandso\s's|soandso/gmi, '^(?<target>.+?)\'?s?' ),
        } );

        trigger.actions = [];

        // Start by adding recast timers
        let recastCountdowns: TriggerAction[] = [];
        if ( this.recastTimerOverlayId && this.recastDelay > 0 ) {
            
            let act = <TriggerAction>{
                phrases: [ hitOtherPhraseId, hitPhraseId, resistPhraseId ],
                actionType: ActionTypes.Countdown,
                overlayId: this.recastTimerOverlayId,
                duration: this.recastDelay,
                actionId: nanoid(),
                displayText: `${this.ability.name} Recast.`,
                useCustomColor: true,
                overrideTimerColor: '#f57f17',
                restartTimerAlways: true,
            };

            act.endEarlyPhrases = [];
            this.ability.npcsWithAbility?.forEach( npc => {
                act.endEarlyPhrases = act.endEarlyPhrases.concat( this.getRecastTimerEndEarlyPhrases( npc.name, act.endEarlyPhrases ) );
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
                        endEarlyPhrases: this.getRecastTimerEndEarlyPhrases( npc.name, [] ),
                        useCustomColor: true,
                        overrideTimerColor: '#f57f17',
                        restartTimerAlways: true,
                    };
                    
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
            
            let msg = this.deathTouch ? `Death Touch` :
                this.ability.silence ? `Silence`
                : `${this.ability.name}`;

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
                restartTimerAlways: true,
            };

        }

        trigger.conditions = [];

        if ( this.ability.npcsWithAbility?.length > 0 ) {
            let zones = [];
            this.ability.npcsWithAbility.forEach( npc => {
                npc.zones?.forEach( zone => {
                    if ( zones.indexOf( zone ) === -1 ) {
                        zones.push( zone );
                    }
                } )
            } );
            zones.forEach( zone => {
                trigger.conditions.push( <TriggerCondition>{
                    conditionId: nanoid(),
                    conditionType: TriggerConditionTypes.VariableValue,
                    variableName: 'CurrentZone',
                    operatorType: OperatorTypes.Equals,
                    variableValue: zone,
                } );
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

                trigger.actions = trigger.actions.concat( recastCountdowns, [ hitTimer ] );

                if ( trigger.triggerId != null ) {
                    this.ipcService.updateTrigger( trigger ).subscribe( updated => { } );
                } else {
                    this.ipcService.createNewTrigger( trigger ).subscribe( triggerId => { trigger.triggerId = triggerId; } );
                }

                this.dialogRef.close();
            } );

        } else {

            trigger.actions = trigger.actions.concat( recastCountdowns, [ hitTimer ] );

            if ( trigger.triggerId != null ) {
                this.ipcService.updateTrigger( trigger ).subscribe( updated => { } );
            } else {
                this.ipcService.createNewTrigger( trigger ).subscribe( triggerId => { trigger.triggerId = triggerId; } );
            }
            
            this.dialogRef.close();
        }
        
    }

    public getRecastTimerEndEarlyPhrases(target: string, phrases?: Phrase[]): Phrase[] {
        
        phrases = phrases == null ? [] : phrases;

        phrases.push( <Phrase>{
            phraseId: nanoid(),
            phrase: `^${target} has been slain by (.+?)!`,
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
            // You have been slain by a lightning warrior staticfist!
            phrase: '^You have been slain by (.+?)!',
            useRegEx: true,
        } );
        phrases.push( <Phrase>{
            phraseId: nanoid(),
            phrase: `^${target} died\\.$`,
            useRegEx: true,
        } );

        return _.uniqBy( phrases, f => f.phrase );
    }

}
