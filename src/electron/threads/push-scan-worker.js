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
    const chunk = Buffer.allocUnsafe( length );
    let read = 0;
    while ( read < length ) {
        const result = await handle.read( chunk, read, length - read, position + read );
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
 * @returns {Promise<{ head: string, headLength: number }>} The hash and how many bytes it covers.
 *
 * @param {import('fs').promises.FileHandle} handle The open file.
 * @param {number} length The number of bytes to cover, at most the head size.
 */
async function hashHead( handle, length ) {
    const bytes = await readRange( handle, 0, Math.min( headBytes, length ) );
    return { head: crypto.createHash( 'sha1' ).update( bytes ).digest( 'hex' ), headLength: bytes.length };
}










/**
 * Scans the log from start to end, and returns the boss kills found.
 *
 * @returns {Promise<any>} The scan result.
 *
 * @param {any} params The scan parameters: log path, character name, EverQuest and user data
 *     folders, quiet gap, smallest damage and the cache entry of the log.
 */
async function scanLog( params ) {

    const startedAt = Date.now();
    const table = await loadPushSpells( params.eqFolder, params.userData );
    const landing = buildLandingIndex( table );

    const handle = await fs.promises.open( params.logFilePath, 'r' );
    try {
        const size = ( await handle.stat() ).size;
        const headInfo = await hashHead( handle, size );

        let results = [];
        let startOffset = 0;
        let resumed = false;
        const cache = params.cache;
        if ( cache !== null && cache !== undefined && size >= cache.size && cache.resumeOffset <= size ) {
            const cachedHead = await hashHead( handle, cache.headLength );
            const previous = cache.resumeOffset > 0 ? await readRange( handle, cache.resumeOffset - 1, 1 ) : null;
            if ( cachedHead.head === cache.head && ( ( previous === null || previous === undefined ) || previous[ 0 ] === 10 ) ) {
                startOffset = cache.resumeOffset;
                results = cache.results.slice();
                resumed = true;
            }
        }
        let capped = resumed && cache.capped === true;
        const seen = new Set( results.map( r => `${r.mob}|${r.killTime}` ) );

        const lines = [];
        const times = [];
        const offsets = [];
        let head = 0;
        let trimmed = false;
        const damage = new Map();
        const npcSeen = new Set();
        let analyzed = 0;
        let lastPost = 0;

        const post = ( bytes ) => {
            lastPost = Date.now();
            parentPort.postMessage( { type: 'progress', bytes: bytes - startOffset, total: size - startOffset, kills: results.length } );
        };

        const analyze = ( time ) => {
            analyzed++;
            const session = {
                characterName: params.characterName,
                anchorTime: time,
                lines: lines.slice( head ),
                times: times.slice( head ),
                oldestTime: times[ head ],
                reachedStart: startOffset === 0 && !trimmed,
            };
            const summary = summarize( session );
            const kill = summary.kills[ 0 ];
            if ( ( kill === null || kill === undefined ) || kill.index !== session.lines.length - 1 || kill.damage < params.minDamage ) {
                return;
            }
            const analysis = analyzeKill( session, summary, table, landing, kill, params.quietGapSeconds );
            const saved = buildSavedSummary( analysis, params.characterName );
            const key = `${saved.mob}|${saved.killTime}`;
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

        const handleLine = ( buffer, start, end, offset ) => {
            if ( end > start && buffer[ end - 1 ] === 13 ) {
                end--;
            }
            if ( end - start < textOffset || buffer[ start ] !== 91 ) {
                return;
            }
            const line = buffer.toString( 'latin1', start, end );
            const time = parseTimestamp( line );
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

            const m = matchCombat( line.substring( textOffset ) );
            if ( m === null || m === undefined ) {
                return;
            }
            const target = m.groups.target;
            if ( m.groups.damage !== undefined ) {
                damage.set( target, ( damage.get( target ) ?? 0 ) + +m.groups.damage );
                const actor = m.groups.actor;
                const actorMine = actor === 'You' || isPetName( actor );
                const targetMine = target === 'You' || isPetName( target );
                if ( actorMine && !targetMine ) {
                    npcSeen.add( target );
                } else if ( targetMine && !actorMine ) {
                    npcSeen.add( actor );
                }
            } else {
                const taken = damage.get( target ) ?? 0;
                damage.delete( target );
                const killer = m.groups.actor ?? 'You';
                const certain = m.groups.verb !== 'has been' && m.groups.verb !== 'have been';
                const pet = isPetName( target );
                if ( certain && !pet ) {
                    npcSeen.add( target );
                } else if ( !certain && ( target === 'You' || pet ) && isPlayerName( killer ) ) {
                    npcSeen.add( killer );
                }
                const possible = isPossibleKill( target, killer, certain, pet );
                if ( possible && !certain ) {
                    npcSeen.add( target );
                }
                if ( taken >= params.minDamage && possible ) {
                    analyze( time );
                }
            }
        };

        // Player deaths are not kills, so they are not worth the cost of a summary.
        const isPossibleKill = ( target, killer, certain, pet ) => {
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
                const newline = chunk.indexOf( 10 );
                if ( newline === -1 ) {
                    continue;
                }
                skipping = false;
                chunk = chunk.subarray( newline + 1 );
                chunkOffset += newline + 1;
            }

            const data = leftover.length > 0 ? Buffer.concat( [ leftover, chunk ] ) : chunk;
            const dataOffset = chunkOffset - leftover.length;

            const last = data.lastIndexOf( 10 );
            if ( last === -1 ) {
                leftover = data;
            } else {
                let start = 0;
                while ( start <= last ) {
                    const end = data.indexOf( 10, start );
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
        if ( remainderStart !== null && remainderStart !== undefined ) {
            resumeOffset = Math.min( resumeOffset, remainderStart );
        }
        if ( skipping ) {
            resumeOffset = Math.min( resumeOffset, skipStart );
        }

        return {
            results: results,
            capped: capped,
            resumed: resumed,
            size: size,
            head: headInfo.head,
            headLength: headInfo.headLength,
            resumeOffset: resumeOffset,
            analyzed: analyzed,
            elapsedMs: Date.now() - startedAt,
        };

    } finally {
        await handle.close();
    }
}

scanLog( workerData ).then( result => {
    parentPort.postMessage( { type: 'done', result: result } );
} ).catch( error => {
    parentPort.postMessage( { type: 'error', code: error.code ?? null, message: error.code === 'no-folder' || error.code === 'no-file' ? error.message : `The log could not be scanned: ${error.message}` } );
} );
