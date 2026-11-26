const { whoLineRegex, heroesJourneyWhoLineRegex, eqClassTitleMap, getEverQuestClassName, getEverQuestClassFromTitle,
    getEverQuestClassAbbreviation } = require( './everquest' );










/**
 * The plain class names, taken from the title map entries whose title is the class name itself
 * (the map also holds the rank titles, which an equipment set message never uses). Reusing the
 * map keeps one list of class names, spelled "Shadow Knight" as the game writes it.
 */
const classNameAlternation = Object.keys( eqClassTitleMap )
    .filter( className => eqClassTitleMap[ className ] === className )
    .join( '|' );










// Anchored at the start of the line (the timestamp is already removed) so chat that merely quotes
// the phrase doesn't match.  The class name is the character's current class.
// Matches: You successfully loaded your Monk equipment set.
// Matches: You loaded only part of your Monk equipment set. At least one item was not found.
const equipmentSetLoadedRegex = new RegExp( `^You (?:successfully loaded|loaded only part of) your (?<className>${classNameAlternation}) equipment set\.` );

// Matches: Your Shadow Knight equipment set has been saved.
const equipmentSetSavedRegex = new RegExp( `^Your (?<className>${classNameAlternation}) equipment set has been saved\.` );

// The set named in the message is the wrong one, the class after "currently" is the real one.
// Matches: You cannot load your Cleric equipment set because you are currently a Monk.
// Matches: You cannot load your Cleric equipment set because you are currently an Enchanter.
const equipmentSetRefusedRegex = new RegExp( `^You cannot (?:load|save) your (?:${classNameAlternation}) equipment set because you are currently an? (?<className>${classNameAlternation})\.` );

const equipmentSetRegexes = [ equipmentSetLoadedRegex, equipmentSetSavedRegex, equipmentSetRefusedRegex ];










/**
 * Returns the class code of the persona the player just swapped to, or null when the line is
 * not an equipment set message for a class. Runs for every log line, so it checks two cheap
 * substrings before it tries the regexes.
 *
 * @param {string} logLine The log line, without its timestamp.
 * @returns {string|null} The class code, such as 'SHM', or null.
 */
function detectPersonaClassCode( logLine ) {
    // "You" also covers "Your".
    if ( !logLine.startsWith( 'You' ) || !logLine.includes( ' equipment set' ) ) {
        return null;
    }

    for ( const equipmentSetRegex of equipmentSetRegexes ) {
        const match = equipmentSetRegex.exec( logLine );
        if ( match !== null ) {
            return getEverQuestClassAbbreviation( match.groups.className );
        }
    }

    return null;
}










/**
 * Returns the class code from the character's own /who line, or null when the line is anyone
 * else's or not a /who line. Uses the combat parser's patterns, so both read a /who line the same
 * way, and checks the first character before the regex because it runs for every log line.
 *
 * @param {string} logLine The log line, without its timestamp.
 * @param {string} characterName The name of the character whose log this is.
 * @param {boolean} isHeroesJourney True for a Heroes' Journey character, whose /who format
 *        differs.
 * @returns {string|null} The class code, such as 'SHM', or null.
 */
function detectOwnWhoClassCode( logLine, characterName, isHeroesJourney ) {
    if ( !logLine.startsWith( '[' ) && !logLine.startsWith( 'OFFLINEMODE[' ) ) {
        return null;
    }

    const match = ( isHeroesJourney ? heroesJourneyWhoLineRegex : whoLineRegex ).exec( logLine );
    if ( match === null || match.groups.player !== characterName ) {
        return null;
    }

    // The Heroes' Journey /who names the class by its abbreviation, other servers by title or name.
    let className;
    if ( match.groups.classAbbrv ) {
        className = getEverQuestClassName( match.groups.classAbbrv );
    } else {
        className = match.groups.classRealName ?? getEverQuestClassFromTitle( match.groups.classTitleOrName );
    }

    // An unknown class comes back unchanged, which is longer than a class code.
    const classCode = getEverQuestClassAbbreviation( className );

    return getEverQuestClassName( classCode ) !== classCode ? classCode : null;
}










module.exports = {
    detectPersonaClassCode,
    detectOwnWhoClassCode,
};
