const { contextBridge, ipcRenderer } = require( 'electron' );
const { getCurrentWindow, screen } = require( '@electron/remote' );

contextBridge.exposeInMainWorld( 'api', {
    // TODO: Update death recap to use preloader methods instead of require.
    getDeathRecap: () => require( '../windows/death-recap' ),
} );
