// const ipc = require( 'electron' ).ipcMain;
const { ipcRenderer } = require( 'electron' );
const path = require( 'path' );
const process = require( 'process' );
const fs = require( 'fs' );
const DkpEntryModel = require( '../data/models/dkp-entry' );
const { Trigger, TriggerAction, ActionTypes, TriggerConditionTypes, OperatorTypes } = require( '../data/models/trigger' );
const { OverlayComponent } = require( '../data/models/overlay-window' );
const customAlphabet = require( 'nanoid' ).customAlphabet;
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const nanoid = customAlphabet( alphabet, 16 );

const chokidar = require( "chokidar" );
const StringUtilities = require( '../utilities/string' );
const NumberUtilities = require( '../utilities/numbers' );
const FctModel = require( '../data/models/fct' );
var currentPosition = null;

var watcher = null;
/** @type {Trigger[]} */
var triggers = [];
var storedVariables = {};
var enableFct = false;
var damageDealtOverlayId = null;
var damageReceivedOverlayId = null;
var hasExtDotFocus = false;
var extDotFocusPercent = 0;
var extDotFocusDecayLevel = 0;
var voiceOptions = [];
var voiceIndex = -1;
var logParseTimeoutId = null;
var logParseTimer = 50;
var changingLogFile = false;
var isDev = false;

function LogWatcher() {

    ipcRenderer.on( 'log:changed', function ( event, data ) {

        function startParsingLogFile() {
            fs.open( data, 'r', function ( err, fd ) {

                if ( fd ) {
                    var file = fd;
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
            startParsingLogFile();
        } else {
            changingLogFile = true;
            window.setTimeout( () => { 
                changingLogFile = false;
                currentPosition = null;
                startParsingLogFile();
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

    ipcRenderer.on( 'tick', function ( event, data ) {
        triggers = data.triggers;
        enableFct = data.enableFct;
        damageDealtOverlayId = data.damageDealtOverlayId;
        damageReceivedOverlayId = data.damageReceivedOverlayId;
        hasExtDotFocus = data.hasExtendedDotFocus;
        extDotFocusPercent = data.extendedDotFocusPercent;
        extDotFocusDecayLevel = data.extendedDotFocusDecayLevel;
        voiceIndex = data.voiceIndex;
        isDev = data.isDev;
        // isDev = false;
        generateTriggerFns();
    } );

    speechSynthesis.onvoiceschanged = () => {
        voiceOptions = speechSynthesis.getVoices();
    };
}

function generateTriggerFns() {
    triggers?.forEach( trigger => {
        if ( ( isDev || !trigger.onlyExecuteInDev ) && trigger.capturePhrases?.length > 0 ) {

            // First we generate parse functions for each capture phrase in the trigger.
            let _phraseParsers = [];
            trigger.capturePhrases?.forEach( phrase => {

                // Only create parse functions for phrases that have content.
                if ( phrase.phrase?.length > 0 ) {
                    if ( phrase.useRegEx ) {
                        // Use different parse functions for regex vs normal.
                        _phraseParsers.push( value => {
                            let _res = new RegExp( StringUtilities.parseStoredVariablesToRegex( phrase.phrase, storedVariables ), 'gi' ).exec( value );
                            return {
                                phraseId: phrase.phraseId,
                                match: _res?.length > 0,
                                result: _res
                            };
                        } );
                    } else {
                        // We won't care about case sensitivity.
                        let _phr = StringUtilities.parseStoredVariablesToLiteral( phrase.phrase, storedVariables ).toLowerCase();
                        _phraseParsers.push( value => {
                            if ( value && value.length > 0 ) {
                                return {
                                    phraseId: phrase.phraseId,
                                    match: value.toLowerCase().indexOf( _phr ) > -1,
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

            /**
             * Returns true if all conditions are passed.
             * @returns {boolean}
             */
            trigger._checkConditions = function () {
                let conditionsPassed = true;

                // First, the trigger must pass each condition.
                trigger.conditions?.forEach( condition => {
                    if ( condition.conditionType === TriggerConditionTypes.VariableValue ) {
                        if ( condition.operatorType === OperatorTypes.Equals ) {
                            if ( condition.variableValue && storedVariables[ condition.variableName ] !== condition.variableValue ) {
                                conditionsPassed = false;
                            }
                        } else if ( condition.operatorType === OperatorTypes.IsNull ) {
                            if ( storedVariables[ condition.variableName ] != null ) {
                                conditionsPassed = false;
                            }
                        } else if ( condition.operatorType === OperatorTypes.DoesNotEqual ) {
                            if ( condition.variableValue && storedVariables[ condition.variableName ] === condition.variableValue ) {
                                conditionsPassed = false;
                            } else if ( !condition.variableValue && storedVariables[ condition.variableName ] == null ) {
                                conditionsPassed = false;
                            }
                        }
                    }
                } );

                return conditionsPassed;
            }
            
            // Any match.
            if ( trigger.captureMethod === 'Any match' ) {

                trigger._reset = () => { };
                trigger._parse = value => {

                    // If all conditions passed, then parse the phrase.
                    if ( trigger._checkConditions() ) {
                        for ( let i = 0; i < _phraseParsers?.length; i++ ) {
                            let _res = _phraseParsers[ i ]( value );
                            if ( _res?.match ) {
                                return _res;
                            }
                        }
                    }

                    return {
                        match: false,
                        result: []
                    };
                };
            } else if ( trigger.captureMethod === 'Sequential' ) {
                trigger._captureIndex = 0;
                trigger._reset = () => {
                    trigger._captureIndex = 0;
                };
                trigger._parse = value => {
                
                    // If all conditions passed, then parse the phrase.
                    if ( trigger._captureIndex < _phraseParsers?.length && trigger._checkConditions() ) {
                        let _res = _phraseParsers[ trigger._captureIndex ]( value );
                        if ( _res?.match ) {
                            trigger._captureIndex += 1;
                            return _res;
                        }
                    } else {
                        // Otherwise reset the parse.
                        trigger._reset();
                        // trigger._captureIndex = 0;
                    }

                    return {
                        match: false,
                        result: []
                    };
                };

            } else {
                // Currently, the only supported match method is 'Any match'.
                trigger._reset = () => { };
                trigger._parse = value => {
                    return {
                        match: false,
                        result: []
                    };
                };
            }

        } else {
            // if the trigger is missing capture phrases, then do nothing.
            trigger._reset = () => { };
            trigger._parse = value => {
                return {
                    match: false,
                    result: []
                };
            };
        }
    } );
}

function parseLogEntries( raw, simulating ) {
    
    simulating = simulating === true ? true : false;

    let rgxTrigger = /grats;/gi;
    let rgxTimestamp = /^\[(.*?)\]\s*/gi;
    let rgxGrabText = /\'(.*?)\'$/gi;
    let rgxDelimiter = /;/gi;
    let rgxNum = /(\d+)/gi;
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
    
    if ( raw.match( rgxTrigger ) ) {
        
        let text = rgxGrabText.exec( raw )[ 1 ].split( rgxDelimiter );
        let item = text[ 2 ];
        let character = text[ 1 ];
        let dkp = rgxNum.exec( text[ 3 ] )[ 0 ];
        
        if ( !simulating )
            ipcRenderer.send( 'dkp:add', new DkpEntryModel( timestamp, character, item, +dkp ) );
        else
            console.log( 'dkp:add', new DkpEntryModel( timestamp, character, item, +dkp ) );
    }
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
    triggers.forEach( trigger => {
        let res = trigger._parse( log );
        if ( res.match ) {
            trigger.actions.forEach( action => {
                if ( ( isDev || !action.onlyExecuteInDev ) && ( action.phrases == null || action.phrases?.length === 0 || action.phrases?.indexOf( res.phraseId ) > -1 ) ) {
                    if ( action.actionType === ActionTypes.DisplayText ) {
                        /* --== Display Text ==-- */
                        let comp = new OverlayComponent();

                        comp.instanceId = nanoid();
                        comp.action = Object.assign( new TriggerAction(), action );
                        comp.action.displayText = StringUtilities.parseStoredVariablesToLiteral( action.displayText, storedVariables );
                        comp.overlayId = action.overlayId;
                        comp.matches = res.result;
                        comp.timestamp = timestamp;

                        if ( !simulating )
                            ipcRenderer.send( 'overlay:send:component', comp );
                        else
                            console.log( 'overlay:send:component', comp );
                        
                    } else if ( action.actionType === ActionTypes.StoreVariable ) {
                        /* --== Store Variable ==-- */
                        
                        if ( res.result.length === 1 ) {
                            storedVariables[ action.variableName ] = res.result[ 0 ];
                        } else {
                            storedVariables[ action.variableName ] = res.result[ 1 ];
                        }

                    } else if ( action.actionType === ActionTypes.ClearVariable ) {
                        /* --== Clear Variable ==-- */
                        storedVariables[ action.variableName ] = null;

                    } else if ( action.actionType === ActionTypes.DotTimer ) {
                        /* --== DOT Timers ==-- */
                        let comp = new OverlayComponent();

                        comp.instanceId = nanoid();
                        comp.action = Object.assign( new TriggerAction(), action );
                        comp.action.displayText = `${trigger.name} --== {1} ==--`;
                        comp.overlayId = action.overlayId;
                        comp.matches = res.result;
                        comp.timestamp = timestamp;
                        comp.voiceIndex = voiceIndex;

                        if ( comp.action.endingSoonDisplayText ) {
                            comp.action.endingSoonText = StringUtilities.parseStoredVariablesToLiteral( action.endingSoonText, storedVariables );
                        }

                        if ( comp.action.endingSoonSpeak ) {
                            comp.action.endingSoonSpeakPhrase = StringUtilities.parseStoredVariablesToLiteral( action.endingSoonSpeakPhrase, storedVariables );
                        }

                        if ( comp.action.endedDisplayText ) {
                            comp.action.endedText = StringUtilities.parseStoredVariablesToLiteral( action.endedText, storedVariables );
                        }

                        if ( comp.action.endedSpeak ) {
                            comp.action.endedSpeakPhrase = StringUtilities.parseStoredVariablesToLiteral( action.endedSpeakPhrase, storedVariables );
                        }

                        if ( hasExtDotFocus ) {
                            let percent = extDotFocusPercent;

                            if ( trigger.spellLevel > extDotFocusDecayLevel ) {
                                let decayPercent = ( trigger.spellLevel - extDotFocusDecayLevel ) * 5;
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
                        // trigger._captureIndex = 0;

                        // console.log( 'sending dot timer', comp );
                        ipcRenderer.send( 'overlay:send:component', comp );

                    } else if ( action.actionType === ActionTypes.Speak ) {
                        /* --== TTS Speak ==-- */
                        
                        if ( !simulating && action.displayText && voiceIndex > -1 ) {
                            var utter = new SpeechSynthesisUtterance();

                            utter.text = action.displayText;
                            utter.voice = voiceOptions[ voiceIndex ];
                            utter.onend = function ( event ) { }
                            speechSynthesis.speak( utter );

                        } else {
                            console.log( 'speaking', action.displayText );

                        }
                        
                    }
                }
            } );
        }
    } );

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