const { parentPort, workerData } = require( 'worker_threads' );
const fs = require( 'fs' );
const crypto = require( 'crypto' );
const { loadPushSpells } = require( '../data/push-spells' );
const { summarize, analyzeKill, buildLandingIndex, parseTimestamp, isRelevantLine, matchCombat, isPlayerName, isPetName, textOffset, lookbackMs } = require( '../utilities/push-recap-parser' );
const { buildSavedSummary } = require( '../utilities/push-recap-summary' );

const chunkSize = 1024 * 1024;
const maxResults = 300;
const progressIntervalMs = 250;
const headBytes = 256;
const compactAfter = 20000;
const maxPartialLine = 8 * 1024 * 1024;










/**
 * Reads the given range of the file into a new buffer.
 *
 * @returns {Promise<Buffer>} The bytes that were read.
 *
 * @param {import('fs').promises.FileHandle} handle The open file.
 * @param {number} position The first byte to read.
 * @param {number} length The number of bytes to read.
 */
async function readRange( handle, position, length ) {
    let chunk = Buffer.allocUnsafe( length );
    let read = 0;
    while ( read < length ) {
        let result = await handle.read( chunk, read, length - read, position + read );
        if ( result.bytesRead === 0 ) {
            break;
        }
        read += result.bytesRead;
    }
    return read === length ? chunk : chunk.subarray( 0, read );
}










/**
 * Returns the hash of the start of the file, used to tell a continued log from a replaced one.
 *
 * @returns {Promise<{ head: string, headLength: number }>} The hash and the number of bytes it covers.
 *
 * @param {import('fs').promises.FileHandle} handle The open file.
 * @param {number} length The number of bytes to cover, at most the head size.
 */
async function hashHead( handle, length ) {
    let bytes = await readRange( handle, 0, Math.min( headBytes, length ) );
    return { head: crypto.createHash( 'sha1' ).update( bytes ).digest( 'hex' ), headLength: bytes.length };
}










/**
 * Scans the log from start to end, and returns the boss kills found.
 *
 * @returns {Promise<any>} The scan result.
 *
 * @param {{ logFilePath: string, characterName: string, eqFolder: string, userData: string, quietGapSeconds: number, minDamage: number, cache: any }} params The scan parameters.
 */
async function scanLog( params ) {

    let startedAt = Date.now();
    let table = await loadPushSpells( params.eqFolder, params.userData );
    let landing = buildLandingIndex( table );

    let handle = await fs.promises.open( params.logFilePath, 'r' );
    try {
        let size = ( await handle.stat() ).size;
        let headInfo = await hashHead( handle, size );

        let results = [];
        let startOffset = 0;
        let resumed = false;
        let cache = params.cache;
        if ( cache != null && size >= cache.size && cache.resumeOffset <= size ) {
            let cachedHead = await hashHead( handle, cache.headLength );
            let previous = cache.resumeOffset > 0 ? await readRange( handle, cache.resumeOffset - 1, 1 ) : null;
            if ( cachedHead.head === cache.head && ( previous == null || previous[ 0 ] === 10 ) ) {
                startOffset = cache.resumeOffset;
                results = cache.results.slice();
                resumed = true;
            }
        }
        let capped = resumed && cache.capped === true;
        let seen = new Set( results.map( r => `${r.mob}|${r.killTime}` ) );

        let lines = [];
        let times = [];
        let offsets = [];
        let head = 0;
        let trimmed = false;
        let damage = new Map();
        let npcSeen = new Set();
        let analyzed = 0;
        let lastPost = 0;

        let post = ( bytes ) => {
            lastPost = Date.now();
            parentPort.postMessage( { type: 'progress', bytes: bytes - startOffset, total: size - startOffset, kills: results.length } );
        };

        let analyze = ( time ) => {
            analyzed++;
            let session = { characterName: params.characterName, anchorTime: time, lines: lines.slice( head ), times: times.slice( head ), oldestTime: times[ head ], reachedStart: startOffset === 0 && !trimmed };
            let summary = summarize( session );
            let kill = summary.kills[ 0 ];
            if ( kill == null || kill.index !== session.lines.length - 1 || kill.damage < params.minDamage ) {
                return;
            }
            let saved = buildSavedSummary( analyzeKill( session, summary, table, landing, kill, params.quietGapSeconds ), params.characterName );
            let key = `${saved.mob}|${saved.killTime}`;
            if ( seen.has( key ) ) {
                return;
            }
            seen.add( key );
            results.push( saved );
            parentPort.postMessage( { type: 'kill', summary: saved } );
            if ( results.length > maxResults ) {
                results.shift();
                capped = true;
            }
        };

        let handleLine = ( buffer, start, end, offset ) => {
            if ( end > start && buffer[ end - 1 ] === 13 ) {
                end--;
            }
            if ( end - start < textOffset || buffer[ start ] !== 91 ) {
                return;
            }
            let line = buffer.toString( 'latin1', start, end );
            let time = parseTimestamp( line );
            if ( time !== time || !isRelevantLine( line, landing ) ) {
                return;
            }

            lines.push( line );
            times.push( time );
            offsets.push( offset );
            while ( head < lines.length && times[ head ] < time - lookbackMs ) {
                head++;
                trimmed = true;
            }
            if ( head > compactAfter && head * 2 > lines.length ) {
                lines.splice( 0, head );
                times.splice( 0, head );
                offsets.splice( 0, head );
                head = 0;
            }

            let m = matchCombat( line.substring( textOffset ) );
            if ( m == null ) {
                return;
            }
            let target = m.groups.target;
            if ( m.groups.damage !== undefined ) {
                damage.set( target, ( damage.get( target ) ?? 0 ) + +m.groups.damage );
                let actor = m.groups.actor;
                let actorMine = actor === 'You' || isPetName( actor );
                let targetMine = target === 'You' || isPetName( target );
                if ( actorMine && !targetMine ) {
                    npcSeen.add( target );
                } else if ( targetMine && !actorMine ) {
                    npcSeen.add( actor );
                }
            } else {
                let taken = damage.get( target ) ?? 0;
                damage.delete( target );
                let killer = m.groups.actor ?? 'You';
                let certain = m.groups.verb !== 'has been' && m.groups.verb !== 'have been';
                let pet = isPetName( target );
                if ( certain && !pet ) {
                    npcSeen.add( target );
                } else if ( !certain && ( target === 'You' || pet ) && isPlayerName( killer ) ) {
                    npcSeen.add( killer );
                }
                let possible = isPossibleKill( target, killer, certain, pet );
                if ( possible && !certain ) {
                    npcSeen.add( target );
                }
                if ( taken >= params.minDamage && possible ) {
                    analyze( time );
                }
            }
        };

        // Player deaths are not kills, so they are not worth the cost of a summary.
        let isPossibleKill = ( target, killer, certain, pet ) => {
            if ( pet || ( !certain && target === 'You' ) ) {
                return false;
            }
            return certain || !( isPlayerName( target ) && !npcSeen.has( target ) && killer !== 'You' && !isPetName( killer ) && !isPlayerName( killer ) );
        };

        let position = startOffset;
        let leftover = Buffer.alloc( 0 );
        let skipping = false;
        let skipStart = 0;
        while ( position < size ) {
            let chunk = await readRange( handle, position, Math.min( chunkSize, size - position ) );
            if ( chunk.length === 0 ) {
                break;
            }
            let chunkOffset = position;
            position += chunk.length;

            // A line longer than the limit is dropped up to its end.
            if ( skipping ) {
                let newline = chunk.indexOf( 10 );
                if ( newline === -1 ) {
                    continue;
                }
                skipping = false;
                chunk = chunk.subarray( newline + 1 );
                chunkOffset += newline + 1;
            }

            let data = leftover.length > 0 ? Buffer.concat( [ leftover, chunk ] ) : chunk;
            let dataOffset = chunkOffset - leftover.length;

            let last = data.lastIndexOf( 10 );
            if ( last === -1 ) {
                leftover = data;
            } else {
                let start = 0;
                while ( start <= last ) {
                    let end = data.indexOf( 10, start );
                    handleLine( data, start, end, dataOffset + start );
                    start = end + 1;
                }
                leftover = data.subarray( last + 1 );
            }

            if ( leftover.length > maxPartialLine ) {
                skipStart = position - leftover.length;
                skipping = true;
                leftover = Buffer.alloc( 0 );
            }

            if ( Date.now() - lastPost >= progressIntervalMs ) {
                post( position );
            }
        }

        let remainderStart = null;
        if ( leftover.length > 0 ) {
            remainderStart = position - leftover.length;
            handleLine( leftover, 0, leftover.length, remainderStart );
        }

        let resumeOffset = head < lines.length ? offsets[ head ] : size;
        if ( remainderStart != null ) {
            resumeOffset = Math.min( resumeOffset, remainderStart );
        }
        if ( skipping ) {
            resumeOffset = Math.min( resumeOffset, skipStart );
        }

        return { results: results, capped: capped, resumed: resumed, size: size, head: headInfo.head, headLength: headInfo.headLength, resumeOffset: resumeOffset, analyzed: analyzed, elapsedMs: Date.now() - startedAt };

    } finally {
        await handle.close();
    }
}

scanLog( workerData ).then( result => {
    parentPort.postMessage( { type: 'done', result: result } );
} ).catch( error => {
    parentPort.postMessage( { type: 'error', code: error.code ?? null, message: error.code === 'no-folder' || error.code === 'no-file' ? error.message : `The log could not be scanned: ${error.message}` } );
} );
