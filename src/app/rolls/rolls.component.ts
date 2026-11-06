import { Component, NgZone, OnDestroy, OnInit } from '@angular/core';

export interface RollModel {
    player: string;
    roll: number;
    min: number;
    max: number;
    /** Log timestamp, in ms. */
    timestamp: number;
    status: 'counted' | 'reroll';
    note?: string;
}

export interface RankedRollModel extends RollModel {
    rank: number;
}

export interface RollContestModel {
    contestId: string;
    min: number;
    max: number;
    startedAt: number;
    lastRollAt: number;
    closedAt: number | null;
    dismissed?: boolean;
    rolls: RollModel[];
    ranked: RankedRollModel[];
}

export interface RollTrackerSettings {
    enabled: boolean;
    topCount: number;
    closeAfterSeconds: number;
    rerollRule: 'first' | 'highest';
    copyOnClose: boolean;
    speakWinner: boolean;
    speakWinnerPhrase: string;
    speakTiePhrase: string;
    /** How long a closed contest stays on the overlay; 0 keeps it there. */
    resultSeconds: number;
}

const defaultWinnerPhrase = '${winner} wins with ${roll}';
const defaultTiePhrase = 'Tie at ${roll} between ${winners}';

interface RollRow {
    rank: number | null;
    player: string;
    roll: number;
    timestamp: number;
    flagged: boolean;
    tie: boolean;
    leader: boolean;
    label: string;
    note: string;
}

@Component( {
    selector: 'app-rolls',
    templateUrl: './rolls.component.html',
    styleUrls: [ './rolls.component.scss', '../core.scss' ]
} )
export class RollsComponent implements OnInit, OnDestroy {

    public contests: RollContestModel[] = [];
    public settings: RollTrackerSettings | null = null;
    public selectedContestId: string | null = null;
    public rows: RollRow[] = [];
    public resultText: string = '';
    public now: number = Date.now();
    public placeholderHint: string = '${winner} ${winners} ${roll} ${min} ${max} ${count}';

    private clockId: number | null = null;

    public get selected(): RollContestModel | undefined {
        return this.contests.find( c => c.contestId === this.selectedContestId ) ?? this.contests[ 0 ];
    }

    constructor( private ngZone: NgZone ) { }

    ngOnInit(): void {
        window.api.ipc.on( 'rolls:state', ( event: any, state: { settings: RollTrackerSettings, contests: RollContestModel[] } ) => {
            this.ngZone.run( () => {
                this.contests = state.contests;
                this.settings = state.settings;
                this.refreshSelected();
            } );
        } );
        window.api.ipc.send( 'rolls:get', null );

        this.ngZone.runOutsideAngular( () => {
            this.clockId = window.setInterval( () => {
                if ( this.contests.some( c => c.closedAt == null ) ) {
                    this.ngZone.run( () => this.now = Date.now() );
                }
            }, 1000 );
        } );
    }

    ngOnDestroy(): void {
        this.clockId != null && window.clearInterval( this.clockId );
    }

    public selectContest( contest: RollContestModel ): void {
        this.selectedContestId = contest.contestId;
        this.refreshSelected();
    }

    public closeContest( contest: RollContestModel ): void {
        window.api.ipc.send( 'rolls:close', contest.contestId );
    }

    public copyResult( contest: RollContestModel ): void {
        window.api.ipc.send( 'rolls:copy', contest.contestId );
    }

    public updateSettings( changes: Partial<RollTrackerSettings> ): void {
        window.api.ipc.send( 'rolls:settings:set', changes );
    }

    public previewWinnerPhrase( phrase: string ): void {
        this.speakPreview( phrase, defaultWinnerPhrase );
    }

    public previewTiePhrase( phrase: string ): void {
        this.speakPreview( phrase, defaultTiePhrase );
    }

    /**
     * Returns the input value as a whole number of seconds, never negative.
     */
    public toSeconds( value: string ): number {
        return Math.max( 0, Math.round( +value || 0 ) );
    }

    public countdown( contest: RollContestModel ): string {
        const remaining = Math.max( 0, ( this.settings?.closeAfterSeconds ?? 60 ) * 1000 - ( this.now - contest.lastRollAt ) );
        const seconds = Math.ceil( remaining / 1000 );
        return `${Math.floor( seconds / 60 )}:${`${seconds % 60}`.padStart( 2, '0' )}`;
    }

    public leaderText( contest: RollContestModel ): string {
        const top = contest.ranked.filter( r => r.rank === 1 );
        if ( top.length === 0 ) {
            return 'no counted rolls';
        }
        const who = top.length > 1 ? `tie ${top.map( r => r.player ).join( ' / ' )}` : top[ 0 ].player;
        return `${contest.closedAt == null ? 'leader' : 'winner'} ${who} ${top[ 0 ].roll}`;
    }

    /**
     * Speaks the phrase with sample values, using the fallback when the phrase is blank.
     */
    private speakPreview( phrase: string | undefined, fallback: string ): void {
        const sample: Record<string, string> = { winner: 'Soandso', winners: 'Soandso, Fakename', roll: '692', min: '0', max: '1000', count: '3' };
        const text = phrase?.trim() ? phrase : fallback;
        try {
            const utterance = new SpeechSynthesisUtterance( text.replace( /\$\{(winner|winners|roll|min|max|count)\}/g, ( match, key ) => sample[ key ] ) );
            window.speechSynthesis.cancel();
            window.speechSynthesis.speak( utterance );
        } catch ( error ) {
            console.error( 'Rolls > Failed to speak the preview', error );
        }
    }

    /**
     * Builds the table rows and the result text for the selected contest.
     */
    private refreshSelected(): void {
        const contest = this.selected;
        if ( !contest ) {
            this.rows = [];
            this.resultText = '';
            return;
        }

        const isTie = ( r: RollModel ) => contest.ranked.some( o => o !== r && o.roll === r.roll );
        const counted: RollRow[] = contest.ranked.map( r => ( {
            rank: r.rank,
            player: r.player,
            roll: r.roll,
            timestamp: r.timestamp,
            flagged: false,
            tie: isTie( r ),
            leader: r.rank === 1,
            label: r.rank === 1 ? ( contest.closedAt == null ? 'Leader' : 'Winner' ) : '',
            note: '',
        } ) );
        const flagged: RollRow[] = contest.rolls.filter( r => r.status !== 'counted' ).map( r => ( {
            rank: null,
            player: r.player,
            roll: r.roll,
            timestamp: r.timestamp,
            flagged: true,
            tie: false,
            leader: false,
            label: 'Reroll ignored:',
            note: r.note ?? '',
        } ) );
        this.rows = [ ...counted, ...flagged ];

        const topCount = this.settings?.topCount ?? 4;
        const parts = contest.ranked.filter( r => r.rank <= topCount ).map( r => `${r.rank}) ${r.player} ${r.roll}${isTie( r ) ? ' TIE' : ''}` );
        this.resultText = `Rolls ${contest.min}-${contest.max} (${contest.ranked.length}): ${parts.join( '  ' )}`;
    }

}
