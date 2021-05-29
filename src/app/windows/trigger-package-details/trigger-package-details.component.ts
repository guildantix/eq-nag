import { Component, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core';
import { MatTable } from '@angular/material/table';
import { PackageFolder, PackageTrigger, TriggerPackageMetaModel } from 'src/app/core.model';
import { DialogService } from 'src/app/dialogs/dialog.service';
import { IpcService } from 'src/app/ipc.service';
import * as _ from 'lodash';
import { TriggerLibraryService } from '../trigger-library.service';

@Component( {
    selector: 'app-trigger-package-details',
    templateUrl: 'trigger-package-details.component.html',
    styleUrls: [ 'trigger-package-details.component.scss', '../../core.scss', '../../modal.scss' ]
} )
export class TriggerPackageDetailsComponent implements OnInit {
    
    private _pkg: TriggerPackageMetaModel;
    @Input()
    public get package(): TriggerPackageMetaModel { return this._pkg; }
    public set package( val: TriggerPackageMetaModel ) {
        this._pkg = val;
        if ( val ) {
            let version = val.versionHistory?.find( f => f.versionId === val.versionId );
            this.notes = version.notes;
        }
        
        // if ( val?.versionHistory?.length > 0 ) {
        //     this.notes = val.versionHistory[ 0 ].notes;
        // }
    }
    public notes: string;
    // private triggers: TriggerModel[];
    // private triggerFolders: TriggerFolder[];

    @Input() public authorId: string;
    // @Output() public triggerPackage: EventEmitter<TriggerPackageMetaModel> = new EventEmitter<TriggerPackageMetaModel>();

    @ViewChild( 'newTriggersTable', { static: true } ) newTriggersTable: MatTable<PackageTrigger>;

    constructor( private ipcService: IpcService, private dialogService: DialogService, private libraryService: TriggerLibraryService ) { }

    ngOnInit() { }

    private getFolderFamilyNames( folderId: string, folders: PackageFolder[], names: string[] ): string[] {
        
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

    getTriggerFamily( trigger: PackageTrigger ): string {

        let folderFamilyNames = this.getFolderFamilyNames( trigger.folderId, this.package.model.folders, [] );
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

    updateList(): void {
        this.package.model.triggers = _.orderBy( this.package.model.triggers, f => this.getTriggerFamily( f ) );
    }

}