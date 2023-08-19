const { OverlayStoreModel } = require( '../models/overlay-window' );
const { backupDatafile } = require( './backup-data-file' );
const log = require( 'electron-log' );
const { screen } = require( "electron" );
const customAlphabet = require( 'nanoid' ).customAlphabet;
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const nanoid = customAlphabet( alphabet, 16 );
const { StyleProperties } = require( '../models/common' );
const ElectronUtilities = require( '../../utilities/electron' );

const currentOverlayDbVersion = 17;

/**
 * 
 * @param {OverlayStoreModel} data 
 * @param {string} configName
 * @param {(data: OverlayStoreModel) => void} migrationComplete Callback executed when data migration succeeds.
 */
function migrateOverlayData( data, configName, migrationComplete ) {
    
    if ( !data.version || data.version < currentOverlayDbVersion ) {
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
 * @param {OverlayStoreModel} data The data store model for triggers.
 */
function executeDataMigration( data ) {
    let startVersion = data.version ?? 0;
    
    if ( !data.version || data.version < 3 ) {
        log.log( '[Migrations] Migrating overlay database to version -> 3.' );

        data?.overlays?.forEach( f => {
            f.timerSortType = f.overlayType === 'Timer' ? 1 : 0;
        } );
        data.version = 3;

    }
    if ( !data.version || data.version < 4 ) {
        log.log( '[Migrations] Migrating overlay database to version -> 4.' );
        
        data?.overlays?.forEach( f => {
            f.timerColor = '#008000';
        } );
        data.version = 4;

    }
    if ( !data.version || data.version < 5 ) {
        log.log( '[Migrations] Migrating overlay database to version -> 5.' );
        
        data?.overlays?.forEach( f => {

            f.showTextBorder = false;
            f.textBorderColor = '#000000';
            f.textBorderIntensity = 1;

            f.showTextGlow = false;
            f.textGlowColor = '#000000';
            f.textGlowIntensity = 1;
            f.textGlowSize = 10;
    
        } );
        data.version = 5;

    }
    if ( !data.version || data.version < 6 ) {
        log.log( '[Migrations] Migrating overlay database to version -> 6.' );
        
        data?.overlays?.forEach( f => {
            f.showOnlyDotIcons = false;
            f.dotIconSize = 40;
            f.showTimeRemaining = false;
        } );
        data.version = 6;

    }
    if ( !data.version || data.version < 7 ) {
        log.log( '[Migrations] Migrating overlay database to version -> 7.' );
        
        data?.overlays?.forEach( f => {
            f.groupByTarget = f.showOnlyDotIcons;
            delete f.showOnlyDotIcons;
        } );
        data.version = 7;

    }
    if ( !data.version || data.version < 8 ) {
        log.log( '[Migrations] Migrating overlay database to version -> 8.' );
        
        data?.overlays?.forEach( f => {
            f.groupHeaderSize = f.dotIconSize;
            delete f.dotIconSize;
        } );
        data.version = 8;

    }
    if ( !data.version || data.version < 9 ) {
        log.log( '[Migrations] Migrating overlay database to version -> 9.' );
        
        data?.overlays?.forEach( f => {
            f.groupHeaderWeight = 400;
            f.groupHeaderColor = '#ffffff';
        } );
        data.version = 9;

    }
    if ( !data.version || data.version < 10 ) {
        log.log( '[Migrations] Migrating overlay database to version -> 10.' );
        
        data?.overlays?.forEach( f => {
            f.hideTargetLabel = false;
        } );
        data.version = 10;

    }
    if ( !data.version || data.version < 11 ) {
        log.log( '[Migrations] Migrating overlay database to version -> 11.' );
        

        data?.overlays?.forEach( f => {
            if ( f.overlayType === 'FCT' ) {

                f.fctDmgOutStyle = new StyleProperties();
                f.fctDmgOutStyle.fontSize = 32;
                f.fctDmgOutStyle.lineHeight = 95;
                f.fctDmgOutStyle.fontWeight = 700;
                f.fctDmgOutStyle.glowSize = 10;

                f.fctDmgInStyle = new StyleProperties();
                f.fctDmgInStyle.fontSize = 32;
                f.fctDmgInStyle.lineHeight = 95;
                f.fctDmgInStyle.fontWeight = 700;
                f.fctDmgInStyle.fontColor = '#b71c1c';
                f.fctDmgInStyle.glowSize = 10;

                f.fctSpellDmgOutStyle = new StyleProperties();
                f.fctSpellDmgOutStyle.fontSize = 32;
                f.fctSpellDmgOutStyle.lineHeight = 95;
                f.fctSpellDmgOutStyle.fontWeight = 700;
                f.fctSpellDmgOutStyle.glowSize = 10;

                f.fctSpellDmgInStyle = new StyleProperties();
                f.fctSpellDmgInStyle.fontSize = 32;
                f.fctSpellDmgInStyle.lineHeight = 95;
                f.fctSpellDmgInStyle.fontWeight = 700;
                f.fctSpellDmgInStyle.fontColor = '#b71c1c';
                f.fctSpellDmgInStyle.glowSize = 10;

                f.fctHealingOutStyle = new StyleProperties();
                f.fctHealingOutStyle.fontSize = 32;
                f.fctHealingOutStyle.lineHeight = 95;
                f.fctHealingOutStyle.fontWeight = 700;
                f.fctHealingOutStyle.fontColor = '#42a5f5';
                f.fctHealingOutStyle.glowSize = 10;

                f.fctHealingInStyle = new StyleProperties();
                f.fctHealingInStyle.fontSize = 32;
                f.fctHealingInStyle.lineHeight = 95;
                f.fctHealingInStyle.fontWeight = 700;
                f.fctHealingInStyle.fontColor = '#42a5f5';
                f.fctHealingInStyle.glowSize = 10;

                f.fctSkillStyle = new StyleProperties();
                f.fctSkillStyle.fontSize = 12;
                f.fctSkillStyle.fontWeight = 400;
                f.fctSkillStyle.fontColor = '#005aff';
            }
        } );

        data.version = 11;

    }
    if ( !data.version || data.version < 12 ) {
        log.log( '[Migrations] Migrating overlay database to version -> 12.' );
        

        data?.overlays?.forEach( f => {
            if ( f.overlayType === 'FCT' ) {

                delete f.fctDmgOutStyle;
                delete f.fctDmgInStyle;
                delete f.fctSpellDmgOutStyle;
                delete f.fctSpellDmgInStyle;
                delete f.fctHealingOutStyle;
                delete f.fctHealingInStyle;
                delete f.fctSkillStyle;
            }
        } );

        data.version = 12;

    }
    if ( !data.version || data.version < 13 ) {
        log.log( '[Migrations] Migrating overlay database to version -> 13.' );
        

        data?.overlays?.forEach( f => {
            f.monitorId = null;
        } );

        data.version = 13;

    }
    if ( !data.version || data.version < 14 ) {
        log.log( '[Migrations] Migrating overlay database to version -> 14.' );
        

        data?.overlays?.forEach( overlay => {

            delete overlay.monitorId;
        
            let overlayBounds = {
                x: overlay.x,
                y: overlay.y,
                width: overlay.windowWidth,
                height: overlay.windowHeight,
            };
            const display = ElectronUtilities.determineContainingDisplay( overlayBounds );

            if ( !display ) {
                const primaryDisplay = screen.getPrimaryDisplay();

                overlay.x = ( primaryDisplay.size.width - overlay.windowWidth ) / 2;
                overlay.y = ( primaryDisplay.size.height - overlay.windowHeight ) / 2;
                overlay.displayId = primaryDisplay.id;
                overlay.displayBounds = primaryDisplay.bounds;

            } else {

                overlay.displayId = display.id;
                overlay.displayBounds = display.bounds;
                overlay.x = overlay.x - display.bounds.x;
                overlay.y = overlay.y - display.bounds.y;
            
            }

        } );

        data.version = 14;

    }
    // skip version 15
    if ( !data.version || data.version < 16 ) {
        log.log( '[Migrations] Migrating overlay database to version -> 16.' );
        
        const displays = screen.getAllDisplays();

        data?.overlays?.forEach( overlay => {
            var refDisplay = displays.find( f => f.id == overlay.displayId );

            // The OS/Electron can report minor fluctuations in the x/y
            // component, so we need to be nearly equal but not necessarily 
            // exactly equal.  For our purposes in particular, close is good 
            // enough.
            var matches = ElectronUtilities.compareRectangles( overlay.displayBounds, refDisplay.bounds, true );

            if ( matches ) {
                overlay.displayLabel = refDisplay.label;

            } else {
                var matchingDisplay = displays.find( f => ElectronUtilities.compareRectangles( overlay.displayBounds, f.bounds, true ) );
                overlay.displayId = matchingDisplay.id;
                overlay.displayBounds = matchingDisplay.bounds;
                overlay.displayLabel = matchingDisplay.label;

            }
        } );
        
        // Testing the new migration script.
        data.version = 16;

    }
    if ( !data.version || data.version < 17 ) {
        log.log( '[Migrations] Migrating overlay database to version -> 17.' );
       
        data.fctCombatGroups = [];

        data.version = 17;

    }

    
    return data.version !== startVersion;
}

module.exports = { migrateOverlayData, currentOverlayDbVersion };
