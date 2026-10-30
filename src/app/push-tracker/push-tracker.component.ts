import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { DialogService } from '../dialogs/dialog.service';
import { IpcService } from '../ipc.service';
import { PushRecapSummary } from '../core.model';

export interface PushGridCell {
    events: number;
    assumed: number;
    background: string;
}

export interface PushGridRow {
    name: string;
    events: number;
    assumed: number;
    cells: PushGridCell[];
}

@Component( {
    selector: 'app-push-tracker',
    templateUrl: './push-tracker.component.html',
    styleUrls: [ './push-tracker.component.scss', '../core.scss' ],
    changeDetection: ChangeDetectionStrategy.OnPush,
} )
export class PushTrackerComponent implements OnInit, OnDestroy {

    public readonly minDamageOptions: { label: string, value: number }[] = [
        { label: 'Any', value: 0 },
        { label: '50M+', value: 50000000 },
        { label: '250M+', value: 250000000 },
        { label: '1B+', value: 1000000000 },
    ];

    public minDamage: number = 0;
    public namedOnly: boolean = false;
    public mobFilter: string = '';

    public loaded: boolean = false;
    public recaps: PushRecapSummary[] = [];
    public rows: PushRecapSummary[] = [];
    public showCharacter: boolean = false;
    public selected: PushRecapSummary | null = null;
    public detail: PushRecapSummary | null = null;
    public gridSpells: string[] = [];
    public gridRows: PushGridRow[] = [];

    private subscription: Subscription = new Subscription();
    private detailSubscription: Subscription | null = null;

    constructor(
        private readonly ipcService: IpcService,
        private readonly dialogService: DialogService,
        private readonly changeDetector: ChangeDetectorRef,
    ) {
    }

    ngOnInit(): void {
        this.subscription.add( this.ipcService.onPushRecapsChanged().subscribe( () => this.load() ) );
        this.load();
    }

    ngOnDestroy(): void {
        this.subscription.unsubscribe();
        this.detailSubscription?.unsubscribe();
    }

    public trackById( index: number, recap: PushRecapSummary ): string {
        return recap.id;
    }

    public trackByName( index: number, value: { name: string } | string ): string {
        return typeof value === 'string' ? value : value.name;
    }

    public onFilterChange(): void {
        this.applyFilters();
    }

    public select( recap: PushRecapSummary ): void {
        this.selected = recap;
        this.loadDetail();
    }

    public remove( recap: PushRecapSummary, event: Event ): void {
        event.stopPropagation();
        this.ipcService.deletePushRecap( recap.id );
    }

    public clearAll(): void {
        this.dialogService.showConfirmationDialog( 'Delete all saved push recaps?', 'Delete all', 'Cancel' ).subscribe( confirmed => {
            if ( confirmed === true ) {
                this.ipcService.clearPushRecaps();
            }
        } );
    }

    public copySummary(): void {
        let recap = this.detail;
        if ( recap == null ) {
            return;
        }
        let lines = [
            `Push Recap - ${recap.mob}, killed ${this.formatTime( recap )}, fight ${this.formatLength( recap.fightSeconds )}`,
            `${recap.events} push events, ${recap.players.length} players pushing`,
        ];
        recap.players.forEach( ( p, i ) => {
            let share = recap.events > 0 ? Math.round( p.events * 100 / recap.events ) : 0;
            lines.push( `${i + 1}. ${p.name} - ${p.events} (${share}%)${p.assumed > 0 ? ` ~${p.assumed} assumed` : ''}` );
        } );
        if ( recap.unattributed.events > 0 ) {
            lines.push( `Unattributed procs: ${recap.unattributed.events}` );
        }
        this.ipcService.sendTextToClipboard( lines.join( '\n' ) );
    }

    public formatTime( recap: PushRecapSummary ): string {
        // The log has no time zone, so the kill time holds the log's clock as UTC.
        return recap.killTime.substring( 0, 16 ).replace( 'T', ' ' );
    }

    public formatLength( seconds: number ): string {
        return seconds >= 60 ? `${Math.floor( seconds / 60 )}m ${Math.round( seconds % 60 )}s` : `${seconds}s`;
    }

    public formatDamage( value: number ): string {
        if ( value >= 1000000000 ) {
            return `${( value / 1000000000 ).toFixed( 2 )}B`;
        } else if ( value >= 1000000 ) {
            return `${( value / 1000000 ).toFixed( 1 )}M`;
        } else if ( value >= 1000 ) {
            return `${( value / 1000 ).toFixed( 1 )}K`;
        }
        return `${value}`;
    }

    private load(): void {
        this.ipcService.getPushRecaps().subscribe( recaps => {
            this.recaps = ( recaps ?? [] ).slice().sort( ( a, b ) => b.killTime.localeCompare( a.killTime ) );
            this.showCharacter = new Set( this.recaps.map( r => r.characterName ) ).size > 1;
            this.loaded = true;
            this.applyFilters();
        } );
    }

    private applyFilters(): void {
        let mob = this.mobFilter.trim().toLowerCase();
        this.rows = this.recaps.filter( r => r.damageTaken >= this.minDamage && ( !this.namedOnly || r.named ) && ( mob === '' || r.mob.toLowerCase().indexOf( mob ) > -1 ) );
        let selectedId = this.selected?.id;
        this.selected = this.selected == null ? null : this.rows.find( r => r.id === selectedId ) ?? null;
        if ( this.selected == null || this.selected.id !== this.detail?.id || this.selected.savedAt !== this.detail?.savedAt ) {
            this.loadDetail();
        } else {
            this.changeDetector.markForCheck();
        }
    }

    private loadDetail(): void {
        this.detailSubscription?.unsubscribe();
        this.detailSubscription = null;
        this.detail = null;
        this.buildGrid();
        if ( this.selected != null ) {
            this.detailSubscription = this.ipcService.getPushRecap( this.selected.id ).subscribe( recap => {
                this.detail = recap;
                this.buildGrid();
            } );
        }
    }

    private buildGrid(): void {
        let recap = this.detail;
        this.gridSpells = [];
        this.gridRows = [];

        if ( recap != null ) {
            let totals: Map<string, number> = new Map<string, number>();
            let max = 0;
            recap.players.forEach( p => Object.keys( p.spells ).forEach( s => {
                totals.set( s, ( totals.get( s ) ?? 0 ) + p.spells[ s ].events );
                max = Math.max( max, p.spells[ s ].events );
            } ) );
            this.gridSpells = Array.from( totals.keys() ).sort( ( a, b ) => totals.get( b ) - totals.get( a ) || a.localeCompare( b ) );

            this.gridRows = recap.players.slice().sort( ( a, b ) => b.events - a.events || a.name.localeCompare( b.name ) ).map( p => ( {
                name: p.name,
                events: p.events,
                assumed: p.assumed,
                cells: this.gridSpells.map( s => {
                    let count = Object.prototype.hasOwnProperty.call( p.spells, s ) ? p.spells[ s ] : null;
                    return count == null || count.events <= 0
                        ? null
                        : { events: count.events, assumed: count.assumed, background: `rgba( 105, 240, 174, ${( 0.12 + 0.6 * count.events / max ).toFixed( 2 )} )` };
                } ),
            } ) );
        }

        this.changeDetector.markForCheck();
    }

}
