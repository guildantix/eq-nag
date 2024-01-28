import { Component, Input, OnInit, ViewChild } from '@angular/core';
import { MatStepper } from '@angular/material/stepper';

import * as _ from 'lodash-es';

import { ActionTypes, OverlayWindowModel, TriggerAction, TriggerModel } from 'src/app/core.model';
import { DialogService } from 'src/app/dialogs/dialog.service';
import { IpcService } from 'src/app/ipc.service';

@Component( {
    selector: 'app-gina-import-stepper',
    templateUrl: 'gina-import-stepper.component.html',
    styleUrls: [ 'gina-import-stepper.component.scss', '../../core.scss', '../../modal.scss' ]
} )
export class GinaImportStepperComponent implements OnInit {

    @Input() public model: TriggerModel;
    @Input() public alertOverlays: OverlayWindowModel[];
    @Input() public timerOverlays: OverlayWindowModel[];

    public actionTypes: typeof ActionTypes = ActionTypes;
    public showMissingOverlays: boolean = false;
    public showDuplicatesCheck: boolean = false;
    
    @ViewChild( 'stepper', { static: false, read: MatStepper } ) public stepper: MatStepper;

    constructor( private dialogService: DialogService, private ipcService: IpcService ) { }

    ngOnInit() {
        
        let missingOverlays = _.some( this.model.actions, ( ac: TriggerAction ) => {
            if ( ac.actionType === ActionTypes.DisplayText ) {
                return ac.overlayId == null;
            } else if ( ac.actionType === ActionTypes.Countdown || ac.actionType === ActionTypes.DotTimer || ac.actionType === ActionTypes.Timer || ac.actionType === ActionTypes.Stopwatch || ac.actionType === ActionTypes.BeneficialTimer ) {
                return ( ac.overlayId == null || ( ac.ifEndingSoon && ac.endingSoonDisplayText && ac.endingSoonTextOverlayId == null ) || ( ac.notifyWhenEnded && ac.endedDisplayText && ac.endedTextOverlayId == null ) )
            }
        } );

        this.showMissingOverlays = missingOverlays;

        this.checkForDuplicates();
    }

    private checkForDuplicates(): void {
        
        let phrases = [];
        let speakText = [];
        let displayText = [];
        let clipboardText = [];

        this.model.capturePhrases.forEach( p => phrases.push( p.phrase ) );
        this.model.actions.forEach( action => {
            
            if ( action.actionType === ActionTypes.Speak ) {
                speakText.push( action.displayText );
            } else if ( action.actionType === ActionTypes.DisplayText ) {
                displayText.push( action.displayText );
            } else if ( action.actionType === ActionTypes.Clipboard ) {
                clipboardText.push( action.displayText );
            } else if ( action.actionType === ActionTypes.Countdown || action.actionType === ActionTypes.Timer || action.actionType === ActionTypes.DotTimer ) {
                displayText.push( action.displayText );
                if ( action.endingSoonDisplayText ) {
                    displayText.push( action.endingSoonText );
                }
                if ( action.endedDisplayText ) {
                    displayText.push( action.endedText );
                }
                if ( action.endingClipboard ) {
                    clipboardText.push( action.endingClipboardText );
                }
                if ( action.endedClipboard ) {
                    clipboardText.push( action.endedClipboardText );
                }
                if ( action.endingSoonSpeak ) {
                    speakText.push( action.endingSoonSpeakPhrase );
                }
                if ( action.endedSpeak ) {
                    speakText.push( action.endedSpeakPhrase );
                }
            }

        } );

        this.ipcService
            .searchTriggerProperties( phrases, speakText, displayText, clipboardText, this.model.name, this.model.comments )
            .subscribe( matches => {
                
                // if ( matches?.length > 0 ) {
                //     this.duplicateTriggers = matches;
                //     this.scrollingElement.nativeElement.scrollTop = 0;
                //     this.nTriggerTabs.selectedIndex = 3;
                // } else {
                //     this.importTrigger();
                // }
            } );
        
    }

    public alertMissingOverlays( overlayType: string ): void {
        this.dialogService.showErrorDialog( `Missing Overlays`, `Could not find an overlay of type [${overlayType}].` );
    }

    public autoAssignOverlays(): void {
        let allSelected = true;

        this.model?.actions?.forEach( ac => {
            if ( ac.overlayId == null && ac.actionType === ActionTypes.DisplayText ) {
                                    
                if ( this.alertOverlays?.length > 0 ) {
                    ac.overlayId = this.alertOverlays[ 0 ]?.overlayId;
                } else {
                    this.alertMissingOverlays( 'Alert Overlay' );
                    allSelected = false;
                    return;
                }

            } else if ( ac.actionType === ActionTypes.Countdown || ac.actionType === ActionTypes.DotTimer || ac.actionType === ActionTypes.Timer || ac.actionType === ActionTypes.Stopwatch || ac.actionType === ActionTypes.BeneficialTimer ) {
                                    
                if ( ac.overlayId == null ) {
                    if ( this.timerOverlays?.length > 0 ) {
                        ac.overlayId = this.timerOverlays[ 0 ]?.overlayId;
                    } else {
                        this.alertMissingOverlays( 'Timer Overlay' );
                        allSelected = false;
                        return;
                    }
                }

                if ( ac.ifEndingSoon && ac.endingSoonDisplayText && ac.endingSoonTextOverlayId == null ) {
                    if ( this.alertOverlays?.length > 0 ) {
                        ac.endingSoonTextOverlayId = this.alertOverlays[ 0 ]?.overlayId;
                    } else {
                        this.alertMissingOverlays( 'Alert Overlay' );
                        allSelected = false;
                        return;
                    }
                }

                if ( ac.notifyWhenEnded && ac.endedDisplayText && ac.endedTextOverlayId == null ) {
                    if ( this.alertOverlays?.length > 0 ) {
                        ac.endedTextOverlayId = this.alertOverlays[ 0 ]?.overlayId;
                    } else {
                        this.alertMissingOverlays( 'Alert Overlay' );
                        allSelected = false;
                        return;
                    }
                }
                                    
            }
        } );
        
        if ( allSelected ) {
            this.stepper.next();
        }
    }

}
