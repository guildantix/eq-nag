const { ipcRenderer } = require( 'electron' );
const Handlebars = require( "handlebars" );
const _ = require( 'lodash' );
const { IpcMessage } = require( '../data/models/common' );
const CombatParser = require( '../utilities/combat-parser' );
const customAlphabet = require( 'nanoid' ).customAlphabet;
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const nanoid = customAlphabet( alphabet, 16 );

/**
 * The death recap screen.
 * 
 * @param {string} logFilePath The full path to the log file.
 * @param {number} lineNo The line number at which death occurred.
 * @param {string} messageId The ipc message id.
 */
function DeathRecap( logFilePath, lineNo, messageId ) {
    // "Constructor"
    let combatParser = new CombatParser();

    if ( lineNo > 0 ) {
        


        // Show the window.
        document.querySelector( 'body' ).style.display = 'unset';
        
    } else {
        combatParser.findAllDeaths( logFilePath, found => {
            let message = new IpcMessage( found );
            message.id = messageId;
            ipcRenderer.send( 'death-recap:find-deaths:results', message );
            window.setTimeout( () => ipcRenderer.send( 'window:child:close' ) );
        } );
    }
}

module.exports = DeathRecap;