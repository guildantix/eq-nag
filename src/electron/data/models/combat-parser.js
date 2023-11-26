
class AttackModifiers {
    
    /** @type {boolean} */
    critical = false;
    /** @type {boolean} */
    cripplingBlow = false;
    /** @type {boolean} */
    flurry = false;
    /** @type {boolean} */
    lucky = false;
    /** @type {boolean} */
    twincast = false;
    /** @type {boolean} */
    riposte = false;
    /** @type {boolean} */
    dodge = false;
    /** @type {boolean} */
    parry = false;
    /** @type {boolean} */
    block = false;
    /** @type {boolean} */
    miss = false;
    /** @type {boolean} */
    strikethrough = false;
    /** @type {boolean} */
    wild_rampage = false;
    /** @type {boolean} */
    rampage = false;
    /** @type {boolean} */
    assassinate = false;
    /** @type {boolean} */
    headshot = false;
    /** @type {boolean} */
    double_bow_shot = false;
    /** @type {boolean} */
    deadly_strike = false;
    /** @type {boolean} */
    finishing_blow = false;
}

class PlayerInfo {
    /** @type {number} */
    level;
    /** @type {string} */
    className;
    /** @type {string} */
    raceName;
}

class PetDps {
    /** @type {string} */
    name;
    /** @type {number} */
    dps = 0;
    /** @type {number} */
    hps = 0;
    /** @type {number} */
    damage = 0;
    /** @type {number} */
    healing = 0;
}

class PlayerDps {
    /** @type {string} */
    name;
    /** @type {string} */
    class;
    /** @type {number} */
    dps = 0;
    /** @type {number} */
    hps = 0;
    /** @type {number} */
    damage = 0;
    /** @type {number} */
    healing = 0;
    /** @type {PetDps[]} */
    pets = [];
    /** @type {Date | undefined} */
    start = undefined;
    /** @type {Date | undefined} */
    end = undefined;
}

class PlayerEncounterStats {
    /** @type {string} */
    name;
    /** @type {string} */
    class;
    /** @type {PlayerDps} */
    playerDps = new PlayerDps();
    /** @type {PlayerDps} */
    playerDpsRec = new PlayerDps();
    /** @type {Date} */
    encounterStart;
    /** @type {Date} */
    lastEncounterEvent;
}

class EncounterStats {
    /** @type {string[]} */
    npcs = [];
    /** @type {Date} */
    encounterStart;
    /** @type {Date} */
    lastEncounterEvent;
    /** @type {Record<string, PlayerEncounterStats>} */
    playerEvents = {};
}

class LogRecord {
    /** @type {Date} */
    timestamp;
    /** @type {string} */
    actor;
    /** @type {string} */
    target;
    /** @type {string} */
    attackType;
    /** @type {string} */
    attackName;
    /** @type {boolean} */
    attackAvoided = false;
    /** @type {'debuff'|'direct damage'|'damage over time'|'direct heal'|'heal over time'} */
    spellType;
    /** @type {number} */
    damage;
    /** @type {number} */
    heal;
    /** @type {number} */
    overHeal;
    /** @type {boolean} */
    thorns;
    /** @type {AttackModifiers} */
    modifiers;
    /** @type {boolean?} true when actor MUST be a player, false when actor MUST be an npc, and null if unset/unknown */
    player;
}

const attackTypeMap = {
    'backstabs': 'backstab',
    'bashes': 'bash',
    'bites': 'bite',
    'claws': 'claw',
    'crushes': 'crush',
    'frenzies': 'frenzy',
    'gores': 'gore',
    'hits': 'hit',
    'kicks': 'kick',
    'learns': 'learn',
    'mauls': 'maul',
    'pierces': 'pierce',
    'punches': 'punch',
    'rends': 'rend',
    'shoots': 'shoot',
    'slams': 'slam',
    'slashes': 'slash',
    'slices': 'slice',
    'smashes': 'smash',
    'stings': 'sting',
    'strikes': 'strike',
    'sweeps': 'sweep',
    'backstab': 'backstab',
    'bash': 'bash',
    'bite': 'bite',
    'claw': 'claw',
    'crush': 'crush',
    'frenzy': 'frenzy',
    'gore': 'gore',
    'hit': 'hit',
    'kick': 'kick',
    'learn': 'learn',
    'maul': 'maul',
    'pierce': 'pierce',
    'punch': 'punch',
    'rend': 'rend',
    'shoot': 'shoot',
    'slam': 'slam',
    'slash': 'slash',
    'slice': 'slice',
    'smash': 'smash',
    'sting': 'sting',
    'strike': 'strike',
    'sweep': 'sweep',
}

const avoidTypeMap = {
    'dodges': 'dodge',
    'dodge': 'dodge',
    'parries': 'parry',
    'parry': 'parry',
    'ripostes': 'riposte',
    'riposte': 'riposte',
    'blocks': 'block',
    'block': 'block',
    'misses': 'miss',
    'miss': 'miss',
}

const EncounterEventTypes = {
    melee: 0,
    playerHeal: 1,
}

module.exports = { AttackModifiers, PlayerInfo, LogRecord, PlayerDps, PetDps, PlayerEncounterStats, EncounterStats, avoidTypeMap, attackTypeMap, EncounterEventTypes };
