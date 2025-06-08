import { Octokit } from '@octokit/rest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Required because __dirname doesn't exist in ESM
const __filename = fileURLToPath( import.meta.url );
const __dirname = path.dirname( __filename );

const packageJson = JSON.parse(
    fs.readFileSync( path.join( __dirname, 'package.json' ), 'utf8' )
);

const version = packageJson.version;

const tag = `v${version}`;
const outputDir = path.resolve(__dirname, 'electron/output');
const GH_TOKEN = process.env.GH_TOKEN;

if ( !GH_TOKEN ) {
    console.error( '❌ Missing GH_TOKEN environment variable.' );
    process.exit( 1 );
}

const octokit = new Octokit( { auth: GH_TOKEN } );

// Files to upload
const filesToUpload = [
    `EQ-Nag-Setup-${version}.exe`,
    `EQ-Nag-Setup-${version}.exe.blockmap`,
    `eq_nag_portable.exe`,
    `latest.yml`
].map( filename => ( {
    name: filename,
    path: path.join( outputDir, filename )
} ) ).filter( file => fs.existsSync( file.path ) );

if ( filesToUpload.length === 0 ) {
    console.error( '❌ No files to upload.' );
    process.exit( 1 );
}

( async () => {
    try {
        // Ensure tag exists
        try {
            await octokit.git.getRef( {
                owner: 'guildantix',
                repo: 'eq-nag',
                ref: `tags/${tag}`
            } );
            console.log( `✅ Tag already exists: ${tag}` );
        } catch {
            console.log( `🏷️  Creating tag ${tag}` );
            const refData = await octokit.git.getRef( {
                owner: 'guildantix',
                repo: 'eq-nag',
                ref: 'heads/master', // <-- DO NOT escape or prefix with 'refs/'
            } );
            await octokit.git.createRef( {
                owner: 'guildantix',
                repo: 'eq-nag',
                ref: `refs/tags/${tag}`,
                sha: refData.data.object.sha,
            } );
        }

        // Create or get release
        let release;
        try {
            release = await octokit.repos.getReleaseByTag( {
                owner: 'guildantix',
                repo: 'eq-parse',
                tag
            } );
            console.log( `✅ Release already exists for ${tag}` );
        } catch {
            console.log( `🚀 Creating GitHub release for ${tag}` );
            release = await octokit.repos.createRelease( {
                owner: 'guildantix',
                repo: 'eq-parse',
                tag_name: tag,
                name: `Release ${tag}`,
                draft: true,
                prerelease: false
            } );
        }

        // Upload each file
        for ( const file of filesToUpload ) {
            const fileContent = fs.readFileSync( file.path );
            const fileName = path.basename( file.path );

            await octokit.repos.uploadReleaseAsset( {
                url: release.data.upload_url,
                headers: {
                    'content-type': 'application/octet-stream',
                    'content-length': fileContent.length,
                },
                name: fileName,
                data: fileContent,
            } );

            console.log( `✅ Uploaded: ${fileName}` );
        }


        console.log( '✅ All files uploaded.' );
    } catch ( err ) {
        console.error( '❌ Failed to publish release:', err.message || err );
        process.exit( 1 );
    }
} )();
