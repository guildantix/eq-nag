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

    constructor( private readonly changeDetector: ChangeDetectorRef ) {
    }

    ngOnChanges(): void {
        let id = this.recap?.id ?? null;
        if ( id !== this.lastId ) {
            this.selected = -1;
            this.lastId = id;
        }
        this.read();
        this.draw();
    }

    public setMeasure( measure: 'hits' | 'push' ): void {
        this.measure = measure;
        this.draw();
    }

    public togglePossible(): void {
        this.showPossible = !this.showPossible;
        this.draw();
    }

    public select( index: number ): void {
        this.selected = this.selected === index ? -1 : index;
        this.draw();
    }

    public showTip( event: MouseEvent, index: number ): void {
        let a = index * this.bucket;
        let z = Math.min( this.seconds, a + this.bucket );
        let clock = this.clock( a );
        this.tip = {
            x: Math.min( event.clientX + 14, window.innerWidth - 220 ),
            y: event.clientY + 14,
            title: `${this.offset( a )}–${this.offset( z )}${clock === '' ? '' : ` · ${clock}`}`,
            rows: this.visibleSeries().map( s => ( { name: s.name, value: Math.round( this.totals[ index ][ s.key ] * 100 ) / 100 } ) ),
        };
    }

    public hideTip(): void {
        this.tip = null;
    }

    public visibleSeries(): { key: SeriesKey, name: string, color: string }[] {
        return this.series.filter( s => s.key !== 'possible' || this.showPossible );
    }

    public get hint(): string {
        return `Each bar is ${this.bucket} ${this.bucket === 1 ? 'second' : 'seconds'}. ${this.measure === 'hits' ? 'Height = push hits.' : 'Height = push value added up.'}`;
    }

    public barOpacity( index: number ): number {
        return this.selected === -1 || this.selected === index ? 1 : 0.35;
    }

    private offset( seconds: number ): string {
        return `${Math.floor( seconds / 60 )}:${String( seconds % 60 ).padStart( 2, '0' )}`;
    }

    private clock( seconds: number ): string {
        let start = this.fightStart == null ? NaN : Date.parse( this.fightStart );
        return isNaN( start ) ? '' : new Date( start + seconds * 1000 ).toISOString().substring( 11, 19 );
    }

    private barOf( event: TimelineEvent ): number {
        return Math.min( this.count - 1, Math.floor( event.time / this.bucket ) );
    }

    private read(): void {
        let recap = this.recap;
        this.available = Array.isArray( recap?.timeline );
        this.events = [];
        if ( !this.available ) {
            return;
        }
        let players = recap.players ?? [];
        let texts = recap.timelineTexts ?? [];
        let labels = new Map<string, string>();
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

    private axisStep( max: number ): number {
        for ( let scale = 1; ; scale *= 10 ) {
            for ( let base of [ 1, 2, 5 ] ) {
                if ( Math.ceil( max / ( base * scale ) ) <= 6 ) {
                    return base * scale;
                }
            }
        }
    }

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

    private drawChart(): void {
        let plotWidth = chartWidth - left - right;
        let plotHeight = chartHeight - top - bottom;
        this.totals = Array.from( { length: this.count }, () => ( { player: 0, proc: 0, possible: 0 } ) );
        this.events.forEach( e => {
            if ( e.kind !== 3 || this.showPossible ) {
                this.totals[ this.barOf( e ) ][ e.kind === 3 ? 'possible' : e.kind === 2 ? 'proc' : 'player' ] += this.measure === 'hits' ? 1 : e.push;
            }
        } );
        let max = Math.max( 1, ...this.totals.map( b => b.player + b.proc + b.possible ) );
        let step = this.axisStep( max );
        let ceiling = Math.ceil( max / step ) * step;

        for ( let v = 0; v <= ceiling + step / 2; v += step ) {
            let y = top + plotHeight - v / ceiling * plotHeight;
            this.grid.push( { y: y, axis: v === 0 } );
            this.yTicks.push( { value: `${Math.round( v * 100 ) / 100}`, x: left - 8, y: y + 4, anchor: 'end' } );
        }
        for ( let s = 0; s <= this.seconds; s += 30 ) {
            this.xTicks.push( { value: this.offset( s ), x: left + s / this.seconds * plotWidth, y: chartHeight - 8, anchor: s === 0 ? 'start' : s === this.seconds ? 'end' : 'middle' } );
        }

        let barWidth = plotWidth / this.count;
        let gap = Math.min( 2, barWidth * 0.2 );
        this.bars = this.totals.map( ( b, i ) => {
            let y0 = top + plotHeight;
            let x = left + i * barWidth + gap / 2;
            let w = barWidth - gap;
            let shown = this.visibleSeries().filter( s => b[ s.key ] > 0 );
            let parts = shown.map( ( s, j ) => {
                let h = b[ s.key ] / ceiling * plotHeight;
                let y = y0 - h;
                let isTop = j === shown.length - 1;
                let r = isTop ? Math.min( 4, w / 2, h ) : 0;
                let d = r > 0 ? `M${x},${y0} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y0} Z` : `M${x},${y0} V${y} H${x + w} V${y0} Z`;
                y0 = y - ( isTop ? 0 : 2 );
                return { d: d, color: s.color };
            } );
            return { parts: parts, x: left + i * barWidth, width: barWidth };
        } );
    }

    private drawDrill(): void {
        if ( this.selected === -1 ) {
            this.drillTitle = 'Click a bar to see what landed';
            this.drillNote = '';
            return;
        }
        let a = this.selected * this.bucket;
        let z = Math.min( this.seconds, a + this.bucket );
        let list = this.events.filter( e => this.barOf( e ) === this.selected && ( e.kind !== 3 || this.showPossible ) );
        let counted = list.filter( e => e.kind !== 3 );
        let clock = this.clock( a );
        this.drillTitle = `${this.offset( a )}–${this.offset( z )} into the fight${clock === '' ? '' : ` (${clock})`}`;
        this.drillNote = `${counted.length} hits · ${Math.round( counted.reduce( ( sum, e ) => sum + e.push, 0 ) * 100 ) / 100} push`;
        this.drillRows = list.map( e => ( {
            time: `${this.offset( e.time )}${this.clock( e.time ) === '' ? '' : ` · ${this.clock( e.time )}`}`,
            who: e.who === '' ? '—' : e.who,
            spell: e.kind < 2 ? e.spell : `${e.spell}${e.text === '' ? '' : ` …${e.text}`}`,
            push: `${e.kind === 3 ? '~' : ''}${e.push}`,
            kind: e.kind,
        } ) );
    }

}
