const { nagId } = require( "../../utilities/nag-id" );

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
    /** @type {string | undefined} */
    npcName;
    /** @type {string | undefined} */
    otherPlayerName;
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
    /** @type {number} */
    time;
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
    /** @type {PlayerDps[]} */
    playerDpsOutgoing = [];
    /** @type {PlayerDps[]} */
    playerDpsIncoming = [];
    /** @type {Date} */
    encounterStart;
    /** @type {Date} */
    lastEncounterEvent;
}

class OwnedRawLog {
    /** @type {string | undefined} */
    actor;
    /** @type {string | undefined} */
    target;
    /** @type {string } */
    log;
    /** @type {boolean} */
    transmitted = false;
}

const EntityVerifiedConfidenceTypes = {
    none: 0,
    likely: 1,
    assured: 2,
}

class EntityStatsModel {
    /** @type {string} */
    name;
    /** @type {number} */
    attackNpc = 0;
    /** @type {number} */
    attackPlayer = 0;
    /** @type {number} */
    healNpc = 0;
    /** @type {number} */
    healPlayer = 0;
    /** @type {number} */
    attackedByNpc = 0;
    /** @type {number} */
    attackedByPlayer = 0;
    /** @type {EntityVerifiedConfidenceTypes} */
    verfiedStatus = EntityVerifiedConfidenceTypes.none;
}

class EncounterStats {
    constructor() {
        this.encounterId = nagId();
    }
    /** @type {string[]} */
    npcs = [];
    /** @type {Record<string, number|undefined>} */
    npcDeathTimeoutTimestamps = {};
    /** @type {string[]} */
    deadNpcs = [];
    /** @type {Record<string, Date>} */
    lastPlayerNpcAction = {};
    /** @type {Date} */
    encounterStart;
    /** @type {Date} */
    lastEncounterEvent;
    /** @type {Record<string, PlayerEncounterStats>} */
    playerEvents = {};
    /** @type {number} */
    encounterDamageDone = 0;
    /** @type {string[]} */
    logs = [];
    /** @type {OwnedRawLog[]} */
    ownedLogs = [];
    /** @type {boolean} If true, a named NPC is part of this event. */
    namedEvent = false;
    /** @type {boolean} If true, the encounter has ended. */
    ended = false;
    /** @type {boolean} If true, a player has engaged in combat. */
    active = false;
}

class EncounterStatsEventArgs {
    /** @type {EncounterStats} */
    encounter;
    /** @type {string[]} */
    verifiedPlayers;
    /** @type {string[]} */
    verifiedNpcs;
    /** @type {string[]} */
    verifiedPets;
    /** @type {Record<string, string>} */
    petOwners;
    /** @type {string} */
    characterName;
    /** @type {PlayerDps[]} */
    playerDps = [];
}

class EncounterResetEventArgs {
    /** @type {string} */
    encounterId;
    /** @type {Date} */
    timestamp;
    /** @type {Date} */
    firstEncounterEventTimestamp;
    /** @type {Date} */
    lastEncounterEventTimestamp;
    /** @type {LogRecord[]} */
    logRecords = [];
    /** @type {string[]} */
    logs = [];
    /** @type {string[]} */
    myOwnedLogs = [];
    /** @type {string[]} */
    externalEncounterIds = [];
    /** @type {Record<string, string>} Maps external encounter ids to their owning character names. */
    externalEncounterIdCharacters = {};
    /** @type {string[]} */
    npcs = [];
    /** @type {number} */
    timezoneOffset = 0;
    /** @type {EncounterStats} */
    encounter;
}

class LogRecord {
    /** @type {Date} */
    timestamp;
    /** @type {string} */
    actor;
    /** @type {string} */
    target;
    /** @type {'melee' | 'spell' | 'thorns'} */
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
    /** @type {boolean} */
    transmitted = false;
    /** @type {string | undefined} */
    resistType;
    /** @type {boolean} */
    corpse = false;
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

class ServerCombatModel {

    /** @type {string} */
    server;
    /** @type {Record<string, PlayerInfo>} */
    verifiedPlayers = {};
    /** @type {string[]} */
    verifiedNpcs = [];
    /** @type {string[]>} */
    verifiedPets = [];
    /** @type {Record<string, string>} */
    petOwners = {};
    
}

class CombatEncounterModel {

    /** @type {string} */
    encounterId;
    /** @type {string} */
    characterName;
    /** @type {string} */
    serverName;
    /** @type {string} */
    filePath;
    /** @type {Date} */
    timestamp;
    /** @type {string[]} */
    npcs;
    /** @type {string[]} */
    externalPlayerNames = [];

}

class CombatDb {

    /** @type {ServerCombatModel[]} */
    servers = [];
    /** @type {CombatEncounterModel[]} */
    encounters = [];
    /** @type {number} */
    version;

}

const combatDbDefault = {
    servers: [],
    encounters: [],
    version: 1,
};

class DpsMeterSettings {

    show = false;
    autoFade = false;
    showOnlyInCombat = false;
    keepOnScreen = false;
    fadeDelayMs = 5000;
    fadeDurationMs = 5000;
    fadeOpacity = 0.5;
    encounterResetDelayMs = 30000;
    encounterInactiveDelayMs = 8000;
    playerInactiveDelayMs = 7000;
    encounterMinimumDamage = 0;
    highlightMyName = false;

}

const rgxCombatText = /hit|damage|miss|dodge|riposte|parry|become better|backstab|stun|attack|crush/i;

class ExternalEncounterModel {
    /** @type {string} */
    encounterId;
    /** @type {string} */
    characterName;
    /** @type {string[]} */
    logs = [];
    /** @type {string[]} */
    npcs = [];
}

class EncounterModel {
    /** @type {string} */
    encounterId;
    /** @type {string} */
    characterName;
    /** @type {string} */
    serverName;
    /** @type {LogRecord[]} */
    logRecords = [];
    /** @type {string[]} */
    externalEncounterIds = [];
    /** @type {Record<string, string>} */
    externalEncounterIdCharacters = {};
    /** @type {ExternalEncounterModel[]} */
    externalEncounterInfos = [];
    /** @type {string[]} */
    npcs;
    /** @type {string[]} */
    logs = [];
}

module.exports = {
    AttackModifiers,
    PlayerInfo,
    LogRecord,
    PlayerDps,
    PetDps,
    PlayerEncounterStats,
    OwnedRawLog,
    EncounterStats,
    avoidTypeMap,
    attackTypeMap,
    EncounterEventTypes,
    ServerCombatModel,
    CombatDb,
    combatDbDefault,
    DpsMeterSettings,
    rgxCombatText,
    EncounterResetEventArgs,
    ExternalEncounterModel,
    EncounterModel,
    CombatEncounterModel,
    EncounterStatsEventArgs,
    EntityVerifiedConfidenceTypes,
    EntityStatsModel,
};
