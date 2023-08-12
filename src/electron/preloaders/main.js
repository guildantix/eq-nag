const { contextBridge, ipcRenderer } = require( 'electron' );
const { getCurrentWindow, screen } = require( '@electron/remote' );
const { DateUtilities } = require( '../utilities/dates' );
const StyleSheetUtil = require( '../utilities/style-sheet' );
const log = require( 'electron-log' );

const channelPrefixes = [
    'app',
    'settings',
    'dkp',
    'log',
    'voice',
    'clipboard',
    'trigger',
    'window',
    'main',
    'death-recap',
    'gina',
    'folders',
    'overlay',
    'renderer',
    'overlays',
    'character',
    'game-resources',
    'audio-file',
    'file',
    'pkg',
    'quickShare',
    'tags',
    'zones',
    'color',
    'orphaned_trigger_warning',
    'quickshare_captured',
    'quicksharePackage_captured',
    'update_downloaded',
    'dialog',
    'tick',
    'console',
    'context',
    'archive',
    'scraper',
    'simulation',
];

const styleSheetUtil = new StyleSheetUtil();

function validChannel( channel ) {
    return channelPrefixes.indexOf( channel.split( /:/gi )[ 0 ] ) > -1;
}

contextBridge.exposeInMainWorld( 'api', {
    ipc: {
        send: ( channel, data ) => {
            if ( validChannel( channel ) ) {
                ipcRenderer.send( channel, data );
            } else {
                console.error( 'Invalid comm channel!', channel );
            }
        },
        once: ( channel, handler ) => {
            if ( validChannel( channel ) ) {
                ipcRenderer.once( channel, handler );
            } else {
                console.error( 'Invalid comm channel!', channel );
            }
        },
        on: ( channel, handler ) => {
            if ( validChannel( channel ) ) {
                ipcRenderer.on( channel, handler );
            } else {
                console.error( 'Invalid comm channel!', channel );
            }
        },
        invoke: ( channel, ...args ) => {
            if ( validChannel( channel ) ) {
                return ipcRenderer.invoke( channel, ...args );
            } else {
                console.error( 'Invalid comm channel!', channel );
            }
            return null;
        }
    },
    close: () => {
        getCurrentWindow().close();
    },
    setVersionNumberViewed: ( value ) => {
        ipcRenderer.send( 'settings:set:lastViewedUpdateNotes', value );
    },
    utils: {
        dates: {
            getDurationLabel: DateUtilities.getDurationLabel,
        },
        styles: {
            textOutline: ( hex, trans ) => {
                console.log( 'values out', styleSheetUtil.templates.textOutline( hex, trans ) );
                return styleSheetUtil.templates.textOutline( hex, trans );
            },
            textGlow: styleSheetUtil.templates.textGlow,
        }
    },
    logger: {
        info: log.info,
    }
} );
