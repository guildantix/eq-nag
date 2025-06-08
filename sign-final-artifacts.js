// sign-final-artifacts.js
const path = require('path');
const fs = require('fs');
const childProcess = require('child_process');

require( 'dotenv' ).config( { path: path.join( __dirname, '..', 'code-signer', '.env' ) } );

const TEMP_DIR = path.join(__dirname, 'electron', 'output', 'temp');
if ( !fs.existsSync( TEMP_DIR ) ) {
    fs.mkdirSync( TEMP_DIR, { recursive: true } );
}

exports.default = async function signFinalArtifacts( context ) {
    const { artifactPaths } = context;

    const USER_NAME = process.env.WINDOWS_SIGN_USER_NAME;
    const USER_PASSWORD = process.env.WINDOWS_SIGN_USER_PASSWORD;
    const CREDENTIAL_ID = process.env.WINDOWS_SIGN_CREDENTIAL_ID;
    const USER_TOTP = process.env.WINDOWS_SIGN_USER_TOTP;

    if ( !USER_NAME || !USER_PASSWORD || !CREDENTIAL_ID || !USER_TOTP ) {
        console.warn( `Missing credentials` );
        process.exit( 1 );
    }

    for ( const filePath of artifactPaths ) {
        if ( !filePath.endsWith( '.exe' ) ) continue;

        const exePath = path.resolve( filePath );
        const { name } = path.parse( exePath );
        const tempFile = path.join( TEMP_DIR, name );

        const safeExePath = exePath.replace( /\\/g, '\\\\' );
        const safeTempDir = TEMP_DIR.replace( /\\/g, '\\\\' );
        const codeSignerDir = path.resolve( __dirname, '..', 'code-signer' );
        const setDir = `cd "${codeSignerDir}"`;
        const signFile = `CodeSignTool sign -input_file_path="${safeExePath}" -output_dir_path="${safeTempDir}" -credential_id="${CREDENTIAL_ID}" -username="${USER_NAME}" -password="${USER_PASSWORD}" -totp_secret="${USER_TOTP}"`;
        const moveFile = `move "${tempFile}.exe" "${safeExePath}"`;

        console.log( `🔐 Signing final artifact: ${exePath}` );
        childProcess.execSync( `${setDir} && ${signFile} && ${moveFile}`, { stdio: 'inherit' } );
    }
    
};