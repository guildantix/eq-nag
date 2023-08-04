import { ChangeDetectorRef, Component, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core';
import { MatTable } from '@angular/material/table';
import { TriggerFolder, TriggerModel, PackageTrigger, TriggerPackageMetaModel, PackageFolder, PackageFileModel, TriggerPackageModel, TriggerPackageCategories, OverlayWindowModel, TriggerAction, TriggerCondition } from 'src/app/core.model';
import { DialogService } from 'src/app/dialogs/dialog.service';
import { IpcService } from 'src/app/ipc.service';
import * as _ from 'lodash-es';
import { TriggerLibraryService } from '../trigger-library.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { forkJoin, Observable, Observer } from 'rxjs';
import { MatChipInputEvent } from '@angular/material/chips';
import { getPackageImportProperties } from 'src/app/core.decorators';
import { ColoredString } from 'src/app/dialogs/dialog.model';
import { nagId } from 'src/app/core/nag-id.util';

@Component( {
    selector: 'app-new-trigger-package',
    templateUrl: 'new-trigger-package.component.html',
    styleUrls: [ 'new-trigger-package.component.scss', '../../core.scss', '../../modal.scss' ]
} )
export class NewTriggerPackageComponent implements OnInit {
    
    public package: TriggerPackageMetaModel = new TriggerPackageMetaModel();
    public notes: string;
    private triggers: TriggerModel[];
    private triggerFolders: TriggerFolder[];
    private ancestryMap: Record<string, string> = {};
    private _pkgId: string;
    public triggerUpdates: Record<string, string[]> = {};
    public deletedTriggerIds: string[] = [];
    public categories: string[] = TriggerPackageCategories;
    public editName: boolean = false;

    private _selectedCategory: string = null;
    @Input() public set selectedCategory( value: string ) {
        this._selectedCategory = value;
        this.package.category = value;
    }

    @Input() public authorId: string;
    @Input()
    public get packageId(): string { return this._pkgId; }
    public set packageId( val: string ) {
        this._pkgId = val;

        let observables = [
            this.libraryService.getPackage( val ),
            this.ipcService.getTriggers(),
            this.ipcService.getTriggerFolders(),
        ];

        forkJoin( observables ).subscribe( ( [ pkg, triggers, folders ]: [ TriggerPackageMetaModel[], TriggerModel[], TriggerFolder[] ] ) => {
            this.package = pkg[ 0 ];
            this.package.tags = this.package.tags?.length > 0 ? this.package.tags : [];
            this.triggers = triggers;
            this.triggerFolders = folders;
            this.pullTriggerUpdates();
        } );
    }
    @Output() public triggerPackage: EventEmitter<TriggerPackageMetaModel> = new EventEmitter<TriggerPackageMetaModel>();

    @ViewChild( 'newTriggersTable', { static: true } ) newTriggersTable: MatTable<TriggerModel>;

    constructor(
        private readonly ipcService: IpcService,
        private readonly dialogService: DialogService,
        private readonly libraryService: TriggerLibraryService,
        private readonly snackBar: MatSnackBar,
        private readonly changeDetectorRef: ChangeDetectorRef ) { }

    ngOnInit() {

        let observables = [
            this.ipcService.getTriggers(),
            this.ipcService.getTriggerFolders(),
        ];

        forkJoin( observables ).subscribe( ( [ triggers, folders ]: [ TriggerModel[], TriggerFolder[] ] ) => {
            this.package.category = this.package.category ?? this._selectedCategory;
            this.package.tags = this.package.tags?.length > 0 ? this.package.tags : [];
            this.triggers = triggers;
            this.triggerFolders = folders;
            this.pullTriggerUpdates();
        } );

    }
    








    
    /**
     * Adds the inputed value to the package tags.
     * 
     * @param event The mat chip input event args.
     */
    addKeywordFromInput( event: MatChipInputEvent ) {
        if ( event.value ) {
            this.package.tags = this.package.tags?.length > 0 ? this.package.tags : [];
            this.package.tags.push( event.value );
            event.chipInput!.clear();
        }
    }
    








    
    /**
     * Removes the given tag from the package.
     * 
     * @param keyword The tag to remove.
     */
    removeKeyword( keyword: string ) {
        this.package.tags = this.package.tags?.length > 0 ? this.package.tags : [];
        let i = this.package.tags.findIndex( f => f === keyword );
        if ( i > -1 ) {
            this.package.tags.splice( i, 1 );
        }
    }









    
    /**
     * Updates all trigger packages.  
     * Note: this is only updating the definitions and not updating installed 
     * package triggers.
     */
    pullTriggerUpdates(): void {

        this.deletedTriggerIds = [];

        this.package.model.triggers.forEach( pkgTrigger => {
            let trigger = this.triggers.find( t => t.triggerId === pkgTrigger.triggerId );
            if ( trigger == null ) {
                this.deletedTriggerIds.push( pkgTrigger.triggerId );
            }
        } );
        
        this.triggers.forEach( trigger => {
            
            this.package.model.triggers.forEach( pkgTrigger => {
                if ( !this.deletedTriggerIds.includes( pkgTrigger.triggerId ) && pkgTrigger.triggerId === trigger.triggerId ) {

                    this.triggerUpdates[ trigger.triggerId ] = PackageTrigger.matchesTrigger( pkgTrigger, trigger );

                    if ( pkgTrigger.folderId !== trigger.folderId ) {
                        // if the folder was changed, ensure the new folder is added to the package.
                        let folder = this.findTriggerFolder( trigger.folderId, this.triggerFolders );
                        this.addFolderAncestors( folder );
                        pkgTrigger.folderId = trigger.folderId;
                    }

                    pkgTrigger.name = trigger.name;
                    pkgTrigger.capturePhrases = _.cloneDeep( trigger.capturePhrases );
                    pkgTrigger.comments = _.cloneDeep( trigger.comments );
                    pkgTrigger.actions = _.cloneDeep( trigger.actions );
                    pkgTrigger.captureMethod = _.cloneDeep( trigger.captureMethod );
                    pkgTrigger.conditions = _.cloneDeep( trigger.conditions );
                    pkgTrigger.classLevels = _.cloneDeep( trigger.classLevels );
                    pkgTrigger.useCooldown = trigger.useCooldown;
                    pkgTrigger.cooldownDuration = trigger.cooldownDuration;

                }
            } );

        } );
    }










    /**
     * Recursively searches and finds the specified folder.
     * 
     * @returns Returns the desired folder or undefined.
     * 
     * @param folderId The desried folde rid.
     * @param folders The list of folders to query.
     */
    findTriggerFolder( folderId: string, folders: TriggerFolder[] ): TriggerFolder {
        for ( let i = 0; i < folders.length; i++ ) {
            if ( folders[ i ].folderId === folderId ) {
                return folders[ i ];
            }

            if ( folders[ i ].children?.length > 0 ) {
                let folder = this.findTriggerFolder( folderId, folders[ i ].children );
                if ( folder ) {
                    return folder;
                }
            }
        }
    }









    
    /**
     * Opens the select trigger folder dialog.  Once a selection is made, 
     * triggers in the selected folder's hierarchy are added to the package.
     */
    selectTriggerFolders(): void {
        
        this.dialogService.showSelectTriggerFoldersDialog( null, 'Select folder' ).subscribe( selectedFolderId => {
            if ( selectedFolderId ) {
                let folder = this.getFolder( selectedFolderId, this.triggerFolders );
                if ( folder ) {
                    this.addFolder( folder );
                    this.addFolderTriggers( folder );
                }
            }
        } );

    }









    
    /**
     * Adds all triggers in the given folder and it's descendants.
     * 
     * @param folder The selected folder.
     */
    addFolderTriggers( folder: TriggerFolder ): void {
        let folderIds = this.getFlattenedFolderIds( folder, [] );
        
        this.triggers.forEach( trigger => {
            if ( folderIds.indexOf( trigger.folderId ) > -1 ) {
                this.addTrigger( trigger );
            }
        } );

        this.updateList();
    }









    
    /**
     * Adds the given folder and it's direct ancestry and full descendants to 
     * the package.
     * 
     * @param folder The selected folder.
     */
    addFolder( folder: TriggerFolder ): void {
        this.buildFolderAncestryMap();
        let pkgFolder = this.addFolderAncestors( folder );
        this.addFolderChildren( folder, pkgFolder );
    }









    
    /**
     * Adds all children in the given folder to the package folder children.
     * 
     * @param folder The selected folder
     * @param pkgFolder The package folder parent.
     */
    addFolderChildren( folder: TriggerFolder, pkgFolder?: PackageFolder ): void {

        pkgFolder = pkgFolder ? pkgFolder : this.findPackageFolder( folder.folderId, this.package.model.folders );

        for ( let i = 0; i < folder.children?.length; i++ ) {
            let child: PackageFolder = pkgFolder.children.find( f => f.folderId === folder.children[ i ].folderId );

            if ( child == null ) {
                child = new PackageFolder();
                child.children = [];
                child.folderId = folder.children[ i ].folderId;
                child.name = this.getFolderName( folder.children[ i ].folderId, this.triggerFolders );
                pkgFolder.children.push( child );
            }

            this.addFolderChildren( folder.children[ i ], child );
        }
    }









    
    /**
     * Returns the package folder with the specified id.
     * 
     * @param folderId The folder id
     * @param folders The list of folders to query.
     */
    findPackageFolder( folderId: string, folders: PackageFolder[] ): PackageFolder {

        for ( let i = 0; i < folders.length; i++ ) {
            if ( folders[ i ].folderId === folderId ) {
                return folders[ i ];
            }

            if ( folders[ i ].children?.length > 0 ) {
                let folder = this.findPackageFolder( folderId, folders[ i ].children );
                if ( folder ) {
                    return folder;
                }
            }
        }
        
    }









    
    /**
     * Adds the given folder and it's direct ancestors to the package model.
     * 
     * @returns Returns the given folder's package folder.
     * 
     * @param folder The selected folder.
     */
    addFolderAncestors( folder: TriggerFolder ): PackageFolder {
        let flat: string[] = [ folder.folderId ];
        let t: string = this.ancestryMap[ folder.folderId ];

        while ( t != null ) {
            flat.push( t );
            t = this.ancestryMap[ t ];
        }

        this.package.model.folders = this.package.model.folders ? this.package.model.folders : [];
        let folders = this.package.model.folders;
        let output: PackageFolder;
        for ( let i = flat.length - 1; i >= 0; i-- ) {

            if ( folders.findIndex( f => f.folderId === flat[ i ] ) === -1 ) {
                let pf = new PackageFolder();
                pf.children = [];
                pf.folderId = flat[ i ];
                pf.name = this.getFolderName( flat[ i ], this.triggerFolders );
                folders.push( pf );
            }
            
            output = folders.find( f => f.folderId === flat[ i ] );
            output.children = output.children ? output.children : [];
            folders = output.children;
        }

        return output;
    }









    
    /**
     * Returns the specified folder's name.
     * 
     * @param folderId The selected folder id.
     * @param folders The list of folders to query.
     */
    getFolderName( folderId: string, folders: TriggerFolder[] ): string {

        for ( let i = 0; i < folders.length; i++ ) {
            if ( folders[ i ].folderId === folderId ) {
                return folders[ i ].name;
            }
            
            if ( folders[ i ].children?.length > 0 ) {
                let name = this.getFolderName( folderId, folders[ i ].children );
                if ( name ) {
                    return name;
                }
            }

        }
    }









    
    /**
     * Builds a flat ancestry map to quickly lookup the parent folder id of any 
     * folder in triggerFolders.
     */
    buildFolderAncestryMap(): void {
        this.ancestryMap = {};

        for ( let i = 0; i < this.triggerFolders.length; i++ ) {
            this.ancestryMap[ this.triggerFolders[ i ].folderId ] = null;

            if ( this.triggerFolders[ i ].children?.length > 0 ) {
                this.continueFolderAncestryMap( this.triggerFolders[ i ].children, this.triggerFolders[ i ].folderId );
            }
        }
    }









    
    /**
     * The recursive function that generates the ancestry map.
     * 
     * @param children The list of folders to process.
     * @param parentId The parent id of all given children.
     */
    continueFolderAncestryMap( children: TriggerFolder[], parentId: string ): void {
        
        for ( let i = 0; i < children.length; i++ ) {
            this.ancestryMap[ children[ i ].folderId ] = parentId;
            
            if ( children[ i ].children?.length > 0 ) {
                this.continueFolderAncestryMap( children[ i ].children, children[ i ].folderId );
            }
        }
    }









    
    /**
     * Adds the given trigger to the package if it doesn't exist already.
     * 
     * @param trigger The trigger model.
     */
    addTrigger( trigger: TriggerModel ) {
        let exists = _.some( this.package.model.triggers, f => f.triggerId === trigger.triggerId );
        let pTrg = new PackageTrigger();

        if ( !exists ) {
            pTrg.triggerId = trigger.triggerId;
            this.package.model.triggers.push( pTrg );

        } else {
            pTrg = this.package.model.triggers.find( f => f.triggerId === trigger.triggerId );

        }

        pTrg.folderId = trigger.folderId;
        pTrg.name = trigger.name;
        pTrg.capturePhrases = _.cloneDeep( trigger.capturePhrases );
        pTrg.comments = _.cloneDeep( trigger.comments );
        pTrg.actions = _.cloneDeep( trigger.actions );
        pTrg.captureMethod = _.cloneDeep( trigger.captureMethod );
        pTrg.conditions = _.cloneDeep( trigger.conditions );
        pTrg.classLevels = _.cloneDeep( trigger.classLevels );
        pTrg.useCooldown = trigger.useCooldown;
        pTrg.cooldownDuration = trigger.cooldownDuration;

    }









    
    /**
     * Recursively generates an array that contains all folder ids.
     * 
     * @param folder The current folder to process.
     * @param folderIds The current flat folder ids list.
     * @returns Returns the folder id's list with the given folder's id, plus all descendant folders..
     */
    getFlattenedFolderIds( folder: TriggerFolder, folderIds: string[] ): string[] {
        
        folderIds.push( folder.folderId );

        if ( folder.children?.length > 0 ) {
            for ( let i = 0; i < folder.children.length; i++ ) {
                this.getFlattenedFolderIds( folder.children[ i ], folderIds );
            }
        }

        return folderIds;
    }









    
    /**
     * Recursively finds the specified folder.
     * 
     * @returns Returns the found folder or null.
     * 
     * @param folderId The desired folder id.
     * @param folders The list of folders to query.
     */
    getFolder( folderId: string, folders: TriggerFolder[] ): TriggerFolder {
        for ( let i = 0; i < folders.length; i++ ) {
            if ( folders[ i ].folderId === folderId ) {
                return folders[ i ];
            } else if ( folders[ i ].children?.length > 0 ) {
                let folder = this.getFolder( folderId, folders[ i ].children );
                if ( folder ) {
                    return folder;
                }
            }
        }

        return null;
    }









    
    /**
     * Generates an array that contains all of the specified folder's ancestors
     * 
     * @returns Returns an array that contains all of the names of the ancestor of the specified folder.
     * 
     * @param folderId The folder id.
     * @param folders The list of folders to queryr
     * @param names The current list of hierarchical names.
     */
    private getFolderFamilyNames( folderId: string, folders: TriggerFolder[], names: string[] ): string[] {
        
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
     * Returns a string that contains the ancestory of the given trigger.
     * 
     * @example 'Common/Community'
     * 
     * @param trigger The trigger model.
     */
    public getTriggerFamily( trigger: TriggerModel | PackageTrigger ): string {

        let folderFamilyNames = this.getFolderFamilyNames( trigger.folderId, this.triggerFolders, [] );
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
     * Removes the specified trigger from the package model.
     * 
     * @param triggerId The id of the trigger
     */
    removeTrigger( triggerId: string ): void {
        if ( triggerId ) {
            let i = this.package.model.triggers.findIndex( f => f.triggerId === triggerId );
            if ( i > -1 ) {
                this.package.model.triggers.splice( i, 1 );
                
                this.updateList();
            }
        }
    }









    
    /**
     * Forces the trigger table to redraw by ordering the list by trigger family.
     */
    updateList(): void {
        this.package.model.triggers = _.orderBy( this.package.model.triggers, f => this.getTriggerFamily( f ) );
    }









    
    /**
     * Exits edit/add mode without making changes.
     */
    cancel(): void {
        this.package = new TriggerPackageMetaModel();
        this.package.category = this._selectedCategory;
        this.triggerPackage.emit( null );
    }










    /**
     * Returns a list of all folder conditions that can be applied to the given 
     * package trigger.
     * 
     * @param packageTrigger The trigger to query.
     */
    getTriggerFolderConditions( packageTrigger: PackageTrigger ): TriggerCondition[] {
        const trigger = this.triggers.find( f => f.triggerId === packageTrigger.triggerId );
        // Start with the trigger's conditions to limit the number of loops required to check for collisions.
        let conditions: TriggerCondition[] = trigger.conditions.map( f => Object.assign( new TriggerCondition(), f ) );

        // Navigate upwards through the folder hierarchy, adding in conditions that don't collide with existing conditions.
        let folderId = trigger.folderId;
        while ( folderId != null ) {
            const folder = this.getFolder( folderId, this.triggerFolders );

            for ( let i = 0; i < folder.folderConditions?.length; i++ ) {
                const condition = folder.folderConditions[ i ];
                if ( conditions.findIndex( f => f.variableName === condition.variableName ) === -1 ) {
                    // We want a new object here
                    conditions.push( Object.assign( new TriggerCondition(), condition ) );
                }
            }

            // Change the context to this folder's parent.
            folderId = this.ancestryMap[ folderId ];
        }

        // Return conditions not already present on the trigger.
        return conditions.filter( f => trigger.conditions.findIndex( j => j.conditionId === f.conditionId ) === -1 );
    }










    /**
     * Checks folder conditions for each trigger, and asks user to apply folder 
     * conditions before publishing.
     * 
     * @returns Returns true if the user has chosen to continue publishing.
     */
    checkFolderConditions(): Observable<boolean> {

        let obs = new Observable<boolean>( sub => {
            let hasConditionsToAdd = false;
            let conditionMap: Record<string, TriggerCondition[]> = {};

            for ( let i = 0; i < this.package.model.triggers?.length; i++ ) {
                const packageTrigger = this.package.model.triggers[ i ];
                let conditions = this.getTriggerFolderConditions( packageTrigger );
                if ( conditions?.length > 0 ) {
                    hasConditionsToAdd = true;
                    conditionMap[ packageTrigger.triggerId ] = conditions;
                }
            }

            if ( !hasConditionsToAdd ) {
                sub.next( true );
                sub.complete();

            } else {
                this.dialogService.showConfirmationDialog(
                    [
                        'There are folder conditions that can be added to the package.',
                        'Would you like to include those conditions?',
                    ],
                    'Click "Yes" to add folder conditions and publish to the library.',
                    'Click "No" to publish to the library without adding folder conditions.',
                    'Click "Cancel" to close this dialog without publishing to the library.',
                    'wide',
                    () => {
                        this.dialogService.showInfoDialog( 'Applying Folder Conditions', [
                            'Every folder can have conditions that determine if triggers in it\'s ancestry should be executed.',
                            'If you decide to include folder conditions in your package, those conditions will only be added to the triggers for the package.  Your local triggers will not be modified.',
                            'The reason that folder conditions should only be included as trigger conditions is to prevent collisions when multiple authors use the same folder names.',
                            'Important: Conditions will only be added to triggers belonging to each folder\'s family. ex: ',
                            new ColoredString('*t*tRaids \\ Classic \\ Naggy \\ Fire Breathe', '#e3e3e3'),
                            'The "Fire Breathe" trigger will inherit conditions from Raids, Classic, and Naggy, but will not inherit conditions from Lady Vox or Planes of Power.'
                        ], 'wide' )
                    }
                ).subscribe( confirmed => {

                    if ( confirmed === true ) {
                        // Add conditions and continue.
                        // Note: when package triggers are updated, the conditions 
                        //       list are overwritten with the new conditions and 
                        //       not updated by conditionId.
                        let triggerIds = Object.keys( conditionMap );
                        for ( let i = 0; i < triggerIds.length; i++ ) {
                            const triggerId = triggerIds[ i ];
                            const packageTrigger = this.package.model.triggers.find( f => f.triggerId == triggerId );

                            for ( let ci = 0; ci < conditionMap[ triggerId ].length; ci++ ) {
                                let condition = conditionMap[ triggerId ][ ci ];
                                condition.conditionId = nagId();
                                packageTrigger.conditions.push( condition );
                            }
                        }
                        
                        sub.next( true );
                        sub.complete();

                    } else if ( confirmed === false ) {
                        // Continue without adding conditions.
                        sub.next( true );
                        sub.complete();

                    } else {
                        // Cancel operation.
                        sub.next( false );
                        sub.complete();

                    }

                } );
            }

        } );

        return obs;
    }










    /**
     * Submits the current new package and exits add/edit mode.
     */
    save(): void {

        // Remove deleted triggers from the package.
        this.deletedTriggerIds.forEach( triggerId => {
            let i = this.package.model.triggers.findIndex( f => f.triggerId === triggerId );
            if ( i > -1 ) {
                this.package.model.triggers.splice( i, 1 );
            }
        } );

        this.checkFolderConditions().subscribe( cont => {
            
            if ( cont ) {

                // Grab all of the files used.
                this.package.files = this.package.files ? this.package.files : [];
                let dataObservables = [
                    this.ipcService.getAudioFileData(),
                    this.ipcService.getDetrimentalOverlayId(),
                    this.ipcService.getBeneficialOverlayId(),
                    this.ipcService.getAlertOverlayId(),
                    this.ipcService.getOverlayWindows(),
                    this.ipcService.getPrimaryDisplay(),
                ];
        
                forkJoin( dataObservables ).subscribe( ( [ audioFiles, detrimentalOverlayId, beneficialOverlayId, textOverlayId, overlays, primaryDisplay ]: [ PackageFileModel[], string, string, string, OverlayWindowModel[], Electron.Display ] ) => {
            
                    this.package.model.packageOverlays = [];
            
                    this.package.model.triggers.forEach( trigger => {
                        trigger.actions.forEach( action => {

                            let actionProperties = getPackageImportProperties( Object.assign( new TriggerAction(), action ) );

                            actionProperties.overlayIds.forEach( overlayId => {
                                if ( overlayId !== detrimentalOverlayId && overlayId !== beneficialOverlayId && overlayId !== textOverlayId ) {
                                    let overlay = overlays.find( f => f.overlayId === overlayId );
                                    if ( overlay ) {
                                        let exists = this.package.model.packageOverlays.findIndex( f => f.overlayId === overlayId ) > -1;
                                        if ( !exists ) {
                                            this.package.model.packageOverlays.push( overlay );
                                        }
                                    }
                                }
                            } );

                            actionProperties.audioFileIds.forEach( audoFileId => {
                                let file = audioFiles.find( f => f.fileId === audoFileId );

                                if ( file ) {
                                    let exists = this.package.files.findIndex( f => f.fileId === file.fileId ) > -1;
                                    if ( !exists ) {
                                        this.package.files.push( file );
                                    }
                                }
                            } );

                        } );
                    } );

                    this.package.model.detrimentalOverlayId = detrimentalOverlayId;
                    this.package.model.beneficialOverlayId = beneficialOverlayId;
                    this.package.model.textOverlayId = textOverlayId;
                    this.package.model.primaryDisplaySize = primaryDisplay.size;

                    this.savePackage();

                } );
            
            }
        } );


    }










    /**
     * Submits the package to the API service.
     */
    savePackage(): void {
        if ( this._pkgId != null ) {
            this.libraryService.updatePackage( this.authorId, this.package, this.notes ).subscribe( pkg => {
                if ( pkg ) {
                    this.snackBar.open( 'Update successful!', 'dismiss', { duration: 5000 } );
                    this.triggerPackage.emit( pkg );
                    this.package = new TriggerPackageMetaModel();
                    this.package.category = this._selectedCategory;
                } else {
                    this.dialogService.showErrorDialog( 'Sync Error', 'Could not update the package' );
                }
            } );
        } else {
            this.libraryService.createPackage( this.authorId, this.package, this.notes ).subscribe( pkg => {
                if ( pkg ) {
                    this.triggerPackage.emit( pkg );
                    this.package = new TriggerPackageMetaModel();
                    this.package.category = this._selectedCategory;
                } else {
                    this.dialogService.showErrorDialog( 'Sync Error', 'Could not create the package' );
                }
            } );
        }
    }










    /**
     * Allows the user to recover a deleted trigger.
     * 
     * @param packageTrigger The source package trigger.
     */
    public recoverDeletedTrigger( packageTrigger: PackageTrigger ): void {
        this.dialogService.showConfirmationDialog(
            [
                `Are you sure you want to recover ${packageTrigger.name}?`,
                'If the original trigger was imported from Gina or Allakhazam/EQ Spell Resources, the information on where the trigger came from will be lost. However, the trigger itself is still recoverable.'
            ],
            'Click "Yes" to recover this trigger from the package, adding it back to your local trigger library.',
            'Click "No" to close this dialog without recovering the deleted trigger.' ).subscribe( confirmed => {
                if ( confirmed ) {
                    
                    // Create a copy of the package trigger.
                    const trigger = PackageTrigger.ToTrigger( packageTrigger );

                    // Save the trigger.
                    this.ipcService.createNewTrigger( trigger ).subscribe( triggerId => {

                        if ( triggerId?.length > 0 ) {
                            // If we're successful, remove the trigger from the deleted list and add it to the triggers list.
                            let i = this.deletedTriggerIds.findIndex( f => f === packageTrigger.triggerId );
                            
                            if ( i > -1 ) {

                                this.deletedTriggerIds.splice( i, 1 );

                            }
                            
                            this.triggers.push( trigger );
                        }

                    } );
                }
            } );
    }










    /**
     * Returns the trigger status text.
     * 
     * @param triggerId The id of the package trigger.
     */
    public getTriggerStatusText( triggerId: string ): string {
        let updates = this.triggerUpdates[ triggerId ];

        if ( updates ) {
            return this.triggerUpdates[ triggerId ]?.join( ', ' );
        } else if ( this.deletedTriggerIds.includes( triggerId ) ) {
            return 'Deleted';
        }
    }
    









}