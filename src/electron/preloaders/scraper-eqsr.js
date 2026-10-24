const { contextBridge, ipcRenderer } = require( 'electron' );
const { sanitizeHtml } = require( '../utilities/html' );
// const { getCurrentWindow, screen } = require( '@electron/remote' );

const channelPrefixes = [
    'app',
    'overlay',
    'clipboard',
    'log',
    'audio-file',
    'cache',
    'combat-database',
    'show-settings',
];
let i = 0;

contextBridge.exposeInMainWorld( 'api', {
    ipc: {
        sendModel: ( data ) => {
            ipcRenderer.send( 'scraper:done[' + i + ']', data );
        },
        sendError: ( error ) => {
            ipcRenderer.send( 'scraper:error[' + i + ']', error );
        },
    },
    sanitizeHtml: ( html ) => sanitizeHtml( html ),
    setIndex: ( index ) => {
        i = +index;
    },
    close: () => {
        getCurrentWindow().close();
    },
} );
