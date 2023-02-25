const electron = require( 'electron' );
const path = require( 'path' );
const fs = require( 'fs' );
const nativeImage = require( 'electron' ).nativeImage;
const ipcMain = require( 'electron' ).ipcMain;
const tga2png = require( 'tga2png' );
const UserPreferencesStore = require( './user-preferences' );
const StringUtilities = require( '../utilities/string' );
const { BasicError, ErrorCodes } = require( '../data/models/common' );
const TGA = require( 'tga' );
const PNG = require( 'pngjs' ).PNG;

const eqSpellPages = 63;
const eqIconPageSize = 256;
const eqIconSize = 40;
var userDataPath = ( electron.app || electron.remote.app ).getPath( 'userData' );

class GameResources {

    /**
     *  Attach ipc events to requests for game resources.
     * 
     * @param {ForwardRef} mainWindowRef The main window of the application.
     * @param {UserPreferencesStore} userPreferences The user preferences database.
     */
    attachIpcEvents( mainWindowRef, userPreferences ) {

        ipcMain.on( 'game-resources:get:eq:icons', ( event, character ) => {
            try {
                let spellIcons = this.getEqSpellIcons( userPreferences.everquestInstallFolder );
                event.sender.send( 'game-resources:get:eq:icons', spellIcons );
            } catch ( error ) {
                let model = new BasicError();
                model.errorCode = error;

                if ( error === ErrorCodes.EqFolderNotFound.code ) {
                    model.message = ErrorCodes.EqFolderNotFound.message;
                    event.sender.send( 'game-resources:get:eq:icons:error', model );
                }
            }
        } );

    }

    /**
     * Returns an array of base64 encoded images as data URLs of all EverQuest 
     * spell icons.
     * 
     * @returns {string[]} An array of base64 encoded images as data URLs.
     * 
     * @param {string} eqInstallFolder The EverQuest installation folder.
     */
    getEqSpellIcons( eqInstallFolder ) {
        let storePath = path.join( userDataPath, 'eq-spell-icons.json' );
        if ( fs.existsSync( storePath ) ) {
            return JSON.parse( fs.readFileSync( storePath ) );
        } else {
            if ( StringUtilities.isNullOrWhitespace( eqInstallFolder ) || !fs.existsSync( eqInstallFolder ) ) {
                throw ErrorCodes.EqFolderNotFound.code;
            } else {
                let icons = [];

                // We're pulling the icon data from the default EverQuest 
                // install folder.In the uifiles /default, there are 64 tga 
                // files that contain all of the image data used for spell and 
                // effect icons in the game.Each file is a 256x256 TGA file 
                // with icons that are 40x40.The reamining padding in the image 
                // is just black
                for ( let i = 0; i < eqSpellPages; i++ ) {
                    let padded = i < 9 ? `0${i + 1}` : ( i + 1 ).toString();
                    let source = path.join( eqInstallFolder, 'uifiles', 'default', `spells${padded}.tga` );

                    // First we need to convert the images into png, then crop 
                    // the image into sprites.
                    let bankBuf = fs.readFileSync( source );
                    let tga = new TGA( bankBuf );
                    let png = new PNG( {
                        width: tga.header.width,
                        height: tga.header.width,
                    } );
                    png.data = tga.pixels;

                    let buf = PNG.sync.write( png );
                    let image = nativeImage.createFromBuffer( buf, { width: eqIconPageSize, height: eqIconPageSize } );
                    let max = Math.floor( eqIconPageSize / eqIconSize ) * eqIconSize;
                    for ( let y = 0; y < max; y += eqIconSize ) {
                        for ( let x = 0; x < max; x += eqIconSize ) {
                            icons.push( image.crop( { x: x, y: y, width: eqIconSize, height: eqIconSize } ).toDataURL() );
                        }
                    }
                }

                // Save the image data to the user data path.
                fs.writeFileSync( storePath, JSON.stringify( icons ) );

                return icons;
            }
        }
    }

    
// // We'll use the `configName` property to set the file name and path.join to bring it all together as a string
// var sourcePath = 'E:\\everquest\\uifiles\\default\\spells01.tga';
// var iconsFolder = path.join( userDataPath, 'icons' );
// var testPath = path.join( userDataPath, 'icons', 'spells01.png' );

// if ( !fs.existsSync( iconsFolder ) ) {
    
//     fs.mkdirSync( iconsFolder );

// }

// tga2png( sourcePath, testPath ).then( buf => {
//     console.log( 'the png buffer is', testPath );
//     // console.log( `data:image/png;base64,${buf.toString( 'base64' )}` );
// }, err => {
//     console.log( 'error', err );
// } );

}

module.exports = GameResources;
