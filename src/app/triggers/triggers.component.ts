import { FlatTreeControl } from '@angular/cdk/tree';
import { Component, OnInit, ViewChild } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTreeFlatDataSource, MatTreeFlattener } from '@angular/material/tree';
import { Tag, TriggerFolder, TriggerModel } from '../core.model';
import { DialogService } from '../dialogs/dialog.service';
import { IpcService } from '../ipc.service';
import * as _ from 'lodash';
import { ContextMenuModel } from '../context-menu/context-menu.model';
import { MatTable } from '@angular/material/table';

interface FolderTreeNode {
  expandable: boolean;
  name: string;
  level: number;
}

@Component( {
    selector: 'app-triggers',
    templateUrl: 'triggers.component.html',
    styleUrls: [ 'triggers.component.scss', '../core.scss' ],
} )
export class TriggersComponent implements OnInit {

    private _transformer = ( folder: TriggerFolder, level: number ) => {
        return {
            expandable: !!folder.children && folder.children.length > 0,
            name: folder.name,
            level: level,
            active: folder.active,
            folderId: folder.folderId,
            expanded: folder.expanded,
        };
    }
    public treeControl = new FlatTreeControl<FolderTreeNode>( node => node.level, node => node.expandable );
    public treeFlattener = new MatTreeFlattener(this._transformer, node => node.level, node => node.expandable, node => node.children);
    public dataSource = new MatTreeFlatDataSource(this.treeControl, this.treeFlattener);
    public hasChild = ( _: number, node: FolderTreeNode ) => node.expandable;
    public selectedFolderId: string;
    public triggers: TriggerModel[] = [];
    public filteredTriggers: TriggerModel[] = [];
    public isDev: boolean = false;
    public triggerSearchResults: TriggerModel[] = [];
    public searchTerm: string = null;
    @ViewChild( 'triggersTable' ) triggersTable: MatTable<TriggerModel>;

    public get allExpanded(): boolean {
        return this._treeExpanded;
    }

    private _treeExpanded: boolean = false;
    private triggerFolders: TriggerFolder[] = [];
    
    constructor(
        private snackBar: MatSnackBar,
        private ipcService: IpcService,
        private dialogService: DialogService ) {
        
        this.dataSource.data = [];

    }

    ngOnInit() {

        this.ipcService.tickReceived().subscribe( tick => {
            this.triggers = tick.triggers.filter( f => this.isDev || !f.predefined );
            this.updateViewTriggerData( tick.folders );
            this.filterTriggers();
            this.searchTerm = null;
        } );

        this.ipcService.getAppIsDev().subscribe( isDev => this.isDev = isDev );
        this.ipcService.getTriggerFolders().subscribe( folders => {
            this.updateViewTriggerData( folders );
        } );

    }









    
    /**
     * Displays the new trigger dialog.
     */
    public showNewTriggerDialog(): void {
        this.ipcService.showNewTriggerDialog( this.selectedFolderId );
    }









    
    /**
     * Displays the new dot timer wizard dialog.
     */
    public showNewDotTimerDialog(): void {
        this.dialogService.showNewDotTimerDialog();
    }









    
    /**
     * Shows the edit trigger dialog for the specified trigger.
     * 
     * @param triggerId The id of the desired trigger.
     */
    public showEditTriggerDialog( triggerId: string ): void {
        this.ipcService.showEditTriggerDialog( triggerId );
    }










    /**
     * Toggles the selection state of the folder for the specified folder.
     * 
     * @param folderId The id of the folder to toggle.
     */
    public toggleSelectedFolder( folderId: string ): void {
        this.selectedFolderId = this.selectedFolderId === folderId ? null : folderId;
        this.filterTriggers();
        this.searchTerm = null;
    }









    
    /**
     * Displays the new trigger folder dialog.
     */
    public addTriggerFolderDialog(): void {
        this.dialogService
            .showNewTriggerFolderDialog()
            .subscribe( folder => {
                if ( folder != null ) {
                    
                    let _folders = this.triggerFolders?.length > 0 ? this.triggerFolders : [];
                    
                    _folders.push( folder );

                    this.updateTriggerExpandedState( _folders );
                    this.ipcService
                        .updateTriggerFolders( _folders )
                        .subscribe( folders => {
                            this.updateViewTriggerData( folders );
                        } );
                    
                }
            } );
    }









    
    /**
     * Updates the expanded status on the given folder list based on the 
     * matching tree node on the view.
     * 
     * @param folders The folders to update.
     */
    public updateTriggerExpandedState( folders: TriggerFolder[] ): void {
        for ( let i = 0; i < folders?.length; i++ ) {
            let node = _.find( this.treeControl.dataNodes, f => f.folderId === folders[i].folderId );
            folders[ i ].expanded = this.treeControl.isExpanded( node );
            this.updateTriggerExpandedState( folders[ i ].children );
        }
    }









    
    /**
     * Toggles the expanded state of the folders tree as a whole.
     */
    public toggleTree(): void {
        if ( this._treeExpanded ) {
            this.treeControl.collapseAll();
            this._treeExpanded = false;
        } else {
            this.treeControl.expandAll();
            this._treeExpanded = true;
        }
    }









    
    /**
     * Checks all tree nodes and updates the tree expanded boolean to true if 
     * all nodes are expanded.
     */
    public updateExpandStatus(): void {
        let allExpanded: boolean = true;
        this.treeControl.dataNodes.forEach( f => {
            allExpanded = !f.expandable || this.treeControl.isExpanded( f ) ? allExpanded : false;
        } );

        this._treeExpanded = allExpanded;
    }









    
    /**
     * Submits the trigger folders to the database for storage.
     */
    public updateTriggerFolders(): void {
        this.updateTriggerExpandedState( this.triggerFolders );
        this.ipcService.updateTriggerFolders( this.triggerFolders ).subscribe( folders => {
            this.updateViewTriggerData( folders );
        } );
    }









    
    /**
     * When any tree node is expanded, the state is updated on all folder 
     * models and the trigger folders are saved.
     */
    public onExpand(): void {
        this.updateExpandStatus();
        this.updateTriggerFolders();
    }









    
    /**
     * Expands all nodes with children whose corresponding folder model's 
     * expanded state is true.
     * 
     * @param folders The list of folders to expand.
     */
    public expandFolders(folders: TriggerFolder[]): void {
        for ( let i = 0; i < folders?.length; i++ ) {
            if ( folders[ i ].expanded ) {
                let node = _.find( this.treeControl.dataNodes, f => f.folderId === folders[ i ].folderId );
                this.treeControl.expand( node );
                this.expandFolders( folders[ i ].children );
            }
        }
    }









    
    /**
     * Allows the user to select a new parent folder for the specified child.
     * 
     * @param sourceFolderId The id of the folder to parent.
     */
    public selectParentFolder( sourceFolderId?: string ): void {
        this.dialogService.showSelectTriggerFolderDialog( sourceFolderId ).subscribe( targetFolderId => {
            if ( sourceFolderId && targetFolderId && sourceFolderId != targetFolderId ) {
                let node = _.find( this.treeControl.dataNodes, f => f.folderId === targetFolderId );
                this.treeControl.expand( node );
                this.moveFolder( sourceFolderId, targetFolderId );
            } else if ( sourceFolderId && targetFolderId && sourceFolderId === targetFolderId ) {
                let folder = this.detatchFolder( this.triggerFolders, sourceFolderId );
                this.triggerFolders.push( folder );
                this.updateTriggerFolders();
            }
        } );
    }









    
    /**
     * Allows the user to select a new folder for the given trigger.
     * 
     * @param trigger The trigger to parent.
     */
    public selectTriggerFolder( trigger: TriggerModel ): void {
        this.dialogService.showSelectTriggerFolderDialog().subscribe( targetFolderId => {
            if ( targetFolderId ) {
                let oldFolderId = trigger.folderId;
                trigger.folderId = targetFolderId;
                this.ipcService.updateTrigger( trigger ).subscribe( updated => {
                    if ( updated ) {
                        // We're done here.
                    } else {
                        trigger.folderId = oldFolderId;
                        this.snackBar.open( 'Could not update trigger!', 'Dismiss', { duration: 5000 } );
                    }
                } );
            }
        } );
    }









    
    /**
     * Moves the specified folder to the specified parent.
     * 
     * @param sourceFolderId The id of the folder to move.
     * @param targetFolderId The id of the destination folder.
     */
    public moveFolder( sourceFolderId: string, targetFolderId: string ) {
        let folder = this.detatchFolder( this.triggerFolders, sourceFolderId );
        this.attachFolder( this.triggerFolders, folder, targetFolderId );
        this.updateTriggerFolders();
    }









    
    /**
     * Moves the specified folder to the specified parent in the given list of 
     * folders.
     * 
     * @param folders The list of all folders.
     * @param sourceFolder The folder to be moved.
     * @param targetFolderId The id of the destination folder.
     */
    private attachFolder( folders: TriggerFolder[], sourceFolder: TriggerFolder, targetFolderId: string ): void {
        let index = -1;
        for ( let i = 0; i < folders.length; i++ ) {
            if ( folders[ i ].folderId === targetFolderId ) {
                index = i;
                break;
            } else if ( folders[ i ].children != null && folders[ i ].children.length > 0 ) {
                this.attachFolder( folders[ i ].children, sourceFolder, targetFolderId );
            }
        }

        if ( index > -1 ) {
            folders[ index ].children = folders[ index ].children?.length > 0 ? folders[ index ].children : [];
            folders[ index ].children.push( sourceFolder );
        }
    }









    
    /**
     * Removes the specified folder from the parent folder.
     * 
     * @param folders The list of all folders.
     * @param folderId The id of the folder to detatch from the model.
     */
    private detatchFolder( folders: TriggerFolder[], folderId: string ): TriggerFolder {
        let index = -1;
        for ( let i = 0; i < folders.length; i++ ) {
            if ( folders[ i ].folderId === folderId ) {
                index = i;
                break;
            } else if ( folders[ i ].children != null && folders[ i ].children.length > 0 ) {
                let folder = this.detatchFolder( folders[ i ].children, folderId );
                if ( folder )
                    return folder;
            }
        }

        if ( index > -1 ) {
            return folders.splice( index, 1 )[ 0 ];
        }
    }










    /**
     * Shows the delete trigger dialog allowing the user to delete the trigger.
     * 
     * @param triggerId The id of the desired trigger.
     */
    public deleteTrigger( triggerId: string ): void {
        
        let index: number = this.triggers.findIndex( trigger => trigger.triggerId === triggerId );

        this.dialogService.showConfirmDialog(
            `Are you sure you want to delete ${this.triggers[ index ].name}?`,
            'Click "Yes" to delete this trigger.', 'Click "No" to close this dialog without deleting this trigger.',
            confirmed => {
                if ( confirmed === true ) {
                    this.ipcService.deleteTrigger( this.triggers[ index ].triggerId ).subscribe();
                }
            } );
    }










    /**
     * Updates the trigger folder data used in the view.
     * 
     * @param folders The updated list of trigger folders.
     */
    private updateViewTriggerData(folders: TriggerFolder[]): void {
        
        this.triggerFolders = folders;
        this.dataSource.data = folders;
        this.expandFolders( folders );
        this.updateExpandStatus();

    }









    
    /**
     * Opens the input dialog to allow the user to input a new name for the 
     * specified folder.
     * 
     * @param folderId The id of the desired folder.
     * @param name The current name of the folder.
     */
    public renameFolder( folderId: string, name: string ): void {
        this.dialogService.showInputDialog( 'Rename folder', [ `Please enter a new name for the ${name} folder.` ], 'Folder name' ).subscribe( name => {
            if ( name ) {
                this._renameFolder( this.triggerFolders, folderId, name, );
                this.updateTriggerFolders();
            }
        } );
    }










    /**
     * Updates the specified folder with the given name.
     * 
     * @param folders The list of folders to search.
     * @param folderId The id of the desired folder.
     * @param name The new name for the folder.
     */
    private _renameFolder( folders: TriggerFolder[], folderId: string, name: string ): void {
        for ( let i = 0; i < folders.length; i++ ) {
            if ( folders[ i ].folderId === folderId ) {
                folders[ i ].name = name;
                break;
            } else if ( folders[ i ].children?.length > 0 ) {
                this._renameFolder( folders[ i ].children, folderId, name );
            }
        }
    }










    /**
     * Shows the delete folder dialog allowing the user to delete the trigger 
     * folder.
     * 
     * @param folderId The id of the desired folder.
     * @param name The name of the folder.
     */
    public deleteFolder( folderId: string, name: string ): void {
        this.dialogService.showConfirmDialog(
            [ `Are you sure you want to delete ${name}?`, `This will remove all triggers from this folder and all descendants, leaving those triggers ungrouped.` ],
            `Click "Yes" to delete ${name}.`, 'Click "No" to close this dialog without deleting the folder.',
            confirmed => {
                if ( confirmed === true ) {
                    this._deleteFolder( this.triggerFolders, folderId );
                    this.updateTriggerFolders();
                }
            } );
    }
    









    /**
     * Deletes the specified folder.
     * 
     * @param folders The list of folders to search.
     * @param folderId The id of the folder to delete.
     */
    private _deleteFolder( folders: TriggerFolder[], folderId: string ): void {
        for ( let i = 0; i < folders.length; i++ ) {
            if ( folders[ i ].folderId === folderId ) {
                
                // Remove the folder from the list.
                folders.splice( i, 1 );
                
                // Remove any existing folders.
                this._removeFolderTriggers( this.triggerFolders, folderId );

                // We're done here.
                break;

            } else if ( folders[ i ].children?.length > 0 ) {
                this._deleteFolder( folders[ i ].children, folderId );
            }
        }
    }










    /**
     * Removes all triggers from the given folder and all descendant folders.
     * 
     * @param folders The list of folders to search.
     * @param folderId The id of the folder to evacuate triggers out of.
     */
    private _removeFolderTriggers( folders: TriggerFolder[], folderId: string ): void {

        this.triggers.forEach( trigger => trigger.folderId = trigger.folderId === folderId ? null : trigger.folderId );
        this.filterTriggers();
        this.searchTerm = null;

        // Find the folder and if the folder has children, then remove the 
        // triggers from all descendants.
        for ( let i = 0; i < folders.length; i++ ) {
            if ( folders[ i ].folderId === folderId ) {

                if ( folders[ i ].children?.length > 0 ) {
                    folders[ i ].children.forEach( child => this._removeFolderTriggers( folders[ i ].children, child.folderId ) );
                }

                // We're done here.
                break;

            }
        }
        
    }

    public moveAllTriggersInFolder( folderId: string ): void {
        this.dialogService.showSelectTriggerFolderDialog().subscribe( targetFolderId => {
            if ( targetFolderId ) {
                this.triggers.forEach( trigger => {
                    if ( trigger.folderId === folderId ) {
                        trigger.folderId = targetFolderId;
                    }
                } );
                this.ipcService
                    .updateTriggers( this.triggers )
                    .subscribe( failed => {
                        if ( failed?.length > 0 ) {
                            let failedNames: string[] = _.map( failed, trigger => trigger.name );
                            failedNames.unshift( 'The following triggers failed to update.', '' );
                            this.dialogService.showWarningDialog( 'Warning!', failedNames );
                        }
                    } );
            }
        } );
    }










    /**
     * Searches the trigger store for triggers that match the current search 
     * query.
     */
    public searchTriggers(): void {
        let folderIds = this.selectedFolderId == null ? null : this.getFolderLineageIds( this.selectedFolderId, this.triggerFolders );
        if ( this.searchTerm ) {
            this.ipcService
                .searchTriggers( this.searchTerm, folderIds )
                .subscribe( results => {
                    this.triggerSearchResults = results;
                    this.filteredTriggers = results;
                } );
        } else {
            this.filterTriggers();
        }
    }










    /** 
     * Filters the triggers by selected folder.
     */
    private filterTriggers(): void {
        if ( this.selectedFolderId ) {
            let folderIds = this.getFolderLineageIds( this.selectedFolderId, this.triggerFolders );
            this.filteredTriggers = _.sortBy( this.triggers.filter( trigger => folderIds.indexOf( trigger.folderId ) > -1 ), trigger => trigger.name );
            
        } else {
            this.filteredTriggers = this.triggers.slice();
        }
    }










    /**
     * Returns a flat array of the specified folder id and all descendent folder ids.
     * 
     * @param folderId The id of the desired folder ancestor.
     * @param folders The list of folders to query.
     */
    private getFolderLineageIds( folderId: string, folders: TriggerFolder[] ): string[] {
        
        for ( let i = 0; i < folders?.length; i++ ) {

            if ( folders[ i ].folderId === folderId ) {
                return this.getAllFolderIds( folders[ i ] );
                
            } else if ( folders[ i ]?.children?.length > 0 ) {
                let d = this.getFolderLineageIds( folderId, folders[ i ].children );
                
                if ( d?.length > 0 ) {
                    return d;
                }

            }

        }

    }










    /**
     * Returns a flat array of the given folder and all descendent folder ids.
     * 
     * @param folder The parent folder.
     */
    private getAllFolderIds( folder: TriggerFolder ): string[] {
        let ids = [ folder.folderId ];

        for ( let i = 0; i < folder.children?.length; i++ ) {
            ids = ids.concat( this.getAllFolderIds( folder.children[ i ] ) );
        }

        return ids;
    }










    /**
     * Returns a flat list of folders, starting with the child, and moving up 
     * the heirarchy to return the entire line of folders.
     * 
     * @param folderId The desired child folder id.
     * @param folders The list of folders to query.
     * @param ids The current list of folder ids.
     */
    private getFolderFamilyIds( folderId: string, folders: TriggerFolder[], ids: string[] ): string[] {
        
        for ( let i = 0; i < folders?.length; i++ ) {
            if ( folders[ i ].folderId === folderId ) {
                return ids.concat( [ folders[ i ].folderId ] );
            } else if ( folders[ i ]?.children?.length > 0 ) {
                let d = this.getFolderFamilyIds( folderId, folders[ i ].children, ids.concat( [ folders[ i ].folderId ] ) );
                if ( d?.length > 0 ) {
                    return d;
                }
            }
        }
    }










    /**
     * Returns a context menu definition for the specified folder.
     * 
     * @param folderId The id of the folder.
     */
    public getFolderContextMenu( folderId: string, name: string ): ContextMenuModel[] {
        return [ <ContextMenuModel>{
            label: 'Rename',
            action: () => this.renameFolder( folderId, name ),
            disabled: () => false,
            hide: () => false,
            matIcon: 'label',
        }, {
            label: 'Change parent',
            action: () => this.selectParentFolder( folderId ),
            disabled: () => false,
            hide: () => false,
            matIcon: 'folder_open',
        }, {
            label: 'Move all triggers',
            action: () => this.moveAllTriggersInFolder( folderId ),
            disabled: () => false,
            hide: () => false,
            matIcon: 'folder_open',
        }, <ContextMenuModel>{
            label: '-',
            action: () => { },
            disabled: () => false,
            hide: () => false,
            // matIcon: 'content_paste',
        }, <ContextMenuModel>{
            label: 'Delete Folder',
            action: () => this.deleteFolder( folderId, name ),
            disabled: () => false,
            hide: () => false,
            matIcon: 'clear',
        } ];
    }










    /**
     * Returns a context menu definition for the specified folder.
     * 
     * @param folderId The id of the folder.
     */
    public getTriggerContextMenu( trigger: TriggerModel, index: number ): ContextMenuModel[] {
        return [ <ContextMenuModel>{
            label: 'Edit',
            action: () => this.showEditTriggerDialog( trigger.triggerId ),
            disabled: () => false,
            hide: () => false,
            matIcon: 'edit',
        }, {
            label: 'Change parent',
            action: () => this.selectTriggerFolder( trigger ),
            disabled: () => false,
            hide: () => false,
            matIcon: 'folder_open',
        }, <ContextMenuModel>{
            label: '-',
            action: () => { },
            disabled: () => false,
            hide: () => false,
            // matIcon: 'content_paste',
        }, <ContextMenuModel>{
            label: 'Delete Trigger',
            action: () => this.deleteTrigger( trigger.triggerId ),
            disabled: () => false,
            hide: () => false,
            matIcon: 'clear',
        } ];
    }
}
