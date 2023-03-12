const { ipcRenderer } = require( 'electron' );
const fs = require('fs');
const fsp = fs.promises;
const FsUtilities = require( "../utilities/file-system" );
const log = require( 'electron-log' );
const path = require( "path" );
const AdmZip = require( "adm-zip" );
const ThreadUtilities = require( '../utilities/threading' );
const maxArchiveFileSize = 512 * 1024 * 1024; // 500 MiB
const _ = require( 'lodash' );
const progressCommChannel = 'main:archive:progress';










/**
 * Reads a chunk of the given log file.
 * 
 * @returns {Promise<Buffer>} Returns a buffer.
 * 
 * @param {string} logFile The log file to read
 * @param {fs.Stats & fs.BigIntStats} fileStats The file stats of the log file.
 * @param {number} startPos Start reading at this position.
 */
const readChunk = ( logFile, fileStats, startPos ) => {

    /** @type {Promise<Buffer>} */
    let p = new Promise( resolve => {
        fs.open( logFile, 'r', ( err, fileNo ) => {
            if ( err ) {
                resolve( null );
            } else {

                startPos = startPos > 0 ? startPos : 0;
                let readSize = fileStats.size - startPos;
                let myChunkSize = readSize > maxArchiveFileSize ? maxArchiveFileSize : readSize;


                fs.read( fileNo, Buffer.alloc( myChunkSize ), 0, myChunkSize, startPos, ( err, bytecount, buff ) => {
                
                    let i = buff.length - 1;
                    for ( ; i >= 0; i-- ) {
                        if ( buff[ i ] == 13 || buff[ i ] == 10 ) {
                            break;
                        }
                    }

                    let fullLinesBuffer = Buffer.alloc( i + 1 );
                    buff.copy( fullLinesBuffer, 0, 0, i + 1 );

                    resolve( fullLinesBuffer );

                } );

            }
        } );
    } );

    return p;
};










/**
 * Writes the current chunk data.
 * 
 * @returns Returns an error object if an error was thrown.
 * 
 * @param {AdmZip} archive The AdmZip object.
 * @param {string} logArchivePath The full file path to the archive.
 */
const writeChunk = ( archive, logArchivePath ) => {

    let p = new Promise( resolve => {

        archive.writeZip( logArchivePath, error => {
    
            if ( error ) {
                log.error( error );
    
            }
        
            resolve( { error: error } );

        } );

    } );

    return p;
};










let progressLabel = 'Archiving Log Files ...';

/**
 * Reports progress to the main thread.
 * 
 * @param {number} current The current operation count.
 * @param {number} max The maximum number of operations.
 * @param {string | void} label The current progress label.  If not provided, uses the previous operation label.
 */
const reportProgress = ( current, max, label ) => {
    progressLabel = label ?? progressLabel;
    ipcRenderer.send( progressCommChannel, { completePercent: current / max, label: progressLabel } );
}










/**
 * Backups the given list of log files.
 * 
 * @param {string[]} logFilePaths The list of log files to archive.
 * @param {string} everquestInstallFolder The everquest installation folder.
 */
const backup = async ( logFilePaths, everquestInstallFolder ) => {

    const logArchivePath = path.join( everquestInstallFolder, 'Logs', 'LogArchive.zip' );
    const archiveExists = fs.existsSync( logArchivePath );
    let archive = archiveExists ? new AdmZip( logArchivePath ) : new AdmZip();

    /** @type {{logFile: string, stats: fs.Stats & fs.BigIntStats}[]} */
    let logFilesMeta = [];

    for ( let li = 0; li < logFilePaths.length; li++ ) {
        logFilesMeta.push( {
            logFile: logFilePaths[ li ],
            stats: await fsp.stat( logFilePaths[ li ] )
        } );
    }

    // Count the number of write operations.
    let writeOperationCount = _.sum( logFilesMeta.map( f => f.stats.size > ( maxArchiveFileSize * 1.2 ) ? Math.ceil( f.stats.size / maxArchiveFileSize ) : 1 ) );
    let writeCount = 0;

    reportProgress( writeCount, writeOperationCount, 'Backup Starting' );

    /** @type {string[]} */
    let processedFiles = [];
    while ( logFilesMeta.length > 0 ) {

        const logFileMeta = logFilesMeta.pop();
        
        reportProgress( writeCount, writeOperationCount, FsUtilities.Path.getFilename( logFileMeta.logFile ) );

        // If the file is greater than the max archive size, we need to stream
        // it into the archive in chunks.
        // However, if the file is just barely over we can still put the whole 
        // thing in the archive.
        if ( logFileMeta.stats.size > ( maxArchiveFileSize * 1.2 ) ) {
            
            let pos = 0;
            let counter = 0;
            let fileName = FsUtilities.Path.getFilename( logFileMeta.logFile );

            let max = Math.ceil( logFileMeta.stats.size / maxArchiveFileSize );
            for ( let i = 0; i < max; i++ ) {
                
                let chunkBuffer = await readChunk( logFileMeta.logFile, logFileMeta.stats, pos );
                pos += chunkBuffer.length;

                const archiveName = FsUtilities.Path.appendFilename( fileName, `-${++counter}` );

                log.info( `LogBackup > Adding to the archive: ${archiveName}.` );
                archive.addFile( archiveName, chunkBuffer );
                await writeChunk( archive, logArchivePath );
                writeCount++;
                archive = new AdmZip( logArchivePath );

                reportProgress( writeCount, writeOperationCount );
            }

        } else {
            const archiveName = FsUtilities.Path.getFilename( logFileMeta.logFile );

            log.info( `LogBackup > Adding to the archive: ${archiveName}.` );
            archive.addLocalFile( logFileMeta.logFile, '', archiveName );
            await writeChunk( archive, logArchivePath );
            archive = new AdmZip( logArchivePath );
            writeCount++;

            reportProgress( writeCount, writeOperationCount );
        }

        // Make sure we track the processed files to perform cleanup.
        processedFiles.push( logFileMeta.logFile );

    }

    log.info( 'LogBackup > Backup done, beginning cleanup.' );

    processedFiles.forEach( logFile => {
        log.info( `LogBackup > Deleting file ${logFile}` );
        // fsp.rm( logFile );
    } );

    log.info( 'LogBackup > Clean up done.' );

    reportProgress( writeOperationCount, writeOperationCount, 'Archiving complete' );
    ipcRenderer.send( 'window:child:close' );
}










/**
 * Initializes the log watcher.
 * 
 * @param {string[]} character The character details.
 * @param {string} logPosition The starting log position.
 */
function LogBackup( logFiles, everquestInstallFolder ) {
    backup( logFiles, everquestInstallFolder ).then( () => { } );
}










module.exports = LogBackup;
