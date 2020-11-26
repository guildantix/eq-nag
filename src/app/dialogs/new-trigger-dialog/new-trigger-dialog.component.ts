import { Component, OnInit, Inject } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { ActionTypes, CapturePhrase, Phrase, OperatorTypes, OverlayWindowModel, TimerSortTypes, TriggerAction, TriggerCondition, TriggerConditionTypes, TriggerModel } from 'src/app/core.model';
import { IpcService } from 'src/app/ipc.service';
import { ScraperService } from 'src/app/scraper.service';
import { customAlphabet } from 'nanoid';
import { DialogService } from '../dialog.service';
import { SelectIconDialogComponent } from '../select-icon-dialog/select-icon-dialog.component';
import * as _ from 'lodash';
// import { NgForm } from '@angular/forms';
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const nanoid = customAlphabet( alphabet, 16 );

@Component( {
    selector: 'app-new-trigger-dialog',
    templateUrl: 'new-trigger-dialog.component.html',
    styleUrls: [ 'new-trigger-dialog.component.scss' ]
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
        @Inject( MAT_DIALOG_DATA ) public data: TriggerModel,
        public scraper: ScraperService,
        public ipcService: IpcService,
        public dialog: MatDialog ) { }

    ngOnInit(): void {

        if ( this.data?.triggerId != null ) {
            this.url = this.data.allakhazamUrl;
        }

        this.ipcService.getOverlayWindows().subscribe( overlays => this.overlays = overlays );
    }

    public scrape(): void {
        this.scraper.ScrapeAllakhazamSpell( this.url, this.characterClass ).subscribe( spell => {

            let trigger: TriggerModel;

            if ( this.data?.triggerId != null ) {
                trigger = this.data;
            } else {
                trigger = new TriggerModel();
                trigger.comments = `DoT timer for ${spell.name}.`;
            }

            trigger.name = spell.name;
            trigger.spellLevel = spell.level;
            trigger.allakhazamUrl = this.url;
            trigger.captureMethod = 'Sequential';

            trigger.capturePhrases = [];
            trigger.capturePhrases.push( <CapturePhrase>{
                phraseId: nanoid(),
                useRegEx: true,
                requirePreviousPhrase: false,
                duration: null,
                phrase: spell.castOnOther.replace( /soandso's|soandso\s's|soandso/gmi, '^(.*)' ),
            } );
            trigger.capturePhrases.push( <CapturePhrase>{
                phraseId: nanoid(),
                useRegEx: true,
                requirePreviousPhrase: false,
                duration: null,
                phrase: `^(?<target>.*) has taken (?<damage>[0-9]*) ?damage from your ${spell.name}\\.`,
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
                restartOnDuplicate: true,
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
                    phrase: '^(?:A\s|An\s|a\s|an\s|[a-z])',
                    useRegEx: true,
                } );
            }
            if ( this.cancelTimerIfTargetDies ) {
                dotAction.endEarlyPhrases = [];
                dotAction.endEarlyPhrases.push( <Phrase>{
                    phraseId: nanoid(),
                    phrase: '^${target} has been slain by (.+?)!',
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
                variableValue: spell.name,
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
