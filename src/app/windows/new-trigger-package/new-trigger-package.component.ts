import { Component, OnInit, ViewChild } from '@angular/core';
import { MatTable } from '@angular/material/table';
import { TriggerFolder, TriggerModel, PackageTrigger, TriggerPackageMetaModel } from 'src/app/core.model';
import { DialogService } from 'src/app/dialogs/dialog.service';
import { IpcService } from 'src/app/ipc.service';
import * as _ from 'lodash';

@Component( {
    selector: 'app-new-trigger-package',
    templateUrl: 'new-trigger-package.component.html',
    styleUrls: [ 'new-trigger-package.component.scss', '../../core.scss', '../../modal.scss' ]
} )
export class NewTriggerPackageComponent implements OnInit {
    
    public newPackage: TriggerPackageMetaModel = new TriggerPackageMetaModel();
    public notes: string;
    public name: string;
    private triggers: TriggerModel[];
    private triggerFolders: TriggerFolder[];

    @ViewChild( 'newTriggersTable', { static: true } ) newTriggersTable: MatTable<TriggerModel>;

    constructor( private ipcService: IpcService, private dialogService: DialogService ) { }

    ngOnInit() { }

    selectTriggerFolders(): void {
        
        this.dialogService.showSelectTriggerFoldersDialog( null, 'Select folder' ).subscribe( selectedFolderId => {
            if ( selectedFolderId ) {
                let folder = this.getFolder( selectedFolderId, this.triggerFolders );
                if ( folder ) {
                    this.addFolderTriggers( folder );
                }
            }
            // console.log( 'selected folder id', selectedFolderId );
            // let folder = this.detatchFolder( this.triggerFolders, sourceFolderId );
            // this.triggerFolders.push( folder );
            // this.updateTriggerFolders();
        } );
        this.ipcService.getTriggers().subscribe( triggers => this.triggers = triggers );
        this.ipcService.getTriggerFolders().subscribe( folders => this.triggerFolders = folders );

    }

    addFolderTriggers( folder: TriggerFolder ): void {
        let folderIds = this.getFlattenedFolderIds( folder, [] );
        
        this.triggers.forEach( trigger => {
            if ( folderIds.indexOf( trigger.folderId ) > -1 ) {
                this.addTrigger( trigger );
            }
        } );

        // this.newPackage.model.triggers = _.orderBy(this.newPackage.model.triggers)
        // this.newPackage.model.triggers = this.newPackage.model.triggers.slice();
        this.updateList();
        // this.newTriggersTable?.renderRows();
    }

    addTrigger( trigger: TriggerModel ) {
        let exists = _.some( this.newPackage.model.triggers, f => f.triggerId === trigger.triggerId );
        
        if ( !exists ) {
            let pTrg = new PackageTrigger();

            pTrg.triggerId = trigger.triggerId;
            pTrg.folderId = trigger.folderId;
            pTrg.name = trigger.name;
            pTrg.capturePhrases = _.cloneDeep( trigger.capturePhrases );
            pTrg.comments = _.cloneDeep( trigger.comments );
            pTrg.actions = _.cloneDeep( trigger.actions );
            pTrg.captureMethod = _.cloneDeep( trigger.captureMethod );
            pTrg.conditions = _.cloneDeep( trigger.conditions );
            pTrg.classLevels = _.cloneDeep( trigger.classLevels );

            this.newPackage.model.triggers.push( pTrg );
        }

    }

    getFlattenedFolderIds( folder: TriggerFolder, folderIds: string[] ): string[] {
        
        folderIds.push( folder.folderId );

        if ( folder.children?.length > 0 ) {
            for ( let i = 0; i < folder.children.length; i++ ) {
                this.getFlattenedFolderIds( folder.children[ i ], folderIds );
            }
        }

        return folderIds;
    }

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

    public getTriggerFamily( trigger: TriggerModel ): string {

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

    removeTrigger( triggerId: string ): void {
        if ( triggerId ) {
            let i = this.newPackage.model.triggers.findIndex( f => f.triggerId === triggerId );
            if ( i > -1 ) {
                this.newPackage.model.triggers.splice( i, 1 );
                // this.newPackage.model.triggers = this.newPackage.model.triggers.slice();
                this.updateList();
            }
        }
    }

    updateList(): void {
        this.newPackage.model.triggers = _.orderBy( this.newPackage.model.triggers, f => this.getTriggerFamily( f ) );
    }
    
}