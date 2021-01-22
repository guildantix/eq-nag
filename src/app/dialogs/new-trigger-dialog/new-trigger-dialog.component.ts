import { Component, OnInit, Inject } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { ActionTypes, CapturePhrase, Phrase, OperatorTypes, OverlayWindowModel, TimerSortTypes, TriggerAction, TriggerCondition, TriggerConditionTypes, TriggerModel, ImportTypes, TimerRestartBehaviors } from 'src/app/core.model';
import { IpcService } from 'src/app/ipc.service';
import { ScraperService } from 'src/app/scraper.service';
import { customAlphabet } from 'nanoid';
import { DialogService } from '../dialog.service';
import { SelectIconDialogComponent } from '../select-icon-dialog/select-icon-dialog.component';
import * as _ from 'lodash';
import { NewTriggerDialogModel } from '../dialog.model';
// import { NgForm } from '@angular/forms';
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const nanoid = customAlphabet( alphabet, 16 );

@Component( {
    selector: 'app-new-trigger-dialog',
    templateUrl: 'new-trigger-dialog.component.html',
    styleUrls: [ 'new-trigger-dialog.component.scss', '../../core.scss' ]
} )
export class NewTriggerDialogComponent implements OnInit {

    public url: string;
    public characterClass: string;
    public overlayId: string;
    public overlays: OverlayWindowModel[] = [];
    public onlyExecuteForRareEqTargets: boolean = false;
    public cancelTimerIfTargetDies: boolean = false;

    public get timerOverlays(): OverlayWindowModel[] {
        return this.overlays.filter( f => f.overlayType === 'Timer' );
    }

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

    public scrape(): void {
        this.scraper.ScrapeAllakhazamSpell( this.url ).subscribe( spell => {

            let trigger: TriggerModel;

            if ( this.data?.trigger?.triggerId != null ) {
                trigger = this.data.trigger;
            } else {
                trigger = new TriggerModel();
                trigger.comments = `DoT timer for ${spell.name}.`;
                trigger.folderId = this.data?.selectedFolderId;
            }

            trigger.name = spell.name;
            trigger.classLevels = spell.classes;
            trigger.allakhazamUrl = this.url;
            trigger.captureMethod = 'Sequential';
            trigger.importType = ImportTypes.DotTimer;

            trigger.capturePhrases = [];
            trigger.capturePhrases.push( <CapturePhrase>{
                phraseId: nanoid(),
                useRegEx: true,
                requirePreviousPhrase: false,
                duration: null,
                ///^(?<target>.+?)\s?'s has been poisoned\.
                phrase: spell.castOnOther.replace( /\.$/, '\\.$' ).replace( /soandso's|soandso\s's|soandso/gmi, '^(?<target>.+?)\\b\\s{0,1}\'{0,1}s{0,1}\\b' ),
            } );
            trigger.capturePhrases.push( <CapturePhrase>{
                phraseId: nanoid(),
                useRegEx: true,
                requirePreviousPhrase: false,
                duration: null,
                // ^?{target} has taken (?<damage>[0-9]*) ?damage from your Poison Bolt\.
                phrase: `^?{target} has taken (?<damage>[0-9]*) ?damage from your ${spell.name}(?: Rk\\. II| Rk\\. III){0,1}\\.`,
            } );

            let originalDotAction: TriggerAction;
            if ( trigger.triggerId != null ) {
                originalDotAction = _.find( trigger.actions, ( action: TriggerAction ) => action.actionType === ActionTypes.DotTimer );
            }
            
            trigger.actions = [];
            let dotAction = <TriggerAction>{
                phrases: [ trigger.capturePhrases[ 1 ].phraseId ],
                actionType: ActionTypes.DotTimer,
                overlayId: this.overlayId,
                duration: spell.duration,
                actionId: nanoid(),
                restartBehavior: TimerRestartBehaviors.RestartOnDuplicate,
            };

            if ( originalDotAction != null && originalDotAction.ifEndingSoon ) {
                dotAction.ifEndingSoon = originalDotAction.ifEndingSoon;
                dotAction.endingDuration = originalDotAction.endingDuration;
                dotAction.endingSoonChangeColor = originalDotAction.endingSoonChangeColor;
                dotAction.endingSoonColor = originalDotAction.endingSoonColor;
                dotAction.endingSoonBackgroundColor = originalDotAction.endingSoonBackgroundColor;
                dotAction.endingSoonDisplayText = originalDotAction.endingSoonDisplayText;
                dotAction.endingSoonTextOverlayId = originalDotAction.endingSoonTextOverlayId;
                dotAction.endingSoonText = originalDotAction.endingSoonText;
                dotAction.endingSoonTextDuration = originalDotAction.endingSoonTextDuration;
                dotAction.endingSoonSpeak = originalDotAction.endingSoonSpeak;
                dotAction.endingSoonSpeakPhrase = originalDotAction.endingSoonSpeakPhrase;
            }

            if ( originalDotAction != null && originalDotAction.remainAfterEnded ) {
                dotAction.remainAfterEnded = originalDotAction.remainAfterEnded;
                dotAction.remainDuration = originalDotAction.remainDuration;
                dotAction.endedDisplayText = originalDotAction.endedDisplayText;
                dotAction.endedTextOverlayId = originalDotAction.endedTextOverlayId;
                dotAction.endedText = originalDotAction.endedText;
                dotAction.endedTextDuration = originalDotAction.endedTextDuration;
                dotAction.endedSpeak = originalDotAction.endedSpeak;
                dotAction.endedSpeakPhrase = originalDotAction.endedSpeakPhrase;
                dotAction.endedChangeColor = originalDotAction.endedChangeColor;
                dotAction.endedColor = originalDotAction.endedColor;
                dotAction.endedBackgroundColor = originalDotAction.endedBackgroundColor;
            }


            if ( this.onlyExecuteForRareEqTargets ) {
                dotAction.excludeTargets = [];
                dotAction.excludeTargets.push( <Phrase>{
                    phraseId: nanoid(),
                    phrase: '^(?:A\\s|An\\s|a\\s|an\\s|[a-z])',
                    useRegEx: true,
                } );
            }
            if ( this.cancelTimerIfTargetDies ) {
                dotAction.endEarlyPhrases = [];
                dotAction.endEarlyPhrases.push( <Phrase>{
                    phraseId: nanoid(),
                    phrase: '^${target} has been slain by [^!]*!$',
                    useRegEx: true,
                } );
                dotAction.endEarlyPhrases.push( <Phrase>{
                    phraseId: nanoid(),
                    phrase: '^You have slain ${target}!$',
                    useRegEx: true,
                } );
                dotAction.endEarlyPhrases.push( <Phrase>{
                    phraseId: nanoid(),
                    phrase: '^${target} dies\\.$',
                    useRegEx: true,
                } );
                dotAction.endEarlyPhrases.push( <Phrase>{
                    phraseId: nanoid(),
                    // You have been slain by a lightning warrior staticfist!
                    phrase: '^You have been slain by [^!]*!$',
                    useRegEx: true,
                } );
                dotAction.endEarlyPhrases.push( <Phrase>{
                    phraseId: nanoid(),
                    phrase: '^${target} died\\.$',
                    useRegEx: true,
                } );
            }
            trigger.actions.push( dotAction );
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
                variableValue: `${spell.name}|${spell.name} Rk\. II|${spell.name} Rk\. III`,
            } );

            if ( spell.gemIndex > -1 ) {
                
                this.dialog.open( SelectIconDialogComponent, {
                    width: '750px',
                    data: {
                        iconIndex: spell.gemIndex,
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
            
        } );
    }
    
}
