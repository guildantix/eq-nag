class AuthorModel {
    /** @type {string} */
    authorId = null;
    /** @type {string} */
    name = null;
    /** @type {string} */
    discord = null;
}

class SharedTriggerPermissions {

    /** @type {boolean} */
    disableSharedGlowEffects = false;
    /** @type {boolean} */
    disableAllGlowEffects = false;

}

module.exports = { AuthorModel, SharedTriggerPermissions };
