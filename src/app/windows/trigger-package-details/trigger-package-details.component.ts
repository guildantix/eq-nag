import { Component, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core';
import { MatTable } from '@angular/material/table';
import { PackageFolder, PackageTrigger, TriggerPackageMetaModel } from 'src/app/core.model';
import { DialogService } from 'src/app/dialogs/dialog.service';
import { IpcService } from 'src/app/ipc.service';
import * as _ from 'lodash';
import { TriggerLibraryService } from '../trigger-library.service';
import { SettingsService } from 'src/app/settings/settings-http.service';

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
            this.libraryService.isAuthor( val.triggerPackageId, this.authorId ).subscribe( isAuth => this.isAuthor = isAuth && this.trustedAuthor );
        }
    }
    public notes: string;
    public isAuthor: boolean = false;

    public authorId: string;
    public trustedAuthor: boolean = false;
    @Output() public editPackageId: EventEmitter<string> = new EventEmitter<string>();
    @ViewChild( 'newTriggersTable', { static: true } ) newTriggersTable: MatTable<PackageTrigger>;

    constructor( private ipcService: IpcService, private dialogService: DialogService, private libraryService: TriggerLibraryService, private settingsService: SettingsService ) { }

    ngOnInit() {
        this.ipcService.getAuthor().subscribe( author => {
            this.authorId = author.authorId;
            this.settingsService.isTrusted( author.authorId ).subscribe( trusted => {
                this.trustedAuthor = trusted;
                if ( this._pkg ) {
                    this.libraryService.isAuthor( this._pkg.triggerPackageId, this.authorId ).subscribe( isAuth => this.isAuthor = isAuth && this.trustedAuthor );
                }
            } );
        } );
    }

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

    onUpdatePackageClick() {
        this.editPackageId.emit( this.package.triggerPackageId );
    }

}