const { CharacterStoreModel } = require( '../models/character' );
const { backupDatafile } = require( './backup-data-file' );
const customAlphabet = require( 'nanoid' ).customAlphabet;
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const nanoid = customAlphabet( alphabet, 16 );

const currentCharacterDbVersion = 13;

/**
 * 
 * @param {CharacterStoreModel} data 
 * @param {string} configName
 * @param {(data: CharacterStoreModel) => void} migrationComplete Callback executed when data migration succeeds.
 */
function migrateCharacterData( data, configName, migrationComplete ) {
    
    if ( !data.version || data.version < currentCharacterDbVersion ) {
        backupDatafile( configName, () => {
            if ( executeDataMigration( data ) ) {
                migrationComplete( data );
            }
        } );
    }

}

/**
 * Performs the data migration.
 * 
 * @returns {boolean} Returns true if any migration was performed.
 * 
 * @param {CharacterStoreModel} data The data store model for triggers.
 */
function executeDataMigration( data ) {
    let startVersion = data.version ?? 0;

    if ( !data.version || data.version < 3 ) {
        data?.characters?.forEach( f => {
            f.hasExtendedBeneficialFocus = f.hasExtendedBeneficialFocus === true;
            f.extendedBeneficialFocusDecayLevel = f.extendedBeneficialFocusDecayLevel ?? null;
            f.extendedBeneficialFocusPercent = f.extendedBeneficialFocusPercent ?? null;
        } );
        data.version = 3;

    }
    if ( !data.version || data.version < 4 ) {
        data?.characters?.forEach( f => {
            f.extendedBeneficialFocusAaPercent = f.extendedBeneficialFocusAaPercent ? f.extendedBeneficialFocusAaPercent : null;
        } );
        data.version = 4;

    }
    if ( !data.version || data.version < 5 ) {
        data?.characters?.forEach( f => {
            f.p99 = f.p99 === true;
            f.daybreak = f.p99 !== true;
        } );
        data.version = 5;

    }
    if ( !data.version || data.version < 6 ) {
        data?.characters?.forEach( f => {
            f.combatGroupHits = {};
            f.combatGroupMedian = {};
        } );
        data.version = 6;

    }
    if ( !data.version || data.version < 7 ) {
        data?.characters?.forEach( f => {
            f.triggerProfile = f.triggerProfile ?? undefined;
            f.disabledTriggers = f.disabledTriggers ?? [];
        } );
        data.version = 7;

    }
    if ( !data.version || data.version < 8 ) {
        data.triggerProfiles = data.triggerProfiles ?? [];
        data.version = 8;

    }
    if ( !data.version || data.version < 9 ) {
        data.triggerProfiles?.forEach( f => {
            f.disableTriggersByDefault = f.disableTriggersByDefault === true ?? false;
        } );
        data.characters?.forEach( c => {
            c.disableTriggersByDefault = c.disableTriggersByDefault === true ?? false;
        } );
        data.version = 9;

    }
    if ( !data.version || data.version < 10 ) {
        data?.characters?.forEach( f => {
            f.takp = f.takp === true;
            f.daybreak = f.takp !== true && f.p99 !== true;
        } );
        data.version = 10;

    }
    if ( !data.version || data.version < 11 ) {
        data?.characters?.forEach( f => {
            let thj = /eqlog_(?<Character>.*)_thj\.txt$/gi.exec( f.logFile );
            if ( thj != null && thj?.groups?.Character == f.name ) {
                f.thj = true;
                f.daybreak = false;
                f.p99 = false;
                f.takp = false;
            }
        } );

        data.version = 11;

    }
    // Set 12 was identical to 11, so no need to migrate.
    if ( !data.version || data.version < 13 ) {
        data?.characters?.forEach( f => {
            let thj = /eqlog_(?<Character>.*)_thj\.txt$/gi.exec( f.logFile );
            if ( thj != null && thj?.groups?.Character == f.name ) {
                f.thj = true;
                f.daybreak = false;
                f.p99 = false;
                f.takp = false;
                f.server = 'The Heroes Journey';
            }
        } );

        data.version = 13;

    }

    return data.version !== startVersion;
}

module.exports = { migrateCharacterData, currentCharacterDbVersion };
