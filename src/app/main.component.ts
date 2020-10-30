import { Component, ViewChild, ElementRef, OnInit } from '@angular/core';
import * as _ from 'lodash';
import { MatSnackBar, MatSnackBarRef, SimpleSnackBar } from '@angular/material/snack-bar';
import { IpcService } from './ipc.service';
import { DkpEntryModel, TriggerModel, OverlayWindowModel, FocusEffectSettings } from './core.model';
import { VirtualTimeScheduler } from 'rxjs';
import { DialogService } from './dialogs/dialog.service';
import { monitorEventLoopDelay } from 'perf_hooks';
import { ScraperService } from './scraper.service';

@Component( {
    selector: 'app-main',
    templateUrl: 'main.component.html',
    styleUrls: [ 'main.component.scss', 'core.scss' ]
} )
export class MainComponent implements OnInit {

    public msg: string;
    public dkpEntries: DkpEntryModel[] = [];
    public version: string;
    public logFile: string = 'Not Selected';
    public showConsole: boolean = true;
    public voiceIndex: number = null;
    public enableFct: boolean = false;
    public voiceOptions: SpeechSynthesisVoice[] = [];
    public triggers: TriggerModel[] = [];
    public overlays: OverlayWindowModel[] = [];
    public damageDealtOverlayId: string;
    public damageTakenOverlayId: string;
    public focusEffectSettings: FocusEffectSettings = new FocusEffectSettings();
    public isDev: boolean = false;

    public _testDealtOverlayId: string = 'wT8389KxT5zlsaiE';
    public _testTakenOverlayId: string = 'wT8389KxT5zlsaiE';
    public _testId: number;
    public _testIndex: number = 0;
    public _testdata = [
        '[Sat Mar 14 13:45:08 2020] You hit an ikaav binder pet for 12827 points of physical damage by Ferocious Kick X.',
        '[Sat Mar 14 13:46:08 2020] You kick an ikaav binder pet for 1299 points of damage. (Riposte Strikethrough)',
        '[Sat Mar 14 13:47:08 2020] You crush a kyv hunter for 5361 points of damage. (Riposte)',
        '[Sat Mar 14 13:48:08 2020] You slash an aneuk fleshthreader for 10742 points of damage.',
        '[Sat Mar 14 13:49:08 2020] You slash a kyv hunter for 29027 points of damage. (Lucky Critical)',
    ];

    @ViewChild( 'fileSelector' ) private fileSelector: ElementRef<HTMLInputElement>;

    public get fctOverlays(): OverlayWindowModel[] {
        return this.overlays.filter( f => f.overlayType === 'FCT' );
    }

    constructor( private snackBar: MatSnackBar, private ipcService: IpcService, private dialogService: DialogService, private scraper: ScraperService ) {
        speechSynthesis.onvoiceschanged = () => {
            this.voiceOptions = speechSynthesis.getVoices();
        };
    }

    ngOnInit(): void {
        this.ipcService.tickReceived().subscribe( data => {
            this.dkpEntries = data.dkpEntries;
            this.logFile = data.logFile;
            this.voiceIndex = data.voiceIndex;
            this.triggers = _.filter( data.triggers, f => this.isDev || !f.predefined );
            this.overlays = data.overlays;
            this.enableFct = data.enableFct;
            this.damageDealtOverlayId = data.damageDealtOverlayId;
            this.damageTakenOverlayId = data.damageReceivedOverlayId;
            this.focusEffectSettings.hasExtendedDotFocus = data.hasExtendedDotFocus;
            this.focusEffectSettings.extendedDotFocusPercent = data.extendedDotFocusPercent;
            this.focusEffectSettings.extendedDotFocusDecayLevel = data.extendedDotFocusDecayLevel;
            // console.log( 'data', data );
        } );

        this.ipcService.dkpEntryAdded().subscribe( model => {
            if ( model && this.voiceIndex > -1 ) {
                var utter = new SpeechSynthesisUtterance();
                utter.text = `${model.item} awarded to ${model.character} for ${model.dkp} DKP.`;
                utter.voice = this.voiceOptions[ this.voiceIndex ];
                utter.onend = function ( event ) { }
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
        this.ipcService.getAppIsDev().subscribe( isDev => this.isDev = isDev );
    }

    removeEntry( entry: any ): void {
        this.ipcService.removeDkpAward( entry );
    }

    quitApp(): void {
        this.ipcService.quitApp();
    }

    openModal() {
        this.fileSelector.nativeElement.click();
    }

    fileSelected( e: any ) {
        this.ipcService.updateLogFile( this.fileSelector.nativeElement.files[ 0 ].path );
    }

    onChangeTabs( selectedIndex: number ): void {
        this.showConsole = selectedIndex === 0;
    }

    onChangeVoice(): void {
        this.ipcService.updateVoiceIndex( this.voiceIndex );
    }

    onEnableFctChange(): void {
        this.ipcService.updateEnableFct( this.enableFct );
    }

    onChangeDealtFctOverylays(): void {
        this.ipcService.updateDamageDealtOverlayId( this.damageDealtOverlayId );
    }

    onChangeReceivedFctOverylays(): void {
        this.ipcService.updateDamageReceivedOverlayId( this.damageTakenOverlayId );
    }

    parseToBulkUpload(): void {
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

    markAllDkpEntered(): void {
        this.ipcService.markDkpEntriesAsEntered( this.dkpEntries );
    }

    resetDkpLog(): void {
        this.ipcService.clearDkpLog();
    }

    showNewTriggerDialog(): void {
        this.ipcService.showNewTriggerDialog();
    }

    showEditTriggerDialog( triggerId: string ): void {
        this.ipcService.showEditTriggerDialog( triggerId );
    }

    deleteTrigger( index: number ): void {
        this.dialogService.showConfirmDialog(
            `Are you sure you want to delete ${this.triggers[ index ].name}?`,
            'Click "Yes" to delete this trigger.', 'Click "No" to close this dialog without deleting this trigger.',
            confirmed => {
                if ( confirmed === true ) {
                    this.ipcService.deleteTrigger( this.triggers[ index ].triggerId ).subscribe();
                }
            } );
    }

    showNewOverlayDialog(): void {
        this.dialogService.
            showOverlayDetailsDialog( new OverlayWindowModel() )
            .subscribe( model => {
                if ( model?.isValid() === true ) {
                    this.ipcService.createNewOverlayWindow( model ).subscribe( overlayId => {
                        this.ipcService.showEditOverlayDialog( overlayId );
                    } );
                }
            } );
    }

    enableOverlayEdit( overlayId: string ): void {
        this.ipcService.showEditOverlayDialog( overlayId );
    }

    deleteOverlay( index: number ): void {
        this.dialogService.showConfirmDialog(
            `Are you sure you want to delete ${this.overlays[ index ].name}?`,
            'Click "Yes" to delete this overlay.', 'Click "No" to close this dialog without deleting this overlay.',
            confirmed => {
                if ( confirmed === true ) {
                    this.ipcService.deleteOverlayWindow( this.overlays[ index ].overlayId ).subscribe();
                }
            } );
    }

    public showNewDotTimerDialog(): void {
        this.dialogService.showNewDotTimerDialog();
    }

    public updateFocusEffectSettings(): void {
        this.ipcService.updateFocusEffectSettings( this.focusEffectSettings );
    }

    public testFn(): void {
        this.ipcService.simulateLogParse( 'E:\\everquest\\Logs\\Backup\\eqlog_Ryvn_mangler_20201024_204401.txt' );
        // let url: string = 'https://everquest.allakhazam.com/db/spell.html?spell=5423';
        // let charClass: string = 'NEC';

        // this.scraper.ScrapeAllakhazamSpell( 'https://everquest.allakhazam.com/db/spell.html?spell=5423', charClass ).subscribe( spell => console.log( 'spell', spell ) );
        // this.scraper.ScrapeAllakhazamSpell( 'https://everquest.allakhazam.com/db/spell.html?spell=2885', charClass ).subscribe( spell => console.log( 'spell', spell ) );

        // function reqListener() {
        //     let div = document.createElement( 'div' );
        //     div.style.display = 'none';
        //     div.id = 'testingDiv';
        //     document.body.appendChild( div );
        //     div.innerHTML = this.responseText;

        //     let model = {
        //         name: div.querySelector( 'meta[property="og:title"]' ).getAttribute( 'content' ),
        //         duration: 0,
        //         _duration: document.evaluate( "//strong[contains(., 'Duration:')]", document, null, XPathResult.ANY_TYPE, null ).iterateNext().nextSibling.nextSibling.textContent.trim(),
        //         class: document.evaluate( "//div[contains(@class, 'db-infobox')]/table/tbody/tr/td/strong[contains(., '" + charClass + "')]", document, null, XPathResult.ANY_TYPE, null ).iterateNext().textContent,
        //         level: +document.evaluate( "//div[contains(@class, 'db-infobox')]/table/tbody/tr/td/strong[contains(., '" + charClass + "')]", document, null, XPathResult.ANY_TYPE, null ).iterateNext().parentNode.nextSibling.textContent,
        //         castOnOther: document.evaluate("//blockquote[contains(., 'Cast on other')]", document, null, XPathResult.ANY_TYPE, null ).iterateNext().textContent.split('Cast on other: ')[1].split('Effect Fades: ')[0],
        //     };

        //     if ( model._duration.indexOf( 'ticks' ) > -1 ) {
        //         model.duration = parseFloat( model._duration ) * 6;
        //     } else {
        //         model.duration = parseFloat( model._duration ) * 10 * 6;
        //     }

        //     console.log( 'found', model );

        //     document.body.removeChild( div );
        //     div = null;
            
        //     // console.log( 'spell name', div.querySelector( 'meta[property="og:title"]' ).getAttribute( 'content' ) );
        //     // console.log( 'spell duration', document.evaluate( "//strong[contains(., 'Duration:')]", document, null, XPathResult.ANY_TYPE, null ).iterateNext().nextSibling.nextSibling );
        //     // let shadow = div.attachShadow( { mode: 'open' } );
        //     // shadow.innerHTML = this.responseText;

        //     // console.log( 'spell name', shadow.querySelector( 'meta[property="og:title"]' ).getAttribute( 'content' ) );
        //     // console.log( 'spell duration', shadow.ownerDocument.evaluate( "//strong[contains(., 'Duration:')]", document, null, XPathResult.ANY_TYPE, null ).iterateNext().nextSibling.nextSibling );
            
        //     // console.log( this.responseText );
        // }
          
        // var oReq = new XMLHttpRequest();
        // oReq.addEventListener( "load", reqListener );
        // oReq.open( "GET", url );
        // oReq.send();
        // this.httpClient.get( url ).subscribe( f => { 
        //     console.log( 'testing' );
        //  } );
        // // this.ipcService.sendTestModel( `Target Name --== Dot Name ==--` );
        // this.ipcService.sendTestFn( '[Fri Oct 02 09:34:19 2020] You begin casting Funeral Pyre of Kelador.' );
        // window.setTimeout( () => { this.ipcService.sendTestFn( '[Fri Oct 02 09:34:25 2020] A carrion beetle hatchling has taken 350 damage from your Funeral Pyre of Kelador.' ); }, 1000 );
        // // A carrion beetle hatchling has taken 350 damage from your Funeral Pyre of Kelador.
        // window.setTimeout( () => { this.ipcService.sendTestFn( '[Fri Oct 02 09:34:21 2020] a carrion beetle hatchling is enveloped in a funeral pyre.' ); }, 2000 );
        // window.setTimeout( () => { this.ipcService.sendTestFn( '[Fri Oct 02 09:34:25 2020] A carrion beetle hatchling has taken 350 damage from your Funeral Pyre of Kelador.' ); }, 6000 );
        // window.setTimeout( () => { this.ipcService.sendTestFn( '[Fri Oct 02 09:34:25 2020] You have slain a carrion beetle hatchling!' ); }, 6000 );

        // if ( this._testId > 0 ) {
        //     window.clearInterval( this._testId );
        //     this._testId = null;
        //     this._testIndex = 0;
        // } else {
        //     for ( var i = 0; i < this._testdata.length; i++ ){
        //         let _i = i;
        //         window.setTimeout( () => {
        //             console.log( 'sending', _i, this._testdata[ _i ] );
        //             this.ipcService.sendTestFn( this._testdata[ _i ] )
        //         }, i * 1000 );
        //     }
        //     // this.ipcService.sendTestFn( { overlayId: this._testDealtOverlayId, dealt: true, text: '' + Math.floor(Math.random() * 999 + 1) } );
        //     // this.ipcService.sendTestFn( { overlayId: this._testDealtOverlayId, dealt: true, text: '' + Math.floor(Math.random() * 999 + 1) } );
        //     // this.ipcService.sendTestFn( { overlayId: this._testDealtOverlayId, dealt: true, text: '' + Math.floor(Math.random() * 999 + 1), critical: true } );
        //     // this.ipcService.sendTestFn( { overlayId: this._testDealtOverlayId, dealt: true, text: '' + Math.floor(Math.random() * 999 + 1), critical: true } );
        //     // this.ipcService.sendTestFn( { overlayId: this._testDealtOverlayId, dealt: true, text: '' + Math.floor(Math.random() * 999 + 1), critical: true } );
        //     // this.ipcService.sendTestFn( { overlayId: this._testDealtOverlayId, dealt: true, text: '' + Math.floor(Math.random() * 999 + 1), critical: true } );
        //     // this.ipcService.sendTestFn( { overlayId: this._testDealtOverlayId, dealt: true, text: '' + Math.floor(Math.random() * 999 + 1), critical: true } );
        //     // this.ipcService.sendTestFn( { overlayId: this._testDealtOverlayId, dealt: true, text: '' + Math.floor(Math.random() * 999 + 1), critical: true } );
        //     // this.ipcService.sendTestFn( { overlayId: this._testDealtOverlayId, dealt: true, text: '' + Math.floor(Math.random() * 999 + 1), critical: true } );
        //     // this._testId = window.setInterval( () => {
        //     //     // this.ipcService.sendTestFn( { overlayId: this._testDealtOverlayId, dealt: true, text: '' + Math.floor(Math.random() * 999 + 1) } );
        //     // }, 1000 );
        // }
        
    }

}
