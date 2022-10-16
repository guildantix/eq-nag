const { contextBridge, remote, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld( 'browserWindow', {
    close: () => {
        remote.getCurrentWindow().close();
    },
    setVersionNumberViewed: ( value ) => {
        ipcRenderer.send( 'settings:set:lastViewedUpdateNotes', value );
    }
} );
