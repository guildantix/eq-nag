const { whoLineRegex, heroesJourneyWhoLineRegex, getEverQuestClassName, getEverQuestClassFromTitle,
    getEverQuestClassAbbreviation } = require( './everquest' );










/**
 * Maps the class names EverQuest writes in an equipment set line to Nag's class codes. Only a
 * set named exactly after a class counts, so a player's own set names (e.g. "Raid gear") are
 * ignored. The regex allows the space and a lowercase k, which the class name is spelled with in
 * some places, and the space is removed before the lookup.
 */
const personaClassCodesByName = {
    Bard: 'BRD',
    Beastlord: 'BST',
    Berserker: 'BER',
    Cleric: 'CLR',
    Druid: 'DRU',
    Enchanter: 'ENC',
    Magician: 'MAG',
    Monk: 'MNK',
    Necromancer: 'NEC',
    Paladin: 'PAL',
    Ranger: 'RNG',
    Rogue: 'ROG',
    ShadowKnight: 'SHD',
    Shadowknight: 'SHD',
    Shaman: 'SHM',
    Warrior: 'WAR',
    Wizard: 'WIZ',
};










/** The display name of each class code, for the prompt shown to the player. */
const personaClassNamesByCode = {
    BRD: 'Bard',
    BST: 'Beastlord',
    BER: 'Berserker',
    CLR: 'Cleric',
    DRU: 'Druid',
    ENC: 'Enchanter',
    MAG: 'Magician',
    MNK: 'Monk',
    NEC: 'Necromancer',
    PAL: 'Paladin',
    RNG: 'Ranger',
    ROG: 'Rogue',
    SHD: 'Shadow Knight',
    SHM: 'Shaman',
    WAR: 'Warrior',
    WIZ: 'Wizard',
};










// Anchored at the start of the line (the timestamp is already removed) so chat that merely quotes
// the phrase doesn't match.
// Matches: You successfully loaded your Druid equipment set.
// Matches: You loaded only part of your Shaman equipment set. At least one item was not found.
// Ignored: Soandso tells you, 'You successfully loaded your Druid equipment set.'
const personaEquipmentSetRegex = /^You (?:successfully loaded|loaded only part of) your (?<className>Bard|Beastlord|Berserker|Cleric|Druid|Enchanter|Magician|Monk|Necromancer|Paladin|Ranger|Rogue|Shadow ?[Kk]night|Shaman|Warrior|Wizard) equipment set\./;










/**
 * Returns the class code of the persona the player just swapped to, or null when the line is
 * not an equipment set message for a class. Runs for every log line, so it checks two cheap
 * substrings before it tries the regex.
 *
 * @param {string} logLine The log line, without its timestamp.
 * @returns {string|null} The class code, such as 'SHM', or null.
 */
function detectPersonaClassCode( logLine ) {
    if ( !logLine.startsWith( 'You ' ) || !logLine.includes( ' equipment set' ) ) {
        return null;
    }

    const match = personaEquipmentSetRegex.exec( logLine );
    if ( match === null ) {
        return null;
    }

    const normalizedClassName = match.groups.className.replace( ' ', '' );

    return personaClassCodesByName[ normalizedClassName ] ?? null;
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

    const classCode = getEverQuestClassAbbreviation( className );

    return personaClassNamesByCode[ classCode ] ? classCode : null;
}










module.exports = {
    detectPersonaClassCode,
    detectOwnWhoClassCode,
    personaClassNamesByCode,
};
