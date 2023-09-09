import { ActionTypes, CapturePhrase, Phrase, TimerRestartBehaviors, TriggerAction, TriggerModel } from '../core.model';
import { GinaConfiguration, GinaTimerStartBehaviors, GinaTimerTypes, GinaToNagOverlay, GinaTrigger } from '../gina.model';
import { customAlphabet } from 'nanoid';
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const nanoid = customAlphabet( alphabet, 16 );
import * as _ from 'lodash-es';
import { forkJoin, Observable, Observer } from 'rxjs';
import { IpcService } from '../ipc.service';
import { nagId } from '../core/nag-id.util';

enum CaptureMethods {
    Any = 'Any match',
    Sequential = 'Sequential',
    Concurrent = 'Concurrent',
}

export class GinaImporter {
    public static GetTrigger( gina: GinaTrigger, ipcService: IpcService, detrimentalOverlayId: string|null = null, beneficialOverlayId: string|null = null, alertOverlayId: string|null = null, ginaConfig: GinaConfiguration | null = null ): Observable<TriggerModel> {
        let obs: Observable<TriggerModel> = new Observable<TriggerModel>( ( observer: Observer<TriggerModel> ) => {

            let trigger = new TriggerModel();
            let tasks: Observable<any>[] = [];

            // General information
            trigger.triggerId = nagId();
            trigger.name = gina.Name;
            trigger.comments = gina.Comments;
            trigger.captureMethod = CaptureMethods.Any;
    
            // Capture phrase
            trigger.capturePhrases = [];
            // Gina triggers always trigger from a single phrase.
            let phraseId = nanoid();
            trigger.capturePhrases.push( <CapturePhrase>{
                phraseId: phraseId,
                useRegEx: gina.EnableRegex === 'True',
                requirePreviousPhrase: false,
                duration: null,
                phrase: gina.TriggerText,
            } );
    
            // Actions
            trigger.actions = [];
            let ginaCategory = ginaConfig?.Categories?.Category?.find( f => f.Name == gina.Category ) ?? null;
            let textOverlayId = alertOverlayId;
            let timerOverlayId = detrimentalOverlayId;

            // Display Text action
            if ( gina.UseText === 'True' ) {
                trigger.actions.push( <TriggerAction>{
                    phrases: [ phraseId ],
                    actionType: ActionTypes.DisplayText,
                    overlayId: textOverlayId,
                    duration: 6,
                    actionId: nanoid(),
                    displayText: gina.DisplayText,
                } );
            }
            if ( gina.CopyToClipboard === 'True' ) {
                trigger.actions.push( <TriggerAction>{
                    phrases: [ phraseId ],
                    actionType: ActionTypes.Clipboard,
                    overlayId: null,
                    duration: null,
                    actionId: nanoid(),
                    displayText: gina.ClipboardText,
                } );
            }
            if ( gina.UseTextToVoice === 'True' ) {
                trigger.actions.push( <TriggerAction>{
                    phrases: [ phraseId ],
                    actionType: ActionTypes.Speak,
                    overlayId: null,
                    duration: null,
                    actionId: nanoid(),
                    displayText: gina.TextToVoiceText,
                } );
            }
            if ( gina.PlayMediaFile === 'True' ) {
                let importObs = ipcService.importAudioFile( gina.MediaFileName );
                tasks.push( importObs );
                importObs.subscribe( fileId => {
                    if ( fileId ) {
                        trigger.actions.push( <TriggerAction>{
                            phrases: [ phraseId ],
                            actionType: ActionTypes.PlayAudio,
                            overlayId: null,
                            duration: null,
                            actionId: nanoid(),
                            displayText: null,
                            audioFileId: fileId,
                        } );
                    }
                } );
            }
            if ( gina.TimerType != GinaTimerTypes.NoTimer ) {
                let timerAction = new TriggerAction();

                timerAction.phrases = [ phraseId ];
                timerAction.actionId = nanoid();
                timerAction.displayText = gina.TimerName;
                timerAction.overlayId = timerOverlayId;
                
                if ( gina.TimerType === GinaTimerTypes.Timer ) {
                    // Gina doesn't appear to have a timer that goes from empty to full.
                    timerAction.actionType = ActionTypes.Countdown;
                    timerAction.duration = +gina.TimerDuration;

                } else if ( gina.TimerType === GinaTimerTypes.RepeatingTimer ) {
                    timerAction.actionType = ActionTypes.Countdown;
                    timerAction.duration = +gina.TimerDuration;
                    timerAction.repeatTimer = true;
                    timerAction.repeatCount = null;

                } else if ( gina.TimerType === GinaTimerTypes.Stopwatch ) {
                    timerAction.actionType = ActionTypes.Stopwatch;
                    timerAction.duration = null;

                }

                if ( gina.TimerStartBehavior === GinaTimerStartBehaviors.RestartTimer && gina.RestartBasedOnTimerName === 'True' ) {
                    timerAction.restartBehavior = TimerRestartBehaviors.RestartOnDuplicate;

                } else if ( gina.TimerStartBehavior === GinaTimerStartBehaviors.RestartTimer && gina.RestartBasedOnTimerName !== 'True' ) {
                    timerAction.restartBehavior = TimerRestartBehaviors.RestartTimer;

                } else if ( gina.TimerStartBehavior === GinaTimerStartBehaviors.IgnoreIfRunning ) {
                    timerAction.restartBehavior = TimerRestartBehaviors.DoNothing;

                } else {
                    timerAction.restartBehavior = TimerRestartBehaviors.StartNewTimer;
                }

                timerAction.endEarlyPhrases = [];
                if ( gina.TimerEarlyEnders?.EarlyEnder?.length > 0 ) {
                    gina.TimerEarlyEnders.EarlyEnder.forEach( t => {
                        timerAction.endEarlyPhrases.push( <Phrase>{
                            phraseId: nanoid(),
                            phrase: t.EarlyEndText,
                            useRegEx: t.EnableRegex === 'True',
                        } );
                    } );
                }

                timerAction.ifEndingSoon = gina.UseTimerEnding === 'True';
                if ( timerAction.ifEndingSoon ) {
                    
                    timerAction.endingDuration = +gina.TimerEndingTime;
                    timerAction.endingSoonDisplayText = gina.TimerEndingTrigger.UseText === 'True';
                    timerAction.endingSoonText = gina.TimerEndingTrigger.DisplayText;
                    timerAction.endingSoonTextDuration = 6;
                    timerAction.endingClipboard = false; // Not actually supported in GINA.
                    timerAction.endingClipboardText = null; // Not actually supported in GINA.
                    timerAction.endingSoonSpeak = gina.TimerEndingTrigger.UseTextToVoice === 'True';
                    timerAction.endingSoonSpeakPhrase = gina.TimerEndingTrigger.TextToVoiceText;
                    timerAction.endingSoonInterruptSpeech = gina.TimerEndingTrigger.InterruptSpeech === 'True';
                    timerAction.endingPlayAudio = gina.TimerEndingTrigger.PlayMediaFile === 'True';

                    if ( timerAction.endingPlayAudio ) {
                        let endingAudioTask = ipcService.importAudioFile( gina.TimerEndingTrigger.MediaFileName );
                        tasks.push( endingAudioTask );
                        endingAudioTask.subscribe( fileId => {
                            if ( fileId ) {
                                timerAction.endingPlayAudioFileId = fileId;
                            }
                        } );
                    }

                }

                timerAction.notifyWhenEnded = gina.UseTimerEnded === 'True';
                if ( timerAction.notifyWhenEnded ) {
                    
                    timerAction.endedDisplayText = gina.TimerEndedTrigger.UseText === 'True';
                    timerAction.endedText = gina.TimerEndedTrigger.DisplayText;
                    timerAction.endedTextDuration = 6;
                    timerAction.endedClipboard = false; // Not actually supported in GINA.
                    timerAction.endedClipboardText = null; // Not actually supported in GINA.
                    timerAction.endedSpeak = gina.TimerEndedTrigger.UseTextToVoice === 'True';
                    timerAction.endedSpeakPhrase = gina.TimerEndedTrigger.TextToVoiceText;
                    timerAction.endedInterruptSpeech = gina.TimerEndedTrigger.InterruptSpeech === 'True';
                    timerAction.endedPlayAudio = gina.TimerEndedTrigger.PlayMediaFile === 'True';

                    if ( timerAction.endedPlayAudio ) {
                        let endedAudioTask = ipcService.importAudioFile( gina.TimerEndedTrigger.MediaFileName );
                        tasks.push( endedAudioTask );
                        endedAudioTask.subscribe( fileId => {
                            if ( fileId ) {
                                timerAction.endedPlayAudioFileId = fileId;
                            }
                        } );
                    }
                    
                }

                trigger.actions.push( timerAction );
            }
            if ( gina.UseCounterResetTimer === 'True' ) {
                trigger.actions.push( <TriggerAction>{
                    phrases: [ phraseId ],
                    actionType: ActionTypes.Counter,
                    overlayId: timerOverlayId,
                    duration: +gina.CounterResetDuration,
                    actionId: nanoid(),
                    displayText: gina.Name,
                } );
            }
            
            if ( tasks?.length > 0 ) {
                forkJoin( tasks ).subscribe( results => {
                    observer.next( trigger );
                    observer.complete();
                } );
            } else {
                observer.next( trigger );
                observer.complete();
            }
            
        } );

        return obs;
    }
}
