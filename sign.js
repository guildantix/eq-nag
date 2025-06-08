const path = require( 'path' );
const fs = require( 'fs' );
const childProcess = require( 'child_process' );
const { glob } = require( 'glob' );
const appVersion = require( './package.json' ).version;
const outputFolder = path.resolve( __dirname, 'electron', 'output' );
//const util = require( 'util' );
//const globPromise = util.promisify(glob);

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
    //const exePaths = await globPromise( `${appOutDir}/**/*.exe` );

    const rawExtraPaths = await glob( `${outputFolder}/*.exe` );

    // Only skip old "EQ Nag Setup" installers
    const extraExePaths = rawExtraPaths.filter( p => {
        const filename = path.basename( p );
        return !( filename.startsWith( 'EQ Nag Setup' ) && !filename.includes( appVersion ) );
    } );
    // Combine with unpacked app .exe files
    const unpackedExePaths = await glob( `${appOutDir}/**/*.exe` );
    const exePaths = [ ...new Set( [ ...unpackedExePaths, ...extraExePaths ] ) ].map( p => path.resolve( p ) );

    // const rawPaths = await glob(`${appOutDir}/**/*.exe`);
    // const exePaths = rawPaths.map(p => path.resolve(p));

    for ( const exePath of exePaths ) {
        console.log( `  • Signing ${exePath}` );
        const { name, dir } = path.parse( exePath );
        const tempFile = path.join( TEMP_DIR, name );

        const codeSignerDir = path.resolve(__dirname, '..', 'code-signer');
        const setDir = `cd "${codeSignerDir}"`;
        const safeExePath = exePath.replace( /\\/g, '\\\\' );
        const safeTempDir = TEMP_DIR.replace(/\\/g, '\\\\');
        const signFile = `CodeSignTool sign -input_file_path="${safeExePath}" -output_dir_path="${safeTempDir}" -credential_id="${CREDENTIAL_ID}" -username="${USER_NAME}" -password="${USER_PASSWORD}" -totp_secret="${USER_TOTP}"`;
        const moveFile = `move "${tempFile}.exe" "${exePath}"`;

        childProcess.execSync( `${setDir} && ${signFile} && ${moveFile}`, { stdio: 'inherit' } );
    }
};
