const { CharacterStoreModel } = require( '../models/character' );
const { backupDatafile } = require( './backup-data-file' );
const customAlphabet = require( 'nanoid' ).customAlphabet;
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const nanoid = customAlphabet( alphabet, 16 );

const currentCharacterDbVersion = 5;

/**
 * 
 * @param {CharacterStoreModel} data 
 * @param {string} configName
 * @param {(data: CharacterStoreModel) => void} migrationComplete Callback executed when data migration succeeds.
 */
function migrateCharacterData( data, configName, migrationComplete ) {
    
    if ( data.version < currentCharacterDbVersion ) {
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
    let startVersion = data.version;

    if ( !data.version || data.version < 3 ) {
        data?.characters?.forEach( f => {
            f.hasExtendedBeneficialFocus = false;
            f.extendedBeneficialFocusDecayLevel = null;
            f.extendedBeneficialFocusPercent = null;
        } );
        data.version = 3;
    }
    if ( !data.version || data.version < 4 ) {
        data?.characters?.forEach( f => {
            f.extendedBeneficialFocusAaPercent = null;
        } );
        data.version = 4;
    }
    if ( !data.version || data.version < 5 ) {
        data?.characters?.forEach( f => {
            f.p99 = false;
            f.daybreak = true;
        } );
        data.version = 5;
    }

    return data.version !== startVersion;
}

module.exports = { migrateCharacterData, currentCharacterDbVersion };
