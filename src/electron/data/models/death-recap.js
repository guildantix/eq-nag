
class DeathRecapEncounterMob {
    /** @type {string} */
    name;
    /** @type {number} */
    quadCount = 0;
    /** @type {number} */
    avgHit = 0;
    /** @type {number} */
    avgDevensiveHit = 0;
    /** @type {number} */
    maxHit = 0;
    /** @type {number} */
    maxDefensiveHit = 0;
    /** @type {number} */
    minHit = 0;
    /** @type {number} */
    minDefensiveHit = 0;
    /** @type {number} */
    maxSpell = 0;
    /** @type {boolean} */
    flurries = false;
    /** @type {boolean} */
    rampage = false;
    /** @type {boolean} */
    wildRampage = false;
    /** @type {number} */
    totalDamage;
}

class DeathRecapRaidStats {
    /** @type {number} */
    defensiveReduction;
    /** @type {number} */
    healingReceived;
    /** @type {number} */
    dps;
    /** @type {number} */
    healing;
    /** @type {number} */
    damage;
}

class DeathRecapEncounter {
    /** @type {DeathRecapRaidStats} */
    raid;
    /** @type {DeathRecapEncounterMob[]} */
    mobs;
}

class DeathRecapLog {
    /** @type {Date} */
    timestamp;
    /** @type {string} */
    actor;
    /** @type {string} */
    target;
    /** @type {number} */
    damage;
    /** @type {number} */
    healing;
    /** @type {number} */
    overHealing;
    /** @type {string} */
    attackType;
    /** @type {string} */
    attackName;
}

class DeathRecapDamageSource {
    /** @type {number} */
    healing;
    /** @type {number} */
    damage;
    /** @type {string} */
    source;
}

class DeathRecapModel {
    /** @type {DeathRecapLog[]} */
    myDeathLog;
    /** @type {DeathRecapDamageSource[]} */
    damageSources;
    /** @type {DeathRecapEncounter} */
    encounterStatistics;
}

class DeathRecapPreferences {
    /** @type {string} */
    triggerId;
    /** @type {'hotkey' | 'automatic'} */
    engageMode;
    /** @type {string} */
    hotkeyPhrase;
}

module.exports = { DeathRecapEncounterMob, DeathRecapRaidStats, DeathRecapEncounter, DeathRecapLog, DeathRecapDamageSource, DeathRecapModel, DeathRecapPreferences };
