const path = require( 'path' );
const fs = require( 'fs' );
const childProcess = require( 'child_process' );

require( 'dotenv' ).config( { path: path.join( __dirname, '..', 'code-signer', '.env' ) } );

const TEMP_DIR = path.join( __dirname, 'electron', 'output', 'temp' );
if ( !fs.existsSync( TEMP_DIR ) ) {
    fs.mkdirSync( TEMP_DIR, { recursive: true } );
}

module.exports = async function afterSign( context ) {
    const appOutDir = context.appOutDir;

    const USER_NAME = process.env.WINDOWS_SIGN_USER_NAME;
    const USER_PASSWORD = process.env.WINDOWS_SIGN_USER_PASSWORD;
    const CREDENTIAL_ID = process.env.WINDOWS_SIGN_CREDENTIAL_ID;
    const USER_TOTP = process.env.WINDOWS_SIGN_USER_TOTP;

    if ( !USER_NAME || !USER_PASSWORD || !CREDENTIAL_ID || !USER_TOTP ) {
        console.warn( `sign.js - Missing credentials:
      ${USER_NAME ? '' : 'WINDOWS_SIGN_USER_NAME'}
      ${USER_PASSWORD ? '' : 'WINDOWS_SIGN_USER_PASSWORD'}
      ${CREDENTIAL_ID ? '' : 'WINDOWS_SIGN_CREDENTIAL_ID'}
      ${USER_TOTP ? '' : 'WINDOWS_SIGN_USER_TOTP'}
    `);
        process.exit( 1 );
    }

    // Find all .exe files in the appOutDir (recursively, if needed)
    const exeFiles = fs.readdirSync( appOutDir )
        .filter( file => file.endsWith( '.exe' ) )
        .map( file => path.join( appOutDir, file ) );

    for ( const exePath of exeFiles ) {
        console.log( `  • Signing ${exePath}` );
        const { name, dir } = path.parse( exePath );
        const tempFile = path.join( TEMP_DIR, name );

        const setDir = `cd ../code-signer`;
        const signFile = `CodeSignTool sign -input_file_path="${exePath}" -output_dir_path="${TEMP_DIR}" -credential_id="${CREDENTIAL_ID}" -username="${USER_NAME}" -password="${USER_PASSWORD}" -totp_secret="${USER_TOTP}"`;
        const moveFile = `move "${tempFile}.exe" "${dir}"`;

        childProcess.execSync( `${setDir} && ${signFile} && ${moveFile}`, { stdio: 'inherit' } );
    }
};
