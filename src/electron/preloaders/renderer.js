const { contextBridge, ipcRenderer } = require( 'electron' );
const { getCurrentWindow, screen } = require( '@electron/remote' );

const channelPrefixes = [
    'app',
    'overlay',
    'clipboard',
    'log',
    'audio-file',
    'cache',
    'combat-database', 
    'chat-room',
    'combat',
];
let mouseEnabled = false;

contextBridge.exposeInMainWorld( 'api', {
    // TODO: THis should be updated and methods using require should be methods on the preloader.
    getRenderer: () => require( '../threads/renderer' ),
    setIgnoreMouseEvents: () => {
        if ( mouseEnabled ) {
            mouseEnabled = false;
            getCurrentWindow().setIgnoreMouseEvents( true, { forward: false } );
        }
    },
    setHandleMouseEvents: () => {
        if ( !mouseEnabled ) {
            mouseEnabled = true;
            getCurrentWindow().setIgnoreMouseEvents( false );
        }
    },
    getMouseUpdate: () => {
        const { x, y } = screen.getCursorScreenPoint();
        return { x, y };
    },
    showSettings: ( name ) => {
        ipcRenderer.send( 'show-settings', name );
    }
} );
