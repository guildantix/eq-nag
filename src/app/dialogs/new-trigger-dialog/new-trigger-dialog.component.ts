import { Component, OnInit, Inject } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { ActionTypes, CapturePhrase, OperatorTypes, OverlayWindowModel, TimerSortTypes, TriggerAction, TriggerCondition, TriggerConditionTypes, TriggerModel } from 'src/app/core.model';
import { IpcService } from 'src/app/ipc.service';
import { ScraperService } from 'src/app/scraper.service';
import { customAlphabet } from 'nanoid';
import { DialogService } from '../dialog.service';
import { SelectIconDialogComponent } from '../select-icon-dialog/select-icon-dialog.component';
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

    public get timerOverlays(): OverlayWindowModel[] {
        return this.overlays.filter( f => f.overlayType === 'Timer' );
    }

    constructor(
        public dialogRef: MatDialogRef<NewTriggerDialogComponent>,
        @Inject( MAT_DIALOG_DATA ) public data: any,
        public scraper: ScraperService,
        public ipcService: IpcService,
        public dialog: MatDialog ) { }

    ngOnInit(): void {
        this.ipcService.getOverlayWindows().subscribe( overlays => this.overlays = overlays );
        // this.data.message = this.data.message ? this.data.message : 'Are you sure?';
    }

    public scrape(): void {
        this.scraper.ScrapeAllakhazamSpell( this.url, this.characterClass ).subscribe( spell => {
            // console.log( 'output', spell, this.overlayId );

            let trigger: TriggerModel = new TriggerModel();
            trigger.name = spell.name;
            trigger.triggerId = nanoid();
            trigger.spellLevel = spell.level;
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
                phrase: `^(.*) has taken ([0-9]*) ?damage from your ${spell.name}\\.`,
            } );
            trigger.comments = `DoT timer for ${spell.name}.`;
            trigger.actions.push( <TriggerAction>{
                phrases: [ trigger.capturePhrases[ 1 ].phraseId ],
                actionType: ActionTypes.DotTimer,
                overlayId: this.overlayId,
                duration: spell.duration,
                actionId: nanoid(),
                restartOnDuplicate: true,
            } );
            trigger.actions.push( <TriggerAction>{
                phrases: [ trigger.capturePhrases[ 1 ].phraseId ],
                actionType: ActionTypes.ClearVariable,
                variableName: 'SpellBeingCast',
                actionId: nanoid(),
            } );
            trigger.captureMethod = 'Sequential';
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
                    this.ipcService.createNewTrigger( trigger ).subscribe( triggerId => { trigger.triggerId = triggerId; } );
                    this.dialogRef.close();
                } );

            } else {
                this.ipcService.createNewTrigger( trigger ).subscribe( triggerId => { trigger.triggerId = triggerId; } );
                this.dialogRef.close();
            }
        } );
    }
    
}
