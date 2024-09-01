
const fs = require('fs');
const { ipcRenderer } = require( 'electron' );
// const { sendMsg, sendException } = require( './thread-comms' );
const ThreadUtilities = require( './threading' );
const { nagLog } = require( './nag-console' );
const fsp = fs.promises;
const chunkSize = 1024 * 1024 * 384; // Max chunk possible is 512MB, but we'll use 384MB to be safe.
const maxReadErrors = 5;

let readDelayMs = 200;
let readErrorDelayMs = 1000;
let flushDelayMs = 1000;
let flushCount = Math.ceil( flushDelayMs / readDelayMs );

/**
 * 
 * @param {string|{label: string,message: string,payload: any|undefined}} msg 
 * @param  {...any} args 
 */
const sendLog = ( msg, ...args ) => {
    ipcRenderer.send( 'console:message', msg );
}

const sendException = ( error ) => {
    ipcRenderer.send( 'app:log:exception', error );
}

class FileMonitor {

    #readErrorCount = 0;
    #monitoring = false;
    #stopMonitor = false;
    /** @type {(position: number) => void} */
    #onStopped = null;

    /**
     * 
     * @param {string} filePath 
     */
    constructor( filePath ) {
        this.filePath = filePath;

        ipcRenderer
            .invoke( 'settings:get', { key: 'fileReadDelays', subscribe: true } )
            .then( data => {
                readDelayMs = data.readDelayMs ?? readDelayMs;
                readErrorDelayMs = data.readErrorDelayMs ?? readErrorDelayMs;
                flushDelayMs = data.flushDelayMs ?? flushDelayMs;
                flushCount = Math.ceil( flushDelayMs / readDelayMs );
            } );
        
    }









    
    /**
     * Function to read all lines from a file.
     * 
     * @param {fs.promises.FileHandle} file The file to read from.
     * @param {(lines: string[], bytesRead: number, totalBytes: number) => void} onChunkRead The function to call when a chunk of lines is read.
     * @param {number} position The position to start reading from.
     * @param {string} danglyBits Any dangling bits from the previous read.
     * @param {(value: any) => void} resolve The function to call when the operation is complete.
     * @param {(reason: any) => void} reject The function to call when the operation fails.
     */
    async #doReadLines( file, onChunkRead, position = 0, danglyBits = '', resolve, reject ) {
        try {
            if ( file ) {
                let stats = await file.stat();

                if ( !stats?.isFile() ) {
                    await file.close();

                } else {

                    let data = await file.read( Buffer.alloc( chunkSize ), 0, chunkSize, position );
                    let bytesRead = data.bytesRead;
                    let read = danglyBits + data.buffer.toString( 'utf-8', 0, bytesRead );
                    let lines = read.split( /\r\n|\r|\n/gmi );

                    onChunkRead( lines, position + bytesRead, stats.size );

                    danglyBits = lines.pop() ?? '';

                    sendLog( `Lines: ${lines.length}, Bytes read: ${bytesRead}` );

                    if ( bytesRead < chunkSize ) {
                        await file.close();
                        sendLog( 'File closed' );
                        resolve();

                    } else {
                        // counter++;
                        setImmediate( () => this.#doReadLines( file, onChunkRead, position + bytesRead, danglyBits, resolve, reject ) );

                    }
                }
            }
        } catch (error) {
            reject( error );
        }

    }









    
    /**
     * Function to read all lines from a file.
     * 
     * @returns {() => void} On finished callback.
     * 
     * @param {fs.promises.FileHandle} file The file to read from.
     * @param {(lines: string[], bytesRead: number, totalBytes: number) => void} onChunkRead The function to call when a chunk of lines is read.
     * @param {number} position The position to start reading from.
     * @param {string} danglyBits Any dangling bits from the previous read.
     */
    readLines( file, onChunkRead, position = 0, danglyBits = '' ) {
        return new Promise( ( resolve, reject ) => {
            let resolver = ( value ) => {
                resolve(value);
            };
            let rejector = ( reason ) => {
                reject( reason );
            };
            this.#doReadLines( file, onChunkRead, position, danglyBits, resolver, rejector ).catch( error => {
                reject( error );
            } );
        } );
    }









    
    /**
     * Reads the file stats.
     * 
     * @returns {Promise<fs.Stats>} A promise that resolves with the file stats if the file exists, otherwise undefined.
     */
    async checkFile() {
        try {
            let stats = await fsp.stat( this.filePath );
            if ( stats?.isFile() ) {
                return stats;
            } else {
                return undefined;
            }
        } catch ( error ) {
            return undefined;
        }
    }









    
    /**
     * Waits for the log file to exist, and then resolves the promise with the file stats.
     * 
     * @returns {Promise<fs.Stats>} A promise that resolves when the file exists.
     */
    waitForLogFile() {

        let p = new Promise( async ( resolve, reject ) => {
            let stats = await this.checkFile();
            if ( stats ) {
                resolve( stats );
            } else {
                let interval = setInterval( async () => {
                    let stats = await this.checkFile();
                    if ( stats ) {
                        clearInterval( interval );
                        resolve( stats );
                    }
                }, 1000 );
            }
        } );

        return p;
    }









    
    /**
     * Stops monitoring the log file and returns the position of the last read line.
     * 
     * @returns {Promise<number>} On finished callback.
     */
    stopMonitoringLogFile() {
        return new Promise( ( resolve, reject ) => {
            if ( this.#monitoring ) {
                this.#stopMonitor = true;
                this.#onStopped = ( position ) => {
                    this.#stopMonitor = false;
                    resolve( position );
                };
            } else {
                resolve();
            }
        } );
    }









    
    /**
     * 
     * @param {(lines: string[]) => boolean} onChunkRead The function to call when a chunk of lines is read, if it returns true the operation will continue.
     * @param {(value: any) => void} resolve The function to call when the operation is complete.
     * @param {(reason: any) => void} reject The function to call when the operation fails.
     * @param {number} position The position to start reading from.
     * @param {string} danglyBits Any dangling bits from the previous read.
     * @param {number} bytesRead The number of bytes read so far.
     */
    async #doBackfind( onChunkRead, resolve, reject, position = null, danglyBits = '', bytesRead = 0 ) {
        
        /** @type {fs.promises.FileHandle} */
        let file;

        try {

            let stats = await this.waitForLogFile();
            file = await fsp.open( this.filePath, 'r' );

            const parse = async () => {
                
                let myChunkSize = stats.size < chunkSize ? stats.size : chunkSize;
                position = ( position === null || position === undefined ) ? stats.size : position;
                let start = stats.size - myChunkSize - bytesRead;

                if ( start < 0 ) {
                    start = 0;
                    myChunkSize = stats.size - bytesRead;
                }

                let data = await file.read( Buffer.alloc( myChunkSize ), 0, myChunkSize, start );
                bytesRead += data.bytesRead;
                let read = data.buffer.toString( 'utf-8', 0, bytesRead );
                let lines = read.split( /\r\n|\r|\n/gmi );

                if ( position < stats.size ) {
                    lines[ lines.length - 1 ] += danglyBits;
                }
                danglyBits = lines.shift() ?? '';

                let moreToRead = onChunkRead( lines );

                position -= data.bytesRead;

                if ( moreToRead && position > 0 ) {
                    this.#readErrorCount = 0;
                    setTimeout( () => parse(), readDelayMs );
                } else {
                    await file.close();
                    sendLog( 'Backfind finished.' );
                    resolve();
                }
            };
            setTimeout( () => parse(), readDelayMs );


        } catch ( error ) {
            sendException( {
                label: 'LogMonitor.Backfind',
                message: `${error}`,
                payload: error,
            } );

            if ( file ) {
                await file.close();
            }

            this.#readErrorCount++;
            if ( this.#readErrorCount >= maxReadErrors ) {
                this.#monitoring = false;
                reject( error );
            } else {
                setTimeout( () => this.#doBackfind( onChunkRead, resolve, reject, position, danglyBits, bytesRead ), readErrorDelayMs );
            }
        }
    }









    
    /**
     * 
     * @param {(lines: string[]) => boolean} onChunkRead The function to call when a chunk of lines is read, if it returns true, the operation will continue.
     */
    backfind( onChunkRead ) {
        return new Promise( ( resolve, reject ) => {
            let resolver = ( value ) => {
                resolve( value );
            };
            let rejector = ( reason ) => {
                reject( reason );
            };
            this.#doBackfind( onChunkRead, resolver, rejector ).catch( error => {
                reject( error );
            } );
        } );
    }









    
    /**
     * Function to monitor new lines from a file.
     * 
     * @param {(lines: string[]) => void} onChunkRead The function to call when a chunk of lines is read.
     * @param {(value: any) => void} resolve The function to call when the operation is complete.
     * @param {(reason: any) => void} reject The function to call when the operation fails.
     * @param {number} position The position to start reading from.
     * @param {string[]} prevLines The previous lines read.
     */
    async #doMonitorLines( onChunkRead, resolve, reject, position = 0, prevLines = [] ) {

        // Ensure prevLines is an array.
        if ( !Array.isArray( prevLines ) ) {
            prevLines = [];
        }

        /** @type {fs.promises.FileHandle} */
        let file;

        try {

            let stats = await this.checkFile();
            file = await fsp.open( this.filePath, 'r' );

            let emptyReadCount = 0;
            let readCount = 0;

            const parse = async () => {

                let exists = fs.existsSync( this.filePath );

                if ( !exists ) {
                    sendLog( `File Monitor > ${this.filePath} does not exist, waiting for new log file.` );
                    stats = await this.waitForLogFile();
                    file?.close();
                    file = await fsp.open( this.filePath, 'r' );
                }

                stats = await this.checkFile();

                if ( stats.size < position ) {
                    sendLog( `File Monitor > ${this.filePath} exists, resetting read position.` );
                    position = 0;
                }

                const readSize = stats.size - position;
                if ( readSize > 0 && readSize < 26 ) {
                    sendLog( {
                        label: 'File Monitor',
                        message: `File size is too small: ${readSize} bytes.`,
                        payload: { readSize, position, stats },
                    } );
                    setTimeout( () => parse(), readDelayMs );
                    return;
                }

                try {
                    let data = await file.read( Buffer.alloc( readSize ), 0, readSize, position );
                    let bytesRead = data.bytesRead;

                    if ( bytesRead === 0 && readSize > 0 ) {
                        // No data read, try again.
                        nagLog( `No data read, trying again.`, 'File Monitor', { position, readSize, bytesRead } );
                        
                        stats = await this.waitForLogFile();
                        file?.close();
                        file = await fsp.open( this.filePath, 'r' );

                        this.#readErrorCount++;

                        setTimeout( () => parse(), readDelayMs );
                        return;
                    }

                    position += bytesRead;
                    let read = data.buffer.toString( 'utf-8', 0, bytesRead );

                    readCount += 1;
                    if ( read.length === 0 && prevLines.length > 0 ) {
                        emptyReadCount += 1;
                    } else {
                        emptyReadCount = 0;
                    }
                    
                    let lines = read.split( /\r\n|\r|\n/gmi ).filter( l => l?.length > 0 );
    
                    if ( prevLines.length > 0 ) {
                        if ( lines.length > 0 ) {
                            if ( !prevLines[ prevLines.length - 1 ].match( /^\[(.*?)\]\s*/i ) || !lines[ 0 ].match( /^\[(.*?)\]\s*/i ) ) {
                                prevLines[ prevLines.length - 1 ] += lines.shift();
                            }
    
                            onChunkRead( prevLines );
                            prevLines = lines;
    
                            readCount = 0;
                            emptyReadCount = 0;
                        }
                        
                        if ( emptyReadCount > flushCount ) {
                            
                            onChunkRead( prevLines );
                            prevLines = [];
                            readCount = 0;
                            emptyReadCount = 0;
                        }
                    } else {
                        prevLines = lines;
                    }
    
                    if ( !this.#stopMonitor ) {
                        this.#readErrorCount = 0;
                        setTimeout( () => parse(), readDelayMs );
    
                    } else {
                        await file.close();
                        this.#monitoring = false;
    
                        if ( this.#onStopped ) {
                            this.#onStopped( position );
                        }
    
                        resolve();
                    }

                } catch ( error ) {

                    sendException( {
                        label: 'LogMonitor.MonitorLines',
                        message: `${error}`,
                        payload: error,
                    } );

                    if ( file ) {
                        await file.close();
                    }

                    this.#readErrorCount++;
                    if ( this.#readErrorCount >= maxReadErrors ) {
                        this.#monitoring = false;
                        reject( error );
                    } else {
                        setTimeout( () => this.#doMonitorLines( onChunkRead, resolve, reject, position, prevLines ), readErrorDelayMs );
                    }
                }
                

            };

            setTimeout( () => parse(), readDelayMs );

        } catch ( error ) {
            
            sendException( {
                label: 'LogMonitor.MonitorLines',
                message: `${error}`,
                payload: error,
            } );

            if ( file ) {
                await file.close();
            }

            this.#readErrorCount++;
            if ( this.#readErrorCount >= maxReadErrors ) {
                this.#monitoring = false;
                reject( error );
            } else {
                setTimeout( () => this.#doMonitorLines( onChunkRead, resolve, reject, position, prevLines ), readErrorDelayMs );
            }
        }

    }









    
    /**
     * Function to monitor new lines from a file.
     * 
     * @returns {Promise<any>} On finished callback.
     * 
     * @param {(lines: string[]) => void} onChunkRead The function to call when a chunk of lines is read.
     * @param {number} startPosition The position to start reading from.
     */
    monitorLines( onChunkRead, startPosition = 0 ) {
        return new Promise( ( resolve, reject ) => {

            if ( this.#monitoring ) {
                reject( 'Already monitoring file.' );
                sendException( 'Already monitoring file.' );
                return;
            } else {
                this.#monitoring = true;
            }

            let resolver = ( value ) => {
                resolve( value );
            };
            let rejector = ( reason ) => {
                reject( reason );
                sendException( reason );
            };
            this.#doMonitorLines( onChunkRead, resolver, rejector, startPosition ).catch( error => {
                this.#monitoring = false;
                reject( error );
                sendException( error );
            } );
        } );
    }










}

module.exports = FileMonitor;