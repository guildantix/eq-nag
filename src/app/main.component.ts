import { Component, ViewChild, ElementRef, NgZone } from '@angular/core';
import { IpcRenderer, remote } from 'electron';
// import { DkpEntryModel } from '../../data/models/dkp-entry.js';
import * as _ from 'lodash';
import { MatSnackBar, MatSnackBarRef, SimpleSnackBar } from '@angular/material/snack-bar';
// implements OnInit
@Component( {
    selector: 'app-main',
    templateUrl: 'main.component.html',
    styleUrls: [ 'main.component.scss', 'core.scss' ]
} )
export class MainComponent  {

    private ipc: IpcRenderer;
    public msg: string;
    public dkpEntries: any[] = [];
    public version: string;
    public logFile: string = 'Not Selected';
    public showConsole: boolean = true;
    public voiceIndex: number = null;
    public voiceOptions: SpeechSynthesisVoice[] = [];

    @ViewChild( 'fileSelector' ) private fileSelector: ElementRef<HTMLInputElement>;

    constructor( private ngZone: NgZone, private snackBar: MatSnackBar ) {
        if ( ( <any>window ).require ) {
            try {
                speechSynthesis.onvoiceschanged = () => {
                    this.voiceOptions = speechSynthesis.getVoices();
                };
                this.ipc = ( <any>window ).require( 'electron' ).ipcRenderer;
                this.ipc.on( 'info', ( event, data ) => {
                    this.msg = data.msg;
                } );
                this.ipc.on( 'tick', ( event, data ) => {
                    ngZone.run( () => {
                        this.dkpEntries = data.dkpEntries;
                        this.logFile = data.logFile;
                        this.voiceIndex = data.voiceIndex;
                    } );
                } );
                this.ipc.on( 'transmitDkpDatabase', ( event: any, data: any[] ) => {
                    ngZone.run( () => {
                        this.dkpEntries = data;
                    } );
                } );
                this.ipc.on( 'changeLogFile', ( event: any, data: any ) => {
                    ngZone.run( () => {
                        this.logFile = data;
                    } );
                } );
                this.ipc.on( 'addDkpEntry', ( event: any, data: any ) => {
                    ngZone.run( () => {
                        if ( data && this.voiceIndex > -1 ) {
                            var utter = new SpeechSynthesisUtterance();
                            utter.text = `${data.item} awarded to ${data.character} for ${data.dkp} DKP.`;
                            utter.voice = this.voiceOptions[ this.voiceIndex ];
                            utter.onend = function ( event ) {  }
                            speechSynthesis.speak( utter );
                        }
                    } );
                } );
                this.ipc.on( 'dkpAwardRemoved', ( event, data ) => {
                    ngZone.run( () => {
                        let i = _.findIndex( this.dkpEntries, ( e ) => e.entryId === data );
                        this.dkpEntries.splice( i, 1 );
                    } );
                } );
                this.ipc.on( 'update-available', ( event: any, data: any[] ) => {
                    console.log( 'update available' );
                    ngZone.run( () => {
                        let bar: MatSnackBarRef<SimpleSnackBar> = snackBar.open( 'New release available.', 'Dismiss', { duration: 5000 } );
                    } );
                } );
                this.ipc.on( 'update-downloaded', ( event: any, data: any[] ) => {
                    console.log( 'update downloaded' );
                    ngZone.run( () => {
                        let bar: MatSnackBarRef<SimpleSnackBar> = snackBar.open( 'New release downloaded.', 'Restart', { duration: 5000 } );
                        bar.onAction().subscribe( () => {
                            this.ipc.send( 'restart_app', null );
                        } );
                    } );
                } );
                this.ipc.send( 'app_version' );
                this.ipc.once( 'app_version', ( e, v ) => {
                    ngZone.run( () => {
                        this.version = v.version;
                    } );
                } );
                this.ipc.on( 'console:log', ( event: any, data: any ) => {
                    console.log( 'log', data );
                } );
            } catch ( e ) {
                throw e;
            }
        } else {
            console.warn( 'App not running inside Electron!' );
        }
    }

    removeEntry ( entry: any ): void {
        this.ipc.send( 'removeDkpAward', entry );
    }

    quitApp (): void {
        this.ipc.send( 'quitApp' );
    }

    openModal () {
        this.fileSelector.nativeElement.click();
        // // console.log( "Open a modal" );
        // let options: Electron.OpenDialogOptions = {
        //     // See place holder 1 in above image
        //     title: "Select log file",

        //     // See place holder 3 in above image
        //     buttonLabel: "Select",

        //     // See place holder 4 in above image
        //     filters: [
        //         { name: 'All Files', extensions: [ '*.txt' ] }
        //     ],
        //     properties: [ 'openFile' ]
        // };
        // remote.dialog.showOpenDialog( remote.getCurrentWindow(), options );
        
    }

    fileSelected ( e: any ) {
        this.ipc.send( 'logSelected', this.fileSelector.nativeElement.files[ 0 ].path );
    }

    onChangeTabs ( selectedIndex: number ): void {
        this.showConsole = selectedIndex === 0;
    }

    onChangeVoice (): void {
        this.ipc.send( 'selectVoice', this.voiceIndex );
    }

    parseToBulkUpload (): void {
        let bulkUploadString: string = '';
        if ( this.dkpEntries ) {

            this.dkpEntries.forEach( item => {
                bulkUploadString += `${item.item};${item.dkp};${item.character} Gratss\r\n`;
            } );

            // Send the data to the clipboard
            this.ipc.send( 'clipboard:writeText', bulkUploadString.replace( /\r\n$/gi, '' ) );

            // Notify the user of success
            this.snackBar.open( 'Bulk data has been copied to your clipboard!', 'Dismiss', { duration: 5000 } );
        }
    }

    markAllDkpEntered (): void {
        this.ipc.send( 'dkp:markAsEntered', this.dkpEntries );
    }

    resetDkpLog (): void {
        this.ipc.send( 'dkp:reset' );
    }

    showNewTriggerDialog (): void {
        this.ipc.send( 'trigger:dialog:new' );
    }
}
