const { contextBridge, remote, ipcRenderer } = require('electron')

// contextBridge.exposeInMainWorld( 'versions', {
//     node: () => process.versions.node,
//     chrome: () => process.versions.chrome,
//     electron: () => process.versions.electron,
//     // we can also expose variables, not just functions
// } );

contextBridge.exposeInMainWorld( 'browserWindow', {
    close: () => {
        remote.getCurrentWindow().close();
    },
    setVersionNumberViewed: ( value ) => {
        ipcRenderer.send( 'settings:set:lastViewedUpdateNotes', value );
    }
} );