const { contextBridge, ipcRenderer } = require( 'electron' );
const { getCurrentWindow, screen } = require( '@electron/remote' );

const channelPrefixes = [ 'app', 'overlay', 'clipboard', 'log', 'audio-file' ];

contextBridge.exposeInMainWorld( 'api', {
    getRenderer: () => require( '../threads/renderer' ),
    setIgnoreMouseEvents: () => {
        getCurrentWindow().setIgnoreMouseEvents( true, { forward: true } );
    },
    setHandleMouseEvents: () => {
        getCurrentWindow().setIgnoreMouseEvents( false );
    }
} );
