import { animate, state, style, transition, trigger } from '@angular/animations';
import { FlatTreeControl } from '@angular/cdk/tree';
import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { MatTreeFlatDataSource, MatTreeFlattener } from '@angular/material/tree';
import { customAlphabet } from 'nanoid';
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const nanoid = customAlphabet( alphabet, 16 );
import { MatSnackBar } from '@angular/material/snack-bar';
import { IpcService } from 'src/app/ipc.service';
import { DialogService } from 'src/app/dialogs/dialog.service';
import { TriggerLibraryService } from '../trigger-library.service';
import { AuthorModel, PackageTrigger, TriggerFolder, TriggerModel, TriggerPackageMetaModel, TriggerPackageModel } from 'src/app/core.model';
import { SettingsService } from 'src/app/settings/settings-http.service';
import * as _ from 'lodash-es';
import { MatTable } from '@angular/material/table';

@Component( {
    selector: 'app-trigger-library-window',
    templateUrl: 'trigger-library-window.component.html',
    styleUrls: [ 'trigger-library-window.component.scss', '../../core.scss', '../../modal.scss' ],
    animations: [
        trigger( 'detailExpand', [
            state( 'collapsed', style( { height: '0px', minHeight: '0' } ) ),
            state( 'expanded', style( { height: '*' } ) ),
            transition( 'expanded <=> collapsed', animate( '225ms cubic-bezier(0.4, 0.0, 0.2, 1)' ) ),
        ] ),
    ],
} )
export class TriggerLibraryWindowComponent implements OnInit {

    public loadingLibrary: boolean = true;
    public packages: TriggerPackageMetaModel[] = [];
    public currentPackage: TriggerPackageMetaModel;
    public author: AuthorModel;
    public trustedAuthor: boolean = false;
    public notes: string;
    public showNewTrigger: boolean = false;
    public showEditTrigger: boolean = false;
    public showDetailsModel: boolean = false;
    public detailsModel: TriggerPackageMetaModel = null;
    public editPackageId: string = null;

    constructor( private ipcService: IpcService, private dialogService: DialogService, private snackBar: MatSnackBar,  private libraryService: TriggerLibraryService, private settingsService: SettingsService ) { }

    ngOnInit() {
        this.libraryService.getLibrary().subscribe( packages => {
            this.packages = packages;
            this.loadingLibrary = false;
        } );
        this.ipcService.getAuthor().subscribe( author => {
            this.author = author;
            if ( author?.authorId ) {
                this.settingsService.isTrusted( author.authorId ).subscribe( trusted => this.trustedAuthor = trusted );
            }
        } );
    }









    
    /**
     * Closes this modal.
     */
    public closeModal(): void {
        this.ipcService.closeThisChild();
    }









    
    /**
     * Shows the new trigger button.
     */
    createNewPackage(): void {
        if ( this.trustedAuthor ) {
            this.showNewTrigger = true;
        }
    }









    
    /**
     * Reloads the trigger packages when the user makes a change.
     * 
     * @param triggerPackage The new trigger package.
     */
    onNewPackage( triggerPackage: TriggerPackageMetaModel ): void {
        if ( triggerPackage != null ) {
            this.packages.push( triggerPackage );
            this.packages = this.packages.slice();
        }
        this.showNewTrigger = false;
    }









    
    /**
     * Reloads the trigger packages when the user makes a change.
     * 
     * @param triggerPackage The updated trigger package.
     */
    onSavePackage( triggerPackage: TriggerPackageMetaModel ): void {
        if ( triggerPackage != null ) {
            this.libraryService.getLibrary().subscribe( packages => this.packages = packages );
        }
        this.showEditTrigger = false;
    }









    
    /**
     * Shows the details panel on the given trigger package.
     * 
     * @param triggerPackage The desired trigger package.
     */
    showTriggerDetails( triggerPackage: TriggerPackageMetaModel ): void {
        this.detailsModel = triggerPackage;
        this.showDetailsModel = true;
    }










    /**
     * Shows the edit package panel for the specified package.
     * 
     * @param packageId The id of the package.
     */
    showEditPackage( packageId: string ): void {
        this.editPackageId = packageId;
        this.showEditTrigger = true;
        this.showDetailsModel = false;
    }

}
