const { ipcRenderer } = require( "electron" );

class LogMessageModel {
    /** @type {string | undefined} */
    label;
    /** @type {string | undefined} */
    message;
    /** @type {any | undefined} */
    payload;
}

class LogParseExceptionModel {
    /** @type {string | undefined} */
    source;
    /** @type {Error | undefined} */
    error;
    /** @type {string | undefined} */
    logEntry;
    /** @type {boolean | undefined} */
    simulating;
    /** @type {number | undefined} */
    padTime;
}

class LogExceptionModel {
    /** @type {string | undefined} */
    label;
    /** @type {string | undefined} */
    message;
    /** @type {any | undefined} */
    payload;
}










/**
 * Send a log message to the nag debug console.
 * 
 * @param {string | LogMessageModel} message The log message.
 * @param {boolean} sendToBrowserConsole If true, the message is also sent to the browser console.
 */
function nagLog( message, sendToBrowserConsole = false ) {
    ipcRenderer.send( 'console:message', message );
    if ( sendToBrowserConsole ) {
        console.log( message );
    }
}










/**
 * Send an exception message to the nag debug console.
 * 
 * @param {string | Error | LogExceptionModel | LogParseExceptionModel} message The exception message.
 * @param {boolean} sendToBrowserConsole If true, the message is also sent to the browser console.
 */
function nagException( message, sendToBrowserConsole = false ) {
    ipcRenderer.send( 'app:log:exception', message );
    if ( sendToBrowserConsole ) {
        console.error( message );
    }
}










module.exports = {
    LogMessageModel,
    LogParseExceptionModel,
    LogExceptionModel,
    nagLog,
    nagException,
};
