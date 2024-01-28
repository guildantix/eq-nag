const { contextBridge, ipcRenderer } = require( 'electron' );
const { getCurrentWindow, screen } = require( '@electron/remote' );

const channelPrefixes = [ 'app', 'overlay', 'clipboard', 'log', 'audio-file', 'cache' ];

contextBridge.exposeInMainWorld( 'api', {
    // TODO: THis should be updated and methods using require should be methods on the preloader.
    getRenderer: () => require( '../threads/renderer' ),
    setIgnoreMouseEvents: () => {
        getCurrentWindow().setIgnoreMouseEvents( true, { forward: true } );
    },
    setHandleMouseEvents: () => {
        getCurrentWindow().setIgnoreMouseEvents( false );
    }
} );
