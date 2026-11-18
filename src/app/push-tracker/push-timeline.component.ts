import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnChanges } from '@angular/core';
import { PushRecapSummary } from '../core.model';

interface TimelineEvent {
    time: number;
    kind: number;
    who: string;
    spell: string;
    text: string;
    push: number;
}

interface ChartPart {
    d: string;
    color: string;
}

interface ChartBar {
    parts: ChartPart[];
    x: number;
    width: number;
}

interface ChartTick {
    value: string;
    x: number;
    y: number;
    anchor: string;
}

interface ChartGrid {
    y: number;
    axis: boolean;
}

type SeriesKey = 'player' | 'proc' | 'possible';

const targetBars = 60;
const chartWidth = 1000;
const chartHeight = 260;
const left = 44;
const right = 8;
const top = 10;
const bottom = 28;










/**
 * Draws the push of one fight over time as stacked bars, and lists what landed in a clicked bar.
 * The chart is plain SVG so it needs no charting library.
 */
@Component( {
    selector: 'app-push-timeline',
    templateUrl: './push-timeline.component.html',
    styleUrls: [ './push-timeline.component.scss' ],
    changeDetection: ChangeDetectionStrategy.OnPush,
} )
export class PushTimelineComponent implements OnChanges {

    @Input() recap: PushRecapSummary | null = null;
    @Input() hiddenTexts: Set<string> = new Set<string>();

    public readonly series: { key: SeriesKey, name: string, color: string }[] = [
        { key: 'player', name: 'Players', color: '#3987e5' },
        { key: 'proc', name: 'Procs, no player named', color: '#d95926' },
        { key: 'possible', name: 'Possible procs', color: '#199e70' },
    ];
    public readonly kindLabels: string[] = [ 'Hit', 'Cast, assumed ~', 'Proc', 'Possible proc' ];
    public readonly kindColors: string[] = [ '#3987e5', '#3987e5', '#d95926', '#199e70' ];

    public available: boolean = false;
    public measure: 'hits' | 'push' = 'hits';
    public showPossible: boolean = false;
    public selected: number = -1;
    public bucket: number = 1;
    public bars: ChartBar[] = [];
    public grid: ChartGrid[] = [];
    public yTicks: ChartTick[] = [];
    public xTicks: ChartTick[] = [];
    public drillTitle: string = '';
    public drillNote: string = '';
    public drillRows: { time: string, who: string, spell: string, push: string, kind: number }[] = [];
    public tip: { x: number, y: number, title: string, rows: { name: string, value: number }[] } | null = null;

    private events: TimelineEvent[] = [];
    private seconds: number = 1;
    private count: number = 1;
    private fightStart: string | null = null;
    private totals: { player: number, proc: number, possible: number }[] = [];
    private lastId: string | null = null;

    constructor( private readonly changeDetector: ChangeDetectorRef ) { }

    ngOnChanges(): void {
        const id = this.recap?.id ?? null;
        if ( id !== this.lastId ) {
            this.selected = -1;
            this.lastId = id;
        }
        this.read();
        this.draw();
    }










    /**
     * Switches the bar height between the number of hits and the push they added.
     *
     * @param measure The new measure.
     */
    public setMeasure( measure: 'hits' | 'push' ): void {
        this.measure = measure;
        this.draw();
    }










    /**
     * Shows or hides the possible procs, which are not in any total.
     */
    public togglePossible(): void {
        this.showPossible = !this.showPossible;
        this.draw();
    }










    /**
     * Clicks a bar to list what landed in it, and clicks it again to close the list.
     *
     * @param index The bar that was clicked.
     */
    public select( index: number ): void {
        this.selected = this.selected === index ? -1 : index;
        this.draw();
    }










    /**
     * Shows the tooltip with the totals of one bar next to the mouse.
     *
     * @param event The mouse event, for the tooltip position.
     * @param index The bar under the mouse.
     */
    public showTip( event: MouseEvent, index: number ): void {
        const a = index * this.bucket;
        const z = Math.min( this.seconds, a + this.bucket );
        const clock = this.clock( a );
        this.tip = {
            x: Math.min( event.clientX + 14, window.innerWidth - 220 ),
            y: event.clientY + 14,
            title: `${this.offset( a )}–${this.offset( z )}${clock === '' ? '' : ` · ${clock}`}`,
            rows: this.visibleSeries().map( s => ( { name: s.name, value: Math.round( this.totals[ index ][ s.key ] * 100 ) / 100 } ) ),
        };
    }










    /**
     * Hides the tooltip when the mouse leaves a bar.
     */
    public hideTip(): void {
        this.tip = null;
    }










    /**
     * Lists the series that are drawn, which leave out the possible procs until they are switched
     * on.
     */
    public visibleSeries(): { key: SeriesKey, name: string, color: string }[] {
        return this.series.filter( s => s.key !== 'possible' || this.showPossible );
    }










    /**
     * Explains what one bar and its height stand for, which depends on the fight length and the
     * measure.
     */
    public get hint(): string {
        return `Each bar is ${this.bucket} ${this.bucket === 1 ? 'second' : 'seconds'}. ${this.measure === 'hits' ? 'Height = push hits.' : 'Height = push value added up.'}`;
    }










    /**
     * Dims the bars next to the clicked one so it stands out.
     *
     * @param index The bar to dim or not.
     */
    public barOpacity( index: number ): number {
        return this.selected === -1 || this.selected === index ? 1 : 0.35;
    }










    /**
     * Formats seconds into the fight as minutes and seconds.
     *
     * @param seconds The seconds into the fight.
     */
    private offset( seconds: number ): string {
        return `${Math.floor( seconds / 60 )}:${String( seconds % 60 ).padStart( 2, '0' )}`;
    }










    /**
     * Formats the log clock time of a moment in the fight, or nothing when the start of the fight
     * is unknown.
     *
     * @param seconds The seconds into the fight.
     */
    private clock( seconds: number ): string {
        const start = ( this.fightStart === null || this.fightStart === undefined ) ? NaN : Date.parse( this.fightStart );
        return isNaN( start ) ? '' : new Date( start + seconds * 1000 ).toISOString().substring( 11, 19 );
    }










    /**
     * Finds the bar an event falls in.
     *
     * @param event The timeline event.
     */
    private barOf( event: TimelineEvent ): number {
        return Math.min( this.count - 1, Math.floor( event.time / this.bucket ) );
    }










    /**
     * Turns the saved timeline into events, without the hidden messages, and sizes the bars to the
     * fight.
     */
    private read(): void {
        const recap = this.recap;
        this.available = Array.isArray( recap?.timeline );
        this.events = [];
        if ( !this.available ) {
            return;
        }
        const players = recap.players ?? [];
        const texts = recap.timelineTexts ?? [];
        const labels = new Map<string, string>();
        [ ...( recap.unattributed?.procs ?? [] ), ...( recap.unattributed?.possible ?? [] ) ].forEach( p => labels.set( p.text, p.name ) );
        recap.timeline.forEach( ( [ time, kind, who, ref, push ] ) => {
            if ( kind < 2 ) {
                this.events.push( { time: time, kind: kind, who: players[ who ]?.name ?? '', spell: ref as string, text: '', push: push } );
            } else if ( !this.hiddenTexts.has( texts[ ref as number ] ) ) {
                this.events.push( { time: time, kind: kind, who: '', spell: labels.get( texts[ ref as number ] ) ?? '', text: texts[ ref as number ] ?? '', push: push } );
            }
        } );
        this.seconds = Math.max( 1, recap.fightSeconds ?? 1, ...this.events.map( e => e.time ) );
        this.bucket = Math.max( 1, Math.round( this.seconds / targetBars ) );
        this.count = Math.ceil( this.seconds / this.bucket );
        this.fightStart = recap.fightStart ?? null;
        this.selected = Math.min( this.selected, this.count - 1 );
    }










    /**
     * Picks a tick step of 1, 2 or 5 times a power of ten that gives at most six ticks.
     *
     * @param max The largest value on the axis.
     */
    private axisStep( max: number ): number {
        for ( let scale = 1; ; scale *= 10 ) {
            for ( const base of [ 1, 2, 5 ] ) {
                if ( Math.ceil( max / ( base * scale ) ) <= 6 ) {
                    return base * scale;
                }
            }
        }
    }










    /**
     * Rebuilds everything the template draws, and tells Angular to check it.
     */
    private draw(): void {
        this.bars = [];
        this.grid = [];
        this.yTicks = [];
        this.xTicks = [];
        this.drillRows = [];
        if ( this.available ) {
            this.drawChart();
            this.drawDrill();
        }
        this.changeDetector.markForCheck();
    }










    /**
     * Builds the bars, gridlines and axis ticks from the events.
     */
    private drawChart(): void {
        const plotWidth = chartWidth - left - right;
        const plotHeight = chartHeight - top - bottom;
        this.totals = Array.from( { length: this.count }, () => ( { player: 0, proc: 0, possible: 0 } ) );
        this.events.forEach( e => {
            if ( e.kind !== 3 || this.showPossible ) {
                this.totals[ this.barOf( e ) ][ e.kind === 3 ? 'possible' : e.kind === 2 ? 'proc' : 'player' ] += this.measure === 'hits' ? 1 : e.push;
            }
        } );
        const max = Math.max( 1, ...this.totals.map( b => b.player + b.proc + b.possible ) );
        const step = this.axisStep( max );
        const ceiling = Math.ceil( max / step ) * step;

        for ( let v = 0; v <= ceiling + step / 2; v += step ) {
            const y = top + plotHeight - v / ceiling * plotHeight;
            this.grid.push( { y: y, axis: v === 0 } );
            this.yTicks.push( { value: `${Math.round( v * 100 ) / 100}`, x: left - 8, y: y + 4, anchor: 'end' } );
        }
        for ( let s = 0; s <= this.seconds; s += 30 ) {
            this.xTicks.push( { value: this.offset( s ), x: left + s / this.seconds * plotWidth, y: chartHeight - 8, anchor: s === 0 ? 'start' : s === this.seconds ? 'end' : 'middle' } );
        }

        const barWidth = plotWidth / this.count;
        const gap = Math.min( 2, barWidth * 0.2 );
        this.bars = this.totals.map( ( b, i ) => {
            let y0 = top + plotHeight;
            const x = left + i * barWidth + gap / 2;
            const w = barWidth - gap;
            const shown = this.visibleSeries().filter( s => b[ s.key ] > 0 );
            const parts = shown.map( ( s, j ) => {
                const h = b[ s.key ] / ceiling * plotHeight;
                const y = y0 - h;
                const isTop = j === shown.length - 1;
                const r = isTop ? Math.min( 4, w / 2, h ) : 0;
                const d = r > 0 ? `M${x},${y0} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y0} Z` : `M${x},${y0} V${y} H${x + w} V${y0} Z`;
                y0 = y - ( isTop ? 0 : 2 );
                return { d: d, color: s.color };
            } );
            return { parts: parts, x: left + i * barWidth, width: barWidth };
        } );
    }










    /**
     * Builds the list of what landed in the clicked bar.
     */
    private drawDrill(): void {
        if ( this.selected === -1 ) {
            this.drillTitle = 'Click a bar to see what landed';
            this.drillNote = '';
            return;
        }
        const a = this.selected * this.bucket;
        const z = Math.min( this.seconds, a + this.bucket );
        const list = this.events.filter( e => this.barOf( e ) === this.selected && ( e.kind !== 3 || this.showPossible ) );
        const counted = list.filter( e => e.kind !== 3 );
        const clock = this.clock( a );
        this.drillTitle = `${this.offset( a )}–${this.offset( z )} into the fight${clock === '' ? '' : ` (${clock})`}`;
        this.drillNote = `${counted.length} ${counted.length === 1 ? 'hit' : 'hits'} · ${Math.round( counted.reduce( ( sum, e ) => sum + e.push, 0 ) * 100 ) / 100} push`;
        this.drillRows = list.map( e => ( {
            time: `${this.offset( e.time )}${this.clock( e.time ) === '' ? '' : ` · ${this.clock( e.time )}`}`,
            who: e.who === '' ? '—' : e.who,
            spell: e.kind < 2 ? e.spell : `${e.spell}${e.text === '' ? '' : ` …${e.text}`}`,
            push: `${e.kind === 3 ? '~' : ''}${e.push}`,
            kind: e.kind,
        } ) );
    }

}
