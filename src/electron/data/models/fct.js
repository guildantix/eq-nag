const { StyleProperties } = require( './common' );

class FctModel {
    overlayId = null;
    dealt = false;
    text = '';
    critical = false;
    attack = '';
    /** @type {Date} */
    timestamp = null;
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

module.exports = { FctModel, FctStylesModel };