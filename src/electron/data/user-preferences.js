const { ipcMain, BrowserWindow, dialog } = require( "electron" );
const Store = require( './store' );
const ForwardRef = require( '../forward-ref' );
const path = require( 'path' );
const fs = require( 'fs' );
const { AuthorModel } = require( './models/sharing-service' );
const { FctStylesModel } = require( './models/fct' );
const { StyleProperties } = require( './models/common' );
const archiver = require( 'archiver' );
const LogBootstrapper = require( "../log-bootstrap" );
const { DeathRecapPreferences } = require( '../data/models/death-recap' );

const possibleEqFolders = [
    '\\users\\public\\Everquest',
    '\\Users\\Public\\Daybreak Game Company\\Installed Games\\Everquest',
    '\\Daybreak Game Company\\Installed Games\\Everquest',
    '\\Games\\Everquest',
    '\\Everquest',
    '\\Program Files\\Steam\\steamapps\\Everquest',
    '\\Program Files\\Steam\\steamapps\\Everquest Live',
    '\\Steam\\steamapps\\Everquest',
    '\\Steam\\steamapps\\Everquest Live',
    '\\steamapps\\Everquest',
    '\\steamapps\\Everquest Live',
];

/** @type {(() => void)[]} */
const prefChangeListeners = [];

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
     * fctStyles: FctStylesModel,
     * deathRecap: DeathRecapPreferences,
     * minimizeToTrayOnLoad: boolean,
     * lastViewedUpdateNotes: string,
     * }}
     */
    #data;

    /** @type {boolean} */
    get minimizeToTrayOnLoad() {
        return this.#data.minimizeToTrayOnLoad;
    }
    set minimizeToTrayOnLoad( val ) {
        this.#data.minimizeToTrayOnLoad = val;
        this.storeDataFile( this.#data );
    }

    /** @type {string} */
    get lastViewedUpdateNotes() {
        return this.#data.lastViewedUpdateNotes;
    }
    set lastViewedUpdateNotes( val ) {
        this.#data.lastViewedUpdateNotes = val;
        this.storeDataFile( this.#data );
    }

    /** @type {DeathRecapPreferences} */
    get deathRecap() {
        return this.#data.deathRecap;
    }
    set deathRecap( val ) {
        this.#data.deathRecap = val;
        this.storeDataFile( this.#data );
    }

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

    /** @type {string} */
    get alertOverlayId() {
        return this.#data.alertOverlayId;
    }
    set alertOverlayId( val ) {
        this.#data.alertOverlayId = val;
        this.storeDataFile( this.#data );
    }

    /** @type {boolean} */
    get setupCompleted() {
        return this.#data.setupCompleted;
    }
    set setupCompleted( val ) {
        this.#data.setupCompleted = val;
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

    get fctShowCriticalsInline() {
        return this.#data.fctShowCriticalsInline === true;
    }
    set fctShowCriticalsInline( val ) {
        this.#data.fctShowCriticalsInline = val === true;
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

    get fctStyles() {
        return this.#data.fctStyles;
    }
    set fctStyles( val ) {
        this.#data.fctStyles = val;
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

    /** @type {Record<string, any>} */
    get persistentStorage() {
        return this.#data.persistentStorage;
    }
    set persistentStorage( val ) {
        this.#data.persistentStorage = val;
    }

    /** @type {import("electron").Rectangle} */
    get rendererBounds() {
        return this.#data.rendererBounds;
    }
    set rendererBounds( val ) {
        this.#data.rendererBounds = val;
        this.storeDataFile( this.#data );
    }

    /** @type {boolean} */
    get enableQuickShareImports() {
        return this.#data.enableQuickShareImports === true;
    }
    set enableQuickShareImports( val ) {
        this.#data.enableQuickShareImports = val === true;
        this.storeDataFile( this.#data );
    }

    /** @type {boolean} */
    get glowOnStartup() {
        return this.#data.glowOnStartup === true;
    }
    set glowOnStartup( val ) {
        this.#data.glowOnStartup = val === true;
        this.storeDataFile( this.#data );
    }

    /** @type {(fctStyles: FctStylesModel) => void[]} */
    onFctStyleChanges = [];

    constructor() {
        super( {
            // We'll call our data file 'user-preferences'
            configName: 'user-preferences',
            defaults: { logFile: null, windowBounds: { width: 800, height: 600, x: undefined, y: undefined } }
        } );
        // var defaults = { windowBounds: { width: 800, height: 600 } };
        
        this.#data = this.parseDataFile();

        if ( !this.#data.version || this.#data.version < 3 ) {
            
            this.#data.fctStyles = new FctStylesModel();
            
            this.#data.fctStyles.fctDmgOutStyle = new StyleProperties();
            this.#data.fctStyles.fctDmgOutStyle.fontSize = 32;
            this.#data.fctStyles.fctDmgOutStyle.lineHeight = 95;
            this.#data.fctStyles.fctDmgOutStyle.fontWeight = 700;
            this.#data.fctStyles.fctDmgOutStyle.glowSize = 10;

            this.#data.fctStyles.fctDmgInStyle = new StyleProperties();
            this.#data.fctStyles.fctDmgInStyle.fontSize = 32;
            this.#data.fctStyles.fctDmgInStyle.lineHeight = 95;
            this.#data.fctStyles.fctDmgInStyle.fontWeight = 700;
            this.#data.fctStyles.fctDmgInStyle.fontColor = '#b71c1c';
            this.#data.fctStyles.fctDmgInStyle.glowSize = 10;

            this.#data.fctStyles.fctSpellDmgOutStyle = new StyleProperties();
            this.#data.fctStyles.fctSpellDmgOutStyle.fontSize = 32;
            this.#data.fctStyles.fctSpellDmgOutStyle.lineHeight = 95;
            this.#data.fctStyles.fctSpellDmgOutStyle.fontWeight = 700;
            this.#data.fctStyles.fctSpellDmgOutStyle.glowSize = 10;

            this.#data.fctStyles.fctSpellDmgInStyle = new StyleProperties();
            this.#data.fctStyles.fctSpellDmgInStyle.fontSize = 32;
            this.#data.fctStyles.fctSpellDmgInStyle.lineHeight = 95;
            this.#data.fctStyles.fctSpellDmgInStyle.fontWeight = 700;
            this.#data.fctStyles.fctSpellDmgInStyle.fontColor = '#b71c1c';
            this.#data.fctStyles.fctSpellDmgInStyle.glowSize = 10;

            this.#data.fctStyles.fctHealingOutStyle = new StyleProperties();
            this.#data.fctStyles.fctHealingOutStyle.fontSize = 32;
            this.#data.fctStyles.fctHealingOutStyle.lineHeight = 95;
            this.#data.fctStyles.fctHealingOutStyle.fontWeight = 700;
            this.#data.fctStyles.fctHealingOutStyle.fontColor = '#42a5f5';
            this.#data.fctStyles.fctHealingOutStyle.glowSize = 10;

            this.#data.fctStyles.fctHealingInStyle = new StyleProperties();
            this.#data.fctStyles.fctHealingInStyle.fontSize = 32;
            this.#data.fctStyles.fctHealingInStyle.lineHeight = 95;
            this.#data.fctStyles.fctHealingInStyle.fontWeight = 700;
            this.#data.fctStyles.fctHealingInStyle.fontColor = '#42a5f5';
            this.#data.fctStyles.fctHealingInStyle.glowSize = 10;

            this.#data.fctStyles.fctSkillStyle = new StyleProperties();
            this.#data.fctStyles.fctSkillStyle.fontSize = 12;
            this.#data.fctStyles.fctSkillStyle.fontWeight = 400;
            this.#data.fctStyles.fctSkillStyle.fontColor = '#005aff';

            this.#data.version = 3;
            this.storeDataFile( this.#data );

        }
        if ( !this.#data.version || this.#data.version < 4 ) {
            
            // QuickSharing should be enabled by default, so we use database
            // upgrade to set that state.
            this.#data.enableQuickShareImports = true;
            this.#data.version = 4;
            this.storeDataFile( this.#data );

        }
        if ( !this.#data.version || this.#data.version < 5 ) {
            
            // Enable the glow on startup.
            this.#data.glowOnStartup = true;
            this.#data.version = 5;
            this.storeDataFile( this.#data );

        }
        
    }










    /**
     * Executes handler when specific changes have been made.
     * 
     * @param {() => void} fn Handler method executed after changes have been made.
     */
    onChanges( fn ) {
        prefChangeListeners.push( fn );
    }










    /**
     * Emits changes via the change listeners.
     */
    emitChanges() {
        prefChangeListeners.forEach( fn => fn() );
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
     * @param {ForwardRef<BrowserWindow>} mainWindowRef The main window of the application.
     * @param {function} sendTick The send tick method.
     * @param {ForwardRef<LogBootstrapper>} logBootstrapRef The main window of the application.
     */
    attachIpcEvents( mainWindowRef, sendTick, logBootstrapRef ) {

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

        ipcMain.on( 'settings:set:fctShowCriticalsInline', ( event, arg ) => {
            this.fctShowCriticalsInline = arg;
            this.emitChanges();
        } );
        
        ipcMain.on( 'settings:set:quickShareImports', ( event, arg ) => {
            this.enableQuickShareImports = arg;
            sendTick();
        } );

        ipcMain.on( 'settings:get:quickShareImports', ( event ) => {
            event.sender.webContents.send( 'settings:get:quickShareImports', this.enableQuickShareImports );
        } );
        
        ipcMain.on( 'settings:set:glowOnStartup', ( event, arg ) => {
            this.glowOnStartup = arg;
            sendTick();
        } );

        ipcMain.on( 'settings:get:glowOnStartup', ( event ) => {
            event.sender.webContents.send( 'settings:get:glowOnStartup', this.glowOnStartup );
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
        
        ipcMain.on( 'settings:set:fctStyles', ( event, arg ) => {
            this.fctStyles = arg;
            this.onFctStyleChanges?.forEach( fn => fn( this.fctStyles ) );
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

        ipcMain.on( 'settings:set:minimizeToTrayOnLoad', ( event, minimizeToTrayOnLoad ) => {
            this.minimizeToTrayOnLoad = minimizeToTrayOnLoad;
        } );

        ipcMain.on( 'settings:get:minimizeToTrayOnLoad', ( event ) => {
            event.sender.webContents.send( 'settings:get:minimizeToTrayOnLoad', this.minimizeToTrayOnLoad );
        } );

        ipcMain.on( 'settings:set:lastViewedUpdateNotes', ( event, lastViewedUpdateNotes ) => {
            this.lastViewedUpdateNotes = lastViewedUpdateNotes;
        } );

        ipcMain.on( 'settings:get:lastViewedUpdateNotes', ( event ) => {
            event.sender.webContents.send( 'settings:get:lastViewedUpdateNotes', this.lastViewedUpdateNotes );
        } );

        ipcMain.on( 'settings:set:deathRecap', ( event, deathRecap ) => {
            this.deathRecap = deathRecap;
        } );

        ipcMain.on( 'settings:get:deathRecap', ( event ) => {
            event.sender.webContents.send( 'settings:get:deathRecap', this.deathRecap );
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

        ipcMain.on( 'settings:set:alertOverlayId', ( event, alertOverlayId ) => {
            this.alertOverlayId = alertOverlayId;
        } );

        ipcMain.on( 'settings:get:alertOverlayId', ( event ) => {
            event.sender.webContents.send( 'settings:get:alertOverlayId', this.alertOverlayId );
        } );

        ipcMain.on( 'settings:set:damageDealtOverlayId', ( event, damageDealtOverlayId ) => {
            this.damageDealtOverlayId = damageDealtOverlayId;
        } );

        ipcMain.on( 'settings:get:damageDealtOverlayId', ( event ) => {
            event.sender.webContents.send( 'settings:get:damageDealtOverlayId', this.damageDealtOverlayId );
        } );

        ipcMain.on( 'settings:get:damageReceivedOverlayId', ( event ) => {
            event.sender.webContents.send( 'settings:get:damageReceivedOverlayId', this.damageReceivedOverlayId );
        } );

        ipcMain.on( 'settings:get:fctStyles', ( event ) => {
            event.sender.webContents.send( 'settings:get:fctStyles', this.fctStyles );
        } );

        ipcMain.on( 'settings:set:setupCompleted', ( event, setupCompleted ) => {
            this.setupCompleted = setupCompleted;
        } );

        ipcMain.on( 'settings:get:setupCompleted', ( event ) => {
            event.sender.webContents.send( 'settings:get:setupCompleted', this.setupCompleted );
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

        ipcMain.on( 'settings:download-log', () => {
            let logPath = path.join( this.userDataPath, 'logs', 'main.log' );

            if ( fs.existsSync( logPath ) ) {
                let logZip = path.join( this.userDataPath, 'log.zip' );
                let output = fs.createWriteStream( logZip );
                let zip = archiver( 'zip' );
                
                output.on( 'close', () => {

                    let options = {
                        //Placeholder 1
                        title: "EQ Nag - Log File",
                
                        //Placeholder 2
                        defaultPath: "nag-log.zip",
                
                        //Placeholder 4
                        buttonLabel: "Save Log File",
                
                        //Placeholder 3
                        filters: [
                            { name: 'Zip', extensions: [ 'zip' ] }
                        ]
                    }

                    const WIN = BrowserWindow.getFocusedWindow();

                    dialog.showSaveDialog( WIN, options ).then( saveResult => {
                        if ( !saveResult.canceled ) {
                            fs.copyFile( logZip, saveResult.filePath, () => { } );
                        }
                    } );
                } );

                zip.pipe( output );
                zip.file( logPath, { name: 'main.log' } );
                zip.finalize();
            }

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
        
        

        ipcMain.on( 'settings:get:persistent-storage', ( event ) => {
            event.sender.webContents.send( 'settings:get:persistent-storage', this.persistentStorage );
        } );

        ipcMain.on( 'settings:set:persistent-storage-value',
            /**
             * @param {{keys: string[], value: string}} storeValue
             */
            ( event, storeValue ) => {
                this.persistentStorage = this.persistentStorage ? this.persistentStorage : {};

                let storage = this.persistentStorage;
                let mi = ( storeValue.keys?.length ?? 0 ) - 1;

                for ( let i = 0; i < storeValue.keys?.length ?? 0; i++ ) {
                    if ( i === mi ) {
                        storage[ storeValue.keys[ i ] ] = storeValue.value;
                    } else {
                        if ( !storage[ storeValue.keys[ i ] ] ) {
                            storage[ storeValue.keys[ i ] ] = {};
                        }
                        storage = storage[ storeValue.keys[ i ] ];
                    }
                }
                
                this.storeDataFile( this.#data );
                logBootstrapRef.reference.sendToEach( 'settings:get:persistent-storage', this.persistentStorage );
            } );

    }

}

module.exports = UserPreferencesStore;
