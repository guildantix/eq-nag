const { DpsMeterSettings } = require( '../models/combat-parser' );
const { UserPreferencesStoreModel, StyleProperties, QuickShareAuthorListTypes } = require( '../models/common' );
const { FctStylesModel } = require( '../models/fct' );
const { backupDatafile } = require( './backup-data-file' );
const customAlphabet = require( 'nanoid' ).customAlphabet;
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const nanoid = customAlphabet( alphabet, 16 );

const currentUserPreferencesDbVersion = 8;

/**
 * 
 * @param {UserPreferencesStoreModel} data 
 * @param {string} configName
 * @param {(data: UserPreferencesStoreModel) => void} migrationComplete Callback executed when data migration succeeds.
 */
function migrateUserPreferencesData( data, configName, migrationComplete ) {
    
    if ( !data.version || data.version < currentUserPreferencesDbVersion ) {
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
 * @param {UserPreferencesStoreModel} data The data store model for triggers.
 */
function executeDataMigration( data ) {
    let startVersion = data.version ?? 0;

    if ( !data.version || data.version < 3 ) {
            
        data.fctStyles = new FctStylesModel();
        
        data.fctStyles.fctDmgOutStyle = new StyleProperties();
        data.fctStyles.fctDmgOutStyle.fontSize = 32;
        data.fctStyles.fctDmgOutStyle.lineHeight = 95;
        data.fctStyles.fctDmgOutStyle.fontWeight = 700;
        data.fctStyles.fctDmgOutStyle.glowSize = 10;

        data.fctStyles.fctDmgInStyle = new StyleProperties();
        data.fctStyles.fctDmgInStyle.fontSize = 32;
        data.fctStyles.fctDmgInStyle.lineHeight = 95;
        data.fctStyles.fctDmgInStyle.fontWeight = 700;
        data.fctStyles.fctDmgInStyle.fontColor = '#b71c1c';
        data.fctStyles.fctDmgInStyle.glowSize = 10;

        data.fctStyles.fctSpellDmgOutStyle = new StyleProperties();
        data.fctStyles.fctSpellDmgOutStyle.fontSize = 32;
        data.fctStyles.fctSpellDmgOutStyle.lineHeight = 95;
        data.fctStyles.fctSpellDmgOutStyle.fontWeight = 700;
        data.fctStyles.fctSpellDmgOutStyle.glowSize = 10;

        data.fctStyles.fctSpellDmgInStyle = new StyleProperties();
        data.fctStyles.fctSpellDmgInStyle.fontSize = 32;
        data.fctStyles.fctSpellDmgInStyle.lineHeight = 95;
        data.fctStyles.fctSpellDmgInStyle.fontWeight = 700;
        data.fctStyles.fctSpellDmgInStyle.fontColor = '#b71c1c';
        data.fctStyles.fctSpellDmgInStyle.glowSize = 10;

        data.fctStyles.fctHealingOutStyle = new StyleProperties();
        data.fctStyles.fctHealingOutStyle.fontSize = 32;
        data.fctStyles.fctHealingOutStyle.lineHeight = 95;
        data.fctStyles.fctHealingOutStyle.fontWeight = 700;
        data.fctStyles.fctHealingOutStyle.fontColor = '#42a5f5';
        data.fctStyles.fctHealingOutStyle.glowSize = 10;

        data.fctStyles.fctHealingInStyle = new StyleProperties();
        data.fctStyles.fctHealingInStyle.fontSize = 32;
        data.fctStyles.fctHealingInStyle.lineHeight = 95;
        data.fctStyles.fctHealingInStyle.fontWeight = 700;
        data.fctStyles.fctHealingInStyle.fontColor = '#42a5f5';
        data.fctStyles.fctHealingInStyle.glowSize = 10;

        data.fctStyles.fctSkillStyle = new StyleProperties();
        data.fctStyles.fctSkillStyle.fontSize = 12;
        data.fctStyles.fctSkillStyle.fontWeight = 400;
        data.fctStyles.fctSkillStyle.fontColor = '#005aff';

        data.version = 3;

    }
    if ( !data.version || data.version < 4 ) {
        
        // QuickSharing should be enabled by default, so we use database
        // upgrade to set that state.
        data.enableQuickShareImports = true;
        data.version = 4;

    }
    if ( !data.version || data.version < 5 ) {
        
        // Enable the glow on startup.
        data.glowOnStartup = true;
        data.version = 5;

    }
    if ( !data.version || data.version < 6 ) {
        
        // Set the master volume to 100%.
        data.masterVolume = 100;
        data.version = 6;

    }
    if ( !data.version || data.version < 7 ) {
        
        // Set the master volume to 100%.
        data.quickShareAuthorsList = [];
        data.quickShareAuthorsListType = QuickShareAuthorListTypes.Disabled;
        data.version = 7;

    }
    if ( !data.version || data.version < 8 ) {
        
        // Create a new DPS meter settings object.
        data.dpsMeterSettings = new DpsMeterSettings();
        data.version = 8;

    }
    
    return data.version !== startVersion;
}

module.exports = { migrateUserPreferencesData, currentUserPreferencesDbVersion };
