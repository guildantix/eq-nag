// Nag performance test: replays a real EverQuest log against one or more Nag
// builds and compares their CPU use.  See tools/perf/README.md.
//
//   npm run perf -- --log "C:\EverQuest\Logs\eqlog_Name_server.txt"
//   npm run perf -- --log <eqlog> --app dev --app "C:\Downloads\eq_nag_portable.exe"
//
// Options:
//   --log <file>     EverQuest log to replay (required).
//   --app <exe|dev>  Build to test; repeat to compare.  "dev" (the default) runs
//                    this repository with Electron; run `ng build` first.
//   --start <line>   Line to start replaying from (default: the busiest minute).
//   --seconds <n>    How long to replay (default 60).
//   --idle <n>       How long to measure with no new lines first (default 30).
//   --keep           Keep the temporary folder (profiles, logs, perf reports).

import { execFileSync, spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { waitForTarget, connect, sleep } from './cdp.mjs';

const repo = path.resolve( path.dirname( fileURLToPath( import.meta.url ) ), '..', '..' );
const electronExe = path.join( repo, 'node_modules', 'electron', 'dist', 'electron.exe' );

// ------------------------------------------------------------------ options

const args = process.argv.slice( 2 );
const opt = ( name, fallback ) => { const i = args.indexOf( `--${name}` ); return i > -1 ? args[ i + 1 ] : fallback; };
const apps = args.flatMap( ( a, i ) => a === '--app' ? [ args[ i + 1 ] ] : [] );
const logFile = opt( 'log' );
const replaySeconds = +opt( 'seconds', 60 );
const idleSeconds = +opt( 'idle', 30 );
const keep = args.includes( '--keep' );

if ( !logFile || !fs.existsSync( logFile ) ) {
    console.error( 'Usage: npm run perf -- --log <EverQuest log file> [--app <exe|dev> ...] [--start <line>] [--seconds 60] [--idle 30] [--keep]' );
    process.exit( 1 );
}
if ( apps.length === 0 ) {
    apps.push( 'dev' );
}
// The test profile is always created with this repository's build.
if ( !fs.existsSync( path.join( repo, 'dist', 'index.html' ) ) ) {
    console.error( 'Build the app first: npx ng build --configuration=production' );
    process.exit( 1 );
}

const work = fs.mkdtempSync( path.join( os.tmpdir(), 'nag-perf-' ) );
const testLog = path.join( work, 'Logs', 'eqlog_Perftest_server.txt' );
fs.mkdirSync( path.dirname( testLog ) );

// ------------------------------------------------------------------ the log

const tsRe = /^\[(\w{3} \w{3} \d{2} \d{2}:\d{2}:\d{2} \d{4})\] (.*)$/;

/** Reads the first 1.5 million lines of the log. */
function readLines() {
    const text = fs.readFileSync( logFile, 'utf8' );
    return text.split( /\r?\n/ ).slice( 0, 1500000 );
}

/** The first line of the busiest minute. */
function busiestMinute( lines ) {
    const counts = new Map(), first = new Map();
    lines.forEach( ( l, i ) => {
        const minute = l.slice( 1, 17 );
        counts.set( minute, ( counts.get( minute ) ?? 0 ) + 1 );
        first.has( minute ) || first.set( minute, i );
    } );
    const [ minute, count ] = [ ...counts ].sort( ( a, b ) => b[ 1 ] - a[ 1 ] )[ 0 ];
    console.log( `Busiest minute in the log: ${minute} (${count} lines, ~${Math.round( count / 60 )} per second)` );
    return first.get( minute );
}

const eqTimestamp = d => {
    const p = x => `${x}`.padStart( 2, '0' );
    const days = [ 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat' ];
    const months = [ 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec' ];
    return `[${days[ d.getDay() ]} ${months[ d.getMonth() ]} ${p( d.getDate() )} ${p( d.getHours() )}:${p( d.getMinutes() )}:${p( d.getSeconds() )} ${d.getFullYear()}]`;
};

/** Appends lines to the test log at their original pace, with current timestamps. */
async function replay( lines, start, seconds ) {
    let i = start, written = 0, first = null;
    const t0 = Date.now();
    while ( ( Date.now() - t0 ) / 1000 < seconds && i < lines.length ) {
        const elapsed = ( Date.now() - t0 ) / 1000;
        let out = '';
        while ( i < lines.length ) {
            const m = tsRe.exec( lines[ i ] );
            if ( !m ) { i++; continue; }
            const t = Date.parse( m[ 1 ] );
            first ??= t;
            if ( ( t - first ) / 1000 > elapsed ) break;
            out += `${eqTimestamp( new Date() )} ${m[ 2 ]}\r\n`;
            written++; i++;
        }
        out && fs.appendFileSync( testLog, out );
        await sleep( 100 );
    }
    return written;
}

// ------------------------------------------------------------------ processes

/** CPU milliseconds per Nag process using the given profile folder. */
function cpuSnapshot( profile ) {
    const ps = `Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*${path.basename( profile )}*' -and $_.Name -notlike 'node*' -and $_.Name -notlike 'powershell*' } | ForEach-Object { $p = Get-Process -Id $_.ProcessId -ErrorAction SilentlyContinue; if ($p) { [pscustomobject]@{ pid = $_.ProcessId; ms = $p.TotalProcessorTime.TotalMilliseconds; type = if ($_.CommandLine -match '--type=([a-z-]+)') { $matches[1] } else { 'main' } } } } | ConvertTo-Json -Compress`;
    const out = execFileSync( 'powershell', [ '-NoProfile', '-Command', ps ], { encoding: 'utf8' } ).trim();
    const list = out ? [].concat( JSON.parse( out ) ) : [];
    return new Map( list.map( p => [ p.pid, p ] ) );
}

function cpuBetween( a, b, seconds ) {
    const rows = [];
    for ( const [ pid, p ] of b ) {
        const before = a.get( pid );
        if ( before ) rows.push( { pid, type: p.type, pct: ( p.ms - before.ms ) / ( seconds * 1000 ) * 100 } );
    }
    return { total: rows.reduce( ( s, r ) => s + r.pct, 0 ), rows };
}

function stopApp( profile ) {
    const ps = `Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*${path.basename( profile )}*' -and $_.Name -notlike 'node*' -and $_.Name -notlike 'powershell*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`;
    execFileSync( 'powershell', [ '-NoProfile', '-Command', ps ] );
}

function launch( app, profile, port ) {
    const [ exe, appArgs ] = app === 'dev' ? [ electronExe, [ repo ] ] : [ app, [] ];
    const env = { ...process.env, NAG_DEV: '0' };   // run from source like a normal build (no DevTools)
    const child = spawn( exe, [ ...appArgs, '--perf', `--user-data-dir=${profile}`, `--remote-debugging-port=${port}` ], { stdio: 'ignore', detached: true, env } );
    child.unref();
}

const readReport = profile => {
    try { return JSON.parse( fs.readFileSync( path.join( profile, 'perf-report.json' ), 'utf8' ) ); } catch { return null; }
};

// ------------------------------------------------------------------ test profile

/** Creates the test profile: two overlays, ~300 raid-style triggers and a character. */
async function seedProfile( profile ) {
    launch( 'dev', profile, 9470 );
    const main = await connect( await waitForTarget( 9470, t => t.url.includes( '#/' ), 120000 ) );
    await sleep( 5000 );
    const call = ( channel, payload ) => main.evaluate( `new Promise( r => { window.api.ipc.once( ${JSON.stringify( channel )}, ( e, v ) => r( v ) ); window.api.ipc.send( ${JSON.stringify( channel )}, ${JSON.stringify( payload )} ); } )` );
    const overlay = ( name, type, y ) => ( { name, overlayType: type, windowWidth: 500, windowHeight: 400, x: 200, y, fontFamily: 'Roboto', horizontalAlignment: 'center', verticalAlignment: 'bottom', fontSize: 20, lineHeight: 90, fontWeight: 400, fontColor: '#ffffff', fontTransparency: 1, backgroundColor: '#000000', backgroundTransparency: 0, borderColor: '#000000', borderTransparency: 0, timerSortType: 0, timerColor: '#008000', timerBackgroundColor: '#0080004b', textOverflow: {}, showTextBorder: false, textBorderColor: '#000000', groupMode: false } );
    const alertId = await call( 'overlay:create', overlay( 'Alerts', 'Alert', 100 ) );
    const timerId = await call( 'overlay:create', overlay( 'Timers', 'Timer', 550 ) );

    let n = 0;
    const trigger = ( name, phrase, action ) => call( 'trigger:create', {
        name, enabled: true, folderId: null, captureMethod: 'Any', conditions: [], classLevels: {},
        capturePhrases: [ { phraseId: `p${++n}`, phrase, useRegEx: true } ],
        actions: [ Object.assign( { actionId: `a${n}`, phrases: [ `p${n}` ] }, action ) ],
    } );
    const text = ( displayText, duration ) => ( { actionType: 0, overlayId: alertId, displayText, duration } );
    const timer = ( displayText, duration ) => ( { actionType: 3, overlayId: timerId, displayText, duration, restartBehavior: 2 } );

    // Triggers that fire often in raids: overlay text and timers.
    await trigger( 'Holy light', '^{S} is surrounded by a holy light\\.$', text( '<span style="color: gold">{S}</span> holy light', 3 ) );
    await trigger( 'Lethal', '^{S} becomes lethal\\.$', timer( '{S} lethal', 30 ) );
    await trigger( 'Struck by magic', '^{S} is struck by magic\\.$', timer( 'Magic on {S}', 18 ) );
    await trigger( 'Big hit', '^You \\w+ {S} for {N>=150000} points of damage\\.', text( 'BIG {N}', 2 ) );
    // Triggers that seldom fire but are checked against every line.
    for ( let i = 0; i < 100; i++ ) await trigger( `Emote ${i}`, `^(?:~ )?{S} (?:roars|shouts|bellows) the word ${i} at {S1}`, text( `Emote ${i} on {S1}`, 5 ) );
    for ( let i = 0; i < 100; i++ ) await trigger( `Ability ${i}`, `^{C} begins to cast Ability ${i}\\.$`, timer( `Ability ${i}`, 60 ) );
    for ( let i = 0; i < 60; i++ ) await trigger( `Tell ${i}`, `^{S} tells (?:you|the raid), '(?:pop|timer|go) ${i} in {TS}'`, timer( `Timer ${i}`, 120 ) );
    for ( let i = 0; i < 40; i++ ) await trigger( `Debuff ${i}`, `^Your target resisted the Debuff ${i} spell\\.$|^{S} is affected by Debuff ${i}\\.$`, text( `Debuff ${i}`, 4 ) );

    await call( 'character:create', { name: 'Perftest', server: 'server', class: 'Rogue', logFile: testLog } );
    await sleep( 5000 );
    main.close();
    stopApp( profile );
    await sleep( 3000 );
    console.log( `Test profile: ${n} triggers, 2 overlays, 1 character` );
}

// ------------------------------------------------------------------ report

const tapRates = ( before, after, seconds ) => {
    const rows = [];
    for ( const t of after?.taps ?? [] ) {
        const prev = before?.taps?.find( b => b.label === t.label );
        for ( const [ name, s ] of Object.entries( t.stats ?? {} ) ) {
            const p = prev?.stats?.[ name ] ?? { count: 0, totalMs: 0 };
            const ms = s.totalMs - p.totalMs, count = s.count - p.count;
            if ( count > 0 ) rows.push( { where: t.label, name, msPerSecond: ms / seconds, count, avgMs: ms / count, maxMs: s.maxMs } );
        }
    }
    return rows.sort( ( a, b ) => b.msPerSecond - a.msPerSecond );
};

const fmt = n => n.toFixed( 1 ).padStart( 6 );

// ------------------------------------------------------------------ run

const lines = readLines();
const start = opt( 'start' ) ? +opt( 'start' ) : busiestMinute( lines );
fs.writeFileSync( testLog, lines.slice( Math.max( 0, start - 2000 ), start ).join( '\r\n' ) + '\r\n' );
const baseLog = fs.readFileSync( testLog );

const seed = path.join( work, 'profile-seed' );
await seedProfile( seed );

const results = [];
for ( const [ index, app ] of apps.entries() ) {
    const label = app === 'dev' ? 'dev (this repository)' : path.basename( app );
    const profile = path.join( work, `profile-${index}` );
    fs.cpSync( seed, profile, { recursive: true } );
    fs.writeFileSync( testLog, baseLog );
    console.log( `\n${label}: starting` );
    launch( app, profile, 9471 + index );
    await sleep( 45000 );

    let a = cpuSnapshot( profile );
    await sleep( idleSeconds * 1000 );
    const idle = cpuBetween( a, cpuSnapshot( profile ), idleSeconds );
    console.log( `${label}: idle ${fmt( idle.total )}% of one core` );

    const replaying = replay( lines, start, replaySeconds + 15 );
    await sleep( 15000 );
    const reportBefore = readReport( profile );
    a = cpuSnapshot( profile );
    await sleep( replaySeconds * 1000 );
    const busy = cpuBetween( a, cpuSnapshot( profile ), replaySeconds );
    await sleep( 11000 );
    const taps = tapRates( reportBefore, readReport( profile ), replaySeconds + 11 );
    const written = await replaying;
    console.log( `${label}: replay ${fmt( busy.total )}% of one core (${Math.round( written / ( replaySeconds + 15 ) )} lines per second)` );

    results.push( { label, idle, busy, taps } );
    stopApp( profile );
    await sleep( 3000 );
}

console.log( '\n=== CPU, % of one core (Task Manager shows this divided by your number of cores)' );
console.log( 'build'.padEnd( 34 ) + 'idle'.padStart( 8 ) + 'replay'.padStart( 9 ) );
results.forEach( r => console.log( r.label.padEnd( 34 ) + fmt( r.idle.total ) + '%' + fmt( r.busy.total ) + '%' ) );

for ( const r of results ) {
    if ( r.taps.length === 0 ) {
        console.log( `\n${r.label}: no timing breakdown (this build has no performance taps)` );
        continue;
    }
    console.log( `\n=== ${r.label}: where the time went during the replay (ms of work per second)` );
    r.taps.filter( t => !t.name.startsWith( 'trigger: ' ) ).slice( 0, 12 ).forEach( t =>
        console.log( `${fmt( t.msPerSecond )} ms/s  ${t.name.padEnd( 40 )} ${t.where.padEnd( 26 )} avg ${t.avgMs.toFixed( 3 )} ms, max ${t.maxMs.toFixed( 1 )} ms, ${t.count} calls` ) );
    console.log( '  slowest triggers:' );
    r.taps.filter( t => t.name.startsWith( 'trigger: ' ) ).slice( 0, 8 ).forEach( t =>
        console.log( `${fmt( t.msPerSecond )} ms/s  ${t.name.slice( 9 ).padEnd( 40 )} avg ${t.avgMs.toFixed( 4 )} ms` ) );
}

if ( keep ) {
    console.log( `\nKept: ${work}` );
} else {
    fs.rmSync( work, { recursive: true, force: true } );
}
