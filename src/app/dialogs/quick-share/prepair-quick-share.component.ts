import { animate, state, style, transition, trigger } from '@angular/animations';
import { FlatTreeControl } from '@angular/cdk/tree';
import { Component, OnInit, Inject, ViewChild } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatTree, MatTreeFlatDataSource, MatTreeFlattener } from '@angular/material/tree';
import { forkJoin } from 'rxjs';
import { TriggerFolder, TriggerModel } from 'src/app/core.model';
import { IpcService } from 'src/app/ipc.service';
import { PrepareQuickShareModel, QuickShareTriggerFolder } from '../dialog.model';

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
    styleUrls: [ 'prepare-quick-share.component.scss', '../../core.scss', '../../modal.scss' ], 
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
            expandable: node.folder ? true : false, // node.children?.length > 0,
            name: node.name,
            level: level,
            item: node.folder ? node.folder : node.trigger,
            selected: node.selected === false ? false : true,
            // folderState: 'all',
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
        private ipcService: IpcService ) { }

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

    toggleSelect( node: QuickShareTreeNode ): void {
        let trigger = <TriggerModel>node.item;
        if ( trigger.triggerId ) {
            node.selected = !node.selected;
        }
    }

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

    private findFolderById( folderId: string, search: TriggerFolder[] = null ): TriggerFolder {
        search = search ? search : this.allFolders;

        for ( let i = 0; i < search?.length; i++ ) {
            let folder = search[ i ].folderId === folderId ? search[ i ] : this.findFolderById( folderId, search[ i ].children );

            if ( folder ) {
                return folder;
            }
        }

    }

    private getDescendantFolderIds( folder: TriggerFolder, descendantIds: string[] = null ): string[]{
        descendantIds = descendantIds ? descendantIds : [];

        descendantIds.push( folder.folderId );

        folder.children.forEach( c => this.getDescendantFolderIds( c, descendantIds ) );

        return descendantIds;
    }

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

    onFolderSelectChange( node: QuickShareTreeNode, value: boolean ): void {
        
        let folder = this.findFolderById( node.id );
        let familyIds = this.getDescendantFolderIds( folder );
        for ( let i = 0; i < familyIds?.length; i++ ) {
            let triggers = this.treeControl.dataNodes.filter( t => !t.isFolder && t.item.folderId === familyIds[ i ] );
            triggers.forEach( f => f.selected = value );
        }
        
        this.updateFolderStates();
    }

    onTriggerSelectChange(): void {
        this.updateFolderStates();
    }

    getSelectedFolders( folders: TriggerFolder[] | QuickShareTriggerFolder[] = null, selectedFolders: QuickShareTriggerFolder[] = null ): void {
        // Get all folders with at least 'partial'
        folders = folders ? folders : this.allFolders;
        selectedFolders = selectedFolders ? selectedFolders : [];

        let selected = this.treeControl.dataNodes.filter( f => f.isFolder && ( f.folderState === 'all' || f.folderState === 'partial' ) );

        selectedFolders = selectedFolders.concat( selected.map( f => Object.assign( new QuickShareTriggerFolder(), f ) ) );
        // descendantIds.push( folder.folderId );

        selectedFolders.forEach( f => {
            // this.getSelectedFolders(f.children)
        } );
        // folders.forEach
        // folder.children.forEach( c => this.getDescendantFolderIds( c, descendantIds ) );

        // return descendantIds;
        // Populate the triggers property for each folder.
    }

    createQuickShare(): void {
        this.creatingQuickShare = true;


        // window.setTimeout( () => {
        //     this.creatingQuickShare = false;
        //     this.dialogRef.close( 'accepted' );
        // }, 2500 );
        // console.log( 'testing', this.treeControl.dataNodes );
    }
    
}
