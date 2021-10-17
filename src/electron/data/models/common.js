const ErrorCodes = {
    EqFolderNotFound: {
        code: 'EQDIRNULL',
        message: 'Could not locate your EverQuest folder.',
    }
};

class BasicError {
    /** @type string */
    errorCode;
    /** @type string */
    message;
}

class StyleProperties {

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
    fontTransparency = 1.0;

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

}

module.exports = { StyleProperties, BasicError, ErrorCodes };
