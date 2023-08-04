const { StyleProperties } = require( './common' );
const { OverlayComponent } = require( './overlay-window' );
const { AttackModifiers } = require( './combat-parser' );

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
    critical = false;
    /** @type {AttackModifiers} */
    modifiers = {};
    attack = '';
    /** @type {Date} */
    timestamp = null;
    /** @type {number} */
    fctType = FctTypes.dmgOut;
    fct = true;
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

module.exports = { FctModel, FctStylesModel, FctTypes };