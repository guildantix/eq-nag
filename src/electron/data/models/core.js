const StyleSheetUtil = require( "../../utilities/style-sheet" );

const styleSheetUtil = new StyleSheetUtil();

class StylePropertiesModel {
    /** @type {string} */
    fontFamily = 'Roboto';
    /** @type {number} */
    fontSize = 14;
    /** @type {number} */
    lineHeight = 90;
    /** @type {number} */
    fontWeight = 400;
    /** @type {string} */
    fontColor = '#ffffff';
    /** @type {number} */
    fontTransparency = 1;
    /** @type {boolean} */
    showBorder = true;
    /** @type {string} */
    borderColor = '#000000';
    /** @type {number} */
    borderIntensity = 1;
    /** @type {boolean} */
    showGlow = true;
    /** @type {string} */
    glowColor = '#000000';
    /** @type {number} */
    glowIntensity = 1;
    /** @type {number} */
    glowSize = 5;
    /** @type {number} */
    paddingLeft = 0;
    /** @type {number} */
    paddingRight = 0;
    /** @type {number} */
    paddingTop = 0;
    /** @type {number} */
    paddingBottom = 0;
    /** @type {'inline' | 'block'} */
    position = 'inline';
    /** @type {'left' | 'center' | 'right'} */
    justify = 'left';

    /**
     * Applies the given styles to the given html element.
     * 
     * @param {HTMLElement} el The element to apply the styles to.
     * @param {StylePropertiesModel} style The styles to apply.
     */
    static applyStyles( el, style ) {
        if ( el ) {
            el.style.fontFamily = `"${style.fontFamily}"`;
            el.style.fontSize = `${style.fontSize}px`;
            el.style.lineHeight = `${( style.lineHeight > 10 ? style.lineHeight : 90 ) / 100}em`;
            el.style.fontWeight = `${style.fontWeight > 0 ? style.fontWeight : 300}`;
            el.style.color = style.fontColor;
            el.style.opacity = style.fontTransparency.toString();

            el.style.paddingLeft = style.paddingLeft > 0 ? `${style.paddingLeft}px` : null;
            el.style.paddingRight = style.paddingRight > 0 ? `${style.paddingRight}px` : null;
            el.style.paddingTop = style.paddingTop > 0 ? `${style.paddingTop}px` : null;
            el.style.paddingBottom = style.paddingBottom > 0 ? `${style.paddingBottom}px` : null;

            el.style.fontWeight = style.fontWeight.toString();
            el.style.display = style.position === 'inline' ? 'inline-block' : 'block';
            
            let textShadow = '';

            if ( style.showBorder ) {
                textShadow += styleSheetUtil.templates.textOutline( style.borderColor, style.borderIntensity );
            }

            if ( style.showGlow ) {
                textShadow += `${style.showBorder ? ', ' : ''}${styleSheetUtil.templates.textGlow( style.glowColor, style.glowSize, style.glowIntensity )}`;
            }

            el.style.textShadow = textShadow.trim();
            el.style.textAlign = style.justify;
        }
    }
}

module.exports = { StylePropertiesModel };