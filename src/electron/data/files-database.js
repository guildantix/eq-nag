const electron = require( 'electron' );
const { app, BrowserWindow, ipcMain } = require( "electron" );
const path = require( 'path' );
const fs = require( 'fs' );
const Store = require( './store' );
const _ = require( 'lodash' );
const ForwardRef = require( '../forward-ref' );
const customAlphabet = require( 'nanoid' ).customAlphabet;
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const idLen = 16;
const nanoid = customAlphabet( alphabet, 16 );
const ArrayUtilities = require( '../utilities/arrays' );
const { FormControlDirective } = require( "@angular/forms" );
const StringUtilities = require( "../utilities/string" );
const Fuse = require( 'fuse.js' );
const { MediaTypes, FileModel } = require( './models/trigger' );

const eqSpellPages = 63;
const eqIconPageSize = 256;
const eqIconSize = 40;
const filesFolder = 'resource-files';

class FilesDatabaseStore extends Store {

    /** 
     * The data store for this object.
     * @type {{files: FileModel[]}}
     * */
    #data;

    #filePath;

    constructor() {
        super( {
            configName: "files-database",
            defaults: { files: [] },
        } );
        
        this.#data = this.parseDataFile();

        let userDataPath = ( electron.app || electron.remote.app ).getPath( 'userData' );
        this.#filePath = path.join( userDataPath, filesFolder );

        if ( !fs.existsSync( this.#filePath ) ) {
            fs.mkdir( this.#filePath, () => { } );
        }
    }
    
    /**
     * Attaches store events to ipc main and dispatches react events to the main window.
     * 
     * @param {ForwardRef} mainWindowRef The main window of the application.
     */
    attachIpcEvents( mainWindowRef ) {

        ipcMain.on( 'audio-file:save', ( event, file ) => {
            let fileId = this.storeFile( file.buffer, file.name );
            event.sender.webContents.send( 'audio-file:save', fileId );
        } );

        ipcMain.on( 'audio-file:import', ( event, filename ) => {
            let fileId = this.storeFileByName( filename );
            event.sender.webContents.send( 'audio-file:import', fileId );
        } );

        ipcMain.on( 'audio-file:get:url', ( event, fileId ) => {
            let url = this.getAudioFileUrl( fileId );
            event.sender.webContents.send( 'audio-file:get:url', url );
        } );

        ipcMain.on( 'audio-file:get', ( event ) => {
            event.sender.webContents.send( 'audio-file:get', this.getAudioFiles() );
        } );

    }

    /**
     * Returns a file URL for the specified file.
     * 
     * @param {string} fileId The id of the desired file.
     */
    getAudioFileUrl( fileId ) {
        let file = _.find( this.#data.files, f => f.fileId === fileId );
        if ( file ) {
            return `file://${file.physicalName}`;
        }
    }

    /**
     * Saves the posted file to the store.
     * 
     * @returns {string} Returns the id of the file.
     * 
     * @param {Buffer} buffer The file data.
     * @param {string} name The name of the file.
     */
    storeFile( buffer, name ) {
        let id = nanoid();
        let model = new FileModel();
        
        model.fileId = id;
        model.mediaType = MediaTypes.Audio;
        model.fileName = name;
        model.physicalName = path.join( this.#filePath, `${id}${path.extname( name )}` );

        fs.writeFile( model.physicalName, buffer, () => { } );

        this.#data.files.push( model );
        this.storeDataFile( this.#data );

        return id;
    }

    storeFileByName( filename ) {

        let name = path.basename( filename );
        let existing = _.find( this.#data.files, f => f.fileName === name );

        if ( existing ) {
            return existing.fileId;

        } else {
            let id = nanoid();
            let model = new FileModel();
            
            model.fileId = id;
            model.mediaType = MediaTypes.Audio;
            model.fileName = name;
            model.physicalName = path.join( this.#filePath, `${id}${path.extname( name )}` );
    
            fs.copyFile( filename, model.physicalName, () => { } );
    
            this.#data.files.push( model );
            this.storeDataFile( this.#data );
    
            return id;

        }
    }

    getAudioFiles() {
        return _.filter( this.#data.files, f => f.mediaType === MediaTypes.Audio );
    }



}

module.exports = FilesDatabaseStore;