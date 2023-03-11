const { ipcRenderer } = require( 'electron' );
const fs = require('fs');
const fsp = fs.promises;
const FsUtilities = require( "../utilities/file-system" );
const log = require( 'electron-log' );
const path = require( "path" );
const AdmZip = require( "adm-zip" );
const maxArchiveFileSize = 512 * 1024 * 1024; // 500 MiB










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
 * Backups the given list of log files.
 * 
 * @param {string[]} logFiles The list of log files to archive.
 * @param {string} everquestInstallFolder The everquest installation folder.
 */
const backup = async ( logFiles, everquestInstallFolder ) => {

    const logArchivePath = path.join( everquestInstallFolder, 'Logs', 'LogArchive.zip' );
    const archiveExists = fs.existsSync( logArchivePath );
    const archive = archiveExists ? new AdmZip( logArchivePath ) : new AdmZip();

    /** @type {string[]} */
    let processedFiles = [];
    while ( logFiles.length > 0 ) {
        const logFile = logFiles.pop();

        let stats = await fsp.stat( logFile );

        // If the file is greater than the max archive size, we need to stream
        // it into the archive in chunks.
        // However, if the file is just barely over we can still put the whole 
        // thing in the archive.
        if ( stats.size > ( maxArchiveFileSize * 1.2 ) ) {
            
            let pos = 0;
            let counter = 0;
            let fileName = FsUtilities.Path.getFilename( logFile );

            let max = Math.ceil( stats.size / maxArchiveFileSize );
            for ( let i = 0; i < max; i++ ) {
                
                let chunkBuffer = await readChunk( logFile, stats, pos );
                pos += chunkBuffer.length;

                const archiveName = FsUtilities.Path.appendFilename( fileName, `-${++counter}` );
                log.info( `Adding ${archiveName} to the archive.` );
                archive.addFile( archiveName, chunkBuffer );
            }

        } else {
            const archiveName = FsUtilities.Path.getFilename( logFile );
            log.info( `Adding ${archiveName} to the archive.` );
            archive.addLocalFile( logFile, '', archiveName );
        }

        // Make sure we track the processed files to perform cleanup.
        processedFiles.push( logFile );

    }

    archive.writeZip( logArchivePath, error => {

        if ( error ) {
            log.error( error );
        } else {

            processedFiles.forEach( logFile => {
                log.info( `Deleting file ${logFile}` );
            } );

        }

        ipcRenderer.send( 'window:child:close' );
    
    } );

}










/**
 * Initializes the log watcher.
 * 
 * @param {string[]} character The character details.
 * @param {string} logPosition The starting log position.
 */
function LogBackup( logFiles, everquestInstallFolder ) {
    log.info( 'Backup execution.', logFiles );
    backup( logFiles, everquestInstallFolder ).then( () => { } );
}

module.exports = LogBackup;
