import { PushRecapProc, PushRecapSummary } from '../core.model';

const nightStartHour = 6;
const maxProcNames = 40;

export interface PushTotalsPlayer {
    name: string;
    fights: number;
    events: number;
    assumed: number;
    pushValue: number;
    spells: Map<string, { events: number, assumed: number }>;
}

export interface PushTotalsFight {
    id: string;
    mob: string;
    killTime: string;
    hits: number;
    pushValue: number;
}

export interface PushTotals {
    fights: number;
    hits: number;
    assumed: number;
    pushValue: number;
    procHits: number;
    seconds: number;
    firstKill: string;
    lastKill: string;
    topPlayer: string | null;
    topPercent: number;
    players: PushTotalsPlayer[];
    spells: string[];
    spellPush: Map<string, number | null>;
    procs: PushRecapProc[];
    possible: PushRecapProc[];
    hiddenProcs: number;
    hiddenPossible: number;
    perFight: PushTotalsFight[];
}

const round = ( value: number ): number => Math.round( value * 100 ) / 100;










/**
 * Returns a step for the vertical axis of a chart that gives at most 6 gridlines.
 *
 * @param max The largest value on the axis.
 */
export function axisStep( max: number ): number {
    for ( let scale = 1; ; scale *= 10 ) {
        for ( const base of [ 1, 2, 5 ] ) {
            if ( Math.ceil( max / ( base * scale ) ) <= 6 ) {
                return base * scale;
            }
        }
    }
}










/**
 * Returns the raid night a kill belongs to as a date.  The kill time holds the log clock as UTC,
 * and a night runs from 06:00 to 06:00, so a late kill still counts for its night.
 *
 * @param killTime The kill time, as an ISO date.
 */
export function nightKey( killTime: string ): string {
    return new Date( Date.parse( killTime ) - nightStartHour * 3600000 ).toISOString().substring( 0, 10 );
}










/**
 * Adds up the procs of several fights by their landing message, leaving out the hidden messages.
 *
 * @param lists The procs of each fight.
 * @param hidden The landing messages that are hidden.
 */
function mergeProcs( lists: PushRecapProc[][], hidden: Set<string> ): { procs: PushRecapProc[], hidden: number } {
    const merged = new Map<string, PushRecapProc>();
    const hiddenTexts = new Set<string>();
    lists.forEach( list => list.forEach( p => {
        if ( p.text !== null && p.text !== undefined && hidden.has( p.text ) ) {
            hiddenTexts.add( p.text );
            return;
        }
        const key = ( p.text !== null && p.text !== undefined ) ? `t:${p.text}` : `n:${p.name}`;
        const names = p.names ?? [ p.name ];
        let entry = merged.get( key );
        if ( entry === null || entry === undefined ) {
            entry = {
                text: p.text,
                name: p.name,
                names: names.slice( 0, maxProcNames ),
                push: p.push,
                pushMin: p.pushMin,
                pushMax: p.pushMax,
                count: 0,
                alsoNames: p.alsoNames,
                alsoCount: p.alsoCount,
            };
            merged.set( key, entry );
        } else {
            names.forEach( n => {
                if ( entry.names.indexOf( n ) === -1 && entry.names.length < maxProcNames ) {
                    entry.names.push( n );
                }
            } );
            const mins = [ entry.pushMin, p.pushMin ].filter( v => ( v !== null && v !== undefined ) );
            const maxes = [ entry.pushMax, p.pushMax ].filter( v => ( v !== null && v !== undefined ) );
            entry.pushMin = mins.length > 0 ? Math.min( ...mins ) : null;
            entry.pushMax = maxes.length > 0 ? Math.max( ...maxes ) : null;
            const hasMin = entry.pushMin !== null && entry.pushMin !== undefined;
            entry.push = hasMin && entry.pushMin === entry.pushMax ? entry.pushMin : null;
            const noAlsoYet = entry.alsoNames === null || entry.alsoNames === undefined;
            const hasMoreAlso = p.alsoNames !== null && p.alsoNames !== undefined && ( p.alsoCount ?? 0 ) > ( entry.alsoCount ?? 0 );
            if ( noAlsoYet || hasMoreAlso ) {
                entry.alsoNames = p.alsoNames;
                entry.alsoCount = p.alsoCount;
            }
        }
        entry.count += p.count;
    } ) );
    const procs = Array.from( merged.values() );
    procs.forEach( p => p.name = p.names.length <= 3 ? p.names.join( ' / ' ) : `${p.names[ 0 ]} +${p.names.length - 1} more` );
    procs.sort( ( a, b ) => b.count - a.count || a.name.localeCompare( b.name ) );
    return { procs: procs, hidden: hiddenTexts.size };
}










/**
 * Adds up the given fights.  The hidden proc messages are left out, and a fight that lacks a
 * field counts for what it has.
 *
 * @param recaps The fights to add up.
 * @param hidden The landing messages that are hidden.
 */
export function aggregateFights( recaps: PushRecapSummary[], hidden: Set<string> ): PushTotals {
    const sorted = recaps.slice().sort( ( a, b ) => a.killTime.localeCompare( b.killTime ) );
    const players = new Map<string, PushTotalsPlayer>();
    const spellTotals = new Map<string, number>();
    const spellPush = new Map<string, number | null>();
    const totals: PushTotals = {
        fights: sorted.length, hits: 0, assumed: 0, pushValue: 0, procHits: 0, seconds: 0,
        firstKill: sorted[ 0 ]?.killTime ?? '', lastKill: sorted[ sorted.length - 1 ]?.killTime ?? '',
        topPlayer: null, topPercent: 0, players: [], spells: [], spellPush: spellPush, procs: [], possible: [],
        hiddenProcs: 0, hiddenPossible: 0, perFight: [],
    };

    sorted.forEach( recap => {
        totals.hits += recap.events;
        totals.assumed += recap.assumed;
        totals.pushValue += recap.pushValue;
        totals.seconds += recap.fightSeconds;
        totals.perFight.push( { id: recap.id, mob: recap.mob, killTime: recap.killTime, hits: recap.events, pushValue: recap.pushValue } );
        const procs = recap.unattributed?.procs;
        if ( Array.isArray( procs ) ) {
            const shown = procs.filter( p => ( p.text === null || p.text === undefined ) || !hidden.has( p.text ) );
            totals.procHits += shown.reduce( ( sum, p ) => sum + p.count, 0 );
        } else {
            totals.procHits += recap.unattributed?.events ?? 0;
        }

        ( recap.players ?? [] ).forEach( p => {
            let player = players.get( p.name );
            if ( player === null || player === undefined ) {
                player = { name: p.name, fights: 0, events: 0, assumed: 0, pushValue: 0, spells: new Map() };
                players.set( p.name, player );
            }
            player.fights++;
            player.events += p.events;
            player.assumed += p.assumed;
            player.pushValue += p.pushValue;
            Object.keys( p.spells ?? {} ).forEach( name => {
                const spell = p.spells[ name ];
                const entry = player.spells.get( name ) ?? { events: 0, assumed: 0 };
                entry.events += spell.events;
                entry.assumed += spell.assumed;
                player.spells.set( name, entry );
                spellTotals.set( name, ( spellTotals.get( name ) ?? 0 ) + spell.events );
                if ( spellPush.get( name ) === null || spellPush.get( name ) === undefined ) {
                    spellPush.set( name, spell.push ?? null );
                }
            } );
        } );
    } );

    totals.pushValue = round( totals.pushValue );
    totals.players = Array.from( players.values() ).sort( ( a, b ) => b.events - a.events || a.name.localeCompare( b.name ) );
    totals.players.forEach( p => p.pushValue = round( p.pushValue ) );
    const spellOrder = ( a: string, b: string ): number => spellTotals.get( b ) - spellTotals.get( a ) || a.localeCompare( b );
    totals.spells = Array.from( spellTotals.keys() ).sort( spellOrder );
    totals.topPlayer = totals.players[ 0 ]?.name ?? null;
    const hasTop = totals.players.length > 0 && totals.hits > 0;
    totals.topPercent = hasTop ? Math.round( totals.players[ 0 ].events * 100 / totals.hits ) : 0;

    const procs = mergeProcs( sorted.map( r => r.unattributed?.procs ?? [] ), hidden );
    const possible = mergeProcs( sorted.map( r => r.unattributed?.possible ?? [] ), hidden );
    totals.procs = procs.procs;
    totals.possible = possible.procs;
    totals.hiddenProcs = procs.hidden;
    totals.hiddenPossible = possible.hidden;
    return totals;
}










/**
 * Describes the totals as plain text, for the clipboard.
 *
 * @param totals The totals to describe.
 * @param label The name of the selection, such as the date range.
 * @param fightingTime The total fight length, already formatted.
 */
export function describeTotals( totals: PushTotals, label: string, fightingTime: string ): string {
    const playerCount = totals.players.length;
    const lines = [
        `Push Recap - ${label}, ${totals.fights} fights, ${fightingTime} of fighting`,
        `${totals.hits} push ${totals.hits === 1 ? 'hit' : 'hits'}, ${totals.pushValue} push, ${playerCount} ${playerCount === 1 ? 'player' : 'players'} pushing`,
    ];
    totals.players.slice( 0, 10 ).forEach( ( p, i ) => {
        const share = totals.hits > 0 ? Math.round( p.events * 100 / totals.hits ) : 0;
        const assumed = p.assumed > 0 ? ` ~${p.assumed} assumed` : '';
        lines.push( `${i + 1}. ${p.name} - ${p.events} (${share}%)${assumed}, ${p.pushValue} push, ${p.fights} ${p.fights === 1 ? 'fight' : 'fights'}` );
    } );
    if ( totals.procHits > 0 ) {
        const top = totals.procs.slice( 0, 5 ).map( p => `${p.name} ${p.count}` ).join( ', ' );
        lines.push( `Procs with no player named: ${totals.procHits}${top === '' ? '' : ` (${top})`}` );
    }
    return lines.join( '\n' );
}
