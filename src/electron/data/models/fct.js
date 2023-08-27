const { StyleProperties } = require( './common' );
const { OverlayComponent, CombatTypes } = require( './overlay-window' );

var FctTypes = {
    '0': 'dmgOut',
    '1': 'dmgIn',
    '2': 'spellDmgOut',
    '3': 'spellDmgIn',
    '4': 'healingOut',
    '5': 'healingIn',
    '6': 'skill',
    dmgOut: 0,
    dmgIn: 1,
    spellDmgOut: 2,
    spellDmgIn: 3,
    healingOut: 4,
    healingIn: 5,
    skill: 6,
}

class FctModel extends OverlayComponent {
    overlayId = null;
    dealt = false;
    text = '';
    /** @type {number | undefined} */
    value = undefined;
    critical = false;
    /** @type {string[]} */
    combatModifiers = [];
    attack = '';
    /** @type {Date} */
    timestamp = null;
    /** @type {number} */
    fctType = FctTypes.dmgOut;
    fct = true;
    /** @type {CombatTypes} */
    combatTypes = new CombatTypes();
    /** @type {{x: number, y: number} | undefined} */
    pos = undefined;
    /** @type {number} */
    delayAmount = 0;
    /** @type {string} */
    characterId = undefined;

    /** @type {string | undefined} */
    actor = undefined;
    /** @type {string | undefined} */
    action = undefined;
    /** @type {string | undefined} */
    target = undefined;
    /** @type {number | undefined} */
    amount = undefined;
    /** @type {string | undefined} */
    avoidType = undefined;
    /** @type {string | undefined} */
    damageType = undefined;
    /** @type {string | undefined} */
    overHealing = undefined;

    accumulationDelay = 0;
    combatTypesFlags = 0;
    combatModifiersFlags = 0;
    accumulationPeriod = true;

}

class HitAccumulationModel {
    /** @type {string | undefined} */
    intervalId = undefined;
    /** @type {number} */
    targetAmount = 0;
    /** @type {number} */
    currentAmount = 0;
    /** @type {HTMLElement | undefined} */
    element = undefined;
}

class FctRenderComponent {
    /** @type {FctModel[]} */
    model = [];
    /** @type {HTMLElement|undefined} */
    dom = undefined;
}

class FctStylesModel {

    /** @type {StyleProperties} */
    fctDmgOutStyle = null;

    /** @type {StyleProperties} */
    fctDmgInStyle = null;

    /** @type {StyleProperties} */
    fctSpellDmgOutStyle = null;

    /** @type {StyleProperties} */
    fctSpellDmgInStyle = null;

    /** @type {StyleProperties} */
    fctHealingOutStyle = null;

    /** @type {StyleProperties} */
    fctHealingInStyle = null;

    /** @type {StyleProperties} */
    fctSkillStyle = null;

}

module.exports = { FctModel, FctStylesModel, FctTypes, FctRenderComponent, HitAccumulationModel };