const { contextBridge } = require( 'electron' );

contextBridge.exposeInMainWorld( 'api', {
    getPushRecap: () => require( '../windows/push-recap' ),
} );
