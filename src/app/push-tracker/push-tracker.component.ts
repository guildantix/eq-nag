import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field';
import { forkJoin, Subscription } from 'rxjs';
import { DialogService } from '../dialogs/dialog.service';
import { IpcService } from '../ipc.service';
import { CharacterModel, PushRecapPreferences, PushRecapProc, PushRecapSummary, PushScanStatus } from '../core.model';
import { aggregateFights, axisStep, describeTotals, nightKey, PushTotals } from './push-totals';

/**
 * One cell of the player by spell grid.
 */
export interface PushGridCell {
    events: number;
    assumed: number;
    background: string;
    tooltip: string;
}

export interface PushTotalsRow {
    name: string;
    fights: number;
    events: number;
    assumed: number;
    pushValue: number;
    cells: PushGridCell[];
}

export interface PushFightBar {
    d: string;
    x: number;
    width: number;
}

export interface PushChartTick {
    value: string;
    x: number;
    y: number;
    anchor: string;
}

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
    // Scoped here, not in app.module, so fields outside Settings and Push keep the default label.
    providers: [ { provide: MAT_FORM_FIELD_DEFAULT_OPTIONS, useValue: { floatLabel: 'always' } } ],
    changeDetection: ChangeDetectionStrategy.OnPush,
} )
export class PushTrackerComponent implements OnInit, OnDestroy {

    public readonly minDamageOptions: { label: string, value: number }[] = [
        { label: 'Any', value: 0 },
        { label: '50M+', value: 50000000 },
        { label: '250M+', value: 250000000 },
        { label: '1B+', value: 1000000000 },
    ];

    public source: 'saved' | 'scan' = 'saved';
    public characters: CharacterModel[] = [];
    public scanCharacterId: string | null = null;
    public scanStatus: PushScanStatus | null = null;
    public scanResults: PushRecapSummary[] = [];
    public scanStartMessage: string = '';
    public savedKeys: Set<string> = new Set<string>();

    public readonly scanFloorOptions: { label: string, value: number }[] = [
        { label: '10K', value: 10000 },
        { label: '100K', value: 100000 },
        { label: '1M', value: 1000000 },
        { label: '10M', value: 10000000 },
        { label: '100M', value: 100000000 },
    ];

    public scanFloor: number = 1000000;
    public minDamage: number = 0;
    public namedOnly: boolean = false;
    public mobFilter: string = '';

    public loaded: boolean = false;
    public recaps: PushRecapSummary[] = [];
    public rows: PushRecapSummary[] = [];
    public showCharacter: boolean = false;
    public selected: PushRecapSummary | null = null;
    public selection: PushRecapSummary[] = [];
    public selectedIds: Set<string> = new Set<string>();
    public multi: boolean = false;
    public dateFilter: string = '';
    public dateOptions: string[] = [];
    public totals: PushTotals | null = null;
    public totalsLoading: boolean = false;
    public totalsTitle: string = '';
    public totalsMeasure: 'hits' | 'push' = 'hits';
    public totalsRows: PushTotalsRow[] = [];
    public fightBars: PushFightBar[] = [];
    public fightGrid: number[] = [];
    public fightYTicks: PushChartTick[] = [];
    public fightXTicks: PushChartTick[] = [];
    public fightTip: { x: number, y: number, title: string, value: string } | null = null;
    public detail: PushRecapSummary | null = null;
    public gridSpells: string[] = [];
    public gridSpellPush: Map<string, number | null> = new Map<string, number | null>();
    public gridRows: PushGridRow[] = [];
    public hiddenTexts: Set<string> = new Set<string>();
    public procRows: PushRecapProc[] = [];
    public possibleRows: PushRecapProc[] = [];
    public hiddenProcCount: number = 0;
    public hiddenPossibleCount: number = 0;

    private subscription: Subscription = new Subscription();
    private detailSubscription: Subscription | null = null;
    private totalsSubscription: Subscription | null = null;
    private detailCache: Map<string, PushRecapSummary> = new Map<string, PushRecapSummary>();
    private anchorId: string | null = null;

    constructor(
        private readonly ipcService: IpcService,
        private readonly dialogService: DialogService,
        private readonly changeDetector: ChangeDetectorRef,
    ) {
    }










    ngOnInit(): void {
        this.subscription.add( this.ipcService.onPushRecapsChanged().subscribe( () => this.load() ) );
        this.subscription.add( this.ipcService.onPushScanProgress().subscribe( progress => {
            if ( this.scanStatus !== null && this.scanStatus !== undefined ) {
                Object.assign( this.scanStatus, progress );
                this.changeDetector.markForCheck();
            }
        } ) );
        this.subscription.add( this.ipcService.onPushScanDone().subscribe( status => {
            this.scanStatus = status;
            this.loadScanResults();
        } ) );
        this.subscription.add( this.ipcService.onPushRecapPreferencesChanged().subscribe( prefs => this.setHiddenTexts( prefs ) ) );
        this.ipcService.getPushRecapPreferences().subscribe( prefs => this.setHiddenTexts( prefs ) );
        this.load();
        this.ipcService.getCharacters().subscribe( characters => {
            this.characters = characters.filter( c => c.logFile );
            this.scanCharacterId = this.scanCharacterId ?? this.characters[ 0 ]?.characterId ?? null;
            this.changeDetector.markForCheck();
        } );
        this.ipcService.getPushScanStatus().subscribe( status => {
            this.scanStatus = status;
            if ( status.status !== 'idle' ) {
                this.scanCharacterId = status.characterId;
                if ( this.scanFloorOptions.some( o => o.value === status.minDamage ) ) {
                    this.scanFloor = status.minDamage;
                }
                this.source = status.status === 'running' ? 'scan' : this.source;
                this.loadScanResults();
            }
        } );
    }










    ngOnDestroy(): void {
        this.subscription.unsubscribe();
        this.detailSubscription?.unsubscribe();
        this.totalsSubscription?.unsubscribe();
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
     * Keeps the proc rows stable while the hidden messages change.
     *
     * @param index The row position, unused.
     * @param proc The proc in the row.
     */
    public trackByProc( index: number, proc: PushRecapProc ): string {
        return proc.text ?? proc.name;
    }










    /**
     * True while a log scan is in progress, so the scan button and progress bar follow it.
     */
    public get scanRunning(): boolean {
        return this.scanStatus?.status === 'running';
    }










    /**
     * How much of the log has been read, as a whole percent for the progress bar.
     */
    public get scanPercent(): number {
        const status = this.scanStatus;
        if ( status === null || status === undefined || status.total <= 0 ) {
            return 0;
        }
        return Math.min( 100, Math.floor( status.bytes * 100 / status.total ) );
    }










    /**
     * The message under the scan controls: why the scan did not start or stop, or what it found.
     */
    public get scanNotice(): string {
        const status = this.scanStatus;
        if ( this.scanStartMessage !== '' ) {
            return this.scanStartMessage;
        }
        if ( ( status === null || status === undefined ) || status.status === 'idle' || status.status === 'running' ) {
            return '';
        }
        if ( status.status !== 'done' || status.message !== '' ) {
            return status.message;
        }
        const seconds = Math.max( 1, Math.round( status.elapsedMs / 1000 ) );
        return `${status.kills} ${status.kills === 1 ? 'kill' : 'kills'} found in ${this.formatLength( seconds )}${status.resumed ? ', continuing the last scan of this log' : ''}.  Fights with ${this.formatDamage( status.minDamage )} or more damage taken are listed.${status.capped ? '  Only the most recent 300 are kept.' : ''}`;
    }










    /**
     * True when the scan notice is a problem, so it can be shown in the error color.
     */
    public get scanFailed(): boolean {
        return this.scanStartMessage !== '' || this.scanStatus?.status === 'error';
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
     * Opens the selected fight in the pop-up as a snapshot, so the pop-up shows what the tab shows.
     */
    public openSelectedFight(): void {
        if ( this.detail !== null && this.detail !== undefined && this.selected !== null && this.selected !== undefined ) {
            this.ipcService.showPushRecap( '', this.detail.characterName, '', this.detail, this.source === 'saved' || this.isSaved( this.selected ) );
        }
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
     * Shows the push a possible proc may have added, always as an estimate because it may not be
     * push at all.
     *
     * @param proc The possible proc to describe.
     */
    public possibleTotal( proc: PushRecapProc ): string {
        const total = this.procTotal( proc );
        return total.startsWith( '~' ) || total === '-' ? total : `~${total}`;
    }










    /**
     * Shows the landing message of a proc, which the log prints after the name of the mob.
     *
     * @param proc The proc to describe.
     */
    public messageText( proc: PushRecapProc ): string {
        return proc.text ? `…${proc.text}` : '—';
    }










    /**
     * Names the spells with no push that share a possible proc's landing message.
     *
     * @param proc The possible proc to describe.
     */
    public alsoText( proc: PushRecapProc ): string {
        const names = proc.alsoNames ?? [];
        if ( names.length === 0 ) {
            return '—';
        }
        const more = ( proc.alsoCount ?? 0 ) - names.length;
        return `${names.join( ', ' )}${more > 0 ? ` +${more} more` : ''}`;
    }










    /**
     * Hides a proc's landing message everywhere, without changing the saved data.
     *
     * @param proc The proc whose message to hide.
     */
    public hideProc( proc: PushRecapProc ): void {
        this.ipcService.setPushProcHidden( proc.text, true );
    }










    /**
     * Counts the procs with no player named in a fights list row, without the hidden messages.
     *
     * @param recap The fights list row.
     */
    public procCount( recap: PushRecapSummary ): number {
        const hiddenProcs = ( recap.unattributed.procs ?? [] ).filter( p => this.hiddenTexts.has( p.text ) );
        const hidden = hiddenProcs.reduce( ( sum, p ) => sum + p.count, 0 );
        return Math.max( 0, recap.unattributed.events - hidden );
    }










    /**
     * Tells how many messages are hidden in a proc table, so a missing row is explained.
     *
     * @param count The number of hidden messages.
     */
    public hiddenNote( count: number ): string {
        return count > 0 ? ` ${count} ${count === 1 ? 'message' : 'messages'} hidden (Settings › Push Recap).` : '';
    }










    /**
     * Switches between the saved recaps and the scan results, dropping the other list selection.
     */
    public onSourceChange(): void {
        this.selectedIds = new Set<string>();
        this.anchorId = null;
        this.applyFilters();
    }










    /**
     * Re-applies the filters after the damage, named or mob filter changed.
     */
    public onFilterChange(): void {
        this.applyFilters();
    }










    /**
     * Starts scanning the chosen character's log for boss kills, and shows why it could not start.
     */
    public startScan(): void {
        if ( ( this.scanCharacterId === null || this.scanCharacterId === undefined ) || this.scanRunning ) {
            return;
        }
        this.scanStartMessage = '';
        this.ipcService.startPushScan( this.scanCharacterId, this.scanFloor ).subscribe( reply => {
            if ( reply.started ) {
                this.ipcService.getPushScanStatus().subscribe( status => {
                    this.scanStatus = status;
                    this.loadScanResults();
                } );
            } else {
                this.scanStartMessage = reply.message;
                this.changeDetector.markForCheck();
            }
        } );
    }










    /**
     * Stops the running scan.
     */
    public cancelScan(): void {
        this.ipcService.cancelPushScan();
    }










    /**
     * Tells whether a scanned fight is already among the saved recaps, so it is not offered twice.
     *
     * @param recap The scanned fight.
     */
    public isSaved( recap: PushRecapSummary ): boolean {
        return this.savedKeys.has( this.recapKey( recap ) );
    }










    /**
     * Saves a scanned fight with its per-player detail, without also selecting its row.
     *
     * @param recap The scanned fight.
     * @param event The click event, stopped so the row is not selected.
     */
    public saveScanned( recap: PushRecapSummary, event: Event ): void {
        event.stopPropagation();
        this.ipcService.getPushScanResult( recap.id ).subscribe( full => {
            if ( full !== null && full !== undefined ) {
                this.ipcService.savePushRecap( Object.assign( {}, full, { id: '' } ) );
            }
        } );
    }

    public select( recap: PushRecapSummary, event: MouseEvent ): void {
        let row = event.currentTarget as HTMLElement;
        let anchor = this.rows.findIndex( r => r.id === this.anchorId );
        if ( event.ctrlKey || event.metaKey ) {
            if ( this.selectedIds.has( recap.id ) ) {
                this.selectedIds.delete( recap.id );
            } else {
                this.selectedIds.add( recap.id );
            }
            this.anchorId = recap.id;
        } else if ( event.shiftKey && anchor > -1 ) {
            let to = this.rows.indexOf( recap );
            this.selectedIds = new Set( this.rows.slice( Math.min( anchor, to ), Math.max( anchor, to ) + 1 ).map( r => r.id ) );
        } else {
            this.selectedIds = new Set<string>( [ recap.id ] );
            this.anchorId = recap.id;
        }
        this.applySelection();
        setTimeout( () => row.scrollIntoView( { block: 'nearest' } ) );
    }

    public selectAllShown(): void {
        this.selectedIds = new Set( this.rows.map( r => r.id ) );
        this.anchorId = this.rows[ 0 ]?.id ?? null;
        this.applySelection();
    }

    public closeDetails(): void {
        this.selectedIds = new Set<string>();
        this.applySelection();
    }

    public selectFight( id: string ): void {
        this.selectedIds = new Set<string>( [ id ] );
        this.anchorId = id;
        this.applySelection();
    }

    public setTotalsMeasure( measure: 'hits' | 'push' ): void {
        this.totalsMeasure = measure;
        this.buildFightChart();
        this.changeDetector.markForCheck();
    }

    public showFightTip( event: MouseEvent, index: number ): void {
        let fight = this.totals.perFight[ index ];
        let value = this.totalsMeasure === 'hits' ? fight.hits : fight.pushValue;
        this.fightTip = {
            x: Math.min( event.clientX + 14, window.innerWidth - 240 ),
            y: event.clientY + 14,
            title: `${fight.mob} \u00b7 ${fight.killTime.substring( 11, 16 )}`,
            value: `${value} ${this.totalsMeasure === 'hits' ? 'push hits' : 'push'}`,
        };
    }

    public hideFightTip(): void {
        this.fightTip = null;
    }










    /**
     * Labels a spell column in the grid with its push value, when it has one.
     *
     * @param spell The spell name.
     */
    public spellHeader( spell: string ): string {
        const push = this.gridSpellPush.get( spell );
        return ( push === null || push === undefined ) ? spell : `${spell} (${push})`;
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
        if ( this.multi && this.totals != null ) {
            let first = nightKey( this.totals.firstKill );
            let last = nightKey( this.totals.lastKill );
            this.ipcService.sendTextToClipboard( describeTotals( this.totals, first === last ? first : `${first} to ${last}`, this.formatLength( this.totals.seconds ) ) );
            return;
        }
        let recap = this.detail;
        if ( recap == null ) {
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
        const hiddenCount = ( list: PushRecapProc[] | undefined ) => {
            return ( list ?? [] ).filter( p => this.hiddenTexts.has( p.text ) ).reduce( ( sum, p ) => sum + p.count, 0 );
        };
        const procHits = recap.unattributed.events - hiddenCount( recap.unattributed.procs );
        if ( procHits > 0 ) {
            const top = this.procRows.slice( 0, 5 ).map( p => `${p.name} ${p.count}` ).join( ', ' );
            lines.push( `Procs with no player named: ${procHits}${top === '' ? '' : ` (${top})`}` );
        }
        const possibleHits = ( recap.unattributed.possibleEvents ?? 0 ) - hiddenCount( recap.unattributed.possible );
        if ( possibleHits > 0 ) {
            const top = this.possibleRows.slice( 0, 5 ).map( p => `${p.name} ${p.count}` ).join( ', ' );
            lines.push( `Possible procs: ${possibleHits}${top === '' ? '' : ` (${top})`}` );
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
            this.detailCache.clear();
            this.recaps = ( recaps ?? [] ).slice().sort( ( a, b ) => b.killTime.localeCompare( a.killTime ) );
            this.savedKeys = new Set( this.recaps.map( r => this.recapKey( r ) ) );
            this.loaded = true;
            this.applyFilters();
        } );
    }










    /**
     * Takes the hidden messages from the preferences and rebuilds the proc tables.
     *
     * @param prefs The Push Recap preferences, or null when they are not loaded yet.
     */
    private setHiddenTexts( prefs: PushRecapPreferences | null ): void {
        this.hiddenTexts = new Set( Array.isArray( prefs?.hiddenProcTexts ) ? prefs.hiddenProcTexts : [] );
        this.buildProcs();
        if ( this.multi && this.totals != null ) {
            this.buildTotals();
        }
        this.changeDetector.markForCheck();
    }










    /**
     * Builds the proc tables of the selected fight without the hidden messages.
     */
    private buildProcs(): void {
        const procs = this.detail?.unattributed?.procs ?? [];
        const possible = this.detail?.unattributed?.possible ?? [];
        this.procRows = procs.filter( p => !this.hiddenTexts.has( p.text ) );
        this.possibleRows = possible.filter( p => !this.hiddenTexts.has( p.text ) );
        this.hiddenProcCount = procs.length - this.procRows.length;
        this.hiddenPossibleCount = possible.length - this.possibleRows.length;
    }










    /**
     * Builds the key that tells a scanned fight and a saved one apart from other fights.
     *
     * @param recap The fight to key.
     */
    private recapKey( recap: PushRecapSummary ): string {
        return `${recap.characterName}|${recap.mob}|${recap.killTime}`;
    }










    /**
     * Loads the fights the last scan found, newest first.
     */
    private loadScanResults(): void {
        this.ipcService.getPushScanResults().subscribe( results => {
            this.detailCache.clear();
            this.scanResults = ( results ?? [] ).slice().sort( ( a, b ) => b.killTime.localeCompare( a.killTime ) );
            this.applyFilters();
        } );
    }










    /**
     * Filters the list of the chosen source and keeps the selection only if it is still shown.
     */
    private applyFilters(): void {
        const mob = this.mobFilter.trim().toLowerCase();
        const items = this.source === 'scan' ? this.scanResults : this.recaps;
        this.showCharacter = this.source === 'saved' && new Set( this.recaps.map( r => r.characterName ) ).size > 1;
        this.dateOptions = Array.from( new Set( items.map( r => nightKey( r.killTime ) ) ) ).sort().reverse();
        if ( this.dateFilter !== '' && this.dateOptions.indexOf( this.dateFilter ) === -1 ) {
            this.dateFilter = '';
        }
        this.rows = items.filter( r => r.damageTaken >= this.minDamage && ( !this.namedOnly || r.named ) && ( mob === '' || r.mob.toLowerCase().indexOf( mob ) > -1 ) && ( this.dateFilter === '' || nightKey( r.killTime ) === this.dateFilter ) );
        this.applySelection();
    }

    private applySelection(): void {
        this.selection = this.rows.filter( r => this.selectedIds.has( r.id ) );
        this.selectedIds = new Set( this.selection.map( r => r.id ) );
        if ( this.anchorId != null && this.rows.every( r => r.id !== this.anchorId ) ) {
            this.anchorId = null;
        }
        this.selected = this.selection.length === 1 ? this.selection[ 0 ] : null;
        this.multi = this.selection.length > 1;
        this.totalsSubscription?.unsubscribe();
        this.totalsSubscription = null;
        if ( this.multi ) {
            this.loadDetail();
            this.loadTotals();
        } else {
            this.totals = null;
            this.totalsLoading = false;
            if ( this.selected == null || this.selected.id !== this.detail?.id || this.selected.savedAt !== this.detail?.savedAt ) {
                this.loadDetail();
            } else {
                this.changeDetector.markForCheck();
            }
        }
    }

    private cacheKey( recap: PushRecapSummary ): string {
        return `${this.source}|${recap.id}|${recap.savedAt ?? ''}`;
    }

    private loadTotals(): void {
        let missing = this.selection.filter( r => !this.detailCache.has( this.cacheKey( r ) ) );
        if ( missing.length === 0 ) {
            this.totalsLoading = false;
            this.buildTotals();
            return;
        }
        this.totals = null;
        this.totalsLoading = true;
        this.changeDetector.markForCheck();
        let requests = missing.map( r => this.source === 'scan' ? this.ipcService.getPushScanResult( r.id ) : this.ipcService.getPushRecap( r.id ) );
        this.totalsSubscription = forkJoin( requests ).subscribe( results => {
            results.forEach( ( full, i ) => full != null && this.detailCache.set( this.cacheKey( missing[ i ] ), full ) );
            this.totalsLoading = false;
            this.buildTotals();
        } );
    }

    private buildTotals(): void {
        let details = this.selection.map( r => this.detailCache.get( this.cacheKey( r ) ) ).filter( r => r != null );
        let totals = aggregateFights( details, this.hiddenTexts );
        this.totals = totals;

        let first = nightKey( totals.firstKill );
        let last = nightKey( totals.lastKill );
        let clock = ( time: string ) => time.substring( 11, 16 );
        let range = first === last ? `${first} ${clock( totals.firstKill )}\u2013${clock( totals.lastKill )}` : `${first} ${clock( totals.firstKill )} \u2013 ${last} ${clock( totals.lastKill )}`;
        this.totalsTitle = `${totals.fights} fights \u00b7 ${range} \u00b7 ${this.formatLength( totals.seconds )} of fighting`;

        let max = 0;
        totals.players.forEach( p => p.spells.forEach( s => max = Math.max( max, s.events ) ) );
        this.totalsRows = totals.players.map( p => ( {
            name: p.name,
            fights: p.fights,
            events: p.events,
            assumed: p.assumed,
            pushValue: p.pushValue,
            cells: totals.spells.map( s => {
                let count = p.spells.get( s );
                return count == null || count.events <= 0
                    ? null
                    : {
                        events: count.events,
                        assumed: count.assumed,
                        background: `rgba( 105, 240, 174, ${( 0.12 + 0.6 * count.events / max ).toFixed( 2 )} )`,
                        tooltip: this.cellTooltip( count.events, count.assumed, totals.spellPush.get( s ) ?? undefined ),
                    };
            } ),
        } ) );
        this.buildFightChart();
        this.changeDetector.markForCheck();
    }

    private buildFightChart(): void {
        this.fightBars = [];
        this.fightGrid = [];
        this.fightYTicks = [];
        this.fightXTicks = [];
        if ( this.totals == null || this.totals.perFight.length === 0 ) {
            return;
        }
        let fights = this.totals.perFight;
        let width = 1000, height = 150, left = 44, right = 8, top = 20, bottom = 30;
        let plotWidth = width - left - right;
        let plotHeight = height - top - bottom;
        let values = fights.map( f => this.totalsMeasure === 'hits' ? f.hits : f.pushValue );
        let max = Math.max( 1, ...values );
        let step = axisStep( max );
        let ceiling = Math.ceil( max / step ) * step;
        for ( let v = 0; v <= ceiling + step / 2; v += step ) {
            let y = top + plotHeight - v / ceiling * plotHeight;
            this.fightGrid.push( y );
            this.fightYTicks.push( { value: `${Math.round( v * 100 ) / 100}`, x: left - 8, y: y + 4, anchor: 'end' } );
        }
        let barWidth = plotWidth / fights.length;
        let gap = Math.min( 2, barWidth * 0.2 );
        this.fightBars = values.map( ( value, i ) => {
            let x = left + i * barWidth + gap / 2;
            let w = barWidth - gap;
            let h = value / ceiling * plotHeight;
            let y = top + plotHeight - h;
            let y0 = top + plotHeight;
            let r = Math.min( 3, w / 2, h );
            let d = h <= 0 ? '' : r > 0 ? `M${x},${y0} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y0} Z` : `M${x},${y0} V${y} H${x + w} V${y0} Z`;
            return { d: d, x: left + i * barWidth, width: barWidth };
        } );
        let clock = ( time: string ) => time.substring( 11, 16 );
        let ticks = fights.length > 1 ? [ [ 0, 'start' ], [ ( fights.length - 1 ) / 2, 'middle' ], [ fights.length - 1, 'end' ] ] : [ [ 0, 'start' ] ];
        this.fightXTicks = ticks.map( ( [ index, anchor ] ) => ( { value: clock( fights[ Math.round( index as number ) ].killTime ), x: anchor === 'start' ? left : anchor === 'end' ? width - right : left + plotWidth / 2, y: height - 10, anchor: anchor as string } ) );
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
            const request = this.source === 'scan' ? this.ipcService.getPushScanResult( this.selected.id ) : this.ipcService.getPushRecap( this.selected.id );
            this.detailSubscription = request.subscribe( recap => {
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
        this.buildProcs();

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
