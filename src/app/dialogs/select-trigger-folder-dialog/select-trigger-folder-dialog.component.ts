import { FlatTreeControl } from '@angular/cdk/tree';
import { Component, OnInit, Inject } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatTreeFlatDataSource, MatTreeFlattener } from '@angular/material/tree';
import { IpcService } from 'src/app/ipc.service';
import { TriggerFolder } from '../../core.model';

interface ExampleFlatNode {
  expandable: boolean;
  name: string;
  level: number;
}

@Component( {
    selector: 'app-select-trigger-folder-dialog',
    templateUrl: 'select-trigger-folder-dialog.component.html',
    styleUrls: [ 'select-trigger-folder-dialog.component.scss', '../dialog.styles.scss', '../../core.scss' ]
} )
export class SelectTriggerFolderDialogComponent implements OnInit {


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
    public treeControl = new FlatTreeControl<ExampleFlatNode>( node => node.level, node => node.expandable );
    public treeFlattener = new MatTreeFlattener(this._transformer, node => node.level, node => node.expandable, node => node.children);
    public dataSource = new MatTreeFlatDataSource(this.treeControl, this.treeFlattener);
    hasChild = (_: number, node: ExampleFlatNode) => node.expandable;

    public title: string = 'Select a parent folder';
    public description: string|null = null;

    constructor(
        public dialogRef: MatDialogRef<SelectTriggerFolderDialogComponent>,
        @Inject( MAT_DIALOG_DATA ) public data: { folderId: string, title: string, description?: string },
        public dialog: MatDialog,
        private ipcService: IpcService ) {
        
        this.dataSource.data = [];
        
        this.ipcService.getTriggerFolders().subscribe( folders => {
            if ( this.data?.folderId ) {
                this.removeFolder( folders, this.data.folderId );
            }
            this.dataSource.data = folders;
            this.treeControl.expandAll();
        } );

        if ( data?.title ) {
            this.title = data.title;
        }

        if ( data?.description ) {
            this.description = data.description;
        }
    }

    ngOnInit(): void {

        // this.model = new TriggerFolder();

    }

    private removeFolder( folders: TriggerFolder[], folderId: string ): void {
        let index = -1;
        for ( let i = 0; i < folders.length; i++ ) {
            if ( folders[ i ].folderId === folderId ) {
                index = i;
                break;
            } else if ( folders[ i ].children != null && folders[ i ].children.length > 0 ) {
                this.removeFolder( folders[ i ].children, folderId );
            }
        }

        if ( index > -1 ) {
            folders.splice( index, 1 );
        }
    }
    
}
