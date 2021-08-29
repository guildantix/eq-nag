// const ipc = require( 'electron' ).ipcMain;
const { ipcRenderer, ipcMain } = require( 'electron' );
const path = require( 'path' );
const process = require( 'process' );
const fs = require( 'fs' );
const DkpEntryModel = require( '../data/models/dkp-entry' );
const { TriggerAction, ActionTypes, TriggerConditionTypes, OperatorTypes, CharacterClassLevel } = require( '../data/models/trigger' );
const { PhraseParse, LogTrigger } = require( './log.model' );
const { OverlayComponent, OverlayWindow } = require( '../data/models/overlay-window' );
const CharacterModel = require( '../data/models/character' );
const customAlphabet = require( 'nanoid' ).customAlphabet;
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const nanoid = customAlphabet( alphabet, 16 );
const _ = require( 'lodash' );

const chokidar = require( "chokidar" );
const StringUtilities = require( '../utilities/string' );
const NumberUtilities = require( '../utilities/numbers' );
const FctModel = require( '../data/models/fct' );
const { DateUtilities } = require( '../utilities/dates' );
const chunkSize = 512 * 1024;
// const _timerId = '7d9j6ZX7p6c5NLMw';

var currentPosition = null;
var startLogPosition = null;

var watcher = null;
/** @type {OverlayWindow} */
var overlays = [];
/** @type {LogTrigger[]} */
var triggers = [];
/** @type {Record<string, string[]>} */
var storedVariables = {};
/** @type {Record<string, {value: number, lastUpdate: Date, resetDelay: number, _parse: (logEntry: string) => boolean}>} */
var counters = {};
/** @type {{_parse: (logEntry: string) => boolean, instanceId: string}} */
var cancellableComponents = [];
/** @type {Record<string, string[]>} */
var usedConditionValues = {};
var enableFct = false;
var damageDealtOverlayId = null;
var damageReceivedOverlayId = null;
var voiceOptions = [];
var voiceIndex = -1;
var logParseTimeoutId = null;
var logParseTimer = 50;
var changingLogFile = false;
var isDev = false;
/** @type {CharacterModel} */
var charModel = null;
var characterName = null;
/** @type {SpeechSynthesisUtterance[]} */
var utterances = [];
/** @type {Record<string, string>} */
var phoneticTransforms = {};
/** @type {Record<number, string[]>} */
var parsedLogEntries = {};

// Common errors: 
//  ${C} instead of {C}
//  ${CharacterName} isntead of ${Character}
//  ending with a '.' in regex instead of a '\.'
//  Forgetting to check the box for regex.
//  Choosing the wrong phrase for an action.
//      If the display text has {C} or {TS} in it, but the trigger phrase selected doesn't contain either option.










/**
 * Initializes the log watcher.
 * 
 * @param {CharacterModel} character The character details.
 * @param {number} logPosition The starting log position.
 */
function LogWatcher(character, logPosition) {
    
    if ( character ) {
        characterName = character.name;
        charModel = character;
    }
    saveScalarVariable( "Character", characterName );

    if ( logPosition >= 0 ) {
        startLogPosition = logPosition;
    }

    ipcRenderer.on( 'log:changed', function ( event, data ) {
        function startParsingLogFile() {
            fs.open( data, 'r', function ( err, fd ) {

                if ( fd ) {
                    var file = fd;
                    if ( startLogPosition != null && startLogPosition >= 0 ) {
                        currentPosition = startLogPosition;
                        startLogPosition = null;
                    }
                    currentPosition = currentPosition === null ? fs.fstatSync( file ).size : currentPosition;
                    function parseLogFile() {
                        var stats = fs.fstatSync( fd );
                        var file = fd;
        
                        // When another application deletes the file (Gina/GamParse).
                        if ( currentPosition > stats.size || !fs.existsSync( data ) ) {
                            
                            // Reset the current position.
                            currentPosition = null;

                            // Start over after logParseTimer milliseconds.
                            logParseTimeoutId = window.setTimeout( startParsingLogFile, logParseTimer );

                            return;
                        }
                            
                        fs.read( file, Buffer.alloc( stats.size - currentPosition ), 0, stats.size - currentPosition, currentPosition, ( err, bytecount, buff ) => {
                            
                            currentPosition += bytecount;
                            let read = buff.toString( 'utf-8', 0, bytecount );
                            let lines = read.split( /\r\n|\r|\n/gmi );
                            
                            lines.forEach( line => {
                                if ( line && line.length > 0 ) {
                                    parseLogEntries( line );
                                }
                            } );

                        } );

                        // Wait logParseTimer milliseconds and poll again.
                        if ( !changingLogFile ) {
                            logParseTimeoutId = window.setTimeout( parseLogFile, logParseTimer );
                        }
                    }

                    // Start polling the log file every logParseTimer milliseconds.
                    logParseTimeoutId = window.setTimeout( parseLogFile, logParseTimer );

                } else {
                    // If the log file was not found, then start over.
                    logParseTimeoutId = window.setTimeout( startParsingLogFile, logParseTimer );
                }
            } );
        }


        if ( logParseTimeoutId > 0 ) {
            window.clearTimeout( logParseTimeoutId );
            currentPosition = null;
            backfind( data, () => startParsingLogFile() );
        } else {
            changingLogFile = true;
            window.setTimeout( () => { 
                changingLogFile = false;
                currentPosition = null;
                backfind( data, () => startParsingLogFile() );
            }, logParseTimer );
        }

        if ( watcher != null ) {
            watcher.close();
        }
        
    } );

    ipcRenderer.on( 'log:simulate:file', function ( event, data ) {
        console.log( 'simulating log file', data );
        fs.open( data, 'r', function ( err, fd ) {
            var file = fd;
            var stats = fs.fstatSync( fd );
                    
                fs.read( file, Buffer.alloc( stats.size ), 0, stats.size, 0, ( err, bytecount, buff ) => {
                    let read = buff.toString( 'utf-8', 0, bytecount );
                    let lines = read.split( /\r\n|\r|\n/gmi );
                    lines.forEach( line => {
                        if ( line && line.length > 0 ) {
                            parseLogEntries( line, true );
                        }
                    } );
                    console.log( 'lines done' );
                } );

        } );
    } );

    ipcRenderer.on( 'log:parse:raw', function ( event, data ) {
        parseLogEntries( data );
    } );

    ipcRenderer.on( 'log:speak:phrase', function ( event, data ) {
        speakPhrase( data.phrase, data.interruptSpeech, null, false, data.parseResult, data.timerDuration );
    } );

    ipcRenderer.on( 'tick', function ( event, data ) {
        triggers = data.triggers;
        enableFct = data.enableFct;
        damageDealtOverlayId = data.damageDealtOverlayId;
        damageReceivedOverlayId = data.damageReceivedOverlayId;
        voiceIndex = data.voiceIndex;
        isDev = data.isDev;
        phoneticTransforms = data.phoneticTransforms;
        charModel = data.characterModel ? data.characterModel : charModel;
        overlays = data.overlays;
        // isDev = false;
        generateTriggerFns();
        initCounters();
    } );

    ipcRenderer.on( 'component:destroy', function ( event, instanceId ) {

        if ( cancellableComponents?.length > 0 ) {
            // Remove the cancelled items.
            _.remove( cancellableComponents, token => token.instanceId === instanceId );
        }

    } );

    ipcRenderer.on( 'log:check:pulse', function ( e ) {
        let activeCounters = false;

        if ( counters ) {
            for ( let key of Object.keys( counters ) ) {
                if ( counters[ key ].value > 0 ) {
                    activeCounters = true;
                    break;
                }
            }
        }

        if ( activeCounters || cancellableComponents?.length > 0 ) {
            // We're still alive, don't kill us!
            e.sender.send( 'log:pulse', true );
        } else {
            // Flatline
            e.sender.send( 'log:pulse', false );
        }

    } );

    speechSynthesis.onvoiceschanged = () => {
        voiceOptions = speechSynthesis.getVoices();
    };
}










/**
 * Initializes all counter trigger actions.
 */
function initCounters() {
    counters = {};
    triggers?.forEach( trigger => {
        if ( ( isDev || !trigger.onlyExecuteInDev ) && trigger.capturePhrases?.length > 0 ) {
            trigger.actions?.forEach( action => {
                if ( action.actionType === ActionTypes.Counter ) {
                    let resetsOnPhrases = action.resetCounterPhrases?.length > 0;
                    let renderedPhrases = resetsOnPhrases ? renderPhrases( action.resetCounterPhrases ) : [];
                    counters[ action.displayText ] = {
                        value: 0,
                        lastUpdate: new Date(),
                        resetDelay: action.duration,
                        _parse: logEntry => {
                            if ( resetsOnPhrases ) {
                                let matched = false;
                                
                                renderedPhrases.forEach( phrase => {
                                    let _res = new RegExp( phrase, 'g' ).exec( logEntry );
                                    if ( _res?.length > 0 ) {
                                        matched = true;
                                    }
                                } );
    
                                return matched;
                            } else {
                                return false;
                            }
                        }
                    };
                }
            } );
        }
    } );
}










/**
 * Pre-generate parse functions for each trigger.
 */
function generateTriggerFns() {
    triggers?.forEach( trigger => {
        if ( ( isDev || !trigger.onlyExecuteInDev ) && trigger.capturePhrases?.length > 0 ) {

            // First we generate parse functions for each capture phrase in the trigger.
            /** @type {((value: string, hasGroups: boolean, matchGroups: Record<string, string>) => PhraseParse)[]} */
            let _phraseParsers = [];

            /** @type {{groups: Record<string, string>, hasGroups: boolean, captureIndex: number}[]} */
            let _sequentialMatchs = [];

            trigger.capturePhrases?.forEach( phrase => {

                // Only create parse functions for phrases that have content.
                if ( phrase.phrase?.length > 0 ) {
                    if ( phrase.useRegEx ) {
                        // Use different parse functions for regex vs normal.
                        _phraseParsers.push( ( value, hasGroups, matchGroups ) => {
                            let rgxValue = phrase.phrase;

                            rgxValue = StringUtilities.parseShortCodesToRegex( rgxValue, characterName );
                            rgxValue = StringUtilities.parseStoredVariablesToRegex( rgxValue, storedVariables );

                            if ( hasGroups === true ) {
                                rgxValue = StringUtilities.parseSequentialGroups( rgxValue, matchGroups );
                            }
                            
                            let _res = new RegExp( rgxValue, 'gi' ).exec( value );
                            return {
                                phraseId: phrase.phraseId,
                                match: _res?.length > 0,
                                result: _res
                            };
                        } );
                    } else {
                        _phraseParsers.push( ( value, hasGroups, matchGroups ) => {
                            if ( value?.length > 0 ) {
                                // We won't care about case sensitivity.
                                let _phrs = StringUtilities.parseStoredVariablesToLiteralArray( phrase.phrase, storedVariables );
                                let matched = false;

                                if ( _phrs?.length > 0 ) {
                                    for ( let i = 0; i < _phrs.length; i++ ) {
                                        if ( value.toLowerCase().indexOf( _phrs[ i ].toLowerCase() ) > -1 ) {
                                            matched = true;
                                            break;
                                        }
                                    }
                                }

                                return {
                                    phraseId: phrase.phraseId,
                                    match: matched,
                                    result: [ value ]
                                };
                            } else {
                                return {
                                    match: false,
                                    result: []
                                };
                            }
                        } );
                    }
                }
            } );

            /** @type {Record<string, string[]>} */
            let _conditionValues = {};
            trigger.conditions?.forEach( condition => {
                if ( condition.variableValue ) {
                    _conditionValues[ condition.variableName ] = condition.variableValue.split( /\|/gi ) ?? [];
                    _conditionValues[ condition.variableName ].forEach( v => v = v?.trim() );
                } else {
                    _conditionValues[ condition.variableName ] = null;
                }
            } );

            /**
             * Returns true if all conditions are passed.
             * @returns {boolean}
             */
            trigger._checkConditions = function () {
                let conditionsPassed = true;

                if ( trigger._onCooldown ) {
                    // If the trigger is on cooldown, determine if the trigger must remain on cooldown.
                    let ellapsedCooldown = DateUtilities.timeSince( trigger._cooldownStart, new Date() );
                    if ( ellapsedCooldown.totalSeconds > trigger.cooldownDuration ) {
                        trigger._onCooldown = false;
                    }

                    return !trigger._onCooldown;
                }

                trigger._conditionResults = {};

                // The trigger must pass each condition.
                trigger.conditions?.forEach( condition => {
                    if ( condition.conditionType === TriggerConditionTypes.VariableValue ) {
                        if ( condition.operatorType === OperatorTypes.Equals ) {
                            
                            let storedValue = storeHasValue( condition.variableName, _conditionValues[ condition.variableName ] );

                            if ( !storedValue.exists ) {
                                conditionsPassed = false;
                            } else {
                                // Store what value passed.
                                trigger._conditionResults[ condition.variableName ] = storedValue.value;
                            }
                            
                        } else if ( condition.operatorType === OperatorTypes.IsNull ) {

                            if ( storedVariables[ condition.variableName ]?.length > 0 ) {
                                conditionsPassed = false;
                            } else {
                                // Store the condition result for this key as null.
                                trigger._conditionResults[ condition.variableName ] = null;
                            }

                        } else if ( condition.operatorType === OperatorTypes.DoesNotEqual ) {

                            let storedValue = storeHasValue( condition.variableName, _conditionValues[ condition.variableName ] );
                            
                            if ( _conditionValues[ condition.variableName ] && storedValue.exists ) {
                                // If the condition value is not null, then check if the store has that value.
                                conditionsPassed = false;
                            } else if ( _conditionValues[ condition.variableName ] == null && ( storedVariables[ condition.variableName ] == null || storedVariables[ condition.variableName ]?.length == 0 ) ) {
                                // If the condition value is null, then check to make sure that the stored value(s) have at least 1 value;
                                //  ex: If CurrentZone == null and the condition requires that CurrentZone DoesNotEqual Null
                                conditionsPassed = false;
                            } else {
                                // Store what value passed.
                                trigger._conditionResults[ condition.variableName ] = storedValue.value;
                            }

                        }
                    }
                } );

                return conditionsPassed;
            }

            // Grab condition values and store them
            trigger.conditions.forEach( condition => {
                if ( !StringUtilities.isNullOrWhitespace( condition.variableValue ) ) {
                    let values = condition.variableValue.split( /\|/gi ) ?? [];
                    usedConditionValues[ condition.variableName ] = usedConditionValues[ condition.variableName ] ? usedConditionValues[ condition.variableName ] : [];
                    for ( let i = 0; i < values?.length; i++ ) {
                        if ( usedConditionValues[ condition.variableName ].indexOf( values[ i ] ) == -1 ) {
                            usedConditionValues[ condition.variableName ].push( values[ i ] );
                        }
                    }
                }
            } );
            
            // Any match.
            if ( trigger.captureMethod === 'Any match' ) {

                trigger._reset = () => { };
                /**
                 * Parses the given log entry and executes a callback when a match is found.
                 * 
                 * @param {string} value The full log entry sans timestamp.
                 * @param {(match: PhraseParse) => void} onMatch This callback is executed when a match is identified.
                 */
                trigger._parse = ( value, onMatch ) => {

                    // If all conditions passed, then parse the phrase.
                    if ( trigger._checkConditions() ) {
                        for ( let i = 0; i < _phraseParsers?.length; i++ ) {
                            let _res = _phraseParsers[ i ]( value );
                            if ( _res?.match ) {
                                onMatch( _res );
                            }
                        }
                    }
                    
                };

            } else if ( trigger.captureMethod === 'Sequential' ) {
                
                trigger._reset = forceReset => {
                    forceReset = forceReset === true ? true : false;
                    _.remove( _sequentialMatchs, m => forceReset || m.captureIndex >= _phraseParsers?.length );
                };

                /**
                 * Parses the given log entry and executes a callback when a match is found.
                 * 
                 * @param {string} value The full log entry sans timestamp.
                 * @param {(match: PhraseParse) => void} onMatch This callback is executed when a match is identified.
                 */
                trigger._parse = ( value, onMatch ) => {

                    if ( trigger._checkConditions() ) {

                        let _res = _phraseParsers[ 0 ]( value );

                        if ( _res?.match ) {
                            let _newSeqMatch = {
                                groups: {},
                                hasGroups: false,
                                captureIndex: 1,
                            };

                            let groupKeys = _res.result?.groups ? Object.keys( _res.result.groups ) : [];
                            if ( groupKeys.length > 0 ) {
                                for ( let key of groupKeys ) {
                                    _newSeqMatch.groups[ key ] = _res.result.groups[ key ];
                                }
                            }

                            _newSeqMatch.hasGroups = groupKeys?.length > 0;

                            _sequentialMatchs.push( _newSeqMatch );

                            onMatch( _res );

                        }
                            
                        if ( _sequentialMatchs?.length > 0 ) {
                            for ( let i = 0; i < _sequentialMatchs.length; i++ ) {
                                if ( _sequentialMatchs[ i ].captureIndex < _phraseParsers?.length ) {
                                    let _res = _phraseParsers[ _sequentialMatchs[ i ].captureIndex ]( value, _sequentialMatchs[ i ].hasGroups, _sequentialMatchs[ i ].groups );
                                        
                                    if ( _res?.match ) {
                                        _sequentialMatchs[ i ].captureIndex += 1;
                                            
                                        let groupKeys = _res.result?.groups ? Object.keys( _res.result.groups ) : [];
                                        if ( groupKeys.length > 0 ) {
                                            for ( let key of groupKeys ) {
                                                _sequentialMatchs[ i ].groups[ key ] = _res.result.groups[ key ];
                                            }
                                        }
                
                                        _sequentialMatchs[ i ].hasGroups = _sequentialMatchs[ i ].hasGroups || groupKeys.length > 0;
                
                                        onMatch( _res );
                                        
                                    }
                                }
                            }
                        }
                        
                    } else {
                        // If the conditions are no longer met, then forcefully reset all possible match groups.
                        trigger._reset( true );
                        
                    }

                };

            } else {
                // Currently, 'Concurrent' is not supported/implemented.
                trigger._reset = () => { };
                trigger._parse = ( value, onMatch ) => { };
            }

        } else {
            // if the trigger is missing capture phrases, then do nothing.
            trigger._reset = () => { };
            trigger._parse = ( value, onMatch ) => { };
        }
    } );
}










/**
 * Parses the given log entry.
 * 
 * @param {string} raw The raw log entry.
 * @param {boolean} simulating If true, only simulates executing triggers via a consol.log call.
 */
function parseLogEntries( raw, simulating ) {
    
    simulating = simulating === true ? true : false;

    // let rgxTrigger = /grats;/gi;
    let rgxTimestamp = /^\[(.*?)\]\s*/gi;
    // let rgxGrabText = /\'(.*?)\'$/gi;
    // let rgxDelimiter = /;/gi;
    // let rgxNum = /(\d+)/gi;
    let rgxCombatText = /hit|damage|miss|dodge|riposte|parry|become better|backstab|stun|attack/gi;
    let rgxFctCritical = /\. \(.*(Critical).*\)/gi;
    
    let fctRegExs = [
        // 0: rgxMelee
        /You ([a-zA-Z0-9_]*) (.*) for ([0-9]*) points of damage\./gi,
        // 1: rgxMeleeMiss
        /You try to ([a-zA-Z0-9_]*) (.*),/gi,
        // 2: rgxSpellDmg
        /(.*) has taken ([0-9]*) damage from your (.*)\./gi,
        // 3: rgxThorns
        /(.*) is pierced by YOUR thorns for ([0-9]*) points of non-melee damage\./gi,
        // 4: rgxSkillUp
        /You have become better at ([a-zA-Z0-9_]*)! \(([0-9]*)\)/gi,
        // 5: rgxTakeMeleeDmg
        /(.*) ([a-zA-Z0-9_]*) YOU for ([0-9]*) points of damage\./gi,
        // 6: rgxAvoidMeleeDmg
        /(.*) tries to ([a-zA-Z0-9_]*) YOU, but ([a-zA-Z0-9_\s]*)/gi,
        // 7: rgxTakeSpellDmg
        /(.*) hit you for ([0-9]*) points of ([a-zA-Z0-9_]*) damage by (.*)\./gi,
        // 8: rgxSpellDmg
        /You ([a-zA-Z0-9_]*) (.*) for ([0-9]*) points of (.*) damage by (.*)\./gi,
    ];

    let timestamp = new Date( rgxTimestamp.exec( raw )[ 1 ] );

    if ( !timestamp || timestamp.length === 0 || timestamp.length === 1 )
        console.log( 'failed parse', raw );
    
    if ( enableFct && raw.match( rgxCombatText )?.length > 0 ) {
        for ( let i = 0; i < fctRegExs.length; i++ ) {
            let results = fctRegExs[ i ].exec( raw );
            
            if ( results && results.length > 1 ) {
                let model = new FctModel();
                model.dealt = ( i >= 0 && i <= 4 ) || i === 8 ? true : false;
                model.overlayId = model.dealt ? damageDealtOverlayId : damageReceivedOverlayId;

                if ( i === 0 ) {
                    /* --== My melee damage ==-- */
                    
                    let type = results[ 1 ];
                    let target = results[ 2 ];
                    let dmg = NumberUtilities.toShorthandString( results[ 3 ] );

                    model.text = `${dmg}`;
                    model.attack = type;

                } else if ( i === 1 ) {
                    /* --== My melee misses ==-- */
                    
                    let dmg = 'miss';

                    model.attack = 'Melee';
                    break;

                } else if ( i === 2 ) {
                    /* --== My spell hits ==-- */
                    
                    let target = results[ 1 ];
                    let dmg = NumberUtilities.toShorthandString( results[ 2 ] );
                    let spell = results[ 3 ];

                    model.text = `${dmg}`;
                    model.attack = spell;

                } else if ( i === 3 ) {
                    /* --== My thorns dmg ==-- */
                    
                    let target = results[ 1 ];
                    let dmg = NumberUtilities.toShorthandString( results[ 2 ] );

                    model.text = `${dmg}`;
                    model.attack = 'Thorns';

                } else if ( i === 4 ) {
                    /* --== My skill up ==-- */
                    
                    let skill = results[ 1 ];
                    let level = results[ 2 ];

                } else if ( i === 5 ) {
                    /* --== Melee damage taken ==-- */
                    
                    let attacker = results[ 1 ];
                    let type = results[ 2 ];
                    let dmg = NumberUtilities.toShorthandString( results[ 3 ] );

                    model.text = `${dmg}`;
                    model.attack = type;

                } else if ( i === 6 ) {
                    /* --== Me avoiding melee ==-- */
                    
                    let attacker = results[ 1 ];
                    let type = results[ 2 ];
                    let miss = results[ 3 ];

                    model.attack = type;
                    break;

                } else if ( i === 7 ) {
                    /* --== Me taking spell damage ==-- */
                    
                    let attacker = results[ 1 ];
                    let dmg = NumberUtilities.toShorthandString( results[ 2 ] );
                    let resist = results[ 3 ];
                    let spell = results[ 4 ];

                    model.text = `${dmg}`;
                    model.attack = spell;

                } else if ( i === 8 ) {
                    /* --== My spell hits ==-- */
                    
                    let target = results[ 2 ];
                    let dmg = NumberUtilities.toShorthandString( results[ 3 ] );
                    let spell = results[ 5 ];

                    model.text = `${dmg}`;
                    model.attack = spell;

                }

                model.critical = raw.match( rgxFctCritical );
                model.timestamp = timestamp;

                ipcRenderer.send( 'overlay:send:component', model );

                // leave the loop, we found the correct FCT type.
                break;

            } // if ( results && results.length > 1 )

        } // for ( let i = 0; i < fctRegExs.length; i++ )
        
    }
    
    let log = raw.replace( rgxTimestamp, '' );

    // If there are any cancellable actions, evaluate them here.
    if ( cancellableComponents?.length > 0 ) {
        let tokenIds = [];
        cancellableComponents.forEach( token => {
            if ( token._parse( log ) ) {
                // Broadcast the remove action.
                ipcRenderer.send( 'overlay:destroy:component', token.instanceId );

                // Mark the item for removal.
                tokenIds.push( token.instanceId );
            }
        } );

        // Remove the cancelled items.
        _.remove( cancellableComponents, token => tokenIds.indexOf( token.instanceId ) > -1 );
    }

    if ( counters ) {
        for ( let key of Object.keys( counters ) ) {

            // Skip counter reset conditions if the counter is at 0.
            if ( counters[ key ].value > 0 ) {

                // check how long the value has existed and reset it if that 
                // duration is greater than the reset delay specified by the 
                // user.
                let timeSinceLastUpdate = Math.abs( ( new Date() ) - counters[ key ].lastUpdate ) / 1000;
                if ( timeSinceLastUpdate >= counters[ key ].resetDelay ) {
                    counters[ key ].value = 0;
                    // If the timer is reset, no need to check the reset 
                    // phrases.
                    continue;
                }

                // Parse the current log entry for any reset phrase matches.
                if ( counters[ key ]._parse( log ) ) {
                    counters[ key ].value = 0;
                }
            }

        }
    }

    let entryMatched = false;
    triggers.forEach( trigger => {
        trigger._parse( log, res => {
            trigger.actions.forEach( action => {
                if ( ( isDev || !action.onlyExecuteInDev ) && ( action.phrases == null || action.phrases?.length === 0 || action.phrases?.indexOf( res.phraseId ) > -1 ) ) {
                    if ( action.actionType === ActionTypes.DisplayText ) {
                    /* --== Display Text ==-- */
                        
                        displayTextComponent( res, timestamp, action );
                        
                    } else if ( action.actionType === ActionTypes.PlayAudio ) {
                    /* --== Play Audio ==-- */
                        
                        playAudioFile( action.audioFileId );

                    } else if ( action.actionType === ActionTypes.Clipboard ) {
                    /* --== Copy text to clipboard ==-- */
                            
                        sendToClipboard( res, action, trigger._conditionResults );
                        
                    } else if ( action.actionType === ActionTypes.StoreVariable ) {
                    /* --== Store Variable ==-- */
                        
                        if ( res.result.length === 1 ) {
                            saveVariable( action.variableName, res.result[ 0 ], action.onlyStoreUsedValues );
                        } else {
                            saveVariable( action.variableName, res.result[ 1 ], action.onlyStoreUsedValues );
                        }

                    } else if ( action.actionType === ActionTypes.ClearVariable ) {
                    /* --== Clear Variable ==-- */

                        if ( res.result.groups && res.result.groups[ action.variableName ] ) {
                            clearStoredVariable( action.variableName, res.result.groups[ action.variableName ] );
                        } else if ( trigger._conditionResults && trigger._conditionResults[ action.variableName ] ) {
                            clearStoredVariable( action.variableName, trigger._conditionResults[ action.variableName ] );
                        } else {
                            clearAllStoredValuesInVariable( action.variableName );
                        }

                    } else if ( action.actionType === ActionTypes.Counter ) {
                    /* --== Clear Variable ==-- */

                        incrementCounter( action.displayText );
    
                    } else if ( action.actionType === ActionTypes.Timer || action.actionType === ActionTypes.Countdown ) {
                    /* --== Start a Timer/Countdown ==-- */
                        
                        displayTimerCountdownComponent( res, timestamp, action, trigger );

                    } else if ( action.actionType === ActionTypes.DotTimer ) {
                    /* --== DOT Timers ==-- */
                        
                        displayDotTimerComponent( res, timestamp, action, trigger );

                    } else if ( action.actionType === ActionTypes.BeneficialTimer ) {
                    /* --== Buff Timers ==-- */
                        
                        let spellName = trigger?._conditionResults?.SpellBeingCast;
                        let rgx = new RegExp( `^You begin casting ${spellName}\\.$`, 'gmi' );
                        let time = timestamp.getTime();
                        let _t = timestamp.getTime();
                        if ( action.castTime >= 3000 && charModel.hasBeneficialCastingSpeedFocus ) {
                            let tMod = calculateCastingMilliseconds( action.castTime, trigger.classLevels, charModel.beneficialCastingSpeedFocusPercent, charModel.beneficialCastingSpeedFocusDecayLevel );
                            time -= tMod;
                        } else {
                            time -= action.castTime;
                        }

                        let m = checkParseHistory( rgx, { time: [ time, time + 1000 ] } );
                        if ( m?.length > 0 ) {
                            action.displayText = spellName;
                            displayBeneficialTimerComponent( res, timestamp, action, trigger, spellName );
                        }

                    } else if ( action.actionType === ActionTypes.Speak ) {
                    /* --== TTS Speak ==-- */
                        let duration = null;

                        if ( res.result?.groups?.timerDuration ) {
                            duration = StringUtilities.getDurationFromLabel( res.result?.groups?.timerDuration );
                        } else if ( action.duration ) {
                            duration = +action.duration;
                        }

                        speakPhrase( action.displayText, action.interruptSpeech, trigger._conditionResults, simulating, res.result, duration );
                        
                    }
                }
            } );
            entryMatched = true;

            // If the trigger has a cooldown, start the cooldown now.
            if ( trigger.useCooldown ) {
                trigger._onCooldown = true;
                trigger._cooldownStart = new Date();
            }
        } );
    } );

    if ( entryMatched ) {
        let t = timestamp.getTime();
        parsedLogEntries[ t ] = parsedLogEntries[ t ]?.length > 0 ? parsedLogEntries[ t ] : [];
        parsedLogEntries[ t ].push( log );
    }

}










/**
 * Builds and sends a dot timer overlay component.
 * 
 * @param {PhraseParse} res The information from the parsed phrase.
 * @param {Date} timestamp The timestamp of the log entry.
 * @param {TriggerAction} action The trigger's display text action.
 * @param {LogTrigger} trigger If true the component is written to the console instead of sent to the overlay window.
 * @param {string} spellName The literal name of the spell that was cast.  This will usually include what rank the spell was.
 */
function displayBeneficialTimerComponent( res, timestamp, action, trigger, spellName ) {
    
    let comp = new OverlayComponent();

    comp.instanceId = nanoid();
    comp.triggerName = spellName;
    comp.action = Object.assign( new TriggerAction(), action );
    comp.action.displayText = `${spellName} --== ${res.result.groups.target} ==--`;
    comp.overlayId = action.overlayId;
    comp.matches = res.result;
    comp.timestamp = timestamp;
    comp.voiceIndex = voiceIndex;
    
    if ( comp.action.endingSoonDisplayText ) {
        comp.action.endingSoonText = StringUtilities.parseShortCodeValuesToLiteral( action.endingSoonText, characterName, comp.action.duration, res.result?.groups, res.result ? res.result[ 0 ] : null );
        comp.action.endingSoonText = StringUtilities.parseStoredVariablesToLiteral( comp.action.endingSoonText, storedVariables );
        comp.action.endingSoonText = StringUtilities.parseConditionResultsToLiteral( comp.action.endingSoonText, trigger._conditionResults );
        comp.action.endingSoonText = StringUtilities.parseCountersToLiteral( comp.action.endingSoonText, counters );
    }

    if ( comp.action.endingSoonSpeak ) {
        comp.action.endingSoonSpeakPhrase = StringUtilities.parseShortCodeValuesToLiteral( action.endingSoonSpeakPhrase, characterName, comp.action.duration, res.result?.groups, res.result ? res.result[ 0 ] : null );
        comp.action.endingSoonSpeakPhrase = StringUtilities.parseStoredVariablesToLiteral( comp.action.endingSoonSpeakPhrase, storedVariables );
        comp.action.endingSoonSpeakPhrase = StringUtilities.parseConditionResultsToLiteral( comp.action.endingSoonSpeakPhrase, trigger._conditionResults );
        comp.action.endingSoonSpeakPhrase = StringUtilities.parseCountersToLiteral( comp.action.endingSoonSpeakPhrase, counters );
    }

    if ( comp.action.endedDisplayText ) {
        comp.action.endedText = StringUtilities.parseShortCodeValuesToLiteral( action.endedText, characterName, comp.action.duration, res.result?.groups, res.result ? res.result[ 0 ] : null );
        comp.action.endedText = StringUtilities.parseStoredVariablesToLiteral( comp.action.endedText, storedVariables );
        comp.action.endedText = StringUtilities.parseConditionResultsToLiteral( comp.action.endedText, trigger._conditionResults );
        comp.action.endedText = StringUtilities.parseCountersToLiteral( comp.action.endedText, counters );
    }

    if ( comp.action.endedSpeak ) {
        comp.action.endedSpeakPhrase = StringUtilities.parseShortCodeValuesToLiteral( action.endedSpeakPhrase, characterName, comp.action.duration, res.result?.groups, res.result ? res.result[ 0 ] : null );
        comp.action.endedSpeakPhrase = StringUtilities.parseStoredVariablesToLiteral( comp.action.endedSpeakPhrase, storedVariables );
        comp.action.endedSpeakPhrase = StringUtilities.parseConditionResultsToLiteral( comp.action.endedSpeakPhrase, trigger._conditionResults );
        comp.action.endedSpeakPhrase = StringUtilities.parseCountersToLiteral( comp.action.endedSpeakPhrase, counters );
    }

    if ( charModel.hasExtendedBeneficialFocus ) {
        comp.action.duration += calculateAdditionalTicks( comp.action.duration, trigger.classLevels, charModel.extendedBeneficialFocusPercent, charModel.extendedBeneficialFocusDecayLevel ) * 6;
    }

    // reset the trigger.
    trigger._reset();

    ipcRenderer.send( 'overlay:send:component', comp );

    if ( comp.action.endEarlyPhrases?.length > 0 ) {
        let renderedPhrases = renderPhrases( comp.action.endEarlyPhrases, trigger._conditionResults, res.result );

        cancellableComponents.push( {
            _parse: ( logEntry ) => {
                let matched = false;
                
                renderedPhrases.forEach( phrase => {
                    let _res = new RegExp( phrase, 'g' ).exec( logEntry );
                    if ( _res?.length > 0 ) {
                        matched = true;
                    }
                } );

                return matched;
            },
            instanceId: comp.instanceId
        } );
    }

}










/**
 * Builds and sends a dot timer overlay component.
 * 
 * @param {PhraseParse} res The information from the parsed phrase.
 * @param {Date} timestamp The timestamp of the log entry.
 * @param {TriggerAction} action The trigger's display text action.
 * @param {LogTrigger} trigger If true the component is written to the console instead of sent to the overlay window.
 */
function displayDotTimerComponent( res, timestamp, action, trigger ) {
                        
    if ( action.excludeTargets?.length > 0 ) {
        for ( let i = 0; i < action.excludeTargets.length; i++ ) {
            let exclude = false;

            if ( action.excludeTargets[ i ].useRegEx ) {
                exclude = res.result[ 1 ].match( new RegExp( action.excludeTargets[ i ].phrase, 'g' ) )?.length > 0;
            } else {
                let _rgx = new RegExp( '^' + action.excludeTargets[ i ].phrase.replace( /[.*+?^${}()|[\]\\]/g, '\\$&' ) + '$', 'gi' );
                exclude = res.result[ 1 ].match( _rgx )?.length > 0;
            }

            if ( exclude ) {
                return;
            }
        }
    }
    
    // ${target} has been slain by (.+?)!
    let comp = new OverlayComponent();

    comp.instanceId = nanoid();
    comp.triggerName = trigger.name;
    comp.action = Object.assign( new TriggerAction(), action );
    comp.action.displayText = `${trigger.name} --== ${res.result.groups.target} ==--`;
    comp.overlayId = action.overlayId;
    comp.matches = res.result;
    comp.timestamp = timestamp;
    comp.voiceIndex = voiceIndex;
    
    if ( comp.action.endingSoonDisplayText ) {
        comp.action.endingSoonText = StringUtilities.parseShortCodeValuesToLiteral( action.endingSoonText, characterName, comp.action.duration, res.result?.groups, res.result ? res.result[ 0 ] : null );
        comp.action.endingSoonText = StringUtilities.parseStoredVariablesToLiteral( comp.action.endingSoonText, storedVariables );
        comp.action.endingSoonText = StringUtilities.parseConditionResultsToLiteral( comp.action.endingSoonText, trigger._conditionResults );
        comp.action.endingSoonText = StringUtilities.parseMatchesToLiteral( comp.action.endingSoonText, res.result );
        comp.action.endingSoonText = StringUtilities.parseCountersToLiteral( comp.action.endingSoonText, counters );
    }

    if ( comp.action.endingSoonSpeak ) {
        comp.action.endingSoonSpeakPhrase = StringUtilities.parseShortCodeValuesToLiteral( action.endingSoonSpeakPhrase, characterName, comp.action.duration, res.result?.groups, res.result ? res.result[ 0 ] : null );
        comp.action.endingSoonSpeakPhrase = StringUtilities.parseStoredVariablesToLiteral( comp.action.endingSoonSpeakPhrase, storedVariables );
        comp.action.endingSoonSpeakPhrase = StringUtilities.parseConditionResultsToLiteral( comp.action.endingSoonSpeakPhrase, trigger._conditionResults );
        comp.action.endingSoonSpeakPhrase = StringUtilities.parseMatchesToLiteral( comp.action.endingSoonSpeakPhrase, res.result );
        comp.action.endingSoonSpeakPhrase = StringUtilities.parseCountersToLiteral( comp.action.endingSoonSpeakPhrase, counters );
    }

    if ( comp.action.endingClipboard ) {
        comp.action.endingClipboardText = StringUtilities.parseShortCodeValuesToLiteral( action.endingClipboardText, characterName, comp.action.duration, res.result?.groups, res.result ? res.result[ 0 ] : null );
        comp.action.endingClipboardText = StringUtilities.parseStoredVariablesToLiteral( comp.action.endingClipboardText, storedVariables );
        comp.action.endingClipboardText = StringUtilities.parseConditionResultsToLiteral( comp.action.endingClipboardText, trigger._conditionResults );
        comp.action.endingClipboardText = StringUtilities.parseMatchesToLiteral( comp.action.endingClipboardText, res.result );
        comp.action.endingClipboardText = StringUtilities.parseCountersToLiteral( comp.action.endingClipboardText, counters );
    }

    if ( comp.action.endedDisplayText ) {
        comp.action.endedText = StringUtilities.parseShortCodeValuesToLiteral( action.endedText, characterName, comp.action.duration, res.result?.groups, res.result ? res.result[ 0 ] : null );
        comp.action.endedText = StringUtilities.parseStoredVariablesToLiteral( comp.action.endedText, storedVariables );
        comp.action.endedText = StringUtilities.parseConditionResultsToLiteral( comp.action.endedText, trigger._conditionResults );
        comp.action.endedText = StringUtilities.parseMatchesToLiteral( comp.action.endedText, res.result );
        comp.action.endedText = StringUtilities.parseCountersToLiteral( comp.action.endedText, counters );
    }

    if ( comp.action.endedSpeak ) {
        comp.action.endedSpeakPhrase = StringUtilities.parseShortCodeValuesToLiteral( action.endedSpeakPhrase, characterName, comp.action.duration, res.result?.groups, res.result ? res.result[ 0 ] : null );
        comp.action.endedSpeakPhrase = StringUtilities.parseStoredVariablesToLiteral( comp.action.endedSpeakPhrase, storedVariables );
        comp.action.endedSpeakPhrase = StringUtilities.parseConditionResultsToLiteral( comp.action.endedSpeakPhrase, trigger._conditionResults );
        comp.action.endedSpeakPhrase = StringUtilities.parseMatchesToLiteral( comp.action.endedSpeakPhrase, res.result );
        comp.action.endedSpeakPhrase = StringUtilities.parseCountersToLiteral( comp.action.endedSpeakPhrase, counters );
    }

    if ( comp.action.endedClipboard ) {
        comp.action.endedClipboardText = StringUtilities.parseShortCodeValuesToLiteral( action.endedClipboardText, characterName, comp.action.duration, res.result?.groups, res.result ? res.result[ 0 ] : null );
        comp.action.endedClipboardText = StringUtilities.parseStoredVariablesToLiteral( comp.action.endedClipboardText, storedVariables );
        comp.action.endedClipboardText = StringUtilities.parseConditionResultsToLiteral( comp.action.endedClipboardText, trigger._conditionResults );
        comp.action.endedClipboardText = StringUtilities.parseMatchesToLiteral( comp.action.endedClipboardText, res.result );
        comp.action.endedClipboardText = StringUtilities.parseCountersToLiteral( comp.action.endedClipboardText, counters );
    }

    if ( charModel.hasExtendedDotFocus ) {
        let percent = charModel.extendedDotFocusPercent;
        let charClassData = _.find( trigger.classLevels, ccl => ccl.class === charModel.class );

        if ( charClassData != null && charClassData.level > charModel.extendedDotFocusDecayLevel ) {
            let decayPercent = ( charClassData.level - charModel.extendedDotFocusDecayLevel ) * 5;
            percent = percent * ( 1 - decayPercent / 100 );
        }

        let baseTicks = comp.action.duration / 6;
        let addTicks = baseTicks * percent / 100;
        if ( addTicks < 1 )
            addTicks = Math.round( addTicks );
        else
            addTicks = Math.floor( addTicks );
        comp.action.duration += addTicks * 6;
        
    }

    // reset the trigger.
    trigger._reset();

    ipcRenderer.send( 'overlay:send:component', comp );

    if ( comp.action.endEarlyPhrases?.length > 0 ) {
        let renderedPhrases = renderPhrases( comp.action.endEarlyPhrases, trigger._conditionResults, res.result );

        cancellableComponents.push( {
            _parse: ( logEntry ) => {
                let matched = false;
                
                renderedPhrases.forEach( phrase => {
                    let _res = new RegExp( phrase, 'g' ).exec( logEntry );
                    if ( _res?.length > 0 ) {
                        matched = true;
                    }
                } );

                return matched;
            },
            instanceId: comp.instanceId
        } );
    }

}










/**
 * Builds and sends a timer/countdown overlay component.
 * 
 * @param {PhraseParse} res The information from the parsed phrase.
 * @param {Date} timestamp The timestamp of the log entry.
 * @param {TriggerAction} action The trigger's display text action.
 * @param {LogTrigger} trigger If true the component is written to the console instead of sent to the overlay window.
 */
function displayTimerCountdownComponent(res, timestamp, action, trigger) {
      
    // ${target} has been slain by (.+?)!
    let comp = new OverlayComponent();

    comp.instanceId = nanoid();
    comp.triggerName = trigger.name;
    comp.action = Object.assign( new TriggerAction(), action );

    if ( res.result?.groups?.timerDuration ) {
        comp.action.duration = StringUtilities.getDurationFromLabel( res.result?.groups?.timerDuration );
    } else {
        comp.action.duration = +action.duration;
    }
    
    comp.action.displayText = StringUtilities.parseShortCodeValuesToLiteral( comp.action.displayText, characterName, comp.action.duration, res.result?.groups, res.result ? res.result[ 0 ] : null );
    comp.action.displayText = StringUtilities.parseStoredVariablesToLiteral( comp.action.displayText, storedVariables );
    comp.action.displayText = StringUtilities.parseConditionResultsToLiteral( comp.action.displayText, trigger._conditionResults );
    comp.action.displayText = StringUtilities.parseMatchesToLiteral( comp.action.displayText, res.result );
    comp.action.displayText = StringUtilities.parseCountersToLiteral( comp.action.displayText, counters );

    comp.overlayId = action.overlayId;
    comp.matches = res.result;
    comp.timestamp = timestamp;
    comp.voiceIndex = voiceIndex;
                        
    if ( comp.action.endingSoonDisplayText ) {
        comp.action.endingSoonText = StringUtilities.parseShortCodeValuesToLiteral( action.endingSoonText, characterName, comp.action.duration, res.result?.groups, res.result ? res.result[ 0 ] : null );
        comp.action.endingSoonText = StringUtilities.parseStoredVariablesToLiteral( comp.action.endingSoonText, storedVariables );
        comp.action.endingSoonText = StringUtilities.parseConditionResultsToLiteral( comp.action.endingSoonText, trigger._conditionResults );
        comp.action.endingSoonText = StringUtilities.parseMatchesToLiteral( comp.action.endingSoonText, res.result );
        comp.action.endingSoonText = StringUtilities.parseCountersToLiteral( comp.action.endingSoonText, counters );
    }

    if ( comp.action.endingSoonSpeak ) {
        comp.action.endingSoonSpeakPhrase = StringUtilities.parseShortCodeValuesToLiteral( action.endingSoonSpeakPhrase, characterName, comp.action.duration, res.result?.groups, res.result ? res.result[ 0 ] : null );
        comp.action.endingSoonSpeakPhrase = StringUtilities.parseStoredVariablesToLiteral( comp.action.endingSoonSpeakPhrase, storedVariables );
        comp.action.endingSoonSpeakPhrase = StringUtilities.parseConditionResultsToLiteral( comp.action.endingSoonSpeakPhrase, trigger._conditionResults );
        comp.action.endingSoonSpeakPhrase = StringUtilities.parseMatchesToLiteral( comp.action.endingSoonSpeakPhrase, res.result );
        comp.action.endingSoonSpeakPhrase = StringUtilities.parseCountersToLiteral( comp.action.endingSoonSpeakPhrase, counters );
    }

    if ( comp.action.endingClipboard ) {
        comp.action.endingClipboardText = StringUtilities.parseShortCodeValuesToLiteral( action.endingClipboardText, characterName, comp.action.duration, res.result?.groups, res.result ? res.result[ 0 ] : null );
        comp.action.endingClipboardText = StringUtilities.parseStoredVariablesToLiteral( comp.action.endingClipboardText, storedVariables );
        comp.action.endingClipboardText = StringUtilities.parseConditionResultsToLiteral( comp.action.endingClipboardText, trigger._conditionResults );
        comp.action.endingClipboardText = StringUtilities.parseMatchesToLiteral( comp.action.endingClipboardText, res.result );
        comp.action.endingClipboardText = StringUtilities.parseCountersToLiteral( comp.action.endingClipboardText, counters );
    }

    if ( comp.action.endedDisplayText ) {
        comp.action.endedText = StringUtilities.parseShortCodeValuesToLiteral( action.endedText, characterName, comp.action.duration, res.result?.groups, res.result ? res.result[ 0 ] : null );
        comp.action.endedText = StringUtilities.parseStoredVariablesToLiteral( comp.action.endedText, storedVariables );
        comp.action.endedText = StringUtilities.parseConditionResultsToLiteral( comp.action.endedText, trigger._conditionResults );
        comp.action.endedText = StringUtilities.parseMatchesToLiteral( comp.action.endedText, res.result );
        comp.action.endedText = StringUtilities.parseCountersToLiteral( comp.action.endedText, counters );
    }

    if ( comp.action.endedSpeak ) {
        comp.action.endedSpeakPhrase = StringUtilities.parseShortCodeValuesToLiteral( action.endedSpeakPhrase, characterName, comp.action.duration, res.result?.groups, res.result ? res.result[ 0 ] : null );
        comp.action.endedSpeakPhrase = StringUtilities.parseStoredVariablesToLiteral( comp.action.endedSpeakPhrase, storedVariables );
        comp.action.endedSpeakPhrase = StringUtilities.parseConditionResultsToLiteral( comp.action.endedSpeakPhrase, trigger._conditionResults );
        comp.action.endedSpeakPhrase = StringUtilities.parseMatchesToLiteral( comp.action.endedSpeakPhrase, res.result );
        comp.action.endedSpeakPhrase = StringUtilities.parseCountersToLiteral( comp.action.endedSpeakPhrase, counters );
    }

    if ( comp.action.endedClipboard ) {
        comp.action.endedClipboardText = StringUtilities.parseShortCodeValuesToLiteral( action.endedClipboardText, characterName, comp.action.duration, res.result?.groups, res.result ? res.result[ 0 ] : null );
        comp.action.endedClipboardText = StringUtilities.parseStoredVariablesToLiteral( comp.action.endedClipboardText, storedVariables );
        comp.action.endedClipboardText = StringUtilities.parseConditionResultsToLiteral( comp.action.endedClipboardText, trigger._conditionResults );
        comp.action.endedClipboardText = StringUtilities.parseMatchesToLiteral( comp.action.endedClipboardText, res.result );
        comp.action.endedClipboardText = StringUtilities.parseCountersToLiteral( comp.action.endedClipboardText, counters );
    }

    // reset the trigger.
    trigger._reset();

    ipcRenderer.send( 'overlay:send:component', comp );

    if ( comp.action.endEarlyPhrases?.length > 0 ) {
        let renderedPhrases = renderPhrases( comp.action.endEarlyPhrases, trigger._conditionResults, res.result );

        cancellableComponents.push( {
            _parse: ( logEntry ) => {
                let matched = false;
                                    
                renderedPhrases.forEach( phrase => {
                    let _res = new RegExp( phrase, 'g' ).exec( logEntry );
                    if ( _res?.length > 0 ) {
                        matched = true;
                    }
                } );

                return matched;
            },
            instanceId: comp.instanceId
        } );
    }
    
}










/**
 * Builds and sends a display text overlay component.
 * 
 * @param {PhraseParse} res The information from the parsed phrase.
 * @param {TriggerAction} action The trigger's display text action.
 * @param {Record<string, string>} conditionResults The values of the conditions when the trigger was parsed.
 */
function sendToClipboard( res, action, conditionResults ) {
    let clipboardText = action.displayText;

    clipboardText = StringUtilities.parseShortCodeValuesToLiteral( clipboardText, characterName, action.duration, res.result?.groups, res.result ? res.result[ 0 ] : null );
    clipboardText = StringUtilities.parseStoredVariablesToLiteral( clipboardText, storedVariables );
    clipboardText = StringUtilities.parseConditionResultsToLiteral( clipboardText, conditionResults );
    clipboardText = StringUtilities.parseMatchesToLiteral( clipboardText, res.result );
    clipboardText = StringUtilities.parseCountersToLiteral( clipboardText, counters );

    ipcRenderer.send( 'clipboard:writeText', clipboardText );

}










/**
 * Builds and sends a display text overlay component.
 * 
 * @param {PhraseParse} res The information from the parsed phrase.
 * @param {TriggerAction} action The trigger's display text action.
 * @param {Date} timestamp The timestamp of the log entry.
 * @param {boolean} simulating If true the component is written to the console instead of sent to the overlay window.
 */
function displayTextComponent( res, timestamp, action, simulating ) {
    
    let comp = new OverlayComponent();

    comp.instanceId = nanoid();
    comp.action = Object.assign( new TriggerAction(), action );
    
    comp.action.displayText = StringUtilities.parseShortCodeValuesToLiteral( comp.action.displayText, characterName, comp.action.duration, res.result?.groups, res.result ? res.result[ 0 ] : null );
    comp.action.displayText = StringUtilities.parseStoredVariablesToLiteral( comp.action.displayText, storedVariables );
    comp.action.displayText = StringUtilities.parseCountersToLiteral( comp.action.displayText, counters );
    comp.action.displayText = StringUtilities.parseMatchesToLiteral( comp.action.displayText, res.result );

    comp.overlayId = action.overlayId;
    comp.matches = res.result;
    comp.timestamp = timestamp;

    if ( !simulating )
        ipcRenderer.send( 'overlay:send:component', comp );
    else
        console.log( 'overlay:send:component', comp );
    
}










/**
 * Sends the given information to the debug log overlay.
 * 
 * @param {any} info The information to send to the log.
 * @param {number} duration The duration to leave in the log overlay.
 */
function sendInformationToLog( info, duration ) {
    
    let overlayId = _.find( overlays, o => o.overlayType === 'Log' )?.overlayId;
    duration = duration > 0 ? duration : 12;
    
    if ( overlayId ) {

        let comp = new OverlayComponent();
    
        comp.instanceId = nanoid();
        comp.action = new TriggerAction();
        comp.action.actionId = nanoid();
        comp.action.actionType = ActionTypes.DisplayText;
        if ( typeof info === 'string' ) {
            comp.action.displayText = info;
            comp.action.duration = duration;
        } else {
            comp.action.displayText = JSON.stringify( info );
            comp.action.duration = duration;
        }
        
        comp.overlayId = overlayId;
        comp.matches = null;
        comp.timestamp = new Date();

        ipcRenderer.send( 'overlay:send:component', comp );
    }
}










/**
 * Saves the given value in the store.
 * 
 * @param {string} key The key of the stored variable.
 * @param {any} value The value to store.
 * @param {boolean} restricted If true, the value must be used as a condition in a trigger before being saved.
 */
function saveVariable( key, value, restricted ) {
    let storeValue = true;
    
    if ( restricted ) {
        if ( usedConditionValues == null || usedConditionValues[ key ] == null || usedConditionValues[ key ].length == 0 || usedConditionValues[ key ].indexOf( value ) === -1 ) {
            storeValue = false;
        }
    }

    if ( storeValue ) {
        storedVariables[ key ] = storedVariables[ key ]?.length > 0 ? storedVariables[ key ] : [];
        storedVariables[ key ].push( value );

        sendInformationToLog( `Storing value [${value}] into [${key}]`, 12 );
        sendInformationToLog( `Current values are: ${storedVariables[ key ].join( '|' )}` );

    }

}










/**
 * Increments the specified counter by 1.
 * 
 * @param {string} key The counter name/key.
 */
function incrementCounter( key ) {
    if ( counters[ key ] == null ) {
        // Do not fail.
        console.error( 'No counter found for ', key );
    } else {
        counters[ key ].value += 1;
        counters[ key ].lastUpdate = new Date();
    }
}










/**
 * Saves the given value in the store.
 * 
 * @param {string} key The key of the stored variable.
 * @param {any} value The value to store.
 */
function saveScalarVariable( key, value ) {
    storedVariables[ key ] = [ value ];

    sendInformationToLog( `Storing scalar value [${value}] into [${key}]`, 12 );
    sendInformationToLog( `Current values are: ${storedVariables[ key ].join( '|' )}` );
}










/**
 * Returns true if the given key has the specified value in the store.
 * 
 * @returns {{exists: boolean, value: any}}
 * 
 * @param {string} key The key of the stored variable.
 * @param {any|any[]} value The value to check.
 */
function storeHasValue( key, value ) {
    
    if ( storedVariables[ key ]?.length > 0 ) {
        if ( value instanceof Array ) {
            for ( let i = 0; i < value.length; i++ ) {
                let index = storedVariables[ key ].indexOf( value[ i ] );
                if ( index > -1 ) {
                    return { exists: true, value: value[ i ] };
                }
            }
        } else {
            let index = storedVariables[ key ].indexOf( value );
            return index > -1 ? { exists: true, value: value } : { exists: false };
        }
    }

    return { exists: false };
    
}










/**
 * Clears the given value from the store.
 * 
 * @param {string} key The key of the stored variable.
 * @param {any} value The value to clear.
 */
function clearStoredVariable( key, value ) {

    if ( storedVariables[ key ]?.length ) {
        let index = storedVariables[ key ].indexOf( value );

        if ( index > -1 ) {

            storedVariables[ key ].splice( index, 1 );
            sendInformationToLog( `Removed [${value}] from store variable [${key}] at index [${index}]` );
            sendInformationToLog( `Current values are: ${storedVariables[ key ].join( '|' )}` );

        } else {
            sendInformationToLog( `Clear value failed, [${value}] not found in stored variables` );
            sendInformationToLog( `Current values are: ${storedVariables[ key ].join( '|' )}` );

        }
    }

}










/**
 * Clears all values from the store.
 * 
 * @param {string} key The key of the stored variable.
 */
function clearAllStoredValuesInVariable( key ) {
    storedVariables[ key ] = [];
}










/**
 * Renders the given list of phrases into regular expressions.
 * 
 * @param {Phrase} phrases The list of phrases to render.
 * @param {Record<string,any>} conditionResults The value of condition checks for the executed trigger.
 * @param {RegExpExecArray} parseResult The regexp exec array of the parsed log entry.
 */
function renderPhrases( phrases, conditionResults, parseResult ) {
    let renderedPhrases = [];

    for ( let phraseIndex = 0; phraseIndex < phrases?.length; phraseIndex++ ) {
        let renderedPhrase = phrases[ phraseIndex ].phrase;

        renderedPhrase = StringUtilities.parseShortCodeValuesToLiteral( renderedPhrase, characterName, 0, parseResult?.groups, parseResult ? parseResult[ 0 ] : null );
        renderedPhrase = StringUtilities.parseStoredVariablesToLiteral( renderedPhrase, storedVariables );
        renderedPhrase = conditionResults?.length > 0 ? StringUtilities.parseConditionResultsToLiteral( renderedPhrase, conditionResults ) : renderedPhrase;
        renderedPhrase = parseResult?.length > 0 ? StringUtilities.parseMatchesToLiteral( renderedPhrase, parseResult ) : renderedPhrase;
        renderedPhrase = StringUtilities.parseCountersToLiteral( renderedPhrase, counters );

        if ( phrases[ phraseIndex ].useRegEx ) {
            renderedPhrases.push( renderedPhrase );
        } else {
            renderedPhrases.push( '^' + renderedPhrase.replace( /[.*+?^${}()|[\]\\]/g, '\\$&' ) + '$' );
        }
    }

    return renderedPhrases;
}










/**
 * Tells speech synthisis engine to speak the given phrase.
 * 
 * @param {string} phrase The phrase to speak.
 * @param {boolean} interrupt If true, interrupts the current utterance if the speech engine is speaking.
 * @param {Record<string, string>} conditionResults The condition results.
 * @param {boolean} simulating If true the phrase is written to the log instead of spoken.
 * @param {RegExpExecArray} parseResult The regexp exec array of the parsed log entry.
 * @param {number} timerDuration The duration in seconds of the timer, if applicable.
 */
function speakPhrase( phrase, interrupt, conditionResults, simulating, parseResult, timerDuration ) {
    
    if ( !simulating && phrase && voiceIndex > -1 ) {

        let utter = new SpeechSynthesisUtterance();
    
        utter.text = StringUtilities.parseShortCodeValuesToLiteral( phrase, characterName, timerDuration, parseResult?.groups, parseResult ? parseResult[ 0 ] : null );
        utter.text = StringUtilities.parseStoredVariablesToLiteral( utter.text, storedVariables );
        if ( conditionResults ) {
            utter.text = StringUtilities.parseConditionResultsToLiteral( utter.text, conditionResults );
        }
        if ( parseResult ) {
            utter.text = StringUtilities.parseMatchesToLiteral( utter.text, parseResult );
        }
        utter.text = StringUtilities.parseCountersToLiteral( utter.text, counters );
        utter.text = StringUtilities.parsePhoneticTransformsToLiteral( utter.text, phoneticTransforms );
        utter.voice = voiceOptions[ voiceIndex ];
        
        utter.onend = function ( event ) {
            let i = utterances.indexOf( this );
            if ( i > -1 ) {
                utterances.splice( i, 1 );
            }
            if ( utterances?.length > 0 ) {
                speechSynthesis.speak( utterances[ 0 ] );
            }
        }
    
        if ( interrupt && speechSynthesis.speaking ) {
            
            // Stop any current speech.
            speechSynthesis.cancel();
            
            // Put this speech at the top of the list.
            utterances.unshift( utter );
            
            // Tell the engine to start talking.
            speechSynthesis.speak( utterances[ 0 ] );
    
        } else {
            
            // Put the utterance at the end of the queue.
            utterances.push( utter );
    
            // If the engine is not talking, tell it to start talking.
            !speechSynthesis.speaking && speechSynthesis.speak( utterances[ 0 ] );
    
        }
        
    } else {
        console.log( 'speaking', StringUtilities.parseStoredVariablesToLiteral( action.displayText, storedVariables ) );

    }
    
}










/**
 * Calculates the number of additional ticks from focus effects.
 * 
 * @param {number} duration The base duration.
 * @param {CharacterClassLevel[]} triggerClasses The base duration.
 * @param {number} extFocusPercent The total percent increase.
 * @param {number} extFocusDecayLevel The level in which the focus begins to fade.
 */
function calculateAdditionalTicks( duration, triggerClasses, extFocusPercent, extFocusDecayLevel ) {
    
    let percent = extFocusPercent;
    let charClassData = _.find( triggerClasses, ccl => ccl.class === charModel.class );

    if ( charClassData != null && charClassData.level > extFocusDecayLevel ) {
        let decayPercent = ( charClassData.level - extFocusDecayLevel ) * 5;
        percent = percent * ( 1 - decayPercent / 100 );
    }

    let baseTicks = duration / 6;
    let addTicks = baseTicks * percent / 100;
    if ( addTicks < 1 )
        addTicks = Math.round( addTicks );
    else
        addTicks = Math.floor( addTicks );
    
    return addTicks;
}










/**
 * Calculates the number of additional ticks from focus effects.
 * 
 * @param {number} duration The base duration, in milliseconds.
 * @param {CharacterClassLevel[]} triggerClasses The base duration.
 * @param {number} extFocusPercent The total percent increase.
 * @param {number} extFocusDecayLevel The level in which the focus begins to fade.
 */
function calculateCastingMilliseconds( duration, triggerClasses, extFocusPercent, extFocusDecayLevel ) {
    
    let percent = extFocusPercent;
    let charClassData = _.find( triggerClasses, ccl => ccl.class === charModel.class );

    if ( charClassData != null && charClassData.level > extFocusDecayLevel ) {
        let decayPercent = ( charClassData.level - extFocusDecayLevel ) * 5;
        percent = percent * ( 1 - decayPercent / 100 );
    }

    let reduction = 1 - percent / 100;
    return duration * reduction;
}










/**
 * Plays the specified audio file.
 * 
 * @param {string} fileId The id of the desired file.
 */
function playAudioFile( fileId ) {
    ipcRenderer.once( 'audio-file:get:url', ( e, url ) => {
        if ( url ) {
            let player = new Audio( url );
            player.play();
        }
    } );
    ipcRenderer.send( 'audio-file:get:url', fileId );
}










/**
 * Checks previously captured log entries for the given phrase.
 * 
 * @param {RegExp} phrase The phrase to query.
 * @param {{time: number[]}} options Changes the behavior of the search pattern.
 */
function checkParseHistory( phrase, options ) {
    
    if ( options.time?.length > 0 ) {
        for ( let i = 0; i < options.time.length; i++ ) {
            let t = Math.floor( options.time[ i ] / 1000 ) * 1000;
            let m = _findFirstMatch( parsedLogEntries[ t ] );

            if ( m ) {
                return m;
            }
        }
        // options.time = Math.round( options.time / 1000 ) * 1000;
        // console.log( 'checkParseHistory', parsedLogEntries, options.time );
        // return _findFirstMatch( parsedLogEntries[ options.time ] );

    } else {
        for ( let key in Object.keys( parsedLogEntries ) ) {

            let m = _findFirstMatch( parsedLogEntries[ +key ] );

            if ( m ) {
                return m;
            }
        
        }
    }

    function _findFirstMatch( logEntries ) {
        
        if ( logEntries?.length > 0 ) {
            for ( let i = 0; i < logEntries.length; i++ ) {
                let m = phrase.exec( logEntries[ i ] );
                if ( m?.length > 0 ) {
                    return m;
                }
            }
        }

    }

}

/**
 * Parses backwards in the log file to find a match.  If found, returns the matched results.
 * 
 * @param {string} log The log file to parse.
 * @param {() => void} callback When all look-backs are completed, this method is executed.
 */
function backfind( log, callback ) {

    let _triggers = _.filter( triggers, t => _.some( t.actions, a => a.loopBackForValue === true ) );

    /**
     * Returns false if there is a trigger requiring loopback and still missing a value.
     */
    function valuesMissing() {
        for ( let ti = 0; ti < _triggers?.length ?? 0; ti++ ) {
            for ( let ai = 0; ai < _triggers[ ti ].actions?.length ?? 0; ai++ ) {
                let hasValue = storedVariables[ _triggers[ ti ].actions[ ai ].variableName ] instanceof Array ? storedVariables[ _triggers[ ti ].actions[ ai ].variableName ].length > 0 : !!storedVariables[ _triggers[ ti ].actions[ ai ].variableName ];
                if ( hasValue ) {
                    return false;
                }
            }
        }

        return true;
    }

    if ( valuesMissing() ) {
        fs.open( log, 'r', function ( err, fd ) {
            if ( fd ) {
                let danglyBits = null;
                var stats = fs.fstatSync( fd );
                let myChunkSize = stats.size < chunkSize ? stats.size : chunkSize;
                let position = stats.size; //  Start at the end of the file.

                function parseChunk() {
                    if ( position <= 0 || !valuesMissing() ) {
                        // If we've reached the beginning of the file or all values where parsed, execute the callback function and end parsing.
                        callback();

                    } else {
                        fs.read( fd, Buffer.alloc( myChunkSize ), 0, myChunkSize, position - myChunkSize, ( err, bytecount, buff ) => {
                        
                            let read = buff.toString( 'utf-8', 0, bytecount );
                            let lines = read.split( /\r\n|\r|\n/gmi );

                            if ( position < stats.size ) {
                                lines[ lines.length - 1 ] += danglyBits;
                            }
                            danglyBits = lines[ 0 ];

                            if ( lines?.length > 1 ) {
                                for ( let i = lines.length - 1; i > 0; i-- ) {
                                    // We want to parse backwards, reading all lines except for the first in the list, this is because the first in the list could be a partial line.
                                    if ( lines[ i ].length > 0 && lines[ i ].charAt( 0 ) === '[' ) {
                                        try {
                                            _triggers.forEach( trigger => {
                                                // Check for a valid timestamp in the line.
                                                let log = lines[ i ].replace( /^\[(.*?)\]\s*/gi, '' );

                                                trigger._parse( log, res => {
                                                    trigger.actions.forEach( action => {
                                                        if ( action.actionType === ActionTypes.StoreVariable ) {
                                                            /* --== Store Variable ==-- */
                    
                                                            if ( action.loopBackForValue ) {
                                                                if ( res.result.length === 1 ) {
                                                                    saveVariable( action.variableName, res.result[ 0 ], action.onlyStoreUsedValues );
                                                                } else {
                                                                    saveVariable( action.variableName, res.result[ 1 ], action.onlyStoreUsedValues );
                                                                }
                                                            }

                                                        }
                                                    } );
                                                } );
                                            } );
                                            
                                        } catch ( error ) {
                                            sendInformationToLog( `Failure attempting to read line: ${lines[ i ]}` );
                                        }
                                    }
                                    

                                    if ( !valuesMissing() ) {
                                        window.setTimeout( () => callback() );
                                        return;
                                    }
                                }
                            }

                            if ( bytecount <= 0 ) {
                                // If bytes read was 0, something went wonky and we need to trigger an exit condition.
                                position = -1;
                            }
                            
                            position -= bytecount;

                            parseChunk();

                        } );
                    }
                }

                parseChunk();
                
            }
        } );
    } else {
        callback();

    }

}

module.exports = LogWatcher;

// Capture spell being cast
// You begin casting Cascading Darkness.

// Exit conditions (casting)
//X A loathling lich resisted your Cascading Darkness!
//X Your Envenomed Bolt spell is interrupted.
//X Your Journeyman Boots spell did not take hold. (Blocked by Pack Spirit.)

// Exit conditions (timer)
//  A black wolf has been slain by Grimrot!
//  You have slain a black wolf!

// ^You hit (.*) for 5 points of disease damage by ${SpellBeingCast}\.
// ^You hit (.*) for ([0-9]*) ?points of (.*)? ?damage by Poison Bolt\.

// Spell lands:
//  On Hit:
//        You hit a black wolf for 41 points of poison damage by Envenomed Bolt.
//        You hit (          ) for ()                         by (            )
//  On Tick 1:
//        A black wolf has taken 10 damage from your Envenomed Bolt.
//        (          )           ()             your (            )


// ***
// [Fri Oct 02 09:34:19 2020] You begin casting Funeral Pyre of Kelador.
// ***
// [Fri Oct 02 09:34:21 2020] a carrion beetle hatchling is enveloped in a funeral pyre.
// ***
// [Fri Oct 02 09:34:25 2020] A carrion beetle hatchling has taken 350 damage from your Funeral Pyre of Kelador.
// ***
// [Fri Oct 02 09:34:25 2020] You have slain a carrion beetle hatchling!

// [Thu Jun 06 23:22:28 2019] Azryl has fallen to the ground.
// [Thu Nov 05 00:31:50 2020] You are no longer feigning death, because a spell hit you.