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

module.exports = { BasicError, ErrorCodes };
