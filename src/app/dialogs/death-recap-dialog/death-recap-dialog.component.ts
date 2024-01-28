import { Component, OnInit, Inject, ViewChild, ElementRef } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatSelectChange } from '@angular/material/select';
import { MatStepper } from '@angular/material/stepper';
import { CharacterModel, LogFileLocation, NewCharacterOptionModel } from 'src/app/core.model';
import { IpcService } from 'src/app/ipc.service';
import { ColoredString } from '../dialog.model';

@Component( {
    selector: 'app-death-recap-dialog',
    templateUrl: 'death-recap-dialog.component.html',
    styleUrls: [ 'death-recap-dialog.component.scss', '../dialog.styles.scss', '../../core.scss' ]
} )
export class DeathRecapDialogComponent implements OnInit {

    public eqFolder: string = undefined;
    public serverOptions: NewCharacterOptionModel[] = [];
    public model: CharacterModel;
    public server: NewCharacterOptionModel;
    public loadingDeaths: boolean = true;
    public deaths: LogFileLocation[] = [];

    @ViewChild( 'fileSelector' ) private fileSelector: ElementRef<HTMLInputElement>;
    @ViewChild( 'stepper', { static: false, read: MatStepper } ) public stepper: MatStepper;

    constructor(
        public dialogRef: MatDialogRef<DeathRecapDialogComponent>,
        @Inject( MAT_DIALOG_DATA ) public data: any,
        private ipcService: IpcService,
    ) { }

    ngOnInit(): void {
        this.ipcService.getEqInstallFolder().subscribe( folder => {
            this.eqFolder = folder;
            this.populateCharacterOptions();
        } );
    }

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

    selectModel( e: MatSelectChange ): void {
        this.model = e.value;
    }

    selectServerModel( e: MatSelectChange ): void {
        this.server = e.value;
    }

    showFileSelector() {
        this.fileSelector.nativeElement.click();
    }

    fileSelected( e: any ) {
        if ( this.fileSelector.nativeElement.files?.length > 0 ) {
            let characterLogPath: string = this.fileSelector.nativeElement.files[ 0 ].path;

            let results = /eqlog_(?<Character>.*)_(?<Server>[a-z]*)\.txt$/gi.exec( characterLogPath );
            if ( results != null && results?.groups?.Character != null && results?.groups?.Server != null ) {

                let option: CharacterModel = new CharacterModel();

                option.name = results.groups.Character;
                option.server = results.groups.Server;
                option.logFile = `${characterLogPath}`;

                this.model = option;
                this.findDeaths();
            }

        }
    }

    findDeaths() {
        this.ipcService
            .findPlayerCharacterDeaths( this.model.logFile )
            .subscribe( deathsFound => {
                this.deaths = deathsFound;
                this.loadingDeaths = false;
            } );
        this.stepper.next();
    }

    showDeathRecap( logFileLoc: LogFileLocation ) {
        this.ipcService.showDeathRecap( logFileLoc, this.model.name );
        this.dialogRef.close();
    }
    
}
