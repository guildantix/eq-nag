const { StyleProperties } = require( '../data/models/common' );
const StringUtilities = require( './string' );

class StyleSheetUtil {
    templates = {
        /**
         * Returns the right-hand text-shadow value for a given border color.
         * 
         * @param {string} hexColorCode The hex color for the text border.
         * @param {number} transparency The transparency value, between 0 and 1.
         */
        textOutline: ( hexColorCode, transparency ) => `0px 0px 1px ${hexColorCode}${transparencyToHex( transparency )}, 
                                                        -1px -1px 1px ${hexColorCode}${transparencyToHex( transparency )}, 
                                                        1px -1px 1px ${hexColorCode}${transparencyToHex( transparency )}, 
                                                        -1px 1px 1px ${hexColorCode}${transparencyToHex( transparency )}, 
                                                        1px 1px 1px ${hexColorCode}${transparencyToHex( transparency )}`,
        /**
         * Returns the right-hand text-shadow value for a given glow property.
         * 
         * @param {string} hexColorCode The hex color code for the text glow.
         * @param {number} glowSize The distance the glow will spread.
         * @param {number} transparency The transparency value, between 0 and 1.
         */
        textGlow: ( hexColorCode, glowSize, transparency ) => `0px 0px ${glowSize}px ${hexColorCode}${transparencyToHex( transparency )}, 
                                                               -1px -1px ${glowSize}px ${hexColorCode}${transparencyToHex( transparency )}, 
                                                               1px -1px ${glowSize}px ${hexColorCode}${transparencyToHex( transparency )}, 
                                                               -1px 1px ${glowSize}px ${hexColorCode}${transparencyToHex( transparency )}, 
                                                               1px 1px ${glowSize}px ${hexColorCode}${transparencyToHex( transparency )}`,
        /**
         * Returns the right-hand line-height value for the given line height.
         * 
         * @param {number} lineHeight The line height selected by the user.
         */
        lineHeight: ( lineHeight ) => `${( lineHeight > 10 ? lineHeight : 90 ) / 100}em`,
        /**
         * Returns the right-hand color value for the given color properties.
         * 
         * @param {string} color The hex color code for the text color.
         * @param {number} fontTransparency Number between 0 and 1 representing the transparency of the text.
         */
        fontColor: ( color, fontTransparency ) => fontTransparency < 1 ? `${color}${componentToHex( Math.round( fontTransparency * 255 ) )}` : `${color}`,
    };

    /** @type {Record<string, HTMLStyleElement>} */
    #styles = {};










    /**
     * Creates a new style sheet, adds it to the dom, and returns its reference.
     * 
     * @returns {HTMLStyleElement} Returns the style sheet.
     * 
     * @param {Document} document The DOM.
     * @param {string} name Identify this style.
     */
    createStyleSheet( document, name ) {
        
        if ( this.#styles[ name ] != null ) {
            this.#styles[ name ].remove();
            delete this.#styles[ name ];
        }

        var style = document.createElement( 'style' );
        
        // WebKit hack
        style.appendChild( document.createTextNode( '' ) );

        style.setAttribute( 'id', name );
        document.head.appendChild( style );
        
        this.#styles[ name ] = style;

        return style;
    }










    /**
     * Returns the css rule for the given style property
     * 
     * @returns {string}
     * 
     * @param {StyleProperties} styleProperties The styleproperties to define this rule.
     * @param {string} className The class name.
     * @param {string} viewEncapsulationId The unique id for view encapsulation.
     */
    createTextRule( styleProperties, className, viewEncapsulationId ) {
        let styles = '';

        if ( !StringUtilities.isNullOrWhitespace( styleProperties.fontFamily ) ) {
            styles += `font-family: ${styleProperties.fontFamily}; `;
        }

        if ( styleProperties.fontSize > 0 ) {
            styles += `font-size: ${styleProperties.fontSize}px; `;
        }

        styles += `line-height: ${( styleProperties.lineHeight > 10 ? styleProperties.lineHeight : 90 ) / 100}em; `;
        styles += `font-weight: ${styleProperties.fontWeight > 0 ? styleProperties.fontWeight : 300}; `;
        
        if ( !StringUtilities.isNullOrWhitespace( styleProperties.fontColor ) ) {
            styles += `color: ${this.templates.fontColor( styleProperties.fontColor, styleProperties.fontTransparency )}; `;
        }

        let textShadow = '';

        if ( styleProperties.showBorder ) {
            textShadow += `${this.templates.textOutline( styleProperties.borderColor, styleProperties.borderIntensity )}`;
        }

        if ( styleProperties.showGlow ) {
            textShadow += `${styleProperties.showBorder ? ', ' : ''}${this.templates.textGlow( styleProperties.glowColor, styleProperties.glowSize, styleProperties.glowIntensity )}`;
        }

        if ( !StringUtilities.isNullOrWhitespace( textShadow ) ) {
            styles += `text-shadow: ${textShadow};`;
        }

        if ( !StringUtilities.isNullOrWhitespace( viewEncapsulationId ) ) {
            return `*[${viewEncapsulationId}] .${className} {${styles}}`;
        } else {
            return `.${className} {${styles}}`;
        }
    }
}










/**
 * Returns the hexidecimal value for the given integer.
 * 
 * @param {number} c The value to convert to hexidecimal.
 * @returns {string}
 */
function componentToHex( c ) {
    var hex = Math.round(c).toString( 16 );
    return hex.length == 1 ? "0" + hex : hex;
}










/**
 * Returns the hexidecimal value for the given integer.
 * 
 * @param {number} c The value to convert to hexidecimal.
 * @returns {string}
 */
function transparencyToHex( c ) {
    if ( c >= 0 && c < 1 ) {
        return componentToHex( c * 255 );
    } else {
        return 'ff';
    }
}

module.exports = StyleSheetUtil;
