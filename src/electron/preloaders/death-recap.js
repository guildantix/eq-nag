const { contextBridge, ipcRenderer } = require( 'electron' );
const { getCurrentWindow, screen } = require( '@electron/remote' );

contextBridge.exposeInMainWorld( 'api', {
    getDeathRecap: () => require( '../windows/death-recap' ),
} );
