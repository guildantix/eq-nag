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
 */
export function axisStep( max: number ): number {
    for ( let scale = 1; ; scale *= 10 ) {
        for ( let base of [ 1, 2, 5 ] ) {
            if ( Math.ceil( max / ( base * scale ) ) <= 6 ) {
                return base * scale;
            }
        }
    }
}

/**
 * Returns the raid night a kill belongs to as a date.  The kill time holds the log's clock as UTC, and a night runs from 06:00 to 06:00.
 */
export function nightKey( killTime: string ): string {
    return new Date( Date.parse( killTime ) - nightStartHour * 3600000 ).toISOString().substring( 0, 10 );
}

function mergeProcs( lists: PushRecapProc[][], hidden: Set<string> ): { procs: PushRecapProc[], hidden: number } {
    let merged = new Map<string, PushRecapProc>();
    let hiddenTexts = new Set<string>();
    lists.forEach( list => list.forEach( p => {
        if ( p.text != null && hidden.has( p.text ) ) {
            hiddenTexts.add( p.text );
            return;
        }
        let key = p.text != null ? `t:${p.text}` : `n:${p.name}`;
        let names = p.names ?? [ p.name ];
        let entry = merged.get( key );
        if ( entry == null ) {
            entry = { text: p.text, name: p.name, names: names.slice( 0, maxProcNames ), push: p.push, pushMin: p.pushMin, pushMax: p.pushMax, count: 0, alsoNames: p.alsoNames, alsoCount: p.alsoCount };
            merged.set( key, entry );
        } else {
            names.forEach( n => entry.names.indexOf( n ) === -1 && entry.names.length < maxProcNames && entry.names.push( n ) );
            let mins = [ entry.pushMin, p.pushMin ].filter( v => v != null );
            let maxes = [ entry.pushMax, p.pushMax ].filter( v => v != null );
            entry.pushMin = mins.length > 0 ? Math.min( ...mins ) : null;
            entry.pushMax = maxes.length > 0 ? Math.max( ...maxes ) : null;
            entry.push = entry.pushMin != null && entry.pushMin === entry.pushMax ? entry.pushMin : null;
            if ( entry.alsoNames == null || ( p.alsoNames != null && ( p.alsoCount ?? 0 ) > ( entry.alsoCount ?? 0 ) ) ) {
                entry.alsoNames = p.alsoNames;
                entry.alsoCount = p.alsoCount;
            }
        }
        entry.count += p.count;
    } ) );
    let procs = Array.from( merged.values() );
    procs.forEach( p => p.name = p.names.length <= 3 ? p.names.join( ' / ' ) : `${p.names[ 0 ]} +${p.names.length - 1} more` );
    procs.sort( ( a, b ) => b.count - a.count || a.name.localeCompare( b.name ) );
    return { procs: procs, hidden: hiddenTexts.size };
}

/**
 * Adds up the given fights.  The hidden proc messages are left out, and a fight that lacks a field counts for what it has.
 */
export function aggregateFights( recaps: PushRecapSummary[], hidden: Set<string> ): PushTotals {
    let sorted = recaps.slice().sort( ( a, b ) => a.killTime.localeCompare( b.killTime ) );
    let players = new Map<string, PushTotalsPlayer>();
    let spellTotals = new Map<string, number>();
    let spellPush = new Map<string, number | null>();
    let totals: PushTotals = {
        fights: sorted.length, hits: 0, assumed: 0, pushValue: 0, procHits: 0, seconds: 0,
        firstKill: sorted[ 0 ]?.killTime ?? '', lastKill: sorted[ sorted.length - 1 ]?.killTime ?? '',
        topPlayer: null, topPercent: 0, players: [], spells: [], spellPush: spellPush, procs: [], possible: [], hiddenProcs: 0, hiddenPossible: 0, perFight: [],
    };

    sorted.forEach( recap => {
        totals.hits += recap.events;
        totals.assumed += recap.assumed;
        totals.pushValue += recap.pushValue;
        totals.seconds += recap.fightSeconds;
        totals.perFight.push( { id: recap.id, mob: recap.mob, killTime: recap.killTime, hits: recap.events, pushValue: recap.pushValue } );
        let procs = recap.unattributed?.procs;
        totals.procHits += Array.isArray( procs ) ? procs.filter( p => p.text == null || !hidden.has( p.text ) ).reduce( ( sum, p ) => sum + p.count, 0 ) : recap.unattributed?.events ?? 0;

        ( recap.players ?? [] ).forEach( p => {
            let player = players.get( p.name );
            if ( player == null ) {
                player = { name: p.name, fights: 0, events: 0, assumed: 0, pushValue: 0, spells: new Map() };
                players.set( p.name, player );
            }
            player.fights++;
            player.events += p.events;
            player.assumed += p.assumed;
            player.pushValue += p.pushValue;
            Object.keys( p.spells ?? {} ).forEach( name => {
                let spell = p.spells[ name ];
                let entry = player.spells.get( name ) ?? { events: 0, assumed: 0 };
                entry.events += spell.events;
                entry.assumed += spell.assumed;
                player.spells.set( name, entry );
                spellTotals.set( name, ( spellTotals.get( name ) ?? 0 ) + spell.events );
                if ( spellPush.get( name ) == null ) {
                    spellPush.set( name, spell.push ?? null );
                }
            } );
        } );
    } );

    totals.pushValue = round( totals.pushValue );
    totals.players = Array.from( players.values() ).sort( ( a, b ) => b.events - a.events || a.name.localeCompare( b.name ) );
    totals.players.forEach( p => p.pushValue = round( p.pushValue ) );
    totals.spells = Array.from( spellTotals.keys() ).sort( ( a, b ) => spellTotals.get( b ) - spellTotals.get( a ) || a.localeCompare( b ) );
    totals.topPlayer = totals.players[ 0 ]?.name ?? null;
    totals.topPercent = totals.players.length > 0 && totals.hits > 0 ? Math.round( totals.players[ 0 ].events * 100 / totals.hits ) : 0;

    let procs = mergeProcs( sorted.map( r => r.unattributed?.procs ?? [] ), hidden );
    let possible = mergeProcs( sorted.map( r => r.unattributed?.possible ?? [] ), hidden );
    totals.procs = procs.procs;
    totals.possible = possible.procs;
    totals.hiddenProcs = procs.hidden;
    totals.hiddenPossible = possible.hidden;
    return totals;
}

/**
 * Describes the totals as plain text, for the clipboard.
 */
export function describeTotals( totals: PushTotals, label: string, fightingTime: string ): string {
    let lines = [
        `Push Recap - ${label}, ${totals.fights} fights, ${fightingTime} of fighting`,
        `${totals.hits} push hits, ${totals.pushValue} push, ${totals.players.length} players pushing`,
    ];
    totals.players.slice( 0, 10 ).forEach( ( p, i ) => {
        let share = totals.hits > 0 ? Math.round( p.events * 100 / totals.hits ) : 0;
        lines.push( `${i + 1}. ${p.name} - ${p.events} (${share}%)${p.assumed > 0 ? ` ~${p.assumed} assumed` : ''}, ${p.pushValue} push, ${p.fights} fights` );
    } );
    if ( totals.procHits > 0 ) {
        let top = totals.procs.slice( 0, 5 ).map( p => `${p.name} ${p.count}` ).join( ', ' );
        lines.push( `Procs with no player named: ${totals.procHits}${top === '' ? '' : ` (${top})`}` );
    }
    return lines.join( '\n' );
}
