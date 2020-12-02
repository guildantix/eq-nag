import { FlatTreeControl } from '@angular/cdk/tree';
import { Component, OnInit } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTreeFlatDataSource, MatTreeFlattener } from '@angular/material/tree';
import { TriggerFolder, TriggerModel } from '../core.model';
import { DialogService } from '../dialogs/dialog.service';
import { IpcService } from '../ipc.service';
import * as _ from 'lodash';
import { ContextMenuModel } from '../context-menu/context-menu.model';

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

    private _transformer = ( node: TriggerFolder, level: number ) => {
        return {
            expandable: !!node.children && node.children.length > 0,
            name: node.name,
            level: level,
            active: node.active,
            // selected: node.selected,
            selected: false,
            folderId: node.folderId,
            expanded: node.expanded,
        };
    }
    public treeControl = new FlatTreeControl<FolderTreeNode>( node => node.level, node => node.expandable );
    public treeFlattener = new MatTreeFlattener(this._transformer, node => node.level, node => node.expandable, node => node.children);
    public dataSource = new MatTreeFlatDataSource(this.treeControl, this.treeFlattener);
    hasChild = ( _: number, node: FolderTreeNode ) => node.expandable;
    public triggers: TriggerModel[] = [];
    public isDev: boolean = false;

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
            this.triggers = _.filter( tick.triggers, f => this.isDev || !f.predefined );
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
        this.ipcService.showNewTriggerDialog();
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
     * Displays the new trigger folder dialog.
     */
    public addTriggerFolderDialog(): void {
        this.dialogService
            .showNewTriggerFolderDialog()
            .subscribe( folder => {
                console.log( 'folder', folder );
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
     * @param index The index of the trigger in the list.
     */
    public deleteTrigger( index: number ): void {
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

    public getContextMenu( folderId: string ): ContextMenuModel[] {
        return [ <ContextMenuModel>{
            label: 'Rename',
            action: () => { },
            disabled: () => false,
            hide: () => false,
            matIcon: 'label',
        }, {
            label: 'Change parent',
            action: () => this.selectParentFolder( folderId ),
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
            action: () => { },
            disabled: () => false,
            hide: () => false,
            matIcon: 'clear',
        } ];
    }
}
