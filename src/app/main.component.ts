import { Component, ViewChild, ElementRef, OnInit } from '@angular/core';
import * as _ from 'lodash-es';
import { MatSnackBar } from '@angular/material/snack-bar';
import { IpcService } from './ipc.service';
import { DkpEntryModel, OverlayWindowModel, FocusEffectSettings, TriggerPackageMetaModel, StylePropertiesModel, FctStylesModel } from './core.model';
import { DialogService } from './dialogs/dialog.service';
import { ScraperService } from './scraper.service';
import { customAlphabet } from 'nanoid';
import { SetupService } from './setup/setup.service';
import { CharactersListComponent } from './characters-list/characters-list.component';
import { TriggerLibraryService } from './windows/trigger-library.service';
import { forkJoin, Observable, timer } from 'rxjs';
import { MatDialogRef } from '@angular/material/dialog';
import { NotificationDialogModel, NotificationTypes } from './dialogs/notification-dialog/notification-dialog.model';
import { CustomButton } from './dialogs/dialog.model';
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const nanoid = customAlphabet( alphabet, 16 );
const updateIntervalDuration = 5 * 60 * 1000;

@Component( {
    selector: 'app-main',
    templateUrl: 'main.component.html',
    styleUrls: [ 'main.component.scss', 'core.scss' ]
} )
export class MainComponent implements OnInit {

    public msg: string;
    public dkpEntries: DkpEntryModel[] = [];
    public logFile: string = 'Not Selected';
    public showConsole: boolean = true;
    public enableFct: boolean = false;
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
    public movingFolderSource: string = null;
    public setupCompleted: boolean = true;

    public combatType: string = 'DmgOut';
    public fctStyles: FctStylesModel = null;

    @ViewChild( 'fileSelector' ) private fileSelector: ElementRef<HTMLInputElement>;
    @ViewChild( 'characterList', { static: true } ) private characterList: CharactersListComponent;

    public get fctOverlays(): OverlayWindowModel[] {
        return this.overlays.filter( f => f.overlayType === 'FCT' );
    }

    constructor(
        private snackBar: MatSnackBar,
        private ipcService: IpcService,
        private dialogService: DialogService,
        private setupService: SetupService,
        private libraryService: TriggerLibraryService,
    ) {
    }

    ngOnInit(): void {

        this.ipcService.updateAvailable().subscribe( updateInfo => {
            this.ipcService.logInfo( `captured update info; ${JSON.stringify( updateInfo ?? {} )}` );
            let msg = `Update ${updateInfo.version} is available.  Would you like to install the update now?`;
            this.dialogService.showAskDialog(
                'Install Update?', msg, 'Click "Yes" to close Nag and install the update.', 'Click "No" to close this dialog and wait until Nag restarts to install the update.',
                confirmed => {
                    if ( confirmed ) {
                        this.ipcService.quitAndInstallUpdate();
                    }
                } );
        } );
        
        this.ipcService.getSetupCompleted().subscribe( completed => {
            this.setupCompleted = completed;
            if ( !completed ) {
                this.runSetupWizard();
            }
        } );

        this.ipcService.tickReceived().subscribe( data => {
            
            this.dkpEntries = data.dkpEntries;
            this.logFile = data.logFile;
            this.overlays = data.overlays;
            this.enableFct = data.enableFct;
            this.damageDealtOverlayId = data.damageDealtOverlayId;
            this.damageTakenOverlayId = data.damageReceivedOverlayId;
            this.fctStyles = data.fctStyles;
            // this.focusEffectSettings.hasExtendedDotFocus = data.hasExtendedDotFocus;
            // this.focusEffectSettings.extendedDotFocusPercent = data.extendedDotFocusPercent;
            // this.focusEffectSettings.extendedDotFocusDecayLevel = data.extendedDotFocusDecayLevel;
            
            this.ipcService.getSetupCompleted().subscribe( completed => this.setupCompleted = completed );

        } );

        this.ipcService.logFileChanged().subscribe( data => this.logFile = data );
        this.ipcService.consoleLogRequested().subscribe( data => console.log( 'from main', data ) );
        this.ipcService.getAppIsDev().subscribe( isDev => this.isDev = isDev );
        this.ipcService.displayWarningDialog().subscribe( e => {
            let dialogArgs = new NotificationDialogModel();
            if ( e.code === 'Renderer:ResolutionChanged' ) {
                dialogArgs.message = [
                    'The resolution of one or more of your monitors has changed.',
                    'Your overlay positions have been automatically moved to match.',
                    'To manually arrange your overlays, click on the Arrange button below.' ];
                dialogArgs.title = 'Your resolution has changed!';
                dialogArgs.notificationType = NotificationTypes.Warning;
                
                let arrangeBtn = new CustomButton();
                arrangeBtn.cssClassString = 'color-blue';
                arrangeBtn.matIcon = 'view_quilt';
                arrangeBtn.matIconsOutlined = true;
                arrangeBtn.text = 'Arrange Overlays';
                arrangeBtn.onClick = () => {
                    this.arrangeOverlays();
                    return true;
                };

                dialogArgs.customButtons = [ arrangeBtn ];

                this.dialogService.showNotificationDialog( dialogArgs );
            }
        } );
        
        this.checkForTriggerUpdates();
        this.ipcService.mainWindowAngularReady();
    }

    checkForTriggerUpdates() {
        this.ipcService.getInstalledPackages().subscribe( installedPackages => {
            if ( installedPackages?.length > 0 ) {
                let ids = installedPackages.map( f => f.packageId );

                this.libraryService.getLatestVersionInfo( ids ).subscribe( infos => {
                    let packagesWithUpdates: string[] = [];

                    // Check each package for udpates.
                    infos?.forEach( latestInfo => {
                        let currentInfo = installedPackages.find( f => f.packageId === latestInfo.TriggerPackageId );
                        if ( currentInfo.versionId !== latestInfo.CurrentVersionId ) {
                            packagesWithUpdates.push( currentInfo.packageId );
                        }
                    } );

                    if ( packagesWithUpdates?.length > 0 ) {
                        
                        let sb = this.snackBar.open( `There are updates to ${packagesWithUpdates.length + 1} trigger package(s).  Installing updates in the background.`, 'dismiss', { duration: 5000 } );

                        this.libraryService
                            .getPackage( packagesWithUpdates )
                            .subscribe( packages => {
                                let installations: Observable<boolean>[] = [];
                                packages?.forEach( pkg => installations.push( this.ipcService.installTriggerPackage( pkg ) ) );

                                forkJoin( installations ).subscribe( () => {
                                    sb?.dismiss();
                                    this.snackBar.open( 'All updates installed successfully!', 'dismiss', { duration: 5000 } );
                                    window.setTimeout( () => this.checkForTriggerUpdates(), updateIntervalDuration );
                                } );

                            } );
                        
                    } else {
                        window.setTimeout( () => this.checkForTriggerUpdates(), updateIntervalDuration );

                    }

                } );
            }
        } );
    }

    runSetupWizard() {
        this.setupService.showSetupWizard().subscribe( () => {
            this.characterList.loadCharacters();
            this.ipcService.requestTick();
        } );
    }

    removeEntry( entry: any ): void {
        this.ipcService.removeDkpAward( entry );
    }

    quitApp(): void {
        this.ipcService.quitApp();
    }

    minimizeTaskbar(): void {
        this.ipcService.minimizeApp();
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

    showNewOverlayDialog(): void {
        this.dialogService
            .showOverlayDetailsDialog( new OverlayWindowModel() )
            .subscribe( model => {
                if ( model?.isValid() === true ) {
                    model.x = 100;
                    model.y = 100;
                    model.windowWidth = 500;
                    model.windowHeight = 400;
                    this.ipcService.createNewOverlayWindow( model ).subscribe( overlayId => {
                        window.setTimeout( () => this.ipcService.showEditOverlayDialog( overlayId ) );
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

    sendToOrigin( overlayId: string ) {
        this.ipcService.sendOverlayToOrigin( overlayId );
    }

    public checkForUpdate() {
        // let v = new UpdateInfo
    }

    public updateFocusEffectSettings(): void {
        this.ipcService.updateFocusEffectSettings( this.focusEffectSettings );
    }

    public selectMoveSourceFolder( target: any ): void {
        this.movingFolderSource = target;
    }

    public arrangeOverlays() {
        this.ipcService.showArrangeOverlaysDialog();
    }
    
    public styleChange( style: StylePropertiesModel ) {
        this.ipcService.saveFctStyles( this.fctStyles );
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
        //     console.log( 'testingasdf' );
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
