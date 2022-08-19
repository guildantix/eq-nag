class VerifiedPlayersDb {
    /** @type {Record<string, boolean>} */
    players = {};
    /** @type {Record<string, boolean>} */
    pets = {};
    /** @type {Record<string, string>} */
    playerClasses = {};
    /** @type {Record<string, string>} */
    petOwner = {};
}

module.exports = { VerifiedPlayersDb };
