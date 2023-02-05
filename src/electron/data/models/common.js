const customAlphabet = require( 'nanoid' ).customAlphabet;
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const nanoid = customAlphabet( alphabet, 16 );

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

/**
 * @template T
 */
class IpcMessage {

    /** @type {string} */
    id;

    /** @type {T} */
    value;

    /**
     * Constructs the IPC Message object.
     * 
     * @param {T} val The message value.
     */
    constructor( val ) {
        this.id = nanoid();
        this.value = val;
    }
}

class PlayerCharacter {
    /** @type {string} */
    name;
    /** @type {string} */
    class;
}

class PlayerPet {
    /** @type {string} */
    owner;
    /** @type {string} */
    name;
}

const QuickShareAuthorListTypes = {
    '0': 'Disabled',
    '1': 'Whitelist',
    '2': 'Blacklist',
    Disabled: 0,
    Whitelist: 1,
    Blacklist: 2,
}

module.exports = { StyleProperties, BasicError, ErrorCodes, IpcMessage, PlayerCharacter, PlayerPet, QuickShareAuthorListTypes };
