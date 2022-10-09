import { Component, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core';
import { MatTable } from '@angular/material/table';
import { PackageFileModel, PackageFolder, PackageTrigger, TriggerPackageMetaModel } from 'src/app/core.model';
import { DialogService } from 'src/app/dialogs/dialog.service';
import { IpcService } from 'src/app/ipc.service';
import * as _ from 'lodash-es';
import { TriggerLibraryService } from '../trigger-library.service';
import { SettingsService } from 'src/app/settings/settings-http.service';
import { forkJoin, Observable, timer } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component( {
    selector: 'app-trigger-package-details',
    templateUrl: 'trigger-package-details.component.html',
    styleUrls: [ 'trigger-package-details.component.scss', '../../core.scss', '../../modal.scss' ]
} )
export class TriggerPackageDetailsComponent implements OnInit {
    
    private _pkg: TriggerPackageMetaModel;
    public package: TriggerPackageMetaModel = null;
    @Input() public set packageId( value: string ) {
        this.package = null;

        this.libraryService.getPackage( [ value ] ).subscribe( packages => {
            if ( packages?.length > 0 ) {
                this.package = packages[ 0 ];

                this.libraryService.isAuthor( this.package.triggerPackageId, this.authorId ).subscribe( isAuth => this.isAuthor = isAuth && this.trustedAuthor );
                this.ipcService.isPackageInstalled( this.package.triggerPackageId ).subscribe( installed => {
                    this.isInstalled = installed;
                } );
                
                let version = this.package.versionHistory?.find( f => f.versionId === this.package.versionId );
                this.notes = version.notes;
            }
        } );
        
    }
    public notes: string;
    public isAuthor: boolean = false;
    public isInstalled: boolean = false;
    public get showHistory(): boolean {
        return _.some( this.package.versionHistory, f => f.notes != null );
    }

    public authorId: string;
    public trustedAuthor: boolean = false;
    @Output() public editPackageId: EventEmitter<string> = new EventEmitter<string>();
    @ViewChild( 'newTriggersTable', { static: true } ) newTriggersTable: MatTable<PackageTrigger>;

    constructor( private ipcService: IpcService, private dialogService: DialogService, private libraryService: TriggerLibraryService, private settingsService: SettingsService, private snackBar: MatSnackBar ) { }

    ngOnInit() {
        this.ipcService.getAuthor().subscribe( author => {
            this.authorId = author.authorId;
            this.settingsService.isTrusted( author.authorId ).subscribe( trusted => {
                this.trustedAuthor = trusted;
                if ( this._pkg ) {
                    this.libraryService.isAuthor( this._pkg.triggerPackageId, this.authorId ).subscribe( isAuth => this.isAuthor = isAuth && this.trustedAuthor );
                }
            } );
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
    }









    
    /**
     * Returns the list of folder parents, including, the specified folder id.
     * 
     * @param folderId The id of the end folder.
     * @param folders The list of folders to search.
     * @param names The current list of folder names found in the hierarchy.
     * @returns 
     */
    private getFolderFamilyNames( folderId: string, folders: PackageFolder[], names: string[] ): string[] {
        
        for ( let i = 0; i < folders?.length; i++ ) {

            if ( folders[ i ].folderId === folderId ) {
                return names.concat( [ folders[ i ].name ] );

            } else if ( folders[ i ]?.children?.length > 0 ) {
                
                let d = this.getFolderFamilyNames( folderId, folders[ i ].children, names.concat( [ folders[ i ].name ] ) );

                if ( d?.length > 0 ) {
                    return d;
                }

            }

        }
    }









    
    /**
     * Returns breadcrumbs for the given trigger's folder/name structure.
     * 
     * @param trigger The desired trigger.
     */
    getTriggerFamily( trigger: PackageTrigger ): string {

        let folderFamilyNames = this.getFolderFamilyNames( trigger.folderId, this.package.model.folders, [] );
        if ( folderFamilyNames?.length > 0 ) {
            let name = `\\${folderFamilyNames[ 0 ]}`;
            for ( let i = 1; i < folderFamilyNames.length; i++ ) {
                name += `\\${folderFamilyNames[ i ]}`;
            }
            return name;
        } else {
            return null;
        }

    }









    
    /**
     * Updates the list of triggers in this package.
     */
    updateList(): void {
        this.package.model.triggers = _.orderBy( this.package.model.triggers, f => this.getTriggerFamily( f ) );
    }









    
    /**
     * Saves changes to the package.
     */
    onUpdatePackageClick() {
        this.editPackageId.emit( this.package.triggerPackageId );
    }









    
    /**
     * Uninstalls the selected package, after confirmation.
     */
    uninstallPackage() {
        this.dialogService.showConfirmDialog(
            'Are you sure you want to uninstall this package?', 'Click "Yes" to uninstall this package', 'Click "No" to close this modal without uninstalling the trigger package.',
            confirmed => {
                if ( confirmed ) {
                    this.ipcService
                        .uninstallTriggerPackage( this.package.triggerPackageId )
                        .subscribe( completed => {
                            this.snackBar.open( 'Package uninstalled!', 'dismiss', { duration: 2500 } );
                            this.ipcService.requestTick();
                            this.isInstalled = false;
                        } );
                }
            } );

    }









    
    /**
     * Installs the selected package.
     */
    installPackage() {
        this.libraryService
            .getPackage( this.package.triggerPackageId )
            .subscribe( triggerPackage => {
                this.libraryService
                    .getPackageFiles( this.package.triggerPackageId )
                    .subscribe( packageFiles => {
                        this.installTriggerPackage( triggerPackage[ 0 ], packageFiles )
                    } );
            } );
        
    }









    
    /**
     * Installs the given trigger package.
     * 
     * @param triggerPackage The trigger package to install.
     * @param packageFiles The files attached to this package.
     */
    installTriggerPackage( triggerPackage: TriggerPackageMetaModel, packageFiles: PackageFileModel[] ): void {
        // Adding a timer makes the following easier and I'm being lazy today.
        let importTasks: Observable<any>[] = [ timer( 1 ) ];

        packageFiles?.forEach( file => {
            importTasks.push( this.ipcService.importPackageFile( file ) );
        } );
        
        forkJoin( importTasks ).subscribe( results => {
            // Missing package overlays are caught in the this component's ngInit event.
            this.ipcService.installTriggerPackage( triggerPackage ).subscribe( installComplete => {
                this.snackBar.open( 'Package install complete!', 'dismiss', { duration: 2500 } );
                this.ipcService.requestTick();
                this.isInstalled = true;
            } );
        } );
    }










    /**
     * Creates and copies the quick share code for the current package.
     */
    copyQuickSharePackage() {
        let code = `{NAG:package/${this.package.triggerPackageId}}`;
        this.ipcService.sendTextToClipboard( code );
        this.snackBar.open( 'Package quick share code copied to clipboard', 'Dismiss', { duration: 5000 } );
    }










    // TODO: Overlay selection/new overlays when installing new trigger packages.
    // TODO: Fix the auto updater.

    // Things the installer must do.
    // ~Pull down the latest version.~
    // Configure auto-updates.
    // ~Setup missing overlays.
    // ~Pull down sound files.~
    // ~Pull down custom icons.~ -- These are base64 encoded into the trigger meta.
    // ~Pull down eq icons, pulling from the eq directory as normal. ~ The images are stored as data URLs, not file references.  This is done automatically with the import.

    // Things we need to get this done:
    //      ~Wizard-style overlay builder.
    //      Auto-updater system.

}
