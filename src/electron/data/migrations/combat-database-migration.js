const path = require( 'path' );
const { CombatDb } = require( '../models/combat-parser' );
const { backupDatafile } = require( './backup-data-file' );
const fs = require( 'fs' );
const fsp = fs.promises;
const electron = require( 'electron' );

const combatDbVersion = 2;

/**
 * 
 * @param {CombatDb} data 
 * @param {string} configName
 * @param {(data: CombatDb) => void} migrationComplete Callback executed when data migration succeeds.
 */
function migrateCombatData( data, configName, migrationComplete ) {
    
    if ( !data.version || data.version < combatDbVersion ) {
        backupDatafile( configName, () => {
            executeDataMigration( data ).then( migrationsPerformed => {
                if ( migrationsPerformed ) {
                    migrationComplete( data );
                }
            } );
        } );
    }

}

/**
 * Performs the data migration.
 * 
 * @returns {Promise<boolean>} Returns true if any migration was performed.
 * 
 * @param {CombatDb} data 
 */
async function executeDataMigration( data ) {
    let startVersion = data.version ?? 0;

    if ( !data.version || data.version < 2 ) {
        
        // We are changing the combat data storage.  If there is any data in
        // the store folder, we need to delete the files.
        
        const userDataPath = ( electron.app || electron.remote.app ).getPath( 'userData' );
        const encountersPath = path.join( userDataPath, 'encounters' );
        const pathExists = fs.existsSync( encountersPath );

        if ( pathExists ) {

            // Grab all of the .json files in the encounters folder and delete them.
            const files = await fsp.readdir( encountersPath );

            for ( const file of files ) {
                if ( file.endsWith( '.json' ) ) {

                    const jsonFullPath = path.join( encountersPath, file );

                    // Remove the encounter from the combat db.
                    let i = data.encounters.findIndex( f => f.filePath === jsonFullPath );

                    if ( i >= 0 ) {
                        data.encounters.splice( i, 1 );
                    }

                    // Delete the file.
                    await fsp.unlink( jsonFullPath );
                }
            }

            // Remove any encounters that are no longer valid.
            for ( let i = data.encounters.length - 1; i >= 0; i-- ) {
                if ( !fs.existsSync( data.encounters[ i ].filePath ) ) {
                    data.encounters.splice( i, 1 );
                }
            }
        }
        
        data.version = 2;
    }
    // if ( !data.version || data.version < 3 ) {
        
    //     data.version = 3;
    // }

    return data.version !== startVersion;
}

module.exports = { migrateCombatData, combatDbVersion };
