import { Component, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core';
import { MatTable } from '@angular/material/table';
import { TriggerFolder, TriggerModel, PackageTrigger, TriggerPackageMetaModel } from 'src/app/core.model';
import { DialogService } from 'src/app/dialogs/dialog.service';
import { IpcService } from 'src/app/ipc.service';
import * as _ from 'lodash';
import { TriggerLibraryService } from '../trigger-library.service';

@Component( {
    selector: 'app-new-trigger-package',
    templateUrl: 'new-trigger-package.component.html',
    styleUrls: [ 'new-trigger-package.component.scss', '../../core.scss', '../../modal.scss' ]
} )
export class NewTriggerPackageComponent implements OnInit {
    
    public package: TriggerPackageMetaModel = new TriggerPackageMetaModel();
    public notes: string;
    public name: string;
    private triggers: TriggerModel[];
    private triggerFolders: TriggerFolder[];

    @Input() public authorId: string;
    @Output() public triggerPackage: EventEmitter<TriggerPackageMetaModel> = new EventEmitter<TriggerPackageMetaModel>();

    @ViewChild( 'newTriggersTable', { static: true } ) newTriggersTable: MatTable<TriggerModel>;

    constructor( private ipcService: IpcService, private dialogService: DialogService, private libraryService: TriggerLibraryService ) { }

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

        this.updateList();
    }

    addTrigger( trigger: TriggerModel ) {
        let exists = _.some( this.package.model.triggers, f => f.triggerId === trigger.triggerId );
        
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

            this.package.model.triggers.push( pTrg );
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
            let i = this.package.model.triggers.findIndex( f => f.triggerId === triggerId );
            if ( i > -1 ) {
                this.package.model.triggers.splice( i, 1 );
                
                this.updateList();
            }
        }
    }

    updateList(): void {
        this.package.model.triggers = _.orderBy( this.package.model.triggers, f => this.getTriggerFamily( f ) );
    }

    cancel(): void {
        this.package = new TriggerPackageMetaModel();
        this.triggerPackage.emit( null );
    }

    createPackage(): void {
        this.libraryService.createPackage( this.authorId, this.name, this.package.model, this.notes ).subscribe( pkg => {
            if ( pkg ) {
                this.triggerPackage.emit( pkg );
            } else {
                this.triggerPackage.emit( null );
            }
            this.package = new TriggerPackageMetaModel();
        } );
    }
    
}