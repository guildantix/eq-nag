import { Component, ViewChild, ElementRef, OnInit } from '@angular/core';
import * as _ from 'lodash-es';
import { MatSnackBar } from '@angular/material/snack-bar';
import { IpcService } from './ipc.service';
import { DkpEntryModel, OverlayWindowModel, FocusEffectSettings, StylePropertiesModel, FctStylesModel, QuickShareMetaModel, QuickShareFileModel, TriggerPackageMetaModel, VersionNumber, AuthorModel } from './core.model';
import { DialogService } from './dialogs/dialog.service';
import { customAlphabet } from 'nanoid';
import { SetupService } from './setup/setup.service';
import { CharactersListComponent } from './characters-list/characters-list.component';
import { TriggerLibraryService } from './windows/trigger-library.service';
import { forkJoin, Observable, timer } from 'rxjs';
import { ColoredString } from './dialogs/dialog.model';
import { SettingsComponent } from './settings/settings-component/settings.component';
import { QuickShareService } from './core/quick-share.service';
import { TriggersComponent } from './triggers/triggers.component';

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
    public showCriticalsInline: boolean = false;
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

    public archivePercent: number |  null = null;
    public archiveLabel: string = null;
    public closeAfterArchive: boolean = false;

    @ViewChild( 'fileSelector' ) private fileSelector: ElementRef<HTMLInputElement>;
    @ViewChild( 'characterList', { static: true } ) private characterList: CharactersListComponent;
    @ViewChild( 'settingsPanel', { static: true } ) private settingsPanel: SettingsComponent;
    @ViewChild( 'triggersList', { static: true } ) private triggersList: TriggersComponent;

    public get fctOverlays(): OverlayWindowModel[] {
        return this.overlays.filter( f => f.overlayType === 'FCT' );
    }

    constructor(
        private readonly snackBar: MatSnackBar,
        private readonly ipcService: IpcService,
        private readonly dialogService: DialogService,
        private readonly setupService: SetupService,
        private readonly libraryService: TriggerLibraryService,
        private readonly quickShareService: QuickShareService,
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
            this.showCriticalsInline = data.fctShowCriticalsInline;
            this.damageDealtOverlayId = data.damageDealtOverlayId;
            this.damageTakenOverlayId = data.damageReceivedOverlayId;
            this.fctStyles = data.fctStyles;
            
            this.ipcService.getSetupCompleted().subscribe( completed => this.setupCompleted = completed );

        } );

        this.ipcService.logFileChanged().subscribe( data => this.logFile = data );
        this.ipcService.consoleLogRequested().subscribe( data => console.log( 'from main', data ) );
        this.ipcService.getAppIsDev().subscribe( isDev => this.isDev = isDev );
        
        this.checkForTriggerUpdates();
        this.ipcService.mainWindowAngularReady();

        this.ipcService.quickShareCaptured().subscribe( quickShareId => {

            this.ipcService.getAuthor().subscribe( author => {
            
                let observables = [
                    this.quickShareService.isAuthorOfQuickShare( author?.authorId, quickShareId ),
                    this.quickShareService.getQuickShare( quickShareId ),
                    this.quickShareService.getQuickShareFiles( quickShareId ),
                ];
    
                forkJoin( observables )
                    .subscribe( ( [ isAuthor, quickShare, files ]: [ boolean, QuickShareMetaModel[], QuickShareFileModel[] ] ) => {
                        if ( !isAuthor ) {
                            this.dialogService.showReceiveQuickShareDialog( quickShare, files ).subscribe( imported => {
                                if ( imported ) {
                                    this.ipcService.requestTick();
                                }
                            } );
                        }
                    } );
                
            } );
            
        } );

        this.ipcService.quickSharePackageCaptured().subscribe( packageId => {

            // Start by grabbing all installed packages and checking if the package has already been installed.
            this.ipcService.getInstalledPackages().subscribe( installedPkgs => {
                let exists = installedPkgs.findIndex( f => f.packageId === packageId ) > -1;

                if ( !exists ) {

                    // If the package is new, then ask the user if the would like to have it installed.
                    this.libraryService.getPackage( packageId ).subscribe( pkg => {
                        this.dialogService.showConfirmDialog(
                            [ `${pkg[ 0 ].name}`, 'Would you like to install this package?' ],
                            'Click "Yes" to install this new package.',
                            'Click "No" to close this window without installing the new package.',
                            confirmed => {
                                
                                if ( confirmed ) {

                                    // If the user agrees, then install the package.
                                    this.triggersList.installTriggerPackage( packageId );

                                }

                            } );
                    } );

                }
            } );

        } );

        this.ipcService.orphanedTriggersFound().subscribe( found => {
            if ( found ) {
                this.dialogService
                    .showWarningDialog(
                        'Orphaned Triggers', [
                        'Triggers were found that do not have a parent folder, or the parent folder has been deleted.',
                        'These triggers have been moved to the "Orphaned Triggers" folder.',
                        'The way folders are deleted has been changed.',
                        new ColoredString( 'Now, when deleting a folder, all sub-folders and all triggers in the hierarchy will be ~~**deleted**~~.', '#f44336' )
                    ] );
            }
        } );

        this.ipcService.missingPackageOverlayFound().subscribe( packageOverlay => {
            this.dialogService.showMapPackageOverlayDialog( packageOverlay ).subscribe( overlay => {
                if ( overlay ) {
                    this.ipcService.packageOverlayMapped( packageOverlay.overlayId, overlay.overlayId );
                } else {
                    this.dialogService.showWarningDialog( 'Package Install Cancelled', [ 'No overlay selected.', 'The package has not been installed!' ] );
                }
            } );
        } );

        this.ipcService.getAppVersion().subscribe( currentVersion => {
            this.ipcService.getLastUpdateNotesViewed().subscribe( updateNotesVersion => {
                let versionCurrent = new VersionNumber( currentVersion );
                let versionNotesLastSeen = new VersionNumber( updateNotesVersion );

                if ( VersionNumber.CompareVersions( versionCurrent, versionNotesLastSeen ) === -1 ) {
                    // If the version seen is less than version latest, show the update notes.
                    this.showLatestUpdateNotes();
                }
                // TODO: Show pre-release notes if the user has a pre-release installed.
            } );
        } );

        this.ipcService.onBackupProgress().subscribe( progress => {
            
            this.archiveLabel = progress.label;
            this.archivePercent = progress.completePercent;

            if ( progress.completePercent >= 1 ) {
                setTimeout( () => {
                    this.archiveLabel = null;
                    this.archivePercent = null;

                    if ( this.closeAfterArchive ) {
                        this.quitApp();
                    }
                }, 2500 );
            }
        } );

        this.ipcService.onQuitFalure().subscribe( data => {
            if ( data.code === 'backup' ) {
                this.dialogService.showQuestionDialog( 'Archive in Progress',
                    [ 'There is an archive in progress', 'Ending the application may corrupt your archive file.' ],
                    [
                        {
                            question: [ 'Wait for the archive process to complete.' ],
                            buttonText: 'Close after Archiving',
                            action: () => {
                                if ( this.archivePercent > 0 ) {
                                    this.closeAfterArchive = true;
                                } else {
                                    this.quitApp();
                                }
                            },
                            cssClass: 'color-green',
                        },
                        // TODO: Add option to safely interrupt the archive process.
                        // {
                        //     question: [ 'Close Nag after the current file is archived.', 'If there are multiple files queued for archive, or a file is in the middle of archiving, those will be interrupted.', 'This will still leave the archive valid.' ],
                        //     buttonText: 'Safely Close Now',
                        //     action: () => {
                        //         if ( this.archivePercent > 0 ) {
                        //             this.closeAfterArchive = true;
                        //         } else {
                        //             this.quitApp();
                        //         }
                        //     },
                        //     cssClass: '',
                        // },
                        {
                            question: [ 'Close Nag immediately, without waiting to stop the archive process.', new ColoredString( 'This ~~may~~ corrupt your archive file.', '#f0c669', true ) ],
                            buttonText: 'Close Immediately',
                            action: () => this.quitApp( true ),
                            cssClass: 'color-orange',
                        },
                    ],
                    true
                );
            }
        } );

        window.setTimeout( () => {
            this.ipcService.mainWindowLoaded();
        }, 60 * 1000 );

    }










    /**
     * Loads the latest update notes window.
     */
    public showLatestUpdateNotes() {
        this.ipcService.showUpdateNotesWindow();
    }










    /**
     * Checks for trigger updates.
     */
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
                                let installedCount = 0;

                                const installPackage = ( pkg: TriggerPackageMetaModel ) => {
                                    this.libraryService
                                        .getPackageFiles( pkg.triggerPackageId )
                                        .subscribe( packageFiles => {
                                            
                                            this.ipcService.getAudioFiles().subscribe( existingAudioFiles => {
                                                // Adding a timer makes the following easier and I'm being lazy today.
                                                let importTasks: Observable<any>[] = [ timer( 1 ) ];
                                    
                                                // We need to install all new files.
                                                packageFiles?.forEach( file => {
                                                    if ( existingAudioFiles.findIndex( f => f.fileId === file.fileId ) === -1 ) {
                                                        // If the package file doesn't exist, install it.
                                                        importTasks.push( this.ipcService.importPackageFile( file ) );
                                                    }
                                                } );
        
                                                forkJoin( importTasks ).subscribe( results => {
                                                    // Missing package overlays are caught in the main component's ngInit event.
                                                    this.ipcService.installTriggerPackage( pkg ).subscribe( installComplete => {
                                                        installedCount += 1;
                                                        if ( installedCount < packages?.length ) {
                                                            installPackage( packages[ installedCount ] );
                                                        } else {
                                                            sb?.dismiss();
                                                            this.snackBar.open( 'All updates installed successfully!', 'dismiss', { duration: 5000 } );
                                                            this.ipcService.requestTick();
                                                            window.setTimeout( () => this.checkForTriggerUpdates(), updateIntervalDuration );
                                                        }
                                                    } );
                                                } );
                                            
                                            } );
                                            
                                        } );
                                }

                                // Let's kick-off the first update.
                                installPackage( packages[ installedCount ] );

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

    quitApp( forceQuit: boolean = false ): void {
        this.ipcService.quitApp( forceQuit === true ? true : false );
    }

    minimizeTaskbar(): void {
        this.ipcService.minimizeApp();
    }

    sendToTray(): void {
        this.ipcService.sendToTray();
    }

    openModal() {
        this.fileSelector.nativeElement.click();
    }

    fileSelected( e: any ) {
        this.ipcService.updateLogFile( this.fileSelector.nativeElement.files[ 0 ].path );
    }

    onChangeTabs( selectedIndex: number ): void {
        this.showConsole = selectedIndex === 0;

        if ( selectedIndex === 4 ) {
            this.settingsPanel.loadSettings();
        }
    }

    onEnableFctChange(): void {
        this.ipcService.updateEnableFct( this.enableFct );
    }

    onShowCriticalsInlineChange(): void {
        this.ipcService.updateEnableFctShowCriticalsInline( this.showCriticalsInline );
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

    public checkForUpdate() {
        // let v = new UpdateInfo
    }

    public updateFocusEffectSettings(): void {
        this.ipcService.updateFocusEffectSettings( this.focusEffectSettings );
    }

    public selectMoveSourceFolder( target: any ): void {
        this.movingFolderSource = target;
    }
    
    public styleChange( style: StylePropertiesModel ) {
        this.ipcService.saveFctStyles( this.fctStyles );
    }

    public showEasyWindow(): void {
        this.ipcService.showEasyWindow().subscribe();
    }

    public testFn(): void {
        // large file test: E:\\EverQuest\\Logs\\backup\\20220721\\eqlog_Halifor_rizlona.txt
        
        this.dialogService.showDeathRecapDialog();
        // this.ipcService.findPlayerCharacterDeaths( 'E:\\EverQuest\\Logs\\eqlog_Ryvn_rizlona.txt' ).subscribe( deaths => console.log( 'deaths', deaths ) );
        // this.ipcService.findPlayerCharacterDeaths( 'E:\\EverQuest\\Logs\\eqlog_Israphel_rizlona.txt' ).subscribe( deaths => console.log( 'deaths', deaths ) );
        // this.ipcService.findPlayerCharacterDeaths( 'E:\\EverQuest\\Logs\\eqlog_Eryndhel_rizlona.txt' ).subscribe( deaths => console.log( 'deaths', deaths ) );
        
        // let quickShareId = 'OVtf9VzRSjykb1xx';
        // let observables = [
        //     this.quickShareService.getQuickShare( quickShareId ),
        //     this.quickShareService.getQuickShareFiles( quickShareId ),
        // ];

        // forkJoin( observables )
        //     .subscribe( ( [ quickShare, files ]: [ QuickShareMetaModel[], QuickShareFileModel[] ] ) => {
        //         this.dialogService.showReceiveQuickShareDialog( quickShare, files ).subscribe( imported => {
        //             if ( imported ) {
        //                 // reload data.
        //             }
        //         } );
        //     } );
        
        // this.ipcService.simulateLogParse( 'E:\\everquest\\Logs\\Backup\\eqlog_Ryvn_mangler_20201024_204401.txt' );
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
