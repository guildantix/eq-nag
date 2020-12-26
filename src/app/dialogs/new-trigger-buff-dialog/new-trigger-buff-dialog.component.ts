import { Component, Inject, OnInit, ViewChild } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatHorizontalStepper } from '@angular/material/stepper';
import { ActionTypes, CapturePhrase, ImportTypes, OperatorTypes, OverlayWindowModel, Phrase, ScrapedSpell, TriggerAction, TriggerCondition, TriggerConditionTypes, TriggerModel } from 'src/app/core.model';
import { IpcService } from 'src/app/ipc.service';
import { ScraperService } from 'src/app/scraper.service';
import { NewTriggerDialogModel } from '../dialog.model';
import { customAlphabet } from 'nanoid';
import { SelectIconDialogComponent } from '../select-icon-dialog/select-icon-dialog.component';
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const nanoid = customAlphabet( alphabet, 16 );

@Component( {
    selector: 'app-new-trigger-buff-dialog',
    templateUrl: 'new-trigger-buff-dialog.component.html',
    styleUrls: [ 'new-trigger-buff-dialog.component.scss', '../../core.scss', '../../modal.scss' ],
} )
export class NewTriggerBuffDialogComponent implements OnInit {
    
    public url: string;
    public overlays: OverlayWindowModel[] = [];
    public cancelTimerIfTargetDies: boolean = false;
    public useTimer: boolean = false;
    public alertWhenBuffFades: boolean = false;
    public alertWhenBuffOverwritten: boolean = false;
    public alertEndingSoon: boolean = false;
    public timerOverlayId: string;
    public endingSoonDuration: number = null;
    public readyForImport: boolean = false;
    
    public get timerOverlays(): OverlayWindowModel[] {
        return this.overlays.filter( f => f.overlayType === 'Timer' );
    }
    
    @ViewChild( 'stepper', { static: false, read: MatHorizontalStepper } ) public stepper: MatHorizontalStepper;

    private spell: ScrapedSpell;
    
    constructor(
        public dialogRef: MatDialogRef<NewTriggerBuffDialogComponent>,
        @Inject( MAT_DIALOG_DATA ) public data: NewTriggerDialogModel,
        public scraper: ScraperService,
        public ipcService: IpcService,
        public dialog: MatDialog ) { }

    ngOnInit() {
        this.ipcService.getOverlayWindows().subscribe( overlays => this.overlays = overlays );
    }

    public scrape(): void {
        this.scraper.ScrapeAllakhazamSpell( this.url ).subscribe( spell => {
            console.log( 'spell', spell );
            this.spell = spell;
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
            variableValue: this.spell.name,
        } );


        let castOnYouPhraseId: string = null;
        let iconTimerIds: string[] = [];
        if ( this.spell.targetType === 'Self' && this.useTimer ) {
            trigger.captureMethod = 'Any match';

            castOnYouPhraseId = nanoid();
            trigger.capturePhrases.push( <CapturePhrase>{
                phraseId: castOnYouPhraseId,
                useRegEx: true,
                requirePreviousPhrase: false,
                duration: null,
                // /^(?<target>You) feel armored\.$/
                phrase: this.spell.castOnYou.replace( /\.$/, '\\.$' ).replace( /you/gmi, '^(?<target>You)' ),
            } );
            
            let buffTimer = <TriggerAction>{
                phrases: [ castOnYouPhraseId ],
                actionType: ActionTypes.BeneficialTimer,
                overlayId: this.timerOverlayId,
                duration: this.spell.duration,
                actionId: nanoid(),
                restartTimerAlways: true,
                displayText: this.spell.name,
                useCustomColor: true,
                overrideTimerColor: '#0288d1',
                endEarlyPhrases: [],
            };

            trigger.actions.push( buffTimer );
            iconTimerIds.push( buffTimer.actionId );

            trigger.actions.push( <TriggerAction>{
                phrases: [ castOnYouPhraseId ],
                actionType: ActionTypes.ClearVariable,
                variableName: 'SpellBeingCast',
                actionId: nanoid(),
            } );

            if ( this.cancelTimerIfTargetDies ) {
                buffTimer.endEarlyPhrases.push( <Phrase>{
                    phraseId: nanoid(),
                    // You have been slain by a lightning warrior staticfist!
                    phrase: '^You have been slain by (.+?)!',
                    useRegEx: true,
                } );
                buffTimer.endEarlyPhrases.push( <Phrase>{
                    phraseId: nanoid(),
                    // You have been slain by a lightning warrior staticfist!
                    phrase: '^' + this.spell.effectFades.replace(/\.$/, '\\.$'),
                    useRegEx: true,
                } );
            }
        }

        // if ( this.alertWhenBuffFades && !this.useTimer ) {
            
        //     let fadeFromYou = nanoid();
        //     trigger.capturePhrases.push( <CapturePhrase>{
        //         phraseId: fadeFromYou,
        //         useRegEx: true,
        //         requirePreviousPhrase: false,
        //         duration: null,
        //         // /^(?<target>You) feel armored\.$/
        //         phrase: '^' + this.spell.effectFades.replace( /\.$/, '\\.$' ),
        //     } );

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
        //     phrase: this.spell.castOnOther.replace(/\.$/, '\\.$').replace( /soandso's|soandso\s's|soandso/gmi, '^(?<target>.+?)\'?s?' ),
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
