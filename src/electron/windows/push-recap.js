const { ipcRenderer } = require( 'electron' );
const { loadPushSpells } = require( '../data/push-spells' );
const { readSession, summarize, analyzeKill, buildLandingIndex } = require( '../utilities/push-recap-parser' );
const { buildSavedSummary, notNamedNpcRgx } = require( '../utilities/push-recap-summary' );
const { buildTimelineModel, buildBars, barEvents, axisStep, formatOffset, formatClock } = require( '../utilities/push-timeline' );










/**
 * Formats the given damage value, e.g. 1.84B.
 *
 * @returns {string} The formatted value.
 *
 * @param {number} value The value.
 */
function formatDamage( value ) {
    if ( value >= 1000000000 ) {
        return `${( value / 1000000000 ).toFixed( 2 )}B`;
    } else if ( value >= 1000000 ) {
        return `${( value / 1000000 ).toFixed( 1 )}M`;
    } else if ( value >= 1000 ) {
        return `${( value / 1000 ).toFixed( 1 )}K`;
    }
    return `${value}`;
}










/**
 * Formats the given duration, e.g. 6m 41s.
 *
 * @returns {string} The formatted duration.
 *
 * @param {number} seconds The duration in seconds.
 */
function formatDuration( seconds ) {
    return seconds >= 60 ? `${Math.floor( seconds / 60 )}m ${seconds % 60}s` : `${seconds}s`;
}










/**
 * Lists the spells of a player, most hits first.
 *
 * @returns {{ name: string, confirmed: number, assumed: number, push: number | undefined }[]}
 *     The spells.
 *
 * @param {any} player The saved player.
 */
function listSpells( player ) {
    return Object.keys( player.spells ?? {} ).map( name => {
        const s = player.spells[ name ];
        return { name: name, confirmed: Math.max( 0, s.events - s.assumed ), assumed: s.assumed, push: s.push };
    } ).sort( ( x, y ) => ( y.confirmed + y.assumed ) - ( x.confirmed + x.assumed ) );
}










/**
 * Describes the spells of a player, e.g. Color Flux XVIII (push 0.5) ×71, Docility XII (push 0.5)
 * ~×25.
 *
 * @returns {string} The description.
 *
 * @param {any} player The saved player.
 * @param {number} max The maximum number of spells to list.
 */
function describeSources( player, max ) {
    return listSpells( player ).slice( 0, max ).map( s => {
        const counts = [];
        if ( s.confirmed > 0 ) {
            counts.push( `×${s.confirmed}` );
        }
        if ( s.assumed > 0 ) {
            counts.push( `~×${s.assumed}` );
        }
        return `${s.name}${( s.push !== null && s.push !== undefined ) ? ` (push ${s.push})` : ''} ${counts.join( ' ' )}`;
    } ).join( ', ' );
}










/**
 * Formats the kill time of the given summary as HH:MM:SS.  The kill time holds the log clock.
 *
 * @returns {string} The clock.
 *
 * @param {any} summary The saved summary.
 */
function formatKillClock( summary ) {
    return new Date( summary.killTime ).toISOString().substring( 11, 19 );
}










/**
 * Formats the push of one hit of a proc, e.g. 5 or 3–5.
 *
 * @returns {string} The text.
 *
 * @param {any} proc The proc.
 */
function formatProcPush( proc ) {
    if ( proc.pushMin === null || proc.pushMin === undefined ) {
        return '—';
    }
    return ( proc.push !== null && proc.push !== undefined ) ? `${proc.push}` : `${proc.pushMin}–${proc.pushMax}`;
}










/**
 * Formats the total push of a proc, e.g. 50 or ~30–50 when the spell is ambiguous.
 *
 * @returns {string} The text.
 *
 * @param {any} proc The proc.
 */
function formatProcTotal( proc ) {
    if ( proc.pushMin === null || proc.pushMin === undefined ) {
        return '—';
    }
    const round = value => Math.round( value * 100 ) / 100;
    return ( proc.push !== null && proc.push !== undefined ) ? `${round( proc.count * proc.push )}` : `~${round( proc.count * proc.pushMin )}–${round( proc.count * proc.pushMax )}`;
}










/**
 * Formats the landing message of a proc, e.g. … is struck by the axe of Rallos.
 *
 * @returns {string} The text.
 *
 * @param {any} proc The proc.
 */
function formatMessage( proc ) {
    return typeof proc.text === 'string' && proc.text !== '' ? `…${proc.text}` : '—';
}










/**
 * Lists the spells with no push that use the same message as a possible proc, e.g. A, B, C +5 more.
 *
 * @returns {string} The text.
 *
 * @param {any} proc The possible proc.
 */
function formatAlso( proc ) {
    const names = proc.alsoNames ?? [];
    if ( names.length === 0 ) {
        return '—';
    }
    const more = ( proc.alsoCount ?? 0 ) - names.length;
    return `${names.join( ', ' )}${more > 0 ? ` +${more} more` : ''}`;
}










/**
 * Builds a short plain text summary of the recap.
 *
 * @returns {string} The summary.
 *
 * @param {any} summary The saved summary.
 * @param {Set<string>} hidden The landing messages that are hidden.
 */
function buildSummaryText( summary, hidden ) {
    const players = summary.players ?? [];
    const lines = [
        `Push Recap - ${summary.mob}, killed ${formatKillClock( summary )}, fight ${formatDuration( summary.fightSeconds )}`,
        `${summary.events} push ${summary.events === 1 ? 'hit' : 'hits'}, ${players.length} ${players.length === 1 ? 'player' : 'players'} pushing`,
    ];
    players.forEach( ( p, i ) => {
        const share = summary.events > 0 ? Math.round( p.events * 100 / summary.events ) : 0;
        lines.push( `${i + 1}. ${p.name} - ${p.events} (${share}%)${p.assumed > 0 ? ` ~${p.assumed} assumed` : ''}` );
    } );
    const hiddenCount = list => ( list ?? [] ).filter( p => hidden.has( p.text ) ).reduce( ( sum, p ) => sum + p.count, 0 );
    const procs = ( summary.unattributed.procs ?? [] ).filter( p => !hidden.has( p.text ) );
    const procHits = summary.unattributed.events - hiddenCount( summary.unattributed.procs );
    if ( procHits > 0 ) {
        const top = procs.slice( 0, 5 ).map( p => `${p.name} ${p.count}` ).join( ', ' );
        lines.push( `Procs with no player named: ${procHits}${top === '' ? '' : ` (${top})`}` );
    }
    const possible = ( summary.unattributed.possible ?? [] ).filter( p => !hidden.has( p.text ) );
    const possibleHits = ( summary.unattributed.possibleEvents ?? 0 ) - hiddenCount( summary.unattributed.possible );
    if ( possibleHits > 0 ) {
        const top = possible.slice( 0, 5 ).map( p => `${p.name} ${p.count}` ).join( ', ' );
        lines.push( `Possible procs: ${possibleHits}${top === '' ? '' : ` (${top})`}` );
    }
    return lines.join( '\n' );
}










/**
 * Creates an element with the given class and text.
 *
 * @returns {HTMLElement} The element.
 *
 * @param {string} tag The tag name.
 * @param {string | null} className The css class.
 * @param {string | null} text The text content.
 */
function el( tag, className, text ) {
    const node = document.createElement( tag );
    if ( className ) {
        node.className = className;
    }
    if ( text !== null && text !== undefined ) {
        node.textContent = text;
    }
    return node;
}










/**
 * Shows a message in place of the recap.
 *
 * @param {string} text The message.
 * @param {boolean} isError True when the message is an error.
 */
function showMessage( text, isError ) {
    const message = document.getElementById( 'message' );
    message.textContent = text;
    message.className = isError ? 'message error' : 'message';
    message.hidden = false;
    document.getElementById( 'recap' ).hidden = true;
}










const svgNs = 'http://www.w3.org/2000/svg';
const chartSeries = [
    { key: 'player', name: 'Players', color: '#3987e5' },
    { key: 'proc', name: 'Procs, no player named', color: '#d95926' },
    { key: 'possible', name: 'Possible procs', color: '#199e70' },
];
const kindLabels = [ 'Hit', 'Cast, assumed ~', 'Proc', 'Possible proc' ];
const kindColors = [ '#3987e5', '#3987e5', '#d95926', '#199e70' ];

/** @type {{ update: ( summary: any, hidden: Set<string> ) => void, reset: () => void } | null} */
let timeline = null;










/**
 * Creates an SVG element.
 *
 * @returns {SVGElement} The element.
 *
 * @param {string} tag The tag name.
 * @param {Object<string, string | number>} attributes The attributes.
 * @param {string} [text] The text content.
 */
function svgEl( tag, attributes, text ) {
    let node = document.createElementNS( svgNs, tag );
    Object.keys( attributes ).forEach( key => node.setAttribute( key, `${attributes[ key ]}` ) );
    if ( text != null ) {
        node.textContent = text;
    }
    return node;
}










/**
 * Wires the push timeline: a column chart of the push hits over the fight, and a list of what landed in the selected column.
 *
 * @returns {{ update: ( summary: any, hidden: Set<string> ) => void, reset: () => void }} The timeline.
 */
function createTimeline() {

    let section = document.getElementById( 'timeline' );
    let note = document.getElementById( 'timelineNote' );
    let truncatedNote = document.getElementById( 'truncatedNote' );
    let svg = document.getElementById( 'chart' );
    let tip = document.getElementById( 'chartTip' );
    let measureButtons = Array.from( document.querySelectorAll( '#measure button' ) );
    let possibleToggle = document.getElementById( 'showPossible' );
    let table = document.getElementById( 'drill' );
    let measure = 'hits';
    let selected = -1;
    let current = null;

    let show = ( bar, event ) => {
        let a = bar * current.model.bucket;
        let z = Math.min( current.model.seconds, a + current.model.bucket );
        let clock = formatClock( current.model.fightStart, a );
        tip.textContent = '';
        tip.appendChild( el( 'div', 'tip-title', `${formatOffset( a )}–${formatOffset( z )}${clock === '' ? '' : ` · ${clock}`}` ) );
        chartSeries.filter( s => s.key !== 'possible' || possibleToggle.checked ).forEach( s => {
            let row = el( 'div', 'tip-row' );
            row.appendChild( el( 'span', null, s.name ) );
            row.appendChild( el( 'b', null, `${Math.round( current.bars[ bar ][ s.key ] * 100 ) / 100}` ) );
            tip.appendChild( row );
        } );
        tip.style.display = 'block';
        tip.style.left = `${Math.min( event.clientX + 14, window.innerWidth - 220 )}px`;
        tip.style.top = `${event.clientY + 14}px`;
    };

    let drill = () => {
        let body = table.querySelector( 'tbody' );
        body.textContent = '';
        let title = document.getElementById( 'drillTitle' );
        let summary = document.getElementById( 'drillNote' );
        if ( selected === -1 ) {
            table.hidden = true;
            title.textContent = 'Click a bar to see what landed';
            summary.textContent = '';
            return;
        }
        let model = current.model;
        let a = selected * model.bucket;
        let z = Math.min( model.seconds, a + model.bucket );
        let list = barEvents( model, selected, possibleToggle.checked );
        let counted = list.filter( e => e.kind !== 3 );
        let clock = formatClock( model.fightStart, a );
        title.textContent = `${formatOffset( a )}–${formatOffset( z )} into the fight${clock === '' ? '' : ` (${clock})`}`;
        summary.textContent = `${counted.length} ${counted.length === 1 ? 'hit' : 'hits'} · ${Math.round( counted.reduce( ( sum, e ) => sum + e.push, 0 ) * 100 ) / 100} push`;
        list.forEach( e => {
            let tr = el( 'tr', e.kind === 3 ? 'dimmed' : null );
            let eventClock = formatClock( model.fightStart, e.time );
            tr.appendChild( el( 'td', null, `${formatOffset( e.time )}${eventClock === '' ? '' : ` · ${eventClock}`}` ) );
            tr.appendChild( el( 'td', null, e.who === '' ? '—' : e.who ) );
            tr.appendChild( el( 'td', null, e.kind < 2 ? e.spell : `${e.spell}${e.text === '' ? '' : ` …${e.text}`}` ) );
            tr.appendChild( el( 'td', 'num', `${e.kind === 3 ? '~' : ''}${e.push}` ) );
            let kind = el( 'td', 'kind' );
            let chip = el( 'i' );
            chip.style.background = kindColors[ e.kind ];
            kind.appendChild( chip );
            kind.appendChild( document.createTextNode( kindLabels[ e.kind ] ) );
            tr.appendChild( kind );
            body.appendChild( tr );
        } );
        table.hidden = false;
    };

    let draw = () => {
        svg.textContent = '';
        let { model } = current;
        let showPossible = possibleToggle.checked;
        let bars = buildBars( model, measure, showPossible );
        current.bars = bars;
        let width = 1000, height = 260, left = 44, right = 8, top = 10, bottom = 28, plotWidth = width - left - right, plotHeight = height - top - bottom;
        let max = Math.max( 1, ...bars.map( b => b.player + b.proc + b.possible ) );
        let step = axisStep( max );
        let ceiling = Math.ceil( max / step ) * step;

        for ( let v = 0; v <= ceiling + step / 2; v += step ) {
            let y = top + plotHeight - v / ceiling * plotHeight;
            svg.appendChild( svgEl( 'line', { x1: left, x2: width - right, y1: y, y2: y, stroke: v === 0 ? '#383835' : '#2c2c2a', 'stroke-width': 1 } ) );
            svg.appendChild( svgEl( 'text', { x: left - 8, y: y + 4, 'text-anchor': 'end', class: 'tick' }, `${Math.round( v * 100 ) / 100}` ) );
        }
        for ( let s = 0; s <= model.seconds; s += 30 ) {
            svg.appendChild( svgEl( 'text', { x: left + s / model.seconds * plotWidth, y: height - 8, 'text-anchor': s === 0 ? 'start' : s === model.seconds ? 'end' : 'middle', class: 'tick' }, formatOffset( s ) ) );
        }

        let barWidth = plotWidth / model.count;
        let gap = Math.min( 2, barWidth * 0.2 );
        bars.forEach( ( b, i ) => {
            let y0 = top + plotHeight;
            let x = left + i * barWidth + gap / 2;
            let w = barWidth - gap;
            let parts = chartSeries.filter( s => b[ s.key ] > 0 && ( s.key !== 'possible' || showPossible ) );
            parts.forEach( ( s, j ) => {
                let h = b[ s.key ] / ceiling * plotHeight;
                let isTop = j === parts.length - 1;
                let y = y0 - h;
                let r = isTop ? Math.min( 4, w / 2, h ) : 0;
                let d = r > 0 ? `M${x},${y0} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y0} Z` : `M${x},${y0} V${y} H${x + w} V${y0} Z`;
                svg.appendChild( svgEl( 'path', { d: d, fill: s.color, opacity: selected === -1 || selected === i ? 1 : 0.35 } ) );
                y0 = y - ( isTop ? 0 : 2 );
            } );
            let area = svgEl( 'rect', { x: left + i * barWidth, y: top, width: barWidth, height: plotHeight, fill: 'transparent', style: 'cursor: pointer' } );
            area.addEventListener( 'mousemove', event => show( i, event ) );
            area.addEventListener( 'mouseleave', () => tip.style.display = 'none' );
            area.addEventListener( 'click', () => {
                selected = selected === i ? -1 : i;
                draw();
                drill();
            } );
            svg.appendChild( area );
        } );

        document.getElementById( 'chartHint' ).textContent = `Each bar is ${model.bucket} ${model.bucket === 1 ? 'second' : 'seconds'}. ${measure === 'hits' ? 'Height = push hits.' : 'Height = push value added up.'}`;

        let legend = document.getElementById( 'legend' );
        legend.textContent = '';
        chartSeries.filter( s => s.key !== 'possible' || showPossible ).forEach( s => {
            let item = el( 'span' );
            let chip = el( 'i' );
            chip.style.background = s.color;
            item.appendChild( chip );
            item.appendChild( document.createTextNode( s.name ) );
            legend.appendChild( item );
        } );
    };

    measureButtons.forEach( button => button.addEventListener( 'click', () => {
        measure = button.dataset.measure;
        measureButtons.forEach( b => b.classList.toggle( 'on', b === button ) );
        if ( current != null ) {
            draw();
        }
    } ) );
    possibleToggle.addEventListener( 'change', () => {
        if ( current != null ) {
            draw();
            drill();
        }
    } );

    return {
        update: ( summary, hidden ) => {
            let model = buildTimelineModel( summary, hidden );
            section.hidden = model == null;
            note.hidden = model != null;
            truncatedNote.hidden = model == null || summary.timelineTruncated !== true;
            truncatedNote.textContent = `Long fight: the timeline shows only ${summary.timeline?.length ?? 0} entries, so some are left out.`;
            tip.style.display = 'none';
            current = model == null ? null : { model: model, bars: [] };
            if ( current != null ) {
                selected = Math.min( selected, model.count - 1 );
                draw();
                drill();
            }
        },
        reset: () => {
            selected = -1;
        },
    };
}










/**
 * Fills a proc table.  The procs with a hidden message are left out and counted in the hint.
 *
 * @param {string} bodyId The id of the table body.
 * @param {string} hintId The id of the element that tells how many messages are hidden.
 * @param {any[]} procs The procs.
 * @param {Set<string>} hidden The landing messages that are hidden.
 * @param {boolean} possible True for the table of possible procs.
 */
function renderProcRows( bodyId, hintId, procs, hidden, possible ) {
    const body = document.getElementById( bodyId );
    body.textContent = '';
    const shown = procs.filter( p => !hidden.has( p.text ) );
    shown.forEach( p => {
        const tr = el( 'tr' );
        tr.appendChild( el( 'td', 'hit-message', formatMessage( p ) ) );
        const name = el( 'td', possible ? 'dimmed' : null, p.name );
        if ( p.names?.length > 1 ) {
            name.title = p.names.join( ', ' );
        }
        tr.appendChild( name );
        if ( possible ) {
            tr.appendChild( el( 'td', 'sources', formatAlso( p ) ) );
        }
        tr.appendChild( el( 'td', possible ? 'num dimmed' : 'num', formatProcPush( p ) ) );
        tr.appendChild( el( 'td', 'num', `${p.count}` ) );
        const total = formatProcTotal( p );
        tr.appendChild( el( 'td', possible ? 'num dimmed' : 'num', possible && !total.startsWith( '~' ) && ( p.pushMin !== null && p.pushMin !== undefined ) ? `~${total}` : total ) );
        const action = el( 'td', 'num' );
        if ( typeof p.text === 'string' && p.text !== '' ) {
            const button = el( 'button', 'hide-message', '×' );
            button.type = 'button';
            button.title = 'Hide this message from the proc tables';
            button.addEventListener( 'click', () => ipcRenderer.send( 'push-recaps:hidden:set', { text: p.text, hidden: true } ) );
            action.appendChild( button );
        }
        tr.appendChild( action );
        body.appendChild( tr );
    } );
    body.parentElement.hidden = shown.length === 0;
    const count = procs.length - shown.length;
    const hint = document.getElementById( hintId );
    hint.hidden = count === 0;
    hint.textContent = ` ${count} ${count === 1 ? 'message' : 'messages'} hidden (Settings › Push Recap).`;
}










/**
 * Renders the given saved summary.  The pop-up only ever draws a summary, so a recap saved
 * by an older version, which lacks some fields, draws without those sections.
 *
 * @param {any} summary The saved summary.
 * @param {Set<string>} hidden The landing messages that are hidden.
 */
function render( summary, hidden ) {
    document.getElementById( 'message' ).hidden = true;
    document.getElementById( 'recap' ).hidden = false;

    const players = summary.players ?? [];
    const procs = summary.unattributed?.procs;
    const procHits = summary.unattributed?.events ?? 0;
    const topPlayer = players.find( p => p.name === summary.topPusher );
    const hasTopPlayer = topPlayer !== null && topPlayer !== undefined && summary.events > 0;
    const topPercent = hasTopPlayer ? Math.round( topPlayer.events * 100 / summary.events ) : 0;

    document.getElementById( 'bossName' ).textContent = summary.mob;
    document.getElementById( 'bossMeta' ).textContent = `Killed ${formatKillClock( summary )} · fight ${formatDuration( summary.fightSeconds )} · ${formatDamage( summary.damageTaken )} damage taken (HP estimate)${summary.named ? ' · named' : ''}`;

    document.getElementById( 'tileEvents' ).textContent = `${summary.events}`;
    document.getElementById( 'tileTop' ).textContent = summary.topPusher ?? '-';
    document.getElementById( 'tileTopLabel' ).textContent = summary.topPusher ? `top pusher · ${topPercent}% of hits` : 'top pusher';
    document.getElementById( 'tilePlayers' ).textContent = `${players.length}`;
    document.getElementById( 'tileValue' ).textContent = `${summary.pushValue}`;

    const rows = document.getElementById( 'playerRows' );
    rows.textContent = '';
    players.forEach( p => {
        const share = summary.events > 0 ? p.events * 100 / summary.events : 0;
        const tr = el( 'tr' );
        tr.appendChild( el( 'td', 'player', p.name ) );

        const events = el( 'td', 'num', `${p.events}` );
        if ( p.assumed > 0 ) {
            events.appendChild( el( 'span', 'assumed', ` ~${p.assumed}` ) );
        }
        tr.appendChild( events );

        const bar = el( 'span' );
        bar.style.width = `${share}%`;
        const shareCell = el( 'td' );
        const shareBox = el( 'div', 'share' );
        const barBox = el( 'div', 'bar' );
        barBox.appendChild( bar );
        shareBox.appendChild( barBox );
        shareBox.appendChild( el( 'div', 'pct', `${Math.round( share )}%` ) );
        shareCell.appendChild( shareBox );
        tr.appendChild( shareCell );

        tr.appendChild( el( 'td', 'num', `${p.pushValue}` ) );
        tr.appendChild( el( 'td', 'sources', describeSources( p, 4 ) ) );
        rows.appendChild( tr );
    } );

    if ( players.length === 0 ) {
        const tr = el( 'tr' );
        const cell = el( 'td', null, 'No push events were found in this fight.' );
        cell.colSpan = 5;
        tr.appendChild( cell );
        rows.appendChild( tr );
    }

    const hasProcs = Array.isArray( procs ) && procs.length > 0;
    document.getElementById( 'procs' ).hidden = !hasProcs;
    renderProcRows( 'procRows', 'procsHidden', hasProcs ? procs : [], hidden, false );
    const possible = summary.unattributed?.possible;
    const hasPossible = Array.isArray( possible ) && possible.length > 0;
    document.getElementById( 'possible' ).hidden = !hasPossible;
    renderProcRows( 'possibleRows', 'possibleHidden', hasPossible ? possible : [], hidden, true );
    const procsFallback = document.getElementById( 'procsFallback' );
    procsFallback.hidden = hasProcs || procHits <= 0;
    procsFallback.textContent = `${procHits} more ${procHits === 1 ? 'hit' : 'hits'} came from procs with no player named. Re-scan the log to see which procs they were.`;

    document.getElementById( 'othersHint' ).hidden = summary.othersSeen !== false;

    const cutOffHint = document.getElementById( 'cutOffHint' );
    cutOffHint.hidden = summary.startsAtLogEdge !== true;
    cutOffHint.textContent = summary.reachedStart ? 'The log starts during this fight, so earlier pushes are missing.' : 'This fight began before the part of the log that was read, so earlier pushes are not counted.';

    timeline.update( summary, hidden );

    let hasNpc = Array.isArray( summary.npcAbilities );
    document.getElementById( 'npcToggleLabel' ).hidden = !hasNpc;
    document.getElementById( 'npcAbilities' ).hidden = !hasNpc || !document.getElementById( 'npcToggle' ).checked;
    const npcRows = document.getElementById( 'npcRows' );
    npcRows.textContent = '';
    if ( hasNpc ) {
        summary.npcAbilities.forEach( a => {
            const tr = el( 'tr' );
            tr.appendChild( el( 'td', null, a.actor ) );
            tr.appendChild( el( 'td', null, a.name ) );
            tr.appendChild( el( 'td', 'num', `${a.count}` ) );
            tr.appendChild( el( 'td', 'num', `${a.push}` ) );
            npcRows.appendChild( tr );
        } );
        if ( summary.npcAbilities.length === 0 ) {
            const tr = el( 'tr' );
            const cell = el( 'td', null, 'No NPC push abilities were found in this fight.' );
            cell.colSpan = 4;
            tr.appendChild( cell );
            npcRows.appendChild( tr );
        }
    }
}










/**
 * The push recap screen.  Shows a snapshot of one fight and never refreshes it.  The snapshot is
 * either handed over by the Push tab, or built from the end of the log once, when there is none.
 *
 * @param {any} params The window parameters: log path, character name, EverQuest and user data
 *     folders, quiet gap, whether to save recaps and whether the window shows a snapshot.
 */
async function PushRecap( params ) {

    document.getElementById( 'characterName' ).textContent = params.characterName;
    document.getElementById( 'closeButton' ).addEventListener( 'click', () => ipcRenderer.send( 'window:child:close' ) );
    document.getElementById( 'npcToggle' ).addEventListener( 'change', e => document.getElementById( 'npcAbilities' ).hidden = !e.target.checked );

    const quietGapSeconds = params.quietGapSeconds >= 5 && params.quietGapSeconds <= 300 ? params.quietGapSeconds : 30;
    let shown = null;

    document.getElementById( 'copyButton' ).addEventListener( 'click', () => {
        if ( shown !== null && shown !== undefined ) {
            ipcRenderer.send( 'clipboard:writeText', buildSummaryText( shown, hidden ) );
            document.getElementById( 'copyButton' ).textContent = 'Copied';
        }
    } );

    let hidden = new Set();
    timeline = createTimeline();
    ipcRenderer.on( 'push-recap:hidden-changed', ( event, texts ) => {
        hidden = new Set( texts );
        if ( shown !== null && shown !== undefined ) {
            render( shown, hidden );
        }
    } );

    let state = 'unsaved';
    let clicked = false;
    const saveButton = document.getElementById( 'saveButton' );
    const showSaveState = () => {
        saveButton.textContent = state === 'saved' ? 'Saved' : state === 'pending' ? 'Saving...' : state === 'failed' ? "Couldn't save - try again" : 'Save to Push tab';
        saveButton.disabled = state === 'saved' || state === 'pending';
        saveButton.hidden = ( shown === null || shown === undefined ) || ( !clicked && ( state === 'saved' || state === 'pending' ) );
    };
    const save = () => {
        if ( shown !== null && shown !== undefined && state !== 'saved' && state !== 'pending' ) {
            state = 'pending';
            ipcRenderer.send( 'push-recaps:save', Object.assign( {}, shown, { id: '', saveKey: 0 } ) );
            showSaveState();
        }
    };
    saveButton.addEventListener( 'click', () => {
        clicked = true;
        save();
    } );
    ipcRenderer.on( 'push-recaps:saved', ( event, reply ) => {
        state = reply.ok ? 'saved' : 'failed';
        showSaveState();
    } );

    const show = ( summary, saved ) => {
        shown = summary;
        timeline.reset();
        state = saved ? 'saved' : 'unsaved';
        document.getElementById( 'copyButton' ).textContent = 'Copy summary';
        showSaveState();
        render( summary, hidden );
    };

    try {
        hidden = new Set( await ipcRenderer.invoke( 'push-recaps:hidden:get' ).catch( () => [] ) );
        if ( params.snapshot ) {
            const snapshot = await ipcRenderer.invoke( 'push-recap:snapshot' );
            if ( ( snapshot?.recap === null || snapshot?.recap === undefined ) || typeof snapshot.recap !== 'object' ) {
                showMessage( 'There is no fight to show. Pick one in the Push tab.', false );
                return;
            }
            show( snapshot.recap, snapshot.saved === true );
            return;
        }

        showMessage( 'Loading spell data...', false );
        const table = await loadPushSpells( params.logFilePath, params.eqFolder, params.userData );
        const landing = buildLandingIndex( table );

        showMessage( 'Reading the log...', false );
        const session = await readSession( params.logFilePath, params.characterName, landing );
        const summary = summarize( session );

        if ( summary.kills.length === 0 ) {
            showMessage( 'No kills were found in the 30 minutes of log before the hotkey.', false );
            return;
        }

        const lastKill = summary.kills[ summary.defaultKill ];
        const analysis = analyzeKill( session, summary, table, landing, lastKill, quietGapSeconds );
        show( buildSavedSummary( analysis, params.characterName ), false );
        if ( params.saveRecaps ) {
            save();
        }

    } catch ( error ) {
        showMessage( error.code === 'no-folder' || error.code === 'no-file' || error.code === 'no-push-spells' ? error.message : `The push recap could not be built: ${error.message}`, true );
    }

}

module.exports = PushRecap;
