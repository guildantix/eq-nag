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

    /**
     * The contest shown in the table: the one picked, or the newest when none is picked.
     */
    public get selected(): RollContestModel | undefined {
        return this.contests.find( contest => contest.contestId === this.selectedContestId ) ?? this.contests[ 0 ];
    }

    constructor( private ngZone: NgZone ) { }

    ngOnInit(): void {
        this.listenForRollState();
        window.api.ipc.send( 'rolls:get', null );
        this.startClock();
    }

    ngOnDestroy(): void {
        if ( this.clockId !== null ) {
            window.clearInterval( this.clockId );
        }
    }










    /**
     * Keeps the contests and settings up to date with what the main process sends.
     */
    private listenForRollState(): void {
        window.api.ipc.on(
            'rolls:state',
            ( event: any, state: { settings: RollTrackerSettings, contests: RollContestModel[], testRunning: boolean } ) => {
                this.ngZone.run( () => {
                    this.contests = state.contests;
                    this.settings = state.settings;
                    this.testRunning = state.testRunning;
                    this.refreshSelected();
                } );
            }
        );
    }










    /**
     * Ticks the clock every second while a contest is open, so its countdown keeps moving.
     */
    private startClock(): void {
        this.ngZone.runOutsideAngular( () => {
            this.clockId = window.setInterval( () => {
                if ( this.contests.some( contest => contest.closedAt === null ) ) {
                    this.ngZone.run( () => this.now = Date.now() );
                }
            }, 1000 );
        } );
    }










    /**
     * Shows the given contest in the table.
     *
     * @param contest The contest to show.
     */
    public selectContest( contest: RollContestModel ): void {
        this.selectedContestId = contest.contestId;
        this.refreshSelected();
    }










    /**
     * Closes the contest now, instead of waiting for the countdown.
     *
     * @param contest The contest to close.
     */
    public closeContest( contest: RollContestModel ): void {
        window.api.ipc.send( 'rolls:close', contest.contestId );
    }










    /**
     * Copies the contest's result line to the clipboard.
     *
     * @param contest The contest to copy.
     */
    public copyResult( contest: RollContestModel ): void {
        window.api.ipc.send( 'rolls:copy', contest.contestId );
    }










    /**
     * Removes the contest from the list.
     *
     * @param contest The contest to remove.
     */
    public removeContest( contest: RollContestModel ): void {
        window.api.ipc.send( 'rolls:remove', contest.contestId );
    }










    /**
     * Removes every contest from the list.
     */
    public clearContests(): void {
        window.api.ipc.send( 'rolls:clear', null );
    }










    /**
     * Starts a made-up contest, to try the overlay without waiting for real rolls.
     */
    public testOverlay(): void {
        window.api.ipc.send( 'rolls:test', null );
    }










    /**
     * Returns the time left before the contest closes, as minutes and seconds.
     *
     * @param contest The open contest.
     * @returns The time left, like 0:25.
     */
    public countdown( contest: RollContestModel ): string {
        const remaining = Math.max( 0, ( this.settings?.closeAfterSeconds ?? 30 ) * 1000 - ( this.now - contest.lastRollAt ) );
        const seconds = Math.ceil( remaining / 1000 );
        return `${Math.floor( seconds / 60 )}:${`${seconds % 60}`.padStart( 2, '0' )}`;
    }










    /**
     * Returns who is leading the contest, or who won it once it is closed.
     *
     * @param contest The contest.
     * @returns The leader, or null when nobody has rolled yet.
     */
    public leader( contest: RollContestModel ): RollLeader | null {
        const top = contest.ranked.filter( roll => roll.rank === 1 );
        if ( top.length === 0 ) {
            return null;
        }
        const who = top.length > 1 ? `tie ${top.map( roll => roll.player ).join( ' / ' )}` : top[ 0 ].player;
        return { label: contest.closedAt === null ? 'leader' : 'winner', who, roll: top[ 0 ].roll };
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

        const isTie = ( roll: RollModel ) => contest.ranked.some( otherRoll => otherRoll !== roll && otherRoll.roll === roll.roll );
        const counted: RollRow[] = contest.ranked.map( roll => ( {
            rank: roll.rank,
            player: roll.player,
            roll: roll.roll,
            timestamp: roll.timestamp,
            flagged: false,
            tie: isTie( roll ),
            leader: roll.rank === 1,
            label: roll.rank === 1 ? ( contest.closedAt === null ? 'Leader' : 'Winner' ) : '',
            note: '',
        } ) );
        const flagged: RollRow[] = contest.rolls.filter( roll => roll.status !== 'counted' ).map( roll => ( {
            rank: null,
            player: roll.player,
            roll: roll.roll,
            timestamp: roll.timestamp,
            flagged: true,
            tie: false,
            leader: false,
            label: 'Reroll ignored:',
            note: roll.note ?? '',
        } ) );
        this.rows = [ ...counted, ...flagged ];
    }

}
