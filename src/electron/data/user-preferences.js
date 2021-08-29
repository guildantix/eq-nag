const { ipcMain } = require( "electron" );
const Store = require( './store' );
const ForwardRef = require( '../forward-ref' );
const fs = require( 'fs' );
const { AuthorModel } = require( './models/sharing-service' );

const possibleEqFolders = [
    '\\users\\public\\Everquest',
    '\\Users\\Public\\Daybreak Game Company\\Installed Games\\Everquest',
    '\\Daybreak Game Company\\Installed Games\\Everquest',
    '\\Games\\Everquest',
    '\\Everquest',
];

/**
 * Get windows drives
 * */
function get_win_drives( success_cb, error_cb ) {
    var stdout = '';
    var spawn = require( 'child_process' ).spawn,
        list = spawn( 'cmd' );

    list.stdout.on( 'data', function ( data ) {
        stdout += data;
    } );

    list.stderr.on( 'data', function ( data ) {
        console.log( 'stderr: ' + data );
    } );

    list.on( 'exit', function ( code ) {
        if ( code == 0 ) {
            console.log( stdout );
            var data = stdout.split( '\r\n' );
            data = data.splice( 4, data.length - 7 );
            data = data.map( Function.prototype.call, String.prototype.trim );
            success_cb( data );
        } else {
            console.log( 'child process exited with code ' + code );
            error_cb();
        }
    } );
    list.stdin.write( 'wmic logicaldisk get caption\n' );
    list.stdin.end();
}

class UserPreferencesStore extends Store {

    /** The data store for this object.
     * @type {{
     * phoneticTransforms: Record<string, string>,
     * ignoreGinaObjects: string[],
     * }}
     */
    #data;

    /** @type {string} */
    get detrimentalOverlayId() {
        return this.#data.detrimentalOverlayId;
    }
    set detrimentalOverlayId( val ) {
        this.#data.detrimentalOverlayId = val;
        this.storeDataFile( this.#data );
    }

    /** @type {string} */
    get beneficialOverlayId() {
        return this.#data.beneficialOverlayId;
    }
    set beneficialOverlayId( val ) {
        this.#data.beneficialOverlayId = val;
        this.storeDataFile( this.#data );
    }

    /** @type {AuthorModel} */
    get author() {
        return this.#data.author;
    }
    set author( val ) {
        this.#data.author = val;
        this.storeDataFile( this.#data );
    }

    get windowHeight() {
        return this.#data.windowBounds.height;
    }
    set windowHeight( val ) {
        this.#data.windowBounds.height = val;
        this.storeDataFile( this.#data );
    }

    get windowWidth() {
        return this.#data.windowBounds.width;
    }
    set windowWidth( val ) {
        this.#data.windowBounds.width = val;
        this.storeDataFile( this.#data );
    }

    get windowX() {
        return this.#data.windowBounds.x;
    }
    set windowX( val ) {
        this.#data.windowBounds.x = val;
        this.storeDataFile( this.#data );
    }

    get windowY() {
        return this.#data.windowBounds.y;
    }
    set windowY( val ) {
        this.#data.windowBounds.y = val;
        this.storeDataFile( this.#data );
    }

    get logFile() {
        return this.#data.logFile;
    }
    set logFile( val ) {
        this.#data.logFile = val;
        this.storeDataFile( this.#data );
    }

    get voiceIndex() {
        if ( this.#data && this.#data.voiceIndex > -1 ) {
            return this.#data.voiceIndex;
        } else {
            return 0;
        }
    }
    set voiceIndex( val ) {
        this.#data.voiceIndex = val;
        this.storeDataFile( this.#data );
    }

    get enableFct() {
        return this.#data.enableFct === true;
    }
    set enableFct( val ) {
        this.#data.enableFct = val === true;
        this.storeDataFile( this.#data );
    }

    get damageDealtOverlayId() {
        return this.#data.damageDealtOverlayId;
    }
    set damageDealtOverlayId( val ) {
        this.#data.damageDealtOverlayId = val;
        this.storeDataFile( this.#data );
    }

    get damageReceivedOverlayId() {
        return this.#data.damageReceivedOverlayId;
    }
    set damageReceivedOverlayId( val ) {
        this.#data.damageReceivedOverlayId = val;
        this.storeDataFile( this.#data );
    }

    get hasExtendedDotFocus() {
        return this.#data.hasExtendedDotFocus;
    }
    set hasExtendedDotFocus( val ) {
        this.#data.hasExtendedDotFocus = val;
        // this.storeDataFile( this.#data );
    }

    get extendedDotFocusPercent() {
        return this.#data.extendedDotFocusPercent;
    }
    set extendedDotFocusPercent( val ) {
        this.#data.extendedDotFocusPercent = val;
        // this.storeDataFile( this.#data );
    }

    get extendedDotFocusDecayLevel() {
        return this.#data.extendedDotFocusDecayLevel;
    }
    set extendedDotFocusDecayLevel( val ) {
        this.#data.extendedDotFocusDecayLevel = val;
    }

    get everquestInstallFolder() {
        return this.#data.everquestInstallFolder;
    }
    set everquestInstallFolder( val ) {
        this.#data.everquestInstallFolder = val;
    }

    /** @type {Record<string, string>} */
    get phoneticTransforms() {
        return this.#data.phoneticTransforms;
    }
    set phoneticTransforms( val ) {
        this.#data.phoneticTransforms = val;
    }

    /** @type {string[]} */
    get ignoreGinaObjects() {
        return this.#data.ignoreGinaObjects;
    }
    set ignoreGinaObjects( val ) {
        this.#data.ignoreGinaObjects = val;
    }

    constructor() {
        super( {
            // We'll call our data file 'user-preferences'
            configName: 'user-preferences',
            defaults: { logFile: null, windowBounds: { width: 800, height: 600, x: undefined, y: undefined } }
        } );
        // var defaults = { windowBounds: { width: 800, height: 600 } };
        
        this.#data = this.parseDataFile();
        
    }










    /**
     * Returns the x and y position of the overlay editor window.
     * 
     * @param {string} overlayId The id of the overlay.
     */
    getOverlayEditorPosition( overlayId ) {
        this.#data.overlayEditorPositions = this.#data.overlayEditorPositions != null ? this.#data.overlayEditorPositions : {};

        return this.#data.overlayEditorPositions[ overlayId ];
    }










    /**
     * Stores the x and y positions of the specified overlay window.
     * 
     * @param {string} overlayId The id of the overlay
     * @param {number} x The x position of the window.
     * @param {number} y The y position of the window.
     */
    setOverlayeEditorPosition( overlayId, x, y ) {
        this.#data.overlayEditorPositions = this.#data.overlayEditorPositions != null ? this.#data.overlayEditorPositions : {};
        this.#data.overlayEditorPositions[ overlayId ] = { x: x, y: y };
        this.storeDataFile( this.#data );
    }










    /**
     * Attaches store events to ipc main and dispatches react events to the main window.
     * 
     * @param {ForwardRef} mainWindowRef The main window of the application.
     * @param {function} sendTick The send tick method.
     */
    attachIpcEvents( mainWindowRef, sendTick ) {

        ipcMain.on( 'log:select', ( event, arg ) => {
            this.logFile = arg;
            event.sender.send( 'log:changed', arg );
        } );
        
        ipcMain.on( 'voice:select', ( event, arg ) => {
            this.voiceIndex = arg;
        } );
        
        ipcMain.on( 'settings:set:fct', ( event, arg ) => {
            this.enableFct = arg;
        } );
        
        ipcMain.on( 'settings:set:focus-effects', ( event, arg ) => {
            
            this.hasExtendedDotFocus = arg.hasExtendedDotFocus;
            this.extendedDotFocusPercent = arg.extendedDotFocusPercent;
            this.extendedDotFocusDecayLevel = arg.extendedDotFocusDecayLevel;

            this.storeDataFile( this.#data );

        } );
        
        ipcMain.on( 'settings:set:damageDealtOverlayId', ( event, arg ) => {
            this.damageDealtOverlayId = arg;
        } );
        
        ipcMain.on( 'settings:set:damageReceivedOverlayId', ( event, arg ) => {
            this.damageReceivedOverlayId = arg;
        } );

        ipcMain.on( 'settings:set:everquest-folder', ( event, folder ) => {
            console.log( 'saving eq folder', folder );
            this.everquestInstallFolder = folder;
            this.storeDataFile( this.#data );
        } );

        ipcMain.on( 'settings:get:everquest-folder', ( event, arg ) => {
            if ( this.#data.everquestInstallFolder != null && fs.existsSync( this.#data.everquestInstallFolder ) ) {
                // event.sender.webContents.send( 'settings:get:everquest-folder', this.#data.everquestInstallFolder );
                event.sender.webContents.send( 'settings:get:everquest-folder', this.#data.everquestInstallFolder );
            } else {
                get_win_drives( drives => {
                    this.#data.everquestInstallFolder = null;

                    drives.forEach( drive => {
                        possibleEqFolders.forEach( eqFolder => {
                            if ( fs.existsSync( drive + eqFolder + '\\LaunchPad.exe' ) ) {
                                this.#data.everquestInstallFolder = drive + eqFolder;
                            }
                        } );
                    } );

                    this.storeDataFile( this.#data );
                    event.sender.webContents.send( 'settings:get:everquest-folder', this.#data.everquestInstallFolder );
                } );
            }
        } );

        ipcMain.on( 'settings:get:phonetic-transforms', ( event ) => {
            event.sender.webContents.send( 'settings:get:phonetic-transforms', this.#data.phoneticTransforms );
        } );

        ipcMain.on( 'settings:set:author', ( event, author ) => {
            this.author = author;
        } );

        ipcMain.on( 'settings:get:author', ( event ) => {
            event.sender.webContents.send( 'settings:get:author', this.author );
        } );

        ipcMain.on( 'settings:set:detrimentalOverlayId', ( event, detrimentalOverlayId ) => {
            this.detrimentalOverlayId = detrimentalOverlayId;
        } );

        ipcMain.on( 'settings:get:detrimentalOverlayId', ( event ) => {
            event.sender.webContents.send( 'settings:get:detrimentalOverlayId', this.detrimentalOverlayId );
        } );

        ipcMain.on( 'settings:set:beneficialOverlayId', ( event, beneficialOverlayId ) => {
            this.beneficialOverlayId = beneficialOverlayId;
        } );

        ipcMain.on( 'settings:get:beneficialOverlayId', ( event ) => {
            event.sender.webContents.send( 'settings:get:beneficialOverlayId', this.beneficialOverlayId );
        } );

        ipcMain.on( 'settings:set:phonetic-transforms',
            /**
             * @param {Record<string, string>} transforms
             */
            ( event, transforms ) => {
                this.#data.phoneticTransforms = transforms;
                this.storeDataFile( this.#data );
                sendTick();
            } );

        ipcMain.on( 'settings:get:ignore-gina-objects', ( event ) => {
            event.sender.webContents.send( 'settings:get:ignore-gina-objects', this.#data.ignoreGinaObjects );
        } );

        ipcMain.on( 'settings:set:ignore-gina-objects',
            /**
             * @param {string[]} ignoredObjects
             */
            ( event, ignoredObjects ) => {
                this.#data.ignoreGinaObjects = ignoredObjects;
                this.storeDataFile( this.#data );
                sendTick();
            } );

    }

}

module.exports = UserPreferencesStore;
