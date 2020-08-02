import { Component, ViewChild, ElementRef, OnInit } from '@angular/core';
import * as _ from 'lodash';
import { MatSnackBar, MatSnackBarRef, SimpleSnackBar } from '@angular/material/snack-bar';
import { IpcService } from './ipc.service';
import { DkpEntryModel, TriggerModel, OverlayWindowModel } from './core.model';
import { VirtualTimeScheduler } from 'rxjs';
import { DialogService } from './dialogs/dialog.service';

@Component( {
    selector: 'app-main',
    templateUrl: 'main.component.html',
    styleUrls: [ 'main.component.scss', 'core.scss' ]
} )
export class MainComponent implements OnInit  {

    public msg: string;
    public dkpEntries: DkpEntryModel[] = [];
    public version: string;
    public logFile: string = 'Not Selected';
    public showConsole: boolean = true;
    public voiceIndex: number = null;
    public voiceOptions: SpeechSynthesisVoice[] = [];
    public triggers: TriggerModel[] = [];
    public overlays: OverlayWindowModel[] = [];

    @ViewChild( 'fileSelector' ) private fileSelector: ElementRef<HTMLInputElement>;

    constructor( private snackBar: MatSnackBar, private ipcService: IpcService, private dialogService: DialogService ) {
        speechSynthesis.onvoiceschanged = () => {
            this.voiceOptions = speechSynthesis.getVoices();
        };
    }

    ngOnInit (): void {
        this.ipcService.tickReceived().subscribe( data => {
            this.dkpEntries = data.dkpEntries;
            this.logFile = data.logFile;
            this.voiceIndex = data.voiceIndex;
            this.triggers = data.triggers;
            this.overlays = data.overlays;
        } );

        this.ipcService.dkpEntryAdded().subscribe( model => {
            if ( model && this.voiceIndex > -1 ) {
                var utter = new SpeechSynthesisUtterance();
                utter.text = `${model.item} awarded to ${model.character} for ${model.dkp} DKP.`;
                utter.voice = this.voiceOptions[ this.voiceIndex ];
                utter.onend = function ( event ) {  }
                speechSynthesis.speak( utter );
            }
        } );

        this.ipcService.dkpEntryRemoved().subscribe( entryId => {
            let i = _.findIndex( this.dkpEntries, ( e: DkpEntryModel ) => e.entryId === entryId );
            this.dkpEntries.splice( i, 1 );
        } );

        this.ipcService.receiveDkpDatabase().subscribe( data => this.dkpEntries = data );
        this.ipcService.logFileChanged().subscribe( data => this.logFile = data );
        this.ipcService.getAppVersion().subscribe( version => this.version = version );
        this.ipcService.consoleLogRequested().subscribe( data => console.log( 'from main', data ) );
    }

    removeEntry ( entry: any ): void {
        this.ipcService.removeDkpAward( entry );
    }

    quitApp (): void {
        this.ipcService.quitApp();
    }

    openModal () {
        this.fileSelector.nativeElement.click();
    }

    fileSelected ( e: any ) {
        this.ipcService.updateLogFile( this.fileSelector.nativeElement.files[ 0 ].path );
    }

    onChangeTabs ( selectedIndex: number ): void {
        this.showConsole = selectedIndex === 0;
    }

    onChangeVoice (): void {
        this.ipcService.updateVoiceIndex( this.voiceIndex );
    }

    parseToBulkUpload (): void {
        let bulkUploadString: string = '';
        if ( this.dkpEntries ) {

            this.dkpEntries.forEach( item => {
                bulkUploadString += `${item.item};${item.dkp};${item.character} Gratss\r\n`;
            } );

            // Send the data to the clipboard
            this.ipcService.sendTextToClipboard( bulkUploadString.replace( /\r\n$/gi, '' ) );

            // Notify the user of success
            this.snackBar.open( 'Bulk data has been copied to your clipboard!', 'Dismiss', { duration: 5000 } );
        }
    }

    markAllDkpEntered (): void {
        this.ipcService.markDkpEntriesAsEntered( this.dkpEntries );
    }

    resetDkpLog (): void {
        this.ipcService.clearDkpLog();
    }

    showNewTriggerDialog (): void {
        this.ipcService.showNewTriggerDialog();
    }

    showEditTriggerDialog ( triggerId: string ): void {
        this.ipcService.showEditTriggerDialog( triggerId );
    }

    deleteTrigger ( index: number ): void {
        this.dialogService.showConfirmDialog(
            `Are you sure you want to delete ${this.triggers[ index ].name}?`,
            'Click "Yes" to delete this trigger.', 'Click "No" to close this dialog without deleting this trigger.',
            confirmed => {
                if ( confirmed === true ) {
                    this.ipcService.deleteTrigger( this.triggers[ index ].triggerId ).subscribe();
                }
            } );
    }

    showNewOverlayDialog (): void {
        this.dialogService.
            showOverlayDetailsDialog( new OverlayWindowModel() )
            .subscribe( model => {
                if ( model?.isValid() === true ) {
                    this.ipcService.createNewOverlayWindow( model ).subscribe( overlayId => { } );
                }
            } );
    }

    enableOverlayEdit ( overlayId: string ): void {
        this.ipcService.showEditOverlayDialog( overlayId );
    }

    deleteOverlay ( index: number ): void {
        this.dialogService.showConfirmDialog(
            `Are you sure you want to delete ${this.overlays[ index ].name}?`,
            'Click "Yes" to delete this overlay.', 'Click "No" to close this dialog without deleting this overlay.',
            confirmed => {
                if ( confirmed === true ) {
                    this.ipcService.deleteOverlayWindow( this.overlays[ index ].overlayId ).subscribe();
                }
            } );
    }

}
