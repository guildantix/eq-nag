const { ipcRenderer } = require( 'electron' );
const { loadPushSpells } = require( '../data/push-spells' );
const { readSession, summarize, analyzeKill, buildLandingIndex } = require( '../utilities/push-recap-parser' );

const notNamedNpcRgx = /^(?:A\s|An\s|a\s|an\s|[a-z])/;










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
 * Describes the spells of a player, e.g. Color Flux XVIII (push 0.5) ×71,
 * Docility XII (push 0.5) ~×25.
 *
 * @returns {string} The description.
 *
 * @param {any} player The player result.
 * @param {number} max The maximum number of spells to list.
 */
function describeSources( player, max ) {
    return player.spells.slice( 0, max ).map( s => {
        const counts = [];
        if ( s.confirmed > 0 ) {
            counts.push( `×${s.confirmed}` );
        }
        if ( s.assumed > 0 ) {
            counts.push( `~×${s.assumed}` );
        }
        return `${s.name} (push ${s.push}) ${counts.join( ' ' )}`;
    } ).join( ', ' );
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
 * Builds a short plain text summary of the recap.
 *
 * @returns {string} The summary.
 *
 * @param {any} result The recap result.
 */
function buildSummaryText( result ) {
    const lines = [
        `Push Recap - ${result.boss}, killed ${result.killClock}, fight ${formatDuration( result.durationSeconds )}`,
        `${result.totalEvents} push hits, ${result.players.length} players pushing`,
    ];
    result.players.forEach( ( p, i ) => {
        const share = result.totalEvents > 0 ? Math.round( p.events * 100 / result.totalEvents ) : 0;
        lines.push( `${i + 1}. ${p.name} - ${p.events} (${share}%)${p.assumed > 0 ? ` ~${p.assumed} assumed` : ''}` );
    } );
    if ( result.unattributed.events > 0 ) {
        const top = result.unattributed.procs.slice( 0, 5 ).map( p => `${p.name} ${p.count}` ).join( ', ' );
        lines.push( `Procs with no player named: ${result.unattributed.events} (${top})` );
    }
    return lines.join( '\n' );
}










/**
 * Builds the summary of the recap that is kept in the Push tab.
 *
 * @returns {any} The summary.
 *
 * @param {any} result The recap result.
 * @param {string} characterName The name of the character.
 */
function buildSavedSummary( result, characterName ) {
    return {
        characterName: characterName,
        mob: result.boss,
        killTime: new Date( result.killTime ).toISOString(),
        fightSeconds: result.durationSeconds,
        damageTaken: result.damageTaken,
        named: !notNamedNpcRgx.test( result.boss ),
        events: result.totalEvents,
        assumed: result.players.reduce( ( sum, p ) => sum + p.assumed, 0 ),
        pushValue: result.totalPush,
        topPusher: result.topPlayer,
        players: result.players.map( p => {
            let spells = {};
            p.spells.forEach( s => spells[ s.name ] = { events: s.confirmed + s.assumed, assumed: s.assumed } );
            return { name: p.name, events: p.events, assumed: p.assumed, pushValue: p.pushValue, spells: spells };
        } ),
        unattributed: { events: result.unattributed.events, pushValue: result.unattributed.pushValue },
    };
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










/**
 * Renders the given recap result.
 *
 * @param {any} result The recap result.
 */
function render( result ) {
    document.getElementById( 'message' ).hidden = true;
    document.getElementById( 'recap' ).hidden = false;

    document.getElementById( 'bossName' ).textContent = result.boss;
    document.getElementById( 'bossMeta' ).textContent = `Killed ${result.killClock} · fight ${formatDuration( result.durationSeconds )} · ${formatDamage( result.damageTaken )} damage taken (HP estimate)${notNamedNpcRgx.test( result.boss ) ? '' : ' · named'}`;

    document.getElementById( 'tileEvents' ).textContent = `${result.totalEvents}`;
    document.getElementById( 'tileTop' ).textContent = result.topPlayer ?? '-';
    document.getElementById( 'tileTopLabel' ).textContent = result.topPlayer ? `top pusher · ${result.topPercent}% of hits` : 'top pusher';
    document.getElementById( 'tilePlayers' ).textContent = `${result.players.length}`;
    document.getElementById( 'tileValue' ).textContent = `${result.totalPush}`;

    const rows = document.getElementById( 'playerRows' );
    rows.textContent = '';
    result.players.forEach( p => {
        const share = result.totalEvents > 0 ? p.events * 100 / result.totalEvents : 0;
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

    if ( result.players.length === 0 ) {
        const tr = el( 'tr' );
        const cell = el( 'td', null, 'No push events were found in this fight.' );
        cell.colSpan = 5;
        tr.appendChild( cell );
        rows.appendChild( tr );
    }

    document.getElementById( 'procs' ).hidden = result.unattributed.procs.length === 0;
    const procRows = document.getElementById( 'procRows' );
    procRows.textContent = '';
    result.unattributed.procs.forEach( p => {
        const tr = el( 'tr' );
        const name = el( 'td', null, p.name );
        if ( p.names.length > 1 ) {
            name.title = p.names.join( ', ' );
        }
        tr.appendChild( name );
        tr.appendChild( el( 'td', 'num', formatProcPush( p ) ) );
        tr.appendChild( el( 'td', 'num', `${p.count}` ) );
        tr.appendChild( el( 'td', 'num', formatProcTotal( p ) ) );
        procRows.appendChild( tr );
    } );

    document.getElementById( 'othersHint' ).hidden = result.othersSeen;

    const cutOffHint = document.getElementById( 'cutOffHint' );
    cutOffHint.hidden = !result.startsAtLogEdge;
    cutOffHint.textContent = result.reachedStart ? 'The log starts during this fight, so earlier pushes are missing.' : 'This fight began more than 30 minutes before the hotkey, so earlier pushes are not counted.';

    const npcRows = document.getElementById( 'npcRows' );
    npcRows.textContent = '';
    result.npcAbilities.forEach( a => {
        const tr = el( 'tr' );
        tr.appendChild( el( 'td', null, a.actor ) );
        tr.appendChild( el( 'td', null, a.name ) );
        tr.appendChild( el( 'td', 'num', `${a.count}` ) );
        tr.appendChild( el( 'td', 'num', `${a.push}` ) );
        npcRows.appendChild( tr );
    } );
    if ( result.npcAbilities.length === 0 ) {
        const tr = el( 'tr' );
        const cell = el( 'td', null, 'No NPC push abilities were found in this fight.' );
        cell.colSpan = 4;
        tr.appendChild( cell );
        npcRows.appendChild( tr );
    }
}










/**
 * The push recap screen.  Reads the spell data and the end of the log once, then
 * only recounts when another fight is picked.
 *
 * @param {{ logFilePath: string, characterName: string, eqFolder: string, userData: string, quietGapSeconds: number, saveRecaps: boolean }} params The window parameters.
 */
async function PushRecap( params ) {

    document.getElementById( 'characterName' ).textContent = params.characterName;
    document.getElementById( 'closeButton' ).addEventListener( 'click', () => ipcRenderer.send( 'window:child:close' ) );
    document.getElementById( 'npcToggle' ).addEventListener( 'change', e => document.getElementById( 'npcAbilities' ).hidden = !e.target.checked );

    const quietGapSeconds = params.quietGapSeconds >= 5 && params.quietGapSeconds <= 300 ? params.quietGapSeconds : 30;
    let result = null;

    document.getElementById( 'copyButton' ).addEventListener( 'click', () => {
        if ( result !== null && result !== undefined ) {
            ipcRenderer.send( 'clipboard:writeText', buildSummaryText( result ) );
            document.getElementById( 'copyButton' ).textContent = 'Copied';
        }
    } );

    let saved = new Set();
    let pending = new Set();
    let failed = new Set();
    let shownIndex = -1;
    let saveButton = document.getElementById( 'saveButton' );
    let showSaveState = () => {
        saveButton.textContent = saved.has( shownIndex ) ? 'Saved' : pending.has( shownIndex ) ? 'Saving...' : failed.has( shownIndex ) ? "Couldn't save - try again" : 'Save to Push tab';
        saveButton.disabled = saved.has( shownIndex ) || pending.has( shownIndex );
    };
    let save = () => {
        if ( result != null && !saved.has( shownIndex ) && !pending.has( shownIndex ) ) {
            pending.add( shownIndex );
            failed.delete( shownIndex );
            ipcRenderer.send( 'push-recaps:save', Object.assign( buildSavedSummary( result, params.characterName ), { saveKey: shownIndex } ) );
            showSaveState();
        }
    };
    saveButton.addEventListener( 'click', save );
    ipcRenderer.on( 'push-recaps:saved', ( event, reply ) => {
        pending.delete( reply.key );
        ( reply.ok ? saved : failed ).add( reply.key );
        showSaveState();
    } );

    try {
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

        const select = document.getElementById( 'fightSelect' );
        select.textContent = '';
        summary.kills.forEach( ( kill, i ) => {
            const option = el( 'option', null, `${kill.name} · ${kill.clock} · ${formatDamage( kill.damage )} damage` );
            option.value = `${i}`;
            select.appendChild( option );
        } );
        select.value = `${summary.defaultKill}`;

        const show = index => {
            result = analyzeKill( session, summary, table, landing, summary.kills[ index ], quietGapSeconds );
            shownIndex = index;
            document.getElementById( 'copyButton' ).textContent = 'Copy summary';
            showSaveState();
            render( result );
        };
        select.addEventListener( 'change', () => show( +select.value ) );
        show( summary.defaultKill );
        if ( params.saveRecaps ) {
            save();
        }

    } catch ( error ) {
        showMessage( error.code === 'no-folder' || error.code === 'no-file' || error.code === 'no-push-spells' ? error.message : `The push recap could not be built: ${error.message}`, true );
    }

}

module.exports = PushRecap;
