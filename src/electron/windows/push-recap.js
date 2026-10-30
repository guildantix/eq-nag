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
 * Describes the spells of a player, e.g. Color Flux XVIII x71 (0.5), Docility XII ~x25 (0.5).
 *
 * @returns {string} The description.
 *
 * @param {any} player The player result.
 * @param {number} max The maximum number of spells to list.
 */
function describeSources( player, max ) {
    return player.spells.slice( 0, max ).map( s => {
        let counts = [];
        if ( s.confirmed > 0 ) {
            counts.push( `×${s.confirmed}` );
        }
        if ( s.assumed > 0 ) {
            counts.push( `~×${s.assumed}` );
        }
        return `${s.name} ${counts.join( ' ' )} (${s.push})`;
    } ).join( ', ' );
}










/**
 * Builds a short plain text summary of the recap.
 *
 * @returns {string} The summary.
 *
 * @param {any} result The recap result.
 */
function buildSummaryText( result ) {
    let lines = [
        `Push Recap - ${result.boss}, killed ${result.killClock}, fight ${formatDuration( result.durationSeconds )}`,
        `${result.totalEvents} push events, ${result.players.length} players pushing`,
    ];
    result.players.forEach( ( p, i ) => {
        let share = result.totalEvents > 0 ? Math.round( p.events * 100 / result.totalEvents ) : 0;
        lines.push( `${i + 1}. ${p.name} - ${p.events} (${share}%)${p.assumed > 0 ? ` ~${p.assumed} assumed` : ''}` );
    } );
    if ( result.unattributed.events > 0 ) {
        lines.push( `Unattributed procs: ${result.unattributed.events}` );
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
    let node = document.createElement( tag );
    if ( className ) {
        node.className = className;
    }
    if ( text != null ) {
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
    let message = document.getElementById( 'message' );
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
    document.getElementById( 'tileTopLabel' ).textContent = result.topPlayer ? `top pusher · ${result.topPercent}% of events` : 'top pusher';
    document.getElementById( 'tilePlayers' ).textContent = `${result.players.length}`;
    document.getElementById( 'tileValue' ).textContent = `${result.totalPush}`;

    let rows = document.getElementById( 'playerRows' );
    rows.textContent = '';
    result.players.forEach( p => {
        let share = result.totalEvents > 0 ? p.events * 100 / result.totalEvents : 0;
        let tr = el( 'tr' );
        tr.appendChild( el( 'td', 'player', p.name ) );

        let events = el( 'td', 'num', `${p.events}` );
        if ( p.assumed > 0 ) {
            events.appendChild( el( 'span', 'assumed', ` ~${p.assumed}` ) );
        }
        tr.appendChild( events );

        let bar = el( 'span' );
        bar.style.width = `${share}%`;
        let shareCell = el( 'td' );
        let shareBox = el( 'div', 'share' );
        let barBox = el( 'div', 'bar' );
        barBox.appendChild( bar );
        shareBox.appendChild( barBox );
        shareBox.appendChild( el( 'div', 'pct', `${Math.round( share )}%` ) );
        shareCell.appendChild( shareBox );
        tr.appendChild( shareCell );

        tr.appendChild( el( 'td', 'num', `${p.pushValue}` ) );
        tr.appendChild( el( 'td', 'sources', describeSources( p, 4 ) ) );
        rows.appendChild( tr );
    } );

    if ( result.unattributed.events > 0 ) {
        let tr = el( 'tr', 'unattributed' );
        tr.appendChild( el( 'td', null, 'Unattributed procs' ) );
        tr.appendChild( el( 'td', 'num', `${result.unattributed.events}` ) );
        tr.appendChild( el( 'td', null, '—' ) );
        tr.appendChild( el( 'td', 'num', `~${result.unattributed.pushValue}` ) );
        tr.appendChild( el( 'td', 'sources', 'Landing messages from weapon procs with no player named. Not part of the player totals above.' ) );
        rows.appendChild( tr );
    }

    if ( result.players.length === 0 ) {
        let tr = el( 'tr' );
        let cell = el( 'td', null, 'No push events were found in this fight.' );
        cell.colSpan = 5;
        tr.appendChild( cell );
        rows.appendChild( tr );
    }

    document.getElementById( 'othersHint' ).hidden = result.othersSeen;

    let cutOffHint = document.getElementById( 'cutOffHint' );
    cutOffHint.hidden = !result.startsAtLogEdge;
    cutOffHint.textContent = result.reachedStart ? 'The log starts during this fight, so earlier pushes are missing.' : 'This fight began more than 30 minutes before the hotkey, so earlier pushes are not counted.';

    let npcRows = document.getElementById( 'npcRows' );
    npcRows.textContent = '';
    result.npcAbilities.forEach( a => {
        let tr = el( 'tr' );
        tr.appendChild( el( 'td', null, a.actor ) );
        tr.appendChild( el( 'td', null, a.name ) );
        tr.appendChild( el( 'td', 'num', `${a.count}` ) );
        tr.appendChild( el( 'td', 'num', `${a.push}` ) );
        npcRows.appendChild( tr );
    } );
    if ( result.npcAbilities.length === 0 ) {
        let tr = el( 'tr' );
        let cell = el( 'td', null, 'No NPC push abilities were found in this fight.' );
        cell.colSpan = 4;
        tr.appendChild( cell );
        npcRows.appendChild( tr );
    }
}










/**
 * The push recap screen.  Reads the spell data and the end of the log once, then
 * only recounts when another fight is picked.
 *
 * @param {{ logFilePath: string, characterName: string, eqFolder: string, userData: string, quietGapSeconds: number }} params The window parameters.
 */
async function PushRecap( params ) {

    document.getElementById( 'characterName' ).textContent = params.characterName;
    document.getElementById( 'closeButton' ).addEventListener( 'click', () => ipcRenderer.send( 'window:child:close' ) );
    document.getElementById( 'npcToggle' ).addEventListener( 'change', e => document.getElementById( 'npcAbilities' ).hidden = !e.target.checked );

    let quietGapSeconds = params.quietGapSeconds >= 5 && params.quietGapSeconds <= 300 ? params.quietGapSeconds : 30;
    let result = null;

    document.getElementById( 'copyButton' ).addEventListener( 'click', () => {
        if ( result != null ) {
            ipcRenderer.send( 'clipboard:writeText', buildSummaryText( result ) );
            document.getElementById( 'copyButton' ).textContent = 'Copied';
        }
    } );

    try {
        showMessage( 'Loading spell data...', false );
        let table = await loadPushSpells( params.eqFolder, params.userData );
        let landing = buildLandingIndex( table );

        showMessage( 'Reading the log...', false );
        let session = await readSession( params.logFilePath, params.characterName, landing );
        let summary = summarize( session );

        if ( summary.kills.length === 0 ) {
            showMessage( 'No kills were found in the 30 minutes of log before the hotkey.', false );
            return;
        }

        let select = document.getElementById( 'fightSelect' );
        select.textContent = '';
        summary.kills.forEach( ( kill, i ) => {
            let option = el( 'option', null, `${kill.name} · ${kill.clock} · ${formatDamage( kill.damage )} damage` );
            option.value = `${i}`;
            select.appendChild( option );
        } );
        select.value = `${summary.defaultKill}`;

        let show = index => {
            result = analyzeKill( session, summary, table, landing, summary.kills[ index ], quietGapSeconds );
            document.getElementById( 'copyButton' ).textContent = 'Copy summary';
            render( result );
        };
        select.addEventListener( 'change', () => show( +select.value ) );
        show( summary.defaultKill );

    } catch ( error ) {
        showMessage( error.code === 'no-folder' || error.code === 'no-file' ? error.message : `The push recap could not be built: ${error.message}`, true );
    }

}

module.exports = PushRecap;
