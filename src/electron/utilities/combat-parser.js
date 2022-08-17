const _ = require( 'lodash' );
const customAlphabet = require( 'nanoid' ).customAlphabet;
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const nanoid = customAlphabet( alphabet, 16 );
const { LogFileLocation } = require( '../data/log-file-location' );
const fs = require( 'fs' );


class CombatParser {

    /** @type {number} */
    chunkSize = 1048576;
    /** @type {number} */
    chunks = 50;

    constructor() { }

    /**
     * Queries the specified log file for all player deaths.
     * 
     * @param {string} logFilePath The full path to the log file to query.
     * @param {(found: LogFileLocation[]) => void} callback After the file has been parsed, callback will be executed with the results.
     */
    findAllDeaths( logFilePath, callback ) {
        /** @type {LogFileLocation[]} */
        let deathsFound = [];
        
        fs.open( logFilePath, 'r', ( err, fd ) => {
            // let read = 0;
            
            if ( fd ) {
                let file = fd;
                let fstats = fs.fstatSync( file );

                let position = 0;
                let lineNo = 0;
                /** @type {string} */
                let danglyBits = null;

                let readFile = () => {
                    let rsize = position + ( this.chunkSize * this.chunks ) > fstats.size ? fstats.size - position : ( this.chunkSize * this.chunks );
    
                    fs.read( file, Buffer.alloc( rsize ), 0, rsize, position, ( err, bytecount, buff ) => {

                        // read += bytecount;
                        position += bytecount;
    
                        let lines = ( ( danglyBits == null ? '' : danglyBits ) + buff.toString( 'utf-8', 0, bytecount ) ).split( /\r\n|\r|\n/gmi );

                        danglyBits = lines.pop();

                        for ( let i = 0; i < lines?.length; i++ ) {
                            lineNo++;
                            // https://regex101.com/r/a4YxfW/1
                            let e = /^\[(?<timestamp>.*?)\]\s*You have been slain by (?<slayer>[^!]*)!$/gi.exec( lines[ i ] );
                            if ( e ) {
                                let log = new LogFileLocation();
                                
                                log.lineNo = lineNo;
                                log.description = `You have been slain by ${e.groups.slayer}!`;
                                log.raw = lines[ i ];
                                log.timestamp = new Date( e.groups.timestamp );
                                log.logFilePath = logFilePath;

                                deathsFound.push( log );
                            }
                        }

                        if ( bytecount <= 0 ) {
                            callback( deathsFound );
                        } else if ( position < fstats.size ) {
                            setTimeout( () => readFile(), 50 );
                        } else {
                            callback( deathsFound );
                        }
                    } );
                    
                }

                readFile();
                
            }
        } );

        return deathsFound;
    }










    /**
     * Reads an entire log file, executing fn on each line.
     * 
     * @param {string} logFilePath The full path to the log file.
     * @param {(string) => void} fn Executed on each line in the log file.
     */
    readLogFile( logFilePath, fn ) {
        
    }
    
}

module.exports = CombatParser;
