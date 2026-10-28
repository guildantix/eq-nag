const fs = require( 'fs' );
const path = require( 'path' );
const crypto = require( 'crypto' );
const zlib = require( 'zlib' );
const AdmZip = require( 'adm-zip' );

/** @type {string[]} The file extensions that can be imported. */
const allowedExtensions = [ '.nag', '.zip', '.json' ];
/** The largest file, in bytes, that will be opened. */
const maxFileBytes = 25 * 1024 * 1024;
/** The largest total declared uncompressed size, in bytes, of a zip's entries. */
const maxUnpackedBytes = 50 * 1024 * 1024;
/** The most entries a zip may contain. */
const maxZipEntries = 20;
/** The largest size, in bytes, a single zip entry may inflate to. */
const maxEntryBytes = 25 * 1024 * 1024;
/** The most folder levels a share may nest. */
const maxFolderDepth = 50;
/** JSON keys that are dropped while parsing. */
const forbiddenKeys = [ '__proto__', 'constructor', 'prototype' ];
/** The most unknown action keys reported in a warning. */
const maxReportedKeys = 10;

/**
 * @typedef {object} ShareManifest
 * @property {string} app Always 'EQNAG'.
 * @property {string} version The app version that wrote the file.
 * @property {string} type The content type, 'triggers'.
 */

/**
 * @typedef {object} SharePayload
 * @property {any[]} quickShares The quick shares, in the shape of the receive quick share dialog.
 * @property {any[]} files The audio files used by the quick shares.
 */

/**
 * @typedef {object} ShareWarning
 * @property {string} code The warning code, 'newerVersion'.
 * @property {string} fileVersion The app version that wrote the file.
 * @property {string[]} unknownKeys Action keys this version does not know, up to 10.
 */

/**
 * @typedef {object} ShareFileResult
 * @property {boolean} ok True when the file was read and validated.
 * @property {SharePayload} [payload] The share payload, when ok.
 * @property {ShareManifest | null} [manifest] The manifest, or null for a raw json file, when ok.
 * @property {ShareWarning[]} [warnings] Non-fatal warnings, when ok.
 * @property {string} [code] One of wrongType, tooLarge, unpackTooLarge, notNagFile, damaged, when not ok.
 * @property {string} fileName The name of the file, without its folder.
 * @property {string} [details] A short description of the failure, when not ok.
 */

/**
 * Returns a failed result.
 *
 * @returns {ShareFileResult}
 *
 * @param {string} code The error code.
 * @param {string} fileName The file name.
 * @param {string} details A short description of the failure.
 */
function fail( code, fileName, details ) {
    return { ok: false, code: code, fileName: fileName, details: details };
}










/**
 * Returns true if the value is a non-null, non-array object.
 *
 * @returns {boolean}
 *
 * @param {any} value The value to check.
 */
function isObject( value ) {
    return value !== null && typeof value === 'object' && !Array.isArray( value );
}










/**
 * Returns null when the payload has the structure the receive quick share dialog needs, otherwise a description of the problem.
 *
 * @returns {string | null}
 *
 * @param {any} payload The parsed share payload.
 */
function checkPayloadShape( payload ) {

    if ( !isObject( payload ) ) {
        return 'The share is not an object.';
    }

    if ( !Array.isArray( payload.quickShares ) || payload.quickShares.length === 0 ) {
        return 'The share has no quickShares list.';
    }

    if ( payload.files !== undefined && payload.files !== null && !Array.isArray( payload.files ) ) {
        return 'The share files are not a list.';
    }

    for ( const quickShare of payload.quickShares ) {

        if ( !isObject( quickShare ) || !isObject( quickShare.model ) ) {
            return 'A quick share has no model.';
        }

        if ( !Array.isArray( quickShare.model.triggers ) || !Array.isArray( quickShare.model.folders ) ) {
            return 'A quick share model has no triggers or folders list.';
        }

        for ( const trigger of quickShare.model.triggers ) {
            if ( !isObject( trigger ) || typeof trigger.triggerId !== 'string' ) {
                return 'A trigger has no id.';
            }
            if ( trigger.actions !== undefined && !Array.isArray( trigger.actions ) ) {
                return 'A trigger has an invalid actions list.';
            }
            if ( trigger.capturePhrases !== undefined && !Array.isArray( trigger.capturePhrases ) ) {
                return 'A trigger has an invalid capture phrases list.';
            }
        }

        let folderProblem = checkFolders( quickShare.model.folders );
        if ( folderProblem ) {
            return folderProblem;
        }

        if ( quickShare.model.overlays !== undefined && !Array.isArray( quickShare.model.overlays ) ) {
            return 'A quick share model has an invalid overlays list.';
        }

    }

    for ( const file of payload.files ?? [] ) {
        if ( !isObject( file ) || typeof file.fileId !== 'string' ) {
            return 'A file has no id.';
        }
    }

    return null;

}










/**
 * Returns null if every folder in the hierarchy has an id and a valid children list, otherwise a description of the problem.
 * The hierarchy is walked without recursion and may not nest deeper than the maximum folder depth.
 *
 * @returns {string | null}
 *
 * @param {any[]} folders The folder hierarchy.
 */
function checkFolders( folders ) {

    /** @type {{ list: any[], depth: number }[]} */
    let pending = [ { list: folders, depth: 1 } ];

    while ( pending.length > 0 ) {
        let { list, depth } = pending.pop();

        if ( list.length === 0 ) {
            continue;
        }

        if ( depth > maxFolderDepth ) {
            return `Folders are nested more than ${maxFolderDepth} levels deep.`;
        }

        for ( const folder of list ) {
            if ( !isObject( folder ) || typeof folder.folderId !== 'string' ) {
                return 'A folder is invalid.';
            }
            if ( folder.children !== undefined && folder.children !== null ) {
                if ( !Array.isArray( folder.children ) ) {
                    return 'A folder is invalid.';
                }
                pending.push( { list: folder.children, depth: depth + 1 } );
            }
        }
    }

    return null;

}










/**
 * Fills in the fields the receive quick share dialog and installer expect, so a share without a server record can be imported.
 * Shares from a file are never marked as trusted.
 *
 * @returns {SharePayload} Returns the same payload, normalized.
 *
 * @param {SharePayload} payload A payload that passed the shape check.
 */
function normalizePayload( payload ) {

    payload.files = payload.files ?? [];

    for ( const quickShare of payload.quickShares ) {

        let contentId = crypto
            .createHash( 'sha256' )
            .update( JSON.stringify( { triggers: quickShare.model.triggers, folders: quickShare.model.folders } ) )
            .digest( 'hex' )
            .slice( 0, 16 );

        // Ids from the file are ignored so an import can never replace an installed share.
        quickShare.quickShareId = `file-${contentId}`;
        quickShare.versionId = contentId;
quickShare.author = typeof quickShare.author === 'string' ? quickShare.author : '';
        quickShare.authorDiscord = typeof quickShare.authorDiscord === 'string' ? quickShare.authorDiscord : '';
        quickShare.trustedAuthor = false;
        quickShare.stageNewTriggers = false;
        quickShare.model.overlays = quickShare.model.overlays ?? [];

    }

    return payload;

}










/**
 * Returns the numeric major, minor and revision parts of a version, or null if it cannot be parsed.
 *
 * @returns {number[] | null}
 *
 * @param {string} version The version text.
 */
function parseVersion( version ) {
    let match = /(\d+)\.(\d+)\.(\d+)/.exec( version );
    return match ? [ +match[ 1 ], +match[ 2 ], +match[ 3 ] ] : null;
}










/**
 * Returns true if version a is newer than version b. Unparseable versions are never newer.
 *
 * @returns {boolean}
 *
 * @param {string} a The first version.
 * @param {string} b The second version.
 */
function isNewerVersion( a, b ) {
    let av = parseVersion( a );
    let bv = parseVersion( b );

    if ( !av || !bv ) {
        return false;
    }

    for ( let i = 0; i < 3; i++ ) {
        if ( av[ i ] !== bv[ i ] ) {
            return av[ i ] > bv[ i ];
        }
    }

    return false;
}










/**
 * Returns the action keys in the payload that this version's trigger action model does not have.
 *
 * @returns {string[]} Returns up to the first ten unknown keys.
 *
 * @param {SharePayload} payload The validated payload.
 */
function findUnknownActionKeys( payload ) {

    /** @type {Set<string>} */
    let known;
    try {
        const { TriggerAction } = require( '../data/models/trigger' );
        known = new Set( Object.keys( new TriggerAction() ) );
    } catch ( error ) {
        return [];
    }

    /** @type {Set<string>} */
    let unknown = new Set();

    for ( const quickShare of payload.quickShares ) {
        for ( const trigger of quickShare.model.triggers ) {
            for ( const action of trigger.actions ?? [] ) {
                if ( isObject( action ) ) {
                    Object.keys( action ).forEach( key => !known.has( key ) && unknown.add( key ) );
                }
            }
        }
    }

    return Array.from( unknown ).slice( 0, maxReportedKeys );

}










/**
 * Builds the contents of a .nag file, a zip holding manifest.json and share.json.
 *
 * @returns {Buffer} Returns the zip file contents.
 *
 * @param {SharePayload} payload The share payload, in the shape of the receive quick share dialog.
 * @param {string} appVersion The running app version.
 */
function buildShareBuffer( payload, appVersion ) {

    let problem = checkPayloadShape( payload );
    if ( problem ) {
        throw new Error( `Invalid share payload. ${problem}` );
    }

    /** @type {ShareManifest} */
    let manifest = { app: 'EQNAG', version: appVersion, type: 'triggers' };

    let zip = new AdmZip();
    zip.addFile( 'manifest.json', Buffer.from( JSON.stringify( manifest, null, 2 ), 'utf8' ) );
    zip.addFile( 'share.json', Buffer.from( JSON.stringify( normalizePayload( payload ) ), 'utf8' ) );

    return zip.toBuffer();

}










/**
 * Writes a .nag file.
 *
 * @returns {{ ok: boolean, code?: string }} Returns ok, or the tooLarge code if the file would be too big to import again.
 *
 * @param {string} filePath The full file path.
 * @param {SharePayload} payload The share payload, in the shape of the receive quick share dialog.
 * @param {string} appVersion The running app version.
 */
function writeShareFile( filePath, payload, appVersion ) {

    let buffer = buildShareBuffer( payload, appVersion );

    if ( buffer.length > maxFileBytes ) {
        return { ok: false, code: 'tooLarge' };
    }

    fs.writeFileSync( filePath, buffer );

    return { ok: true };

}










/**
 * Parses json text, ignoring a leading byte order mark and dropping keys that could alter object prototypes.
 *
 * @returns {any} Returns the parsed value. Throws if the text is not valid json.
 *
 * @param {string} text The json text.
 */
function parseJson( text ) {
    return JSON.parse( text.replace( /^\uFEFF/, '' ), ( key, value ) => forbiddenKeys.includes( key ) ? undefined : value );
}










/**
 * Returns the uncompressed contents of a zip entry, never inflating more than the entry size limit.
 * The entry's own decompression is not used, since it trusts the sizes declared in the zip.
 *
 * @returns {Buffer} Returns the entry contents. Throws an error with a code of unpackTooLarge or damaged.
 *
 * @param {Buffer} buffer The zip file contents.
 * @param {AdmZip.IZipEntry} entry The zip entry.
 */
function unpackEntry( buffer, entry ) {

    let header = entry.header;
    let failWith = ( code, message ) => Object.assign( new Error( message ), { code: code } );

    if ( header.size > maxEntryBytes ) {
        throw failWith( 'unpackTooLarge', 'The entry declares more than the limit.' );
    }

    if ( ( header.flags & 1 ) !== 0 ) {
        throw failWith( 'damaged', 'The entry is encrypted.' );
    }

    header.loadDataHeaderFromBinary( buffer );

    let start = header.realDataOffset;
    let end = start + header.compressedSize;

    if ( start < 0 || end > buffer.length ) {
        throw failWith( 'damaged', 'The entry is outside the file.' );
    }

    let compressed = buffer.subarray( start, end );
    let data;

    if ( header.method === 0 ) {
        data = compressed;
    } else if ( header.method === 8 ) {
        try {
            data = zlib.inflateRawSync( compressed, { maxOutputLength: maxEntryBytes } );
        } catch ( error ) {
            throw failWith( error?.code === 'ERR_BUFFER_TOO_LARGE' ? 'unpackTooLarge' : 'damaged', 'The entry could not be inflated.' );
        }
    } else {
        throw failWith( 'damaged', 'The entry uses an unsupported compression method.' );
    }

    if ( data.length !== header.size ) {
        throw failWith( 'damaged', 'The entry size does not match its header.' );
    }

    return data;

}










/**
 * Reads the manifest and share entries of a zip without extracting anything to disk.
 *
 * @returns {{ manifestText: string, shareText: string } | ShareFileResult} Returns the entry texts, or a failed result.
 *
 * @param {Buffer} buffer The zip file contents.
 * @param {string} fileName The file name.
 */
function readZipEntries( buffer, fileName ) {

    let zip;
    let entries;

    try {
        zip = new AdmZip( buffer );
        entries = zip.getEntries();
    } catch ( error ) {
        return fail( 'damaged', fileName, 'The zip could not be read.' );
    }

    if ( entries.length > maxZipEntries ) {
        return fail( 'notNagFile', fileName, `The zip has ${entries.length} entries.` );
    }

    // Declared sizes come from the entry headers, so nothing is inflated before this check.
    let declaredBytes = entries.reduce( ( total, entry ) => total + entry.header.size, 0 );
    if ( declaredBytes > maxUnpackedBytes ) {
        return fail( 'unpackTooLarge', fileName, `The zip declares ${declaredBytes} bytes unpacked.` );
    }

    let manifestEntry = entries.find( entry => !entry.isDirectory && entry.entryName === 'manifest.json' );
    let shareEntry = entries.find( entry => !entry.isDirectory && entry.entryName === 'share.json' );

    if ( !manifestEntry || !shareEntry ) {
        return fail( 'notNagFile', fileName, 'The zip has no manifest.json and share.json.' );
    }

    try {
        let manifestData = unpackEntry( buffer, manifestEntry );
        let shareData = unpackEntry( buffer, shareEntry );

        if ( manifestData.length + shareData.length > maxUnpackedBytes ) {
            return fail( 'unpackTooLarge', fileName, 'The zip unpacks larger than allowed.' );
        }

        return { manifestText: manifestData.toString( 'utf8' ), shareText: shareData.toString( 'utf8' ) };
    } catch ( error ) {
        if ( error?.code === 'unpackTooLarge' ) {
            return fail( 'unpackTooLarge', fileName, 'The zip unpacks larger than allowed.' );
        }
        return fail( 'damaged', fileName, 'The zip entries could not be unpacked.' );
    }

}










/**
 * Reads and validates a share file. Nothing in the file is ever executed, and no failure is thrown.
 *
 * @returns {ShareFileResult} Returns the payload, manifest and warnings, or the error code.
 *
 * @param {string} filePath The full file path.
 * @param {string} appVersion The running app version.
 */
function readShareFile( filePath, appVersion ) {

    try {
        return readShareFileChecked( filePath, appVersion );
    } catch ( error ) {
        return fail( 'damaged', path.basename( String( filePath ?? '' ) ), 'The file could not be read.' );
    }

}










/**
 * Reads and validates a share file. May throw on unexpected input.
 *
 * @returns {ShareFileResult} Returns the payload, manifest and warnings, or the error code.
 *
 * @param {string} filePath The full file path.
 * @param {string} appVersion The running app version.
 */
function readShareFileChecked( filePath, appVersion ) {

    let fileName = path.basename( String( filePath ?? '' ) );
    let extension = path.extname( fileName ).toLowerCase();

    if ( !allowedExtensions.includes( extension ) ) {
        return fail( 'wrongType', fileName, `Files of type ${extension || 'none'} cannot be imported.` );
    }

    let stat;
    try {
        stat = fs.statSync( filePath );
    } catch ( error ) {
        return fail( 'damaged', fileName, 'The file could not be read.' );
    }

    if ( !stat.isFile() ) {
        return fail( 'damaged', fileName, 'The path is not a file.' );
    }

    if ( stat.size > maxFileBytes ) {
        return fail( 'tooLarge', fileName, `The file is ${stat.size} bytes.` );
    }

    let buffer;
    try {
        buffer = fs.readFileSync( filePath );
    } catch ( error ) {
        return fail( 'damaged', fileName, 'The file could not be read.' );
    }

    let manifest = null;
    let sharePayload;

    try {

        if ( extension === '.json' ) {
            let parsed = parseJson( buffer.toString( 'utf8' ) );

            if ( isObject( parsed ) && isObject( parsed.manifest ) && parsed.share !== undefined ) {
                manifest = parsed.manifest;
                sharePayload = parsed.share;
            } else {
                sharePayload = parsed;
            }

        } else {
            let entries = readZipEntries( buffer, fileName );

            if ( entries.ok === false ) {
                return entries;
            }

            manifest = parseJson( entries.manifestText );
            sharePayload = parseJson( entries.shareText );
        }

    } catch ( error ) {
        return fail( 'damaged', fileName, 'The file is not valid json.' );
    }

    if ( manifest !== null ) {
        if ( !isObject( manifest ) || manifest.app !== 'EQNAG' ) {
            return fail( 'notNagFile', fileName, 'The manifest is not from EQNAG.' );
        }
        if ( manifest.type !== 'triggers' ) {
            return fail( 'notNagFile', fileName, 'The manifest is not a trigger share.' );
        }
    }

    let problem = checkPayloadShape( sharePayload );
    if ( problem ) {
        return fail( 'notNagFile', fileName, problem );
    }

    /** @type {ShareWarning[]} */
    let warnings = [];

    if ( typeof manifest?.version === 'string' && isNewerVersion( manifest.version, appVersion ) ) {
        warnings.push( { code: 'newerVersion', fileVersion: manifest.version, unknownKeys: findUnknownActionKeys( sharePayload ) } );
    }

    return { ok: true, payload: normalizePayload( sharePayload ), manifest: manifest, warnings: warnings, fileName: fileName };

}










/**
 * Returns the first argument that looks like a share file path.
 *
 * @returns {string | undefined}
 *
 * @param {string[]} argv The command line arguments.
 */
function findShareFileArg( argv ) {
    return ( argv ?? [] ).slice( 1 ).find( arg => typeof arg === 'string' && !arg.startsWith( '-' ) && allowedExtensions.includes( path.extname( arg ).toLowerCase() ) );
}










module.exports = {
    allowedExtensions,
    maxFileBytes,
    maxUnpackedBytes,
    maxZipEntries,
    buildShareBuffer,
    writeShareFile,
    readShareFile,
    findShareFileArg,
};
