// const ipc = require( 'electron' ).ipcMain;
const { ipcRenderer } = require( 'electron' );
const path = require( 'path' );
const process = require( 'process' );
const fs = require( 'fs' );
const DkpEntryModel = require( '../data/models/dkp-entry' );

const chokidar = require( "chokidar" );
var currentPosition = 0;

var watcher = null;
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
    } );
}

function parseLogEntries( raw ) {
    let rgxTrigger = /grats;/gi;
    let rgxTimestamp = /^\[(.*?)\]\s*/gi;
    let rgxGrabText = /\'(.*?)\'$/gi;
    let rgxDelimiter = /;/gi;
    let rgxNum = /(\d+)/gi;
    let timestamp = new Date( rgxTimestamp.exec( raw )[ 1 ] );

    if ( raw.match( rgxTrigger ) ) {
        let text = rgxGrabText.exec( raw )[ 1 ].split( rgxDelimiter );
        let item = text[ 2 ];
        let character = text[ 1 ];
        let dkp = rgxNum.exec( text[ 3 ] )[ 0 ];
        
        ipcRenderer.send( 'addDkpEntry', new DkpEntryModel( timestamp, character, item, +dkp ) );
    } else {
        let log = raw.replace( rgxTimestamp, '' );
        // We can optomize this by generating these as functions on the tick.
        triggers.forEach( trigger => {
            if ( trigger.capturePhrases?.length > 0 ) {
                // Any match.
                for ( let i = 0; i < trigger.capturePhrases.length; i++ ) {
                    if ( trigger.capturePhrases[ i ].phrase ) {
                        if ( trigger.capturePhrases[ i ].useRegEx ) {
                            let _reg = new RegExp( trigger.capturePhrases[ i ].phrase, 'gi' );
                            let _res = _reg.exec( log );
                            // console.log( 'exec testing', _reg.exec( log ) );
                            if ( _res?.length > 0 ) {
                                console.log( 'match found', _res[ 0 ] );
                            }
                        }
                    }
                }
            }
        } );
    }

}

module.exports = LogWatcher;
