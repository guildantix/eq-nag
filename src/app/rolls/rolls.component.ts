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
    /** The line pasted into chat, prefix included. */
    resultText: string;
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
    pastePrefix: string;
    pasteTemplate: string;
    advancedOpen: boolean;
}

export interface RollLeader {
    label: string;
    who: string;
    roll: number;
}

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
    public now: number = Date.now();
    public testRunning: boolean = false;

    private clockId: number | null = null;

    public get selected(): RollContestModel | undefined {
        return this.contests.find( c => c.contestId === this.selectedContestId ) ?? this.contests[ 0 ];
    }

    constructor( private ngZone: NgZone ) { }

    ngOnInit(): void {
        window.api.ipc.on( 'rolls:state', ( event: any, state: { settings: RollTrackerSettings, contests: RollContestModel[], testRunning: boolean } ) => {
            this.ngZone.run( () => {
                this.contests = state.contests;
                this.settings = state.settings;
                this.testRunning = state.testRunning;
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

    public removeContest( contest: RollContestModel ): void {
        window.api.ipc.send( 'rolls:remove', contest.contestId );
    }

    public clearContests(): void {
        window.api.ipc.send( 'rolls:clear', null );
    }

    public testOverlay(): void {
        window.api.ipc.send( 'rolls:test', null );
    }

    public countdown( contest: RollContestModel ): string {
        const remaining = Math.max( 0, ( this.settings?.closeAfterSeconds ?? 30 ) * 1000 - ( this.now - contest.lastRollAt ) );
        const seconds = Math.ceil( remaining / 1000 );
        return `${Math.floor( seconds / 60 )}:${`${seconds % 60}`.padStart( 2, '0' )}`;
    }

    public leader( contest: RollContestModel ): RollLeader | null {
        const top = contest.ranked.filter( r => r.rank === 1 );
        if ( top.length === 0 ) {
            return null;
        }
        const who = top.length > 1 ? `tie ${top.map( r => r.player ).join( ' / ' )}` : top[ 0 ].player;
        return { label: contest.closedAt == null ? 'leader' : 'winner', who, roll: top[ 0 ].roll };
    }

    /**
     * Builds the table rows for the selected contest.
     */
    private refreshSelected(): void {
        const contest = this.selected;
        if ( !contest ) {
            this.rows = [];
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
    }

}
