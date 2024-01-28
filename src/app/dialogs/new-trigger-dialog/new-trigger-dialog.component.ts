import { Component, OnInit, Inject, ViewChild } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { ActionTypes, CapturePhrase, Phrase, OperatorTypes, OverlayWindowModel, TriggerAction, TriggerCondition, TriggerConditionTypes, TriggerModel, ImportTypes, TimerRestartBehaviors, ScrapedSpell, ScrapedClickEffect, ExternalDataSources } from 'src/app/core.model';
import { IpcService } from 'src/app/ipc.service';
import { ScraperService } from 'src/app/scraper.service';
import { customAlphabet } from 'nanoid';
import { SelectIconDialogComponent } from '../select-icon-dialog/select-icon-dialog.component';
import * as _ from 'lodash-es';
import { NewTriggerDialogModel } from '../dialog.model';
import { forkJoin, Observable } from 'rxjs';
import { MatStepper } from '@angular/material/stepper';
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const nanoid = customAlphabet( alphabet, 16 );

@Component( {
    selector: 'app-new-trigger-dialog',
    templateUrl: 'new-trigger-dialog.component.html',
    styleUrls: [ 'new-trigger-dialog.component.scss', '../dialog.styles.scss', '../../core.scss' ]
} )
export class NewTriggerDialogComponent implements OnInit {

    public url: string;
    public characterClass: string;
    public overlayId: string;
    public overlays: OverlayWindowModel[] = [];
    public onlyExecuteForRareEqTargets: boolean = false;
    public cancelTimerIfTargetDies: boolean = false;
    public spell: ScrapedSpell;
    public selectedItems: ScrapedClickEffect[] = [];
    public loadingItemDetails: boolean = false;

    public get timerOverlays(): OverlayWindowModel[] {
        return this.overlays.filter( f => f.overlayType === 'Timer' );
    }

    public get serviceName(): string {
        return this.data.dataSource === ExternalDataSources.Allakhazam ? 'Allakhazam' : 'EQ Spell Resources';
    }
    
    @ViewChild( 'stepper', { static: false, read: MatStepper } ) public stepper: MatStepper;

    constructor(
        public dialogRef: MatDialogRef<NewTriggerDialogComponent>,
        @Inject( MAT_DIALOG_DATA ) public data: NewTriggerDialogModel,
        public scraper: ScraperService,
        public ipcService: IpcService,
        public dialog: MatDialog ) { }

    ngOnInit(): void {

        if ( this.data?.trigger?.triggerId != null ) {
            this.url = this.data.trigger.allakhazamUrl;
            let dotAction: TriggerAction = _.find( this.data.trigger.actions, ( action: TriggerAction ) => action.actionType === ActionTypes.DotTimer );
            if ( dotAction ) {
                this.overlayId = dotAction.overlayId;
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
            this.stepper.next();
        }

        if ( this.data.dataSource === ExternalDataSources.Allakhazam ) {

            this.scraper.ScrapeAllakhazamSpell( this.url ).subscribe( spell => complete( spell ) );

        } else if ( this.data.dataSource === ExternalDataSources.EqSpellResources ) {

            this.ipcService.scrapeEqSpellResourceSpell( this.url ).subscribe( spell => complete( spell ) );

        }
        
    }
    









    /**
     * Uses the parsed data to create the trigger.
     */
    public generateTrigger() {
        
        let trigger: TriggerModel;

        if ( this.data?.trigger?.triggerId != null ) {
            trigger = this.data.trigger;
        } else {
            trigger = new TriggerModel();
            trigger.comments = `DoT timer for ${this.spell.name}.`;
            trigger.folderId = this.data?.selectedFolderId;
        }

        trigger.name = this.spell.name;
        trigger.classLevels = this.spell.classes;
        trigger.allakhazamUrl = this.url;
        trigger.externalSource = this.data.dataSource;
        trigger.captureMethod = 'Sequential';
        trigger.importType = ImportTypes.DotTimer;

        trigger.capturePhrases = [];
        const captureReplaceRegex = this.data.dataSource === ExternalDataSources.Allakhazam ? /soandso's|soandso\s's|soandso/gmi : /target's|target\s's|target/gmi;
        trigger.capturePhrases.push( <CapturePhrase>{
            phraseId: nanoid(),
            useRegEx: true,
            requirePreviousPhrase: false,
            duration: null,
            ///^(?<target>.+?)\s?'s has been poisoned\.
            phrase: this.spell.castOnOther.replace( /\.$/, '\\.$' ).replace( captureReplaceRegex, '^(?<target>.+?)\\b\\s{0,1}\'{0,1}s{0,1}\\b' ),
        } );
        trigger.capturePhrases.push( <CapturePhrase>{
            phraseId: nanoid(),
            useRegEx: true,
            requirePreviousPhrase: false,
            duration: null,
            // ^?{target} has taken (?<damage>[0-9]*) ?damage from your Poison Bolt\.
            phrase: `^?{target} has taken (?<damage>[0-9]*) ?damage from your ${this.spell.name}(?: Rk\\. II| Rk\\. III){0,1}\\.`,
        } );

        let originalDotAction: TriggerAction;
        if ( trigger.triggerId != null ) {
            originalDotAction = _.find( trigger.actions, ( action: TriggerAction ) => action.actionType === ActionTypes.DotTimer && action.castTime == this.spell.castTime );
        }
        
        trigger.actions = [];
        let actions: TriggerAction[] = [];
        let endingSoonVals = originalDotAction != null && originalDotAction.ifEndingSoon;
        let remainAfterVals = originalDotAction != null && originalDotAction.remainAfterEnded;
        actions.push( <TriggerAction>{
            phrases: [ trigger.capturePhrases[ 0 ].phraseId ],
            secondaryPhrases: [ trigger.capturePhrases[ 1 ].phraseId ],
            actionType: ActionTypes.DotTimer,
            overlayId: this.overlayId,
            duration: this.spell.duration,
            actionId: nanoid(),
            restartBehavior: TimerRestartBehaviors.RestartOnDuplicate,

            ifEndingSoon: endingSoonVals ? true : false,
            endingDuration: endingSoonVals ? originalDotAction.endingDuration : null,
            endingSoonChangeColor: endingSoonVals ? originalDotAction.endingSoonChangeColor : false,
            endingSoonColor: endingSoonVals ? originalDotAction.endingSoonColor : null,
            endingSoonBackgroundColor: endingSoonVals ? originalDotAction.endingSoonBackgroundColor : null,
            endingSoonDisplayText: endingSoonVals ? originalDotAction.endingSoonDisplayText : null,
            endingSoonTextOverlayId: endingSoonVals ? originalDotAction.endingSoonTextOverlayId : null,
            endingSoonText: endingSoonVals ? originalDotAction.endingSoonText : null,
            endingSoonTextDuration: endingSoonVals ? originalDotAction.endingSoonTextDuration : null,
            endingSoonSpeak: endingSoonVals ? originalDotAction.endingSoonSpeak : false,
            endingSoonSpeakPhrase: endingSoonVals ? originalDotAction.endingSoonSpeakPhrase : null,
            
            remainAfterEnded: originalDotAction?.remainAfterEnded === false ? false : true,
            remainDuration: originalDotAction?.remainAfterEnded === true ? originalDotAction.remainDuration : 12,
            endedDisplayText: originalDotAction?.remainAfterEnded === true ? originalDotAction.endedDisplayText : null,
            endedTextOverlayId: originalDotAction?.remainAfterEnded === true ? originalDotAction.endedTextOverlayId : null,
            endedText: originalDotAction?.remainAfterEnded === true ? originalDotAction.endedText : null,
            endedTextDuration: originalDotAction?.remainAfterEnded === true ? originalDotAction.endedTextDuration : null,
            endedSpeak: originalDotAction?.remainAfterEnded === true ? originalDotAction.endedSpeak : false,
            endedSpeakPhrase: originalDotAction?.remainAfterEnded === true ? originalDotAction.endedSpeakPhrase : null,
            endedChangeColor: originalDotAction?.remainAfterEnded === true ? originalDotAction.endedChangeColor : true,
            endedColor: originalDotAction?.remainAfterEnded === true ? originalDotAction.endedColor : '#b71c1c',
            endedBackgroundColor: originalDotAction?.remainAfterEnded === true ? originalDotAction.endedBackgroundColor : 'rgba(48,7,7,0.75)',
        } );

        if ( this.onlyExecuteForRareEqTargets ) {
            actions.forEach( action => action.excludeTargets = [] );
            actions.forEach( action => action.excludeTargets.push( <Phrase>{
                phraseId: nanoid(),
                phrase: '^(?:A\\s|An\\s|a\\s|an\\s|[a-z])',
                useRegEx: true,
            } ) );
        }
        if ( this.cancelTimerIfTargetDies ) {
            actions.forEach( action => action.endEarlyPhrases = [] );
            actions.forEach( action => action.endEarlyPhrases.push( <Phrase>{
                phraseId: nanoid(),
                phrase: '^${target} has been slain by [^!]*!$',
                useRegEx: true,
            } ) );
            actions.forEach( action => action.endEarlyPhrases.push( <Phrase>{
                phraseId: nanoid(),
                phrase: '^You have slain ${target}!$',
                useRegEx: true,
            } ) );
            actions.forEach( action => action.endEarlyPhrases.push( <Phrase>{
                phraseId: nanoid(),
                phrase: '^${target} dies\\.$',
                useRegEx: true,
            } ) );
            actions.forEach( action => action.endEarlyPhrases.push( <Phrase>{
                phraseId: nanoid(),
                // You have been slain by a lightning warrior staticfist!
                phrase: '^You have been slain by [^!]*!$',
                useRegEx: true,
            } ) );
            actions.forEach( action => action.endEarlyPhrases.push( <Phrase>{
                phraseId: nanoid(),
                phrase: '^${target} died\\.$',
                useRegEx: true,
            } ) );
        }
        
        trigger.actions = actions;
        trigger.actions.push( <TriggerAction>{
            phrases: [ trigger.capturePhrases[ 1 ].phraseId ],
            actionType: ActionTypes.ClearVariable,
            variableName: 'SpellBeingCast',
            actionId: nanoid(),
        } );

        trigger.conditions = [];
        trigger.conditions.push( <TriggerCondition>{
            conditionId: nanoid(),
            conditionType: TriggerConditionTypes.VariableValue,
            variableName: 'SpellBeingCast',
            operatorType: OperatorTypes.Equals,
            // Hoshkar's Swift Sickness|Hoshkar's Swift Sickness Rk. II|Hoshkar's Swift Sickness Rk. III
            variableValue: `${this.spell.name}|${this.spell.name} Rk\. II|${this.spell.name} Rk\. III`,
        } );

        if ( this.spell.gemIndex > -1 ) {
            
            this.dialog.open( SelectIconDialogComponent, {
                width: '750px',
                data: {
                    iconIndex: this.spell.gemIndex,
                }
            } ).afterClosed().subscribe( icon => {
                trigger.actions[ 0 ].timerIcon = icon;

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
