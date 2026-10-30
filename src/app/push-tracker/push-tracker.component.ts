import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { DialogService } from '../dialogs/dialog.service';
import { IpcService } from '../ipc.service';
import { CharacterModel, PushRecapProc, PushRecapSummary } from '../core.model';

export interface PushGridCell {
    events: number;
    assumed: number;
    background: string;
    tooltip: string;
}

export interface PushGridRow {
    name: string;
    events: number;
    assumed: number;
    pushValue: number;
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
    public gridSpellPush: Map<string, number | null> = new Map<string, number | null>();
    public gridRows: PushGridRow[] = [];
    public characters: CharacterModel[] = [];

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
        this.ipcService.getCharacters().subscribe( characters => {
            this.characters = ( characters ?? [] ).filter( c => c.logFile );
            this.changeDetector.markForCheck();
        } );
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

    public characterLabel( character: CharacterModel ): string {
        return character.server ? `${character.name} (${character.server})` : character.name;
    }

    public openPushRecap( character: CharacterModel ): void {
        this.ipcService.showPushRecap( character.logFile, character.name, character.server );
    }

    public procPush( proc: PushRecapProc ): string {
        if ( proc.pushMin == null ) {
            return '-';
        }
        return proc.push != null ? `${proc.push}` : `${proc.pushMin}\u2013${proc.pushMax}`;
    }

    public procTotal( proc: PushRecapProc ): string {
        if ( proc.pushMin == null ) {
            return '-';
        }
        let round = ( value: number ) => Math.round( value * 100 ) / 100;
        return proc.push != null ? `${round( proc.count * proc.push )}` : `~${round( proc.count * proc.pushMin )}\u2013${round( proc.count * proc.pushMax )}`;
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
            `${recap.events} push hits, ${recap.players.length} players pushing`,
        ];
        recap.players.forEach( ( p, i ) => {
            let share = recap.events > 0 ? Math.round( p.events * 100 / recap.events ) : 0;
            lines.push( `${i + 1}. ${p.name} - ${p.events} (${share}%)${p.assumed > 0 ? ` ~${p.assumed} assumed` : ''}` );
        } );
        if ( recap.unattributed.events > 0 ) {
            let top = ( recap.unattributed.procs ?? [] ).slice( 0, 5 ).map( p => `${p.name} ${p.count}` ).join( ', ' );
            lines.push( `Procs with no player named: ${recap.unattributed.events}${top === '' ? '' : ` (${top})`}` );
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
        this.gridSpellPush = new Map<string, number | null>();
        this.gridRows = [];

        if ( recap != null ) {
            let totals: Map<string, number> = new Map<string, number>();
            let max = 0;
            recap.players.forEach( p => Object.keys( p.spells ).forEach( s => {
                totals.set( s, ( totals.get( s ) ?? 0 ) + p.spells[ s ].events );
                max = Math.max( max, p.spells[ s ].events );
                if ( this.gridSpellPush.get( s ) == null ) {
                    this.gridSpellPush.set( s, p.spells[ s ].push ?? null );
                }
            } ) );
            this.gridSpells = Array.from( totals.keys() ).sort( ( a, b ) => totals.get( b ) - totals.get( a ) || a.localeCompare( b ) );

            this.gridRows = recap.players.slice().sort( ( a, b ) => b.events - a.events || a.name.localeCompare( b.name ) ).map( p => ( {
                name: p.name,
                events: p.events,
                assumed: p.assumed,
                pushValue: p.pushValue,
                cells: this.gridSpells.map( s => {
                    let count = Object.prototype.hasOwnProperty.call( p.spells, s ) ? p.spells[ s ] : null;
                    return count == null || count.events <= 0
                        ? null
                        : {
                            events: count.events,
                            assumed: count.assumed,
                            background: `rgba( 105, 240, 174, ${( 0.12 + 0.6 * count.events / max ).toFixed( 2 )} )`,
                            tooltip: this.cellTooltip( count.events, count.assumed, count.push ),
                        };
                } ),
            } ) );
        }

        this.changeDetector.markForCheck();
    }

    private cellTooltip( events: number, assumed: number, push: number | undefined ): string {
        let text = push == null
            ? `${events} hits`
            : `${events} hits \u00d7 ${push} push = ${Math.round( events * push * 100 ) / 100} push`;
        return assumed > 0 ? `${text}, ${assumed} assumed` : text;
    }

}
