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

@Component( {
    selector: 'app-new-character-dialog',
    templateUrl: 'new-character-dialog.component.html',
    styleUrls: [ '../dialog.styles.scss', '../../core.scss', '../../modal.scss', 'new-character-dialog.component.scss' ]
} )
export class NewCharacterDialogComponent implements OnInit {

    public url: string;
    public eqFolder: string = undefined;
    public model: CharacterModel | undefined = undefined;
    public serverOptions: NewCharacterOptionModel[] = [];
    public server: NewCharacterOptionModel;
    public existingCharacters: CharacterModel[] = [];
    public panel: 'missingInstallFolder' | 'selectCharacter' | 'modelReview' | 'manualInput' = 'selectCharacter';
    // public serviceOptions: string[] = [ 'p99', 'daybreak', 'takp', 'other' ];
    public selectedService: string = 'daybreak';
    public otherServiceName: string = '';

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
        } );
        this.ipcService.getEqInstallFolder().subscribe( folder => {
            this.eqFolder = folder;
            this.populateCharacterOptions();

            if (this.eqFolder == undefined) {
                this.panel = 'missingInstallFolder';
            }
        } );
    }









    
    /**
     * Retrieves and populates the character options.
     */
    populateCharacterOptions(): void {
        
        let logsPath: string = this.eqFolder + '\\Logs';

        this.ipcService.getCharacterOptions( logsPath ).subscribe( options => {
            for ( let key in options ) {
                if ( options.hasOwnProperty( key ) ) {
                    let option: NewCharacterOptionModel = new NewCharacterOptionModel();
                    option.server = key;
                    option.options = options[ key ];
                    this.serverOptions.push( option );
                }
            }
        } );
        
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









    
    /**
     * 
     * @param e The mat select change event args.
     * @param p99 If true, the selected character is on the p99 service.
     * @param daybreak If  true, the selected character is on the daybreak service.
     */
    selectModel( e: MatSelectChange, p99: boolean = false, daybreak: boolean = false ): void {
        this.model = e.value;
        this.model.p99 = p99 === true;
        this.model.daybreak = daybreak === true;
    }









    
    /**
     * Changes the selected server.
     * 
     * @param e The mat select change event args.
     */
    selectServerModel( e: MatSelectChange ): void {
        this.server = e.value;
    }









    
    /**
     * Submits the current model to the service to create the character.
     */
    create(): void {
        this.ipcService.createCharacter( this.model ).subscribe( characterId => {
            if ( characterId != null ) {
                this.snackBar.open( 'Character added!', 'Dismiss', { duration: 2500 } );
                this.dialogRef.close( characterId );
            }
        } );
    }









    
    /**
     * Shows the file selector dialog.
     */
    showFileSelector() {
        this.fileSelector.nativeElement.click();
    }









    
    /**
     * Clears the selected character.
     */
    cancelCharacter() {
        this.model = undefined;
        this.fileSelector.nativeElement.value = null;
        this.panel = this.eqFolder == null ? 'missingInstallFolder' : 'selectCharacter';
    }










    /**
     * Uses manual user input to create a character model.
     */
    createManualModel() {
        this.model.server = this.model.server?.toLowerCase() || '';
        this.model.p99 = this.selectedService == 'p99';
        this.model.daybreak = this.selectedService == 'daybreak';
        this.model.takp = this.selectedService == 'takp';

        this.panel = 'modelReview';
    }










    /**
     * Handles the file select event and parses the selected log file for character import.
     * 
     * @param e The event args.
     */
    fileSelected( e: any ) {
        if ( this.fileSelector.nativeElement.files?.length > 0 ) {
            let characterLogPath: string = this.fileSelector.nativeElement.files[ 0 ].path;
            let eqInstallFolder: string = characterLogPath.split( '\\Logs' )[ 0 ];

            let results = /eqlog_(?<Character>.*)_(?<Server>[a-z]*)\.txt$/gi.exec( characterLogPath );
            if ( results != null && results?.groups?.Character != null && results?.groups?.Server != null ) {

                let option: CharacterModel = new CharacterModel();

                option.name = results.groups.Character;
                option.server = results.groups.Server;
                option.logFile = `${characterLogPath}`;
                option.takp = false;
                option.p99 = false;
                option.daybreak = true;

                this.model = option;

                this.ipcService.setEqInstallFolder( eqInstallFolder );
            }

            let p99Results = /eqlog_(?<Character>.*)_P1999(?<Server>[a-z]*)\.txt$/gi.exec( characterLogPath );
            if ( p99Results != null && p99Results?.groups?.Character != null && p99Results?.groups?.Server != null ) {

                let option: CharacterModel = new CharacterModel();

                option.name = p99Results.groups.Character;
                option.server = p99Results.groups.Server;
                option.logFile = `${characterLogPath}`;
                option.takp = false;
                option.p99 = true;
                option.daybreak = false;

                this.model = option;

            }
            
            let p99Special = /eqlog_(?<Character>.*)_project1999\.txt$/gi.exec( characterLogPath );
            if ( p99Special != null && p99Special?.groups?.Character != null ) {

                let option: CharacterModel = new CharacterModel();

                option.name = p99Special.groups.Character;
                option.server = 'project1999';
                option.logFile = `${characterLogPath}`;
                option.takp = false;
                option.p99 = true;
                option.daybreak = false;

                this.model = option;

            }

            // eqlog_Testname_pq.proj.txt
            let quarm = /eqlog_(?<Character>.*)_pq\.proj\.txt$/gi.exec( characterLogPath );
            if ( quarm != null && quarm?.groups?.Character != null ) {

                let option: CharacterModel = new CharacterModel();

                option.name = quarm.groups.Character;
                option.server = 'quarm';
                option.logFile = `${characterLogPath}`;
                option.takp = true;
                option.p99 = false;
                option.daybreak = false;

                this.model = option;

            }

            if ( this.model == undefined ) {
                this.model = new CharacterModel();
                this.model.logFile = `${characterLogPath}`;
                this.panel = 'manualInput';
            } else {
                this.panel = 'modelReview';
            }
        }
    }
    
}
