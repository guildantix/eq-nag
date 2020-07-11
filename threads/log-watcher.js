// const ipc = require( 'electron' ).ipcMain;
const { ipcRenderer } = require( 'electron' );
const path = require( 'path' );
const process = require( 'process' );
const fs = require( 'fs' );
const DkpEntryModel = require( '../data/models/dkp-entry' );

const chokidar = require( "chokidar" );
var currentPosition = 0;

var watcher = null;

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
}

function parseLogEntries( raw ) {
    let rgxTrigger = /grats;/gi;
    let rgxTimestamp = /^\[(.*?)\]/gi;
    let rgxGrabText = /\'(.*?)\'$/gi;
    let rgxDelimiter = /;/gi;
    let rgxNum = /(\d+)/gi;

    if ( raw.match( rgxTrigger ) ) {
        let timestamp = new Date( rgxTimestamp.exec( raw )[ 1 ] );
        let text = rgxGrabText.exec( raw )[ 1 ].split( rgxDelimiter );
        let item = text[ 2 ];
        let character = text[ 1 ];
        let dkp = rgxNum.exec( text[ 3 ] )[ 0 ];
        
        ipcRenderer.send( 'addDkpEntry', new DkpEntryModel( timestamp, character, item, +dkp ) );
    }

}

module.exports = LogWatcher;
