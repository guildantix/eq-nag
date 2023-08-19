import { trigger, state, style, transition, animate } from '@angular/animations';
import { FlatTreeControl } from '@angular/cdk/tree';
import { Component, OnInit, Inject } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatTreeFlattener, MatTreeFlatDataSource } from '@angular/material/tree';
import { PackageFolder, PackageTrigger, QuickShareFileModel, QuickShareMetaModel, QuickShareModel, TriggerFolder, TriggerModel } from 'src/app/core.model';
import * as _ from 'lodash-es';
import { IpcService } from 'src/app/ipc.service';
import { combineLatest, forkJoin, Observable, timer } from 'rxjs';
import { nagId } from 'src/app/core/nag-id.util';
import { NotificationDialogModel, NotificationTypes } from '../notification-dialog/notification-dialog.model';
import { NotificationDialogComponent } from '../notification-dialog/notification-dialog.component';
import { ColoredString } from '../dialog.model';
import { MatSnackBar } from '@angular/material/snack-bar';

interface QuickShareTreeNode {
    expandable: boolean;
    name: string;
    level: number;
    item: PackageFolder | PackageTrigger;
    selected: boolean;
    folderState?: string;
    id: string;
    isFolder: boolean;
    hasChildren: boolean;
    exists: boolean;
    overwrite: boolean;
    update: boolean;
    duplicate: boolean;
}

class QuickShareTreeObject {
    name: string;
    children: QuickShareTreeObject[] = [];
    folder: PackageFolder;
    trigger: PackageTrigger;
    selected: boolean;
    exists: boolean;
    overwrite: boolean;
    update: boolean;
    duplicate: boolean;
}

@Component( {
    selector: 'app-receive-quick-share-dialog',
    templateUrl: 'receive-quick-share.component.html',
    styleUrls: [ 'receive-quick-share.component.scss', '../dialog.styles.scss', '../../core.scss' ], 
    animations: [
        trigger( 'detailExpand', [
            state( 'collapsed', style( { height: '0px', minHeight: '0' } ) ),
            state( 'expanded', style( { height: '*' } ) ),
            transition( 'expanded <=> collapsed', animate( '225ms cubic-bezier(0.4, 0.0, 0.2, 1)' ) ),
        ] ),
    ],
} )
export class ReceiveQuickShareDialogComponent implements OnInit {

    private _transformer: ( node: QuickShareTreeObject, level: number ) => QuickShareTreeNode = ( node: QuickShareTreeObject, level: number ) => {
        return {
            expandable: node.folder ? true : false, 
            name: node.name,
            level: level,
            item: node.folder ? node.folder : node.trigger,
            selected: node.selected === false ? false : true,
            id: node.folder ? node.folder.folderId : node.trigger.triggerId,
            isFolder: node.folder ? true : false,
            hasChildren: node.children?.length > 0,
            exists: node.exists,
            overwrite: node.overwrite,
            update: node.update,
            duplicate: node.duplicate,
        };
    }
    public treeControl = new FlatTreeControl<QuickShareTreeNode>( node => node ? node.level : 1, node => node.expandable );
    public treeFlattener = new MatTreeFlattener(this._transformer, node => node.level, node => node.expandable, node => node.children);
    public dataSource = new MatTreeFlatDataSource( this.treeControl, this.treeFlattener );
    public hasChild = ( _: number, node: QuickShareTreeNode ) => node.expandable;
    public stageNewTriggers: boolean = false;

    private allFolders: PackageFolder[] = [];
    private allTriggers: PackageTrigger[] = [];
    /** Keeps track of the ids of all triggers that will be updated.  A trigger is updated when the trigger id matches an existing trigger. */
    private updateTriggerIds: string[] = [];
    /** Keeps track of the ids of all triggers that will be overwritten.  A trigger is overwritten when the trigger names match exactly, and they're in the same folder. */
    private overwriteTriggerIds: string[] = [];
    /** Keeps track of the ids of all new triggers. */
    private newTriggerIds: string[] = [];
    /** Keeps track of possible duplicate triggers. */
    private possibleDuplicateTriggers: Record<string, string[]> = {};
    /** Keeps track of the folders, whose descendants contain an updated trigger. */
    private foldersWithUpdates: string[] = [];
    /** Keeps track of the folders, whose descendants contain an overwritten trigger. */
    private foldersWithOverwrites: string[] = [];

    constructor(
        public dialogRef: MatDialogRef<ReceiveQuickShareDialogComponent, boolean>,
        @Inject( MAT_DIALOG_DATA ) public data: { quickShares: QuickShareMetaModel[], files: QuickShareFileModel[] },
        public dialog: MatDialog,
        private ipcService: IpcService,
        private snackBar: MatSnackBar,
    ) { }

    ngOnInit(): void {
        
        forkJoin( {
            folders: this.ipcService.getTriggerFolders(),
            triggers: this.ipcService.getTriggers(),
        } ).subscribe( result => {
            
            let data: QuickShareTreeObject[] = [];
            this.data.quickShares.forEach( quickShare => {
                this.allFolders = _.concat( this.allFolders, quickShare.model.folders );
                this.allTriggers = _.concat( this.allTriggers, quickShare.model.triggers );
            } );
            
            this.processExistingTriggers( result.triggers, result.folders ); // This one here
            this.mapFolderIds( result.folders, this.allFolders );
            this.removeEmptyFolders( this.allFolders );
            this.processTriggerActions( this.allTriggers, result.triggers, result.folders );

            this.allFolders.forEach( folder => this.processFolder( folder, this.allTriggers, data, result.folders, result.triggers ) );
            
            this.dataSource.data = data;

            this.updateFolderStates();
        } );
        
    }










    /**
     * Removes all empty folders from the given folder hierarchy.
     * 
     * @param folders The list of folders to parse.
     */
    private removeEmptyFolders( folders: PackageFolder[] ) {
        
        let ri: number[] = [];

        for ( let i = 0; i < folders.length; i++ ) {

            if ( folders[ i ].children?.length > 0 ) {
                this.removeEmptyFolders( folders[ i ].children );
            }
            
            if ( folders[ i ].children == null || folders[ i ].children.length === 0 ) {
                let c = this.allTriggers.filter( f => f.folderId === folders[ i ].folderId ).length;
                if ( c === 0 ) {
                    console.log( 'remove', folders[ i ].name );
                    ri.push( i );
                }
            }
        }

        for ( let i = ri.length - 1; i >= 0; i-- ) {
            folders.splice( i, 1 );
        }

    }










    /**
     * Processes and tracks the actions against each real trigger.  Also checks 
     * for possible duplicate triggers.
     * 
     * @param packageTriggers The list of all package triggers.
     * @param realTriggers The list of all real triggers.
     */
    private processTriggerActions( packageTriggers: PackageTrigger[], realTriggers: TriggerModel[], realFolders: TriggerFolder[] ) {
        let ancestryMap = TriggerFolder.getFolderAncestryMap( realFolders );

        packageTriggers.forEach( pt => {

            // Find matches by trigger id, marking them as UPDATE.
            let matchedById = realTriggers.find( f => f.triggerId === pt.triggerId );
            if ( matchedById ) {
                this.updateTriggerIds.push( pt.triggerId );

                let t: string = matchedById.folderId;
                while ( t != null ) {
                    this.foldersWithUpdates.push( t );
                    t = ancestryMap[ t ];
                }

                // Leave this iteration.
                return;
            }

            // Find matches by name, marking them as OVERWRITE.
            let matchedByName = realTriggers.find( f => f.folderId === pt.folderId && f.name === pt.name );
            if ( matchedByName ) {
                this.overwriteTriggerIds.push( pt.triggerId );

                let t: string = matchedByName.folderId;
                while ( t != null ) {
                    this.foldersWithOverwrites.push( t );
                    t = ancestryMap[ t ];
                }

                // Leave this iteration.
                return;
            }
        } );
    }









    
    /**
     * Traverses the package folder hierarchy, updating folder ids when the 
     * package folder exists as a real folder.
     * 
     * @param realFolders The full hierarchy of real folders.
     * @param packageFolders The full hierarchy of package folders.
     */
    private mapFolderIds( realFolders: TriggerFolder[], packageFolders: PackageFolder[] ) {

        packageFolders.forEach( pf => {

            // If the folder does not exist, then create a new id for it,
            // otherwise use the existing folder id.
            let rf = realFolders?.find( f => f.name === pf.name );
            let folderId = rf?.folderId ?? nagId();

            // Update all trigger folder ids.
            this.allTriggers.filter( f => f.folderId === pf.folderId ).forEach( trigger => trigger.folderId = folderId );

            // Update the current folder id.
            pf.folderId = folderId;

            if ( pf.children?.length > 0 ) {
                this.mapFolderIds( rf?.children, pf.children );
            }
        } );
    }









    
    /**
     * Checks the real triggers against the quick share triggers, when finding 
     * a trigger id that matches, then moves it to the correct folder.
     * 
     * @param realTriggers The list of all real triggers.
     * @param realFolders The full real folder hierarchy.
     */
    private processExistingTriggers( realTriggers: TriggerModel[], realFolders: TriggerFolder[] ) {
        this.allTriggers.forEach( qst => {
            // Find the index of the trigger that is already in my library.
            let i = realTriggers.findIndex( f => f.triggerId === qst.triggerId );

            // If this trigger exists and the folder id is not null.
            if ( i > -1 && realTriggers[ i ].folderId != null ) {

                // Get the direct parent of the folder that contains the real trigger, in this case it's the same folder thats in the quick share.
                let ancestryFolders = TriggerFolder.getFolderAncestry( realTriggers[ i ].folderId, realFolders );

                this.insertRealFolders( ancestryFolders );
                qst.folderId = realTriggers[ i ].folderId;
            }

        } );
    }









    
    /**
     * Inserts the given folder ancestry into the quick share folders.
     * 
     * @param realFolders The folder ancestry.
     */
    private insertRealFolders( realFolders: TriggerFolder[] ) {
        let folder = realFolders[ 0 ];
        let generation = this.allFolders;

        while ( folder != null ) {
            let pkgFolder: PackageFolder = generation.find( f => f.name === folder.name );

            if ( pkgFolder == null ) {
                pkgFolder = new PackageFolder();
            
                pkgFolder.folderId = folder.folderId;
                pkgFolder.name = folder.name;
                pkgFolder.children = [];

                generation.push( pkgFolder );
            }

            generation = pkgFolder.children;
            folder = folder.children?.length > 0 ? folder.children[ 0 ] : null;
        }
    }
    









    /**
     * Generates the tree node data.
     * 
     * @param folder The trigger folder hierarchy.
     * @param triggers The full trigger list.
     * @param data The current node heirarchy.
     */
    private processFolder( folder: PackageFolder, triggers: PackageTrigger[], data: QuickShareTreeObject[], realFolders: TriggerFolder[], realTriggers: TriggerModel[] ): void {
        
        // check for real triggers by id, if found, make sure the folder appears as they do in the system.
        //      For example, I installed a quick share, then moved all the triggers to my own folders.  Those triggers should not be duplicated, and they should stay in the folder that I assigned them.

        let node = new QuickShareTreeObject();
        let realFolder = realFolders?.find( f => f.name === folder.name );
        node.name = folder.name;
        node.children = [];
        node.folder = folder;
        node.exists = realFolder != null;
        node.overwrite = this.foldersWithOverwrites.indexOf( folder.folderId ) > -1;
        node.update = this.foldersWithUpdates.indexOf( folder.folderId ) > -1;

        // Push this folder node into the data list.
        data.push( node );
        
        // Push each child folder into this node's children list.
        folder.children.forEach( f => this.processFolder( f, triggers, node.children, realFolder?.children, realTriggers ) );

        // Find all triggers in this folder
        let myTriggers = triggers.filter( f => f.folderId === folder.folderId );
        let myRealTriggers = realTriggers.filter( f => f.folderId === realFolder?.folderId && realTriggers.findIndex( rf => rf.name === f.name ) > -1 ).map( f => f.name );

        // Push each child trigger into this node's children list.
        myTriggers?.forEach( trigger => {
            let triggerNode = new QuickShareTreeObject();
            triggerNode.name = trigger.name;
            triggerNode.children = [];
            triggerNode.trigger = trigger;
            triggerNode.selected = true;
            triggerNode.exists = myRealTriggers.indexOf( trigger.name ) > -1;
            triggerNode.overwrite = this.overwriteTriggerIds.indexOf( trigger.triggerId ) > -1;
            triggerNode.duplicate = this.possibleDuplicateTriggers[ trigger.triggerId ]?.length > 0;
            triggerNode.update = this.updateTriggerIds.indexOf( trigger.triggerId ) > -1;
            node.children.push( triggerNode );
        } );
    }
    








    
    /**
     * Updates the selection state of all folders, show partial/full/none 
     * selection state based on the direct and descendant selected triggers.
     */
     private updateFolderStates(): void {

        this.treeControl.dataNodes.forEach( f => {
            if ( f.isFolder ) {
                let folder = PackageFolder.findFolderById( f.id, this.allFolders );
                let familyIds = PackageFolder.getDescendantFolderIds( folder );
                let triggerCount = 0;
                let selectedTriggerCount = 0;
                
                for ( let i = 0; i < familyIds?.length; i++ ) {
                    let triggers = this.treeControl.dataNodes.filter( t => !t.isFolder && t.item.folderId === familyIds[ i ] );
                    triggerCount += triggers.length;
                    selectedTriggerCount += triggers.filter( t => t.selected ).length;
                }

                f.folderState = triggerCount === selectedTriggerCount && triggerCount > 0 ? 'all' :
                                selectedTriggerCount === 0 ? 'none' : 'partial';
            }
        } );
        
    }









    
    /**
     * Selects all triggers in the given folder, including all descendants.
     * 
     * @param node The tree node for the folder.
     * @param value The selected state for the folder.
     */
    onFolderSelectChange( node: QuickShareTreeNode, value: boolean ): void {
        
        let folder = PackageFolder.findFolderById( node.id, this.allFolders );
        let familyIds = PackageFolder.getDescendantFolderIds( folder );
        for ( let i = 0; i < familyIds?.length; i++ ) {
            let triggers = this.treeControl.dataNodes.filter( t => !t.isFolder && t.item.folderId === familyIds[ i ] );
            triggers.forEach( f => f.selected = value );
        }
        
        this.updateFolderStates();
    }









    
    /**
     * Triggers the update folder states method.
     */
    onTriggerSelectChange(): void {
        this.updateFolderStates();
    }









    
    /**
     * Toggles the select state on the given tree node.
     * 
     * @param node The tree node.
     */
    toggleSelect( node: QuickShareTreeNode ): void {
        let trigger = <TriggerModel>node.item;
        if ( trigger.triggerId ) {
            node.selected = !node.selected;
        }
    }










    /**
     * Shows the user an information dialog to explain the process of staging.
     */
    public showStagingFolderHelp(): void {
        let data: NotificationDialogModel = new NotificationDialogModel();
        
        data.title = 'Quick Share Folder';
        data.message = ['Using this option will import new triggers into the Quick Share Staged folder.', new ColoredString('Any existing/updated triggers will not be moved.', '#69f0ae', false), 'If a Quick Share Staged folder does not exist, a new one will be created at the root.'];
        data.notificationType = NotificationTypes.Information;

        this.dialog.open( NotificationDialogComponent, {
            width: '675px',
            data: data,
            panelClass: 'app-dialog',
        } ).afterClosed().subscribe();
    }
    








    /**
     * Imports the selected quick share triggers.
     */
    receiveSelectedTriggers(): void {

        let importTriggerIds = this.treeControl.dataNodes.filter( f => f.selected && !f.isFolder ).map( f => f.id );
        let importFolderIds = this.treeControl.dataNodes.filter( f => f.selected && f.isFolder ).map( f => f.id );
        let fileIds = [];

        // For all selected triggers, create a list of used file ids.
        this.allTriggers.filter( f => importTriggerIds.indexOf( f.triggerId ) > -1 )?.forEach( trigger => {
            trigger.actions?.forEach( action => {
                if ( action.audioFileId ) {
                    fileIds.push( action.audioFileId );
                }
                if ( action.endedPlayAudioFileId ) {
                    fileIds.push( action.endedPlayAudioFileId );
                }
                if ( action.endingPlayAudioFileId ) {
                    fileIds.push( action.endingPlayAudioFileId );
                }
            } );
        } );

        // Ensure each id exists once.
        fileIds = _.uniq( fileIds );

        // Adding a timer makes the following easier (you can't forkjoin an empty array) and I'm being lazy today.
        let importTasks: Observable<any>[] = [ timer( 1 ) ];

        this.data.files?.forEach( file => {
            if ( fileIds.indexOf( file.fileId ) > -1 ) {
                importTasks.push( this.ipcService.importPackageFile( file ) );
            }
        } );
        
        /** The folder id for the shared staged folder. */
        let stagedId = nagId();

        forkJoin( importTasks ).subscribe( results => {

            let installTasks: Observable<any>[] = [ timer( 1 ) ];
            
            this.data.quickShares?.forEach( quickShare => {

                quickShare.stageNewTriggers = this.stageNewTriggers;

                // Remove from the model triggers and folders that are left un-selected.
                quickShare.model.triggers = quickShare.model.triggers.filter( f => importTriggerIds.indexOf( f.triggerId ) > -1 );
                quickShare.model.folders = quickShare.model.folders.filter( f => importFolderIds.indexOf( f.folderId ) > -1 );
                
                if ( this.stageNewTriggers ) {
                    this.stageTriggers( quickShare, stagedId );
                }

                // Install the model.
                installTasks.push( this.ipcService.installQuickShare( quickShare ) );
            } );

            forkJoin( installTasks ).subscribe( results => {
                this.snackBar.open( 'Quick Share(s) installed!', 'dismiss', { duration: 2500 } );
                this.ipcService.requestTick();
                
                this.dialogRef.close( true );
            } );

        } );

    }










    /**
     * Creates a staged folder and moves all quickshare root folders into 
     * staged.
     * 
     * @param quickShare The quick share to stage.
     * @param stagedId The staged folder id.
     */
    public stageTriggers( quickShare: QuickShareMetaModel, stagedId: string ) {

            
        let pf = new PackageFolder();

        pf.folderId = stagedId;
        pf.name = 'Quick Share Staged';
        pf.children = quickShare.model.folders;

        quickShare.model.folders = [ pf ];

    }










}
