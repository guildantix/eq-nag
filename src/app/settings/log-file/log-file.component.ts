import { Component, OnInit } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FileReadDelays } from 'src/app/core.model';
import { IpcService } from 'src/app/ipc.service';

@Component( {
    selector: 'app-log-file',
    templateUrl: './log-file.component.html',
    styleUrls: [ './log-file.component.scss' ]
} )
export class LogFileComponent implements OnInit {

    public showSettings: boolean = false;
    public showSaveButton: boolean = false;
    public readDelay: number = 200;
    public readErrorDelay: number = 1000;
    public flushDelay: number = 1000;

    constructor(
        private readonly ipcService: IpcService,
        private readonly snackBar: MatSnackBar,
    ) { }

    ngOnInit(): void {
        this.ipcService.getSetting<FileReadDelays>( 'fileReadDelays', false ).subscribe( data => {
            this.readDelay = data.readDelayMs;
            this.readErrorDelay = data.readErrorDelayMs;
            this.flushDelay = data.flushDelayMs;
        } );
    }









    
    /**
     * Show the save button when the settings are changed.
     */
    public onSettingsChanged(): void {
        this.showSaveButton = true;
    }









    
    /**
     * Save the settings to the main process. Keep the settings displayed in the 
     * UI.
     */
    public saveSettings(): void {
        this.ipcService.updateSetting( 'fileReadDelays', {
            readDelayMs: this.readDelay,
            readErrorDelayMs: this.readErrorDelay,
            flushDelayMs: this.flushDelay
        } );
        this.showSaveButton = false;
        this.snackBar.open( 'Settings saved', 'Close', { duration: 2000 } );
    }










    /**
     * Cancel the settings changes by getting the settings from the main process 
     * and reverting the changes in the UI. Hide the settings dialog after a 
     * delay.
     */
    public cancelSettings(): void {
        
        this.showSaveButton = false;

        this.ipcService.getSetting<FileReadDelays>( 'fileReadDelays', false ).subscribe( data => {
            this.readDelay = data.readDelayMs;
            this.readErrorDelay = data.readErrorDelayMs;
            this.flushDelay = data.flushDelayMs;

            window.setTimeout( () => {
                this.snackBar.open( 'Settings reverted', 'Close', { duration: 2000 } );
                this.showSettings = false;
            }, 500 );
        } );
    }
}
