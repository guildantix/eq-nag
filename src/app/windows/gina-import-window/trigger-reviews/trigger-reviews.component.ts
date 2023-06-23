import { Component, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core';
import { FormControl, NgForm } from '@angular/forms';
import { MatTable, MatTableDataSource } from '@angular/material/table';
import { ActionTypeLabels, ActionTypes, CapturePhrase, DuplicateTriggerAction, FileModel, OverlayWindowModel, OwnedTriggerAction, TimerRestartBehaviors, TriggerAction, TriggerFolder, TriggerModel } from 'src/app/core.model';
import { GinaConfiguration, GinaMultiSelectDataModel, GinaOverlayIds, GinaToNagOverlay, GinaTreeObject, TriggerIdNameModel, TriggerReviewModel } from 'src/app/gina.model';
import * as _ from 'lodash-es';
import { IpcService } from 'src/app/ipc.service';
import { DialogService } from 'src/app/dialogs/dialog.service';
import { Observable, forkJoin, timer } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { MatPaginator } from '@angular/material/paginator';
import { GinaImporter } from 'src/app/utilities/gina.import';
import { Dictionary } from 'lodash';
import { nagId } from 'src/app/core/nag-id.util';
import { MatTreeFlatDataSource, MatTreeFlattener } from '@angular/material/tree';
import { FlatTreeControl } from '@angular/cdk/tree';
import Fuse from 'fuse.js';

interface DuplicateTriggerSubject {
    triggerId: string;
    phrase: string;
    subjectAction: TriggerAction;
}

interface ExampleFlatNode {
    expandable: boolean;
    name: string;
    level: number;
    folderId: string;
}
  
@Component( {
    selector: 'app-trigger-reviews',
    templateUrl: 'trigger-reviews.component.html',
    styleUrls: [ './trigger-reviews.component.scss', '../../../core.scss', '../../../modal.scss' ],
} )
export class TriggerReviewsComponent implements OnInit {

    private _transformer = ( node: TriggerFolder, level: number ) => {
        return {
            expandable: !!node.children && node.children.length > 0,
            name: node.name,
            level: level,
            active: node.active,
            // selected: node.selected,
            selected: false,
            folderId: node.folderId,
        };
    }
    public folderTreeControl = new FlatTreeControl<ExampleFlatNode>( node => node.level, node => node.expandable );
    public treeFlattener = new MatTreeFlattener(this._transformer, node => node.level, node => node.expandable, node => node.children);
    public folderDataSource = new MatTreeFlatDataSource(this.folderTreeControl, this.treeFlattener);
    hasChild = (_: number, node: ExampleFlatNode) => node.expandable;

    private _selectedGinaTriggers: GinaMultiSelectDataModel[] = [];
    private audioFiles: FileModel[] = [];
    public get selectedGinaTriggers(): GinaMultiSelectDataModel[] {
        return this._selectedGinaTriggers;
    }
    @Input() public set selectedGinaTriggers( data: GinaMultiSelectDataModel[] ) {
        if ( data ) {
            
            this._selectedGinaTriggers = data;
            
            this.generateTriggerModels().subscribe( () => {
                this.showDuplicates();
            } );


            this.importedGinaObjects = [];
            data.forEach( t => {
                this.importedGinaObjects.push( t.model.ginaName );
            } );

        } else {
            this._selectedGinaTriggers = [];
        }
    }
    public triggers: TriggerReviewModel[] = [];
    public tableData: MatTableDataSource<TriggerReviewModel> = new MatTableDataSource( [] );

    public nagFolders: TriggerFolder[] = null;
    public nagFolderMap: Record<string, string> = null;
    public nagFolderNameMap: Record<string, string> = null;
    public mergeGinaNameMap: Record<string, string> = {};
    public eqZones: string[] = [];
    public actionTypes: typeof ActionTypes = ActionTypes;
    public timerRestartBehaviors: typeof TimerRestartBehaviors = TimerRestartBehaviors;
    public panel: 'triggerList' | 'overlayAssignment' | 'duplicatesCheck' | 'foldersCheck' | 'zoneNameCheck' | 'default' = 'overlayAssignment';
    public duplicates: DuplicateTriggerAction[] = [];
    public duplicateGroups: Record<string, DuplicateTriggerSubject[]> = {};
    public get duplicatePhrases(): string[] {
        return Object.keys( this.duplicateGroups );
    }
    public duplicateDetailsShown: Record<string, boolean> = {};
    public triggerMergeSelected: Record<string, Record<string, boolean>> = {};
    public triggerIgnoreSelected: Record<string, Record<string, boolean>> = {};
    public importedGinaObjects: string[] = [];
    public newFolderMap: Record<string, string> = {};
    public newFolderIds: string[] = [];

    @Input() public alertOverlays: OverlayWindowModel[] = [];
    @Input() public logOverlays: OverlayWindowModel[] = [];
    @Input() public timerOverlays: OverlayWindowModel[] = [];
    @Input() public categoryOverlayMap: Record<string, GinaOverlayIds> = {};
    @Input() public ginaConfig: GinaConfiguration;

    @Output() public onSpeak: EventEmitter<string> = new EventEmitter<string>();
    @Output() public onPlayAudioFileId: EventEmitter<string> = new EventEmitter<string>();
    @Output() public onCompleted: EventEmitter<string[]> = new EventEmitter<string[]>();
    
    @ViewChild( 'paginator', { static: false, read: MatPaginator } ) private paginator: MatPaginator;
    @ViewChild( 'triggersTable' ) private triggersTable: MatTable<any>;
    @ViewChild( 'mappingForm' ) private mappingForm: NgForm;

    constructor(
        private ipcService: IpcService,
        private dialogService: DialogService,
    ) {
        this.ipcService.getAudioFiles().subscribe( files => this.audioFiles = files );
    }

    ngOnInit() { }









    
    /**
     * Returns true if the given trigger has invalid/non-optimal capture phrases.
     * 
     * @param trigger The trigger to check.
     */
    public showCapturePhraseSuggestion( trigger: TriggerModel ): boolean {
        if ( trigger == null ) {
            return false;
        } else {
            let bad = _.some( trigger.capturePhrases, ( cp: CapturePhrase ) => {
                if ( cp.phrase ) {
                    if ( !cp.useRegEx ) {
                        return true;
                    } else if ( !cp.phrase.startsWith( '^' ) ) {
                        return true;
                    } else if ( !cp.phrase.endsWith( '$' ) ) {
                        return true;
                    } else if ( cp.phrase.endsWith( '.$' ) && !cp.phrase.endsWith( '\\.$' ) ) {
                        return true;
                    }
                } else {
                    return true;
                }

                return false;
            } );
            return bad;
        }
    }









    
    /**
     * Returns the filename for the given file ID.
     * 
     * @param fileId The file ID to get the filename for.
     */
    public getAudioFilename( fileId: string ): string {
        return this.audioFiles.find( f => f.fileId === fileId )?.fileName;
    }









    
    /**
     * Returns the invalid capture phrases for the given trigger.
     * 
     * @param trigger The trigger to check.
     */
    public getInvalidCapturePhrases( trigger: TriggerModel ): CapturePhrase[] {
        if ( trigger == null ) {
            return [];
        } else {
            let bad = _.filter( trigger.capturePhrases, ( cp: CapturePhrase ) => {
                if ( cp.phrase ) {
                    if ( !cp.useRegEx ) {
                        return true;
                    } else if ( !cp.phrase.startsWith( '^' ) ) {
                        return true;
                    } else if ( !cp.phrase.endsWith( '$' ) ) {
                        return true;
                    } else if ( cp.phrase.endsWith( '.$' ) && !cp.phrase.endsWith( '\\.$' ) ) {
                        return true;
                    }
                } else {
                    return true;
                }

                return false;
            } );
            return bad;
        }
    }









    
    /**
     * Generates the nag triggers from the selected gina triggers.
     */
    public generateTriggerModels(): Observable<any> {
        
        let obs = new Observable<any>( subscriber => {
            
            if ( this.selectedGinaTriggers?.length > 0 ) {

                let defaultOverlayObs = [
                    this.ipcService.getDetrimentalOverlayId(),
                    this.ipcService.getBeneficialOverlayId(),
                    this.ipcService.getAlertOverlayId(),
                ];
    
                forkJoin( defaultOverlayObs )
                    .subscribe( ( [ detrimentalOverlayId, beneficialOverlayId, alertOverlayId ]: [ string, string, string ] ) => {


                        let observables: Observable<TriggerReviewModel>[] = [];
                        this.selectedGinaTriggers.forEach( gd => {
                            observables.push( GinaImporter.GetTrigger( gd.model.trigger, this.ipcService, detrimentalOverlayId, beneficialOverlayId, alertOverlayId, this.ginaConfig ).pipe( map( value => new TriggerReviewModel( value, gd.model, gd.folderFamily ) ) ) );
                        } );
                    
                        // NOTE: For some reason, using concat() will stop processing
                        // triggers when the observable uses the forkJoin operator inside of 
                        // the subscriber.  When an audio file needs to be imported, the 
                        // observable waits for that observable(s) to complete before 
                        // completing the subscriber, and moving the concat to the next 
                        // observable. 
                        // ... observable observable observable.
                    
                        forkJoin( observables ).subscribe( triggers => {
                            this.triggers = triggers;
        
                            subscriber.next();
                            subscriber.complete();
                        } );

                    } );
            
            } else {
                subscriber.next();
                subscriber.complete();
            }

        } );
        return obs;
        
    }









    
    /**
     * Returns true if the trigger is a new folder.
     * 
     * @param folderId The folder id to check.
     */
    isNewFolder( folderId: string ): boolean {
        return this.newFolderIds.indexOf( folderId ) > -1;
    }









    
    /**
     * Show the folder check panel.
     */
    showFolderCheck() {
        this.panel = 'foldersCheck';

        this.ipcService.getTriggerFolders().subscribe( folders => {

            this.newFolderIds = [];
            let usedFolderIds: string[] = [];
            this.folderDataSource.data = [];
            this.nagFolderMap = null;
            this.nagFolderNameMap = null;

            this.triggers.forEach( trigger => {
                let folder: TriggerFolder = null;
                
                // Gina stores folder references as an array, ex: ['Raids', 'Classic', 'Lady Vox'] => Raids/Classic/Lady Vox
                for ( let i = 0; i < trigger.ginaData.folders?.length; i++ ){
                    const folderName = trigger.ginaData.folders[ i ];

                    let subFolder = folder ? folder.children.find( f => f.name.toLowerCase() === folderName.toLowerCase() ) : folders.find( f => f.name.toLowerCase() === folderName.toLowerCase() );

                    if ( subFolder == null ) {
                        subFolder = new TriggerFolder();

                        subFolder.folderId = nagId();
                        subFolder.name = folderName;
                        subFolder.expanded = false;
                        subFolder.active = true;
                        subFolder.comments = 'Imported from Gina';
                        subFolder.children = [];
                        subFolder.folderConditions = [];

                        this.newFolderIds.push( subFolder.folderId );

                        if ( folder == null ) {
                            folders.push( subFolder );
                        } else {
                            folder.children.push( subFolder );
                        }
                    }

                    usedFolderIds.push( subFolder.folderId );
                    folder = subFolder;
                }
                
                trigger.nagTrigger.folderId = folder.folderId;
            } );

            this.nagFolders = folders;
            this.folderDataSource.data = this.buildReviewFolderStructure( folders, usedFolderIds );
            this.folderTreeControl.expandAll();
        
        } );
        
    }









    
    /**
     * Returns a folder hiearchy that only contains folders that are used by the triggers.
     * 
     * @param folders The trigger folders to build the review folder structure from.
     * @param usedIds The folder ids that are used by the triggers.
     */
    buildReviewFolderStructure( folders: TriggerFolder[], usedIds: string[] ): TriggerFolder[] {
        let output: TriggerFolder[] = [];

        for ( let i = 0; i < folders?.length; i++ ) {
            let c = Object.assign( new TriggerFolder(), folders[ i ] );
            c.children = this.buildReviewFolderStructure( folders[ i ].children, usedIds );

            if ( usedIds.indexOf( folders[ i ].folderId ) > -1 || c.children?.length > 0 ) {
                output.push( c );
            }
        }

        return output;
    }









    
    /**
     * Builds a flat map of parent folder ids to child folder ids, and a map of 
     * folder names to folder ids.
     * 
     * @param folders The folder array to build the map from.
     * @param parentId The parent folder id.
     */
    buildNagFolderMap( folders: TriggerFolder[], parentId: string | null ) {
        for ( let i = 0; i < folders?.length; i++ ) {
            this.nagFolderMap[ folders[ i ].folderId ] = parentId;
            this.nagFolderNameMap[ folders[ i ].folderId ] = folders[ i ].name;
            if ( folders[ i ].children?.length > 0 ) {
                this.buildNagFolderMap( folders[ i ].children, folders[ i ].folderId );
            }
        }
    }









    
    /**
     * Updates the nagFolderMap and nagFolderNameMap objects, generating a 
     * folder family name for each trigger, and showing the zone name check 
     * panel.
     */
    updateGinaFolderMap() {

        if ( this.nagFolderMap == null || this.nagFolderNameMap == null ) {
            this.nagFolderMap = {};
            this.nagFolderNameMap = {};
            this.buildNagFolderMap( this.nagFolders, null );
        }

        // Builds the folder family name for each trigger.
        this.triggers.forEach( trigger => {
            let fid = trigger.nagTrigger.folderId;
            trigger.folderFamilyName = '';
            while ( fid != null ) {
                trigger.folderFamilyName = this.nagFolderNameMap[ fid ] + '/' + trigger.folderFamilyName;
                fid = this.nagFolderMap[ fid ];
            }
        } );

        this.showZoneNameCheck();
    }









    
    /**
     * Returns the first folder found with the given id.
     * 
     * @param folderId The id of the desired folder.
     * @param folders The folders to search, defaults to the nagFolders.
     */
    private findFolderById( folderId: string, folders: TriggerFolder[] | void ): TriggerFolder {
        folders = folders ? folders : this.nagFolders;
        for ( let i = 0; i < folders.length; i++ ) {
            if ( folders[ i ].folderId === folderId ) {
                return folders[ i ];
            }
            let found = folders[ i ].children?.length > 0 ? this.findFolderById( folderId, folders[ i ].children ) : null;
            if ( found ) {
                return found;
            }
        }
    }









    
    /**
     * Returns the first folder found with the given name.
     * 
     * @param name The name of the desired folder.
     * @param folders The folders to search, defaults to the nagFolders.
     */
    private findFolderByName( name: string, folders: TriggerFolder[] | void ): TriggerFolder {
        folders = folders ? folders : this.nagFolders;
        for ( let i = 0; i < folders.length; i++ ) {
            if ( folders[ i ].name === name ) {
                return folders[ i ];
            }
            let found = folders[ i ].children?.length > 0 ? this.findFolderByName( name, folders[ i ].children ) : null;
            if ( found ) {
                return found;
            }
        }
    }









    
    /**
     * Recursively prints the folder structure to the console log.  This is 
     * // useful if you need to check the hierarchy structure mid-algorithm.
     * 
     * @param folder The folder to print.
     * @param indent The indent amount, start with null.
     */
    private _logFolder( folder: TriggerFolder, indent: string | void = null ) {

        indent = indent ? indent : '';
        
        console.log( `${indent}${folder.name}` );

        for ( let i = 0; i < folder.children?.length; i++ ) {
            
            this._logFolder( folder.children[i], indent + '  ' );
            
        }
    }









    
    /**
     * Prints the folder structure to the console log.  This is useful if you 
     * need to check the hierarchy structure mid-algorithm.
     * 
     * @param folderId The id of the desired folder.
     */
    private logFolder( folderId: string ) {
        let folder = this.findFolderById( folderId, this.nagFolders );
        if ( folder ) {
            this._logFolder( folder );
        }
    }









    
    /**
     * Prints the folder structure to the console log.  This is useful if you 
     * need to check the hierarchy structure mid-algorithm.
     * 
     * @description This method will print the first folder found with an exact 
     *      match of the given name.
     * 
     * @param name The name of the desired folder.
     */
    private logFolderByName( name: string ) {
        let folder = this.findFolderByName( name, this.nagFolders );
        if ( folder ) {
            this._logFolder( folder );
        }
    }









    
    /**
     * Maps existing gina folders to existing nag folders.
     * 
     * @param newFolderId The id of the new folder.
     */
    mapGinaFolder( newFolderId: string ): void {

        this.dialogService.showSelectTriggerFolderDialog( null, 'Select an existing folder', 'Select an existing folder that you would like to use.' ).subscribe( selectedFolderId => {
            let i = this.newFolderIds.indexOf( newFolderId );

            if ( selectedFolderId ) {
                this.newFolderMap[ newFolderId ] = selectedFolderId;
                this.updateFolders( newFolderId, selectedFolderId );
                if ( i > -1 ) {
                    // this.newFolderIds.splice( i, 1 );
                }

            } else if ( this.newFolderMap[ newFolderId ] ) {
                delete this.newFolderMap[ newFolderId ];
                if ( i === -1 ) {
                    // this.newFolderIds.push( newFolderId );
                }
            }

        } );
        
    }









    
    /**
     * Removes a folder from the gina tree.
     * 
     * @param gina The gina tree object to operate against.
     * @param folder The folder, including children, to remove.
     */
    private updateGinaFolders( gina: GinaTreeObject, folder: TriggerFolder ) {
        gina.folders = [];
        let id = folder.folderId;
        while ( id != null ) {
            gina.folders.unshift( this.nagFolderNameMap[ id ] );
            id = this.nagFolderMap[ id ];
        }
    }









    
    /**
     * Rebuilds the gina folder map and reassigns the folder to each gina folder.
     * 
     * @param prevFolderId The previous folder id.
     * @param selectedFolderId The selected folder id.
     */
    updateFolders( prevFolderId: string, selectedFolderId: string ) {
        let usedFolderIds: string[] = [];
        this.nagFolderMap = {};
        this.nagFolderNameMap = {};
        this.buildNagFolderMap( this.nagFolders, null );

        this.triggers.forEach( trigger => {
            let folder: TriggerFolder = null;

            // Gina stores folder references as an array, ex: ['Raids', 'Classic', 'Lady Vox'] => Raids/Classic/Lady Vox
            for ( let i = 0; i < trigger.ginaData.folders?.length; i++ ) {
                const folderName = trigger.ginaData.folders[ i ];

                let subFolder = folder ? folder.children.find( f => f.name.toLowerCase() === folderName.toLowerCase() ) : this.nagFolders.find( f => f.name.toLowerCase() === folderName.toLowerCase() );

                if ( subFolder == null && trigger.nagTrigger.folderId === prevFolderId ) {
                    subFolder = this.findFolderById( selectedFolderId, this.nagFolders );
                }

                if ( subFolder == null ) {
                    
                    let id = trigger.nagTrigger.folderId;
                    
                    while ( id != null ) {
                        id = this.nagFolderMap[ id ];
                        
                        if ( id === prevFolderId ) {
                            // We have a child of the prev folder.  This may occur when the parent
                            // folder is empty of triggers.
                            let f = this.findFolderById( selectedFolderId );
                            if ( f != null ) {
                                subFolder = f?.children?.find( f => f.name.toLowerCase() === folderName.toLowerCase() );
    
                                if ( this.newFolderIds.includes( prevFolderId ) ) {
                                    // The selected folder is being replace by an existing folder,
                                    // if it's a new folder then we need to remove the old folders.  
                                    // Any triggers referencing folders in the hierarchy will be 
                                    // updated in this loop.
                                    let fparent = this.findFolderById( this.nagFolderMap[ f.folderId ] );
                                    let oi = fparent.children.findIndex( f => f.folderId === prevFolderId );
                                    fparent.children.splice( oi, 1 );
                                }

                                break;
                            }
                        }

                    }

                } else if ( subFolder.folderId === prevFolderId ) {
                    let f = this.findFolderById( selectedFolderId, this.nagFolders );

                    if ( f ) {
                            
                        if ( folder ) {
                            let oi = folder.children.findIndex( f => f.folderId === prevFolderId );
                            
                            if ( this.newFolderIds.includes( prevFolderId ) ) {
                                // We only want to execute this action if the prev folder was a new folder.
                                folder.children.splice( oi, 1 );
                            }
                        } else {
                            let oi = this.nagFolders.findIndex( f => f.folderId === prevFolderId );
                            
                            if ( this.newFolderIds.includes( prevFolderId ) ) {
                                // We only want to execute this action if the prev folder was a new folder.
                                folder.children.splice( oi, 1 );
                            }
                        }

                        subFolder = f;
                    }
                }

                if ( subFolder == null ) {
                    subFolder = new TriggerFolder();

                    subFolder.folderId = nagId();
                    subFolder.name = folderName;
                    subFolder.expanded = false;
                    subFolder.active = true;
                    subFolder.comments = 'Imported from Gina';
                    subFolder.children = [];
                    subFolder.folderConditions = [];

                    this.newFolderIds.push( subFolder.folderId );

                    if ( folder == null ) {
                        this.nagFolders.push( subFolder );
                    } else {
                        folder.children.push( subFolder );
                    }

                    this.nagFolderMap[ subFolder.folderId ] = folder?.folderId;
                    this.nagFolderNameMap[ subFolder.folderId ] = subFolder.name;
                
                }

                usedFolderIds.push( subFolder.folderId );
                folder = subFolder;
            }

            if ( folder != null ) {
                // This is required so that future folder changes can look for matches from their
                // updated place in the hierarchy.
                this.updateGinaFolders( trigger.ginaData, folder );
            }
                
            trigger.nagTrigger.folderId = folder.folderId;
        } );

        this.trimEmptyNewFolders( this.nagFolders );
        // This is not including any data if the folder id is not used, but a child is.
        this.folderDataSource.data = this.buildReviewFolderStructure( this.nagFolders, usedFolderIds ); 
        this.folderTreeControl.expandAll();

    }









    
    /**
     * Processes each folder for empty new folders and removes them.
     * 
     * @param folders The list of folders to process.
     */
    private trimEmptyNewFolders( folders: TriggerFolder[] ) {
        for ( let i = folders.length - 1; i >= 0; i-- ) {
            if ( this._trimEmptyNewFolder( folders[ i ] ) ) {
                folders.splice( i, 1 );
            }
        }
    }









    
    /**
     * Processes the given folder and full hierarchy to determine if the folder should be removed.
     * @param folder The folder to process.
     * @returns Returns true if the folder should be trimmed.
     */
    private _trimEmptyNewFolder( folder: TriggerFolder ): boolean {

        if ( folder.children?.length > 0 ) {
            for ( let i = folder.children?.length - 1; i >= 0; i-- ) {
                if ( this._trimEmptyNewFolder( folder.children[ i ] ) ) {
                    folder.children.splice( i, 1 );
                }
            }
        }

        if ( this.newFolderIds.includes( folder.folderId ) ) {
            return this.triggers.filter( f => f.nagTrigger.folderId === folder.folderId ).length === 0 && ( folder.children == null || folder.children.length === 0 );
        }


        return false;
    }









    
    /**
     * Filters the list of zone names based on the given value.
     * 
     * @returns Returns the list of zone names that match the given value.
     * 
     * @param value The value to filter on.
     */
    private _filterZoneName( value: string ): string[] {
        const fuseConfig = {
            includeScore: true
        };
          
        const fuse = new Fuse( this.eqZones, fuseConfig );
          
        const result = fuse.search( value );

        let scoreLimit = 0.85;
        let scores = result.map( item => item.score );
        let minScore = _.min( scores );

        if ( minScore < 0.35 ) {
            scoreLimit = 0.35;
        } else if ( minScore < 0.50 ) {
            scoreLimit = 0.50;
        }

        return result.filter( v => v.score < scoreLimit ).map( v => v.item );
    }









    
    /**
     * Shows the zone name check panel.
     */
    showZoneNameCheck() {
        this.panel = 'default';

        this.ipcService.getEverquestZones().subscribe( zones => {
            this.eqZones = zones;

            this.triggers.forEach( t => {
                t.zoneNameInputControl = new FormControl<string>( '' );
                t.zoneNameFilteredOptions = t.zoneNameInputControl.valueChanges.pipe(
                    startWith( '' ),
                    map( value => this._filterZoneName( value ) )
                );
            } );

            this.panel = 'zoneNameCheck';

        } );
    }









    
    /**
     * Hides the current panel and shows the previous panel.
     */
    back() {
        if ( this.panel === 'foldersCheck' ) {
            this.panel = 'duplicatesCheck';
        } else if ( this.panel === 'duplicatesCheck' ) {
            this.panel = 'overlayAssignment';
        } else if ( this.panel === 'zoneNameCheck' ) {
            this.panel = 'foldersCheck';
        }
    }









    
    /**
     * Imports the selected triggers.
     */
    importTriggers() {
        this.dialogService
            .showConfirmationDialog(
                'Are you ready to import?',
                'Click "Yes" to import all selected triggers.',
                'Click "No" to cancel and go back to review.' )
            .subscribe( confirmed => {
                if ( confirmed ) {
                    this.panel = 'default';

                    // Create the new folders.
                    this.ipcService.updateTriggerFolders( this.nagFolders ).subscribe( folders => {
                        
                        // Create each new trigger.
                        this.triggers.forEach( trigger => {
                            trigger.nagTrigger.importIdentifier = trigger.ginaData.ginaName;
                        } );

                        this.ipcService
                            .createNewTriggers( this.triggers.map( f => f.nagTrigger ) )
                            .subscribe( triggerIds => {
                                let created: TriggerReviewModel[] = [];

                                triggerIds?.forEach( tid => {
                                    let i = this.triggers.findIndex( f => f.nagTrigger.triggerId === tid );
                                    if ( i > -1 ) {
                                        created.push( this.triggers.splice( i, 1 )[ 0 ] );
                                    }
                                } );

                                this.ipcService.getIgnoredGinaObjects().subscribe( ignoredGinaObjects => {
                                    
                                    let newObjectNames: string[] = created.map( f => f.ginaData.ginaName );
                                    this.importedGinaObjects = Array.prototype.concat( newObjectNames, ignoredGinaObjects );

                                    let mergedGinaNames = Object.keys( this.mergeGinaNameMap );
                                    for ( let i = 0; i < mergedGinaNames?.length; i++ ) {
                                        const ginaName = mergedGinaNames[ i ];
                                        if ( this.importedGinaObjects.indexOf( this.mergeGinaNameMap[ ginaName ] ) > -1 ) {
                                            // If the name of the object that
                                            // ginaName was merged with is contained 
                                            // by the importedGinaObjects list, then 
                                            // add ginaName to that list as well.
                                            this.importedGinaObjects.push( ginaName );
                                            newObjectNames.push( ginaName );
                                        }
                                    }
                                    this.updateGinaIgnoreList();

                                    if ( this.triggers?.length > 0 ) {
                                        this.dialogService.showWarningDialog( 'Import Failure', [ 'Some or all triggers were unable to be imported.', 'Check the list on the left to see what triggers still remain.' ] );
                                    }
                                
                                    this.onCompleted.emit( newObjectNames );

                                } );
                            } );
                        
                    } );
                }
            } );
    }









    
    /**
     * Resets the duplicate check panel.
     */
    resetDuplicates() {
        this.generateTriggerModels().subscribe( () => {
            this.duplicates = [];
            this.showDuplicates();
        } );
    }









    
    /**
     * Shows the duplicate check panel.
     */
    showDuplicates() {
        
        this.panel = 'duplicatesCheck';

        if ( !( this.duplicates?.length > 0 ) ) {
            
            this.duplicateDetailsShown = {};
            this.triggerMergeSelected = {};
            this.triggerIgnoreSelected = {};
            this.mergeGinaNameMap = {};

            this.ipcService.searchForDuplicates( _.map( this.triggers, f => f.nagTrigger ) ).subscribe( duplicateData => {
            
                if ( duplicateData?.length > 0 ) {
                    this.duplicates = duplicateData;

                    let subjectData: DuplicateTriggerSubject[] = [];
                    for ( let i = 0; i < duplicateData?.length; i++ ) {
                        const d = duplicateData[ i ];
                        if ( subjectData.findIndex( f => f.triggerId === d.triggerId ) === -1 ) {
                            subjectData.push( {
                                triggerId: d.triggerId,
                                phrase: d.phrase,
                                subjectAction: d.subjectAction,
                            } );
                        }
                    }

                    this.duplicateGroups = _.groupBy( subjectData, f => f.phrase );
                    let keys = this.duplicatePhrases;
                    for ( let i = 0; i < keys.length; i++ ) {
                        this.triggerMergeSelected[ keys[ i ] ] = {};
                        this.triggerIgnoreSelected[ keys[ i ] ] = {};
                    }
                    
                } else {
                    this.showFolderCheck();
                }

            } );

        }
    }









    
    /**
     * Toggles the fade out class on the given element.
     * 
     * @param el The element to toggle the fade out class on.
     */
    toggleFadeOut( el: HTMLElement ): void {
        if ( el.classList.contains( 'shown' ) ) {
            el.classList.remove( 'shown' );
        } else {
            el.classList.add( 'shown' );
        }
    }









    
    /**
     * Returns the ginaName for the trigger with the given triggerId.
     * 
     * @param triggerId The triggerId to get the ginaName for.
     */
    getGinaName( triggerId: string ): string {
        let trigger = this.triggers.find( f => f.nagTrigger.triggerId === triggerId );
        return trigger?.ginaData.ginaName;
    }









    
    /**
     * Merges triggers with the same phrase.
     * 
     * @param phrase The phrase to merge.
     */
    mergeSelected( phrase: string ): void {
        let targetTriggerId: string = null;
        let targetGinaName: string = null;
        for ( let i = this.duplicateGroups[ phrase ]?.length - 1; i >= 0; i-- ) {
            const triggerId = this.duplicateGroups[ phrase ][ i ].triggerId;

            if ( this.triggerMergeSelected[ phrase ][ triggerId ] === true ) {
                if ( targetTriggerId == null ) {
                    targetTriggerId = triggerId;
                    targetGinaName = this.getGinaName( targetTriggerId );
                } else {

                    if ( this.copyActionsToTrigger( targetTriggerId, triggerId ) ) {

                        this.mergeGinaNameMap[ this.getGinaName( triggerId ) ] = targetGinaName;
                        this.removeFromImport( triggerId );
                
                        this.duplicateGroups[ phrase ].splice( i, 1 );
                        delete this.triggerMergeSelected[ phrase ][ triggerId ];
                    }
                }
            }
        }
        
        if ( this.duplicateGroups[ phrase ]?.length <= 1 ) {
            delete this.duplicateGroups[ phrase ];
        }
        
        if ( Object.keys( this.duplicateGroups )?.length === 0 ) {
            // If there are no more duplicates to deal with, let's review our folders.
            this.showFolderCheck();
        }
    }









    
    /**
     * Copies the actions of subject trigger onto target trigger.
     * 
     * @returns Returns true if the target and subject triggers were found.
     * 
     * @param targetTriggerId The id of the trigger actions should be copied to.
     * @param subjectTriggerId The id of the trigger actions should be copied from.
     * 
     */
    copyActionsToTrigger( targetTriggerId: string, subjectTriggerId: string ): boolean {
        // The copy action in the gina importer are simple because each trigger can execute only one capture phrase.
        let targetTrigger = this.triggers?.find( f => f.nagTrigger.triggerId === targetTriggerId )?.nagTrigger;
        let subjectTrigger = this.triggers?.find( f => f.nagTrigger.triggerId === subjectTriggerId )?.nagTrigger;

        if ( targetTrigger && subjectTrigger ) {
            let capturePhraseId = targetTrigger.capturePhrases[ 0 ].phraseId;
            subjectTrigger.actions.forEach( action => {
                action.phrases = [ capturePhraseId ];
                targetTrigger.actions.push( action );
            } );

            return true;
        }

        return false;
    }









    
    /**
     * Ignores the triggers with the given phrase.
     * 
     * @param phrase The trigger phrase to ignore.
     */
    ignoreSelected( phrase: string ): void {

        let targetTriggerId: string = null;
        let targetGinaName: string = null;

        // If we're ignoring a set of triggers, but not all triggers with the
        // same phrase then the assumption is that we're ignoring duplicate 
        // triggers in favor of a specific trigger.  In this case, we need to 
        // mark the ignored triggers as imported once the target is 
        // successfully imported.  We can start by finding this trigger.
        for ( let i = this.duplicateGroups[ phrase ]?.length - 1; i >= 0; i-- ) {
            const triggerId = this.duplicateGroups[ phrase ][ i ].triggerId;
            if ( this.triggerIgnoreSelected[ phrase ][ triggerId ] !== true && targetTriggerId == null ) {
                
                targetTriggerId = triggerId;
                targetGinaName = this.getGinaName( targetTriggerId );

                break;
            }
        }

        for ( let i = this.duplicateGroups[ phrase ]?.length - 1; i >= 0; i-- ) {
            const triggerId = this.duplicateGroups[ phrase ][ i ].triggerId;
            if ( this.triggerIgnoreSelected[ phrase ][ triggerId ] === true ) {
                
                this.mergeGinaNameMap[ this.getGinaName( triggerId ) ] = targetGinaName;
                this.removeFromImport( triggerId );
                
                this.duplicateGroups[ phrase ].splice( i, 1 );
                delete this.triggerIgnoreSelected[ phrase ][ triggerId ];
            }
        }

        if ( this.duplicateGroups[ phrase ]?.length <= 1 ) {
            delete this.duplicateGroups[ phrase ];
        }
        
        if ( Object.keys( this.duplicateGroups )?.length === 0 ) {
            // If there are no more duplicates to deal with, let's review our folders.
            this.showFolderCheck();
        }
    }









    
    /**
     * Removes a trigger from the import.
     * 
     * @param triggerId The id of the trigger to remove from the import.
     */
    removeFromImport( triggerId: string ): void {
        
        // Remove this trigger from the triggers list.}
        _.remove( this.triggers, t => t.nagTrigger.triggerId === triggerId );

        // Remove this trigger from the duplicates list.
        _.remove( this.duplicates, d => d.triggerId === triggerId );

        // Remove all references of this trigger from the duplicates list.
        this.duplicates.forEach( dup => {
            _.remove( dup.actions, a => a.triggerId === triggerId );
        } );

    }









    
    /**
     * This will tell future Gina import runs to ignore all of the gina triggers in the current model.
     */
    updateGinaIgnoreList(): void {
        this.ipcService.getIgnoredGinaObjects().subscribe( ignoredGinaObjects => {
            let updatedList = _.uniq( Array.prototype.concat( ignoredGinaObjects, this.importedGinaObjects ) );
            this.ipcService.saveIgnoredGinaObjects( updatedList );
        } );
    }









    
    /**
     * Returns the name for the given trigger id.
     * 
     * @param triggerId The id of the trigger to get the name for.
     */
    getTriggerName( triggerId: string ): string {
        let trigger = this.triggers.find( f => f.nagTrigger.triggerId == triggerId );
        return trigger?.nagTrigger.name ?? 'Unknown';
    }









    
    /**
     * Returns the family name for the given trigger id.
     * 
     * @param triggerId The id of the trigger to get the family name for.
     */
    getTriggerFamily( triggerId: string ): string {
        let trigger = this.triggers.find( f => f.nagTrigger.triggerId == triggerId );
        return trigger?.folderFamilyName ?? 'Unknown';
    }









    
    /**
     * Returns the gina name for the given trigger id.
     * 
     * @param action The action to get the text for.
     */
    getActionText( action: TriggerAction|OwnedTriggerAction ): string {
        return (action as TriggerAction)?.displayText ?? 'UNKNOWN';
    }









    
    /**
     * Returns a label for the given action type.
     * 
     * @param actionType The action type to get the label for.
     */
    getActionTypeLabel( actionType: ActionTypes ): string {
        return ActionTypeLabels( actionType );
    }









    
    /**
     * Returns true if the given action type is a timer type.
     * 
     * @param actionType The action type to check.
     */
    isTimerType( actionType: ActionTypes ): boolean {
        return actionType === ActionTypes.Timer || actionType === ActionTypes.DotTimer || actionType === ActionTypes.BeneficialTimer || actionType === ActionTypes.Countdown;
    }









    
    /**
     * Returns a label for the given duration.
     * 
     * @param seconds The number of seconds for duration.
     */
    public getDurationLabel( seconds: number | string ): string {
        
        seconds = +seconds;

        if ( seconds > 0 ) {
            let hours = Math.floor( seconds / 3600 );
            let mins = Math.floor( ( seconds % 3600 ) / 60 );
            let secs = seconds % 3600 % 60;
    
            let label = '';
    
            if ( hours > 0 ) {
                label += `${hours}h `;
            }
            if ( mins > 0 ) {
                label +=  `${mins}m `;
            }
            if ( secs > 0 ) {
                label +=  `${secs}s `;
            }

            return label;

        } else {
            return `${seconds}s`;

        }

    }










}

// TODO: Move the gina config loading into a new thread.
// TODO: Using the gina config loading thread, also process finding duplicates in the same thread window.

// TODO: Auto mapping of gina overlays based on weighted use between the incoming triggers and the defaults, vs existing triggers and overlay usage.  Use closest to instead of going from most used to less used.

//      Overlay | Nag no. | Gina no. | Gina Name
//     ---------+---------+----------+-------------
//      A       | 123     | 423      | Default
//      C       | 96      |          | --
//      E       | 75      | 56       | Detrimental
//      B       | 12      | 5        | Left
//      D       | 1       |          | --

// Primary rule, overlays get matched if the names are exactly equal, regardless of use counts.
// Secondary rule, match overlays by type and use counts, as close as possible.  It's not a race, the most matches don't win the assignment/mapping.
// Special rule: Overlays with a single mapping get mapped to the same named overlay, or the lowest.  If a gina overlay has 2+, next lowest > 1 mapping count.

// Snaggle: After the assignments are applied, the counts will change which will affect the next set of imports... Maybe normalize the data, weighted by total percentage of triggers from nag to the selected import triggers (or all gina triggers? yes, definitely this).

// NOTES:

// 1. We need to map Gina overlays to Nag overlays, and store that data for later use.  We still need to show the screen on the next import, but it should auto-select the last selected values.
// 2. We need a quicker duplicate check function.  To that end, we really only care if we're actually getting the same trigger multiple times.  Even moreso, that we're not getting duplicate timers and god forbid speaking alerts.
//  a. Here are some examples: Your skin freezes over => skin freeze, this will both operate with each other.  However, we really only care if the actions are also the same actions taken.  Not that the text/timer is the same, but they're both speaking actions?
//  b. We should also limit the results by the conditions, if the two triggers are in different zones then they won't conflict.
//  c. We need to send the entire list of trigger objects to the back-end for checking, and possibly spin up a new thread that performs the checks, and sends back status updates (0%-100% complete).

// More example thoughts:
// Sequentials, if gina capture matches any of the sequence.  The gina trigger will still fire even though the sequential may not if the first phrase was not captured.