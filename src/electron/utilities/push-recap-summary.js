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
    let summary = {
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
            procs: result.unattributed.procs.map( p => {
                return { text: p.text, name: p.name, names: p.names, push: p.push, pushMin: p.pushMin, pushMax: p.pushMax, count: p.count };
            } ),
            possibleEvents: result.unattributed.possibleEvents,
            possible: result.unattributed.possible.map( p => {
                return {
                    text: p.text,
                    name: p.name,
                    names: p.names,
                    alsoNames: p.alsoNames,
                    alsoCount: p.alsoCount,
                    push: p.push,
                    pushMin: p.pushMin,
                    pushMax: p.pushMax,
                    count: p.count,
                };
            } ),
        },
        npcAbilities: result.npcAbilities.map( a => ( { actor: a.actor, name: a.name, count: a.count, push: a.push } ) ),
        othersSeen: result.othersSeen,
        startsAtLogEdge: result.startsAtLogEdge,
        reachedStart: result.reachedStart,
    };

    if ( Array.isArray( result.timeline ) ) {
        let texts = [];
        let textIndex = new Map();
        summary.fightStart = new Date( result.startTime ).toISOString();
        summary.timeline = result.timeline.map( e => {
            if ( e[ 1 ] < 2 ) {
                return e;
            }
            let index = textIndex.get( e[ 3 ] );
            if ( index === undefined ) {
                index = texts.push( e[ 3 ] ) - 1;
                textIndex.set( e[ 3 ], index );
            }
            return [ e[ 0 ], e[ 1 ], e[ 2 ], index, e[ 4 ] ];
        } );
        summary.timelineTexts = texts;
    }

    return summary;
}










/**
 * Builds the row of the recap list, which leaves out the players, the NPC abilities and the details
 * of the procs.
 * The procs keep their landing message and count, so the list can leave out the messages that are
 * hidden.
 *
 * @returns {any} The list row.
 *
 * @param {any} recap The saved recap.
 */
function buildListRow( recap ) {
    const { players, npcAbilities, unattributed, timeline, timelineTexts, ...row } = recap;
    const procs = ( unattributed.procs ?? [] ).filter( p => typeof p.text === 'string' && p.text !== '' ).map( p => ( { text: p.text, count: p.count } ) );
    return { ...row, unattributed: { events: unattributed.events, pushValue: unattributed.pushValue, procs: procs } };
}

module.exports = { buildSavedSummary, buildListRow, notNamedNpcRgx };
