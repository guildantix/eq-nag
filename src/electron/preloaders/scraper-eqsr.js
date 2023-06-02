const { contextBridge, ipcRenderer } = require( 'electron' );
// const { getCurrentWindow, screen } = require( '@electron/remote' );

const channelPrefixes = [ 'app', 'overlay', 'clipboard', 'log', 'audio-file' ];

contextBridge.exposeInMainWorld( 'api', {
    ipc: {
        sendModel: ( data ) => {
            ipcRenderer.send( 'scraper:done', data );
        },
        sendError: ( error ) => {
            ipcRenderer.send( 'scraper:error', error );
        },
    },
    close: () => {
        getCurrentWindow().close();
    },
} );
