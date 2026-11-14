// The main-process side of the Performance Monitor (Triggers menu →
// Performance Monitor).
//
// Each log watcher and the overlay window time their own work (see
// utilities/trigger-performance.js) and send their numbers here. The
// Performance Monitor window asks for everything combined, along with how
// much CPU each of Nag's processes is using.
//
// It can also record a Chromium trace: a detailed timeline of every Nag
// process, including drawing and the GPU, which developers open in
// https://ui.perfetto.dev.
//
// Nothing here is saved: the monitor and tracing are always off when Nag
// starts.

const { app, ipcMain, webContents, contentTracing, shell } = require( 'electron' );
const path = require( 'path' );
const fs = require( 'fs' );
const os = require( 'os' );
const zlib = require( 'zlib' );
const { pipeline } = require( 'stream/promises' );
const log = require( 'electron-log' );
const FsUtilities = require( './utilities/file-system' );

/** How long a trace records unless it's stopped sooner. */
const traceDurationSeconds = 30;

// What a trace records: JavaScript (with sampled call stacks), page
// layout and painting, compositing and the GPU. Everything else is left out
// to keep the file small enough to send; "blink" (the page engine's own
// internals) alone would double its size, and devtools.timeline already
// covers layout and painting.
const traceCategories = [
    'toplevel',
    'devtools.timeline',
    'disabled-by-default-devtools.timeline',
    'disabled-by-default-devtools.timeline.frame',
    'disabled-by-default-v8.cpu_profiler',
    'v8.execute',
    'cc',
    'gpu',
    'viz',
    'renderer.scheduler',
];

/**
 * Combines the Performance Monitor's numbers from every window, reports CPU
 * use per process and records Chromium traces.
 */
class TriggerPerformanceMonitor {

    /** True while the Performance Monitor is on. */
    #enabled = false;

    /** When the monitor was turned on or last reset, in milliseconds. */
    #startedAt = 0;

    /**
     * The latest numbers from each window, by web contents id.
     *
     * @type {Map<number, { source: string, entries: any[] }>}
     */
    #reports = new Map();

    /**
     * Each process's total CPU seconds when the monitor was turned on or
     * reset (or when the process started, if later), by process id.
     *
     * @type {Map<number, { cpuSeconds: number, at: number }>}
     */
    #cpuAtStart = new Map();

    /**
     * The trace being recorded, or the last one saved.
     *
     * @type {{
     *     recording: boolean,
     *     startedAt: number,
     *     stopTimeout: NodeJS.Timeout,
     *     lastFilePath: string,
     *     error: string,
     * }}
     */
    #trace = { recording: false, startedAt: 0, stopTimeout: null, lastFilePath: null, error: null };










    /**
     * Listens for the Performance Monitor window and for the numbers each
     * window sends.
     */
    attachIpcEvents() {

        ipcMain.on( 'trigger:performance:hello', event => {
            event.sender.send( 'trigger:performance:enabled', this.#enabled );
        } );

        ipcMain.on( 'trigger:performance:report', ( event, report ) => {
            if ( this.#enabled ) {
                this.#reports.set( event.sender.id, report );
            }
        } );

        ipcMain.handle( 'trigger:performance:get-state', () => this.#getState() );

        ipcMain.handle( 'trigger:performance:set-enabled', ( event, isEnabled ) => {
            this.#enabled = isEnabled === true;
            this.#restartMeasurements();
            this.#sendToAllWindows( 'trigger:performance:enabled', this.#enabled );
            log.info( `[TriggerPerformanceMonitor] Performance Monitor turned ${this.#enabled ? 'on' : 'off'}.` );

            return this.#getState();
        } );

        ipcMain.handle( 'trigger:performance:reset', () => {
            this.#restartMeasurements();
            this.#sendToAllWindows( 'trigger:performance:reset' );

            return this.#getState();
        } );

        ipcMain.handle( 'trigger:performance:start-trace', async () => {
            await this.#startTrace();
            return this.#getState();
        } );

        ipcMain.handle( 'trigger:performance:stop-trace', async () => {
            await this.#stopTrace();
            return this.#getState();
        } );

        ipcMain.on( 'trigger:performance:show-trace', () => {
            if ( this.#trace.lastFilePath ) {
                shell.showItemInFolder( this.#trace.lastFilePath );
            }
        } );

    }










    /**
     * Returns everything the Performance Monitor window shows.
     */
    #getState() {
        const elapsedSeconds = this.#startedAt > 0 ? ( Date.now() - this.#startedAt ) / 1000 : 0;

        return {
            enabled: this.#enabled,
            elapsedSeconds: elapsedSeconds,
            sources: Array.from( this.#reports.values() ),
            processes: this.#getProcesses(),
            trace: {
                recording: this.#trace.recording,
                elapsedSeconds: this.#trace.recording ? ( Date.now() - this.#trace.startedAt ) / 1000 : 0,
                durationSeconds: traceDurationSeconds,
                lastFilePath: this.#trace.lastFilePath,
                error: this.#trace.error,
            },
        };
    }










    /**
     * Returns each of Nag's processes with what it's for and how much CPU
     * it's used, both right now and on average since the monitor was turned
     * on.
     */
    #getProcesses() {
        const labels = this.#getProcessLabels();
        const cpuCount = os.cpus().length;
        const now = Date.now();

        return app.getAppMetrics().map( metric => {
            // Windows can open after the monitor is turned on (e.g. a
            // character's log watcher), so their average starts when they're
            // first seen.
            if ( this.#enabled && !this.#cpuAtStart.has( metric.pid ) ) {
                this.#cpuAtStart.set( metric.pid, { cpuSeconds: metric.cpu.cumulativeCPUUsage, at: now } );
            }

            const start = this.#cpuAtStart.get( metric.pid );
            const elapsedSeconds = start ? ( now - start.at ) / 1000 : 0;

            // Like Task Manager, CPU use is a share of the whole PC (all cores).
            const usedSeconds = start ? metric.cpu.cumulativeCPUUsage - start.cpuSeconds : 0;
            const averagePercent = elapsedSeconds > 0 ? usedSeconds / elapsedSeconds * 100 / cpuCount : null;

            return {
                pid: metric.pid,
                label: labels.get( metric.pid ) ?? this.#describeProcessType( metric.type ),
                type: metric.type,
                // Electron already gives this as a share of the whole PC.
                currentPercent: metric.cpu.percentCPUUsage,
                averagePercent: averagePercent,
                memoryMegabytes: Math.round( ( metric.memory?.workingSetSize ?? 0 ) / 1024 ),
            };
        } );
    }










    /**
     * Returns a readable name for each window's process, e.g. "Log watcher
     * (Maxx)" or "Overlays". Windows that share a process are listed
     * together.
     *
     * @returns {Map<number, string>}
     */
    #getProcessLabels() {
        /** @type {Map<number, string[]>} */
        const labelsByProcess = new Map();

        for ( const contents of webContents.getAllWebContents() ) {
            if ( contents.isDestroyed() || contents.getType() === 'remote' ) {
                continue;
            }

            const label = this.#describePage( contents.getURL() );
            const processId = contents.getOSProcessId();
            const labels = labelsByProcess.get( processId ) ?? [];

            if ( label && !labels.includes( label ) ) {
                labels.push( label );
            }
            labelsByProcess.set( processId, labels );
        }

        const result = new Map();
        labelsByProcess.forEach( ( labels, processId ) => {
            if ( labels.length > 0 ) {
                result.set( processId, labels.join( ', ' ) );
            }
        } );

        return result;
    }










    /**
     * Returns a readable name for a Nag page, from its address.
     *
     * @param {string} pageUrl The page's address.
     * @returns {string | null}
     */
    #describePage( pageUrl ) {
        try {
            const address = new URL( pageUrl );
            const page = address.pathname.split( '/' ).pop();

            if ( page === 'log-watcher.html' ) {
                const character = JSON.parse( address.searchParams.get( 'character' ) ?? 'null' );
                return `Log watcher (${character?.name ?? 'unknown'})`;

            } else if ( page === 'renderer.html' ) {
                return 'Overlays';

            } else if ( page === 'combat-watcher.html' ) {
                return 'Combat watcher';

            } else if ( address.protocol === 'devtools:' ) {
                return 'Developer tools';

            } else if ( page.endsWith( '.html' ) && page !== 'index.html' ) {
                return page.replace( /\.html$/, '' );

            }

            return 'Nag window';

        } catch {
            return null;
        }
    }










    /**
     * Returns a readable name for one of Chromium's own processes.
     *
     * @param {string} type The process type from app.getAppMetrics().
     * @returns {string}
     */
    #describeProcessType( type ) {
        if ( type === 'Browser' ) {
            return 'Nag (main process)';
        } else if ( type === 'GPU' ) {
            return 'Graphics (GPU process)';
        } else if ( type === 'Utility' ) {
            return 'Utility (audio, network)';
        }

        return type;
    }










    /**
     * Clears all numbers and starts measuring again from now.
     */
    #restartMeasurements() {
        this.#reports.clear();
        this.#startedAt = this.#enabled ? Date.now() : 0;
        this.#cpuAtStart.clear();

        if ( this.#enabled ) {
            for ( const metric of app.getAppMetrics() ) {
                this.#cpuAtStart.set( metric.pid, { cpuSeconds: metric.cpu.cumulativeCPUUsage, at: this.#startedAt } );
            }
        }
    }










    /**
     * Sends a message to every Nag window.
     *
     * @param {string} channel The message channel.
     * @param {any} [data] The message.
     */
    #sendToAllWindows( channel, data ) {
        for ( const contents of webContents.getAllWebContents() ) {
            if ( !contents.isDestroyed() ) {
                contents.send( channel, data );
            }
        }
    }










    /**
     * Starts recording a Chromium trace, and stops it on its own after
     * traceDurationSeconds.
     */
    async #startTrace() {
        if ( this.#trace.recording ) {
            return;
        }

        this.#trace.error = null;

        try {
            await contentTracing.startRecording( {
                included_categories: traceCategories,
                excluded_categories: [ '*' ],
                recording_mode: 'record-until-full',
                trace_buffer_size_in_kb: 256 * 1024,
            } );

            this.#trace.recording = true;
            this.#trace.startedAt = Date.now();
            this.#trace.stopTimeout = setTimeout( () => this.#stopTrace(), traceDurationSeconds * 1000 );
            log.info( '[TriggerPerformanceMonitor] Started recording a trace.' );

        } catch ( error ) {
            this.#trace.error = `Couldn't start recording: ${error?.message ?? error}`;
            log.error( '[TriggerPerformanceMonitor] Could not start a trace.', error );
        }
    }










    /**
     * Stops recording the Chromium trace and saves it in Nag's "traces"
     * folder.
     */
    async #stopTrace() {
        if ( !this.#trace.recording ) {
            return;
        }

        clearTimeout( this.#trace.stopTimeout );
        this.#trace.recording = false;

        try {
            const folder = path.join( app.getPath( 'userData' ), 'traces' );
            fs.mkdirSync( folder, { recursive: true } );

            // A busy 30 seconds is a few hundred megabytes of text, which
            // compresses to about a tenth. Perfetto opens the compressed file
            // as it is.
            const filePath = path.join( folder, `nag-trace_${FsUtilities.getFileTimestamp( undefined, 'backup' )}.json` );
            await contentTracing.stopRecording( filePath );
            await pipeline( fs.createReadStream( filePath ), zlib.createGzip(), fs.createWriteStream( `${filePath}.gz` ) );
            fs.unlinkSync( filePath );

            this.#trace.lastFilePath = `${filePath}.gz`;
            log.info( `[TriggerPerformanceMonitor] Saved a trace: ${this.#trace.lastFilePath}` );

        } catch ( error ) {
            this.#trace.error = `Couldn't save the recording: ${error?.message ?? error}`;
            log.error( '[TriggerPerformanceMonitor] Could not save a trace.', error );
        }
    }

}

module.exports = TriggerPerformanceMonitor;
