const { ipcMain, clipboard } = require( 'electron' );
const ForwardRef = require( './forward-ref' );
const UserPreferencesStore = require( './data/user-preferences' );

/** The same roll seen within this window is one roll seen in two logs (boxed characters). */
const duplicateWindowMs = 3 * 1000;
/** Closed contests kept in memory for the Rolls tab. */
const maxContestHistory = 25;
/** A contest shows on the overlay, and is copied or spoken when it closes, only once this many players have rolled. */
const minRollers = 2;
/** Spoken when a contest closes; ${...} placeholders are filled in. Used when the setting is blank. */
const defaultWinnerPhrase = '${winner} wins with ${roll}';
const defaultTiePhrase = 'Tie at ${roll} between ${winners}';

class RollTrackerSettings {
    enabled = true;
    topCount = 4;
    closeAfterSeconds = 60;
    /** @type {'first' | 'highest'} */
    rerollRule = 'first';
    copyOnClose = true;
    speakWinner = false;
    speakWinnerPhrase = defaultWinnerPhrase;
    speakTiePhrase = defaultTiePhrase;
    /** How long a closed contest stays on the overlay; 0 keeps it there. */
    resultSeconds = 10;
}

/**
 * @typedef {object} RollModel
 * @property {string} player
 * @property {number} roll
 * @property {number} min
 * @property {number} max
 * @property {number} timestamp Log timestamp, in ms.
 * @property {'counted' | 'reroll'} status
 * @property {string} [note]
 */

/**
 * @typedef {object} ContestModel
 * @property {string} contestId
 * @property {number} min
 * @property {number} max
 * @property {number} startedAt Log timestamp of the first roll, in ms.
 * @property {number} lastRollAt Wall clock time of the last roll, in ms.
 * @property {number | null} closedAt
 * @property {RollModel[]} rolls
 */

let contestCounter = 0;

/**
 * Tracks /random rolls from the log watchers and groups them into contests.
 */
class RollTracker {

    /** @type {ContestModel[]} */
    #contests = [];
    /** @type {RollModel[]} Recent rolls from every log, used to drop duplicates. */
    #recentRolls = [];
    /** @type {ForwardRef} */
    #mainWindowRef;
    /** @type {UserPreferencesStore} */
    #userPreferences;
    /** @type {(channel: string, data: any) => void} */
    #sendToRenderer;
    /** @type {(phrase: string) => void} */
    #speak;
    #timerId = null;

    /**
     * Attaches the ipc events.
     *
     * @param {ForwardRef} mainWindowRef The main window.
     * @param {UserPreferencesStore} userPreferences The user preferences.
     * @param {(channel: string, data: any) => void} sendToRenderer Sends a message to the overlay renderer.
     * @param {(phrase: string) => void} speak Speaks the given phrase.
     */
    attachIpcEvents( mainWindowRef, userPreferences, sendToRenderer, speak ) {
        this.#mainWindowRef = mainWindowRef;
        this.#userPreferences = userPreferences;
        this.#sendToRenderer = sendToRenderer;
        this.#speak = speak;

        ipcMain.on( 'rolls:roll', ( event, roll ) => this.#addRoll( roll ) );

        ipcMain.on( 'rolls:get', ( event ) => event.sender.send( 'rolls:state', this.#getState() ) );

        ipcMain.on( 'rolls:close', ( event, contestId ) => {
            const contest = this.#contests.find( c => c.contestId === contestId );
            if ( contest && contest.closedAt == null ) {
                this.#closeContest( contest );
                this.#broadcast();
            }
        } );

        ipcMain.on( 'rolls:copy', ( event, contestId ) => {
            const contest = this.#contests.find( c => c.contestId === contestId );
            if ( contest ) {
                clipboard.writeText( this.#getResultText( contest ) );
            }
        } );

        ipcMain.on( 'rolls:dismiss', ( event ) => {
            this.#contests.forEach( c => c.dismissed = c.closedAt != null ? true : c.dismissed );
            this.#broadcast();
        } );

        ipcMain.on( 'rolls:settings:set', ( event, settings ) => {
            this.#userPreferences.rollTrackerSettings = Object.assign( this.#settings, settings );
            this.#ensureTimer();
            this.#broadcast();
        } );

        ipcMain.on( 'rolls:position:set', ( event, bounds ) => {
            this.#userPreferences.rollTrackerPosition = bounds;
        } );

        ipcMain.handle( 'rolls:position:get', () => this.#userPreferences.rollTrackerPosition );
    }

    /** @type {RollTrackerSettings} */
    get #settings() {
        const stored = this.#userPreferences.rollTrackerSettings ?? {};
        const settings = Object.assign( new RollTrackerSettings(), stored );
        if ( stored.resultSeconds == null && stored.keepResult === true ) {
            settings.resultSeconds = 0;
        }
        delete settings.keepResult;
        delete settings.separateRanges;
        return settings;
    }

    /**
     * Adds a roll seen in a log file.
     *
     * @param {{player: string, roll: number, min: number, max: number, timestamp: number}} data The roll.
     */
    #addRoll( data ) {
        const settings = this.#settings;
        if ( !settings.enabled || !data?.player ) {
            return;
        }

        // Boxed characters see the same roll in each log.
        const now = Date.now();
        this.#recentRolls = this.#recentRolls.filter( r => now - r.seenAt < duplicateWindowMs );
        if ( this.#recentRolls.some( r => r.player === data.player && r.roll === data.roll && r.min === data.min && r.max === data.max && Math.abs( r.timestamp - data.timestamp ) < duplicateWindowMs ) ) {
            return;
        }
        this.#recentRolls.push( { ...data, seenAt: now } );

        /** @type {RollModel} */
        const roll = { player: data.player, roll: data.roll, min: data.min, max: data.max, timestamp: data.timestamp, status: 'counted' };
        const open = this.#contests.filter( c => c.closedAt == null );
        const sameRange = open.find( c => c.min === roll.min && c.max === roll.max );

        if ( sameRange ) {
            this.#addToContest( sameRange, roll, settings );
        } else {
            this.#startContest( roll );
        }

        this.#ensureTimer();
        this.#broadcast();
    }

    /**
     * Starts a new contest with the given roll.
     *
     * @param {RollModel} roll The first roll.
     */
    #startContest( roll ) {
        /** @type {ContestModel} */
        const contest = {
            contestId: `roll-${Date.now()}-${++contestCounter}`,
            min: roll.min,
            max: roll.max,
            startedAt: roll.timestamp,
            lastRollAt: Date.now(),
            closedAt: null,
            rolls: [ roll ],
        };
        this.#contests.unshift( contest );
        this.#contests.splice( maxContestHistory );
        return contest;
    }

    /**
     * Adds a roll in the contest's range, applying the reroll rule.
     *
     * @param {ContestModel} contest The contest.
     * @param {RollModel} roll The roll.
     * @param {RollTrackerSettings} settings The settings.
     */
    #addToContest( contest, roll, settings ) {
        contest.lastRollAt = Date.now();
        const previous = contest.rolls.find( r => r.status === 'counted' && r.player === roll.player );

        if ( previous ) {
            if ( settings.rerollRule === 'highest' && roll.roll > previous.roll ) {
                previous.status = 'reroll';
                previous.note = `replaced by a higher roll of ${roll.roll}`;
            } else {
                roll.status = 'reroll';
                roll.note = settings.rerollRule === 'highest' ?
                    `already rolled ${previous.roll}, which is higher` :
                    `already rolled ${previous.roll}; first roll counts`;
            }
        }

        contest.rolls.push( roll );
    }

    /**
     * Closes the contest, copying and speaking the result as the settings say.
     *
     * @param {ContestModel} contest The contest.
     */
    #closeContest( contest ) {
        contest.closedAt = Date.now();
        const settings = this.#settings;
        const ranked = rankRolls( contest );

        if ( ranked.length < minRollers ) {
            return;
        }

        if ( settings.copyOnClose ) {
            clipboard.writeText( this.#getResultText( contest ) );
        }

        if ( settings.speakWinner ) {
            const tied = ranked.filter( r => r.rank === 1 );
            const data = {
                winner: ranked[ 0 ].player,
                winners: tied.map( r => r.player ).join( ', ' ),
                roll: ranked[ 0 ].roll,
                min: contest.min,
                max: contest.max,
                count: ranked.length,
            };
            this.#speak( tied.length > 1 ?
                this.#formatPhrase( settings.speakTiePhrase, defaultTiePhrase, data ) :
                this.#formatPhrase( settings.speakWinnerPhrase, defaultWinnerPhrase, data ) );
        }
    }

    /**
     * Fills the placeholders in the phrase template, using the fallback when the template is blank.
     *
     * @param {string} template The phrase template.
     * @param {string} fallback The template used when the given one is blank.
     * @param {Record<string, string | number>} data The placeholder values.
     * @returns {string} Returns the phrase to speak.
     */
    #formatPhrase( template, fallback, data ) {
        const text = typeof template === 'string' && template.trim() !== '' ? template : fallback;
        return text.replace( /\$\{(winner|winners|roll|min|max|count)\}/g, ( match, key ) => `${data[ key ]}` );
    }

    /**
     * Returns the result line to paste into chat.
     *
     * @param {ContestModel} contest The contest.
     */
    #getResultText( contest ) {
        const ranked = rankRolls( contest );
        const top = ranked.filter( r => r.rank <= this.#settings.topCount );
        const ties = new Set( ranked.filter( r => ranked.some( o => o !== r && o.roll === r.roll ) ).map( r => r.player ) );
        const parts = top.map( r => `${r.rank}) ${r.player} ${r.roll}${ties.has( r.player ) ? ' TIE' : ''}` );
        return `Rolls ${contest.min}-${contest.max} (${ranked.length}): ${parts.join( '  ' )}`;
    }

    /**
     * Closes contests that have had no new rolls for closeAfterSeconds, and
     * stops the timer when nothing is left to count down.
     */
    #tick() {
        const settings = this.#settings;
        const now = Date.now();
        let changed = false;

        this.#contests.forEach( contest => {
            if ( contest.closedAt == null && now - contest.lastRollAt >= settings.closeAfterSeconds * 1000 ) {
                this.#closeContest( contest );
                changed = true;
            }
            if ( settings.resultSeconds > 0 && contest.closedAt != null && !contest.dismissed && now - contest.closedAt >= settings.resultSeconds * 1000 ) {
                contest.dismissed = true;
                changed = true;
            }
        } );

        changed && this.#broadcast();

        if ( !this.#contests.some( c => c.closedAt == null || ( !c.dismissed && settings.resultSeconds > 0 ) ) ) {
            clearInterval( this.#timerId );
            this.#timerId = null;
        }
    }

    #ensureTimer() {
        if ( this.#timerId == null ) {
            this.#timerId = setInterval( () => this.#tick(), 1000 );
        }
    }

    #getState() {
        return {
            settings: this.#settings,
            serverNow: Date.now(),
            minRollers: minRollers,
            contests: this.#contests.map( c => ( { ...c, rolls: c.rolls.slice(), ranked: rankRolls( c ) } ) ),
        };
    }

    #broadcast() {
        const state = this.#getState();
        this.#mainWindowRef?.reference?.webContents.send( 'rolls:state', state );
        this.#sendToRenderer( 'rolls:state', state );
    }

}

/**
 * Returns the counted rolls, highest first, with equal rolls sharing a rank.
 *
 * @param {ContestModel} contest The contest.
 * @returns {(RollModel & {rank: number})[]}
 */
function rankRolls( contest ) {
    const counted = contest.rolls.filter( r => r.status === 'counted' ).sort( ( a, b ) => b.roll - a.roll || a.timestamp - b.timestamp );
    return counted.map( ( r, i ) => ( { ...r, rank: counted.findIndex( o => o.roll === r.roll ) + 1 } ) );
}

module.exports = RollTracker;
module.exports.RollTrackerSettings = RollTrackerSettings;
