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
const ArrayUtilities = require( '../utilities/arrays' );
const { DateUtilities } = require( '../utilities/dates' );
const progressCommChannel = 'main:archive:progress';

/**
 * Sends the error information to the main thread for logging.
 * 
 * @param {any} err The error object.
 */
const logError = ( err ) => {
    ipcRenderer.send( 'app:log:exception', err );
};










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
let progressPercent = 0.0;

/**
 * Reports progress to the main thread.
 * 
 * @param {number} current The current operation count.
 * @param {number} max The maximum number of operations.
 * @param {string | void} label The current progress label.  If not provided, uses the previous operation label.
 */
const reportProgress = ( current, max, label ) => {
    progressLabel = label ?? progressLabel;
    progressPercent = current / max;
    ipcRenderer.send( progressCommChannel, { completePercent: progressPercent, label: progressLabel } );
}

const updateProgressLabel = ( label ) => {
    progressLabel = label ?? progressLabel;
    ipcRenderer.send( progressCommChannel, { completePercent: progressPercent, label: progressLabel } );
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
        // TODO: Enable file deletion.
        // fsp.rm( logFile );
    } );

    log.info( 'LogBackup > Clean up done.' );

    reportProgress( writeOperationCount, writeOperationCount, 'Archiving complete' );
    ipcRenderer.send( 'window:child:close' );
}










/**
 * Backups the given list of log files.
 * 
 * @param {string[]} logFilePaths The list of log files to archive.
 * @param {string} everquestInstallFolder The everquest installation folder.
 * @param {number[]} daysOfWeek The days of the week for scheduled backups.
 * @param {number} backupIndex The index of this backup event in the history.
 */
const backupBySchedule = async ( logFilePaths, everquestInstallFolder, daysOfWeek, backupIndex ) => {

    const logArchivePath = path.join( everquestInstallFolder, 'Logs', 'LogArchive.zip' );
    const logArchiveProcDir = path.join( everquestInstallFolder, 'Logs', FsUtilities.getFileTimestamp() + '_Archiving' );
    const archiveExists = fs.existsSync( logArchivePath );
    let archive = archiveExists ? new AdmZip( logArchivePath ) : new AdmZip();

    if ( !fs.existsSync( logArchiveProcDir ) ) {
        await fsp.mkdir( logArchiveProcDir );
    }

    /** @type {string[]} */
    let archiveFileSources = [];

    for ( let lfi = 0; lfi < logFilePaths.length; lfi++ ) {

        const logFile = logFilePaths[ lfi ];
        const fileName = FsUtilities.Path.getFilename( logFile );
        const stats = await fsp.stat( logFile );

        let max = Math.ceil( stats.size / maxArchiveFileSize );
        let pos = 0;
        let counter = 0;
        /** @type {Date|null} */
        let logDate = null;

        // Uncaught (in promise) Error: ENOENT: no such file or directory, stat 'D:\code\antix-parse\1680325200000_archive_eqlog_Ryvn_rizlona.txt'

        const streamData = ( sFileName, lines, fileSize, retryCount ) => {
            let p = new Promise( async resolve => {
                
                retryCount = retryCount >= 0 ? retryCount : 0;
                const fullPath = path.join( logArchiveProcDir, sFileName );

                updateProgressLabel( 'Writing Data ...' );
                
                if ( !fs.existsSync( fullPath ) ) {
                    
                    let writer = fs.createWriteStream( fullPath );
                    writer.on( 'open', fd => {
                        for ( let i = 0; i < lines.length; i++ ) {
                            writer.write( `${lines[ i ]}\r\n` );
                        }
                        writer.close( () => {
                            resolve();
                        } );
                    } );

                } else if ( await fsp.access( fullPath, fs.constants.F_OK | fs.constants.R_OK | fs.constants.W_OK ) ) {
                    
                    let start = await fsp.stat( fullPath );
                    let writer = fs.createWriteStream( fullPath, { start: start } );
                    writer.on( 'open', fd => {
                        for ( let i = 0; i < lines.length; i++ ) {
                            writer.write( `${lines[ i ]}\r\n` );
                        }
                        writer.close( () => {
                            resolve();
                        } );
                    } );
                
                } else if ( retryCount < 5 ) {
                    
                    await ThreadUtilities.sleep( 1000 );
                    return await streamData( sFileName, lines, ++retryCount );

                } else {
                    
                    logError( new Error( `Could not gain write access to the file: ${fullPath}` ) );
                    return false;

                }

                // reportProgress( ArrayUtilities.getSize( lines ), fileSize );
                ArrayUtilities.distinctPush( archiveFileSources, sFileName );
                return true;
                
            } );

            return p;
        }

        // TODO: Remove this function.
        const writeData = async ( wFileName, lines, fileSize, retryCount ) => {
            retryCount = retryCount >= 0 ? retryCount : 0;
            const fullPath = path.join( logArchiveProcDir, wFileName );

            if ( !fs.existsSync( fullPath ) ) {
                await fsp.writeFile( fullPath, lines );

            } else if ( await fsp.access( fullPath, fs.constants.F_OK | fs.constants.R_OK | fs.constants.W_OK ) ) {
                await fsp.appendFile( fullPath, lines );
                
            } else if ( retryCount < 5 ) {
                await ThreadUtilities.sleep( 1000 );
                return await writeData( wFileName, lines, ++retryCount );

            } else {
                logError( new Error( `Could not gain write access to the file: ${fullPath}` ) );
                return false;

            }

            // reportProgress( ArrayUtilities.getSize( lines ), fileSize );
            ArrayUtilities.distinctPush( archiveFileSources, wFileName );
            return true;
        };

        // Uncaught (in promise) Error: ENOENT: no such file or directory, access 'E:\EverQuest\Logs\-20230409_41761056_Archiving\1680325200000_archive_eqlog_Ryvn_rizlona.txt'

        reportProgress( 0, stats.size, `Reading Log: ${fileName}` );
        for ( let i = 0; i < max; i++ ) {
            
            let chunkBuffer = await readChunk( logFile, stats, pos );
            pos += chunkBuffer.length;

            // const currentFileName = FsUtilities.Path.prependFilename( fileName, logDate.getTime().toString() );

            let read = chunkBuffer.toString( 'utf-8', 0, chunkBuffer.byteLength );
            let lines = read.split( /\r\n|\r|\n/gmi );
            let logLines = [];
            let processedSize = 0;
            let reportedProgress = 0;

            // Read the timestamp from each line, and start a new archive file source when reaching the next archive date.
            for ( let li = 0; li < lines.length; li++ ) {
                const line = lines[ li ];
                const lineDateMatch = /^\[(.*?)\]\s*/gi.exec( line );

                if ( lineDateMatch ) {
                    var lineDate = new Date( lineDateMatch[ 1 ] );
                    lineDate.setHours( 0, 0, 0, 0 );

                    if ( logDate == null ) {
                        // We need to initialize the first archive date.
                        logDate = lineDate;
                        while ( daysOfWeek.indexOf( logDate.getDay() ) === -1 ) {
                            logDate = DateUtilities.addDays( logDate, -1 );
                        }
                    }

                    // If the line date is greater than the log date, and the 
                    // line date is in the days of the week, we need to flush 
                    // and start a new archive source file.
                    if ( lineDate.getTime() > logDate.getTime() && daysOfWeek.indexOf( lineDate.getDay() ) > -1 ) {

                        await streamData( FsUtilities.Path.prependFilename( fileName, `${logDate.getTime()}_` ), logLines, stats.size );
                        // await writeData( FsUtilities.Path.prependFilename( fileName, `${logDate.getTime()}_` ), logLines, stats.size );

                        // processedSize += ArrayUtilities.getSize( logLines );
                        logLines = [];
                        logDate = lineDate;
                    }

                    logLines.push( line );
                    processedSize += line.length;
                    let prg = Math.round( ( processedSize / stats.size ) * 100 );
                    if ( prg > reportedProgress ) {
                        reportedProgress = prg;
                        reportProgress( processedSize, stats.size, `Reading Log: ${fileName}` );
                    }

                }
            } // Next line

            // We're done processing this chunk, let's flush what we have
            // before moving on to the next chunk.
            await streamData( FsUtilities.Path.prependFilename( fileName, `${logDate.getTime()}_` ), logLines, stats.size );
            
            reportProgress( processedSize, stats.size, `Reading Log: ${fileName}` );

        } // Next Chunk

    }

    /** @type {{logFile: string, stats: fs.Stats & fs.BigIntStats}[]} */
    let logFilesMeta = [];

    for ( let li = 0; li < archiveFileSources.length; li++ ) {
        logFilesMeta.push( {
            logFile: archiveFileSources[ li ],
            stats: await fsp.stat( path.join( logArchiveProcDir, archiveFileSources[ li ] ) )
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
        
        reportProgress( writeCount, writeOperationCount, `${FsUtilities.Path.getFilename( logFileMeta.logFile )}` );
            
        let _fileName = FsUtilities.Path.getFilename( logFileMeta.logFile );
        let fileNameParts = _fileName.split( /_(.*)/ );
        let archiveDate = new Date( +fileNameParts[ 0 ] );
        let aFileName = fileNameParts[ 1 ];
        let datePrefix = `${archiveDate.getFullYear()}-${( archiveDate.getMonth() + 1 ).toString().padStart( 2, '0' )}${archiveDate.toLocaleDateString( 'en-us', { month: "short" } )}-${archiveDate.getDate().toString().padStart( 2, '0' )}${archiveDate.toLocaleDateString( 'en-us', { weekday: "short" } )}-`;
        
        // If the file is greater than the max archive size, we need to stream
        // it into the archive in chunks.
        // However, if the file is just barely over we can still put the whole 
        // thing in the archive.
        if ( logFileMeta.stats.size > ( maxArchiveFileSize * 1.2 ) ) {

            let pos = 0;
            let counter = 0;
            let max = Math.ceil( logFileMeta.stats.size / maxArchiveFileSize );
            
            for ( let i = 0; i < max; i++ ) {
                
                let chunkBuffer = await readChunk( path.join( logArchiveProcDir, logFileMeta.logFile ), logFileMeta.stats, pos );
                pos += chunkBuffer.length;

                const archiveName = datePrefix + `[${backupIndex}]` +  FsUtilities.Path.appendFilename( aFileName.replace('archive_',''), `-${++counter}` );

                log.info( `LogBackup > Adding to the archive: ${_fileName}.` );
                archive.addFile( archiveName, chunkBuffer );
                await writeChunk( archive, logArchivePath );
                writeCount++;
                archive = new AdmZip( logArchivePath );

                reportProgress( writeCount, writeOperationCount );
            }

        } else {
            const archiveName = datePrefix + `[${backupIndex}]` + FsUtilities.Path.getFilename( aFileName ).replace('archive_','');

            log.info( `LogBackup > Adding to the archive: ${_fileName}.` );
            archive.addLocalFile( path.join( logArchiveProcDir, logFileMeta.logFile ), '', archiveName );

            await writeChunk( archive, logArchivePath );
            archive = new AdmZip( logArchivePath );
            writeCount++;

            reportProgress( writeCount, writeOperationCount );
        }

        // Make sure we track the processed files to perform cleanup.
        processedFiles.push( logFileMeta.logFile );

    }

    log.info( 'LogBackup > Backup done, beginning cleanup.' );
    
    log.info( 'LogBackup > Deleting archive source files.' );
    for ( let i = 0; i < archiveFileSources.length; i++ ) {
        const fullPath = path.join( logArchiveProcDir, archiveFileSources[ i ] );
        await fsp.rm( fullPath );
    }
    
    log.info( 'LogBackup > Deleting archive source folder.' );
    await fsp.rmdir( logArchiveProcDir );

    logFilePaths.forEach( async logFile => {
        log.info( `LogBackup > Deleting file ${logFile}` );
        // TODO: Enable file deletion.
        // fsp.rm( logFile );
        await fsp.rename( logFile, FsUtilities.Path.prependFilename( logFile, FsUtilities.getFileTimestamp() ) );
    } );

    log.info( 'LogBackup > Clean up done.' );

    reportProgress( writeOperationCount, writeOperationCount, 'Archiving complete' );
    ipcRenderer.send( 'window:child:close' );
}

// TODO: This process should be complete and working, but not tested.  The last bit is to start the process at the scheduled times and to allow the user to change the schedule and immediately begin the process.
// TODO: The only question left is, can AdmZip append to the same file in the archive.  This process will leave the current period half backed up andd count on the next run time to complete the current period.
//      ex: Backups on monday, start the backup on wednesday.  The current week's mon->wed will be backed up into the archive, and on monday next week the current weeks new logs should be appended to that log file.  Worse case we start a new counter as if the file were too large.










/**
 * Initializes the log watcher.
 * 
 * @param {string[]} character The character details.
 * @param {string} logPosition The starting log position.
 * @param {number[]} daysOfWeek The days of the week for scheduled backups.
 * @param {number} backupIndex The index of this backup event in the history.
 */
function LogBackup( logFiles, everquestInstallFolder, daysOfWeek, backupIndex ) {
    if ( daysOfWeek == null || daysOfWeek.length === 0 ) {
        backup( logFiles, everquestInstallFolder ).then( () => { } );
    } else {
        backupBySchedule( logFiles, everquestInstallFolder, daysOfWeek ?? [], backupIndex ?? 0 ).then( () => { } );
    }
}










module.exports = LogBackup;
