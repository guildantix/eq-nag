import { Component, OnInit, Inject, ElementRef, ViewChild } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { CharacterModel, NewCharacterOptionModel } from 'src/app/core.model';
import { IpcService } from 'src/app/ipc.service';
import { customAlphabet } from 'nanoid';
import { MatSelectChange } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import * as _ from 'lodash-es';

const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const nanoid = customAlphabet( alphabet, 16 );

declare var window: {
    requestFileSystem: any,
    directoryEntry: any,
    webkitDirectoryEntry: any,
    webkitRequestFileSystem: any,
    Files: any,
};

@Component( {
    selector: 'app-new-character-dialog',
    templateUrl: 'new-character-dialog.component.html',
    styleUrls: [ 'new-character-dialog.component.scss' ]
} )
export class NewCharacterDialogComponent implements OnInit {

    public url: string;
    public eqFolder: string = undefined;
    public model: CharacterModel;
    public serverOptions: NewCharacterOptionModel[] = [];
    public server: NewCharacterOptionModel;
    public existingCharacters: CharacterModel[] = [];

    @ViewChild( 'fileSelector' ) private fileSelector: ElementRef<HTMLInputElement>;

    constructor(
        public dialogRef: MatDialogRef<NewCharacterDialogComponent>,
        @Inject( MAT_DIALOG_DATA ) public data: any,
        public ipcService: IpcService,
        private snackBar: MatSnackBar,
    ) { }

    ngOnInit(): void {
        this.ipcService.getCharacters().subscribe( characters => {
            this.existingCharacters = characters;
            console.log( 'characters', characters );
        } );
        this.ipcService.getEqInstallFolder().subscribe( folder => {
            this.eqFolder = folder;
            this.populateCharacterOptions();
        } );
    }

    populateCharacterOptions(): void {
        
        let logsPath: string = this.eqFolder + '\\Logs';
            
        // get filename regex: \\{0,1}((?:.(?!\\))+)$
        // get file ext regex: \.((?:.(?!\\))+)$
        // get name only regex: \\{0,1}((?:.(?!\\))+)\.(?:.(?!\\))+$
        // get char dets regex: eqlog_(?<Character>.*)_(?<Server>[a-z]*)\.txt$
        
        let fs: any = this.ipcService.remote.require( 'fs' );
        if ( fs.existsSync( logsPath ) ) {
            fs.readdir( logsPath, ( err, files ) => {
                let dictionary: any = {};
                files.forEach( file => {
                    let results = /eqlog_(?<Character>.*)_(?<Server>[a-z]*)\.txt$/gi.exec( file );
                    if ( results != null && results?.groups?.Character != null && results?.groups?.Server != null ) {
                        if ( dictionary[ results.groups.Server ] == null ) {
                            dictionary[ results.groups.Server ] = [];
                        }
                        let option: CharacterModel = new CharacterModel();

                        option.name = results.groups.Character;
                        option.server = results.groups.Server;
                        option.logFile = `${logsPath}\\${file}`;
                        option.characterId = this.findCharacterId( option.logFile );
                        
                        dictionary[ results.groups.Server ].push( option );
                    }
                } );

                for ( let key in dictionary ) {
                    if ( dictionary.hasOwnProperty( key ) ) {
                        let option: NewCharacterOptionModel = new NewCharacterOptionModel();
                        option.server = key;
                        option.options = dictionary[ key ];
                        this.serverOptions.push( option );
                    }
                }

            } );
        }
    }

    /**
     * Returns the character id of the character specified by their log file.
     * 
     * @param logFile The log file for the desired character.
     */
    findCharacterId( logFile: string ): string {
        
        if ( logFile ) {
            for ( let i = 0; i < this.existingCharacters?.length; i++ ) {
                if ( this.existingCharacters[ i ].logFile?.toLowerCase() === logFile?.toLowerCase() ) {
                    return this.existingCharacters[ i ].characterId;
                }
            }
        }

        return null;
    }

    selectModel( e: MatSelectChange ): void {
        this.model = e.value;
    }

    selectServerModel( e: MatSelectChange ): void {
        this.server = e.value;
    }

    create(): void {
        this.ipcService.createCharacter( this.model ).subscribe( characterId => {
            if ( characterId != null ) {
                this.snackBar.open( 'Character added!', 'Dismiss', { duration: 2500 } );
                this.dialogRef.close( characterId );
            }
        } );
    }

    showFileSelector() {
        this.fileSelector.nativeElement.click();
    }

    fileSelected( e: any ) {
        if ( this.fileSelector.nativeElement.files?.length > 0 ) {
            let characterLogPath: string = this.fileSelector.nativeElement.files[ 0 ].path;
            let eqInstallFolder: string = characterLogPath.split( '\\Logs' )[ 0 ];

            this.ipcService.setEqInstallFolder( eqInstallFolder );

            let results = /eqlog_(?<Character>.*)_(?<Server>[a-z]*)\.txt$/gi.exec( characterLogPath );
            if ( results != null && results?.groups?.Character != null && results?.groups?.Server != null ) {

                let option: CharacterModel = new CharacterModel();

                option.name = results.groups.Character;
                option.server = results.groups.Server;
                option.logFile = `${characterLogPath}`;

                this.model = option;
            }

        }
    }
    
}
