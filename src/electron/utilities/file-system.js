const fs = require( 'fs' );

/**
 * Combines the given path segments into a system file path.
 * 
 * @param  {...string} segments File path segments.
 */
function pathCombine( ...segments ) {
    let path = '';
    for ( let i = 0; i < segments?.length; i++ ) {

        if ( path[ path.length - 1 ] === '\\' ) {
            path = path.replace( /\\$/, '' );
        }

        if ( segments[ i ][ 0 ] === '\\' ) {
            path += segments[ i ];
        } else {
            path += '\\' + segments[ i ];
        }
    }
}

/**
 * Returns true if the file exists.
 * 
 * @returns {Promise<boolean>}
 * 
 * @param {string} path The full file path.
 */
function exists( path ) {
    
    /** @type {Promise<boolean>} */
    let p = new Promise( resolve => {
        
        fs.exists( path, fileExists => {
            resolve( fileExists );
        } );

    } );

    return p;
}

/**
 * Returns the filename from the given path.
 * 
 * @param {string} filePath The full path.
 */
function pathGetFilename( filePath ) {
    const matches = /^.*\\(.+\\)*(.+)$/.exec( filePath );
    if ( matches ) {
        return matches[ 2 ];
    }
    
    const exactFilename = /^(.+\..+)$/.exec( filePath );
    if ( exactFilename ) {
        return exactFilename[ 1 ];
    }
}

/**
 * Returns a new path with the given value appended to the filename.
 * 
 * @param {string} filePath The full or filename of the file.
 */
function pathAppendFilename( filePath, suffix ) {

    // Matches the full path, ex: C:\EverQuest\Logs\filename.ext
    const matches = /^.*\\(.+\\)*(.+)\.(.+)$/.exec( filePath );
    if ( matches ) {
        return filePath.replace( matches[ 2 ], matches[ 2 ] + suffix );
    }
    
    // Matches the filename only, ex: filename.ext
    const exactFilename = /^(.+)\.(.+)$/.exec( filePath );
    if ( exactFilename ) {
        return filePath.replace( exactFilename[ 1 ], exactFilename[ 1 ] + suffix );
    }

    throw 'Invalid file path given';
}

/**
 * Returns a new path with the given value appended to the filename.
 * 
 * @param {string} filePath The full or filename of the file.
 */
function pathPrependFilename( filePath, prefix ) {
    const matches = /^.*\\(.+\\)*(.+)\.(.+)$/.exec( filePath );
    if ( matches ) {
        return filePath.replace( matches[ 2 ], prefix + matches[ 2 ] );
    }
    
    const exactFilename = /^(.+)\.(.+)$/.exec( filePath );
    if ( exactFilename ) {
        return filePath.replace( exactFilename[ 1 ], prefix + exactFilename[ 1 ] );
    }

    throw 'Invalid file path given';
}

/**
 * Returns a filename timestamp.
 * 
 * @param {Date|undefined} time The time for the timestamp.  The current time is used if no value is provided.
 */
function getFileTimestamp( time ) {
    const now = time ? time : new Date( Date.now() );
    
    const y = `${now.getFullYear()}`.padStart( 4, '0' );
    const m = `${now.getMonth() + 1}`.padStart( 2, '0' );
    const d = `${now.getDate()}`.padStart( 2, '0' );
    const t = `${( now.getHours() * 60 * 60 * 1000 ) + ( now.getMinutes() * 60 * 1000 ) + ( now.getSeconds() * 1000 ) + now.getMilliseconds()}`.padStart( 4, '0' );

    return `-${y}${m}${d}_${t}`;
}

const Path = {
    combine: pathCombine,
    appendFilename: pathAppendFilename,
    prependFilename: pathPrependFilename,
    getFilename: pathGetFilename,
};

const FsUtilities = {
    Path: Path,
    getFileTimestamp: getFileTimestamp,
    existsAsync: exists,
};

module.exports = FsUtilities;
