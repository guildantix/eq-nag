const { contextBridge, ipcRenderer } = require( 'electron' );
// const { getCurrentWindow, screen } = require( '@electron/remote' );

const channelPrefixes = [ 'app', 'overlay', 'clipboard', 'log', 'audio-file', 'cache' ];
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
    setIndex: ( index ) => {
        i = +index;
    },
    close: () => {
        getCurrentWindow().close();
    },
} );
