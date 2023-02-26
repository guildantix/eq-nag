const { app, BrowserWindow, ipcMain, screen } = require( "electron" );
const Store = require( './store' );
const _ = require( 'lodash' );
const {
    Trigger,
    TriggerFolder,
    TriggerAction,
    ActionTypes,
    Tag,
    ImportTypes,
    TimerRestartBehaviors,
    TriggerPackageMetaModel,
    TriggerPackageVersion,
    PackageFolder,
    PackageTrigger,
    PackageFileModel,
    QuickShareVersion,
    QuickShareModel,
    QuickShareMetaModel,
    TriggerStoreModel,
} = require( './models/trigger' );
const ForwardRef = require( '../forward-ref' );
const customAlphabet = require( 'nanoid' ).customAlphabet;
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const idLen = 16;
const nanoid = customAlphabet( alphabet, 16 );
const ArrayUtilities = require( '../utilities/arrays' );
const StringUtilities = require( "../utilities/string" );
const Fuse = require( 'fuse.js' );
const eqZones = require( './models/everquest-zones' );
const FilesDatabaseStore = require( "./files-database" );
const UserPreferencesStore = require( "./user-preferences" );
const { migrateTriggerData } = require( "./migrations/trigger-database-migrations" );

/** @type {FilesDatabaseStore} */
var _fileStore;
/** @type {UserPreferencesStore} */
var _userPreferences;

/** @type {Fuse.fuseOptions_tags} */
const fuseOptions_tags = {
    // isCaseSensitive: false,
    includeScore: true,
    // shouldSort: true,
    // includeMatches: false,
    // findAllMatches: false,
    // minMatchCharLength: 1,
    // location: 0,
    // threshold: 0.6,
    // distance: 100,
    // useExtendedSearch: false,
    // ignoreLocation: false,
    // ignoreFieldNorm: false,
    keys: [
        { name: 'name', weight: 1.0 },
        { name: 'actions.displayText', weight: 1.0 },
        { name: 'actions.endingSoonText', weight: 1.0 },
        { name: 'actions.endingSoonSpeakPhrase', weight: 1.0 },
        { name: 'actions.endingClipboardText', weight: 1.0 },
        { name: 'actions.endedText', weight: 1.0 },
        { name: 'actions.endedClipboardText', weight: 1.0 },
        { name: 'actions.endedSpeakPhrase', weight: 1.0 },
        { name: 'comments', weight: 0.9 },
        { name: 'allakhazamUrl', weight: 0.9 },
        { name: 'capturePhrases.phrase', weight: 0.9 },
        // We provide low weights on the id fields to enforce an exact match.
        { name: 'triggerId', weight: 0.01 },
        { name: 'folderId', weight: 0.01 },
    ]
};

/** @type {Fuse.fuseOptions_tags} */
const fuseOptions_names = {
    includeScore: true,
    keys: [
        { name: 'name', weight: 1.0 },
    ]
};

/** @type {Fuse.fuseOptions_tags} */
const fuseOptions_comments = {
    includeScore: true,
    keys: [
        { name: 'comments', weight: 1.0 },
    ]
};

/** @type {Fuse.fuseOptions_tags} */
const fuseOptions_phrases = {
    includeScore: true,
    keys: [
        { name: 'capturePhrases.phrase', weight: 1.0 },
    ]
};

/** @type {Fuse.fuseOptions_tags} */
const fuseOptions_speak = {
    includeScore: true,
    keys: [
        { name: 'actions.endingSoonSpeakPhrase', weight: 1.0 },
        { name: 'actions.endedSpeakPhrase', weight: 1.0 },
    ]
};

/** @type {Fuse.fuseOptions_tags} */
const fuseOptions_displayText = {
    includeScore: true,
    keys: [
        { name: 'actions.displayText', weight: 1.0 },
        { name: 'actions.endingSoonText', weight: 1.0 },
        { name: 'actions.endedText', weight: 1.0 },
    ]
};

/** @type {Fuse.fuseOptions_tags} */
const fuseOptions_clipboard = {
    includeScore: true,
    keys: [
        { name: 'actions.endingClipboardText', weight: 1.0 },
        { name: 'actions.endedClipboardText', weight: 1.0 },
    ]
};



class TriggerDatabaseStore extends Store {

    /** 
     * The data store for this object.
     * @type {TriggerStoreModel}
     * */
    #data;

    /**
     * If true, orphaned triggers were found and moved to the orphan folder.
     * @type {boolean}
     */
    #orphanedFound = false;

    get count() {
        return this.#data?.triggers?.length;
    }

    constructor() {
        super( {
            configName: "trigger-database",
            defaults: { triggers: [], folders: [], tags: [], installedPackages: [] },
        } );
        
        this.#data = this.parseDataFile();
        this.findOrphanedTriggers();
        this.processPredefinedTriggers();

        app.on( 'ready', () => {
            migrateTriggerData( this.#data, this.configName, data => {
                this.#data = data;
                this.storeDataFile( this.#data );
            } );
        } );
    }










    /**
     * Loads predefined triggers and replaces any changes made by the user with the predfined value.
     */
    processPredefinedTriggers() {
        let captureCastingTrigger = { "triggerId": "trGkfio6z2xs6hAh", "name": "Capture spell casting", "enabled": true, "capturePhrases": [ { "useRegEx": true, "requirePreviousPhrase": false, "duration": null, "phrase": "^You begin casting (.*)\\.", "phraseId": "v7GDFrDCcFwhTAOP" }, { "useRegEx": true, "requirePreviousPhrase": false, "duration": null, "phraseId": "SmZAE0oEzuhq1cqh", "phrase": "^Your ${SpellBeingCast} spell is interrupted\\." }, { "useRegEx": true, "requirePreviousPhrase": false, "duration": null, "phraseId": "iNy1LoUUFcXnaHws", "phrase": "^(.*) resisted your ${SpellBeingCast}" }, { "useRegEx": true, "requirePreviousPhrase": false, "duration": null, "phraseId": "CC31CtgDiqwi8xV4", "phrase": "^Your ${SpellBeingCast} spell did not take hold\\. \\(Blocked by (.*)\\.\\)" }, { "requirePreviousPhrase": false, "duration": null, "phraseId": "9ccr5pJj08H9rEi7", "phrase": "^Your ${SpellBeingCast} spell fizzles!$", "useRegEx": true } ], "comments": "This trigger will capture the spell casting of the caster and store the spell being cast into a variable for use with other triggers.", "actions": [ { "actionType": 5, "variableName": "SpellBeingCast", "actionId": "xygXKRSFpi3vYQ4D", "phraseId": "v7GDFrDCcFwhTAOP", "phrases": [ "v7GDFrDCcFwhTAOP" ], "restartBehavior": 0, "onlyExecuteInDev": false, "onlyStoreUsedValues": true }, { "actionType": 7, "phraseId": "SmZAE0oEzuhq1cqh", "overlayId": "gx4ySJU9Cj35xR1n", "duration": 15, "displayText": "Spell ${SpellBeingCast} was interrupted.", "actionId": "2779yyKWjlmJvIhn", "phrases": [ "SmZAE0oEzuhq1cqh", "iNy1LoUUFcXnaHws", "CC31CtgDiqwi8xV4", "9ccr5pJj08H9rEi7" ], "variableName": "SpellBeingCast", "restartBehavior": 0, "onlyExecuteInDev": false } ], "captureMethod": "Any match", "conditions": [], "classLevels": [], "predefined": true, "onlyExecuteInDev": false };

        let castingIndex = ArrayUtilities.findIndex( this.#data?.triggers, f => f.triggerId === captureCastingTrigger.triggerId );
        if ( castingIndex > -1 ) {
            this.#data.triggers[ castingIndex ] = captureCastingTrigger;
        } else {
            this.#data.triggers.push( captureCastingTrigger );
            this.storeDataFile( this.#data );
        }

        let displaySpellBeingCast = { "triggerId": "hzOXzyXsZANWGcJq", "name": "Display Variable SpellBeingCast", "enabled": true, "capturePhrases": [ { "useRegEx": true, "requirePreviousPhrase": false, "duration": null, "phraseId": "bi8mXZAgB7zGnSAc", "phrase": "^Eryndhel requests an update." } ], "comments": "", "actions": [ { "phrases": [ "bi8mXZAgB7zGnSAc" ], "actionType": 0, "overlayId": "gx4ySJU9Cj35xR1n", "displayText": "SpellBeingCast == ${SpellBeingCast}", "duration": 15, "actionId": "n95VfakBr8TbCKnE", "restartBehavior": 0 } ], "captureMethod": "Any match", "conditions": [ { "conditionId": "It3bUfInYVi4aGYB", "conditionType": 1, "variableName": "SpellBeingCast", "operatorType": 2 } ], "classLevels": [], "predefined": true, "onlyExecuteInDev": true };
        let displaySpellIndex = ArrayUtilities.findIndex( this.#data?.triggers, f => f.triggerId === displaySpellBeingCast.triggerId );
        if ( displaySpellIndex > -1 ) {
            this.#data.triggers[ displaySpellIndex ] = displaySpellBeingCast;
        } else {
            this.#data.triggers.push( displaySpellBeingCast );
            this.storeDataFile( this.#data );
        }


        let captureZone = { "triggerId": "Gpc9KuTz80s3Rw2g", "name": "Capture Zone", "enabled": true, "capturePhrases": [ { "useRegEx": true, "requirePreviousPhrase": false, "duration": null, "phraseId": "4XE1SERwjEB0rRhc", "phrase": "^You have entered (?!an area where levitation effects do not function)(.*)\\.$" }, { "requirePreviousPhrase": false, "duration": null, "phraseId": "pOZDiwwJdb8VPfXm", "phrase": "^LOADING, PLEASE WAIT\\.\\.\\.", "useRegEx": true } ], "comments": "Captures entering/leaving zones.", "actions": [ { "phrases": [ "4XE1SERwjEB0rRhc" ], "onlyExecuteInDev": false, "overrideTimerColor": null, "timerBackgroundColor": null, "useCustomColor": false, "ifEndingSoon": false, "endingDuration": null, "endingSoonChangeColor": false, "endingSoonColor": null, "endingSoonBackgroundColor": null, "endingSoonDisplayText": false, "endingSoonTextOverlayId": null, "endingSoonText": null, "endingSoonTextDuration": null, "endingSoonSpeak": false, "endingSoonSpeakPhrase": null, "remainAfterEnded": false, "remainDuration": null, "endedDisplayText": false, "endedTextOverlayId": null, "endedText": null, "endedTextDuration": null, "endedSpeak": false, "endedSpeakPhrase": null, "endedChangeColor": false, "endedColor": null, "endedBackgroundColor": null, "actionType": 0, "overlayId": "hQqWbu1vumF9GRJv", "displayText": "You have entered {1}.", "duration": 5, "actionId": "3irHXDSvHQFf3LZ5", "timerIcon": null, "timerIconDef": null, "showRemainingDuration": false, "excludeTargets": [], "endEarlyPhrases": [], "name": null, "resetCounterPhrases": [], "repeatTimer": false, "repeatCount": null, "endingClipboard": false, "endingClipboardText": null, "endedClipboard": false, "endedClipboardText": null, "audioFileId": null, "endingPlayAudio": false, "endingPlayAudioFileId": null, "endedPlayAudio": false, "endedPlayAudioFileId": null, "hideTimer": false, "endingSoonShowTimer": false, "castTime": null, "hideConditions": [], "restartBehavior": null, "textUseCustomBorder": false, "textUseCustomColor": false, "textUseCustomFont": false, "textUseCustomGlow": false, "textUseCustomSize": false, "loopBackForValue": false }, { "phrases": [ "pOZDiwwJdb8VPfXm" ], "onlyExecuteInDev": false, "overrideTimerColor": null, "timerBackgroundColor": null, "useCustomColor": false, "ifEndingSoon": false, "endingDuration": null, "endingSoonChangeColor": false, "endingSoonColor": null, "endingSoonBackgroundColor": null, "endingSoonDisplayText": false, "endingSoonTextOverlayId": null, "endingSoonText": null, "endingSoonTextDuration": null, "endingSoonSpeak": false, "endingSoonSpeakPhrase": null, "remainAfterEnded": false, "remainDuration": null, "endedDisplayText": false, "endedTextOverlayId": null, "endedText": null, "endedTextDuration": null, "endedSpeak": false, "endedSpeakPhrase": null, "endedChangeColor": false, "endedColor": null, "endedBackgroundColor": null, "actionType": 7, "variableName": "CurrentZone", "actionId": "sDiYPmjxrFRg5pI9", "timerIcon": null, "timerIconDef": null, "showRemainingDuration": false, "excludeTargets": [], "endEarlyPhrases": [], "name": null, "resetCounterPhrases": [], "repeatTimer": false, "repeatCount": null, "endingClipboard": false, "endingClipboardText": null, "endedClipboard": false, "endedClipboardText": null, "audioFileId": null, "endingPlayAudio": false, "endingPlayAudioFileId": null, "endedPlayAudio": false, "endedPlayAudioFileId": null, "hideTimer": false, "endingSoonShowTimer": false, "castTime": null, "hideConditions": [], "restartBehavior": null }, { "phrases": [ "4XE1SERwjEB0rRhc" ], "onlyExecuteInDev": false, "overrideTimerColor": null, "timerBackgroundColor": null, "useCustomColor": false, "ifEndingSoon": false, "endingDuration": null, "endingSoonChangeColor": false, "endingSoonColor": null, "endingSoonBackgroundColor": null, "endingSoonDisplayText": false, "endingSoonTextOverlayId": null, "endingSoonText": null, "endingSoonTextDuration": null, "endingSoonSpeak": false, "endingSoonSpeakPhrase": null, "remainAfterEnded": false, "remainDuration": null, "endedDisplayText": false, "endedTextOverlayId": null, "endedText": null, "endedTextDuration": null, "endedSpeak": false, "endedSpeakPhrase": null, "endedChangeColor": false, "endedColor": null, "endedBackgroundColor": null, "actionType": 5, "variableName": "CurrentZone", "actionId": "IW03jfBt5cdqU2CX", "timerIcon": null, "timerIconDef": null, "showRemainingDuration": false, "excludeTargets": [], "endEarlyPhrases": [], "name": null, "resetCounterPhrases": [], "repeatTimer": false, "repeatCount": null, "endingClipboard": false, "endingClipboardText": null, "endedClipboard": false, "endedClipboardText": null, "audioFileId": null, "endingPlayAudio": false, "endingPlayAudioFileId": null, "endedPlayAudio": false, "endedPlayAudioFileId": null, "hideTimer": false, "endingSoonShowTimer": false, "castTime": null, "hideConditions": [], "restartBehavior": null, "loopBackForValue": true } ], "captureMethod": "Any match", "conditions": [], "predefined": true, "onlyExecuteInDev": false, "allakhazamUrl": null, "classLevels": [], "score": 4.843554288349809e-12, "refIndex": 7, "ginaTriggerName": null, "importIdentifier": null, "tagIds": null, "importType": 0, "useCooldown": false, "cooldownDuration": 0, "folderId": "njGANuCzIncWIMzU" };
        let captureZoneIndex = ArrayUtilities.findIndex( this.#data?.triggers, f => f.triggerId === captureZone.triggerId );
        if ( captureZoneIndex > -1 ) {
            this.#data.triggers[ captureZoneIndex ] = captureZone;
        } else {
            this.#data.triggers.push( captureZone );
            this.storeDataFile( this.#data );
        }

    }









    
    /**
     * Finds all orphaned triggers and moves them to an Orphaned Triggers folder.
     */
    findOrphanedTriggers() {
        this.#data.triggers.forEach( trigger => {
            if ( !trigger.predefined ) {
                let folder = this.findFolderById( this.#data.folders, trigger.folderId );
                if ( !folder ) {
                    this.#orphanedFound = true;
                    // Find the orphaned triggers folder, and create it if it doesn't exist.
                    let orphanFolder = this.findOrphanedTriggerFolder();

                    trigger.folderId = orphanFolder.folderId;
                    
                }
            }
        } );
    }









    
    /**
     * Returns the orphaned trigger folder.  If the folder does not exist, it is created.
     * 
     * @returns {TriggerFolder}
     */
    findOrphanedTriggerFolder() {
        const name = 'Orphaned Triggers';
        let i = this.#data.folders.findIndex( f => f.name === name );
            
        if ( i < 0 ) {
            let orphanFolder = new TriggerFolder();

            orphanFolder.folderId = nanoid();
            orphanFolder.name = name;
            orphanFolder.expanded = false;
            orphanFolder.active = true;
            orphanFolder.comments = 'Container for orphaned triggers.';
            orphanFolder.children = [];

            this.#data.folders.push( orphanFolder );
            this.updateFolders( this.#data.folders );
        }

        return this.#data.folders.find( f => f.name === name );
    }










    /**
     * Finds the specified folder, returns undefined if not found.
     * 
     * @param {TriggerFolder[]} folders The source to search for folder id.
     * @param {string} folderId The id of the folder to find.
     */
    findFolderById( folders, folderId ) {
        for ( let i = 0; i < folders?.length; i++ ) {
            if ( folders[ i ].folderId === folderId ) {
                return folders[ i ];
            } else if ( folders[ i ]?.children?.length > 0 ) {
                let found = this.findFolderById( folders[ i ].children, folderId );
                if ( found ) {
                    return found;
                }
            }
        }
    }










    /**
     * Attaches store events to ipc main and dispatches react events to the main window.
     * 
     * @param {ForwardRef} mainWindowRef The main window of the application.
     * @param {function} sendTick The send tick method.
     * @param {FilesDatabaseStore} fileStore The file store.
     * @param {UserPreferencesStore} userPreferences The overlay store.
     */
    attachIpcEvents( mainWindowRef, sendTick, fileStore, userPreferences ) {

        _fileStore = fileStore;
        _userPreferences = userPreferences;

        ipcMain.on( 'trigger:create', ( event, trigger ) => {
            let triggerId = this.add( trigger );
            event.sender.send( 'trigger:create', triggerId );
            sendTick();
        } );

        ipcMain.on( 'trigger:get', ( event, triggerId ) => {
            if ( triggerId != null && triggerId.length > 0 ) {
                event.sender.send( 'trigger:get', this.find( triggerId ) );
            } else {
                event.sender.send( 'trigger:get', this.getAll() );
            }
        } );

        ipcMain.on( 'trigger:update', ( event, trigger ) => {
            let updated = this.update( trigger );
            event.sender.send( 'trigger:update', updated );
            sendTick();
        } );

        ipcMain.on( 'trigger:update:batch', ( event, triggers ) => {
            let failed = this.updateAll( triggers );
            event.sender.send( 'trigger:update:batch', failed );
            sendTick();
        } );

        ipcMain.on( 'trigger:delete', ( event, triggerId ) => {
            let deleted = this.remove( triggerId );
            event.sender.send( 'trigger:delete', deleted );
            sendTick();
        } );

        ipcMain.on( 'trigger:get:stored-variables', ( event, data ) => {
            event.sender.send( 'trigger:get:stored-variables', this.getVariableNames() );
        } );
        
        // Folder methods.
        ipcMain.on( 'folders:get', ( event, args ) => {
            event.sender.send( 'folders:get', this.getFolders() );
        } );

        ipcMain.on( 'folders:update', ( event, folders ) => {
            event.sender.send( 'folders:update', this.updateFolders( folders ) );
            sendTick();
        } );

        ipcMain.on( 'trigger:search', ( event, args ) => {
            event.sender.send( 'trigger:search', this.searchTriggers( args.term, args.folderIds ) );
        } );

        ipcMain.on( 'trigger:search:properties', ( event, args ) => {
            event.sender.send( 'trigger:search:properties', this.searchTriggerProperties( args.phrase, args.speakText, args.displayText, args.clipboardText, args.name, args.comment ) );
        } );
        
        ipcMain.on( 'zones:get:everquest', ( event, args ) => {
            event.sender.send( 'zones:get:everquest', _.uniq( eqZones ) );
        } );
        
        // Tag methods.
        ipcMain.on( 'tags:get', ( event, args ) => {
            event.sender.send( 'tags:get', this.getTags() );
        } );
        ipcMain.on( 'tags:create', ( event, tag ) => {
            event.sender.send( 'tags:create', this.createTag( tag ) );
            sendTick();
        } );
        ipcMain.on( 'tags:update', ( event, tag ) => {
            this.updateTag( tag );
            sendTick();
        } );
        ipcMain.on( 'tags:delete', ( event, tagId ) => {
            this.deleteTag( tagId );
            sendTick();
        } );

        ipcMain.on( 'pkg:install', ( event, pkg ) => {
            this.installTriggerPkg( pkg, event );
        } );

        ipcMain.on( 'pkg:uninstall', ( event, packageId ) => {
            event.sender.send( 'pkg:uninstall', this.uninstallTriggerPkg( packageId ) );
        } );

        ipcMain.on( 'pkg:isInstalled', ( event, packageId ) => {
            // TODO: All possible methods should specify a contextual return key in the get methods.
            event.sender.send( `pkg:isInstalled:${packageId}`, this.isPackageInstalled( packageId ) );
        } );

        ipcMain.on( 'pkg:get:installed', ( event ) => {
            event.sender.send( 'pkg:get:installed', this.getInstalledPackages() );
        } );

        ipcMain.on( 'quickShare:install', ( event, quickShare ) => {
            event.sender.send( 'quickShare:install', this.installQuickshare( quickShare ) );
        } );

        if ( this.#orphanedFound ) {
            mainWindowRef.whenReady( () => {
                setTimeout( () => {
                    mainWindowRef.reference.webContents.send( 'orphaned_trigger_warning', true );
                }, 5000 );
            } );
        }

    }

    /**
     * Returns a list of all tags.
     * 
     * @returns {Tag[]}
     */
    getTags() {
        return this.#data?.tags?.length > 0 ? this.#data.tags : [];
    }

    /**
     * Creates a new tag.
     * 
     * @returns {string} Returns the id of the new tag.
     * 
     * @param {Tag} tag The new tag.
     */
    createTag( tag ) {

        if ( StringUtilities.isNullOrWhitespace( tag?.name ) ) {
            throw 'Argument Invalid: Name required.';
        }

        tag.tagId = tag.tagId ? tag.tagId : nanoid();

        this.#data?.tags.push( tag );
        this.storeDataFile( this.#data );
        
        return tag.tagId;
    }

    /**
     * Updates an existing tag.
     * 
     * @param {Tag} tag The tag.
     */
    updateTag( tag ) {

        if ( StringUtilities.isNullOrWhitespace( tag?.name ) ) {
            throw 'Argument Invalid: Name required.';
        }

        if ( this.#data?.tags?.length > 0 ) {
            let i = _.findIndex( this.#data.tags, t => t.tagId === tag.tagId );
    
            this.#data.tags[ i ].name = tag.name;
            this.#data.tags[ i ].description = tag.description;
        }

        this.storeDataFile( this.#data );
    }

    /**
     * Removes the specified tag.
     * 
     * @param {string} tagId The id of the desired tag.
     */
    deleteTag( tagId ) {

        if ( StringUtilities.isNullOrWhitespace( tagId ) ) {
            throw 'Argument Invalid: Tag Id required.';
        }

        if ( this.#data?.tags?.length > 0 ) {
            let tagIndex = _.findIndex( this.#data.tags, t => t.tagId === tagId );
            
            if ( this.#data.triggers?.length > 0 ) {
                
                for ( let trigIndex = 0; trigIndex < this.#data.triggers.length; trigIndex++ ) {
                    let trigTagIndex = this.#data.triggers[ trigIndex ].tagIds.indexOf( tagId );

                    if ( trigTagIndex > -1 ) {
                        this.#data.triggers[ trigIndex ].tagIds.splice( trigTagIndex, 0 );
                    }

                }

            }

            this.#data.tags.splice( tagIndex, 0 );
            this.storeDataFile( this.#data );
        }
    }










    /**
     * Returns a list of all folders.
     * 
     * @returns {TriggerFolder[]}
     */
    getFolders() {
        return this.#data?.folders?.length > 0 ? this.#data.folders : [];
    }

    /**
     * Updates the store of trigger folders.
     * 
     * @param {TriggerFolder[]} folders The updated folders hierarchy.
     */
    updateFolders( folders ) {
        this.applyFolderIds( folders );
        this.#data.folders = folders;

        // Save changes to the data.
        this.processPredefinedTriggers();
        this.storeDataFile( this.#data );
        
        return this.#data.folders;
    }

    /**
     * Applies folder ids to all folders in the given heirarchy.
     * 
     * @param {TriggerFolder[]} folders The folder hierarchy.
     */
    applyFolderIds( folders ) {
        for ( let i = 0; i < folders?.length; i++ ) {
            if ( folders[ i ].children?.length > 0 ) {
                this.applyFolderIds( folders[ i ].children );
            }

            folders[ i ].folderId = folders[ i ].folderId == null ? nanoid() : folders[ i ].folderId;
        }
    }










    /**
     * Adds the given trigger to the store.
     * 
     * @returns {string} Returns the generated trigger id.
     * 
     * @param {Trigger} trigger The trigger to add to the store.
     * @param {boolean?} storeData If true, saves changes to the data file.
     */
    add( trigger, storeData ) {
        storeData = storeData === false ? false : true;
        // Init the triggers array.
        this.#data.triggers = this.#data.triggers ? this.#data.triggers : [];

        // Generate a new id for the trigger.
        trigger.triggerId = nanoid();
        trigger.actions?.forEach( f => f.actionId = f.actionId ? f.actionId : nanoid() );
        trigger.capturePhrases?.forEach( f => f.phraseId = f.phraseId ? f.phraseId : nanoid() );
        trigger.conditions?.forEach(f => f.conditionId = f.conditionId ? f.conditionId : nanoid() );

        // Add it to the store.
        this.#data.triggers.push( trigger );

        if ( storeData ) {
            // Save changes to the data.
            this.processPredefinedTriggers();
            this.storeDataFile( this.#data );
        }

        return trigger.triggerId;
    }










    // /**
    //  * Adds the given folder to the store.
    //  * 
    //  * @returns {string} Returns the generated folder id.
    //  * 
    //  * @param {TriggerFolder} folder The folder to add to the store.
    //  * @param {string} parentId The folderId of the parent folder.
    //  */
    // addFolder( folder, parentId ) {
    //     // Init the folders array.
    //     this.#data.folders = this.#data.folders ? this.#data.folders : [];

    //     // Generate a new id for the folder.
    //     folder.folderId = nanoid();

    //     if ( parentId == null ) {
    //         // Add it to the store.
    //         this.#data.folders.push( folder );
    //     } else {
    //         // Find the index of the parent folder.
    //         let i = _.findIndex( this.#data.folders, ( e ) => e.folderId === parentId );
    //         this.#data.folders[i]
    //     }

    //     // Save changes to the data.
    //     this.processPredefinedTriggers();
    //     this.storeDataFile( this.#data );

    //     return folder.folderId;
    // }









    
    /**
     * Removes the given trigger.
     * 
     * @param {Trigger} trigger The trigger to remove.
     */
    removeTrigger( trigger ) {
        if ( this.#data?.triggers?.length > 0 ) {

            // Find the index of the trigger.
            let i = _.findIndex( this.#data.triggers, ( e ) => e.triggerId === trigger.triggerId );

            // Remove the trigger by index.
            return this.removeIndex( i );

        }
    }









    
    // /**
    //  * Removes the given folder.
    //  * 
    //  * @param {TriggerFolder} folder The folder to remove.
    //  */
    // removeFolder( folder ) {
    //     if ( this.#data?.folders?.length > 0 ) {
    //         let folderId = folder.folderId;

    //         // Find the index of the trigger.
    //         let i = _.findIndex( this.#data.folders, ( e ) => e.folderId === folder.folderId );

    //         // Remove the folder by index.
    //         let removed = this.removeFolderIndex( i );

    //         if ( removed ) {
    //             this.#data.triggers?.forEach( trigger => {
    //                 if ( trigger.folderId === folderId ) {
    //                     trigger.folderId = null;
    //                 }
    //             } );
    
    //             // Save changes to the data.
    //             this.processPredefinedTriggers();
    //             this.storeDataFile( this.#data );
    //         }

    //         return removed;
    //     }
    // }









    
    /**
     * Removes the specified trigger.
     * 
     * @param {string} triggerId The trigger to remove.
     */
    remove( triggerId ) {
        if ( this.#data?.triggers?.length > 0 ) {

            // Find the index of the trigger.
            let i = _.findIndex( this.#data.triggers, ( e ) => e.triggerId === triggerId );

            // Remove the trigger by index.
            return this.removeIndex( i );

        }
    }









    
    // /**
    //  * Removes the specified folder.
    //  * 
    //  * @param {string} folderId The folder to remove.
    //  */
    // remove( folderId ) {
    //     if ( this.#data?.folders?.length > 0 ) {

    //         // Find the index of the folder.
    //         let i = _.findIndex( this.#data.folders, ( e ) => e.folderId === folderId );

    //         // Remove the trigger by index.
    //         let removed = this.removeFolderIndex( i );

    //         if ( removed ) {
    //             this.#data.triggers?.forEach( trigger => {
    //                 if ( trigger.folderId === folderId ) {
    //                     trigger.folderId = null;
    //                 }
    //             } );

    //             // Save changes to the data.
    //             this.processPredefinedTriggers();
    //             this.storeDataFile( this.#data );
    //         }

    //         return removed;
    //     }
    // }
    








    
    /**
     * Removes the trigger at the specified index.
     * 
     * @param {number} i The index of the trigger to remove.
     */
    removeIndex( i ) {
        if ( this.#data?.triggers?.length > i ) {

            // Remove the trigger by index.
            let removed = this.#data.triggers.splice( i, 1 );

            // Save the changes to the data.
            this.processPredefinedTriggers();
            this.storeDataFile( this.#data );

            // Return true if at least 1 item was removed.
            return removed?.length > 0;
        }
    }
    








    
    // /**
    //  * Removes the folder at the specified index.
    //  * 
    //  * @param {number} i The index of the folder to remove.
    //  */
    // removeFolderIndex( i ) {
    //     if ( this.#data?.folders?.length > i ) {

    //         // Remove the folder by index.
    //         let removed = this.#data.folders.splice( i, 1 );

    //         // Save the changes to the data.
    //         this.processPredefinedTriggers();
    //         this.storeDataFile( this.#data );

    //         // Return true if at least 1 item was removed.
    //         return removed?.length > 0;
    //     }
    // }
    








    
    /**
     * Returns the trigger with the given id.
     * 
     * @param {string} triggerId The trigger id of the desired trigger.
     */
    find( triggerId ) {

        // Find the index of the trigger by Id.
        let i = _.findIndex( this.#data.triggers, ( e ) => e.triggerId === triggerId );

        // If the index is valid, then return the found trigger.
        if ( i > -1 && i < this.#data?.triggers?.length ) {
            return this.#data.triggers[ i ];
        }
    }
    








    
    // /**
    //  * Returns the folder with the given id.
    //  * 
    //  * @param {string} folderId The folder id of the desired folder.
    //  */
    // findFolder( folderId ) {

    //     // Find the index of the folder by Id.
    //     let i = _.findIndex( this.#data.folders, ( e ) => e.folderId === folderId );

    //     // If the index is valid, then return the found trigger.
    //     if ( i > -1 && i < this.#data?.folders?.length ) {
    //         return this.#data.folders[ i ];
    //     }
    // }










    /**
     * Updates the given trigger in the store.
     * 
     * @returns {boolean} Returns true if the trigger was updated.
     * 
     * @param {TriggerModel} trigger The trigger to update.
     * @param {boolean?} storeData If true, saves changes to the data file.
     */
    update( trigger, storeData ) {
        storeData = storeData === false ? false : true;
        trigger.actions?.forEach( f => f.actionId = f.actionId ? f.actionId : nanoid() );
        trigger.capturePhrases?.forEach( f => f.phraseId = f.phraseId ? f.phraseId : nanoid() );
        trigger.conditions?.forEach( f => f.conditionId = f.conditionId ? f.conditionId : nanoid() );

        // Find the index of the trigger by Id.
        let i = _.findIndex( this.#data.triggers, ( e ) => e.triggerId === trigger.triggerId );

        // If the index is valid, then update the found trigger.
        if ( i > -1 && i < this.#data?.triggers?.length ) {
            this.#data.triggers[ i ] = trigger;

            if ( storeData ) {
                // Save changes to the data.
                this.processPredefinedTriggers();
                this.storeDataFile( this.#data );
            }

            return true;
        } else {
            return false;
        }
        
    }
    









    /**
     * Syncs all triggers with the given list, updating existing triggers, creating new triggers, and removing triggers not in this list.
     * 
     * @returns {Trigger[]} Returns a list of triggers that failed to update.
     * 
     * @param {Trigger[]} triggers The triggers to update.
     */
    updateAll( triggers ) {
        
        /** @type {Trigger[]} */
        let failed = [];

        let existingIds = triggers.map( f => f.triggerId );
        this.#data.triggers = this.#data.triggers.filter( f => existingIds.indexOf( f.triggerId ) > -1 );

        triggers.forEach( trigger => {
            if ( StringUtilities.isNullOrWhitespace( trigger.triggerId ) ) {
                let newId = this.add( trigger, false );
                
                if ( StringUtilities.isNullOrWhitespace( newId ) ) {
                    failed.push( trigger );
                } else {
                    trigger.triggerId = newId;
                }

            } else {
                if ( !this.update( trigger, false ) ) {
                    failed.push( trigger );
                }
            }
        } );

        // Save changes to the data.
        this.processPredefinedTriggers();
        this.storeDataFile( this.#data );

        return failed;
    }










    // /**
    //  * Updates the given folder in the store.
    //  * 
    //  * @returns {boolean} Returns true if the folder was updated.
    //  * 
    //  * @param {TriggerFolder} folder The folder to update.
    //  */
    // update( folder ) {

    //     // Find the index of the folder by Id.
    //     let i = _.findIndex( this.#data.folders, ( e ) => e.folderId === folder.folderId );

    //     // If the index is valid, then update the found folder.
    //     if ( i > -1 && i < this.#data?.folders?.length ) {
    //         this.#data.folders[ i ] = folder;

    //         // Save changes to the data.
    //         this.processPredefinedTriggers();
    //         this.storeDataFile( this.#data );

    //         return true;
    //     } else {
    //         return false;
    //     }
        
    // }










    /**
     * Returns a list of triggers predicate returns truthy for.
     * 
     * @param {(x: Trigger) => true} fn The predicate trigger returns truthy for.
     */
    filter( fn ) {
        return _.filter( this.#data.triggers, fn );
    }









    
    /**
     * Returns all triggers.
     */
    getAll() {
        return this.#data.triggers;
    }









    
    // /**
    //  * Returns all folders.
    //  */
    // getFolders() {
    //     return this.#data.folders;
    // }










    /**
     * Returns all variable names.
     */
    getVariableNames() {
        let variables = [];
        this.#data?.triggers?.forEach( trigger => {
            trigger.actions?.forEach( action => {
                if ( action.actionType === ActionTypes.StoreVariable ) {
                    variables.push( action.variableName );
                }
            } );
        } );
        return variables;
    }
    








    
    /**
     * Removes the given list of triggers.
     * 
     * @param {Trigger[]} triggers The triggers to remove.
     */
    removeRange( triggers ) {
        if ( this.#data?.triggers?.length > 0 ) {

            // Remove all triggers that satisfy the condition.
            _.remove( this.#data.triggers, ( f ) => {
                // If the Id of the current trigger exists in the given list of triggers.
                _.some( triggers, ( x ) => x.triggerId == f.triggerId );
            } );

            // Save the changes to the data.
            this.processPredefinedTriggers();
            this.storeDataFile( this.#data );
        }
    }










    /**
     * Searches through all triggers trying to find any match.  This is a fuzzy 
     * search and the results are given in order of best match on top.
     * 
     * @returns {TriggerModel[]} Returns a list of matched triggers.
     * 
     * @param {string} term The search term to query.
     * @param {string[]} folderIds If provided, only returns triggers that exist in a folder in this list.
     */
    searchTriggers( term, folderIds ) {
        let fuse = new Fuse( this.#data.triggers, fuseOptions_tags );

        let results = fuse.search( term );


        if ( results && results.length > 0 ) {

            let scoreLimit = 0.85;
            let scores = _.map( results, item => item.score );
            let minScore = _.min( scores );

            if ( minScore < 0.35 ) {
                scoreLimit = 0.35;
            } else if ( minScore < 0.50 ) {
                scoreLimit = 0.50;
            }

            return _.map( results, fuseResult => {
                let item = fuseResult.item;
                item.score = fuseResult.score;
                item.refIndex = fuseResult.refIndex;
                return item;
            } ).filter( item => {
                if ( folderIds == null || folderIds.length == 0 ) {
                    return item.score <= scoreLimit;
                } else {
                    return folderIds.indexOf( item.folderId ) > -1 && item.score <= scoreLimit;
                }
            } );

        } else {
            return [];
        }
    }

    /**
     * Searches through all triggers trying to find any match.  This is a fuzzy 
     * search and the results are given in order of best match on top.
     * 
     * @returns {TriggerModel[]} Returns a list of matched triggers.
     * 
     * @param {string | string[]} phrase The phrase text to query.
     * @param {string | string[]} speakText The TTS text to query.
     * @param {string | string[]} displayText The display text to query.
     * @param {string | string[]} clipboardText The clipboard text to query.
     * @param {string} name The clipboard text to query.
     * @param {string} comments The clipboard text to query.
     */
    searchTriggerProperties( phrase, speakText, displayText, clipboardText, name, comments ) {

        let fuse_name = new Fuse( this.#data.triggers, fuseOptions_names );
        let fuse_comment = new Fuse( this.#data.triggers, fuseOptions_comments );
        let fuse_phrase = new Fuse( this.#data.triggers, fuseOptions_phrases );
        let fuse_speak = new Fuse( this.#data.triggers, fuseOptions_speak );
        let fuse_displayText = new Fuse( this.#data.triggers, fuseOptions_displayText );
        let fuse_clipboard = new Fuse( this.#data.triggers, fuseOptions_clipboard );
        
        /**
         * @type {{item: TriggerModel, refIndex: number, score?: number, matches?: ReadonlyArray<any>}[]}
         */
        let results = [];

        results = results.concat( fuse_name.search( name ) );
        results = results.concat( fuse_comment.search( comments ) );

        phrase = phrase instanceof Array ? phrase : [ phrase ];
        phrase.forEach( p => results = results.concat( fuse_phrase.search( p ) ) );

        speakText = speakText instanceof Array ? speakText : [ speakText ];
        speakText.forEach( p => results = results.concat( fuse_speak.search( p ) ) );

        displayText = displayText instanceof Array ? displayText : [ displayText ];
        displayText.forEach( p => results = results.concat( fuse_displayText.search( p ) ) );

        clipboardText = clipboardText instanceof Array ? clipboardText : [ clipboardText ];
        clipboardText.forEach( p => results = results.concat( fuse_clipboard.search( p ) ) );

        if ( results && results.length > 0 ) {

            let scoreLimit = 0.85;
            let scores = _.map( results, item => item.score );
            let minScore = _.min( scores );

            // if ( minScore < 0.35 ) {
            //     scoreLimit = 0.35;
            // } else if ( minScore < 0.50 ) {
            //     scoreLimit = 0.50;
            // }

            return _.uniq( _.map( results, fuseResult => {
                let item = fuseResult.item;
                item.score = fuseResult.score;
                item.refIndex = fuseResult.refIndex;
                return item;
            } ).filter( item => item.score <= scoreLimit ), t => t.triggerId );

        } else {
            return [];
        }
    }










    /**
     * Returns true if the specified package is installed.
     * 
     * @param {string} packageId The id of the package.
     */
    isPackageInstalled( packageId ) {
        return this.#data.installedPackages.findIndex( f => f.packageId === packageId ) > -1;
    }









    
    /**
     * Installs the given trigger packages.
     * 
     * @deprecated Do not use this.
     * 
     * @param {TriggerPackageMetaModel[]} pkgs The packages to install.
     */
    installTriggerPackages( pkgs ) {
        pkgs?.forEach( pkg => this.installTriggerPackage( pkg ) );
    }










    /**
     * Ensures that the package overlays are installed.
     * 
     * @remarks Install is a bad choice here, when a package overlay is 
     *  missing, it is sent to the main window with the intent to have the user 
     *  step through creating a matching overlay.  Once all overlays have a 
     *  matching overlay in user data, then the package can be installed.
     * 
     * @param {TriggerPackageMetaModel} pkg The trigger package.
     * @param {Electron.IpcMainEvent} event The original event args.
     * @param {(overlayMap: Record<string, string>) => void} callback The callback function executed after all overlay maps have been completed.
     */
    installTriggerPackageOverlays( pkg, event, callback ) {
        let overlayMap = this.#data.packageOverlayMap ?? {};
        
        let finalize = () => {
            this.#data.packageOverlayMap = overlayMap;
            this.#data.packageOverlays = this.#data.packageOverlays ? this.#data.packageOverlays : {};
            this.#data.packageOverlays[ pkg.triggerPackageId ] = pkg.model.packageOverlays?.map( f => f.overlayId ) ?? [];
            this.storeDataFile( this.#data );
        }

        overlayMap[ pkg.model.detrimentalOverlayId ] = _userPreferences.detrimentalOverlayId;
        overlayMap[ pkg.model.beneficialOverlayId ] = _userPreferences.beneficialOverlayId;
        // This was added after the original feature and may be null for older trigger packages.
        overlayMap[ pkg.model.textOverlayId ? pkg.model.textOverlayId : _userPreferences.alertOverlayId ] = _userPreferences.alertOverlayId;
        
        let missingOverlays = pkg.model.packageOverlays?.filter( f => overlayMap[ f.overlayId ] == null ) ?? [];
        let myDisplaySize = screen.getPrimaryDisplay().size;
        let sizeRatio = { heightRatio: myDisplaySize.height / pkg.model.primaryDisplaySize?.height ?? 1, widthRatio: myDisplaySize.width / pkg.model.primaryDisplaySize?.width ?? 1 };
        
        let installOverlay =
            /**
             * Execute the process for installing trigger overlays.
             * 
             * @param {number} i The index of the overlay.
             */
            ( i ) => {

                if ( i < missingOverlays.length ) {
                    // If we still have more overlays to process, then send that to the sender.
                    ipcMain.once( `trigger:missing-overlay:${missingOverlays[ i ].overlayId}`, ( event, userOverlayId ) => {
                        overlayMap[ missingOverlays[ i ].overlayId ] = userOverlayId;
                        installOverlay( i + 1 );
                    } );

                    if ( pkg.model.primaryDisplaySize ) {
                        // Because the origin of the renderer is at the top left 
                        // corner of the primary display, these calculations can be 
                        // simplified. If the bounds of the overlay extend past the 
                        // bounds of the primary display, we need to just center 
                        // the new display, otherwise we can adjust by ratio to 
                        // place the copied overlay in the same relative location.

                        let extendsPastHorizontalBounds = missingOverlays[ i ].x < 0 || missingOverlays[ i ].x > ( pkg.model.primaryDisplaySize.width - missingOverlays[ i ].windowWidth );
                        let extendsPastVerticalBounds = missingOverlays[ i ].y < 0 || missingOverlays[ i ].y > ( pkg.model.primaryDisplaySize.height - missingOverlays[ i ].windowHeight );

                        if ( extendsPastHorizontalBounds || extendsPastVerticalBounds ) {
                            // Center the new overlay.
                            missingOverlays[ i ].windowWidth = missingOverlays[ i ].windowWidth * sizeRatio.widthRatio;
                            missingOverlays[ i ].windowHeight = missingOverlays[ i ].windowHeight * sizeRatio.heightRatio;
                            missingOverlays[ i ].x = ( myDisplaySize.width / 2 ) - ( missingOverlays[ i ].x / 2 );
                            missingOverlays[ i ].y = ( myDisplaySize.height / 2 ) - ( missingOverlays[ i ].y / 2 );

                        } else {
                            // Position relative to source display.
                            missingOverlays[ i ].x = missingOverlays[ i ].x * sizeRatio.widthRatio;
                            missingOverlays[ i ].y = missingOverlays[ i ].y * sizeRatio.heightRatio;
                            missingOverlays[ i ].windowWidth = missingOverlays[ i ].windowWidth * sizeRatio.widthRatio;
                            missingOverlays[ i ].windowHeight = missingOverlays[ i ].windowHeight * sizeRatio.heightRatio;

                        }
                    }
                    
                    event.sender.send( 'pkg:missing-overlay', missingOverlays[ i ] );

                } else {
                    // We're done, let's continue the normal process.
                    finalize();
                    callback( overlayMap );

                }
            
            };
        
        installOverlay( 0 );
    }









    
    /**
     * Installs the given trigger package.
     * 
     * @note Files are installed in the Angular, prior to calling this function.
     * 
     * @param {TriggerPackageMetaModel} pkg The package to install.
     * @param {Electron.IpcMainEvent} event The event args.
     */
    installTriggerPkg( pkg, event ) {
        
        if ( this.#data.triggers === null || this.#data.triggers === undefined ) {
            throw 'Trigger database not loaded!';
        }

        this.installTriggerPackageOverlays( pkg, event, overlayMap => {

            let triggerVersion = this.#data.installedPackages.find( f => f.packageId === pkg.triggerPackageId );

            if ( triggerVersion == null ) {
                triggerVersion = new TriggerPackageVersion();
                triggerVersion.packageId = pkg.triggerPackageId;

                // Add it to the store
                this.#data.installedPackages.push( triggerVersion );
            }

            triggerVersion.versionId = pkg.versionId;
            triggerVersion.timestamp = pkg.timestampDate;
            triggerVersion.name = pkg.name;
            triggerVersion.description = pkg.description;
            triggerVersion.author = pkg.author;
            triggerVersion.authorDiscord = pkg.authorDiscord;

            // First, update the overlay Ids to match their cooresponding values on
            // the client.
            pkg.model?.triggers?.forEach( pkgTrigger => {
                pkgTrigger.actions?.forEach( pkgAction => {

                    if ( pkgAction.actionType === ActionTypes.DisplayText ) {
                        pkgAction.overlayId = overlayMap[ pkgAction.overlayId ] ?? _userPreferences.alertOverlayId;
                    } else {
                        pkgAction.overlayId = overlayMap[ pkgAction.overlayId ];
                    }
                
                    pkgAction.endedTextOverlayId = overlayMap[ pkgAction.overlayId ] ?? _userPreferences.alertOverlayId;
                    pkgAction.endingSoonTextOverlayId = overlayMap[ pkgAction.overlayId ] ?? _userPreferences.alertOverlayId;
                } );
            } );

            // Next, create the required folders, creating a folder map that maps 
            // folder ids to existing folders. If a folder does not exist,  it is 
            // created  using  the  folder  id  in  the trigger   package  folder.
            let folderMap = this.installPackageFolders( pkg.model?.folders );
            pkg.model?.triggers?.forEach( pkgTrigger => this.installPackageTrigger( pkg.triggerPackageId, pkgTrigger, folderMap ) );

            // Save changes to the data.
            this.processPredefinedTriggers();
            this.storeDataFile( this.#data );
            
            event.sender.send( 'pkg:install', true );
        } );

    }










    /**
     * Installs the given quickshare triggers, folders, and files.
     * 
     * @param {QuickShareMetaModel} quickShare The quickshare to install.
     */
    installQuickshare( quickShare ) {
        
        if ( this.#data.triggers === null || this.#data.triggers === undefined ) {
            throw 'Trigger database not loaded!';
        }

        let quickShareVersion = this.#data.installedQuickShares.find( f => f.quickShareId === quickShare.quickShareId );

        if ( quickShareVersion == null ) {
            quickShareVersion = new QuickShareVersion();
            quickShareVersion.quickShareId = quickShare.quickShareId;

            // Add it to the store
            this.#data.installedQuickShares.push( quickShareVersion );
        }

        quickShareVersion.versionId = quickShare.versionId;
        quickShareVersion.timestamp = quickShare.timestamp;
        quickShareVersion.author = quickShare.author;
        quickShareVersion.authorDiscord = quickShare.authorDiscord;

        // First, update the overlay Ids to match their cooresponding values on 
        // the client.

        /** @type {Record<string, string>} */
        let overlayMap = {}

        overlayMap[ quickShare.model.detrimentalOverlayId ] = _userPreferences.detrimentalOverlayId;
        overlayMap[ quickShare.model.beneficialOverlayId ] = _userPreferences.beneficialOverlayId;

        // TODO: quickshare needs to map to overlay ids that aren't defaults.

        quickShare.model?.triggers?.forEach( trigger => {
            trigger.actions?.forEach( action => {

                if ( action.actionType === ActionTypes.DisplayText ) {
                    action.overlayId = _userPreferences.alertOverlayId;
                } else {
                    action.overlayId = overlayMap[ action.overlayId ];
                }
                
                action.endedTextOverlayId = _userPreferences.alertOverlayId;
                action.endingSoonTextOverlayId = _userPreferences.alertOverlayId;

            } );
        } );

        // TODO: Enable quick share staging.
        // if ( quickShare.stageNewTriggers ) {
        //     let i = this.#data.folders.findIndex( f => f.name === 'Quick Share Staging' );
            
        //     if ( i < 0 ) {
        //         let stageFolder = new TriggerFolder();

        //         stageFolder.folderId = nanoid();
        //         stageFolder.name = 'Quick Share Staging';
        //         stageFolder.expanded = false;
        //         stageFolder.active = false;
        //         stageFolder.comments = 'Staging for newly imported quick share triggers.';
        //         stageFolder.children = [];

        //         this.#data.folders.push( stageFolder );
        //         this.updateFolders( this.#data.folders )
        //     }

        //     let stageFolder = this.#data.folders.find( f => f.name === 'Quick Share Staging' );
            
        //     let stageQuickshareFolder = new PackageFolder();
        //     stageQuickshareFolder.folderId = stageFolder.folderId;
        //     stageQuickshareFolder.name = stageFolder.name;
        //     stageQuickshareFolder.children = quickShare.model.folders;

        //     quickShare.model.folders = [ stageQuickshareFolder ];
        // }

        // Next, create the required folders, creating a folder map that maps 
        // folder ids to existing folders. If a folder does not exist,  it is 
        // created  using  the  folder  id  in  the trigger   package  folder.
        let folderMap = this.installPackageFolders( quickShare.model?.folders );
        quickShare.model?.triggers?.forEach( trigger => this.installPackageTrigger( quickShare.quickShareId, trigger, folderMap ) );

        // Save changes to the data.
        this.processPredefinedTriggers();
        this.storeDataFile( this.#data );

        return true;
    }










    /**
     * Removes the specified trigger package and uninstalls all related 
     * triggers.
     * 
     * @param {string} packageId The id of  the package to remove.
     */
    uninstallTriggerPkg( packageId ) {
        
        if ( this.#data.triggers === null || this.#data.triggers === undefined ) {
            throw 'Trigger database not loaded!';
        }

        let packageTriggers = _.remove( this.#data.triggers, f => f.packageId === packageId );
        let packageFolders = packageTriggers.map( f => f.folderId );
        let packageFiles = [];

        packageTriggers.forEach( trigger => {
            trigger.actions.forEach( action => {
                if ( action.audioFileId && packageFiles.indexOf( action.audioFileId ) === -1 ) {
                    packageFiles.push( action.audioFileId );
                }
                if ( action.endedPlayAudioFileId && packageFiles.indexOf( action.endedPlayAudioFileId ) === -1 ) {
                    packageFiles.push( action.endedPlayAudioFileId );
                }
                if ( action.endingPlayAudioFileId && packageFiles.indexOf( action.endingPlayAudioFileId ) === -1 ) {
                    packageFiles.push( action.endingPlayAudioFileId );
                }
            } );
        } );

        // If the audio files from this package are not referenced by any other 
        // triggers, then we need to remove these files from the system.  This 
        // algorithm must be executed after the removal of the package triggers.
        let filesForRemoval = _.remove( packageFiles, fileId => {

            let usedAudio = _.some( this.#data.triggers, trigger => {
                return _.some( trigger.actions, action => {
                    return action.audioFileId === fileId;
                } );
            } );
            let usedEndedAudio = _.some( this.#data.triggers, trigger => {
                return _.some( trigger.actions, action => {
                    return action.endedPlayAudioFileId === fileId;
                } );
            } );
            let usedEndingAudio = _.some( this.#data.triggers, trigger => {
                return _.some( trigger.actions, action => {
                    return action.endingPlayAudioFileId === fileId;
                } );
            } );

            return !usedAudio && !usedEndedAudio && !usedEndingAudio;
        } );
        
        filesForRemoval?.forEach( fileId => _fileStore.deleteFile( fileId ) );

        // Remove any empty folders that were imported with the package.
        let foldersForRemoval = _.remove( packageFolders, folderId => {
            return !_.some( this.#data.triggers, trigger => trigger.folderId === folderId );
        } );

        foldersForRemoval?.forEach( folderId => {
            this.removeFolder( this.#data.folders, folderId );
        } );

        _.remove( this.#data.installedPackages, f => f.packageId === packageId );

        // Remove all package overlay ids from the package overlay map.  This 
        // will allow the user to uninstall and reassign/create new overlays 
        // for the same package.
        let packageOverlayIds = this.#data.packageOverlays[ packageId ];
        if ( packageOverlayIds ) {
            packageOverlayIds.forEach( pkgOverlayId => {
                this.#data.packageOverlayMap[ pkgOverlayId ] = null;
            } );
        }

        // Save changes to the data.
        this.processPredefinedTriggers();
        this.storeDataFile( this.#data );
    }










    /**
     * Removes the specified folder form the store.
     * 
     * @param {TriggerFolder[]} folders The list of folders to search.
     * @param {string} folderId The id of the folder to remove.
     */
    removeFolder( folders, folderId ) {
        let folder = _.remove( folders, f => f.folderId === folderId );
        if ( !folder ) {
            folders?.forEach( f => {
                this.removeFolder( f.children, folderId );
            } );
        }
    }










    /**
     * Installs the given package trigger.  This method does not save changes 
     * to the data store.
     * 
     * @param {string} packageId The id of the package.
     * @param {PackageTrigger} packageTrigger The package trigger to install.
     * @param {Record<string, string>} folderMap The folder id map.
     */
    installPackageTrigger( packageId, packageTrigger, folderMap ) {
        /** @type {Trigger} */
        let trigger;

        let i = this.#data.triggers.findIndex( f => f.triggerId === packageTrigger.triggerId );

        if ( i > -1 ) {
            trigger = this.#data.triggers.find( f => f.triggerId === packageTrigger.triggerId );

        } else {
            trigger = new Trigger();
            trigger.triggerId = packageTrigger.triggerId;
            trigger.folderId = folderMap[ packageTrigger.folderId ];
            trigger.packageId = packageId;

            // Add it to the store.
            this.#data.triggers.push( trigger );

        }

        trigger.name = packageTrigger.name;
        trigger.capturePhrases = packageTrigger.capturePhrases;
        trigger.comments = packageTrigger.comments;
        trigger.actions = packageTrigger.actions;
        trigger.captureMethod = packageTrigger.captureMethod;
        trigger.conditions = packageTrigger.conditions;
        trigger.classLevels = packageTrigger.classLevels;
        trigger.useCooldown = packageTrigger.useCooldown;
        trigger.cooldownDuration = packageTrigger.cooldownDuration;

    }









    
    /**
     * Installs the given folders and any child folders.
     * 
     * @returns {Record<string, string>} Retuns a map of folder ids.  If new folders were created, the 
     * map will contain the new folder id.  If an existing folder was found, 
     * the map will map the package folder id to the existing folder id.
     * 
     * @param {PackageFolder[]} packageFolders The folders to install.
     */
    installPackageFolders( packageFolders ) {
        let folders = this.getFolders();
        /** @type {Record<string, string>} */
        let folderMap = {};

        packageFolders?.forEach( pkgFolder => {
            
            // If there exists a folder with the name, then map the package 
            // folder id to the existing folder id.
            let i = folders.findIndex( f => f.name === pkgFolder.name );
            /** @type {TriggerFolder} */
            let folder;

            if ( i > -1 ) {
                
                folderMap[ pkgFolder.folderId ] = folders[ i ].folderId;
                folder = folders[ i ];

            } else {

                folderMap[ pkgFolder.folderId ] = pkgFolder.folderId;
                
                folder = new TriggerFolder();
                folder.folderId = pkgFolder.folderId;
                folder.name = pkgFolder.name;
                folder.active = true;
                folder.expanded = false;
                folder.children = [];
    
                folders.push( folder );

            }

            pkgFolder.children?.forEach( pkgChild => {
                this.installPackageFolder( folder, pkgChild, folderMap );
            } );

        } );

        this.updateFolders( folders );

        return folderMap;
    }










    /**
     * Installs the given folder and any child folder.
     * 
     * @param {TriggerFolder} parentFolder The folder to install.
     * @param {PackageFolder} packageFolder The folder to install.
     * @param {Record<string, string>} folderMap The folder id map.
     */
    installPackageFolder( parentFolder, packageFolder, folderMap ) {
        
        parentFolder.children == null ? [] : parentFolder.children;
        
        // If there exists a folder with the name, then map the package folder 
        // id to the existing folder id.
        let i = parentFolder.children.findIndex( f => f.name === packageFolder.name );
        /** @type {TriggerFolder} */
        let folder;
        
        if ( i > -1 ) {
                
            folderMap[ packageFolder.folderId ] = parentFolder.children[ i ].folderId;
            folder = parentFolder.children[ i ];

        } else {

            let folderId = nanoid();

            folderMap[ packageFolder.folderId ] = folderId;
            
            folder = new TriggerFolder();

            folder.folderId = folderId;
            folder.name = packageFolder.name;
            folder.active = true;
            folder.expanded = false;
            folder.children = [];

            parentFolder.children.push( folder );

        }
        
        packageFolder.children?.forEach( pkgChild => {
            this.installPackageFolder( folder, pkgChild, folderMap );
        } );

    }










    /**
     * Returns the list of installed trigger packages.
     * 
     * @returns {TriggerPackageVersion[]}
     */
    getInstalledPackages() {
        return this.#data.installedPackages;
    }









    
    /**
     * Returns a list of installed quick shares.
     * 
     * @returns {QuickShareVersion[]}
     */
    getInstalledQuickShares() {
        return this.#data.installedQuickShares;
    }










    /**
     * Removes the mapping to the specified overlay.
     * 
     * @param {string} overlayId The overlay id.
     */
    removeOverlayMapping( overlayId ) {
        for ( let key in this.#data.packageOverlayMap ) {
            if ( this.#data.packageOverlayMap.hasOwnProperty( key ) && this.#data.packageOverlayMap[ key ] === overlayId ) {
                this.#data.packageOverlayMap[ key ] = null;
            }
        }

        this.storeDataFile( this.#data );
    }

}

module.exports = TriggerDatabaseStore;
