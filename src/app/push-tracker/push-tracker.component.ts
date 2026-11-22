import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field';
import { MatSliderChange } from '@angular/material/slider';
import { forkJoin, of, Subscription } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { DialogService } from '../dialogs/dialog.service';
import { IpcService } from '../ipc.service';
import { CharacterModel, PushRecapPreferences, PushRecapProc, PushRecapSummary, PushScanPickedFile, PushScanStatus, PushTabView } from '../core.model';
import { nextSortState, parseSortState, sortAriaValue, sortArrow, sortRows, TableSortState } from '../utilities/table-sort';
import { damageStepIndex, formatDamageStep, pushDamageSteps } from './push-damage-steps';
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
 * The Push tab tables that can be sorted: the fights list, and the player grids of several fights
 * and of one fight.
 */
export type PushSortTable = 'fights' | 'totals' | 'grid';










/**
 * One labelled mark under a damage slider, placed along the slider track.
 */
export interface PushSliderTick {
    label: string;
    percent: number;
}










/**
 * The damage amounts that get a label under the sliders.
 */
const sliderTickAmounts: number[] = [ 1e3, 1e6, 1e9, 1e10 ];










/**
 * Places the slider labels along a track that starts at the given step.  Labels below that step
 * are left out, so the marks match what the thumb can reach.
 *
 * @param firstIndex The first step the slider can reach.
 */
function buildSliderTicks( firstIndex: number ): PushSliderTick[] {
    const lastIndex = pushDamageSteps.length - 1;
    return sliderTickAmounts
        .map( amount => ( { label: formatDamageStep( amount ), index: damageStepIndex( amount ) } ) )
        .filter( tick => tick.index >= firstIndex )
        .map( tick => {
            const span = lastIndex - firstIndex;
            return { label: tick.label, percent: span === 0 ? 0 : ( tick.index - firstIndex ) / span * 100 };
        } );
}










/**
 * How many fights the list draws at first, and how many more each "Show more" click adds.  The
 * browser spends about 0.2 ms laying out each row, so drawing every one of up to 1,000 fights made
 * a sort or a filter change take a fifth of a second.
 */
const fightsPageSize = 100;


/**
 * How each table is sorted until the user clicks a header: newest fight first, and the players who
 * pushed most first.
 */
const defaultPushSorts: { [ table: string ]: TableSortState } = {
    fights: { key: 'time', direction: 'desc' },
    totals: { key: 'hits', direction: 'desc' },
    grid: { key: 'hits', direction: 'desc' },
};










/**
 * The column keys of the fights list.
 */
const fightSortKeys: string[] = [ 'time', 'character', 'mob', 'length', 'damage', 'hits', 'push', 'procs', 'top' ];










/**
 * The fixed column keys of the player grids.  A spell column has the key "spell:" plus its name.
 */
const playerSortKeys: string[] = [ 'name', 'fights', 'hits', 'push' ];










/**
 * The column keys that hold text, which sort A to Z first.
 */
const textSortKeys: string[] = [ 'character', 'mob', 'top', 'name' ];










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

    public readonly lastDamageStepIndex: number = pushDamageSteps.length - 1;
    public readonly minDamageSliderTicks: PushSliderTick[] = buildSliderTicks( 0 );

    public source: 'saved' | 'scan' | 'file' = 'saved';
    public characters: CharacterModel[] = [];
    public scanCharacterId: string | null = null;
    public scanStatus: PushScanStatus | null = null;
    public scanResults: PushRecapSummary[] = [];
    public scanStartMessage: string = '';
    public pickedFileName: string = '';
    public pickedFileReady: boolean = false;
    public pickedFileId: number | null = null;
    public pickedFileMessage: string = '';
    public savedKeys: Set<string> = new Set<string>();

    public minDamage: number = 1000;
    public sorts: { [ table: string ]: TableSortState } = {
        fights: { ...defaultPushSorts.fights },
        totals: { ...defaultPushSorts.totals },
        grid: { ...defaultPushSorts.grid },
    };
    public namedOnly: boolean = false;
    public mobFilter: string = '';

    public loaded: boolean = false;
    public recaps: PushRecapSummary[] = [];
    public rows: PushRecapSummary[] = [];
    public shownRows: PushRecapSummary[] = [];
    public shownLimit: number = fightsPageSize;
    public showCharacter: boolean = false;
    public selected: PushRecapSummary | null = null;
    public selection: PushRecapSummary[] = [];
    public selectedIds: Set<string> = new Set<string>();
    public multi: boolean = false;
    public dateFilter: string = '';
    public dateOptions: string[] = [];
    public totals: PushTotals | null = null;
    public totalsLoading: boolean = false;
    public totalsNote: string = '';
    public totalsTitle: string = '';
    public totalsMeasure: 'hits' | 'push' = 'hits';
    public totalsRows: PushTotalsRow[] = [];
    public totalsRowsUnsorted: PushTotalsRow[] = [];
    public fightBars: PushFightBar[] = [];
    public fightGrid: number[] = [];
    public fightYTicks: PushChartTick[] = [];
    public fightXTicks: PushChartTick[] = [];
    public fightTip: { x: number, y: number, title: string, value: string } | null = null;
    public detail: PushRecapSummary | null = null;
    public gridSpells: string[] = [];
    public gridSpellPush: Map<string, number | null> = new Map<string, number | null>();
    public gridRows: PushGridRow[] = [];
    public gridRowsUnsorted: PushGridRow[] = [];
    public hiddenTexts: Set<string> = new Set<string>();
    public procRows: PushRecapProc[] = [];
    public possibleRows: PushRecapProc[] = [];
    public hiddenProcCount: number = 0;
    public hiddenPossibleCount: number = 0;

    private subscription: Subscription = new Subscription();
    private detailSubscription: Subscription | null = null;
    private totalsSubscription: Subscription | null = null;
    private detailCache: Map<string, PushRecapSummary> = new Map<string, PushRecapSummary>();
    private detailStale = false;
    private anchorId: string | null = null;
    private saveViewTimer: ReturnType<typeof setTimeout> | null = null;

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
        this.ipcService.getPushRecapPreferences().subscribe( prefs => {
            this.setHiddenTexts( prefs );
            this.restoreView( prefs?.tabView );
        } );
        this.load();
        this.ipcService.getCharacters().subscribe( characters => {
            this.characters = characters.filter( c => c.logFile );
            this.scanCharacterId = this.scanCharacterId ?? this.characters[ 0 ]?.characterId ?? null;
            this.changeDetector.markForCheck();
        } );
        this.ipcService.getPushScanStatus().subscribe( status => {
            this.scanStatus = status;
            if ( status.status !== 'idle' ) {
                // A file scan has no character; keep the selected one for "Scan a log".
                if ( status.characterId !== null && status.characterId !== undefined ) {
                    this.scanCharacterId = status.characterId;
                }
                if ( status.logFileName !== null && status.logFileName !== undefined ) {
                    this.pickedFileName = status.logFileName;
                    this.pickedFileId = status.pickId ?? null;
                    this.pickedFileReady = true;
                }
                this.source = status.status === 'running' ? ( ( status.logFileName !== null && status.logFileName !== undefined ) ? 'file' : 'scan' ) : this.source;
                this.loadScanResults();
            }
        } );
    }










    ngOnDestroy(): void {
        if ( this.saveViewTimer !== null ) {
            clearTimeout( this.saveViewTimer );
            this.saveViewTimer = null;
            this.writeView();
        }
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
     * How many more fights the "Show more" button adds: a full page, or what is left of the list.
     */
    public get nextPageCount(): number {
        return Math.min( fightsPageSize, this.rows.length - this.shownRows.length );
    }










    /**
     * The message under the scan controls: why the scan did not start or stop, or what it found.
     */
    public get scanNotice(): string {
        const status = this.scanStatus;
        if ( this.source === 'file' && this.pickedFileMessage !== '' ) {
            return this.pickedFileMessage;
        }
        if ( this.scanStartMessage !== '' ) {
            return this.scanStartMessage;
        }
        if ( ( status === null || status === undefined ) || status.status === 'idle' || status.status === 'running' || !this.scanMatchesSource ) {
            return '';
        }
        if ( status.status !== 'done' || status.message !== '' ) {
            return status.message;
        }
        const seconds = Math.max( 1, Math.round( status.elapsedMs / 1000 ) );
        return `${status.kills} ${status.kills === 1 ? 'fight' : 'fights'} \u00b7 ${this.formatLength( seconds )}${status.resumed ? ' \u00b7 continued the last scan of this log' : ''}${status.capped ? '.  Only the newest 1,000 are listed.' : ''}`;
    }










    /**
     * True when the scan notice is a problem, so it can be shown in the error color.
     */
    public get scanFailed(): boolean {
        return this.scanStartMessage !== '' || ( this.source === 'file' && this.pickedFileMessage !== '' )
            || ( this.scanMatchesSource && this.scanStatus?.status === 'error' );
    }










    /**
     * True when the last scan belongs to the chosen Source: the same character's log for "Scan a
     * log", or the same picked file for "Scan another log file".  Otherwise its fights and status
     * are not shown, so one source never lists another's results.
     */
    public get scanMatchesSource(): boolean {
        const status = this.scanStatus;
        if ( status === null || status === undefined || status.status === 'idle' ) {
            return false;
        }
        const scannedFile = status.logFileName !== null && status.logFileName !== undefined;
        if ( this.source === 'file' ) {
            return scannedFile && status.pickId === this.pickedFileId;
        }
        return !scannedFile && status.characterId === this.scanCharacterId;
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
        this.scanStartMessage = '';
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
     * Follows the Show slider and filters the list right away.
     *
     * @param event The slider change, whose value is the position in the damage steps.
     */
    public onMinDamageSlide( event: MatSliderChange ): void {
        this.minDamage = pushDamageSteps[ event.value ?? 0 ];
        this.applyFilters();
    }










    /**
     * Gives the slider position of a damage amount.
     *
     * @param damage The damage amount.
     */
    public stepIndex( damage: number ): number {
        return damageStepIndex( damage );
    }










    /**
     * Writes a damage amount the short way for the slider readout, for example 2.5M.
     *
     * @param damage The damage amount.
     */
    public stepLabel( damage: number ): string {
        return formatDamageStep( damage );
    }










    /**
     * True when the list shows the fights of a scan, of a character's log or of a picked file.
     */
    public get isScanSource(): boolean {
        return this.source !== 'saved';
    }










    /**
     * True when the Scan button can start: a character is chosen, or a valid log file is picked.
     */
    public get canScan(): boolean {
        if ( this.scanRunning ) {
            return false;
        }
        if ( this.source === 'file' ) {
            return this.pickedFileReady;
        }
        return this.scanCharacterId !== null && this.scanCharacterId !== undefined;
    }










    /**
     * Returns the sort a table uses now.  A sort on a spell column that the table does not show
     * goes back to the default, so the order never depends on a column the user can't see.
     *
     * @param table The table.
     */
    public activeSort( table: PushSortTable ): TableSortState {
        const state = this.sorts[ table ];
        if ( table === 'fights' || state.key.indexOf( 'spell:' ) !== 0 ) {
            return state;
        }
        const spells = table === 'totals' ? ( this.totals?.spells ?? [] ) : this.gridSpells;
        return spells.indexOf( state.key.substring( 'spell:'.length ) ) > -1 ? state : defaultPushSorts[ table ];
    }










    /**
     * Sorts a table by the clicked header, or reverses it when that column is already sorted, and
     * remembers the choice.  The selected fights stay selected.
     *
     * @param table The table whose header was clicked.
     * @param key The column key.
     */
    public sortBy( table: PushSortTable, key: string ): void {
        this.sorts[ table ] = nextSortState( this.activeSort( table ), key, textSortKeys.indexOf( key ) > -1 );
        this.sortTable( table );
        this.saveView();
        this.changeDetector.markForCheck();
    }










    /**
     * Returns the aria-sort value of a column header.
     *
     * @param table The table.
     * @param key The column key.
     */
    public sortAria( table: PushSortTable, key: string ): 'ascending' | 'descending' | 'none' {
        return sortAriaValue( this.activeSort( table ), key );
    }










    /**
     * Returns the arrow of a column header: empty unless the table is sorted by that column.
     *
     * @param table The table.
     * @param key The column key.
     */
    public sortArrow( table: PushSortTable, key: string ): string {
        return sortArrow( this.activeSort( table ), key );
    }










    /**
     * Remembers the two damage sliders and the table sorts for the next session.  Saves are
     * batched, because each keyboard step on a slider would otherwise rewrite the settings file.
     */
    public saveView(): void {
        if ( this.saveViewTimer !== null ) {
            clearTimeout( this.saveViewTimer );
        }
        this.saveViewTimer = setTimeout( () => {
            this.saveViewTimer = null;
            this.writeView();
        }, 500 );
    }










    /**
     * Sends the Show slider and the table sorts to the settings file.
     */
    public writeView(): void {
        const view: PushTabView = {
            minDamage: this.minDamage,
            sorts: { fights: this.sorts.fights, totals: this.sorts.totals, grid: this.sorts.grid },
        };
        this.ipcService.setPushTabView( view );
    }










    /**
     * Starts scanning the chosen character's log for boss kills, and shows why it could not start.
     */
    public startScan(): void {
        if ( !this.canScan ) {
            return;
        }
        this.scanStartMessage = '';
        // Every fight is analysed; the Show slider narrows the list, so no rescan is needed.
        this.ipcService.startPushScan( this.scanCharacterId, 1, this.source === 'file' ).subscribe( reply => {
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
     * Opens the file dialog of the main process.  The window only learns the file name and whether
     * the file can be scanned, never its path.
     */
    public pickLogFile(): void {
        this.ipcService.pickPushScanFile().subscribe( ( picked: PushScanPickedFile ) => {
            if ( !picked.cancelled ) {
                this.pickedFileReady = picked.picked;
                this.pickedFileName = picked.picked ? picked.fileName : '';
                this.pickedFileId = picked.picked ? picked.pickId : null;
                this.pickedFileMessage = picked.message;
                this.scanStartMessage = '';
            }
            // A cancelled pick changes nothing, so the drawn rows stay as they were.
            this.applyFilters( picked.cancelled );
            this.changeDetector.markForCheck();
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










    /**
     * Picks the clicked row, or adds it with Ctrl, or extends the selection to it with Shift, and
     * scrolls it into view.
     *
     * @param recap The recap that was clicked.
     * @param event The click event, for the modifier keys and the row.
     */
    public select( recap: PushRecapSummary, event: MouseEvent ): void {
        const row = event.currentTarget as HTMLElement;
        const anchor = this.rows.findIndex( r => r.id === this.anchorId );
        if ( event.ctrlKey || event.metaKey ) {
            if ( this.selectedIds.has( recap.id ) ) {
                this.selectedIds.delete( recap.id );
            } else {
                this.selectedIds.add( recap.id );
            }
            this.anchorId = recap.id;
        } else if ( event.shiftKey && anchor > -1 ) {
            const to = this.rows.indexOf( recap );
            this.selectedIds = new Set( this.rows.slice( Math.min( anchor, to ), Math.max( anchor, to ) + 1 ).map( r => r.id ) );
        } else {
            this.selectedIds = new Set<string>( [ recap.id ] );
            this.anchorId = recap.id;
        }
        this.applySelection();
        setTimeout( () => row.scrollIntoView( { block: 'nearest' } ) );
    }










    /**
     * Selects every fight in the list, for the totals of all of them.
     */
    public selectAllShown(): void {
        this.selectedIds = new Set( this.rows.map( r => r.id ) );
        this.anchorId = this.rows[ 0 ]?.id ?? null;
        this.applySelection();
    }










    /**
     * Draws the next page of fights under the ones already in the table.
     */
    public showMoreFights(): void {
        this.shownLimit += fightsPageSize;
        this.updateShownRows();
        this.changeDetector.markForCheck();
    }










    /**
     * Closes the docked details panel and drops the selection.
     */
    public closeDetails(): void {
        this.selectedIds = new Set<string>();
        this.applySelection();
    }










    /**
     * Narrows the selection to one fight, from the fights chart of the totals.
     *
     * @param id The fight id.
     */
    public selectFight( id: string ): void {
        this.selectedIds = new Set<string>( [ id ] );
        this.anchorId = id;
        this.applySelection();
    }










    /**
     * Switches the bars of the fights chart between hits and push.
     *
     * @param measure The new measure.
     */
    public setTotalsMeasure( measure: 'hits' | 'push' ): void {
        this.totalsMeasure = measure;
        this.buildFightChart();
        this.changeDetector.markForCheck();
    }










    /**
     * Shows the tooltip of one bar in the fights chart next to the mouse.
     *
     * @param event The mouse event, for the tooltip position.
     * @param index The bar under the mouse.
     */
    public showFightTip( event: MouseEvent, index: number ): void {
        const fight = this.totals.perFight[ index ];
        const value = this.totalsMeasure === 'hits' ? fight.hits : fight.pushValue;
        this.fightTip = {
            x: Math.min( event.clientX + 14, window.innerWidth - 240 ),
            y: event.clientY + 14,
            title: `${fight.mob} \u00b7 ${fight.killTime.substring( 11, 16 )}`,
            value: `${value} ${this.totalsMeasure === 'hits' ? 'push hits' : 'push'}`,
        };
    }










    /**
     * Hides the fights chart tooltip when the mouse leaves a bar.
     */
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
        if ( this.multi && this.totals !== null && this.totals !== undefined ) {
            const first = nightKey( this.totals.firstKill );
            const last = nightKey( this.totals.lastKill );
            this.ipcService.sendTextToClipboard( describeTotals( this.totals, first === last ? first : `${first} to ${last}`, this.formatLength( this.totals.seconds ) ) );
            return;
        }
        const recap = this.detail;
        if ( recap === null || recap === undefined ) {
            return;
        }
        const lines = [
            `Push Recap - ${recap.mob}, killed ${this.formatTime( recap )}, fight ${this.formatLength( recap.fightSeconds )}`,
            `${recap.events} push ${recap.events === 1 ? 'hit' : 'hits'}, ${recap.players.length} ${recap.players.length === 1 ? 'player' : 'players'} pushing`,
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
        // A scanned fight can lack its length, and a blank dash reads better than "undefineds".
        if ( !Number.isFinite( seconds ) ) {
            return '\u2013';
        }
        return seconds >= 60 ? `${Math.floor( seconds / 60 )}m ${Math.round( seconds % 60 )}s` : `${seconds}s`;
    }










    /**
     * Shortens a damage number with K, M or B so it fits a narrow column.
     *
     * @param value The damage.
     */
    public formatDamage( value: number ): string {
        if ( !Number.isFinite( value ) ) {
            return '\u2013';
        }
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
            this.detailStale = this.detailStale || this.source === 'saved';
            this.loaded = true;
            this.applyFilters( true );
        } );
    }










    /**
     * Takes the remembered sliders and sorts, dropping any that are no longer valid.
     *
     * @param view The stored view, or null when nothing was saved yet.
     */
    private restoreView( view: PushTabView | null | undefined ): void {
        if ( view === null || view === undefined ) {
            return;
        }
        // A hand-edited settings file can hold anything; non-numbers keep the defaults.
        if ( typeof view.minDamage === 'number' && Number.isFinite( view.minDamage ) ) {
            this.minDamage = pushDamageSteps[ damageStepIndex( view.minDamage ) ];
        }
        const isPlayerKey = ( key: string ) => playerSortKeys.indexOf( key ) > -1 || key.indexOf( 'spell:' ) === 0;
        this.sorts.fights = parseSortState( view.sorts?.fights, key => fightSortKeys.indexOf( key ) > -1, defaultPushSorts.fights );
        this.sorts.totals = parseSortState( view.sorts?.totals, isPlayerKey, defaultPushSorts.totals );
        this.sorts.grid = parseSortState( view.sorts?.grid, key => key !== 'fights' && isPlayerKey( key ), defaultPushSorts.grid );
        this.applyFilters();
        this.sortTable( 'totals' );
        this.sortTable( 'grid' );
    }










    /**
     * Puts a table's rows in the order of its sort.
     *
     * @param table The table.
     */
    private sortTable( table: PushSortTable ): void {
        if ( table === 'fights' ) {
            this.rows = this.sortFights( this.rows );
            this.shownLimit = fightsPageSize;
            this.updateShownRows();
        } else if ( table === 'totals' ) {
            this.totalsRows = this.sortPlayers( this.totalsRowsUnsorted, table, this.totals?.spells ?? [] );
        } else {
            this.gridRows = this.sortPlayers( this.gridRowsUnsorted, table, this.gridSpells );
        }
    }










    /**
     * Sorts fights by the sort of the fights list.
     *
     * @param fights The fights to sort.
     */
    private sortFights( fights: PushRecapSummary[] ): PushRecapSummary[] {
        return sortRows( fights, this.activeSort( 'fights' ), ( recap, key ) => this.fightSortValue( recap, key ) );
    }










    /**
     * Reads the value of a fights list column.
     *
     * @param recap The fight.
     * @param key The column key.
     */
    private fightSortValue( recap: PushRecapSummary, key: string ): string | number {
        if ( key === 'time' ) {
            return recap.killTime;
        } else if ( key === 'character' ) {
            return recap.characterName ?? '';
        } else if ( key === 'mob' ) {
            return recap.mob;
        } else if ( key === 'length' ) {
            return recap.fightSeconds;
        } else if ( key === 'damage' ) {
            return recap.damageTaken;
        } else if ( key === 'hits' ) {
            return recap.events;
        } else if ( key === 'push' ) {
            return recap.pushValue;
        } else if ( key === 'procs' ) {
            return this.procCount( recap );
        } else if ( key === 'top' ) {
            return recap.topPusher ?? '';
        }
        return 0;
    }










    /**
     * Sorts the player rows of a grid by the sort of that grid.  Players with equal values stay in
     * name order.
     *
     * @param rows The rows to sort.
     * @param table The grid the rows belong to.
     * @param spells The spell columns of the grid, to find the cell of a spell column.
     */
    private sortPlayers<T extends PushGridRow>( rows: T[], table: PushSortTable, spells: string[] ): T[] {
        const valueOf = ( row: PushGridRow, key: string ) => this.playerSortValue( row, key, spells );
        return sortRows<T>( rows, this.activeSort( table ), valueOf, ( a, b ) => a.name.localeCompare( b.name ) );
    }










    /**
     * Reads the value of a player grid column.
     *
     * @param row The player row.
     * @param key The column key.
     * @param spells The spell columns of the grid.
     */
    private playerSortValue( row: PushGridRow, key: string, spells: string[] ): string | number {
        if ( key === 'name' ) {
            return row.name;
        } else if ( key === 'fights' ) {
            return ( row as PushTotalsRow ).fights ?? 0;
        } else if ( key === 'hits' ) {
            return row.events;
        } else if ( key === 'push' ) {
            return row.pushValue;
        } else if ( key.indexOf( 'spell:' ) === 0 ) {
            const index = spells.indexOf( key.substring( 'spell:'.length ) );
            return index > -1 ? ( row.cells[ index ]?.events ?? 0 ) : 0;
        }
        return 0;
    }










    /**
     * Takes the hidden messages from the preferences and rebuilds the proc tables.
     *
     * @param prefs The Push Recap preferences, or null when they are not loaded yet.
     */
    private setHiddenTexts( prefs: PushRecapPreferences | null ): void {
        this.hiddenTexts = new Set( Array.isArray( prefs?.hiddenProcTexts ) ? prefs.hiddenProcTexts : [] );
        this.buildProcs();
        if ( this.multi && this.totals !== null && this.totals !== undefined ) {
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
     *
     * @param keepShownLimit True when only the saved recaps were refreshed, so a list the user has
     *     already extended is not cut back to the first page.
     */
    private applyFilters( keepShownLimit: boolean = false ): void {
        const mob = this.mobFilter.trim().toLowerCase();
        const items = this.isScanSource ? ( this.scanMatchesSource ? this.scanResults : [] ) : this.recaps;
        this.showCharacter = this.source === 'saved' && new Set( this.recaps.map( r => r.characterName ) ).size > 1;
        this.dateOptions = Array.from( new Set( items.map( r => nightKey( r.killTime ) ) ) ).sort().reverse();
        if ( this.dateFilter !== '' && this.dateOptions.indexOf( this.dateFilter ) === -1 ) {
            this.dateFilter = '';
        }
        const filtered = items.filter( r => r.damageTaken >= this.minDamage && ( !this.namedOnly || r.named ) && ( mob === '' || r.mob.toLowerCase().indexOf( mob ) > -1 ) && ( this.dateFilter === '' || nightKey( r.killTime ) === this.dateFilter ) );
        this.rows = this.sortFights( filtered );
        if ( !keepShownLimit ) {
            this.shownLimit = fightsPageSize;
        }
        this.updateShownRows();
        this.applySelection();
    }










    /**
     * Cuts the filtered and sorted fights down to the ones the table draws.  The selection, the
     * totals and "Select all shown" still use every fight that passes the filters.
     */
    private updateShownRows(): void {
        this.shownRows = this.rows.length > this.shownLimit ? this.rows.slice( 0, this.shownLimit ) : this.rows;
    }










    /**
     * Applies the selected rows: totals for several fights, details for one, nothing for none.
     */
    private applySelection(): void {
        this.selection = this.rows.filter( r => this.selectedIds.has( r.id ) );
        this.selectedIds = new Set( this.selection.map( r => r.id ) );
        if ( this.anchorId !== null && this.anchorId !== undefined && this.rows.every( r => r.id !== this.anchorId ) ) {
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
            const noSelection = this.selected === null || this.selected === undefined;
            const otherDetail = noSelection || this.selected.id !== this.detail?.id || this.selected.savedAt !== this.detail?.savedAt;
            if ( this.detailStale || otherDetail ) {
                this.loadDetail();
            } else {
                this.changeDetector.markForCheck();
            }
        }
    }










    /**
     * Builds the key under which the full recap of a fight is cached.  The save date is part of it
     * so a refreshed recap is fetched again.
     *
     * @param recap The fight to key.
     */
    private cacheKey( recap: PushRecapSummary ): string {
        return `${this.source}|${recap.id}|${recap.savedAt ?? ''}`;
    }










    /**
     * Fetches the fights of the selection that are not cached yet, then builds the totals.  A fight
     * that cannot be loaded is skipped.
     */
    private loadTotals(): void {
        const missing = this.selection.filter( r => !this.detailCache.has( this.cacheKey( r ) ) );
        if ( missing.length === 0 ) {
            this.totalsLoading = false;
            this.buildTotals();
            return;
        }
        this.totals = null;
        this.totalsLoading = true;
        this.changeDetector.markForCheck();
        const requests = missing.map( r => {
            const request = this.isScanSource ? this.ipcService.getPushScanResult( r.id ) : this.ipcService.getPushRecap( r.id );
            return request.pipe( catchError( () => of( null ) ) );
        } );
        this.totalsSubscription = forkJoin( requests ).subscribe( results => {
            results.forEach( ( full, i ) => {
                if ( full !== null && full !== undefined ) {
                    this.detailCache.set( this.cacheKey( missing[ i ] ), full );
                }
            } );
            this.totalsLoading = false;
            this.buildTotals();
        } );
    }










    /**
     * Adds up the loaded fights of the selection and prepares the tiles, the player grid and the
     * fights chart.
     */
    private buildTotals(): void {
        const cached = this.selection.map( r => this.detailCache.get( this.cacheKey( r ) ) );
        const details = cached.filter( r => r !== null && r !== undefined );
        const totals = aggregateFights( details, this.hiddenTexts );
        this.totals = totals;
        this.totalsNote = details.length < this.selection.length ? 'Some fights could not be loaded.' : '';

        const first = nightKey( totals.firstKill );
        const last = nightKey( totals.lastKill );
        const clock = ( time: string ) => time.substring( 11, 16 );
        const range = first === last ? `${first} ${clock( totals.firstKill )}\u2013${clock( totals.lastKill )}` : `${first} ${clock( totals.firstKill )} \u2013 ${last} ${clock( totals.lastKill )}`;
        this.totalsTitle = `${totals.fights} fights \u00b7 ${range} \u00b7 ${this.formatLength( totals.seconds )} of fighting`;

        let max = 0;
        totals.players.forEach( p => p.spells.forEach( s => max = Math.max( max, s.events ) ) );
        this.totalsRowsUnsorted = totals.players.map( p => ( {
            name: p.name,
            fights: p.fights,
            events: p.events,
            assumed: p.assumed,
            pushValue: p.pushValue,
            cells: totals.spells.map( s => {
                const count = p.spells.get( s );
                return ( count === null || count === undefined ) || count.events <= 0
                    ? null
                    : {
                        events: count.events,
                        assumed: count.assumed,
                        background: `rgba( 105, 240, 174, ${( 0.12 + 0.6 * count.events / max ).toFixed( 2 )} )`,
                        tooltip: this.cellTooltip( count.events, count.assumed, totals.spellPush.get( s ) ?? undefined ),
                    };
            } ),
        } ) );
        this.totalsRows = this.sortPlayers( this.totalsRowsUnsorted, 'totals', totals.spells );
        this.buildFightChart();
        this.changeDetector.markForCheck();
    }










    /**
     * Builds the bars of the fights chart from the totals.
     */
    private buildFightChart(): void {
        this.fightBars = [];
        this.fightGrid = [];
        this.fightYTicks = [];
        this.fightXTicks = [];
        if ( ( this.totals === null || this.totals === undefined ) || this.totals.perFight.length === 0 ) {
            return;
        }
        const fights = this.totals.perFight;
        const width = 1000, height = 150, left = 44, right = 8, top = 20, bottom = 30;
        const plotWidth = width - left - right;
        const plotHeight = height - top - bottom;
        const values = fights.map( f => this.totalsMeasure === 'hits' ? f.hits : f.pushValue );
        const max = Math.max( 1, ...values );
        const step = axisStep( max );
        const ceiling = Math.ceil( max / step ) * step;
        for ( let v = 0; v <= ceiling + step / 2; v += step ) {
            const y = top + plotHeight - v / ceiling * plotHeight;
            this.fightGrid.push( y );
            this.fightYTicks.push( { value: `${Math.round( v * 100 ) / 100}`, x: left - 8, y: y + 4, anchor: 'end' } );
        }
        const barWidth = plotWidth / fights.length;
        const gap = Math.min( 2, barWidth * 0.2 );
        this.fightBars = values.map( ( value, i ) => {
            const x = left + i * barWidth + gap / 2;
            const w = barWidth - gap;
            const h = value / ceiling * plotHeight;
            const y = top + plotHeight - h;
            const y0 = top + plotHeight;
            const r = Math.min( 3, w / 2, h );
            const d = h <= 0 ? '' : r > 0 ? `M${x},${y0} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y0} Z` : `M${x},${y0} V${y} H${x + w} V${y0} Z`;
            return { d: d, x: left + i * barWidth, width: barWidth };
        } );
        const clock = ( time: string ) => time.substring( 11, 16 );
        const ticks = fights.length > 1 ? [ [ 0, 'start' ], [ ( fights.length - 1 ) / 2, 'middle' ], [ fights.length - 1, 'end' ] ] : [ [ 0, 'start' ] ];
        this.fightXTicks = ticks.map( ( [ index, anchor ] ) => ( { value: clock( fights[ Math.round( index as number ) ].killTime ), x: anchor === 'start' ? left : anchor === 'end' ? width - right : left + plotWidth / 2, y: height - 10, anchor: anchor as string } ) );
    }










    /**
     * Fetches the full recap for the selection, dropping an older request that has
     * not returned.
     */
    private loadDetail(): void {
        this.detailStale = false;
        this.detailSubscription?.unsubscribe();
        this.detailSubscription = null;
        this.detail = null;
        this.buildGrid();
        if ( this.selected !== null && this.selected !== undefined ) {
            const request = this.isScanSource
                ? this.ipcService.getPushScanResult( this.selected.id )
                : this.ipcService.getPushRecap( this.selected.id );
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
        this.gridRowsUnsorted = [];
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

            this.gridRowsUnsorted = recap.players.map( p => ( {
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
            this.gridRows = this.sortPlayers( this.gridRowsUnsorted, 'grid', this.gridSpells );
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
            ? `${events} ${events === 1 ? 'hit' : 'hits'}`
            : `${events} ${events === 1 ? 'hit' : 'hits'} \u00d7 ${push} push = ${Math.round( events * push * 100 ) / 100} push`;
        return assumed > 0 ? `${text}, ${assumed} assumed` : text;
    }

}
