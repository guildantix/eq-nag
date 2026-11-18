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
const strictLandingGraceMs = 2000;
const claimGraceMs = 1000;
const monthIndex = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };

// Lines that can matter are kept, e.g. "Soandso hit a gnoll for 5 points of magic damage by
// Color Flux."; everything else is dropped before any other work.
const prefilterRgx = / points of | damage from | hit | slain|casting|interrupted|fizzles|resisted/;

// The damage patterns mirror the ones in the combat parser.
const rgx = {
    // Soandso slashes a gnoll for 5 points of damage.
    MeleeDamage: /^(?<actor>.*?) (?<attackType>(?:b(?:a(?:ckstabs?|sh(?:es)?)|ites?))|c(?:laws?|rush(?:es)?)|frenz(?:y|ies)|gores?|hits?|kicks?|mauls?|p(?:ierces?|unch(?:es)?)|rends?|s(?:hoots?|l(?:a(?:ms?|sh(?:es)?)|ices?)|mash(?:es)?|t(?:ings?|rikes?)|weeps?)) (on\s)?(?<target>.*) for (?<damage>[0-9]*) points of damage\./i,
    // Soandso hit a gnoll for 5 points of magic damage by Color Flux.
    DirectDamage: /^(?<actor>.*) hit (?<target>.*) for (?<damage>[0-9]*) points of (?<resistType>[a-zA-Z0-9_]*) damage by (?<attackType>.*)\./i,
    // A gnoll has taken 5 damage from your Pyre of Va Xakra.
    YourDoT: /^(?<target>.*) has taken (?<damage>[0-9]*) damage from (?<actor>you)r (?<attackType>.*)\./i,
    // A gnoll has taken 5 damage from Pyre of Va Xakra by Soandso.
    OtherDoT: /^(?<target>.*) (has|have) taken (?<damage>[0-9]*) damage from (?<attackType>.*) by (?<actor>.*)\./i,
    // A gnoll was slain by Soandso!
    Slain: /^(?<target>.+?) (?<verb>was|has been|have been) slain by (?<actor>.+?)!/,
    // You have slain a gnoll!
    YouHaveSlain: /^You have slain (?<target>.+?)!/,
    // Soandso begins casting Color Flux.
    Cast: /^(?:You begin|(?<actor>.+?) begins) casting (?<spell>.+)\.$/,
    // Soandso's casting is interrupted!
    OtherInterrupt: /^(?<actor>.+?)'s (?:casting is interrupted|spell fizzles)!$/,
    // Your target resisted the Color Flux spell.
    Resisted: /^Your target resisted the (?<spell>.+) spell\.$/,
    // Soandso
    PlayerName: /^[A-Z][a-z]+$/,
    // Soandso`s pet
    PetName: /^(?<owner>[A-Z][a-z]+)`s (?:pet|warder|familiar)$/,
};










/**
 * @typedef {Object} PushSession
 * @property {string} characterName The name of the character that pressed the hotkey.
 * @property {number} anchorTime The time of the hotkey line, in ms.
 * @property {string[]} lines The kept log lines, oldest first.
 * @property {number[]} times The time of each kept line, in ms.
 * @property {number} oldestTime The time of the oldest timestamped line read, in ms.
 * @property {boolean} reachedStart True when the read got to the start of the log file
 *     inside the lookback window.
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
    const month = monthIndex[ line.substring( 5, 8 ) ];
    if ( month === undefined ) {
        return NaN;
    }
    return Date.UTC(
        +line.substring( 21, 25 ), month, +line.substring( 9, 11 ),
        +line.substring( 12, 14 ), +line.substring( 15, 17 ), +line.substring( 18, 20 )
    );
}










/**
 * Tells whether the given log line can matter to a recap.
 *
 * @returns {boolean} True when the line is worth keeping.
 *
 * @param {string} line The log line.
 * @param {{ suffixes: Set<string>, suffixLength: number }} landing The landing index.
 */
function isRelevantLine( line, landing ) {
    return prefilterRgx.test( line ) || landing.suffixes.has( line.slice( -landing.suffixLength ) );
}










/**
 * Tells whether the given name looks like a player name.
 *
 * @returns {boolean} True for a one-word capitalised name.
 *
 * @param {string} name The name.
 */
function isPlayerName( name ) {
    return rgx.PlayerName.test( name );
}










/**
 * Tells whether the given name is the name of a pet, warder or familiar.
 *
 * @returns {boolean} True for a pet name.
 *
 * @param {string} name The name.
 */
function isPetName( name ) {
    return rgx.PetName.test( name );
}










/**
 * Matches a damage or a slain line.  A damage match has a damage group, a slain match does not.
 *
 * @returns {RegExpExecArray | null} The match, or null when the line is neither.
 *
 * @param {string} text The text of the line, after the timestamp.
 */
function matchCombat( text ) {
    if ( text.indexOf( ' points of ' ) > -1 ) {
        return text.indexOf( ' points of damage' ) > -1 ? rgx.MeleeDamage.exec( text ) : rgx.DirectDamage.exec( text );
    } else if ( text.indexOf( ' damage from ' ) > -1 ) {
        return rgx.YourDoT.exec( text ) ?? rgx.OtherDoT.exec( text );
    } else if ( text.indexOf( ' slain' ) > -1 ) {
        return rgx.Slain.exec( text ) ?? rgx.YouHaveSlain.exec( text );
    }
    return null;
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
 * @returns {{ map: Map<string, string[]>, noPush: Map<string, { names: string[], count: number }>, suffixes: Set<string>, suffixLength: number }} The landing index.
 *
 * @param {import('../data/push-spells').PushSpellTable} table The push spell table.
 */
function buildLandingIndex( table ) {
    const map = new Map();
    let minLength = 8;
    const add = ( name, spell ) => {
        if ( !spell.landText ) {
            return;
        }
        const base = stripRank( name );
        const list = map.get( spell.landText );
        if ( list === null || list === undefined ) {
            map.set( spell.landText, [ base ] );
        } else if ( list.indexOf( base ) === -1 ) {
            list.push( base );
        }
        minLength = Math.min( minLength, spell.landText.length );
    };
    Object.keys( table.spells ).forEach( name => add( name, table.spells[ name ] ) );
    Object.keys( table.exact ).forEach( name => add( name, table.exact[ name ] ) );

    const suffixes = new Set();
    map.forEach( ( names, text ) => suffixes.add( text.slice( -minLength ) ) );

    let noPush = new Map( Array.isArray( table.noPushTexts ) ? table.noPushTexts.map( text => [ text, { names: [], count: 0 } ] ) : Object.entries( table.noPushTexts ?? {} ) );

    return { map: map, noPush: noPush, suffixes: suffixes, suffixLength: minLength };
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

    const lines = [];
    const times = [];
    let anchorTime = null;
    let newestTime = null;
    let oldestTime = null;
    let reachedStart = true;
    const hotkeyLine = `${characterName}${hotkeyText}`;

    const handle = await fs.promises.open( logFilePath, 'r' );
    try {
        let position = ( await handle.stat() ).size;
        let leftover = null;
        let done = false;

        while ( position > 0 && !done ) {
            const length = Math.min( chunkSize, position );
            position -= length;

            const chunk = Buffer.allocUnsafe( length );
            let read = 0;
            while ( read < length ) {
                const result = await handle.read( chunk, read, length - read, position + read );
                if ( result.bytesRead === 0 ) {
                    break;
                }
                read += result.bytesRead;
            }

            const combined = leftover ? Buffer.concat( [ chunk, leftover ] ) : chunk;
            let region = combined;

            if ( position > 0 ) {
                // The first line of the chunk may continue in the previous chunk.
                const newline = combined.indexOf( 10 );
                if ( newline === -1 ) {
                    leftover = combined;
                    continue;
                }
                leftover = combined.subarray( 0, newline );
                region = combined.subarray( newline + 1 );
            } else {
                leftover = null;
            }

            const chunkLines = region.toString( 'latin1' ).split( '\n' );

            for ( let i = chunkLines.length - 1; i >= 0; i-- ) {
                let line = chunkLines[ i ];
                if ( line.length > 0 && line.charCodeAt( line.length - 1 ) === 13 ) {
                    line = line.substring( 0, line.length - 1 );
                }

                const time = parseTimestamp( line );
                if ( time !== time ) {
                    continue;
                }
                if ( newestTime === null ) {
                    newestTime = time;
                }

                if ( anchorTime === null && line.endsWith( hotkeyText ) ) {
                    const text = line.substring( textOffset );
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

                if ( isRelevantLine( line, landing ) ) {
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

    return {
        characterName: characterName,
        anchorTime: anchorTime ?? newestTime,
        lines: lines,
        times: times,
        oldestTime: oldestTime,
        reachedStart: reachedStart
    };
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

    const damage = new Map();
    const candidates = [];
    const npcNames = new Set();
    const actorTargets = new Map();
    let othersSeen = false;

    for ( let i = 0; i < session.lines.length; i++ ) {
        const text = session.lines[ i ].substring( textOffset );
        const m = matchCombat( text );

        if ( m === null || m === undefined ) {
            continue;
        }

        const target = m.groups.target;
        if ( m.groups.damage === undefined ) {
            candidates.push( { index: i, time: session.times[ i ], name: target, killer: m.groups.actor ?? 'You', certain: m.groups.verb !== 'has been' && m.groups.verb !== 'have been', damage: damage.get( target ) ?? 0 } );
            damage.delete( target );
            continue;
        }

        const actor = m.groups.actor;
        damage.set( target, ( damage.get( target ) ?? 0 ) + +m.groups.damage );

        const actorMine = actor === 'You' || rgx.PetName.test( actor );
        const targetMine = target === 'You' || rgx.PetName.test( target );
        if ( actorMine && !targetMine ) {
            npcNames.add( target );
        } else if ( targetMine && !actorMine ) {
            npcNames.add( actor );
        }

        if ( rgx.PlayerName.test( actor ) ) {
            let targets = actorTargets.get( actor );
            if ( targets === null || targets === undefined ) {
                targets = new Set();
                actorTargets.set( actor, targets );
            }
            targets.add( target );
        }

        if ( !othersSeen && actor !== 'You' && ( rgx.PlayerName.test( actor ) || rgx.PetName.test( actor ) ) && target !== 'You' && !rgx.PlayerName.test( target ) ) {
            othersSeen = true;
        }
    }

    // "was slain by" is an NPC kill.  Servers that word every death "has been slain by"
    // are trusted only when a player-side name did the killing, so a wipe is never
    // listed as kills.
    const slain = new Set();
    let kills = [];
    const fallback = [];
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

    const playerNames = new Set();
    actorTargets.forEach( ( targets, actor ) => {
        targets.forEach( t => {
            if ( npcNames.has( t ) ) {
                playerNames.add( actor );
            }
        } );
    } );

    fallback.forEach( k => {
        const playerSide = npcNames.has( k.name ) || k.killer === 'You' || rgx.PetName.test( k.killer ) || ( playerNames.has( k.killer ) && !npcNames.has( k.killer ) );
        if ( k.name !== 'You' && !rgx.PetName.test( k.name ) && playerSide ) {
            slain.add( k.name );
            npcNames.add( k.name );
            kills.push( k );
        }
    } );

    kills = kills.sort( ( x, y ) => x.index - y.index ).map( k => ( {
        index: k.index, time: k.time, clock: formatClock( k.time ), name: k.name, damage: k.damage
    } ) );

    kills.reverse();
    const largest = kills.reduce( ( max, k ) => Math.max( max, k.damage ), 0 );

    let defaultKill = kills.findIndex( k => k.damage > 0 && k.damage >= largest * bigFightRatio );
    defaultKill = defaultKill === -1 ? 0 : defaultKill;

    return {
        kills: kills.slice( 0, Math.max( maxFightList, defaultKill + 1 ) ),
        defaultKill: defaultKill,
        slain: slain,
        npcNames: npcNames,
        othersSeen: othersSeen
    };
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
        if ( name === null || name === undefined ) {
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
 * @returns {{ text: string, name: string, names: string[], push: number | null, pushMin: number | null, pushMax: number | null, count: number }} The proc.
 *
 * @param {string} text The landing message, after the name of the mob.
 * @param {string[]} names The candidate spell names of the landing message.
 * @param {any} table The push spell table.
 */
function buildProc( text, names, table ) {
    let pushes = names.map( n => table.spells[ n ]?.push ).filter( p => p != null );
    let pushMin = pushes.length > 0 ? Math.min( ...pushes ) : null;
    let pushMax = pushes.length > 0 ? Math.max( ...pushes ) : null;
    let name = names.length <= 3 ? names.join( ' / ' ) : `${names[ 0 ]} +${names.length - 1} more`;
    return { text: text, name: name, names: names, push: pushMin === pushMax ? pushMin : null, pushMin: pushMin, pushMax: pushMax, count: 0 };
}










/**
 * @typedef {Object} PushPlayer
 * @property {string} name The player name.
 * @property {number} events The number of push events.
 * @property {number} confirmed The number of confirmed events.
 * @property {number} assumed The number of assumed events.
 * @property {number} pushValue The summed push value.
 * @property {{ name: string, confirmed: number, assumed: number, push: number }[]} spells
 *     The spells, most used first.
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
    return ( m !== null && m !== undefined ) && ( m.groups.actor === boss || m.groups.target === boss );
}










/**
 * Counts who pushed the given kill.
 *
 * @returns {any} The recap result.
 *
 * @param {PushSession} session The session.
 * @param {PushSummary} summary The session summary.
 * @param {import('../data/push-spells').PushSpellTable} table The push spell table.
 * @param {{ map: Map<string, string[]>, noPush: Map<string, { names: string[], count: number }> }} landing The landing index.
 * @param {PushKill} kill The kill to analyze.
 * @param {number} quietGapSeconds Seconds without combat that separate fights.
 */
function analyzeKill( session, summary, table, landing, kill, quietGapSeconds ) {

    const boss = kill.name;
    const ctx = { characterName: session.characterName, boss: boss, npcNames: summary.npcNames };
    const gapMs = quietGapSeconds * 1000;

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
    let possibleEvents = 0;
    let possibleProcs = new Map();
    let unmatched = [];
    let npcAbilities = new Map();
    let othersSeen = summary.othersSeen === true;
    let damageShown = player => player === ctx.characterName || othersSeen;

    const cancelCast = ( player, time ) => {
        const ev = lastCast.get( player );
        if ( ev !== null && ev !== undefined && ev.state !== 'cancelled' && time - ev.time <= ev.castTime + interruptGraceMs ) {
            ev.state = 'cancelled';
        }
        lastCast.delete( player );
    };

    for ( let i = startIndex; i < kill.index; i++ ) {
        const text = session.lines[ i ].substring( textOffset );
        const time = session.times[ i ];
        let m = null;

        if ( text.indexOf( ' damage by ' ) > -1 && ( m = rgx.DirectDamage.exec( text ) ) !== null ) {
            const spellName = m.groups.attackType;
            const spell = findPushSpell( table, spellName );
            if ( spell === null || spell === undefined ) {
                continue;
            }
            const player = resolvePlayer( m.groups.actor, ctx );
            if ( player === null || player === undefined ) {
                const key = `${m.groups.actor}\u0000${spellName}`;
                const entry = npcAbilities.get( key ) ?? { actor: m.groups.actor, name: spellName, count: 0, push: spell.push };
                entry.count++;
                npcAbilities.set( key, entry );
            } else if ( m.groups.target === boss ) {
                // A cast waiting for its landing becomes this damage event.
                const base = stripRank( spellName );
                let pending = null;
                for ( let j = events.length - 1; j >= 0; j-- ) {
                    const ev = events[ j ];
                    if ( time - ev.time > ev.castTime + landingGraceMs + 10000 ) {
                        break;
                    }
                    if ( ev.kind === 'cast' && ev.state !== 'cancelled' && ev.player === player && stripRank( ev.spellName ) === base && time - ev.time <= ev.castTime + landingGraceMs ) {
                        pending = ev;
                        break;
                    }
                }
                if ( pending !== null && pending !== undefined ) {
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

        } else if ( text.indexOf( 'casting' ) > -1 && ( m = rgx.Cast.exec( text ) ) !== null ) {
            const player = resolvePlayer( m.groups.actor ?? 'You', ctx );
            if ( player === null || player === undefined ) {
                continue;
            }
            const spell = findPushSpell( table, m.groups.spell );
            if ( spell === null || spell === undefined ) {
                lastCast.set( player, null );
                continue;
            }
            let ev = { kind: 'cast', state: 'assumed', time: time, castTime: spell.castTime, player: player, spellName: m.groups.spell, spell: spell, landed: false, strict: spell.variantTexts?.length > 0 };
            events.push( ev );
            lastCast.set( player, ev );

        } else if ( text === 'Your spell is interrupted.' || text === 'Your spell fizzles!' ) {
            cancelCast( ctx.characterName, time );

        } else if ( text.indexOf( "'s " ) > -1 && ( m = rgx.OtherInterrupt.exec( text ) ) !== null ) {
            const player = resolvePlayer( m.groups.actor, ctx );
            if ( player !== null && player !== undefined ) {
                cancelCast( player, time );
            }

        } else if ( text.indexOf( 'resisted' ) > -1 && ( m = rgx.Resisted.exec( text ) ) !== null ) {
            const ev = lastCast.get( ctx.characterName );
            if ( ev !== null && ev !== undefined && stripRank( ev.spellName ) === stripRank( m.groups.spell ) ) {
                cancelCast( ctx.characterName, time );
            }

        } else if ( text.startsWith( boss ) ) {
            const names = landing.map.get( text.substring( boss.length ) );
            if ( names === null || names === undefined ) {
                continue;
            }
            let matched = false;
            for ( let j = events.length - 1; j >= 0; j-- ) {
                const ev = events[ j ];
                if ( time - ev.time > ev.castTime + landingGraceMs + 10000 ) {
                    break;
                }
                if ( ev.kind === 'cast' && ev.spell.instantDamage && damageShown( ev.player ) ) {
                    continue;
                }
                if ( ev.state !== 'cancelled' && !ev.landed && names.indexOf( stripRank( ev.spellName ) ) > -1 && time - ev.time <= ev.castTime + ( ev.strict ? strictLandingGraceMs : landingGraceMs ) ) {
                    ev.landed = true;
                    ev.state = 'confirmed';
                    matched = true;
                    break;
                }
            }
            if ( !matched ) {
                unmatched.push( { time: time, key: text.substring( boss.length ), names: names, claimed: false } );
            }
        }
    }

    // A cast of a spell that shares its name with spells that land differently counts only when its own landing was seen.
    events.forEach( ev => {
        if ( ev.strict && ev.state === 'assumed' ) {
            ev.state = 'cancelled';
        }
    } );

    // Instant damage spells always log a damage line naming the caster, so a cast with no damage line did not hit the boss.
    events.forEach( ev => {
        if ( ev.kind === 'cast' && ev.state !== 'cancelled' && ev.spell.instantDamage && damageShown( ev.player ) ) {
            ev.state = 'cancelled';
        }
    } );

    // A landing that no damage line claimed is not an instant damage spell of a caster whose damage lines are in the log.
    // The damage line can come before or after its landing.
    // The damage events by spell, in time order, so a landing only looks at the ones within a second of it.
    let bySpell = new Map();
    events.forEach( ( ev, index ) => {
        if ( ev.kind === 'damage' && ev.state !== 'cancelled' ) {
            let base = stripRank( ev.spellName );
            let list = bySpell.get( base );
            if ( list == null ) {
                list = [];
                bySpell.set( base, list );
            }
            list.push( { ev: ev, index: index } );
        }
    } );
    bySpell.forEach( list => list.sort( ( a, b ) => a.ev.time - b.ev.time || a.index - b.index ) );

    unmatched.forEach( u => {
        let claimer = null;
        u.names.forEach( name => {
            let list = bySpell.get( name );
            if ( list == null ) {
                return;
            }
            let low = 0;
            let high = list.length;
            while ( low < high ) {
                let mid = ( low + high ) >> 1;
                if ( list[ mid ].ev.time < u.time - claimGraceMs ) {
                    low = mid + 1;
                } else {
                    high = mid;
                }
            }
            for ( let i = low; i < list.length && list[ i ].ev.time <= u.time + claimGraceMs; i++ ) {
                if ( !list[ i ].ev.landed && ( claimer == null || list[ i ].index < claimer.index ) ) {
                    claimer = list[ i ];
                }
            }
        } );
        if ( claimer != null ) {
            claimer.ev.landed = true;
            u.claimed = true;
        }
        if ( othersSeen ) {
            u.names = u.names.filter( n => !table.spells[ n ]?.instantDamage );
        }
    } );

    unmatched.forEach( u => {
        if ( u.claimed || u.names.length === 0 ) {
            return;
        }
        let key = u.key;
        let names = u.names;
        let also = landing.noPush.get( key );
        let shared = also != null;
        if ( shared ) {
            possibleEvents++;
        } else {
            unattributed.events++;
            unattributed.pushValue += table.spells[ names[ 0 ] ]?.push ?? 0;
        }
        let procMap = shared ? possibleProcs : unattributedProcs;
        let proc = procMap.get( key );
        if ( proc == null ) {
            proc = buildProc( key, names, table );
            if ( shared ) {
                proc.alsoNames = also.names;
                proc.alsoCount = also.count;
            }
            procMap.set( key, proc );
        }
        proc.count++;
    } );

    /** @type {Map<string, PushPlayer>} */
    let players = new Map();
    events.forEach( ev => {
        if ( ev.state === 'cancelled' ) {
            return;
        }
        let player = players.get( ev.player );
        if ( player === null || player === undefined ) {
            player = { name: ev.player, events: 0, confirmed: 0, assumed: 0, pushValue: 0, spells: [] };
            players.set( ev.player, player );
        }
        let spell = player.spells.find( s => s.name === ev.spellName );
        if ( spell === null || spell === undefined ) {
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

    const list = Array.from( players.values() );
    list.forEach( p => {
        p.pushValue = roundPush( p.pushValue );
        p.spells.sort( ( a, b ) => ( b.confirmed + b.assumed ) - ( a.confirmed + a.assumed ) );
    } );
    list.sort( ( a, b ) => b.events - a.events || a.name.localeCompare( b.name ) );

    const totalEvents = list.reduce( ( sum, p ) => sum + p.events, 0 );
    const totalPush = roundPush( list.reduce( ( sum, p ) => sum + p.pushValue, 0 ) );

    return {
        boss: boss,
        killClock: kill.clock,
        killTime: kill.time,
        startClock: formatClock( session.times[ startIndex ] ),
        durationSeconds: Math.round( ( kill.time - session.times[ startIndex ] ) / 1000 ),
        damageTaken: kill.damage,
        players: list,
        unattributed: {
            events: unattributed.events,
            pushValue: roundPush( unattributed.pushValue ),
            procs: Array.from( unattributedProcs.values() ).sort( ( a, b ) => b.count - a.count || a.name.localeCompare( b.name ) ),
            possibleEvents: possibleEvents,
            possible: Array.from( possibleProcs.values() ).sort( ( a, b ) => b.count - a.count || a.name.localeCompare( b.name ) ),
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

module.exports = {
    readSession, summarize, analyzeKill, buildLandingIndex, parseTimestamp, isRelevantLine, matchCombat,
    isPlayerName, isPetName, textOffset, lookbackMs,
};
