// const ipc = require( 'electron' ).ipcMain;
const { ipcRenderer } = require( 'electron' );
const path = require( 'path' );
const process = require( 'process' );
const fs = require( 'fs' );
const DkpEntryModel = require( '../data/models/dkp-entry' );
const { Trigger, TriggerAction, ActionTypes, TriggerConditionTypes, OperatorTypes } = require( '../data/models/trigger' );
const { OverlayComponent } = require( '../data/models/overlay-window' );

const chokidar = require( "chokidar" );
const StringUtilities = require( '../utilities/string' );
const NumberUtilities = require( '../utilities/numbers' );
const FctModel = require( '../data/models/fct' );
// const UserPreferencesStore = require( '../data/user-preferences' );
var currentPosition = 0;

var watcher = null;
/** @type {Trigger[]} */
var triggers = [];
var storedVariables = {};
var enableFct = false;
var damageDealtOverlayId = null;
var damageReceivedOverlayId = null;
// const userPreferences = new UserPreferencesStore( {} );

function LogWatcher() {
    ipcRenderer.on( 'log:changed', function ( event, data ) {
        fs.open( data, 'r', function ( err, fd ) {
            var file = fd;
            currentPosition = fs.fstatSync( file ).size;
        } );
        if ( watcher != null ) {
            watcher.close();
        }
        watcher = chokidar.watch( data ).on( "all", ( event, path ) => {
            fs.open( data, 'r', function ( err, fd ) {
                var stats = fs.fstatSync( fd );
                var file = fd;
                
                fs.read( file, new Buffer( stats.size - currentPosition ), 0, stats.size - currentPosition, currentPosition, ( err, bytecount, buff ) => {
                    currentPosition += bytecount;
                    let read = buff.toString( 'utf-8', 0, bytecount );
                    let lines = read.split( /\r\n|\r|\n/gmi );
                    lines.forEach( f => {
                        if ( f && f.length > 0 ) {
                            parseLogEntries( f );
                        }
                    } );
                } );
            } );
        } );
    } );

    ipcRenderer.on( 'tick', function ( event, data ) {
        console.log( 'tick received', data );
        triggers = data.triggers;
        enableFct = data.enableFct;
        damageDealtOverlayId = data.damageDealtOverlayId;
        damageReceivedOverlayId = data.damageReceivedOverlayId;
        generateTriggerFns();
    } );
}

function generateTriggerFns() {
    triggers?.forEach( trigger => {
        if ( trigger.capturePhrases?.length > 0 ) {
            
            // Any match.
            if ( trigger.captureMethod === 'Any match' ) {

                // First we generate parse functions for each capture phrase in the trigger.
                let _phraseParsers = [];
                trigger.capturePhrases?.forEach( phrase => {

                    // Only create parse functions for phrases that have content.
                    if ( phrase.phrase?.length > 0 ) {
                        if ( phrase.useRegEx ) {
                            // Use different parse functions for regex vs normal.
                            // let _reg = new RegExp( StringUtilities.parseStoredVariablesToRegex( phrase.phrase, storedVariables ), 'gi' );
                            _phraseParsers.push( value => {
                                let _res = new RegExp( StringUtilities.parseStoredVariablesToRegex( phrase.phrase, storedVariables ), 'gi' ).exec( value );
                                // _reg.lastIndex = 0;
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
                
                trigger._parse = value => {
                    let conditionsPassed = true;

                    // First, the trigger must pass each condition.
                    trigger.conditions?.forEach( condition => {
                        if ( condition.conditionType === TriggerConditionTypes.VariableValue ) {
                            if ( condition.operatorType === OperatorTypes.Equal ) {
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

                    // If all conditions passed, then parse the phrase.
                    if ( conditionsPassed ) {
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
            } else {
                // Currently, the only supported match method is 'Any match'.
                trigger._parse = value => {
                    return {
                        match: false,
                        result: []
                    };
                };
            }

        } else {
            // if the trigger is missing capture phrases, then do nothing.
            trigger._parse = value => {
                return {
                    match: false,
                    result: []
                };
            };
        }
    } );
}

let rgxTrigger = /grats;/gi;
let rgxTimestamp = /^\[(.*?)\]\s*/gi;
let rgxGrabText = /\'(.*?)\'$/gi;
let rgxDelimiter = /;/gi;
let rgxNum = /(\d+)/gi;
let rgxCombatText = /damage|miss|dodge|riposte|parry|become better|backstab|stun|attack/gi;

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
]

function parseLogEntries( raw ) {

    rgxTimestamp.lastIndex = 0;
    rgxTrigger.lastIndex = 0;
    rgxCombatText.lastIndex = 0;

    let timestamp = new Date( rgxTimestamp.exec( raw )[ 1 ] );

    if ( raw.match( rgxTrigger ) ) {
        
        rgxGrabText.lastIndex = 0;
        rgxDelimiter.lastIndex = 0;
        rgxNum.lastIndex = 0;

        let text = rgxGrabText.exec( raw )[ 1 ].split( rgxDelimiter );
        let item = text[ 2 ];
        let character = text[ 1 ];
        let dkp = rgxNum.exec( text[ 3 ] )[ 0 ];
        
        ipcRenderer.send( 'dkp:add', new DkpEntryModel( timestamp, character, item, +dkp ) );
    } else if ( enableFct && raw.match( rgxCombatText )?.length > 0 ) {

        for ( let i = 0; i < fctRegExs.length; i++ ) {
            fctRegExs[ i ].lastIndex = 0;
            let results = fctRegExs[ i ].exec( raw );
            
            if ( results && results.length > 1 ) {
                
                let model = new FctModel();
                model.dealt = i >= 0 && i <= 4 ? true : false;
                model.overlayId = model.dealt ? damageDealtOverlayId : damageReceivedOverlayId;

                if ( i === 0 ) {
                    // My melee damage.
                    let type = results[ 1 ];
                    let target = results[ 2 ];
                    let dmg = NumberUtilities.toShorthandString( results[ 3 ] );

                    model.text = `${dmg}`;

                } else if ( i === 1 ) {
                    // My melee misses.
                    let dmg = 'miss';

                } else if ( i === 2 ) {
                    // My spell hits
                    let target = results[ 1 ];
                    let dmg = NumberUtilities.toShorthandString( results[ 2 ] );
                    let spell = results[ 3 ];

                    model.text = `${dmg}`;

                } else if ( i === 3 ) {
                    // My thorns dmg
                    let target = results[ 1 ];
                    let dmg = NumberUtilities.toShorthandString( results[ 2 ] );

                    model.text = `${dmg}`;

                } else if ( i === 4 ) {
                    // My skill up
                    let skill = results[ 1 ];
                    let level = results[ 2 ];

                } else if ( i === 5 ) {
                    // Melee damage taken
                    let attacker = results[ 1 ];
                    let type = results[ 2 ];
                    let dmg = NumberUtilities.toShorthandString( results[ 3 ] );

                    model.text = `${dmg}`;

                } else if ( i === 6 ) {
                    // Me avoiding melee
                    let attacker = results[ 1 ];
                    let type = results[ 2 ];
                    let miss = results[ 3 ];

                } else if ( i === 7 ) {
                    // Me taking spell damage
                    let attacker = results[ 1 ];
                    let dmg = NumberUtilities.toShorthandString( results[ 2 ] );
                    let resist = results[ 3 ];
                    let spell = results[ 4 ];

                    model.text = `${dmg}`;

                }

                console.log( 'sending', model );
                ipcRenderer.send( 'overlay:send:component', model );

                // leave the loop, we found the correct FCT type.
                break;
            }
        }
        
    } else {
        let log = raw.replace( rgxTimestamp, '' );
        triggers.forEach( f => {
            let res = f._parse( log );
            if ( res.match ) {
                f.actions.forEach( action => {
                    if ( action.phrases == null || action.phrases?.length === 0 || action.phrases?.indexOf( res.phraseId ) > -1 ) {
                        if ( action.actionType === ActionTypes.DisplayText ) {
                            let comp = new OverlayComponent();
                            comp.action = Object.assign( new TriggerAction(), action );
                            comp.action.displayText = StringUtilities.parseStoredVariablesToLiteral( action.displayText, storedVariables );
                            comp.overlayId = action.overlayId;
                            comp.matches = res.result;
                            ipcRenderer.send( 'overlay:send:component', comp );
                        } else if ( action.actionType === ActionTypes.StoreVariable ) {
                            if ( res.result.length === 1 ) {
                                storedVariables[ action.variableName ] = res.result[ 0 ];
                            } else {
                                storedVariables[ action.variableName ] = res.result[ 1 ];
                            }
                        } else if ( action.actionType === ActionTypes.ClearVariable ) {
                            storedVariables[ action.variableName ] = null;
                        } else if ( action.actionType === ActionTypes.DotTimer ) {
                            let comp = new OverlayComponent();
                            comp.action = Object.assign( new TriggerAction(), action );
                            comp.action.displayText = `${f.name} --== {1} ==--`;
                            comp.overlayId = action.overlayId;
                            comp.matches = res.result;
                            ipcRenderer.send( 'overlay:send:component', comp );
                        }
                    }
                } );
            }
        } );
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