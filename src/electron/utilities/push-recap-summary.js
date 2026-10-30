// Common mobs have an article or a lowercase start, as in "a goblin scout" or "An orc pawn".
// Bosses are proper names such as "Soandso the Fierce".  The Push tab filters on this.
const notNamedNpcRgx = /^(?:A\s|An\s|a\s|an\s|[a-z])/;










/**
 * Builds the summary of the recap that is kept in the Push tab.
 *
 * @returns {any} The summary.
 *
 * @param {any} result The recap result.
 * @param {string} characterName The name of the character.
 */
function buildSavedSummary( result, characterName ) {
    return {
        characterName: characterName,
        mob: result.boss,
        killTime: new Date( result.killTime ).toISOString(),
        fightSeconds: result.durationSeconds,
        damageTaken: result.damageTaken,
        named: !notNamedNpcRgx.test( result.boss ),
        events: result.totalEvents,
        assumed: result.players.reduce( ( sum, p ) => sum + p.assumed, 0 ),
        pushValue: result.totalPush,
        topPusher: result.topPlayer,
        players: result.players.map( p => {
            const spells = {};
            p.spells.forEach( s => spells[ s.name ] = { events: s.confirmed + s.assumed, assumed: s.assumed, push: s.push } );
            return { name: p.name, events: p.events, assumed: p.assumed, pushValue: p.pushValue, spells: spells };
        } ),
        unattributed: {
            events: result.unattributed.events,
            pushValue: result.unattributed.pushValue,
            procs: result.unattributed.procs.map( p => ( { name: p.name, names: p.names, push: p.push, pushMin: p.pushMin, pushMax: p.pushMax, count: p.count } ) ),
            possibleEvents: result.unattributed.possibleEvents,
            possible: result.unattributed.possible.map( p => ( { name: p.name, names: p.names, push: p.push, pushMin: p.pushMin, pushMax: p.pushMax, count: p.count } ) ),
        },
        npcAbilities: result.npcAbilities.map( a => ( { actor: a.actor, name: a.name, count: a.count, push: a.push } ) ),
        othersSeen: result.othersSeen,
        startsAtLogEdge: result.startsAtLogEdge,
        reachedStart: result.reachedStart,
    };
}

module.exports = { buildSavedSummary, notNamedNpcRgx };
