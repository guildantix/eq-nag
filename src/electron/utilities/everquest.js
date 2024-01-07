
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

module.exports = {
    getEverQuestClassAbbreviation,
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
}