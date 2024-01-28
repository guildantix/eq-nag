import { animate, state, style, transition, trigger } from '@angular/animations';
import { FlatTreeControl } from '@angular/cdk/tree';
import { Component, OnInit, Inject } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatTree, MatTreeFlatDataSource, MatTreeFlattener } from '@angular/material/tree';
import { combineLatest, forkJoin, Observable } from 'rxjs';
import { AuthorModel, OverlayWindowModel, PackageFileModel, PackageFolder, PackageTrigger, QuickShareFileModel, QuickShareModel, TriggerAction, TriggerFolder, TriggerModel } from 'src/app/core.model';
import { IpcService } from 'src/app/ipc.service';
import { PrepareQuickShareModel } from '../dialog.model';
import * as _ from 'lodash-es';
import { QuickShareService } from 'src/app/core/quick-share.service';
import { SettingsService } from 'src/app/settings/settings-http.service';
import { AuthorDialogComponent } from '../author-dialog/author-dialog.component';
import { NotificationDialogComponent } from '../notification-dialog/notification-dialog.component';
import { NotificationTypes } from '../notification-dialog/notification-dialog.model';
import { HttpErrorResponse } from '@angular/common/http';
import { MatSnackBar } from '@angular/material/snack-bar';
import { getPackageImportProperties } from 'src/app/core.decorators';

interface QuickShareTreeNode {
    expandable: boolean;
    name: string;
    level: number;
    item: TriggerFolder | TriggerModel;
    selected: boolean;
    folderState?: string;
    id: string;
    isFolder: boolean;
    hasChildren: boolean;
}

class QuickShareTreeObject {
    name: string;
    children: QuickShareTreeObject[] = [];
    folder: TriggerFolder;
    trigger: TriggerModel;
    selected: boolean;
}

@Component( {
    selector: 'app-prepare-quick-share-dialog',
    templateUrl: 'prepare-quick-share.component.html',
    styleUrls: [ 'prepare-quick-share.component.scss', '../dialog.styles.scss', '../../core.scss', '../../modal.scss' ], 
    animations: [
        trigger( 'detailExpand', [
            state( 'collapsed', style( { height: '0px', minHeight: '0' } ) ),
            state( 'expanded', style( { height: '*' } ) ),
            transition( 'expanded <=> collapsed', animate( '225ms cubic-bezier(0.4, 0.0, 0.2, 1)' ) ),
        ] ),
    ],
} )
export class PrepareQuickShareDialogComponent implements OnInit {
    
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
        };
    }
    public treeControl = new FlatTreeControl<QuickShareTreeNode>( node => node ? node.level : 1, node => node.expandable );
    public treeFlattener = new MatTreeFlattener(this._transformer, node => node.level, node => node.expandable, node => node.children);
    public dataSource = new MatTreeFlatDataSource( this.treeControl, this.treeFlattener );
    public hasChild = ( _: number, node: QuickShareTreeNode ) => node.expandable;
    public creatingQuickShare: boolean = false;

    private allFolders: TriggerFolder[] = [];
    private allTriggers: TriggerModel[] = [];

    constructor(
        public dialogRef: MatDialogRef<PrepareQuickShareDialogComponent, string>,
        @Inject( MAT_DIALOG_DATA ) public data: PrepareQuickShareModel,
        public dialog: MatDialog,
        private ipcService: IpcService,
        private quickShareService: QuickShareService,
        private settingsService: SettingsService,
        private snackBar: MatSnackBar,
    ) { }

    ngOnInit(): void {
        
        forkJoin( {
            folders: this.ipcService.getTriggerFolders(),
            triggers: this.ipcService.getTriggers(),
        } ).subscribe( result => {

            this.allFolders = result.folders;
            this.allTriggers = result.triggers;
            
            let data: QuickShareTreeObject[] = [];
            result.folders.forEach( folder => this.processFolder( folder, result.triggers, data, this.data.triggers ) );
            this.dataSource.data = data;

            this.updateFolderStates();
                    
            this.treeControl.dataNodes?.forEach( n => {
                if ( n.expandable && n.folderState !== 'none' ) {
                    this.treeControl.expand( n );
                }
            } );
            
        } );
        
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
     * Generates the tree node data.
     * 
     * @param folder The trigger folder hierarchy.
     * @param triggers The full trigger list.
     * @param data The current node heirarchy.
     * @param includeTriggers The triggers to forcibly select.
     */
    private processFolder( folder: TriggerFolder, triggers: TriggerModel[], data: QuickShareTreeObject[], includeTriggers: TriggerModel[] ): void {
        
        let node = new QuickShareTreeObject();
        node.name = folder.name;
        node.children = [];
        node.folder = folder;

        // Push this folder node into the data list.
        data.push( node );

        // Push each child folder into this node's children list.
        folder.children.forEach( f => this.processFolder( f, triggers, node.children, includeTriggers ) );

        // Find all triggers in this folder
        let myTriggers = triggers.filter( f => f.folderId === folder.folderId );

        // Push each child trigger into this node's children list.
        myTriggers?.forEach( trigger => {
            let triggerNode = new QuickShareTreeObject();
            triggerNode.name = trigger.name;
            triggerNode.children = [];
            triggerNode.trigger = trigger;
            triggerNode.selected = includeTriggers.findIndex( f => f.triggerId === trigger.triggerId ) > -1;
            node.children.push( triggerNode );
        } );
    }









    
    /**
     * Returns the specified trigger folder in the given hierarchy.
     * 
     * @param folderId The id of the desired folder.
     * @param search The list of folders to query.
     * @returns 
     */
    private findFolderById( folderId: string, search: TriggerFolder[] = null ): TriggerFolder {
        search = search ? search : this.allFolders;

        for ( let i = 0; i < search?.length; i++ ) {
            let folder = search[ i ].folderId === folderId ? search[ i ] : this.findFolderById( folderId, search[ i ].children );

            if ( folder ) {
                return folder;
            }
        }

    }









    
    /**
     * Returns a list of all direct and descendant child folders.
     * 
     * @param folder The starting folder.
     * @param descendantIds The current list of descendant folder ids.
     * @returns 
     */
    private getDescendantFolderIds( folder: TriggerFolder, descendantIds: string[] = null ): string[]{
        descendantIds = descendantIds ? descendantIds : [];

        descendantIds.push( folder.folderId );

        folder.children.forEach( c => this.getDescendantFolderIds( c, descendantIds ) );

        return descendantIds;
    }









    
    /**
     * Updates the selection state of all folders, show partial/full/none 
     * selection state based on the direct and descendant selected triggers.
     */
    private updateFolderStates(): void {

        this.treeControl.dataNodes.forEach( f => {
            if ( f.isFolder ) {
                let folder = this.findFolderById( f.id );
                let familyIds = this.getDescendantFolderIds( folder );
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
        
        let folder = this.findFolderById( node.id );
        let familyIds = this.getDescendantFolderIds( folder );
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
     * Returns a folder hierarchy of selected folders.
     * 
     * @param source The source folder list.
     * @param folderIds The list of selected folder ids.
     */
    private getQuickShareFolders( source: TriggerFolder[], folderIds: string[] ): PackageFolder[] {
        let quickShareFolders: PackageFolder[] = [];
        
        for ( let i = 0; i < source?.length; i++ ) {
            let f = source[ i ];
            if ( this._hasSelected( f, folderIds ) ) {
                let pf = new PackageFolder();

                pf.folderId = f.folderId;
                pf.name = f.name;

                if ( f.children?.length > 0 ) {
                    pf.children = this.getQuickShareFolders( f.children, folderIds );
                } else {
                    pf.children = [];
                }
                quickShareFolders.push( pf );
            }
        }

        return quickShareFolders;
    }









    
    /**
     * Returns true if the given folder, or it's descendants, are selected.
     * 
     * @param folder The folder to check.
     * @param selectedIds The list of selected folder ids.
     */
    private _hasSelected( folder: TriggerFolder, selectedIds: string[] ): boolean {

        if ( selectedIds.indexOf( folder.folderId ) > -1 ) {
            return true;

        } else {
            for ( let i = 0; i < folder.children?.length; i++ ) {
                if ( this._hasSelected( folder.children[ i ], selectedIds ) ) {
                    return true;
                }
            }
        }
        
    }










    /**
     * Creates the quickshare object and submits the quickshare to the nag 
     * service to generate an id.
     */
    createQuickShare(): void {
        this.creatingQuickShare = true;

        // If the current user has already created their author account, then 
        // that record is used, otherwise the user is presented with a dialog 
        // to create their account.
        let authorObs = new Observable<AuthorModel>( observer => {
            this.ipcService.getAuthor().subscribe( author => {
                
                if ( author?.authorId ) {
                    observer.next( author );
                    observer.complete();

                } else {

                    // Show author dialog to pull in name and? discord information.
                    this.dialog.open<AuthorDialogComponent, any, AuthorModel>( AuthorDialogComponent, {
                        width: '450px',
                        panelClass: 'app-dialog',
                    } ).afterClosed().subscribe( authorName => {

                        this.settingsService
                            .createAuthor( authorName.name, authorName.discord )
                            .subscribe( newAuthor => {
                                this.ipcService.saveAuthor( newAuthor );
                                observer.next( newAuthor );
                                observer.complete();
                            } );

                    } );
                }

            } );
        } );

        let dataObservables = [
            this.ipcService.getTriggers(),
            this.ipcService.getTriggerFolders(),
            this.ipcService.getAudioFileData(),
            this.ipcService.getDetrimentalOverlayId(),
            this.ipcService.getBeneficialOverlayId(),
            this.ipcService.getAlertOverlayId(),
            this.ipcService.getOverlayWindows(),
            this.ipcService.getPrimaryDisplay(),
            authorObs,
        ];

        // combineLatest will wait for the next value in each observable, but 
        // doesn't require the observables to be completed.
        combineLatest( dataObservables ).subscribe(
            ( [ triggers, folders, audioFiles, detrimentalOverlayId, beneficialOverlayId, textOverlayId, overlays, primaryDisplay, author ]: [ TriggerModel[], TriggerFolder[], PackageFileModel[], string, string, string, OverlayWindowModel[], Electron.Display, AuthorModel ] ) => {

                // Pulls the selected triggers and folders into quickshare data
                // formats.
                let flattenedTreenodes: QuickShareTreeNode[] = this.treeControl.dataNodes;
                let selectedTriggerNodes = flattenedTreenodes.filter( f => !f.isFolder && f.selected );
                let triggerIds = _.map( selectedTriggerNodes, f => f.id );
                let quickShareTriggers = triggers
                    .filter( f => triggerIds.indexOf( f.triggerId ) > -1 )
                    .map( trigger => PackageTrigger.FromTrigger( trigger ) );
                let folderIds = _.uniq( _.map( quickShareTriggers, f => f.folderId ) );
                let quickShareFolders = this.getQuickShareFolders( folders, folderIds );

                let quickShare = new QuickShareModel();
                
                quickShare.folders = quickShareFolders;
                quickShare.triggers = quickShareTriggers;
                quickShare.detrimentalOverlayId = detrimentalOverlayId;
                quickShare.beneficialOverlayId = beneficialOverlayId;
                quickShare.textOverlayId = textOverlayId;
                quickShare.primaryDisplaySize = primaryDisplay.size;

                let quickShareFiles: QuickShareFileModel[] = [];
                quickShare.overlays = [];

                // Creates the QuickShare file format models.
                quickShareTriggers.forEach( trigger => {
                    trigger.actions.forEach( action => {

                        let actionProperties = getPackageImportProperties( Object.assign( new TriggerAction(), action ) );

                        actionProperties.overlayIds.forEach( overlayId => {
                            if ( overlayId !== detrimentalOverlayId && overlayId !== beneficialOverlayId && overlayId !== textOverlayId ) {
                                let overlay = overlays.find( f => f.overlayId === overlayId );
                                if ( overlay ) {
                                    let exists = quickShare.overlays.findIndex( f => f.overlayId === overlayId ) > -1;
                                    if ( !exists ) {
                                        quickShare.overlays.push( overlay );
                                    }
                                }
                            }
                        } );

                        actionProperties.audioFileIds.forEach( audioFileId => {
                            let file = audioFiles.find( f => f.fileId === audioFileId );

                            if ( file ) {
                                let exists = quickShareFiles.findIndex( f => f.fileId === file.fileId ) > -1;
                                if ( !exists ) {
                                    quickShareFiles.push( file );
                                }
                            }
                        } );
    
                    } );
                } );

                // Submits the final quickshare to the server to generate a 
                // quickShareId.
                this.quickShareService
                    .createQuickShare( author.authorId, quickShare, quickShareFiles, null )
                    .subscribe( quickShareId => {
                        let code = `{NAG:quick-share/${quickShareId}}`;
                        this.ipcService.sendTextToClipboard( code );
                        this.snackBar.open( 'Quickshare copied to clipboard', 'Dismiss', { duration: 5000 } );
                        this.dialogRef.close( quickShareId );
                    } );
                
                this.creatingQuickShare = false;

            }, ( err: HttpErrorResponse | string ) => {
                
                this.dialog.open( NotificationDialogComponent, {
                    width: '450px',
                    data: {
                        title: `Error`,
                        message: [ 'An error was thrown while attempting the request.', err instanceof HttpErrorResponse ? err.error?.Message ?? 'Unknown Error' : err ],
                        notificationType: NotificationTypes.Error,
                    },
                    panelClass: 'app-dialog',
                } ).afterClosed().subscribe();
                
                this.creatingQuickShare = false;
                
            } );

    }
    
}
