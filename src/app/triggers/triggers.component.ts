import { FlatTreeControl } from '@angular/cdk/tree';
import { Component, ElementRef, HostListener, NgZone, OnInit, ViewChild } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTreeFlatDataSource, MatTreeFlattener } from '@angular/material/tree';
import { DeathRecapPreferences, ExternalDataSources, QuickShareFileModel, QuickShareMetaModel, Tag, TriggerFolder, TriggerModel } from '../core.model';
import { DialogService } from '../dialogs/dialog.service';
import { IpcService } from '../ipc.service';
import * as _ from 'lodash-es';
import { ContextMenuModel } from '../context-menu/context-menu.model';
import { MatTable } from '@angular/material/table';
import { customAlphabet } from 'nanoid';
import { TableVirtualScrollDataSource } from 'ng-table-virtual-scroll';
import { CdkVirtualScrollViewport } from '@angular/cdk/scrolling';
import { BehaviorSubject, forkJoin, Observable, timer } from 'rxjs';
import { TriggerLibraryService } from '../windows/trigger-library.service';
import { QuickShareService } from '../core/quick-share.service';
import { FolderConditionsDialogComponent } from './folder-conditions-dialog/folder-conditions-dialog.component';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
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
    private restoreFolderHierarchyTimeoutId: number | null = null;
    public restoreFolderHierarchy: () => void | null = null;
    private folderMap: Record<string, string> = {};

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

    public deathRecapPreferences: DeathRecapPreferences = null;
    
    constructor(
        private readonly snackBar: MatSnackBar,
        private readonly ipcService: IpcService,
        private readonly dialogService: DialogService,
        private readonly ngZone: NgZone,
        private readonly libraryService: TriggerLibraryService,
        private readonly quickShareService: QuickShareService,
        private readonly dialog: MatDialog,
    ) {
        
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
            let searchTerm = this.searchTerm;
            this.triggers = tick.triggers.filter( f => this.isDev || !f.predefined );
            this.updateViewTriggerData( tick.folders );
            this.toggleSelectedFolder( null );
            if ( searchTerm ) {
                this.searchTerm = searchTerm;
                this.searchTriggers();
            } 
            
        } );

        this.ipcService.getDeathRecapPreferences().subscribe( recapPrefs => this.deathRecapPreferences = recapPrefs ?? null );
        this.ipcService.getAppIsDev().subscribe( isDev => this.isDev = isDev );
        this.ipcService.getTriggerFolders().subscribe( folders => {
            this.updateViewTriggerData( folders );
        } );

    }









    
    /**
     * Recursively expands the given folder, and it's parents.
     * 
     * @param folderId The id of the folder to expand.
     */
    private expandParents( folderId: string ): void {
        let node = this.treeControl.dataNodes.find( f => f.folderId === folderId );
        this.treeControl.expand( node );
        let parentId = this.folderMap[ folderId ];
        if ( parentId ) {
            this.expandParents( parentId );
        }
    }









    
    /**
     * If the user has not selected a folder, the user will be presented with 
     * the folder select dialog.  After a selection has been made, or if a 
     * folder has already been selected, then the observable is resolved and 
     * completed.
     * 
     * @param title The title of the dialog.
     * @param description The message to display to the user if the dialog is shown.
     */
    private requireFolderSelect( title?: string, description?: string ): Observable<void> {
        let obs = new Observable<void>( sub => {
            
            if ( !this.selectedFolderId ) {
                this.dialogService.showSelectTriggerFolderDialog( null, title, description ).subscribe( folderId => {
                    if ( this.selectedFolderId !== folderId ) {
                        this.expandParents( folderId );
                        this.toggleSelectedFolder( folderId );
                    }
                    sub.next();
                    sub.complete();
                } );
            } else {
                sub.next();
                sub.complete();
            }

        } );
        return obs;
    }









    
    /**
     * Displays the new trigger dialog.
     */
    public showNewTriggerDialog(): void {
        this.requireFolderSelect( 'Select a Folder', 'What folder would you like to put this trigger in?' ).subscribe( () => {
            this.ipcService.showNewTriggerDialog( this.selectedFolderId );
        } );
    }









    
    /**
     * Displays the new dot timer wizard dialog.
     */
    public showNewDotTimerDialog(): void {
        this.requireFolderSelect( 'Select a Folder', 'What folder would you like to put this trigger in?' ).subscribe( () => {
            this.dialogService.showNewDotTimerDialog( this.selectedFolderId, ExternalDataSources.Allakhazam );
        } );
    }










    /**
     * Displays the eq dot timer import for eq spell resources.
     */
    public showNewDotTimerEqsrDialog(): void {
        this.requireFolderSelect( 'Select a Folder', 'What folder would you like to put this trigger in?' ).subscribe( () => {
            this.dialogService.showNewDotTimerDialog( this.selectedFolderId, ExternalDataSources.EqSpellResources );
            // this.ipcService.scrapeEqSpellResourceSpell( 'https://spells.eqresource.com/spells.php?id=1447' ).subscribe( spell => console.log( '!!!!! RETURNED', spell ) );
        } );
    }









    
    /**
     * Displays the new dot timer wizard dialog.
     */
    public showNewBuffTimerEqsrDialog(): void {
        this.requireFolderSelect( 'Select a Folder', 'What folder would you like to put this trigger in?' ).subscribe( () => {
            this.dialogService.showNewBuffTimerDialog( this.selectedFolderId, ExternalDataSources.EqSpellResources );
        } );
    }









    
    /**
     * Displays the new dot timer wizard dialog.
     */
    public showNewRaidAbilityDialog(): void {
        this.requireFolderSelect( 'Select a Folder', 'What folder would you like to put this trigger in?' ).subscribe( () => {
            this.dialogService.showNewRaidAbilityDialog( this.selectedFolderId );
        } );
    }









    
    /**
     * Displays the new dot timer wizard dialog.
     */
    public showNewBuffTimerDialog(): void {
        this.requireFolderSelect( 'Select a Folder', 'What folder would you like to put this trigger in?' ).subscribe( () => {
            this.dialogService.showNewBuffTimerDialog( this.selectedFolderId, ExternalDataSources.Allakhazam );
        } );
    }









    
    /**
     * Copies the death recap hotbutton to the clipboard.
     */
    public copyDeathRecapHotkey(): void {
        this.copyHotkey( '/hot "Death Recap" /em wonders how they died.' );
    }









    
    /**
     * Copies the clear all hotbutton to the clipboard.
     */
    public copyClearAllHotkey(): void {
        this.copyHotkey( '/hot "Clear All" /em clears their mind.' );
    }









    
    /**
     * Copies the given hot button text to the clipboard and tells the user it's 
     * ready for use.
     * 
     * @param hotkeyText The hotbutton text to copy to the clipboard.
     */
    public copyHotkey( hotkeyText: string ): void {
        this.ipcService.sendTextToClipboard( hotkeyText );

        this.snackBar.open( 'The command has been copied to your clipboard!', 'Dismiss', { duration: 5000 } );
        this.dialogService.showInfoDialog( 'Hotkey Help', [ 'The command to create the hotkey has been copied to your clipboard.', 'Paste the command into EverQuest and hit "Enter" to create the hotkey and then place it into your hotbar.' ], 'normal', 'triggers-component:copy-hotkey:success-modal' );
    }









    
    /**
     * Opens the log simulation modal.
     */
    public showSimLogEntry(): void {
        this.ipcService.showLogSimulator().subscribe( () => {} );
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
        this.selectedFolderId = this.selectedFolderId === folderId ? null : folderId === null ? this.selectedFolderId : folderId;
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
    private updateViewTriggerData( folders: TriggerFolder[] ): void {
        this.selectedFolderId = this.folderExistsRecursive( folders, this.selectedFolderId ) ? this.selectedFolderId : null;
        this.folderMap = TriggerFolder.getFolderAncestryMap( folders );
        this.triggerFolders = folders;
        this.dataSource.data = folders;
        this.expandFolders( folders );
        this.updateExpandStatus();

    }










    /**
     * Returns true if the given folder id exists in the hierarchy.
     * 
     * @param folders The list of folders to search.
     * @param folderId The id of the desired folder.
     */
    private folderExistsRecursive( folders: TriggerFolder[], folderId: string ): boolean {
        let exists = false;
        for ( let i = 0; i < folders.length; i++ ) {
            if ( folders[ i ].folderId === folderId ) {
                exists = true;
                break;
            } else if ( folders[ i ].children?.length > 0 ) {
                exists = this.folderExistsRecursive( folders[ i ].children, folderId );
                if ( exists ) {
                    break;
                }
            }
        }
        return exists;
    }









    
    /**
     * Opens the input dialog to allow the user to input a new name for the 
     * specified folder.
     * 
     * @param folderId The id of the desired folder.
     * @param name The current name of the folder.
     */
    public renameFolder( folderId: string, folderName: string ): void {
        this.dialogService.showInputDialog( 'Rename folder', [ `Please enter a new name for the ${folderName} folder.` ], 'Folder name', 'Enter a new name for the folder', folderName ).subscribe( newName => {
            if ( newName ) {
                this._renameFolder( this.triggerFolders, folderId, newName );
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
            this.filteredTriggers = _.sortBy( this.triggers.filter( trigger => folderIds?.indexOf( trigger.folderId ) > -1 ), trigger => trigger.name );
            
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
     * Find's the specified folder's parent.  Returns null if the given folder is a root folder.
     * 
     * @param folderId The id of the folder.
     * @param searchFolder The current folder to search.
     */
    private findFolderParent( folderId: string, searchFolder: TriggerFolder|null = null ): TriggerFolder|null {

        if ( searchFolder == null ) {
            
            for ( let i = 0; i < this.triggerFolders?.length; i++ ) {
                if ( this.triggerFolders[ i ].folderId === folderId ) {
                    return null;
                }
            }
            
            for ( let i = 0; i < this.triggerFolders?.length; i++ ) {
                let parentq = this.findFolderParent( folderId, this.triggerFolders[ i ] );
                if ( parentq ) {
                    return parentq;
                }
            }

        } else if ( searchFolder.children?.length > 0 ) {
            
            for ( let i = 0; i < searchFolder.children?.length; i++ ) {
                if ( searchFolder.children[ i ].folderId === folderId ) {
                    return searchFolder;
                }
            }

            for ( let i = 0; i < searchFolder.children?.length; i++ ) {
                let parentq = this.findFolderParent( folderId, searchFolder.children[ i ] );
                if ( parentq ) {
                    return parentq;
                }
            }
        }

    }









    
    /**
     * Returns a list of all descendant triggers for the given folder.
     * 
     * @param folder The desired trigger folder.
     * @param triggers The current list of all descendant triggers.
     */
    private getDescendantTriggers( folder: TriggerFolder ): TriggerModel[] {
        return this._recursiveGetDescendantTriggers( folder );
    }










    /**
     * Recursively searches for all descendant triggers for the given folder and all descendant folders.
     * 
     * @param folder The folder containing the desired triggers.
     */
    private _recursiveGetDescendantTriggers( folder: TriggerFolder ): TriggerModel[] {
        let triggers = this.triggers.filter( f => f.folderId === folder.folderId );

        folder.children.forEach( f => {
            triggers = triggers.concat( this._recursiveGetDescendantTriggers( f ) );
        } );

        return triggers ?? [];
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
     * Selects the specified trigger and sends it to the quick share dialog.
     * 
     * @param triggerId The id of the trigger to share.
     */
    private quickShareTrigger( triggerId: string ): void {
        let trigger = this.triggers.find( f => f.triggerId === triggerId );
        let folder = this.findFolderById( trigger.folderId );
        this.dialogService.showPrepareQuickShareDialog( [ trigger ], [ folder ] ).subscribe( quickShareId => { } );
    }










    /**
     * Creates a restore function that executes the given function.  The given function should return true if the restoration was successful.
     * 
     * @param restoreFn The restore function that will undo changes done, returning true if the restoration was successful.
     * @param timeoutDelayMs The duration to leave the restore button available for click.
     */
    private createFolderHierarchyRestore( restoreFn: () => boolean, timeoutDelayMs: number = 15000, overwriteExistingFn: boolean = false ): void {

        const createTimeout = () => {
            this.restoreFolderHierarchyTimeoutId = window.setTimeout( () => {
                this.restoreFolderHierarchy = null;
            }, timeoutDelayMs );
        }

        if ( overwriteExistingFn === true || this.restoreFolderHierarchy == null ) {
            
            // Create the restore function.
            this.restoreFolderHierarchy = () => {

                // On executing the restore, start by clearing the timeout.
                window.clearTimeout( this.restoreFolderHierarchyTimeoutId );
                this.restoreFolderHierarchyTimeoutId = null;

                // Execute the restore function.
                if ( restoreFn() ) {
                    // If successful, clear the restore function and we're done.
                    this.restoreFolderHierarchy = null;
                } else {
                    // If it fails, then we need to reset the timeout.  The restoreFn function is responsible for displaying errors.
                    createTimeout();
                }
            }

            // If there is already a timeout, cancel it.
            if ( this.restoreFolderHierarchyTimeoutId ) {
                window.clearTimeout( this.restoreFolderHierarchyTimeoutId );
            }

            // Create a timeout that will clear the restore history.
            createTimeout();
        }

    }










    /**
     * Sorts the specified folder and siblings alphabetically.
     * 
     * @param folderId The folder id to sort.
     */
    private sortAlphabetically( folderId: string ): void {

        let parent = this.findFolderParent( folderId );
        let targetFolders = parent == null ? this.triggerFolders : parent.children;

        // Before we operate, let's start by creating a restore point.
        let restorePoint = [].concat( targetFolders );
        this.createFolderHierarchyRestore( () => {
            let restoreParent = this.findFolderParent( folderId );

            // We're either updating the root node or the children property of a node.
            if ( restoreParent == null ) {
                this.triggerFolders = restorePoint;
            } else {
                restoreParent.children = restorePoint;
            }

            this.updateViewTriggerData( this.triggerFolders );
            this.updateTriggerFolders();

            return true;
        } );

        let currentSort = targetFolders.map( f => f?.name ?? '' ).join( '' );
        targetFolders = _.orderBy( targetFolders, [ f => f.name ], [ 'asc' ] );
        if ( currentSort === targetFolders.map( f => f?.name ?? '' ).join( '' ) ) {
            targetFolders = _.orderBy( targetFolders, [ f => f.name ], [ 'desc' ] );
        }

        if ( parent == null ) {
            this.triggerFolders = targetFolders;
        } else {
            parent.children = targetFolders;
        }

        this.updateViewTriggerData( this.triggerFolders );
        this.updateTriggerFolders();
    }










    /**
     * Moves the given folder up or down in the parent's folder list, based on the given direction.
     * 
     * @param folderId The desired folder to move.
     * @param direction The direction of movement.
     */
    private translateFolder( folderId: string, direction: number ): void {
        let parent = this.findFolderParent( folderId );
        let targetFolders = parent == null ? this.triggerFolders : parent.children;
        let i = targetFolders.findIndex( f => f.folderId === folderId );
        
        if ( i + direction < 0 ) {
            direction = -1 * i;

        } else if ( i + direction >= targetFolders.length ) {
            direction = targetFolders.length - i - 1;

        }
        
        if ( direction !== 0 ) {

            // Before we operate, let's start by creating a restore point.
            let restorePoint: TriggerFolder[] = [].concat( targetFolders );
            this.createFolderHierarchyRestore( () => {
                let restoreParent = this.findFolderParent( folderId );
                
                // We're either updating the root node or the children property of a node.
                if ( restoreParent == null ) {
                    this.triggerFolders = restorePoint;
                } else {
                    restoreParent.children = restorePoint;
                }

                this.updateViewTriggerData( this.triggerFolders );
                this.updateTriggerFolders();

                return true;
            } );

            let ni = i + direction;
            let folder = targetFolders.splice( i, 1 )[ 0 ];
            targetFolders.splice( ni, 0, folder );

            this.updateViewTriggerData( this.triggerFolders );
            this.updateTriggerFolders();

        }
    }










    /**
     * Allows the user to add/edit/delete folder conditions.
     * 
     * @param folderId The id of the desired folder.
     */
    private editFolderConditions( folderId: string ): void {
        let folder = this.findFolderById( folderId );

        let dialogRef: MatDialogRef<FolderConditionsDialogComponent> = this.dialog.open( FolderConditionsDialogComponent, {
            width: '750px',
            data: folder,
            panelClass: 'app-dialog',
        } );

        dialogRef.afterClosed().subscribe( confirmed => {

            if ( confirmed ) {
                this.updateViewTriggerData( this.triggerFolders );
                this.updateTriggerFolders();
            }

            if ( document.activeElement instanceof HTMLElement ) {
                // This is a workaround to prevent the error:
                // 
                //      ExpressionChangedAfterItHasBeenCheckedError: Expression has changed after it was checked. Previous value for 'mat-form-field-should-float': 'false'. Current value: 'true'.
                //
                // I'm sure there's some deeper meaning behind it, but for some 
                // reason when the confirm dialog's `Yes` button is still the 
                // active element at this point, that error is written to the 
                // console.
                // This error only happens when a list is reloaded after.
                document.activeElement.blur();
            }

        } );

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
        }, {
            label: 'Sorting',
            action: () => { },
            disabled: () => false,
            hide: () => false,
            matIcon: 'sort',
            children: [
                {
                    label: 'Sort Alphabetically',
                    action: () => this.sortAlphabetically( folderId ),
                    disabled: () => false,
                    hide: () => false,
                    matIcon: 'sort_by_alpha',
                }, {
                    label: 'Top',
                    action: () => this.translateFolder( folderId, -10000 ),
                    disabled: () => false,
                    hide: () => false,
                    matIcon: 'vertical_align_top',
                    keepOpen: true,
                }, {
                    label: 'Move up',
                    action: () => this.translateFolder( folderId, -1 ),
                    disabled: () => false,
                    hide: () => false,
                    matIcon: 'arrow_upward',
                    keepOpen: true,
                }, {
                    label: 'Move down',
                    action: () => this.translateFolder( folderId, 1 ),
                    disabled: () => false,
                    hide: () => false,
                    matIcon: 'arrow_downward',
                    keepOpen: true,
                }, {
                    label: 'Bottom',
                    action: () => this.translateFolder( folderId, 10000 ),
                    disabled: () => false,
                    hide: () => false,
                    matIcon: 'vertical_align_bottom',
                    keepOpen: true,
                }, <ContextMenuModel>{
                    label: '-',
                    action: () => { },
                    disabled: () => false,
                    hide: () => false,
                },
                {
                    label: 'Change parent',
                    action: () => this.selectParentFolder( folderId ),
                    disabled: () => false,
                    hide: () => false,
                    matIcon: 'sort',
                },
            ]
        }, <ContextMenuModel>{
            label: '-',
            action: () => { },
            disabled: () => false,
            hide: () => false,
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
        }, {
            label: 'Folder Conditions',
            action: () => this.editFolderConditions( folderId ),
            disabled: () => false,
            hide: () => false,
            matIcon: 'published_with_changes',
        }, <ContextMenuModel>{
            label: '-',
            action: () => { },
            disabled: () => false,
            hide: () => false,
        }, <ContextMenuModel>{
            label: 'Disable All Triggers',
            action: () => this.disableFolderTriggers( folderId ),
            disabled: () => false,
            hide: () => !this.hasSomeTriggersToDisable( folderId ),
            matIcon: 'unpublished',
            matIconCssClass: 'material-icons-outlined',
        }, <ContextMenuModel>{
            label: 'Enable All Triggers',
            action: () => this.enableFolderTriggers( folderId ),
            disabled: () => false,
            hide: () => !this.hasSomeTriggersToEnable( folderId ),
            matIcon: 'check_circle',
            matIconCssClass: 'material-icons-outlined',
        }, <ContextMenuModel>{
            label: 'Delete Folder',
            action: () => this.deleteFolder( folderId, name ),
            disabled: () => false,
            hide: () => false,
            matIcon: 'clear',
        } ];
    }










    /**
     * Enables all triggers in the specified folder's hierarchy.
     * 
     * @param folderId The id of the folder.
     */
    enableFolderTriggers( folderId: string ): void {
        let folder = this.findFolderById( folderId );
        let folderName = this.getFolderFamilyNames( folderId, this.triggerFolders, [] ).join( ' / ' );
        if ( folder ) {
            this.dialogService.showConfirmationDialog( [ `Are you sure you want to enable all triggers in ${folderName}?`, 'This will enable all triggers in this folder and all sub-folders.' ], 'Click "Yes" to enable all triggers in this folder and all sub-folders.', 'Click "No" to close this dialog without enabling any triggers.' ).subscribe( confirmed => {
                if ( confirmed ) {
                    this.setEnableStateForFolder( folder, true );
                }
            } );
        }
    }










    /**
     * Disables all triggers in the specified folder's hierarchy.
     * 
     * @param folderId The id of the folder.
     */
    disableFolderTriggers( folderId: string ): void {
        let folder = this.findFolderById( folderId );
        let folderName = this.getFolderFamilyNames( folderId, this.triggerFolders, [] ).join( ' / ' );
        if ( folder ) {
            this.dialogService.showConfirmationDialog( [ `Are you sure you want to disable all triggers in ${folderName}?`, 'This will disable all triggers in this folder and all sub-folders.' ], 'Click "Yes" to disable all triggers in this folder and all sub-folders.', 'Click "No" to close this dialog without disabling any triggers.' ).subscribe( confirmed => {
                if ( confirmed ) {
                    this.setEnableStateForFolder( folder, false );
                }
            } );
        }
    }










    /**
     * Enables or disables all triggers in the specified folder's hierarchy.
     * 
     * @param folder The folder to enable/disable triggers for.
     * @param enabled True to enable, false to disable.
     */
    private setEnableStateForFolder( folder: TriggerFolder, enabled: boolean ): void {
        this.processing = true;
        let triggers = this.getDescendantTriggers( folder );
        triggers.forEach( trigger => {
            trigger.enabled = enabled;
        } );
        this.ipcService.updateTriggers( this.triggers ).subscribe( failed => this.processing = false );
    }










    /**
     * Returns true if at least one trigger in the specified folder's hierarchy is disabled.
     * 
     * @param folderId The id of the folder.
     */
    private hasSomeTriggersToEnable( folderId: string ): boolean {
        return this.getDescendantTriggers( this.findFolderById( folderId ) ).some( trigger => trigger.enabled === false );
    }










    /**
     * Returns true if at least one trigger in the specified folder's hierarchy is enabled.
     * 
     * @param folderId The id of the folder.
     */
    private hasSomeTriggersToDisable( folderId: string ): boolean {
        return this.getDescendantTriggers( this.findFolderById( folderId ) ).some( trigger => trigger.enabled === true );
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
        }, {
            label: 'Quick Share',
            action: () => this.quickShareTrigger( trigger.triggerId ),
            disabled: () => false,
            hide: () => false,
            matIcon: 'publish',
        }, <ContextMenuModel>{
            label: '-',
            action: () => { },
            disabled: () => false,
            hide: () => false,
        }, <ContextMenuModel>{
            label: 'Delete Trigger',
            action: () => this.deleteTrigger( trigger.triggerId ),
            disabled: () => false,
            hide: () => false,
            matIcon: 'clear',
        } ];
    }









    
    /**
     * Opens the trigger library window.
     */
    openTriggerLibrary() {
        this.ipcService.showTriggerLibrary().subscribe( opened => { } );
    }









    
    /**
     * Opens the death recap manual log reading modal.
     */
    openDeathRecap() {
        this.dialogService.showDeathRecapDialog();
    }










    /**
     * Opens a model to allow the user to paste in quick share codes.
     */
    installMultiCode() {
        this.dialogService
            .showInputDialog(
                'Install Quick Share',
                [ 'To install a quick share or package, paste the code below' ],
                'Package code',
                'Paste in the quick share or package code',
                null,
                false )
            .subscribe( response => {
                if ( response ) {
                    let handled = false;

                    let pkg = /{NAG:package\/(?<packageId>.+?)}/g.exec( response );
                    if ( pkg?.groups?.packageId ) {
                        this.installTriggerPackage( pkg.groups.packageId );
                        handled = true;
                    }

                    let qs = /{NAG:(?!package\/)(quick-share\/)?(?<quickShareId>.+?)}/g.exec( response );
                    if ( !handled && qs?.groups?.quickShareId ) {
                        this.installQuickShare( qs.groups.quickShareId );
                        handled = true;
                    }

                    if ( !handled ) {
                        this.dialogService.showErrorDialog( 'Error', [ 'Could not parse code, no packages installed!' ] );
                    }

                }
            } );
    }










    /**
     * Installs the specified quick share.
     * 
     * @param quickShareId The id of the quick share.
     */
    installQuickShare( quickShareId: string ): void {

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
        
        
    }

    // TODO: Remove when recovery options built-in.
    // getAllTriggerfiles(): void {
    //     this.libraryService.getAllFiles().subscribe( files => {
    //         // Adding a timer makes the following easier and I'm being lazy forever-today-.
    //         let importTasks: Observable<any>[] = [ timer( 1 ) ];

    //         // Install all of the package files first.
    //         files?.forEach( file => {
    //             importTasks.push( this.ipcService.importPackageFile( file ) );
    //         } );

    //         // Finally, we can install the package itself after all of the package files have been installed.
    //         forkJoin( importTasks ).subscribe( results => {
    //             this.snackBar.open( 'All files downloaded!', 'Dismiss', { duration: 5000 } );
    //         } );

    //     } );
    // }










    /**
     * Installs the given package, if the package isn't already installed.
     * 
     * @param packageId The id of the package to install.
     */
    installTriggerPackage( packageId: string ): void {

        this.ipcService.getInstalledPackages().subscribe( installedPkgs => {

            // First, we check if the package is already installed, and if true show an error modal.
            if ( installedPkgs.findIndex( f => f.packageId === packageId ) > -1 ) {
                this.dialogService.showErrorDialog( 'Already Installed', [ 'That package has already been installed!' ] );

            } else {

                // Next, let's get the package information from the server.
                this.libraryService.getPackage( [ packageId ] ).subscribe( packageMeta => {

                    // This comes back as an array of packages, so let's just grab the first one.
                    const pkg = packageMeta[ 0 ];

                    // Next we need to download the package files from the web service.
                    this.libraryService
                        .getPackageFiles( packageId )
                        .subscribe( packageFiles => {
                    
                            // Adding a timer makes the following easier and I'm being lazy forever-today-.
                            let importTasks: Observable<any>[] = [ timer( 1 ) ];
                    
                            // Install all of the package files first.
                            packageFiles?.forEach( file => {
                                importTasks.push( this.ipcService.importPackageFile( file ) );
                            } );
                            
                            // Finally, we can install the package itself after all of the package files have been installed.
                            forkJoin( importTasks ).subscribe( results => {
                                // Missing package overlays are caught in the main component's ngInit event.
                                this.ipcService.installTriggerPackage( pkg ).subscribe( installComplete => {
                                    this.snackBar.open( 'Package install complete!', 'dismiss', { duration: 2500 } );
                                    this.ipcService.requestTick();
                                } );
                            } );
                            
                        } );
                } );
                
            }
        } );

    }









    
    /**
     * Opens the gina importer window.
     */
    ginaImporter() {
        this.ipcService.showGinaImportWindow().subscribe( loaded => {
            if ( !loaded ) {
                this.dialogService.showErrorDialog( 'GINA Import', 'Could not load GINA data.' );
            }
        } );
    }










}
