import { FlatTreeControl } from '@angular/cdk/tree';
import { Component, ElementRef, HostListener, NgZone, OnInit, ViewChild } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTreeFlatDataSource, MatTreeFlattener } from '@angular/material/tree';
import { Tag, TriggerFolder, TriggerModel } from '../core.model';
import { DialogService } from '../dialogs/dialog.service';
import { IpcService } from '../ipc.service';
import * as _ from 'lodash-es';
import { ContextMenuModel } from '../context-menu/context-menu.model';
import { MatTable } from '@angular/material/table';
import { customAlphabet } from 'nanoid';
import { TableVirtualScrollDataSource } from 'ng-table-virtual-scroll';
import { CdkVirtualScrollViewport } from '@angular/cdk/scrolling';
import { BehaviorSubject } from 'rxjs';
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const nanoid = customAlphabet( alphabet, 16 );

interface FolderTreeNode {
    expandable: boolean;
    name: string;
    level: number;
    folderId: string;
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
    public processing: boolean = false;

    private _indexRecords: number = 0;
    private _maxRecords: number = 0;
    private _filteredRecords: TriggerModel[] = [];
    public dataSourceTest: BehaviorSubject<TriggerModel[]> = new BehaviorSubject<TriggerModel[]>( [] );
    
    public get filteredTriggers(): TriggerModel[] {
        return this._filteredRecords;
    }
    public set filteredTriggers( value: TriggerModel[] ) {
        
        this._indexRecords = 0;
        this._maxRecords = value?.length ?? 0;
        let take = this._maxRecords < 30 ? this._maxRecords : 30;
        this._indexRecords = take;

        this.triggersTable.renderRows();
        this._filteredRecords = value;
        this._tableDataSource = new TableVirtualScrollDataSource( this._filteredRecords.slice( 0, this._indexRecords ) );

        this.dataSourceTest.next( this._filteredRecords.slice( 0, this._indexRecords ) );
    }

    private _tableDataSource: TableVirtualScrollDataSource<TriggerModel> = new TableVirtualScrollDataSource<TriggerModel>([]);
    public get tableDataSource(): TableVirtualScrollDataSource<TriggerModel> {
        return this._tableDataSource;
    };

    public isDev: boolean = false;
    public triggerSearchResults: TriggerModel[] = [];
    public searchTerm: string = null;
    @ViewChild( 'triggersTable' ) triggersTable: MatTable<TriggerModel>;
    @ViewChild( 'triggerScroller', { static: true } ) triggerScroller: CdkVirtualScrollViewport;

    public get allExpanded(): boolean {
        return this._treeExpanded;
    }

    private _treeExpanded: boolean = false;
    private triggerFolders: TriggerFolder[] = [];
    
    constructor(
        private snackBar: MatSnackBar,
        private ipcService: IpcService,
        private dialogService: DialogService,
        private ngZone: NgZone ) {
        
        this.dataSource.data = [];

    }

    ngOnInit() {

        this.triggerScroller.elementScrolled().subscribe( e => {
            this.ngZone.run( () => {
                
                let elRef = ( this.triggersTable as any )._elementRef as ElementRef<HTMLTableElement>;
                let remainingScroll = elRef.nativeElement.clientHeight - this.triggerScroller.elementRef.nativeElement.scrollTop - this.triggerScroller.elementRef.nativeElement.clientHeight;
                if ( remainingScroll <= 0 ) {
                
                    this._indexRecords += 10;
                    this._indexRecords = this._indexRecords > this._maxRecords ? this._maxRecords : this._indexRecords;
                
                    this._tableDataSource = new TableVirtualScrollDataSource( this._filteredRecords.slice( 0, this._indexRecords ) );
                    this.dataSourceTest.next( this._filteredRecords.slice( 0, this._indexRecords ) );
                
                    this.triggersTable.renderRows();

                }
            } );
        } );

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
        this.dialogService.showNewDotTimerDialog( this.selectedFolderId );
    }









    
    /**
     * Displays the new dot timer wizard dialog.
     */
    public showNewRaidAbilityDialog(): void {
        this.dialogService.showNewRaidAbilityDialog( this.selectedFolderId );
    }









    
    /**
     * Displays the new dot timer wizard dialog.
     */
    public showNewBuffTimerDialog(): void {
        this.dialogService.showNewBuffTimerDialog( this.selectedFolderId );
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
     * 
     * 
     * @param parentFolderId If provided, this is the id of the parent folder.
     */
    public addTriggerFolderDialog( parentFolderId?: string ): void {
        
        parentFolderId = parentFolderId ? parentFolderId : this.selectedFolderId;

        this.dialogService
            .showNewTriggerFolderDialog()
            .subscribe( folder => {
                if ( folder != null ) {
                    let folderId = nanoid();
                    
                    let _folders = this.triggerFolders?.length > 0 ? this.triggerFolders : [];
                    folder.folderId = folderId;
                    _folders.push( folder );

                    this.updateTriggerExpandedState( _folders );
                    this.ipcService
                        .updateTriggerFolders( _folders )
                        .subscribe( folders => {

                            this.updateViewTriggerData( folders );

                            if ( parentFolderId ) {
                                let node = _.find( this.treeControl.dataNodes, f => f.folderId === parentFolderId );
                                this.treeControl.expand( node );
                                this.moveFolder( folderId, parentFolderId );
                            }

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
     * Toggles the trigger's enabled state and saves the change.
     * 
     * @param trigger The trigger.
     */
    public toggleEnabled( trigger: TriggerModel ): void {
        trigger.enabled = !trigger.enabled;

        this.ipcService.updateTrigger( trigger ).subscribe( updated => {
            if ( !updated ) {
                this.snackBar.open( 'Could not update trigger!', 'Dismiss', { duration: 5000 } );
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
            [ `Are you sure you want to delete ${name}?`, `This will remove all triggers from this folder and all descendants, permanently deleting them.` ],
            `Click "Yes" to delete ${name}.`, 'Click "No" to close this dialog without deleting the folder.',
            confirmed => {
                if ( confirmed === true ) {
                    this.processing = true;
                    if ( this.selectedFolderId === folderId ) {
                        this.selectedFolderId = null;
                    }
                    this._deleteFolder( this.triggerFolders, folderId );
                    this.updateTriggerFolders();
                    this.ipcService.updateTriggers( this.triggers ).subscribe( failed => this.processing = false );
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

                this._deleteFolderTriggers( folders[ i ] );

                // Remove the folder from the list, also removing all descendants.
                folders.splice( i, 1 );
                
                // We're done here.
                break;

            } else if ( folders[ i ].children?.length > 0 ) {
                this._deleteFolder( folders[ i ].children, folderId );
            }
        }
    }









    
    /**
     * Removes all triggers for the given folder, and all triggers in the folder descendants.
     * 
     * @param folder The folder to remove.
     */
    private _deleteFolderTriggers( folder: TriggerFolder ) {
        this.triggers = this.triggers.filter( f => f.folderId !== folder.folderId );

        if ( folder.children?.length > 0 ) {
            folder.children.forEach( child => this._deleteFolderTriggers( child ) );
        }
    }










    /**
     * Removes all triggers from the given folder and all descendant folders.
     * 
     * @param folders The list of folders to search.
     * @param folderId The id of the folder to evacuate triggers out of.
     */
    private _removeFolderTriggers( folders: TriggerFolder[], folderId: string ): void {

        this.triggers.forEach( trigger => trigger.folderId = ( trigger.folderId === folderId ? null : trigger.folderId ) );
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
     * Returns the family name of the given trigger.  If the trigger's folder is the currently selected folder, returns null.
     * 
     * @example May return "\Raids\OoW\Anguish\OMM"
     * 
     * @param trigger The trigger.
     */
    public getTriggerFamily( trigger: TriggerModel ): string {
        if ( this.selectedFolderId == null || trigger.folderId === this.selectedFolderId ) {
            return '';
        } else {
            let folders = this.findFolderById( this.selectedFolderId ).children;
            let folderFamilyNames = this.getFolderFamilyNames( trigger.folderId, folders, [] );
            if ( folderFamilyNames?.length > 0 ) {
                let name = `\\${folderFamilyNames[ 0 ]}`;
                for ( let i = 1; i < folderFamilyNames.length; i++ ) {
                    name += `\\${folderFamilyNames[i]}`;
                }
                return name;
            } else {
                return null;
            }
        }
    }










    /**
     * Returns an array of names, starting from root to specified child, of folder names.
     * 
     * @example This may return ["Omens of War","Asylum of Anguish","Overlord Mata Muram"], if you have the Omens of war selected and the target folder is OMM.
     * 
     * @param folderId The desired descendent folder id.
     * @param folders The hierarchy of folders that contains the desired descendent.
     * @param names The array of names.
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
     * Recursively searches for a trigger folder with the given id.
     * 
     * @param folderId The id of the folder.
     * @param search The current list of folders to search.
     * @returns Returns the found folder, or undefined if not found.
     */
    private findFolderById( folderId: string, search: TriggerFolder[] = null ): TriggerFolder {
        search = search ? search : this.triggerFolders;

        for ( let i = 0; i < search?.length; i++ ) {
            let folder = search[ i ].folderId === folderId ? search[ i ] : this.findFolderById( folderId, search[ i ].children );

            if ( folder ) {
                return folder;
            }
        }

    }









    
    /**
     * Returns a list of all descendant triggers for the given folder.
     * 
     * @param folder The desired trigger folder.
     * @param triggers The current list of all descendant triggers.
     */
    private getDescendantTriggers( folder: TriggerFolder, triggers: TriggerModel[] = null ): TriggerModel[] {
        triggers = triggers ? triggers : [];

        // Pull in all the indirect descendants.
        folder.children.forEach( f => triggers = triggers.concat( this.getDescendantTriggers( f, triggers ) ) );

        // Pull in all the direct descendants.
        triggers = triggers.concat( this.triggers.filter( f => f.folderId === folder.folderId ) );
        
        return triggers;
    }










    /**
     * Selects all descendant triggers, and sends them to the quick share 
     * dialog.
     * 
     * @param folderId The id of the folder.
     */
    private quickShareFolder( folderId: string ): void {
        let folder = this.findFolderById( folderId );
        let descendantTriggers = this.getDescendantTriggers( folder );
        
        this.dialogService.showPrepareQuickShareDialog( descendantTriggers, [ folder ] ).subscribe( quickShareId => { } );
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
            matIcon: 'sort',
        }, {
            label: 'New sub-folder',
            action: () => this.addTriggerFolderDialog( folderId ),
            disabled: () => false,
            hide: () => false,
            matIcon: 'add',
        }, {
            label: 'Move all triggers',
            action: () => this.moveAllTriggersInFolder( folderId ),
            disabled: () => false,
            hide: () => false,
            matIcon: 'label_important',
        }, <ContextMenuModel>{
            label: '-',
            action: () => { },
            disabled: () => false,
            hide: () => false,
            // matIcon: 'content_paste',
        }, {
            label: 'Quick Share',
            action: () => this.quickShareFolder( folderId ),
            disabled: () => false,
            hide: () => false,
            matIcon: 'publish',
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
            matIcon: 'sort',
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

    openTriggerLibrary() {
        this.ipcService.showTriggerLibrary().subscribe( opened => { } );
    }
}
