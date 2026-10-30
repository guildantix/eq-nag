const fs = require( 'fs' );
const { findPushSpell, stripRank } = require( '../data/push-spells' );

const chunkSize = 256 * 1024;
const lookbackMs = 30 * 60 * 1000;
const hotkeyText = ' wonders who is pushing.';
const textOffset = 27;
const maxFightList = 60;
const bigFightRatio = 0.2;
const interruptGraceMs = 1000;
const landingGraceMs = 3000;
const monthIndex = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };

// Lines that can matter are kept; everything else is dropped before any other work.
const prefilterRgx = / points of | damage from | hit | slain|casting|interrupted|fizzles|resisted/;

// The damage patterns mirror the ones in the combat parser.
const rgx = {
    MeleeDamage: /^(?<actor>.*?) (?<attackType>(?:b(?:a(?:ckstabs?|sh(?:es)?)|ites?))|c(?:laws?|rush(?:es)?)|frenz(?:y|ies)|gores?|hits?|kicks?|mauls?|p(?:ierces?|unch(?:es)?)|rends?|s(?:hoots?|l(?:a(?:ms?|sh(?:es)?)|ices?)|mash(?:es)?|t(?:ings?|rikes?)|weeps?)) (on\s)?(?<target>.*) for (?<damage>[0-9]*) points of damage\./i,
    DirectDamage: /^(?<actor>.*) hit (?<target>.*) for (?<damage>[0-9]*) points of (?<resistType>[a-zA-Z0-9_]*) damage by (?<attackType>.*)\./i,
    YourDoT: /^(?<target>.*) has taken (?<damage>[0-9]*) damage from (?<actor>you)r (?<attackType>.*)\./i,
    OtherDoT: /^(?<target>.*) (has|have) taken (?<damage>[0-9]*) damage from (?<attackType>.*) by (?<actor>.*)\./i,
    Slain: /^(?<target>.+?) (?<verb>was|has been|have been) slain by (?<actor>.+?)!/,
    YouHaveSlain: /^You have slain (?<target>.+?)!/,
    Cast: /^(?:You begin|(?<actor>.+?) begins) casting (?<spell>.+)\.$/,
    OtherInterrupt: /^(?<actor>.+?)'s (?:casting is interrupted|spell fizzles)!$/,
    Resisted: /^Your target resisted the (?<spell>.+) spell\.$/,
    PlayerName: /^[A-Z][a-z]+$/,
    PetName: /^(?<owner>[A-Z][a-z]+)`s (?:pet|warder|familiar)$/,
};

/**
 * @typedef {Object} PushSession
 * @property {string} characterName The name of the character that pressed the hotkey.
 * @property {number} anchorTime The time of the hotkey line, in ms.
 * @property {string[]} lines The kept log lines, oldest first.
 * @property {number[]} times The time of each kept line, in ms.
 * @property {number} oldestTime The time of the oldest timestamped line read, in ms.
 * @property {boolean} reachedStart True when the read got to the start of the log file inside the lookback window.
 */

/**
 * Returns the time of the given log line in milliseconds, or NaN when the line has no timestamp.
 * Timestamps are read as UTC so daylight saving shifts do not matter.
 *
 * @returns {number} The time.
 *
 * @param {string} line The log line.
 */
function parseTimestamp( line ) {
    if ( line.length < textOffset || line.charCodeAt( 0 ) !== 91 || line.charCodeAt( 25 ) !== 93 ) {
        return NaN;
    }
    let month = monthIndex[ line.substring( 5, 8 ) ];
    if ( month === undefined ) {
        return NaN;
    }
    return Date.UTC( +line.substring( 21, 25 ), month, +line.substring( 9, 11 ), +line.substring( 12, 14 ), +line.substring( 15, 17 ), +line.substring( 18, 20 ) );
}










/**
 * Formats the given time as HH:MM:SS.
 *
 * @returns {string} The formatted time.
 *
 * @param {number} ms The time in ms.
 */
function formatClock( ms ) {
    return new Date( ms ).toISOString().substring( 11, 19 );
}










/**
 * Builds the lookup used to recognize spell landing messages.
 *
 * @returns {{ map: Map<string, string[]>, suffixes: Set<string>, suffixLength: number }} The landing index.
 *
 * @param {import('../data/push-spells').PushSpellTable} table The push spell table.
 */
function buildLandingIndex( table ) {
    let map = new Map();
    let minLength = 8;
    let add = ( name, spell ) => {
        if ( !spell.landText ) {
            return;
        }
        let base = stripRank( name );
        let list = map.get( spell.landText );
        if ( list == null ) {
            map.set( spell.landText, [ base ] );
        } else if ( list.indexOf( base ) === -1 ) {
            list.push( base );
        }
        minLength = Math.min( minLength, spell.landText.length );
    };
    Object.keys( table.spells ).forEach( name => add( name, table.spells[ name ] ) );
    Object.keys( table.exact ).forEach( name => add( name, table.exact[ name ] ) );

    let suffixes = new Set();
    map.forEach( ( names, text ) => suffixes.add( text.slice( -minLength ) ) );

    return { map: map, suffixes: suffixes, suffixLength: minLength };
}










/**
 * Reads the log backwards from the end, and keeps the lines that can matter.
 * Stops once 30 minutes before the hotkey line are covered.
 *
 * @returns {Promise<PushSession>} The session.
 *
 * @param {string} logFilePath The full path to the log file.
 * @param {string} characterName The name of the character.
 * @param {{ suffixes: Set<string>, suffixLength: number }} landing The landing index.
 */
async function readSession( logFilePath, characterName, landing ) {

    let lines = [];
    let times = [];
    let anchorTime = null;
    let newestTime = null;
    let oldestTime = null;
    let reachedStart = true;
    let hotkeyLine = `${characterName}${hotkeyText}`;

    let handle = await fs.promises.open( logFilePath, 'r' );
    try {
        let position = ( await handle.stat() ).size;
        let leftover = null;
        let done = false;

        while ( position > 0 && !done ) {
            let length = Math.min( chunkSize, position );
            position -= length;

            let chunk = Buffer.allocUnsafe( length );
            let read = 0;
            while ( read < length ) {
                let result = await handle.read( chunk, read, length - read, position + read );
                if ( result.bytesRead === 0 ) {
                    break;
                }
                read += result.bytesRead;
            }

            let combined = leftover ? Buffer.concat( [ chunk, leftover ] ) : chunk;
            let region = combined;

            if ( position > 0 ) {
                // The first line of the chunk may continue in the previous chunk.
                let newline = combined.indexOf( 10 );
                if ( newline === -1 ) {
                    leftover = combined;
                    continue;
                }
                leftover = combined.subarray( 0, newline );
                region = combined.subarray( newline + 1 );
            } else {
                leftover = null;
            }

            let chunkLines = region.toString( 'utf8' ).split( '\n' );

            for ( let i = chunkLines.length - 1; i >= 0; i-- ) {
                let line = chunkLines[ i ];
                if ( line.length > 0 && line.charCodeAt( line.length - 1 ) === 13 ) {
                    line = line.substring( 0, line.length - 1 );
                }

                let time = parseTimestamp( line );
                if ( time !== time ) {
                    continue;
                }
                if ( newestTime === null ) {
                    newestTime = time;
                }

                if ( anchorTime === null && line.endsWith( hotkeyText ) ) {
                    let text = line.substring( textOffset );
                    if ( text === hotkeyLine || text === `~ ${hotkeyLine}` ) {
                        // Anything after the hotkey press is not part of the recap.
                        anchorTime = time;
                        lines.length = 0;
                        times.length = 0;
                        continue;
                    }
                }

                if ( time < ( anchorTime ?? newestTime ) - lookbackMs ) {
                    done = true;
                    reachedStart = false;
                    break;
                }

                oldestTime = time;

                if ( prefilterRgx.test( line ) || landing.suffixes.has( line.slice( -landing.suffixLength ) ) ) {
                    lines.push( line );
                    times.push( time );
                }
            }
        }
    } finally {
        await handle.close();
    }

    lines.reverse();
    times.reverse();

    return { characterName: characterName, anchorTime: anchorTime ?? newestTime, lines: lines, times: times, oldestTime: oldestTime, reachedStart: reachedStart };
}










/**
 * @typedef {Object} PushKill
 * @property {number} index The index of the kill line in the session.
 * @property {number} time The time of the kill, in ms.
 * @property {string} clock The time of the kill as HH:MM:SS.
 * @property {string} name The name of the NPC.
 * @property {number} damage The damage taken by that NPC name in the window.
 */

/**
 * @typedef {Object} PushSummary
 * @property {PushKill[]} kills The kills in the window, most recent first.
 * @property {number} defaultKill The index in kills of the kill to show first.
 * @property {Set<string>} slain The names of the NPCs slain in the window.
 * @property {Set<string>} npcNames The names known to be NPCs.
 * @property {boolean} othersSeen True when hits by players other than the character exist.
 */

/**
 * Lists the kills in the session, with the damage each NPC took since its previous kill.
 * Names are only known to be NPCs from who the character, pets and kills involve, so a
 * one-word NPC that only fights other NPCs is not recognized.
 *
 * @returns {PushSummary} The summary.
 *
 * @param {PushSession} session The session.
 */
function summarize( session ) {

    let damage = new Map();
    let candidates = [];
    let npcNames = new Set();
    let actorTargets = new Map();
    let othersSeen = false;

    for ( let i = 0; i < session.lines.length; i++ ) {
        let text = session.lines[ i ].substring( textOffset );
        let m = null;

        if ( text.indexOf( ' points of ' ) > -1 ) {
            m = text.indexOf( ' points of damage' ) > -1 ? rgx.MeleeDamage.exec( text ) : rgx.DirectDamage.exec( text );
        } else if ( text.indexOf( ' damage from ' ) > -1 ) {
            m = rgx.YourDoT.exec( text ) ?? rgx.OtherDoT.exec( text );
        } else if ( text.indexOf( ' slain' ) > -1 ) {
            m = rgx.Slain.exec( text ) ?? rgx.YouHaveSlain.exec( text );
            if ( m != null ) {
                let target = m.groups.target;
                candidates.push( { index: i, time: session.times[ i ], name: target, killer: m.groups.actor ?? 'You', certain: m.groups.verb !== 'has been' && m.groups.verb !== 'have been', damage: damage.get( target ) ?? 0 } );
                damage.delete( target );
            }
            continue;
        } else {
            continue;
        }

        if ( m != null ) {
            let target = m.groups.target;
            let actor = m.groups.actor;
            damage.set( target, ( damage.get( target ) ?? 0 ) + +m.groups.damage );

            let actorMine = actor === 'You' || rgx.PetName.test( actor );
            let targetMine = target === 'You' || rgx.PetName.test( target );
            if ( actorMine && !targetMine ) {
                npcNames.add( target );
            } else if ( targetMine && !actorMine ) {
                npcNames.add( actor );
            }

            if ( rgx.PlayerName.test( actor ) ) {
                let targets = actorTargets.get( actor );
                if ( targets == null ) {
                    targets = new Set();
                    actorTargets.set( actor, targets );
                }
                targets.add( target );
            }

            if ( !othersSeen && actor !== 'You' && ( rgx.PlayerName.test( actor ) || rgx.PetName.test( actor ) ) && target !== 'You' && !rgx.PlayerName.test( target ) ) {
                othersSeen = true;
            }
        }
    }

    // "was slain by" is an NPC kill.  Servers that word every death "has been slain by" are trusted only when a
    // player-side name did the killing, so a wipe is never listed as kills.
    let slain = new Set();
    let kills = [];
    let fallback = [];
    candidates.forEach( k => {
        if ( !k.certain ) {
            fallback.push( k );
        } else if ( !rgx.PetName.test( k.name ) ) {
            slain.add( k.name );
            npcNames.add( k.name );
            kills.push( k );
        }
    } );

    fallback.forEach( k => {
        if ( ( k.name === 'You' || rgx.PetName.test( k.name ) ) && rgx.PlayerName.test( k.killer ) ) {
            npcNames.add( k.killer );
        }
    } );

    let playerNames = new Set();
    actorTargets.forEach( ( targets, actor ) => {
        targets.forEach( t => npcNames.has( t ) && playerNames.add( actor ) );
    } );

    fallback.forEach( k => {
        let playerSide = npcNames.has( k.name ) || k.killer === 'You' || rgx.PetName.test( k.killer ) || ( playerNames.has( k.killer ) && !npcNames.has( k.killer ) );
        if ( k.name !== 'You' && !rgx.PetName.test( k.name ) && playerSide ) {
            slain.add( k.name );
            npcNames.add( k.name );
            kills.push( k );
        }
    } );

    kills = kills.sort( ( x, y ) => x.index - y.index ).map( k => ( { index: k.index, time: k.time, clock: formatClock( k.time ), name: k.name, damage: k.damage } ) );

    kills.reverse();
    let largest = kills.reduce( ( max, k ) => Math.max( max, k.damage ), 0 );

    let defaultKill = kills.findIndex( k => k.damage > 0 && k.damage >= largest * bigFightRatio );
    defaultKill = defaultKill === -1 ? 0 : defaultKill;

    return { kills: kills.slice( 0, Math.max( maxFightList, defaultKill + 1 ) ), defaultKill: defaultKill, slain: slain, npcNames: npcNames, othersSeen: othersSeen };
}










/**
 * Returns the player a log actor counts for, or null when the actor is an NPC.
 *
 * @returns {string | null} The player name.
 *
 * @param {string} actor The actor as it appears in the log.
 * @param {{ characterName: string, boss: string, npcNames: Set<string> }} ctx The fight context.
 */
function resolvePlayer( actor, ctx ) {
    if ( actor === 'You' ) {
        return ctx.characterName;
    }
    let name = actor;
    if ( !rgx.PlayerName.test( name ) ) {
        name = rgx.PetName.exec( actor )?.groups.owner;
        if ( name == null ) {
            return null;
        }
    }
    return name === ctx.boss || ctx.npcNames.has( name ) ? null : name;
}










/**
 * Rounds the given push value for display.
 *
 * @returns {number} The rounded value.
 *
 * @param {number} value The push value.
 */
function roundPush( value ) {
    return Math.round( value * 100 ) / 100;
}











/**
 * Describes a weapon proc whose landing message names no caster.
 *
 * @returns {{ name: string, names: string[], push: number | null, pushMin: number | null, pushMax: number | null, count: number }} The proc.
 *
 * @param {string[]} names The candidate spell names of the landing message.
 * @param {any} table The push spell table.
 */
function buildProc( names, table ) {
    let pushes = names.map( n => table.spells[ n ]?.push ).filter( p => p != null );
    let pushMin = pushes.length > 0 ? Math.min( ...pushes ) : null;
    let pushMax = pushes.length > 0 ? Math.max( ...pushes ) : null;
    let name = names.length <= 3 ? names.join( ' / ' ) : `${names[ 0 ]} +${names.length - 1} more`;
    return { name: name, names: names, push: pushMin === pushMax ? pushMin : null, pushMin: pushMin, pushMax: pushMax, count: 0 };
}










/**
 * @typedef {Object} PushPlayer
 * @property {string} name The player name.
 * @property {number} events The number of push events.
 * @property {number} confirmed The number of confirmed events.
 * @property {number} assumed The number of assumed events.
 * @property {number} pushValue The summed push value.
 * @property {{ name: string, confirmed: number, assumed: number, push: number }[]} spells The spells, most used first.
 */

/**
 * Tells whether a line has the boss as its actor or target.
 *
 * @returns {boolean} True when the line involves the boss.
 *
 * @param {string} text The line text, without the timestamp.
 * @param {string} boss The boss name.
 * @param {{ map: Map<string, string[]> }} landing The landing index.
 */
function involvesBoss( text, boss, landing ) {
    if ( text.indexOf( boss ) === -1 ) {
        return false;
    }
    let m = null;
    if ( text.indexOf( ' points of ' ) > -1 ) {
        m = text.indexOf( ' points of damage' ) > -1 ? rgx.MeleeDamage.exec( text ) : rgx.DirectDamage.exec( text );
    } else if ( text.indexOf( ' damage from ' ) > -1 ) {
        m = rgx.YourDoT.exec( text ) ?? rgx.OtherDoT.exec( text );
    } else if ( text.indexOf( ' slain' ) > -1 ) {
        m = rgx.Slain.exec( text ) ?? rgx.YouHaveSlain.exec( text );
    } else if ( text.indexOf( 'casting' ) > -1 ) {
        m = rgx.Cast.exec( text ) ?? rgx.OtherInterrupt.exec( text );
    } else if ( text.startsWith( boss ) ) {
        return landing.map.has( text.substring( boss.length ) );
    }
    return m != null && ( m.groups.actor === boss || m.groups.target === boss );
}

/**
 * Counts who pushed the given kill.
 *
 * @returns {any} The recap result.
 *
 * @param {PushSession} session The session.
 * @param {PushSummary} summary The session summary.
 * @param {import('../data/push-spells').PushSpellTable} table The push spell table.
 * @param {{ map: Map<string, string[]> }} landing The landing index.
 * @param {PushKill} kill The kill to analyze.
 * @param {number} quietGapSeconds Seconds without combat that separate fights.
 */
function analyzeKill( session, summary, table, landing, kill, quietGapSeconds ) {

    let boss = kill.name;
    let ctx = { characterName: session.characterName, boss: boss, npcNames: summary.npcNames };
    let gapMs = quietGapSeconds * 1000;

    // The fight starts at the earliest line about the boss, with no quiet gap in between.
    let startIndex = kill.index;
    let lastTime = kill.time;
    for ( let i = kill.index - 1; i >= 0; i-- ) {
        if ( lastTime - session.times[ i ] >= gapMs ) {
            break;
        }
        if ( involvesBoss( session.lines[ i ].substring( textOffset ), boss, landing ) ) {
            lastTime = session.times[ i ];
            startIndex = i;
        }
    }

    let events = [];
    let lastCast = new Map();
    let unattributed = { events: 0, pushValue: 0 };
    let unattributedProcs = new Map();
    let npcAbilities = new Map();

    let cancelCast = ( player, time ) => {
        let ev = lastCast.get( player );
        if ( ev != null && ev.state !== 'cancelled' && time - ev.time <= ev.castTime + interruptGraceMs ) {
            ev.state = 'cancelled';
        }
        lastCast.delete( player );
    };

    for ( let i = startIndex; i < kill.index; i++ ) {
        let text = session.lines[ i ].substring( textOffset );
        let time = session.times[ i ];
        let m = null;

        if ( text.indexOf( ' damage by ' ) > -1 && ( m = rgx.DirectDamage.exec( text ) ) != null ) {
            let spellName = m.groups.attackType;
            let spell = findPushSpell( table, spellName );
            if ( spell == null ) {
                continue;
            }
            let player = resolvePlayer( m.groups.actor, ctx );
            if ( player == null ) {
                let key = `${m.groups.actor}\u0000${spellName}`;
                let entry = npcAbilities.get( key ) ?? { actor: m.groups.actor, name: spellName, count: 0, push: spell.push };
                entry.count++;
                npcAbilities.set( key, entry );
            } else if ( m.groups.target === boss ) {
                // A cast waiting for its landing becomes this damage event.
                let base = stripRank( spellName );
                let pending = null;
                for ( let j = events.length - 1; j >= 0; j-- ) {
                    let ev = events[ j ];
                    if ( time - ev.time > ev.castTime + landingGraceMs + 10000 ) {
                        break;
                    }
                    if ( ev.kind === 'cast' && ev.state !== 'cancelled' && ev.player === player && stripRank( ev.spellName ) === base && time - ev.time <= ev.castTime + landingGraceMs ) {
                        pending = ev;
                        break;
                    }
                }
                if ( pending != null ) {
                    pending.kind = 'damage';
                    pending.state = 'confirmed';
                    pending.time = time;
                    pending.castTime = 0;
                    pending.spell = spell;
                    pending.spellName = spellName;
                } else {
                    events.push( { kind: 'damage', state: 'confirmed', time: time, castTime: 0, player: player, spellName: spellName, spell: spell, landed: false } );
                }
            }

        } else if ( text.indexOf( 'casting' ) > -1 && ( m = rgx.Cast.exec( text ) ) != null ) {
            let player = resolvePlayer( m.groups.actor ?? 'You', ctx );
            if ( player == null ) {
                continue;
            }
            let spell = findPushSpell( table, m.groups.spell );
            if ( spell == null ) {
                lastCast.set( player, null );
                continue;
            }
            let ev = { kind: 'cast', state: 'assumed', time: time, castTime: spell.castTime, player: player, spellName: m.groups.spell, spell: spell, landed: false };
            events.push( ev );
            lastCast.set( player, ev );

        } else if ( text === 'Your spell is interrupted.' || text === 'Your spell fizzles!' ) {
            cancelCast( ctx.characterName, time );

        } else if ( text.indexOf( "'s " ) > -1 && ( m = rgx.OtherInterrupt.exec( text ) ) != null ) {
            let player = resolvePlayer( m.groups.actor, ctx );
            if ( player != null ) {
                cancelCast( player, time );
            }

        } else if ( text.indexOf( 'resisted' ) > -1 && ( m = rgx.Resisted.exec( text ) ) != null ) {
            let ev = lastCast.get( ctx.characterName );
            if ( ev != null && stripRank( ev.spellName ) === stripRank( m.groups.spell ) ) {
                cancelCast( ctx.characterName, time );
            }

        } else if ( text.startsWith( boss ) ) {
            let names = landing.map.get( text.substring( boss.length ) );
            if ( names == null ) {
                continue;
            }
            let matched = false;
            for ( let j = events.length - 1; j >= 0; j-- ) {
                let ev = events[ j ];
                if ( time - ev.time > ev.castTime + landingGraceMs + 10000 ) {
                    break;
                }
                if ( ev.state !== 'cancelled' && !ev.landed && names.indexOf( stripRank( ev.spellName ) ) > -1 && time - ev.time <= ev.castTime + landingGraceMs ) {
                    ev.landed = true;
                    ev.state = 'confirmed';
                    matched = true;
                    break;
                }
            }
            if ( !matched ) {
                unattributed.events++;
                unattributed.pushValue += table.spells[ names[ 0 ] ]?.push ?? 0;
                let key = text.substring( boss.length );
                let proc = unattributedProcs.get( key );
                if ( proc == null ) {
                    proc = buildProc( names, table );
                    unattributedProcs.set( key, proc );
                }
                proc.count++;
            }
        }
    }

    /** @type {Map<string, PushPlayer>} */
    let players = new Map();
    events.forEach( ev => {
        if ( ev.state === 'cancelled' ) {
            return;
        }
        let player = players.get( ev.player );
        if ( player == null ) {
            player = { name: ev.player, events: 0, confirmed: 0, assumed: 0, pushValue: 0, spells: [] };
            players.set( ev.player, player );
        }
        let spell = player.spells.find( s => s.name === ev.spellName );
        if ( spell == null ) {
            spell = { name: ev.spellName, confirmed: 0, assumed: 0, push: ev.spell.push };
            player.spells.push( spell );
        }
        player.events++;
        player.pushValue += ev.spell.push;
        if ( ev.state === 'confirmed' ) {
            player.confirmed++;
            spell.confirmed++;
        } else {
            player.assumed++;
            spell.assumed++;
        }
    } );

    let list = Array.from( players.values() );
    list.forEach( p => {
        p.pushValue = roundPush( p.pushValue );
        p.spells.sort( ( a, b ) => ( b.confirmed + b.assumed ) - ( a.confirmed + a.assumed ) );
    } );
    list.sort( ( a, b ) => b.events - a.events || a.name.localeCompare( b.name ) );

    let totalEvents = list.reduce( ( sum, p ) => sum + p.events, 0 );
    let totalPush = roundPush( list.reduce( ( sum, p ) => sum + p.pushValue, 0 ) );

    return {
        boss: boss,
        killClock: kill.clock,
        startClock: formatClock( session.times[ startIndex ] ),
        durationSeconds: Math.round( ( kill.time - session.times[ startIndex ] ) / 1000 ),
        damageTaken: kill.damage,
        players: list,
        unattributed: {
            events: unattributed.events,
            pushValue: roundPush( unattributed.pushValue ),
            procs: Array.from( unattributedProcs.values() ).sort( ( a, b ) => b.count - a.count || a.name.localeCompare( b.name ) ),
        },
        npcAbilities: Array.from( npcAbilities.values() ).sort( ( a, b ) => b.count - a.count ),
        totalEvents: totalEvents,
        totalPush: totalPush,
        topPlayer: list[ 0 ]?.name ?? null,
        topPercent: totalEvents > 0 ? Math.round( list[ 0 ].events * 100 / totalEvents ) : 0,
        othersSeen: summary.othersSeen,
        reachedStart: session.reachedStart,
        startsAtLogEdge: startIndex === 0 && session.times[ startIndex ] - session.oldestTime < gapMs,
    };
}

module.exports = { readSession, summarize, analyzeKill, buildLandingIndex, parseTimestamp };
