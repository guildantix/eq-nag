const { ipcRenderer } = require( 'electron' );
const Handlebars = require( "handlebars" );
const _ = require( 'lodash' );
const { IpcMessage } = require( '../data/models/common' );
const CombatParser = require( '../utilities/combat-parser' );
const customAlphabet = require( 'nanoid' ).customAlphabet;
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const nanoid = customAlphabet( alphabet, 16 );

function DeathRecap( logFilePath, lineNo, messageId ) {
    // "Constructor"

    if ( lineNo > 0 ) {
        document.querySelector( 'body' ).style.display = 'unset';
    } else {
        let combatParser = new CombatParser();
        let output = combatParser.findAllDeaths( logFilePath, found => {
            let message = new IpcMessage(found);
            message.id = messageId;
            ipcRenderer.send( 'death-recap:find-deaths:results', message );
            window.setTimeout( () => ipcRenderer.send( 'window:child:close' ) );
        } );
    }
}

module.exports = DeathRecap;