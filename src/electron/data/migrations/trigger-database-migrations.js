const {
    ActionTypes,
    ImportTypes,
    TimerRestartBehaviors,
    TriggerStoreModel,
    TriggerFolder,
    ExternalDataSources,
} = require( '../models/trigger' );
const { backupDatafile } = require( './backup-data-file' );
const customAlphabet = require( 'nanoid' ).customAlphabet;
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const nanoid = customAlphabet( alphabet, 16 );

const currentTriggerDbVersion = 88;











/**
 * 
 * @param {TriggerStoreModel} data 
 * @param {string} configName
 * @param {(data: TriggerStoreModel) => void} migrationComplete Callback executed when data migration succeeds.
 */
function migrateTriggerData( data, configName, migrationComplete ) {
    
    if ( !data.version || data.version < currentTriggerDbVersion ) {
        backupDatafile( configName, () => {
            if ( executeDataMigration( data ) ) {
                migrationComplete( data );
            }
        } );
    }

}










/**
 * Recursively updates trigger folders and initializes folder conditions.
 * 
 * @param {TriggerFolder[]} folders The trigger folders to update.
 */
function createFolderConditions( folders ) {
    
    folders?.forEach( folder => {
        folder.folderConditions = folder.folderConditions?.length > 0 ? folder.folderConditions : [];
        createFolderConditions( folder?.children ?? [] );
    } );

}










/**
 * Performs the data migration.
 * 
 * @returns {boolean} Returns true if any migration was performed.
 * 
 * @param {TriggerStoreModel} data The data store model for triggers.
 */
function executeDataMigration( data ) {
    let startVersion = data.version ?? 0;

    if ( !data.version || data.version < 3 ) {
        data?.triggers?.forEach( f => {
            f.capturePhrases?.forEach( p => p.phraseId = p.phraseId == null ? nanoid() : p.phraseId );
        } );
        data.version = 3;
        
    }
    if ( data.version < 4 ) {
        data?.triggers?.forEach( f => {
            f.actions?.forEach( p => p.phrases = p.phraseId ? [ p.phraseId ] : p.phrases ?? [] );
        } );
        data.version = 4;
        
    }
    if ( data.version < 5 ) {
        data?.triggers?.forEach( trigger => {
            trigger.conditions = trigger.conditions ? trigger.conditions : [];
        } );
        data.version = 5;
        
    }
    if ( data.version < 6 ) {
        // Added spell level to dot timer triggers.
        data?.triggers?.forEach( trigger => {
            trigger.spellLevel = trigger.spellLevel > 0 ? trigger.spellLevel : 0;
        } );
        data.version = 6;
        
    }
    if ( data.version < 7 ) {
        data?.triggers?.forEach( trigger => {
            trigger.actions?.forEach( action => action.restartOnDuplicate = action.restartOnDuplicate === true || action.actionType === ActionTypes.DotTimer );
        } );
        data.version = 7;
        
    }
    if ( data.version < 8 ) {
        data?.triggers?.forEach( trigger => {
            trigger.predefined = trigger.predefined === true;
        } );
        data.version = 8;
        
    }
    if ( data.version < 9 ) {
        data?.triggers?.forEach( trigger => {
            trigger.onlyExecuteInDev = trigger.onlyExecuteInDev === true;
        } );
        data.version = 9;
        
    }
    if ( data.version < 10 ) {
        data?.triggers?.forEach( trigger => {
            trigger.actions?.forEach( action => action.onlyExecuteInDev = action.onlyExecuteInDev === true );
        } );
        data.version = 10;
        
    }
    if ( data.version < 11 ) {
        data?.triggers?.forEach( trigger => {
            trigger.actions?.forEach( action => action.overrideTimerColor = action.overrideTimerColor ? action.overrideTimerColor : null );
        } );
        data.version = 11;
        
    }
    // 12-13 were iterations on this update.
    if ( data.version < 14 ) {
        data?.triggers?.forEach( trigger => {
            trigger.actions?.forEach( action => {
                action.ifEndingSoon = action.ifEndingSoon === true;
                action.endingDuration = action.endingDuration ? action.endingDuration : null;
                action.endingSoonChangeColor = action.endingSoonChangeColor === true;
                action.endingSoonColor = action.endingSoonColor ? action.endingSoonColor : null;
                action.endingSoonBackgroundColor = action.endingSoonBackgroundColor ? action.endingSoonBackgroundColor : null;
            } );
        } );
        data.version = 14;
        
    }
    if ( data.version < 15 ) {
        data?.triggers?.forEach( trigger => {
            trigger.actions?.forEach( action => {

                action.endingSoonDisplayText = action.endingSoonDisplayText === true;
                action.endingSoonTextOverlayId = action.endingSoonTextOverlayId ? action.endingSoonTextOverlayId : null;
                action.endingSoonText = action.endingSoonText ? action.endingSoonText : null;
                action.endingSoonTextDuration = action.endingSoonTextDuration ? action.endingSoonTextDuration : null;

                action.endingSoonSpeak = action.endingSoonSpeak === true;
                action.endingSoonSpeakPhrase = action.endingSoonSpeakPhrase ? action.endingSoonSpeakPhrase : null;
                
                action.remainAfterEnded = action.remainAfterEnded === true;
                action.remainDuration = action.remainDuration ? action.remainDuration : null;

                action.endedDisplayText = action.endedDisplayText === true;
                action.endedTextOverlayId = action.endedTextOverlayId ? action.endedTextOverlayId : null;
                action.endedText = action.endedText ? action.endedText : null;
                action.endedTextDuration = action.endedTextDuration ? action.endedTextDuration : null;
                
                action.endedSpeak = action.endedSpeak === true;
                action.endedSpeakPhrase = action.endedSpeakPhrase ? action.endedSpeakPhrase : null;
            } );
        } );
        data.version = 15;
        
    }
    if ( data.version < 16 ) {
        data?.triggers?.forEach( trigger => {
            trigger.actions?.forEach( action => {
                action.endedChangeColor = action.endedChangeColor === true;
                action.endedColor = action.endedColor ? action.endedColor : null;
                action.endedBackgroundColor = action.endedBackgroundColor ? action.endedBackgroundColor : null;
            } );
        } );
        data.version = 16;
        
    }
    if ( data.version < 17 ) {
        data?.triggers?.forEach( trigger => {
            trigger.actions?.forEach( action => {
                action.timerIcon = action.timerIcon ?? null;
            } );
        } );
        data.version = 17;
        
    }
    if ( data.version < 18 ) {
        data?.triggers?.forEach( trigger => {
            trigger.actions?.forEach( action => {
                action.timerIconDef = action.timerIconDef ?? null;
            } );
        } );
        data.version = 18;
        
    }
    if ( data.version < 19 ) {
        data?.triggers?.forEach( trigger => {
            trigger.actions?.forEach( action => {
                action.showRemainingDuration = action.showRemainingDuration === true;
            } );
        } );
        data.version = 19;
        
    }
    if ( data.version < 20 ) {
        data?.triggers?.forEach( trigger => {
            trigger.actions?.forEach( action => {
                action.excludeTargets = action.excludeTargets ?? [];
            } );
        } );
        data.version = 20;
        
    }
    if ( data.version < 21 ) {
        data?.triggers?.forEach( trigger => {
            trigger.allakhazamUrl = trigger.allakhazamUrl ?? null;
        } );
        data.version = 21;
        
    }
    if ( data.version < 22 ) {
        data?.triggers?.forEach( trigger => {
            trigger.actions?.forEach( action => {
                action.endEarlyPhrases = action.endEarlyPhrases ?? [];
            } );
        } );
        data.version = 22;
        
    }
    if ( data.version < 23 ) {
        data?.triggers?.forEach( trigger => {
            delete trigger.spellLevel;
            trigger.classLevels = trigger.classLevels ?? [];
        } );
        data.version = 23;
        
    }
    if ( data.version < 24 ) {
        data.folders = data.folders ?? [];
        data.version = 24;
        
    }
    if ( data.version < 35 ) {
        data?.triggers?.forEach( trigger => {
            trigger.actions?.forEach( action => {
                action.name = action.name ?? null;
            } );
        } );
        data.version = 35;
        
    }
    if ( data.version < 35 ) {
        data?.triggers?.forEach( trigger => {
            trigger.actions?.forEach( action => {
                action.notifyWhenEnded = action.notifyWhenEnded === true;
            } );
        } );
        data.version = 35;
        
    }
    if ( data.version < 36 ) {
        data?.triggers?.forEach( trigger => {
            trigger.actions?.forEach( action => {
                action.resetCounterPhrases = action.resetCounterPhrases ?? [];
            } );
        } );
        data.version = 36;
        
    }
    if ( data.version < 37 ) {
        data?.triggers?.forEach( trigger => {
            trigger.actions?.forEach( action => {
                action.repeatTimer = action.repeatTimer === true;
                action.repeatCount = action.repeatCount ?? null;
            } );
        } );
        data.version = 37;

    }
    if ( data.version < 38 ) {
        data?.triggers?.forEach( trigger => {
            trigger.actions?.forEach( action => {
                action.endingClipboard = action.endingClipboard === true;
                action.endingClipboardText = action.endingClipboardText ?? null;
                action.endedClipboard = action.endedClipboard === true;
                action.endedClipboardText = action.endedClipboardText ?? null;
            } );
        } );
        data.version = 38;
        
    }
    if ( data.version < 39 ) {
        data?.triggers?.forEach( trigger => {
            trigger.actions?.forEach( action => {
                action.audioFileId = action.audioFileId ?? null;
            } );
        } );
        data.version = 39;
        
    }
    if ( data.version < 40 ) {
        data?.triggers?.forEach( trigger => {
            trigger.actions?.forEach( action => {
                action.onlyStoreUsedValues = action.onlyStoreUsedValues === true;
            } );
        } );
        data.version = 40;
        
    }
    if ( data.version < 42 ) {
        data?.triggers?.forEach( trigger => {
            trigger.ginaTriggerName = trigger.ginaTriggerName ?? null;
            trigger.importIdentifier = trigger.importIdentifier ?? null;
        } );
        data.version = 42;
        
    }
    if ( data.version < 44 ) {
        data.tags = data.tags || [];
        data.triggers.forEach( f => f.tagIds = f.tagIds ?? null );
        data.version = 44;
        
    }
    if ( data.version < 45 ) {
        data?.triggers?.forEach( trigger => {
            trigger.actions?.forEach( a => {
                a.restartTimerAlways = a.restartTimerAlways === true;
            } );
        } );
        data.version = 45;
        
    }
    if ( data.version < 46 ) {
        data?.triggers?.forEach( trigger => {
            trigger.actions?.forEach( a => {
                a.restartTimerNever = a.restartTimerNever === true;
            } );
        } );
        data.version = 46;
        
    }
    if ( data.version < 48 ) {
        data?.triggers?.forEach( trigger => {
            if ( !trigger.importType ) {
                if ( trigger.allakhazamUrl ) {
                    trigger.importType = ImportTypes.DotTimer;
                } else {
                    trigger.importType = ImportTypes.None;
                }
            }
        } );
        data.version = 48;
        
    }
    if ( data.version < 49 ) {
        data?.triggers?.forEach( trigger => {
            trigger.actions?.forEach( a => {
                a.hideTimer = a.hideTimer === true;
                a.endingSoonShowTimer = a.endingSoonShowTimer === true;
            } );
        } );
        data.version = 49;
        
    }
    if ( data.version < 50 ) {
        data?.triggers?.forEach( trigger => {
            trigger.actions?.forEach( a => {
                a.castTime = a.castTime ?? null;
            } );
        } );
        data.version = 50;
        
    }
    if ( data.version < 51 ) {
        data?.triggers?.forEach( trigger => {
            trigger.actions?.forEach( a => {
                a.hideConditions = a.hideConditions || [];
            } );
        } );
        data.version = 51;
        
    }
    if ( data.version < 52 ) {
        data?.triggers?.forEach( trigger => {
            trigger.actions?.forEach( a => {

                if ( !a.restartBehavior ) {
                    if ( a.actionType === ActionTypes.Timer || a.actionType === ActionTypes.DotTimer || a.actionType === ActionTypes.Countdown || a.actionType === ActionTypes.BeneficialTimer ) {
                        if ( a.restartOnDuplicate ) {
                            a.restartBehavior = TimerRestartBehaviors.RestartOnDuplicate;
                        } else if ( a.restartTimerAlways ) {
                            a.restartBehavior = TimerRestartBehaviors.RestartTimer;
                        } else if ( a.restartTimerNever ) {
                            a.restartBehavior = TimerRestartBehaviors.DoNothing;
                        } else {
                            a.restartBehavior = TimerRestartBehaviors.StartNewTimer;
                        }
                    } else {
                        a.restartBehavior = a.restartBehavior ?? null;
                    }
                }

                delete a.restartOnDuplicate;
                delete a.restartTimerAlways;
                delete a.restartTimerNever;

            } );
        } );
        data.version = 52;
        
    }
    if ( data.version < 53 ) {
        data?.triggers?.forEach( trigger => {
            trigger.useCooldown = trigger.useCooldown === true;
            trigger.cooldownDuration = trigger.cooldownDuration > 0 ? trigger.cooldownDuration : 0;
        } );
        
        data.version = 53;
        
    }
    if ( data.version < 54 ) {
        data?.triggers?.forEach( trigger => {
            trigger.actions?.forEach( action => {
                if ( action.actionType === ActionTypes.DisplayText ) {
                    
                    action.textUseCustomBorder = action.textUseCustomBorder === true;
                    action.textUseCustomColor = action.textUseCustomColor === true;
                    action.textUseCustomFont = action.textUseCustomFont === true;
                    action.textUseCustomGlow = action.textUseCustomGlow === true;
                    action.textUseCustomSize = action.textUseCustomSize === true;
                    action.textUseCustomWeight = action.textUseCustomWeight === true;

                }
            } );
        } );
        
        data.version = 54;
        
    }
    if ( data.version < 55 ) {
        data?.triggers?.forEach( trigger => {
            trigger.actions?.forEach( action => {
                if ( action.actionType === ActionTypes.DisplayText ) {
                    
                    delete action.textUseCustomWeight;

                }
            } );
        } );
        
        data.version = 55;
        
    }
    if ( data.version < 56 ) {
        data?.triggers?.forEach( trigger => {
            trigger.actions?.forEach( action => {
                if ( action.actionType === ActionTypes.DisplayText ) {
                    
                    action.loopBackForValue = action.loopBackForValue === true;

                }
            } );
        } );
        
        data.version = 56;
        
    }
    if ( data.version < 57 ) {
        data.installedPackages = data.installedPackages || [];

        data.version = 57;
        
    }
    if ( data.version < 59 ) {
        data?.triggers?.forEach( trigger => {
            trigger.enabled = trigger.enabled !== false;
        } );
        
        data.version = 59;
        
    }
    if ( data.version < 60 ) {
        data?.triggers?.forEach( trigger => {
            trigger.actions?.forEach( action => {
                action.onlyUseAaBeneficialFocus = action.onlyUseAaBeneficialFocus === true;
            } );
        } );
        
        data.version = 60;
        
    }
    if ( data.version < 61 ) {
        data?.triggers?.forEach( trigger => {
            trigger.actions?.forEach( action => {
                action.skipBenCastingTimeFocus = action.skipBenCastingTimeFocus === true;
            } );
        } );
        
        data.version = 61;
        
    }
    if ( data.version < 62 ) {
        data?.triggers?.forEach( trigger => {
            trigger.actions?.forEach( action => {
                action.variableStorageType = action.variableStorageType ?? 'localVariable';
            } );
        } );
        
        data.version = 62;
        
    }
    if ( data.version < 63 ) {
        data?.triggers?.forEach( trigger => {
            trigger.actions?.forEach( action => {
                action.sequentialRestartBehavior = action.sequentialRestartBehavior ?? 'none';
            } );
        } );
        
        data.version = 63;
        
    }
    if ( data.version < 64 ) {
        data?.triggers?.forEach( trigger => {
            trigger.sequentialRestartBehavior = trigger.sequentialRestartBehavior ?? 'none';
            trigger.actions?.forEach( action => {
                delete action.sequentialRestartBehavior;
            } );
        } );
        
        data.version = 64;
        
    }
    if ( data.version < 65 ) {
        data?.triggers?.forEach( trigger => {
            trigger.actions?.forEach( action => {
                action.storeLiteralDefinition = action.storeLiteralDefinition ?? null;
            } );
        } );
        
        data.version = 65;
        
    }
    if ( data.version < 66 ) {
        data?.triggers?.forEach( trigger => {
            trigger.actions?.forEach( action => {
                action.storageDuration = action.storageDuration ?? null;
            } );
        } );
        
        data.version = 66;
        
    }
    if ( data.version < 67 ) {
        data?.triggers?.forEach( trigger => {
            trigger.actions?.forEach( action => {
                action.remainUnlessEndedEarly = action.remainUnlessEndedEarly === true;
            } );
        } );
        
        data.version = 67;
        
    }
    if ( data.version < 68 ) {
        data.installedQuickShares = data.installedQuickShares || [];

        data.version = 68;
        
    }
    if ( data.version < 69 ) {
        data.packageOverlayMap = data.packageOverlayMap || {};

        data.version = 69;
        
    }
    if ( data.version < 70 ) {
        data.packageOverlays = data.packageOverlays || {};

        data.version = 70;
        
    }
    if ( data.version < 71 ) {
        data?.triggers?.forEach( trigger => {
            trigger.actions?.forEach( action => {
                action.endingSoonSubActions = action.endingSoonSubActions || [];
                action.endedSubActions = action.endedSubActions || [];
            } );
        } );
        
        data.version = 71;
        
    }
    // TODO: Find version 73. 72 is in hots-dots.  Change hots-dots from 72 to 76, and 73 to 77
    if ( data.version < 74 ) {
        data?.triggers?.forEach( trigger => {
            trigger.actions?.forEach( action => {
                action.speechVolume = action.speechVolume > 0 ? action.speechVolume : 100;
            } );
        } );
        
        data.version = 74;
        
    }
    if ( data.version < 75 ) {
        data?.triggers?.forEach( trigger => {
            trigger.actions?.forEach( action => {
                action.audioVolume = action.audioVolume > 0 ? action.audioVolume : 100;
            } );
        } );
        
        data.version = 75;
        
    }
    if ( data.version < 76 ) {
        createFolderConditions( data?.folders ?? [] );
        
        data.version = 76;
        
    }
    if ( data.version < 77 ) {
        data?.triggers?.forEach( trigger => {
            trigger.actions?.forEach( action => {
                action.secondaryPhrases = [];
            } );
        } );
        
        data.version = 77;
        
    }
    if ( data.version < 78 ) {
        data?.triggers?.forEach( trigger => {
            trigger.actions?.forEach( action => {
                action.speechRate = 1;
            } );
        } );
        
        data.version = 78;
        
    }
    if ( data.version < 79 ) {
        data?.triggers?.forEach( trigger => {
            trigger.actions?.forEach( action => {
                action.speakNext = false;
            } );
        } );
        
        data.version = 79;
        
    }
    if ( data.version < 80 ) {
        data?.triggers?.forEach( trigger => {
            if ( trigger.allakhazamUrl ) {
                trigger.externalSource = trigger.allakhazamUrl.indexOf( 'allakhazam.com' ) > -1 ? ExternalDataSources.Allakhazam : ExternalDataSources.EqSpellResources;
            } else {
                trigger.externalSource = undefined;
            }
        } );
        
        data.version = 80;
        
    }
    if ( data.version < 81 ) {

        data.successfulTriggerExecutions = [];
        data.failedTriggerExecutions = [];
        
        data.version = 81;
        
    }
    if ( data.version < 82 ) {

        data.successfulTriggerExecutions = data.successfulTriggerExecutions ?? [];
        data.failedTriggerExecutions = data.failedTriggerExecutions ?? [];

        data.successfulTriggerExecutions.forEach( execution => execution.parseId = nanoid() );
        data.failedTriggerExecutions.forEach( execution => execution.parseId = nanoid() );
        
        data.version = 83;
        
    }
    if ( data.version < 83 ) {

        if ( data.successfulTriggerExecutions ) {

            let output = [];
            let ids = Object.keys( data.successfulTriggerExecutions );

            ids.forEach( triggerId => {
                output = Array.prototype.concat( output, data.successfulTriggerExecutions[ triggerId ] );
            } );

            data.successfulTriggerExecutions = output;
            
        } else {
            data.successfulTriggerExecutions = [];
        }

        if ( data.failedTriggerExecutions ) {
            
            let output = [];
            let ids = Object.keys( data.failedTriggerExecutions );

            ids.forEach( triggerId => {
                output = Array.prototype.concat( output, data.failedTriggerExecutions[ triggerId ] );
            } );
            
            data.failedTriggerExecutions = output;

        } else {
            data.failedTriggerExecutions = [];
        }

        data.exceptionHistory = [];
        
        data.version = 83;
        
    }
    if ( data.version < 84 ) {

        data.successfulTriggerExecutions = [];
        data.failedTriggerExecutions = [];
        data.exceptionHistory = [];
        
        data.version = 84;
        
    }
    if ( data.version < 85 ) {

        data.triggers.forEach( trigger => {
            trigger.actions.forEach( action => {
                action.showDuration = action.showRemainingDuration;
            } );
        } );
        
        data.version = 85;
        
    }
    if ( data.version < 86 ) {

        data.triggers.forEach( trigger => {
            trigger.actions.forEach( action => {
                action.storeDuration = false;
            } );
        } );
        
        data.version = 86;
        
    }
    if ( data.version < 87 ) {
        //                                                           vslow, slow,  normal, fast, vfast
        // Changed the speaking rate from slider to specific values: 0.25,  0.50,  1.00,   1.50, 2.50
        data?.triggers?.forEach( trigger => {
            trigger.actions?.forEach( action => {
                if ( action.speechRate > 0 ) {
                    // Because we're using discrete values, we need to ensure that the previous values are mapped to the new values.
                    if ( action.speechRate >= 2 ) {
                        action.speechRate = 2.5;
                    } else if ( action.speechRate >= 1.25 ) {
                        action.speechRate = 1.5;
                    } else if (action.speechRate >= 0.75 ) {
                        action.speechRate = 1;
                    } else if ( action.speechRate > 0.37 ) {
                        action.speechRate = 0.5;
                    } else {
                        action.speechRate = 0.25;
                    }
                } else {
                    action.speechRate = 1;
                }
            } );
        } );
        
        data.version = 87;
        
    }
    if ( data.version < 88 ) {
        
        // Removed the slow and very slow rates, and tweaked the speaking rates to be more natural.

        //              Normal,    Fast,    Very Fast
        // New values:       1,    1.75,         2.25
        // Old values:       1,    1.50,         2.50

        data?.triggers?.forEach( trigger => {
            trigger.actions?.forEach( action => {

                if ( action.speechRate > 0 ) {
                    if ( action.speechRate >= 2.25 ) {
                        action.speechRate = 2.25;
                    } else if ( action.speechRate >= 1.25 ) {
                        action.speechRate = 1.75;
                    } else {
                        action.speechRate = 1;
                    }
                } else {
                    action.speechRate = 1;
                }
                
            } );
        } );
        
        data.version = 88;
        
    }

    return data.version !== startVersion;
}

module.exports = { migrateTriggerData, currentTriggerDbVersion };
