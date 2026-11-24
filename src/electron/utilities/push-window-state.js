const { isPlayerName, isPetName } = require( './push-recap-parser' );

// The kind of a record.  A record is kept for every combat line in the window, so it holds as
// few fields as it can: on a damage record `amount` is the hit, on a slain record it is the
// damage the target had taken when it died.
const damageKind = 0;
const damageByOthersKind = 1;
const certainSlainKind = 2;
// "has been slain" of a name that can still be read as a kill.
const fallbackSlainKind = 3;
// "has been slain" of the character or a pet, which is never a kill.
const otherSlainKind = 4;
const maxInternedNames = 50000;

/**
 * The running state of the 30-minute window the log scan keeps, updated one line at a time.
 * It gives the same answers as summarize() over the whole window, without reading the window
 * again for every kill: a line adds its effects when it enters the window and takes them
 * back when it leaves, so the state always covers exactly the lines still in the window.
 */
class PushWindowState {

    /** Damage taken since the last slain line of each target, as { sum, count, startSeq }. */
    damageByTarget = new Map();

    /** How many window lines name each NPC, so a name leaves the set with its last line. */
    npcReferences = new Map();

    /** How many window lines have each player hit each target: actor to target to count. */
    pairReferences = new Map();

    /** How many window lines show spell damage from someone other than the character. */
    othersCount = 0;

    /** The "has been slain" lines in the window that can still be read as a kill, oldest first. */
    fallbacks = [];

    /** The index in the fallbacks of the oldest one still in the window. */
    fallbackHead = 0;

    /** One string per name, shared by the records of the window instead of a copy in each. */
    internedNames = new Map();










    /**
     * Tells whether spell damage by players other than the character exists in the window.
     *
     * @returns {boolean} True when such damage exists.
     */
    get othersSeen() {
        return this.othersCount > 0;
    }










    /**
     * Returns the shared copy of the given name.  Names are cut from log lines, so a copy
     * would keep its whole line alive.
     *
     * @returns {string} The shared name.
     *
     * @param {string} name The name.
     */
    internName( name ) {
        const known = this.internedNames.get( name );
        if ( known !== undefined ) {
            return known;
        }
        if ( this.internedNames.size >= maxInternedNames ) {
            this.internedNames.clear();
        }
        this.internedNames.set( name, name );
        return name;
    }










    /**
     * Describes what a combat line does to the window, read once so it can be undone later.
     *
     * @returns {any} The record to give to add() and remove().
     *
     * @param {RegExpExecArray} match The result of matching the combat line.
     * @param {string} text The text of the line, after the timestamp.
     * @param {number} seq The running number of the line, growing by one per kept line.
     */
    createRecord( match, text, seq ) {
        const target = this.internName( match.groups.target );
        if ( match.groups.damage !== undefined ) {
            const rawActor = match.groups.actor;
            const actor = this.internName( rawActor );
            const actorMine = actor === 'You' || isPetName( actor );
            const targetMine = target === 'You' || isPetName( target );
            let npcName = null;
            if ( actorMine && !targetMine ) {
                npcName = target;
            } else if ( targetMine && !actorMine ) {
                npcName = actor;
            }
            const others = text.indexOf( ' points of damage' ) === -1 && actor !== 'You' && ( isPlayerName( actor ) || isPetName( actor ) ) && target !== 'You' && !isPlayerName( target );
            return {
                kind: others ? damageByOthersKind : damageKind, seq: seq, target: target, amount: +match.groups.damage,
                npcName: npcName, pairActor: isPlayerName( actor ) ? actor : null, killer: null,
            };
        }

        const killer = this.internName( match.groups.actor ?? 'You' );
        const certain = match.groups.verb !== 'has been' && match.groups.verb !== 'have been';
        const pet = isPetName( target );
        let npcName = null;
        let kind = certainSlainKind;
        if ( certain ) {
            npcName = pet ? null : target;
        } else {
            kind = target === 'You' || pet ? otherSlainKind : fallbackSlainKind;
            if ( kind === otherSlainKind && isPlayerName( killer ) ) {
                npcName = killer;
            }
        }
        return { kind: kind, seq: seq, target: target, amount: 0, npcName: npcName, pairActor: null, killer: killer };
    }










    /**
     * Adds a line that entered the window.  A slain line also stores the damage its target
     * took in the window on the record, and starts the target's damage over.
     *
     * @param {any} record The record of the line.
     */
    add( record ) {
        if ( record.npcName !== null ) {
            this.npcReferences.set( record.npcName, ( this.npcReferences.get( record.npcName ) ?? 0 ) + 1 );
        }

        if ( record.kind >= certainSlainKind ) {
            record.amount = this.damageByTarget.get( record.target )?.sum ?? 0;
            this.damageByTarget.delete( record.target );
            if ( record.kind === fallbackSlainKind ) {
                this.fallbacks.push( record );
            }
            return;
        }

        let taken = this.damageByTarget.get( record.target );
        if ( taken === undefined ) {
            taken = { sum: 0, count: 0, startSeq: record.seq };
            this.damageByTarget.set( record.target, taken );
        }
        taken.sum += record.amount;
        taken.count++;

        if ( record.pairActor !== null ) {
            let targets = this.pairReferences.get( record.pairActor );
            if ( targets === undefined ) {
                targets = new Map();
                this.pairReferences.set( record.pairActor, targets );
            }
            targets.set( record.target, ( targets.get( record.target ) ?? 0 ) + 1 );
        }
        if ( record.kind === damageByOthersKind ) {
            this.othersCount++;
        }
    }










    /**
     * Takes back a line that left the window.  Damage from before the last slain line of its
     * target was already dropped by that slain line, so it is not taken off again.
     *
     * @param {any} record The record of the line.
     */
    remove( record ) {
        if ( record.npcName !== null ) {
            const references = this.npcReferences.get( record.npcName ) - 1;
            if ( references === 0 ) {
                this.npcReferences.delete( record.npcName );
            } else {
                this.npcReferences.set( record.npcName, references );
            }
        }

        if ( record.kind >= certainSlainKind ) {
            if ( record.kind === fallbackSlainKind ) {
                this.fallbackHead++;
                if ( this.fallbackHead > 1024 && this.fallbackHead * 2 > this.fallbacks.length ) {
                    this.fallbacks.splice( 0, this.fallbackHead );
                    this.fallbackHead = 0;
                }
            }
            return;
        }

        const taken = this.damageByTarget.get( record.target );
        if ( taken !== undefined && record.seq >= taken.startSeq ) {
            taken.sum -= record.amount;
            taken.count--;
            if ( taken.count === 0 ) {
                this.damageByTarget.delete( record.target );
            }
        }

        if ( record.pairActor !== null ) {
            const targets = this.pairReferences.get( record.pairActor );
            const references = targets.get( record.target ) - 1;
            if ( references === 0 ) {
                targets.delete( record.target );
                if ( targets.size === 0 ) {
                    this.pairReferences.delete( record.pairActor );
                }
            } else {
                targets.set( record.target, references );
            }
        }
        if ( record.kind === damageByOthersKind ) {
            this.othersCount--;
        }
    }










    /**
     * Decides whether the given slain line, the newest in the window, is read as a kill, the
     * way summarize() does, and returns the NPC names the window ends up with.
     *
     * @returns {{ isKill: boolean, npcNames: { has: function( string ): boolean } }} Whether the
     *     line is a kill, and the names known to be NPCs.
     *
     * @param {any} record The record of the newest line, already added.
     */
    resolveKill( record ) {
        // A player is someone who hit a name that is an NPC before any "has been slain" line
        // is accepted, so a name accepted below does not make the players that hit it count.
        const playerKillers = new Map();
        const isPlayerKiller = killer => {
            let known = playerKillers.get( killer );
            if ( known === undefined ) {
                known = false;
                for ( const target of this.pairReferences.get( killer )?.keys() ?? [] ) {
                    if ( this.npcReferences.has( target ) ) {
                        known = true;
                        break;
                    }
                }
                playerKillers.set( killer, known );
            }
            return known;
        };

        const accepted = new Set();
        const isNpc = name => this.npcReferences.has( name ) || accepted.has( name );
        let isKill = record.kind === certainSlainKind && record.npcName !== null;
        for ( let i = this.fallbackHead; i < this.fallbacks.length; i++ ) {
            const line = this.fallbacks[ i ];
            const playerSide = isNpc( line.target ) || line.killer === 'You' || isPetName( line.killer ) || ( isPlayerKiller( line.killer ) && !isNpc( line.killer ) );
            if ( playerSide ) {
                accepted.add( line.target );
                if ( line === record ) {
                    isKill = true;
                }
            }
        }
        return { isKill: isKill, npcNames: { has: isNpc } };
    }

}

module.exports = { PushWindowState };
