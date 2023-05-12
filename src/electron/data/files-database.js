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
const StringUtilities = require( "../utilities/string" );
const Fuse = require( 'fuse.js' );
const { MediaTypes, FileModel, PackageFileModel } = require( './models/trigger' );
const log = require( 'electron-log' );

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
            event.sender.send( 'audio-file:save', fileId );
        } );

        ipcMain.on( 'audio-file:import', ( event, filename ) => {
            let fileId = this.storeFileByName( filename );
            event.sender.send( 'audio-file:import', fileId );
        } );

        ipcMain.on( 'audio-file:get:url', ( event, fileId ) => {
            let url = this.getAudioFileUrl( fileId );
            event.sender.send( 'audio-file:get:url', url );
        } );

        ipcMain.on( 'audio-file:get', ( event ) => {
            event.sender.send( 'audio-file:get', this.getAudioFiles() );
        } );

        ipcMain.on( 'audio-file:getData', ( event ) => {
            event.sender.send( 'audio-file:getData', this.getAudioFileData() );
        } );

        ipcMain.on( 'file:importFromPackage', ( event, packageFile ) => {
            event.sender.send( 'file:importFromPackage', this.importPackageFile( packageFile ) );
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

        if ( !name.endsWith( '.mp3' ) )
            return null;
        
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









    
    /**
     * Removes the specified file.
     * 
     * @param {string} fileId The id of the file to remove.
     */
    deleteFile( fileId ) {
        let file = _.remove( this.#data.files, f => f.fileId === fileId );

        if ( file?.length > 0 ) {
            fs.unlink( file[ 0 ].physicalName, () => { } );
            this.storeDataFile( this.#data );
        }
    }









    
    /**
     * Imports the given package file into the data store.
     * 
     * @param {PackageFileModel} file The package file to import.
     */
    importPackageFile( file ) {

        // If the file exists, delete it and remove it from the data store.
        let existingIndex = this.#data.files.findIndex( f => f.fileId === file.fileId );
        if ( existingIndex > -1 ) {
            let existing = this.#data.files.splice( existingIndex, 1 )[ 0 ];
            if ( fs.existsSync( existing.physicalName ) ) {
                fs.unlinkSync( existing.physicalName );
            }
        }

        let model = new FileModel();

        model.fileId = file.fileId;
        model.mediaType = +file.mediaType;
        model.fileName = file.fileName;
        model.physicalName = path.join( this.#filePath, `${file.fileId}${path.extname( file.fileName )}` );

        fs.writeFile( model.physicalName, Buffer.from( file.contents, 'base64' ), () => { } );

        this.#data.files.push( model );
        this.storeDataFile( this.#data );

        return file.fileId;
    }









    
    /**
     * Stores the specified filename in the data store, copying the file that 
     * exists on the computer into the files path.
     * 
     * @param {string} filename The full path and name of the desired file.
     * @returns 
     */
    storeFileByName( filename ) {

        if ( filename ) {
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
        } else {
            log.error( `[files-database:storeFileByName] Invalid filename: ${filename === undefined ? 'undefined' : filename === null ? 'null' : filename}` );
            return undefined;
        }
    }









    
    /**
     * Returns a list of all audio files int he store.
     */
    getAudioFiles() {
        return _.filter( this.#data.files, f => f.mediaType === MediaTypes.Audio );
    }










    /**
     * Returns all file with data, in base64 format, for all audio files.
     */
    getAudioFileData() {
        /** @type {PackageFileModel[]} */
        let files = _.filter( this.#data.files, f => f.mediaType === MediaTypes.Audio )
            .filter( f => fs.existsSync( f.physicalName ) )
            .map( f => {
                let m = new PackageFileModel();

                m.fileId = f.fileId;
                m.mediaType = f.mediaType;
                m.fileName = f.fileName;
                m.contents = fs.readFileSync( f.physicalName ).toString( 'base64' );

                return m;
            } );

        return files;
    }

}

module.exports = FilesDatabaseStore;