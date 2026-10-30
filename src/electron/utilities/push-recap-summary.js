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
            let spells = {};
            p.spells.forEach( s => spells[ s.name ] = { events: s.confirmed + s.assumed, assumed: s.assumed, push: s.push } );
            return { name: p.name, events: p.events, assumed: p.assumed, pushValue: p.pushValue, spells: spells };
        } ),
        unattributed: {
            events: result.unattributed.events,
            pushValue: result.unattributed.pushValue,
            procs: result.unattributed.procs.map( p => ( { name: p.name, push: p.push, pushMin: p.pushMin, pushMax: p.pushMax, count: p.count } ) ),
        },
    };
}

module.exports = { buildSavedSummary, notNamedNpcRgx };
