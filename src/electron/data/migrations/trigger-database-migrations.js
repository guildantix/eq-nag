const {
    ActionTypes,
    ImportTypes,
    TimerRestartBehaviors,
    TriggerStoreModel,
} = require( '../models/trigger' );
const { backupDatafile } = require( './backup-data-file' );
const customAlphabet = require( 'nanoid' ).customAlphabet;
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const nanoid = customAlphabet( alphabet, 16 );

const currentTriggerDbVersion = 75;











/**
 * 
 * @param {TriggerStoreModel} data 
 * @param {string} configName
 * @param {(data: TriggerStoreModel) => void} migrationComplete Callback executed when data migration succeeds.
 */
function migrateTriggerData( data, configName, migrationComplete ) {
    
    if ( data.version < currentTriggerDbVersion ) {
        backupDatafile( configName, () => {
            if ( executeDataMigration( data ) ) {
                migrationComplete( data );
            }
        } );
    }

}










/**
 * Performs the data migration.
 * 
 * @returns {boolean} Returns true if any migration was performed.
 * 
 * @param {TriggerStoreModel} data The data store model for triggers.
 */
function executeDataMigration( data ) {
    let startVersion = data.version;

    if ( !data.version || data.version < 3 ) {
        data?.triggers?.forEach( f => {
            f.capturePhrases?.forEach( p => p.phraseId = p.phraseId == null ? nanoid() : p.phraseId );
        } );
        data.version = 3;
        // this.storeDataFile( data );
    }
    if ( data.version < 4 ) {
        data?.triggers?.forEach( f => {
            f.actions?.forEach( p => p.phrases = p.phraseId ? [ p.phraseId ] : [] );
        } );
        data.version = 4;
        // this.storeDataFile( data );
    }
    if ( data.version < 5 ) {
        data?.triggers?.forEach( trigger => {
            trigger.conditions = trigger.conditions ? trigger.conditions : [];
        } );
        data.version = 5;
        // this.storeDataFile( data );
    }
    if ( data.version < 6 ) {
        // Added spell level to dot timer triggers.
        data?.triggers?.forEach( trigger => {
            trigger.spellLevel = 0;
        } );
        data.version = 6;
        // this.storeDataFile( data );
    }
    if ( data.version < 7 ) {
        data?.triggers?.forEach( trigger => {
            trigger.actions?.forEach( action => action.restartOnDuplicate = action.actionType === ActionTypes.DotTimer );
        } );
        data.version = 7;
        // this.storeDataFile( data );
    }
    if ( data.version < 8 ) {
        data?.triggers?.forEach( trigger => {
            trigger.predefined = false;
        } );
        data.version = 8;
        // this.storeDataFile( data );
    }
    if ( data.version < 9 ) {
        data?.triggers?.forEach( trigger => {
            trigger.onlyExecuteInDev = false;
        } );
        data.version = 9;
        // this.storeDataFile( data );
    }
    if ( data.version < 10 ) {
        data?.triggers?.forEach( trigger => {
            trigger.actions?.forEach( action => action.onlyExecuteInDev = false );
        } );
        data.version = 10;
        // this.storeDataFile( data );
    }
    if ( data.version < 11 ) {
        data?.triggers?.forEach( trigger => {
            trigger.actions?.forEach( action => action.overrideTimerColor = null );
        } );
        data.version = 11;
        // this.storeDataFile( data );
    }
    if ( data.version < 14 ) {
        // 12-13 were iterations on this update.
        data?.triggers?.forEach( trigger => {
            trigger.actions?.forEach( action => {
                action.ifEndingSoon = false;
                action.endingDuration = null;
                action.endingSoonChangeColor = false;
                action.endingSoonColor = null;
                action.endingSoonBackgroundColor = null;
            } );
        } );
        data.version = 14;
        // this.storeDataFile( data );
    }
    if ( data.version < 15 ) {
        data?.triggers?.forEach( trigger => {
            trigger.actions?.forEach( action => {

                action.endingSoonDisplayText = false;
                action.endingSoonTextOverlayId = null;
                action.endingSoonText = null;
                action.endingSoonTextDuration = null;

                action.endingSoonSpeak = false;
                action.endingSoonSpeakPhrase = null;
                
                action.remainAfterEnded = false;
                action.remainDuration = null;

                action.endedDisplayText = false;
                action.endedTextOverlayId = null;
                action.endedText = null;
                action.endedTextDuration = null;
                
                action.endedSpeak = false;
                action.endedSpeakPhrase = null;
            } );
        } );
        data.version = 15;
        // this.storeDataFile( data );
    }
    if ( data.version < 16 ) {
        // 12-13 were iterations on this update.
        data?.triggers?.forEach( trigger => {
            trigger.actions?.forEach( action => {
                action.endedChangeColor = false;
                action.endedColor = null;
                action.endedBackgroundColor = null;
            } );
        } );
        data.version = 16;
        // this.storeDataFile( data );
    }
    if ( data.version < 17 ) {
        data?.triggers?.forEach( trigger => {
            trigger.actions?.forEach( action => {
                action.timerIcon = null;
            } );
        } );
        data.version = 17;
        // this.storeDataFile( data );
    }
    if ( data.version < 18 ) {
        data?.triggers?.forEach( trigger => {
            trigger.actions?.forEach( action => {
                action.timerIconDef = null;
            } );
        } );
        data.version = 18;
        // this.storeDataFile( data );
    }
    if ( data.version < 19 ) {
        data?.triggers?.forEach( trigger => {
            trigger.actions?.forEach( action => {
                action.showRemainingDuration = false;
            } );
        } );
        data.version = 19;
        // this.storeDataFile( data );
    }
    if ( data.version < 20 ) {
        data?.triggers?.forEach( trigger => {
            trigger.actions?.forEach( action => {
                action.excludeTargets = [];
            } );
        } );
        data.version = 20;
        // this.storeDataFile( data );
    }
    if ( data.version < 21 ) {
        data?.triggers?.forEach( trigger => {
            trigger.allakhazamUrl = null;
        } );
        data.version = 21;
        // this.storeDataFile( data );
    }
    if ( data.version < 22 ) {
        data?.triggers?.forEach( trigger => {
            trigger.actions?.forEach( action => {
                action.endEarlyPhrases = [];
            } );
        } );
        data.version = 22;
        // this.storeDataFile( data );
    }
    if ( data.version < 23 ) {
        data?.triggers?.forEach( trigger => {
            delete trigger.spellLevel;
            trigger.classLevels = [];
        } );
        data.version = 23;
        // this.storeDataFile( data );
    }
    if ( data.version < 24 ) {
        data.folders = [];
        data.version = 24;
        // this.storeDataFile( data );
    }
    if ( data.version < 35 ) {
        data?.triggers?.forEach( trigger => {
            trigger.actions?.forEach( action => {
                action.name = null;
            } );
        } );
        data.version = 35;
        // this.storeDataFile( data );
    }
    if ( data.version < 35 ) {
        data?.triggers?.forEach( trigger => {
            trigger.actions?.forEach( action => {
                action.notifyWhenEnded = false;
            } );
        } );
        data.version = 35;
        // this.storeDataFile( data );
    }
    if ( data.version < 36 ) {
        data?.triggers?.forEach( trigger => {
            trigger.actions?.forEach( action => {
                action.resetCounterPhrases = [];
            } );
        } );
        data.version = 36;
        // this.storeDataFile( data );
    }
    if ( data.version < 37 ) {
        data?.triggers?.forEach( trigger => {
            trigger.actions?.forEach( action => {
                action.repeatTimer = false;
                action.repeatCount = null;
            } );
        } );
        data.version = 37;
        // this.storeDataFile( data );
    }
    if ( data.version < 38 ) {
        data?.triggers?.forEach( trigger => {
            trigger.actions?.forEach( action => {
                action.endingClipboard = false;
                action.endingClipboardText = null;
                action.endedClipboard = false;
                action.endedClipboardText = null;
            } );
        } );
        data.version = 38;
        // this.storeDataFile( data );
    }
    if ( data.version < 39 ) {
        data?.triggers?.forEach( trigger => {
            trigger.actions?.forEach( action => {
                action.audioFileId = null;
            } );
        } );
        data.version = 39;
        // this.storeDataFile( data );
    }
    if ( data.version < 40 ) {
        data?.triggers?.forEach( trigger => {
            trigger.actions?.forEach( action => {
                action.onlyStoreUsedValues = false;
            } );
        } );
        data.version = 40;
        // this.storeDataFile( data );
    }
    if ( data.version < 42 ) {
        data?.triggers?.forEach( trigger => {
            trigger.ginaTriggerName = null;
            trigger.importIdentifier = null;
        } );
        data.version = 42;
        // this.storeDataFile( data );
    }
    if ( data.version < 44 ) {
        data.tags = [];
        data.triggers.forEach( f => f.tagIds = null );
        data.version = 44;
        // this.storeDataFile( data );
    }
    if ( data.version < 45 ) {
        data?.triggers?.forEach( trigger => {
            trigger.actions?.forEach( a => {
                a.restartTimerAlways = false;
            } );
        } );
        data.version = 45;
        // this.storeDataFile( data );
    }
    if ( data.version < 46 ) {
        data?.triggers?.forEach( trigger => {
            trigger.actions?.forEach( a => {
                a.restartTimerNever = false;
            } );
        } );
        data.version = 46;
        // this.storeDataFile( data );
    }
    if ( data.version < 48 ) {
        data?.triggers?.forEach( trigger => {
            if ( trigger.allakhazamUrl ) {
                trigger.importType = ImportTypes.DotTimer;
            } else {
                trigger.importType = ImportTypes.None;
            }
        } );
        data.version = 48;
        // this.storeDataFile( data );
    }
    if ( data.version < 49 ) {
        data?.triggers?.forEach( trigger => {
            trigger.actions?.forEach( a => {
                a.hideTimer = false;
                a.endingSoonShowTimer = false;
            } );
        } );
        data.version = 49;
        // this.storeDataFile( data );
    }
    if ( data.version < 50 ) {
        data?.triggers?.forEach( trigger => {
            trigger.actions?.forEach( a => {
                a.castTime = null;
            } );
        } );
        data.version = 50;
        // this.storeDataFile( data );
    }
    if ( data.version < 51 ) {
        data?.triggers?.forEach( trigger => {
            trigger.actions?.forEach( a => {
                a.hideConditions = [];
            } );
        } );
        data.version = 51;
        // this.storeDataFile( data );
    }
    if ( data.version < 52 ) {
        data?.triggers?.forEach( trigger => {
            trigger.actions?.forEach( a => {

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
                    a.restartBehavior = null;
                }

                delete a.restartOnDuplicate;
                delete a.restartTimerAlways;
                delete a.restartTimerNever;

            } );
        } );
        data.version = 52;
        // this.storeDataFile( data );
    }
    if ( data.version < 53 ) {
        data?.triggers?.forEach( trigger => {
            trigger.useCooldown = false;
            trigger.cooldownDuration = 0;
        } );
        
        data.version = 53;
        // this.storeDataFile( data );
    }
    if ( data.version < 54 ) {
        data?.triggers?.forEach( trigger => {
            trigger.actions?.forEach( action => {
                if ( action.actionType === ActionTypes.DisplayText ) {
                    
                    action.textUseCustomBorder = false;
                    action.textUseCustomColor = false;
                    action.textUseCustomFont = false;
                    action.textUseCustomGlow = false;
                    action.textUseCustomSize = false;
                    action.textUseCustomWeight = false;

                }
            } );
        } );
        
        data.version = 54;
        // this.storeDataFile( data );
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
        // this.storeDataFile( data );
    }
    if ( data.version < 56 ) {
        data?.triggers?.forEach( trigger => {
            trigger.actions?.forEach( action => {
                if ( action.actionType === ActionTypes.DisplayText ) {
                    
                    action.loopBackForValue = false;

                }
            } );
        } );
        
        data.version = 56;
        // this.storeDataFile( data );
    }
    if ( data.version < 57 ) {
        data.installedPackages = [];

        data.version = 57;
        // this.storeDataFile( data );
    }
    if ( data.version < 59 ) {
        data?.triggers?.forEach( trigger => {
            trigger.enabled = true;
        } );
        
        data.version = 59;
        // this.storeDataFile( data );
    }
    if ( data.version < 60 ) {
        data?.triggers?.forEach( trigger => {
            trigger.actions?.forEach( action => {
                action.onlyUseAaBeneficialFocus = false;
            } );
        } );
        
        data.version = 60;
        // this.storeDataFile( data );
    }
    if ( data.version < 61 ) {
        data?.triggers?.forEach( trigger => {
            trigger.actions?.forEach( action => {
                action.skipBenCastingTimeFocus = false;
            } );
        } );
        
        data.version = 61;
        // this.storeDataFile( data );
    }
    if ( data.version < 62 ) {
        data?.triggers?.forEach( trigger => {
            trigger.actions?.forEach( action => {
                action.variableStorageType = 'localVariable';
            } );
        } );
        
        data.version = 62;
        // this.storeDataFile( data );
    }
    if ( data.version < 63 ) {
        data?.triggers?.forEach( trigger => {
            trigger.actions?.forEach( action => {
                action.sequentialRestartBehavior = 'none';
            } );
        } );
        
        data.version = 63;
        // this.storeDataFile( data );
    }
    if ( data.version < 64 ) {
        data?.triggers?.forEach( trigger => {
            trigger.sequentialRestartBehavior = 'none';
            trigger.actions?.forEach( action => {
                delete action.sequentialRestartBehavior;
            } );
        } );
        
        data.version = 64;
        // this.storeDataFile( data );
    }
    if ( data.version < 65 ) {
        data?.triggers?.forEach( trigger => {
            trigger.actions?.forEach( action => {
                action.storeLiteralDefinition = null;
            } );
        } );
        
        data.version = 65;
        // this.storeDataFile( data );
    }
    if ( data.version < 66 ) {
        data?.triggers?.forEach( trigger => {
            trigger.actions?.forEach( action => {
                action.storageDuration = null;
            } );
        } );
        
        data.version = 66;
        // this.storeDataFile( data );
    }
    if ( data.version < 67 ) {
        data?.triggers?.forEach( trigger => {
            trigger.actions?.forEach( action => {
                action.remainUnlessEndedEarly = false;
            } );
        } );
        
        data.version = 67;
        // this.storeDataFile( data );
    }
    if ( data.version < 68 ) {
        data.installedQuickShares = [];

        data.version = 68;
        // this.storeDataFile( data );
    }
    if ( data.version < 69 ) {
        data.packageOverlayMap = {};

        data.version = 69;
        // this.storeDataFile( data );
    }
    if ( data.version < 70 ) {
        data.packageOverlays = {};

        data.version = 70;
        // this.storeDataFile( data );
    }
    if ( data.version < 71 ) {
        data?.triggers?.forEach( trigger => {
            trigger.actions?.forEach( action => {
                action.endingSoonSubActions = [];
                action.endedSubActions = [];
            } );
        } );
        
        data.version = 71;
        // this.storeDataFile( data );
    }
    // TODO: Find version 73. 72 is in hots-dots.  Change hots-dots from 72 to 76, and 73 to 77
    if ( data.version < 74 ) {
        data?.triggers?.forEach( trigger => {
            trigger.actions?.forEach( action => {
                action.speechVolume = action.speechVolume > 0 ? action.speechVolume : 100;
            } );
        } );
        
        data.version = 74;
        // this.storeDataFile( data );
    }
    if ( data.version < 75 ) {
        data?.triggers?.forEach( trigger => {
            trigger.actions?.forEach( action => {
                action.audioVolume = action.audioVolume > 0 ? action.audioVolume : 100;
            } );
        } );
        
        data.version = 75;
        // this.storeDataFile( data );
    }

    return data.version !== startVersion;
}

module.exports = { migrateTriggerData, currentTriggerDbVersion };
