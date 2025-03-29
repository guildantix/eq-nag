
const bardColor = '#00ffff';
const beastlordColor = '#8b5600';
const berserkerColor = '#a330c9';
const clericColor = '#ffffff';
const druidColor = '#ff7C0a';
const enchanterColor = '#ff00ff';
const magicianColor = '#33937f';
const monkColor = '#00ff98';
const necromancerColor = '#8788ee';
const paladinColor = '#f48cba';
const rangerColor = '#aad372';
const rogueColor = '#fff468';
const shadowKnightColor = '#c41e3a';
const shamanColor = '#0070dd';
const warriorColor = '#c69b6d';
const wizardColor = '#3fc7eb';
const classColor = '#676767';

/**
 * Returns the class abbreviation for the given class name.
 * 
 * @param {string} value The class name.
 */
const getEverQuestClassAbbreviation = ( value ) => {
    if ( !value ) {
        return '';
    } else {
        let v = value.toLowerCase();

        if ( v.includes( 'bard' ) ) {
            return 'BRD';
        } else if (v.includes('beastlord')) {
            return 'BST';
        } else if (v.includes('berserker')) {
            return 'BER';
        } else if ( v.includes( 'cleric' ) ) {
            return 'CLR';
        } else if ( v.includes( 'druid' ) ) {
            return 'DRU';
        } else if ( v.includes( 'enchanter' ) ) {
            return 'ENC';
        } else if ( v.includes( 'magician' ) ) {
            return 'MAG';
        } else if ( v.includes( 'monk' ) ) {
            return 'MNK';
        } else if ( v.includes( 'necromancer' ) ) {
            return 'NEC';
        } else if ( v.includes( 'paladin' ) ) {
            return 'PAL';
        } else if ( v.includes( 'ranger' ) ) {
            return 'RNG';
        } else if ( v.includes( 'rogue' ) ) {
            return 'ROG';
        } else if ( v.includes( 'shadow' ) || v === 'sk' ) {
            return 'SHD';
        } else if ( v.includes( 'shaman' ) ) {
            return 'SHM';
        } else if ( v.includes( 'warrior' ) ) {
            return 'WAR';
        } else if ( v.includes( 'wizard' ) ) {
            return 'WIZ';
        } else {
            return value;
        }
    }
}

/**
 * Returns the full class name for the given class abbreviation.
 * 
 * @returns {string} The full class name.
 * 
 * @param {string} classAbbreviation The class abbreviation.
 */
const getEverQuestClassName = ( classAbbreviation ) => {
    if ( !classAbbreviation ) {
        return '';
    } else {
        let v = classAbbreviation.toUpperCase();

        if ( v === 'BRD' ) {
            return 'Bard';
        } else if ( v === 'BST' ) {
            return 'Beastlord';
        } else if ( v === 'BER' ) {
            return 'Berserker';
        } else if ( v === 'CLR' ) {
            return 'Cleric';
        } else if ( v === 'DRU' ) {
            return 'Druid';
        } else if ( v === 'ENC' ) {
            return 'Enchanter';
        } else if ( v === 'MAG' ) {
            return 'Magician';
        } else if ( v === 'MNK' ) {
            return 'Monk';
        } else if ( v === 'NEC' ) {
            return 'Necromancer';
        } else if ( v === 'PAL' ) {
            return 'Paladin';
        } else if ( v === 'RNG' ) {
            return 'Ranger';
        } else if ( v === 'ROG' ) {
            return 'Rogue';
        } else if ( v === 'SHD' ) {
            return 'Shadow Knight';
        } else if ( v === 'SHM' ) {
            return 'Shaman';
        } else if ( v === 'WAR' ) {
            return 'Warrior';
        } else if ( v === 'WIZ' ) {
            return 'Wizard';
        } else {
            return classAbbreviation;
        }
    }

}

const getEverQuestClassIcon = ( value ) => {
    return `${getEverQuestClassAbbreviation(value)}-icon.png`;
}

const getEverQuestClassColor = ( value ) => {
    if ( !value ) {
        return classColor;
    } else {
        if ( value === 'BRD' ) {
            return bardColor;
        } else if ( value === 'BST' ) {
            return beastlordColor;
        } else if ( value === 'BER' ) {
            return berserkerColor;
        } else if ( value === 'CLR' ) {
            return clericColor;
        } else if ( value === 'DRU' ) {
            return druidColor;
        } else if ( value === 'ENC' ) {
            return enchanterColor;
        } else if ( value === 'MAG' ) {
            return magicianColor;
        } else if ( value === 'MNK' ) {
            return monkColor;
        } else if ( value === 'NEC' ) {
            return necromancerColor;
        } else if ( value === 'PAL' ) {
            return paladinColor;
        } else if ( value === 'RNG' ) {
            return rangerColor;
        } else if ( value === 'ROG' ) {
            return rogueColor;
        } else if ( value === 'SHD' ) {
            return shadowKnightColor;
        } else if ( value === 'SHM' ) {
            return shamanColor;
        } else if ( value === 'WAR' ) {
            return warriorColor;
        } else if ( value === 'WIZ' ) {
            return wizardColor;
        } else {
            return classColor;
        }
    }
}

const eqClassTitleMap = {

    // Bard
    'Bard': 'Bard',
    'Minstrel': 'Bard',
    'Troubadour': 'Bard',
    'Virtuoso': 'Bard',
    'Maestro': 'Bard',
    'Herald': 'Bard',
    'Lyricist': 'Bard',

    // Beastlord
    'Beastlord': 'Beastlord',
    'Primalist': 'Beastlord',
    'Animist': 'Beastlord',
    'Savage Lord': 'Beastlord',
    'Feral Lord': 'Beastlord',
    'Wildblood': 'Beastlord',
    'Frostblood': 'Beastlord',

    // Berserker
    'Brawler': 'Berserker',
    'Vehement': 'Berserker',
    'Rager': 'Berserker',
    'Fury': 'Berserker',
    'Ravager': 'Berserker',
    'Juggernaut': 'Berserker',

    // Cleric
    'Cleric': 'Cleric',
    'Vicar': 'Cleric',
    'Templar': 'Cleric',
    'High Priest': 'Cleric',
    'Archon': 'Cleric',
    'Prelate': 'Cleric',
    'Exemplar': 'Cleric',

    // Druid
    'Druid': 'Druid',
    'Wanderer': 'Druid',
    'Preserver': 'Druid',
    'Hierophant': 'Druid',
    'Storm Warden': 'Druid',
    'Natureguard': 'Druid',
    'Storm Caller': 'Druid',

    // Enchanter
    'Enchanter': 'Enchanter',
    'Illusionist': 'Enchanter',
    'Beguiler': 'Enchanter',
    'Phantasmist': 'Enchanter',
    'Coercer': 'Enchanter',
    'Bedazzler': 'Enchanter',
    'Entrancer': 'Enchanter',

    // Magician
    'Magician': 'Magician',
    'Elementalist': 'Magician',
    'Conjurer': 'Magician',
    'Arch Mage': 'Magician',
    'Arch Convoker': 'Magician',
    'Arch Magus': 'Magician',
    'Grand Summoner': 'Magician',

    // Monk
    'Monk': 'Monk',
    'Disciple': 'Monk',
    'Master': 'Monk',
    'Grandmaster': 'Monk',
    'Transcendent': 'Monk',
    'Stone Fist': 'Monk',
    'Ashenhand': 'Monk',

    // Necromancer
    'Necromancer': 'Necromancer',
    'Heretic': 'Necromancer',
    'Defiler': 'Necromancer',
    'Warlock': 'Necromancer',
    'Arch Lich': 'Necromancer',
    'Wraith': 'Necromancer',
    'Deathcaller': 'Necromancer',

    // Paladin
    'Paladin': 'Paladin',
    'Cavalier': 'Paladin',
    'Knight': 'Paladin',
    'Crusader': 'Paladin',
    'Lord Protector': 'Paladin',
    'Saint': 'Paladin',
    'Holy Defender': 'Paladin',

    // Ranger
    'Ranger': 'Ranger',
    'Pathfinder': 'Ranger',
    'Outrider': 'Ranger',
    'Warder': 'Ranger',
    'Forest Stalker': 'Ranger',
    'Plainswalker': 'Ranger',
    'Huntmaster': 'Ranger',

    // Rogue
    'Rogue': 'Rogue',
    'Rake': 'Rogue',
    'Blackguard': 'Rogue',
    'Assassin': 'Rogue',
    'Deceiver': 'Rogue',
    'Nemesis': 'Rogue',
    'Shadowblade': 'Rogue',

    // Shadow Knight
    'Shadow Knight': 'Shadow Knight',
    'Reaver': 'Shadow Knight',
    'Revenant': 'Shadow Knight',
    'Grave Lord': 'Shadow Knight',
    'Dread Lord': 'Shadow Knight',
    'Scourge Knight': 'Shadow Knight',
    'Bloodreaver': 'Shadow Knight',

    // Shaman
    'Shaman': 'Shaman',
    'Mystic': 'Shaman',
    'Luminary': 'Shaman',
    'Oracle': 'Shaman',
    'Prophet': 'Shaman',
    'Soothsayer': 'Shaman',
    'Spiritwatcher': 'Shaman',

    // Warrior
    'Warrior': 'Warrior',
    'Champion': 'Warrior',
    'Myrmidon': 'Warrior',
    'Warlord': 'Warrior',
    'Overlord': 'Warrior',
    'Vanquisher': 'Warrior',
    'Imperator': 'Warrior',

    // Wizard
    'Wizard': 'Wizard',
    'Channeler': 'Wizard',
    'Evoker': 'Wizard',
    'Sorcerer': 'Wizard',
    'Archanist': 'Wizard',
    'Grand Archanist': 'Wizard',
    'Pyromancer': 'Wizard',
};

/**
 * Convertes a class title to its corresponding class name.
 * 
 * @param {string | undefined} classTitle The class title to convert.
 * @returns {string} The corresponding class name.
 */
const getEverQuestClassFromTitle = ( classTitle ) => {
    switch ( classTitle?.toLowerCase() ?? '' ) {
        case 'bard':
        case 'minstrel':
        case 'troubadour':
        case 'virtuoso':
        case 'maestro':
        case 'herald':
        case 'lyricist':
            return 'Bard';
        case 'beastlord':
        case 'primalist':
        case 'animist':
        case 'savage lord':
        case 'feral lord':
        case 'wildblood':
        case 'frostblood':
            return 'Beastlord';
        case 'berserker':
        case 'brawler':
        case 'vehement':
        case 'rager':
        case 'fury':
        case 'ravager':
            return 'Berserker';
        case 'cleric':
        case 'vicar':
        case 'templar':
        case 'high priest':
        case 'archon':
        case 'prelate':
        case 'exemplar':
            return 'Cleric';
        case 'druid':
        case 'wanderer':
        case 'preserver':
        case 'hierophant':
        case 'storm warden':
        case 'natureguard':
        case 'storm caller':
            return 'Druid';
        case 'enchanter':
        case 'illusionist':
        case 'beguiler':
        case 'phantasmist':
        case 'coercer':
        case 'bedazzler':
        case 'entrancer':
            return 'Enchanter';
        case 'magician':
        case 'elementalist':
        case 'conjurer':
        case 'arch mage':
        case 'arch convoker':
        case 'arch magus':
        case 'grand summoner':
            return 'Magician';
        case 'monk':
        case 'disciple':
        case 'master':
        case 'grandmaster':
        case 'transcendent':
        case 'stone fist':
        case 'ashenhand':
            return 'Monk';
        case 'necromancer':
        case 'heretic':
        case 'defiler':
        case 'warlock':
        case 'arch lich':
        case 'wraith':
        case 'deathcaller':
            return 'Necromancer';
        case 'paladin':
        case 'cavalier':
        case 'knight':
        case 'crusader':
        case 'lord protector':
        case 'saint':
        case 'holy defender':
            return 'Paladin';
        case 'ranger':
        case 'pathfinder':
        case 'outrider':
        case 'warder':
        case 'forest stalker':
        case 'plainswalker':
        case 'huntmaster':
            return 'Ranger';
        case 'rogue':
        case 'rake':
        case 'blackguard':
        case 'assassin':
        case 'deceiver':
        case 'nemesis':
        case 'shadowblade':
            return 'Rogue';
        case 'shadow knight':
        case 'reaver':
        case 'revenant':
        case 'grave lord':
        case 'dread lord':
        case 'scourge knight':
        case 'bloodreaver':
            return 'Shadow Knight';
        case 'shaman':
        case 'mystic':
        case 'luminary':
        case 'oracle':
        case 'prophet':
        case 'soothsayer':
        case 'spiritwatcher':
            return 'Shaman';
        case 'warrior':
        case 'champion':
        case 'myrmidon':
        case 'warlord':
        case 'overlord':
        case 'vanquisher':
        case 'imperator':
            return 'Warrior';
        case 'wizard':
        case 'channeler':
        case 'evoker':
        case 'sorcerer':
        case 'archanist':
        case 'grand archanist':
        case 'pyromancer':
            return 'Wizard';
        default:
            return classTitle;
    }
}

module.exports = {
    getEverQuestClassAbbreviation,
    getEverQuestClassName,
    getEverQuestClassIcon,
    getEverQuestClassColor,
    bardColor,
    beastlordColor,
    berserkerColor,
    clericColor,
    druidColor,
    enchanterColor,
    magicianColor,
    monkColor,
    necromancerColor,
    paladinColor,
    rangerColor,
    rogueColor,
    shadowKnightColor,
    shamanColor,
    warriorColor,
    wizardColor,
    classColor,
    eqClassTitleMap,
    getEverQuestClassFromTitle,
}