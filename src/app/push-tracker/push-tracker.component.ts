import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { DialogService } from '../dialogs/dialog.service';
import { IpcService } from '../ipc.service';
import { CharacterModel, PushRecapProc, PushRecapSummary } from '../core.model';

/**
 * One cell of the player by spell grid.
 */
export interface PushGridCell {
    events: number;
    assumed: number;
    background: string;
    tooltip: string;
}










/**
 * One player row of the grid.
 */
export interface PushGridRow {
    name: string;
    events: number;
    assumed: number;
    pushValue: number;
    cells: PushGridCell[];
}










/**
 * The Push tab: saved Push Recaps listed with their details and a player by spell grid.
 */
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










    /**
     * Keeps the recap rows stable while the list refreshes, so a selection survives a save.
     *
     * @param index The row position, unused.
     * @param recap The recap in the row.
     */
    public trackById( index: number, recap: PushRecapSummary ): string {
        return recap.id;
    }










    /**
     * Keeps the grid rows and columns stable while the selected recap changes.
     *
     * @param index The position, unused.
     * @param value A player row or a spell name.
     */
    public trackByName( index: number, value: { name: string } | string ): string {
        return typeof value === 'string' ? value : value.name;
    }










    /**
     * Names a character in the open menu, with the server so same-named characters
     * can be told apart.
     *
     * @param character The character to label.
     */
    public characterLabel( character: CharacterModel ): string {
        return character.server ? `${character.name} (${character.server})` : character.name;
    }










    /**
     * Opens the pop-up window for the last boss kill in the character's log.
     *
     * @param character The character whose log is read.
     */
    public openPushRecap( character: CharacterModel ): void {
        this.ipcService.showPushRecap( character.logFile, character.name, character.server );
    }










    /**
     * Shows the push of one proc hit, as a range when the landing message fits spells
     * with different values.
     *
     * @param proc The proc to describe.
     */
    public procPush( proc: PushRecapProc ): string {
        if ( proc.pushMin === null || proc.pushMin === undefined ) {
            return '-';
        }
        return ( proc.push !== null && proc.push !== undefined ) ? `${proc.push}` : `${proc.pushMin}\u2013${proc.pushMax}`;
    }










    /**
     * Shows the push a proc added in total, as an estimated range when its value is not known.
     *
     * @param proc The proc to describe.
     */
    public procTotal( proc: PushRecapProc ): string {
        if ( proc.pushMin === null || proc.pushMin === undefined ) {
            return '-';
        }
        const round = ( value: number ) => Math.round( value * 100 ) / 100;
        return ( proc.push !== null && proc.push !== undefined ) ? `${round( proc.count * proc.push )}` : `~${round( proc.count * proc.pushMin )}\u2013${round( proc.count * proc.pushMax )}`;
    }










    /**
     * Re-applies the filters after the damage, named or mob filter changed.
     */
    public onFilterChange(): void {
        this.applyFilters();
    }










    /**
     * Picks the recap whose details are shown.
     *
     * @param recap The recap that was clicked.
     */
    public select( recap: PushRecapSummary ): void {
        this.selected = recap;
        this.loadDetail();
    }










    /**
     * Deletes one saved recap without also selecting its row.
     *
     * @param recap The recap to delete.
     * @param event The click event, stopped so the row is not selected.
     */
    public remove( recap: PushRecapSummary, event: Event ): void {
        event.stopPropagation();
        this.ipcService.deletePushRecap( recap.id );
    }










    /**
     * Deletes every saved recap after the user confirms.
     */
    public clearAll(): void {
        this.dialogService.showConfirmationDialog( 'Delete all saved push recaps?', 'Delete all', 'Cancel' ).subscribe( confirmed => {
            if ( confirmed === true ) {
                this.ipcService.clearPushRecaps();
            }
        } );
    }










    /**
     * Copies a short text version of the selected recap, for pasting into chat.
     */
    public copySummary(): void {
        const recap = this.detail;
        if ( recap === null || recap === undefined ) {
            return;
        }
        const lines = [
            `Push Recap - ${recap.mob}, killed ${this.formatTime( recap )}, fight ${this.formatLength( recap.fightSeconds )}`,
            `${recap.events} push hits, ${recap.players.length} players pushing`,
        ];
        recap.players.forEach( ( p, i ) => {
            const share = recap.events > 0 ? Math.round( p.events * 100 / recap.events ) : 0;
            lines.push( `${i + 1}. ${p.name} - ${p.events} (${share}%)${p.assumed > 0 ? ` ~${p.assumed} assumed` : ''}` );
        } );
        if ( recap.unattributed.events > 0 ) {
            const top = ( recap.unattributed.procs ?? [] ).slice( 0, 5 ).map( p => `${p.name} ${p.count}` ).join( ', ' );
            lines.push( `Procs with no player named: ${recap.unattributed.events}${top === '' ? '' : ` (${top})`}` );
        }
        this.ipcService.sendTextToClipboard( lines.join( '\n' ) );
    }










    /**
     * Formats the kill time for display.
     *
     * @param recap The recap to format.
     */
    public formatTime( recap: PushRecapSummary ): string {
        // The log has no time zone, so the kill time holds the log's clock as UTC.
        return recap.killTime.substring( 0, 16 ).replace( 'T', ' ' );
    }










    /**
     * Formats a fight length as minutes and seconds.
     *
     * @param seconds The length in seconds.
     */
    public formatLength( seconds: number ): string {
        return seconds >= 60 ? `${Math.floor( seconds / 60 )}m ${Math.round( seconds % 60 )}s` : `${seconds}s`;
    }










    /**
     * Shortens a damage number with K, M or B so it fits a narrow column.
     *
     * @param value The damage.
     */
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










    /**
     * Fetches the saved recaps, newest first, and refreshes the filtered list.
     */
    private load(): void {
        this.ipcService.getPushRecaps().subscribe( recaps => {
            this.recaps = ( recaps ?? [] ).slice().sort( ( a, b ) => b.killTime.localeCompare( a.killTime ) );
            this.showCharacter = new Set( this.recaps.map( r => r.characterName ) ).size > 1;
            this.loaded = true;
            this.applyFilters();
        } );
    }










    /**
     * Filters the recap list and keeps the selection only if it is still shown.
     */
    private applyFilters(): void {
        const mob = this.mobFilter.trim().toLowerCase();
        this.rows = this.recaps.filter( r => {
            return r.damageTaken >= this.minDamage
                && ( !this.namedOnly || r.named )
                && ( mob === '' || r.mob.toLowerCase().indexOf( mob ) > -1 );
        } );
        const selectedId = this.selected?.id;
        const stillListed = this.rows.find( r => r.id === selectedId ) ?? null;
        this.selected = ( this.selected === null || this.selected === undefined ) ? null : stillListed;
        const selectionChanged = this.selected === null || this.selected === undefined
            || this.selected.id !== this.detail?.id || this.selected.savedAt !== this.detail?.savedAt;
        if ( selectionChanged ) {
            this.loadDetail();
        } else {
            this.changeDetector.markForCheck();
        }
    }










    /**
     * Fetches the full recap for the selection, dropping an older request that has
     * not returned.
     */
    private loadDetail(): void {
        this.detailSubscription?.unsubscribe();
        this.detailSubscription = null;
        this.detail = null;
        this.buildGrid();
        if ( this.selected !== null && this.selected !== undefined ) {
            this.detailSubscription = this.ipcService.getPushRecap( this.selected.id ).subscribe( recap => {
                this.detail = recap;
                this.buildGrid();
            } );
        }
    }










    /**
     * Builds the player by spell grid, with cell shading scaled to the busiest cell.
     */
    private buildGrid(): void {
        const recap = this.detail;
        this.gridSpells = [];
        this.gridSpellPush = new Map<string, number | null>();
        this.gridRows = [];

        if ( recap !== null && recap !== undefined ) {
            const totals: Map<string, number> = new Map<string, number>();
            let max = 0;
            recap.players.forEach( p => Object.keys( p.spells ).forEach( s => {
                totals.set( s, ( totals.get( s ) ?? 0 ) + p.spells[ s ].events );
                max = Math.max( max, p.spells[ s ].events );
                if ( this.gridSpellPush.get( s ) === null || this.gridSpellPush.get( s ) === undefined ) {
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
                    const count = Object.prototype.hasOwnProperty.call( p.spells, s ) ? p.spells[ s ] : null;
                    return ( count === null || count === undefined ) || count.events <= 0
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










    /**
     * Explains a grid cell: its hits, the push each added, and how many were assumed.
     *
     * @param events The hit count.
     * @param assumed How many hits were assumed rather than confirmed.
     * @param push The push value of one hit, if known.
     */
    private cellTooltip( events: number, assumed: number, push: number | undefined ): string {
        const text = ( push === null || push === undefined )
            ? `${events} hits`
            : `${events} hits \u00d7 ${push} push = ${Math.round( events * push * 100 ) / 100} push`;
        return assumed > 0 ? `${text}, ${assumed} assumed` : text;
    }

}
