import { Component, ElementRef, Inject, OnInit, ViewChild, ChangeDetectorRef  } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatPaginator } from '@angular/material/paginator';
import { BasicError, ErrorCodes } from 'src/app/core.model';
import { IpcService } from 'src/app/ipc.service';

@Component( {
    selector: 'app-select-icon-dialog',
    templateUrl: 'select-icon-dialog.component.html',
    styleUrls: [ 'select-icon-dialog.component.scss', '../dialog.styles.scss' ],
} )
export class SelectIconDialogComponent implements OnInit {
    
    public spellIcons: string[] = [];
    public eqFolderNotFound: boolean = false;
    public invalidFolderSelected: boolean = false;

    @ViewChild( 'fileSelector' ) private fileSelector: ElementRef<HTMLInputElement>;
    @ViewChild( 'paginator', { static: false, read: MatPaginator } ) private paginator: MatPaginator;

    public get pagedImages(): string[] {
        let icons: string[] = [];
        
        if ( this.paginator != null ) {
            let skip: number = this.paginator.pageIndex * this.paginator.pageSize;
            let take: number = skip + this.paginator.pageSize > this.spellIcons.length ? this.spellIcons.length : skip + this.paginator.pageSize;
        
            for ( let i = skip; i < take; i++ ) {
                icons.push( this.spellIcons[ i ] );
            }
        }

        return icons;
    }

    constructor( 
        public dialogRef: MatDialogRef<SelectIconDialogComponent>,
        @Inject( MAT_DIALOG_DATA ) public data: any,
        private ipcService: IpcService,
        private changeDetectionRef: ChangeDetectorRef ) { }

    ngOnInit() {
        this.loadData();
    }

    public loadData(): void {

        this.ipcService
            .getEqSpellIcons()
            .subscribe(
                icons => {
                    if ( this.data?.iconIndex >= 0 ) {
                        this.dialogRef.close( icons[ this.data.iconIndex ] );
                    } else {
                        this.spellIcons = icons;
                        this.changeDetectionRef.detectChanges();
                    }
                },
                ( error: BasicError ) => {
                    if ( error.errorCode === ErrorCodes.EqFolderNotFound.code ) {
                        this.eqFolderNotFound = true;
                        this.spellIcons = [];
                    }
                } );

    }

    public selectIcon( index: number ): void {
        this.dialogRef.close( this.spellIcons[ this.paginator.pageIndex * this.paginator.pageSize + index ] );
    }

    showFileSelector() {
        this.fileSelector.nativeElement.click();
    }

    fileSelected( e: any ) {
        console.log( 'selected', this.fileSelector.nativeElement.files[ 0 ].path );
        if ( this.fileSelector.nativeElement.files?.length > 0 ) {
            let eqGamePath: string = this.fileSelector.nativeElement.files[ 0 ].path;
            if ( eqGamePath.indexOf( 'eqgame.exe' ) < 0 ) {
                this.invalidFolderSelected = true;
            } else {
                this.eqFolderNotFound = false;
                this.invalidFolderSelected = false;
                let eqInstallFolder: string = eqGamePath.split( /\\eqgame/ )[ 0 ];
                
                this.ipcService.setEqInstallFolder( eqInstallFolder );
                this.loadData();
            }
        }
    }
}
