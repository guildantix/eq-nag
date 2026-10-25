// The timing side of perf.js.  Release and Pre-release builds delete this
// file; it's only loaded when Nag is started with --perf.
//
// Every process keeps running totals per tap name and sends them to the main
// process every 5 seconds.  The main process writes perf-report.json to the
// user data folder every 10 seconds, with those totals and each process's CPU
// time.  Totals are cumulative, so compare two reports to see a rate.

const { performance } = require( 'perf_hooks' );

/** @type {Record<string, {count: number, totalMs: number, maxMs: number}>} */
const stats = {};

function now() {
    return performance.now();
}

/**
 * Adds the time since start to the named tap.
 * 
 * @param {string} name The tap name.
 * @param {number} start The perf.now() value when the work started.
 * @param {number} [sampling] For taps only recorded on 1 call in N: scales the count and time by N.
 */
function record( name, start, sampling = 1 ) {
    const ms = performance.now() - start;
    const s = stats[ name ] ?? ( stats[ name ] = { count: 0, totalMs: 0, maxMs: 0 } );
    s.count += sampling;
    s.totalMs += ms * sampling;
    if ( ms > s.maxMs ) {
        s.maxMs = ms;
    }
}

function wrap( name, fn ) {
    return function ( ...args ) {
        const t = performance.now();
        try {
            return fn.apply( this, args );
        } finally {
            record( name, t );
        }
    };
}









/**
 * Names a window by its page, e.g. "log-watcher (Maxxer)" or "main window".
 *
 * @param {string} url The window's url.
 */
function labelOf( url ) {
    try {
        const u = new URL( url );
        if ( u.hash.startsWith( '#/' ) ) {
            return `main window ${u.hash}`;
        }
        const page = u.pathname.split( '/' ).pop().replace( /\.html$/, '' );
        const character = u.searchParams.get( 'character' );
        const name = character ? JSON.parse( character )?.name : null;
        return name ? `${page} (${name})` : page;
    } catch {
        return url;
    }
}









function startCollector() {
    const { app, ipcMain, webContents } = require( 'electron' );
    const fs = require( 'fs' );
    const path = require( 'path' );

    /** @type {Record<number, {label: string, pid: number, stats: object}>} */
    const reports = {};

    ipcMain.on( 'perf:report', ( event, data ) => {
        reports[ event.sender.id ] = { label: labelOf( event.sender.getURL() ), pid: event.sender.getOSProcessId(), stats: data.stats };
    } );

    const write = () => {
        const labels = {};
        webContents.getAllWebContents().forEach( wc => {
            labels[ wc.getOSProcessId() ] = labelOf( wc.getURL() );
        } );

        const report = {
            generatedAt: new Date().toISOString(),
            version: app.getVersion(),
            processes: app.getAppMetrics().map( m => ( {
                pid: m.pid,
                type: m.type,
                label: m.type === 'Browser' ? 'main process' : labels[ m.pid ] ?? m.type,
                cpuSeconds: m.cpu.cumulativeCPUUsage,
            } ) ),
            taps: [ { label: 'main process', pid: process.pid, stats }, ...Object.values( reports ) ],
        };

        fs.writeFile( path.join( app.getPath( 'userData' ), 'perf-report.json' ), JSON.stringify( report, null, 2 ), () => { } );
    };

    app.whenReady().then( () => setInterval( write, 10000 ) );
}









function startReporter() {
    const { ipcRenderer } = require( 'electron' );
    setInterval( () => ipcRenderer.send( 'perf:report', { stats } ), 5000 );
}

if ( process.type === 'browser' ) {
    startCollector();
} else {
    startReporter();
}

module.exports = { enabled: true, now, record, wrap };
