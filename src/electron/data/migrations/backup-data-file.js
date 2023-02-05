const electron = require( 'electron' );
const path = require( 'path' );
const fs = require( 'fs' );
const archiver = require( 'archiver' );

/**
 * Backs up the given config file.
 * 
 * @param {string} configName The name of the config file.
 * @param {(backupFile: string) => void} onComplete Executed when the operation succeeds.
 */
function backupDatafile( configName, onComplete ) {
    const userDataPath = ( electron.app || electron.remote.app ).getPath( 'userData' );
    const fullFileName = path.join( userDataPath, configName + '.json' );
    const backupFolder = 'migrations_backup';

    if ( !fs.existsSync( path.join( userDataPath, backupFolder ) ) ) {
        fs.mkdirSync( path.join( userDataPath, backupFolder ) );
    }

    let now = new Date( Date.now() );
    let backupFile = path.join( userDataPath, backupFolder, `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDay() + 1}-${now.getSeconds()}-${configName}-backup.zip` );
    let output = fs.createWriteStream( backupFile );
    let zip = archiver( 'zip' );

    output.on( 'close', () => {
        onComplete( backupFile );
    } );

    zip.pipe( output );
    zip.file( fullFileName, { name: configName + '.json' } );
    zip.finalize();
}

module.exports = { backupDatafile };
