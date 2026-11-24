const fs = require( 'fs' );
const path = require( 'path' );

// A log file name such as eqlog_Soandso_testserver.txt.  A prefix is tolerated, so a renamed
// copy such as 2024-05-01-eqlog_Soandso_testserver.txt or archive_eqlog_Soandso_testserver.txt
// still works.
const logFileNameRgx = /^(?:.*?)eqlog_([^_\/]+)_([^\/]+?)\.txt$/i;

const notLogFileMessage = 'This doesn\'t look like an EverQuest log file (eqlog_Name_server.txt).';

/**
 * Returns the character name in the given log file name, or null when the name is not an
 * EverQuest log file name.
 *
 * @returns {string | null} The character name.
 *
 * @param {string} fileName The file name, without a folder.
 */
function parseCharacterNameFromLogFileName( fileName ) {
    if ( typeof fileName !== 'string' ) {
        return null;
    }
    const match = logFileNameRgx.exec( fileName );
    return match === null ? null : match[ 1 ];
}










/**
 * Checks a log file that the user picked, before it is scanned.  It has to exist, be a file, be a
 * .txt file and have a name that gives a character.
 *
 * @returns {{ ok: boolean, message: string, characterName: string }} Whether the file can be
 *     scanned, why not, and the character name of the file.
 *
 * @param {any} filePath The path of the picked file.
 */
function validateLogFile( filePath ) {
    const rejected = message => ( { ok: false, message: message, characterName: '' } );

    if ( typeof filePath !== 'string' || filePath === '' ) {
        return rejected( 'No file was chosen.' );
    }
    if ( path.extname( filePath ).toLowerCase() !== '.txt' ) {
        return rejected( 'Only .txt log files can be scanned.' );
    }

    let stats;
    try {
        stats = fs.statSync( filePath );
    } catch ( error ) {
        return rejected( 'The file was not found.' );
    }
    if ( !stats.isFile() ) {
        return rejected( 'That is not a file.' );
    }

    const characterName = parseCharacterNameFromLogFileName( path.basename( filePath ) );
    if ( characterName === null ) {
        return rejected( notLogFileMessage );
    }
    return { ok: true, message: '', characterName: characterName };
}

module.exports = { parseCharacterNameFromLogFileName, validateLogFile, notLogFileMessage };
