// const ipc = require( 'electron' ).ipcMain;
const { ipcRenderer } = require( 'electron' );
const path = require( 'path' );
const process = require( 'process' );
const fs = require( 'fs' );
const DkpEntryModel = require( '../data/models/dkp-entry' );
const { Trigger, TriggerAction, ActionTypes } = require( '../data/models/trigger' );
const { OverlayComponent } = require( '../data/models/overlay-window' );

const chokidar = require( "chokidar" );
var currentPosition = 0;

var watcher = null;
/** @type {Trigger[]} */
var triggers = [];

function LogWatcher() {
    ipcRenderer.on( 'changeLogFile', function ( event, data ) {
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
                // if ( currentPosition > stats.size ) {
                //     currentPosition = stats.size;
                // }
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

    ipcRenderer.on( 'tick', function (event, data) {
        triggers = data.triggers;
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

                    if ( phrase.phrase?.length > 0 ) {
                        // Only create parse functions for phrases that have content.
                        if ( phrase.useRegEx ) {
                            // Use different parse functions for regex vs normal.
                            let _reg = new RegExp( phrase.phrase, 'gi' );
                            _phraseParsers.push( value => {
                                let _res = _reg.exec( value );
                                return {
                                    match: _res?.length > 0,
                                    result: _res
                                };
                            } );
                        } else {
                            // We won't care about case sensitivity.
                            let _phr = phrase.phrase.toLowerCase();
                            _phraseParsers.push( value => {
                                if ( value && value.length > 0 ) {
                                    return {
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
                    for ( let i = 0; i < _phraseParsers?.length; i++ ){
                        let _res = _phraseParsers[ i ]( value );
                        if ( _res?.match ) {
                            return _res;
                        }
                    }

                    return {
                        match: false,
                        result: []
                    };
                };
            } else {
                // Currently, only supported match method is 'Any match'.
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

function parseLogEntries( raw ) {
    let timestamp = new Date( rgxTimestamp.exec( raw )[ 1 ] );

    if ( raw.match( rgxTrigger ) ) {
        let text = rgxGrabText.exec( raw )[ 1 ].split( rgxDelimiter );
        let item = text[ 2 ];
        let character = text[ 1 ];
        let dkp = rgxNum.exec( text[ 3 ] )[ 0 ];
        
        ipcRenderer.send( 'addDkpEntry', new DkpEntryModel( timestamp, character, item, +dkp ) );
    } else {
        let log = raw.replace( rgxTimestamp, '' );
        triggers.forEach( f => {
            let res = f._parse( log );
            if ( res.match ) {
                f.actions.forEach( action => {
                    if ( action.actionType === ActionTypes.DisplayText ) {
                        let comp = new OverlayComponent();
                        comp.action = action;
                        comp.overlayId = action.overlayId;
                        comp.matches = res.result;
                        ipcRenderer.send( 'overlay:send:component', comp );
                    }
                } );
                // comp.action = f;
                // console.log( 'match found!', res.result[ 0 ] );
                // ipcRenderer.send( 'addDkpEntry', new DkpEntryModel( timestamp, character, item, +dkp ) );
            }
        } );
        // // We can optimize this by generating these as functions on the tick.
        // triggers.forEach( trigger => {
        //     if ( trigger.capturePhrases?.length > 0 ) {
        //         // Any match.
        //         for ( let i = 0; i < trigger.capturePhrases.length; i++ ) {
        //             if ( trigger.capturePhrases[ i ].phrase ) {
        //                 if ( trigger.capturePhrases[ i ].useRegEx ) {
        //                     let _reg = new RegExp( trigger.capturePhrases[ i ].phrase, 'gi' );
        //                     let _res = _reg.exec( log );
        //                     // console.log( 'exec testing', _reg.exec( log ) );
        //                     if ( _res?.length > 0 ) {
        //                         console.log( 'match found', _res[ 0 ] );
        //                     }
        //                 }
        //             }
        //         }
        //     }
        // } );
    }

}

module.exports = LogWatcher;
