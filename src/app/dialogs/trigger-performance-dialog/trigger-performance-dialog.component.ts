import { Component, OnDestroy, OnInit } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { IpcService } from 'src/app/ipc.service';
import { TriggerPerformanceEntry, TriggerPerformanceKind, TriggerPerformanceRow, TriggerPerformanceState } from './trigger-performance.model';

/** How often the window asks for new numbers while it's open. */
const refreshIntervalMilliseconds = 2000;

/** How many of the most expensive triggers in each group get details in the copied report. */
const reportTriggerLimit = 20;

/** Work that's measured but doesn't belong to a trigger. */
const nonTriggerIds = [ 'combat-text', 'dps-meter', 'unknown' ];

/** The order details are listed in, matching the order the work happens. */
const kindOrder: TriggerPerformanceKind[] = [ 'conditions', 'phrase', 'watched-phrases', 'action', 'draw', 'update' ];

/** What each kind of measurement is called in the details. */
const kindLabels: Record<TriggerPerformanceKind, string> = {
    'phrase': 'Phrase',
    'conditions': 'Conditions',
    'watched-phrases': 'Watched phrases',
    'action': 'Action runs',
    'draw': 'Action drawn',
    'update': 'Action updates',
};










/**
 * The Performance Monitor (Triggers menu): shows how much time each trigger
 * takes, each Nag process's CPU use, and records Chromium traces.
 */
@Component( {
    selector: 'app-trigger-performance-dialog',
    templateUrl: 'trigger-performance-dialog.component.html',
    styleUrls: [ 'trigger-performance-dialog.component.scss', '../dialog.styles.scss' ],
} )
export class TriggerPerformanceDialogComponent implements OnInit, OnDestroy {

    /** The latest numbers from the main process. */
    public state: TriggerPerformanceState = null;

    /** The table rows, grouped as your triggers, Nag's built-in triggers and other work. */
    public groups: { title: string, rows: TriggerPerformanceRow[] }[] = [];

    /** The triggers whose details are showing. */
    public expandedTriggerIds = new Set<string>();

    /** True while a request to the main process is waiting for its answer. */
    public isBusy: boolean = false;

    /** The trigger names, for numbers that only know a trigger's id (e.g. from the overlays). */
    private triggerNames: Record<string, string> = {};

    /** The timer that refreshes the numbers. */
    private refreshInterval: number = null;

    constructor(
        public dialogRef: MatDialogRef<TriggerPerformanceDialogComponent>,
        private readonly ipcService: IpcService,
    ) { }










    /**
     * Loads the trigger names and starts refreshing the numbers.
     */
    ngOnInit(): void {
        this.ipcService.getTriggers().subscribe( triggers => {
            triggers?.forEach( trigger => this.triggerNames[ trigger.triggerId ] = trigger.name );
        } );

        this.refresh();
        this.refreshInterval = window.setInterval( () => this.refresh(), refreshIntervalMilliseconds );
    }










    /**
     * Stops refreshing the numbers. The monitor stays on until it's turned
     * off, so it keeps measuring while this window is closed.
     */
    ngOnDestroy(): void {
        window.clearInterval( this.refreshInterval );
    }










    /**
     * Turns the Performance Monitor on or off.
     *
     * @param enabled True to turn it on.
     */
    public setEnabled( enabled: boolean ): void {
        this.applyState( this.ipcService.setTriggerPerformanceEnabled( enabled ) );
    }










    /**
     * Clears the numbers and starts measuring again.
     */
    public reset(): void {
        this.applyState( this.ipcService.resetTriggerPerformance() );
    }










    /**
     * Starts or stops recording a trace.
     */
    public toggleTrace(): void {
        if ( this.state?.trace.recording ) {
            this.applyState( this.ipcService.stopPerformanceTrace() );
        } else {
            this.applyState( this.ipcService.startPerformanceTrace() );
        }
    }










    /**
     * Opens the folder with the last trace in File Explorer.
     */
    public showTraceFile(): void {
        this.ipcService.showPerformanceTraceFile();
    }










    /**
     * Shows or hides a trigger's details.
     *
     * @param triggerId The trigger.
     */
    public toggleDetails( triggerId: string ): void {
        if ( this.expandedTriggerIds.has( triggerId ) ) {
            this.expandedTriggerIds.delete( triggerId );
        } else {
            this.expandedTriggerIds.add( triggerId );
        }
    }










    /**
     * Copies a plain-text report to the clipboard, for pasting into Discord
     * or a bug report.
     */
    public copyReport(): void {
        const lines: string[] = [
            `Nag Performance Monitor, measured for ${this.formatDuration( this.state?.elapsedSeconds ?? 0 )}`,
            '',
            'Processes (CPU now / average since the monitor was turned on / memory):',
        ];

        this.state?.processes.forEach( process => {
            lines.push( `  ${process.label}: ${this.formatPercent( process.currentPercent )} / ${this.formatPercent( process.averagePercent )} / ${process.memoryMegabytes} MB` );
        } );

        this.groups.forEach( group => {
            lines.push( '', `${group.title} (matching / actions / drawing / total):` );

            // Only the most expensive triggers get details, so the report
            // stays short enough to paste into Discord.
            const detailedRows = group.rows.slice( 0, reportTriggerLimit );
            const otherRows = group.rows.slice( reportTriggerLimit );

            detailedRows.forEach( row => {
                lines.push( `  ${row.name}: ${this.formatTime( row.matchingMilliseconds )} / ${this.formatTime( row.actionMilliseconds )} / ${this.formatTime( row.drawingMilliseconds )} / ${this.formatTime( row.totalMilliseconds )}` );

                row.details.forEach( detail => {
                    const matches = this.showsMatches( detail ) ? `, ${detail.matches} matched` : '';
                    lines.push( `      ${this.describeKind( detail )} "${detail.label}": ${detail.count} times${matches}, ${this.formatTime( detail.totalMilliseconds )} total, ${this.formatAverage( detail )} average, ${this.formatTime( detail.maximumMilliseconds )} slowest` );
                } );
            } );

            if ( otherRows.length > 0 ) {
                const otherMilliseconds = otherRows.reduce( ( total, row ) => total + row.totalMilliseconds, 0 );
                lines.push( `  ...and ${otherRows.length} more, ${this.formatTime( otherMilliseconds )} total` );
            }
        } );

        this.ipcService.sendTextToClipboard( lines.join( '\n' ) );
    }










    /**
     * Returns what a detail row is, e.g. "Phrase" or "Action drawn".
     *
     * @param entry The detail row.
     */
    public describeKind( entry: TriggerPerformanceEntry ): string {
        return kindLabels[ entry.kind ] ?? entry.kind;
    }










    /**
     * Returns true when a detail row's match count means something: phrases
     * matched, and conditions passed.
     *
     * @param entry The detail row.
     */
    public showsMatches( entry: TriggerPerformanceEntry ): boolean {
        return entry.kind === 'phrase' || entry.kind === 'conditions' || entry.kind === 'watched-phrases';
    }










    /**
     * Formats a time, e.g. "0.42 ms", "153 ms" or "2.1 s", or a dash when
     * nothing ran (e.g. a trigger that never matched has no action time).
     *
     * @param milliseconds The time in milliseconds.
     */
    public formatTime( milliseconds: number ): string {
        if ( milliseconds === 0 ) {
            return '-';
        } else if ( milliseconds >= 1000 ) {
            return `${( milliseconds / 1000 ).toFixed( 1 )} s`;
        } else if ( milliseconds >= 10 ) {
            return `${Math.round( milliseconds )} ms`;
        }

        return `${milliseconds.toFixed( 2 )} ms`;
    }










    /**
     * Formats the average time of one run, in microseconds (µs) when it's
     * under a millisecond, since most phrases take only a few.
     *
     * @param entry The detail row.
     */
    public formatAverage( entry: TriggerPerformanceEntry ): string {
        if ( entry.count === 0 ) {
            return '-';
        }

        const averageMilliseconds = entry.totalMilliseconds / entry.count;

        if ( averageMilliseconds < 1 ) {
            return `${( averageMilliseconds * 1000 ).toFixed( 1 )} µs`;
        }

        return this.formatTime( averageMilliseconds );
    }










    /**
     * Formats a CPU percentage, or a dash when there isn't one yet.
     *
     * @param percent The percentage.
     */
    public formatPercent( percent: number | null ): string {
        if ( percent === null || percent === undefined ) {
            return '-';
        }

        return `${percent.toFixed( 1 )}%`;
    }










    /**
     * Formats how long the monitor has been measuring, e.g. "4m 05s".
     *
     * @param seconds The number of seconds.
     */
    public formatDuration( seconds: number ): string {
        const wholeSeconds = Math.floor( seconds );
        const minutes = Math.floor( wholeSeconds / 60 );
        const remainingSeconds = `${wholeSeconds % 60}`.padStart( 2, '0' );

        return minutes > 0 ? `${minutes}m ${remainingSeconds}s` : `${wholeSeconds}s`;
    }










    /**
     * Returns the total time each window measured, e.g. how much of the
     * overlays' time went to trigger actions.
     */
    public getSourceTotals(): { source: string, milliseconds: number }[] {
        return ( this.state?.sources ?? [] ).map( source => ( {
            source: source.source,
            milliseconds: source.entries.reduce( ( total, entry ) => total + entry.totalMilliseconds, 0 ),
        } ) );
    }










    /**
     * Asks the main process for the latest numbers.
     */
    private refresh(): void {
        if ( !this.isBusy ) {
            this.applyState( this.ipcService.getTriggerPerformance() );
        }
    }










    /**
     * Waits for an answer from the main process and shows it.
     *
     * @param request The request to the main process.
     */
    private applyState( request: Promise<TriggerPerformanceState> ): void {
        this.isBusy = true;

        request
            .then( state => {
                this.state = state;
                this.groups = this.buildGroups( state );
            } )
            .finally( () => this.isBusy = false );
    }










    /**
     * Combines every window's numbers into one row per trigger, sorted with
     * the most expensive first.
     *
     * @param state The numbers from the main process.
     */
    private buildGroups( state: TriggerPerformanceState ): { title: string, rows: TriggerPerformanceRow[] }[] {
        // The same phrase or action can be measured by several log watchers
        // (one per character), so add them together first.
        const combinedEntries = new Map<string, TriggerPerformanceEntry>();

        state.sources.forEach( source => source.entries.forEach( entry => {
            const key = `${entry.triggerId}|${entry.kind}|${entry.id}`;
            const combined = combinedEntries.get( key );

            if ( combined ) {
                combined.count += entry.count;
                combined.matches += entry.matches;
                combined.totalMilliseconds += entry.totalMilliseconds;
                combined.maximumMilliseconds = Math.max( combined.maximumMilliseconds, entry.maximumMilliseconds );
                combined.triggerName = combined.triggerName || entry.triggerName;
                combined.predefined = combined.predefined || entry.predefined;
            } else {
                combinedEntries.set( key, { ...entry } );
            }
        } ) );

        // The overlays only see an action after its text has been filled in
        // (e.g. "Magic on Vex"), so drawing and updates use the action's own
        // text from the log watcher (e.g. "Magic on {S}") when there is one.
        const actionLabels = new Map<string, string>();

        combinedEntries.forEach( entry => {
            if ( entry.kind === 'action' ) {
                actionLabels.set( `${entry.triggerId}|${entry.id}`, entry.label );
            }
        } );

        combinedEntries.forEach( entry => {
            if ( entry.kind === 'draw' || entry.kind === 'update' ) {
                entry.label = actionLabels.get( `${entry.triggerId}|${entry.id}` ) ?? entry.label;
            }
        } );

        const rows = new Map<string, TriggerPerformanceRow>();

        combinedEntries.forEach( entry => {
            let row = rows.get( entry.triggerId );

            if ( !row ) {
                row = {
                    triggerId: entry.triggerId,
                    name: '',
                    group: 'mine',
                    matchingMilliseconds: 0,
                    actionMilliseconds: 0,
                    drawingMilliseconds: 0,
                    totalMilliseconds: 0,
                    details: [],
                };
                rows.set( entry.triggerId, row );
            }

            row.name = row.name || entry.triggerName || this.triggerNames[ entry.triggerId ] || 'Unknown trigger';

            if ( nonTriggerIds.includes( entry.triggerId ) ) {
                row.group = 'other';
            } else if ( entry.predefined ) {
                row.group = 'built-in';
            }

            if ( entry.kind === 'action' ) {
                row.actionMilliseconds += entry.totalMilliseconds;
            } else if ( entry.kind === 'draw' || entry.kind === 'update' ) {
                row.drawingMilliseconds += entry.totalMilliseconds;
            } else {
                row.matchingMilliseconds += entry.totalMilliseconds;
            }

            row.totalMilliseconds += entry.totalMilliseconds;
            row.details.push( entry );
        } );

        const sortedRows = Array.from( rows.values() ).sort( ( a, b ) => b.totalMilliseconds - a.totalMilliseconds );
        // Details are listed in the order the work happens, and the most
        // expensive first within each kind.
        sortedRows.forEach( row => row.details.sort( ( a, b ) => {
            const kindDifference = kindOrder.indexOf( a.kind ) - kindOrder.indexOf( b.kind );
            return kindDifference !== 0 ? kindDifference : b.totalMilliseconds - a.totalMilliseconds;
        } ) );

        return [
            { title: 'Your triggers', rows: sortedRows.filter( row => row.group === 'mine' ) },
            { title: 'Built-in triggers', rows: sortedRows.filter( row => row.group === 'built-in' ) },
            { title: 'Other overlay work', rows: sortedRows.filter( row => row.group === 'other' ) },
        ].filter( group => group.rows.length > 0 );
    }

}
