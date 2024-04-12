
const fs = require('fs');
const { ipcRenderer } = require( 'electron' );
// const { sendMsg, sendException } = require( './thread-comms' );
const ThreadUtilities = require( './threading' );
const fsp = fs.promises;
const chunkSize = 1024 * 1024 * 384; // Max chunk possible is 512MB, but we'll use 384MB to be safe.
const maxReadErrors = 5;
const readDelayMs = 50;

const sendLog = ( msg, ...args ) => {
    ipcRenderer.send( 'console:message', `${msg}` );
}

const sendException = ( error ) => {
    ipcRenderer.send( 'app:log:exception', error );
}

class FileMonitor {

    #readErrorCount = 0;
    #monitoring = false;
    #stopMonitor = false;
    /** @type {() => void} */
    #onStopped = null;

    /**
     * 
     * @param {string} filePath 
     */
    constructor( filePath ) {
        this.filePath = filePath;
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
                    // allLines = allLines.concat( ...lines );

                    // position += bytesRead;

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

    stopMonitoringLogFile() {
        return new Promise( ( resolve, reject ) => {
            if ( this.#monitoring ) {
                this.#stopMonitor = true;
                this.#onStopped = () => {
                    resolve();
                };
            } else {
                resolve();
            }
        } );
    }

    changeLogFile( filePath ) {
        this.filePath = filePath;
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
        try {
            let stats = await this.waitForLogFile();
            let file = await fsp.open( this.filePath, 'r' );
            let myChunkSize = stats.size < chunkSize ? stats.size : chunkSize;
            position = position ?? stats.size;
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

            if ( moreToRead && position > 0 ) {
                position -= bytesRead;
                setTimeout( () => this.#doBackfind( onChunkRead, resolve, reject, position, danglyBits, bytesRead ), readDelayMs );
            } else {
                resolve();
            }

            // danglyBits = lines.shift() ?? '';

            // sendLog( `Lines: ${lines.length}, Bytes read: ${bytesRead}` );
            // allLines = allLines.concat( ...lines );

            // position += bytesRead;

            if ( bytesRead < chunkSize ) {
                await file.close();
                sendLog( 'File closed' );
                resolve();

            } else {
                // counter++;
                setTimeout( () => this.#doReadLines( file, onChunkRead, position + bytesRead, danglyBits, resolve, reject ), readDelayMs );

            }

        } catch ( error ) {
            reject( error );
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
     * @param {number} position The position to start reading from.
     * @param {string} danglyBits Any dangling bits from the previous read.
     * @param {(value: any) => void} resolve The function to call when the operation is complete.
     * @param {(reason: any) => void} reject The function to call when the operation fails.
     */
    async #doMonitorLines( onChunkRead, resolve, reject, position = 0, danglyBits = '' ) {

        try {

            let stats = await this.checkFile();
            let file = await fsp.open( this.filePath, 'r' );

            const parse = async () => {

                let exists = fs.existsSync( this.filePath );

                stats = await this.checkFile();

                if ( !exists ) {
                    sendLog( `File Monitor > ${this.filePath} does not exist, waiting for new log file.` );
                    stats = await this.waitForLogFile();
                    file?.close();
                    file = await fsp.open( this.filePath, 'r' );
                }

                if ( stats.size < position ) {
                    sendLog( `File Monitor > ${this.filePath} exists, resetting read position.` );
                    position = 0;
                }

                let data = await file.read( Buffer.alloc( stats.size - position ), 0, stats.size - position, position );
                let bytesRead = data.bytesRead;
                position += bytesRead;
                let read = danglyBits + data.buffer.toString( 'utf-8', 0, bytesRead );
                let lines = read.split( /\r\n|\r|\n/gmi ).filter( f => f != '' );

                // If the last line doesn't end with new line, we'll keep it for the next read.
                if ( lines.length > 1 && !read.endsWith( '\n' ) ) {
                    danglyBits = lines.pop();
                } else {
                    danglyBits = '';
                }

                if ( lines.length > 0 ) {
                    onChunkRead( lines );
                }

                if ( !this.#stopMonitor ) {
                    setTimeout( () => parse(), readDelayMs );

                } else {
                    await file.close();
                    this.#monitoring = false;

                    if ( this.#onStopped ) {
                        this.#onStopped();
                    }

                    resolve();
                }

            };

            setTimeout( () => parse(), readDelayMs );

        } catch ( error ) {
            sendException( error );

            this.#readErrorCount++;
            if ( this.#readErrorCount >= maxReadErrors ) {
                this.#monitoring = false;
                reject( error );
            } else {
                setImmediate( () => this.#doMonitorLines( onChunkRead, resolve, reject, position, danglyBits ) );
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
                sendException( error );
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