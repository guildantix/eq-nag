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
import { AuthorModel, PackageTrigger, TriggerFolder, TriggerModel, TriggerPackageCategories, TriggerPackageListModel, TriggerPackageMetaModel, TriggerPackageModel } from 'src/app/core.model';
import { SettingsService } from 'src/app/settings/settings-http.service';
import * as _ from 'lodash-es';
import { MatTable } from '@angular/material/table';
import { ArrayUtility } from 'src/app/utilities';

enum LibraryPanels {
    browse = 0,
    newTrigger = 1,
    editTrigger = 2,
    viewTrigger = 3,
}

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
    public packages: TriggerPackageListModel[] = [];
    public currentPackage: TriggerPackageMetaModel;
    public author: AuthorModel;
    public trustedAuthor: boolean = false;
    public notes: string;
    public editPackageId: string = null;
    public viewPackageId: string = null;
    public categories: string[] = TriggerPackageCategories;
    private category: string = null;
    public tags: string[] = [];
    public installedTriggers: Record<string, boolean> = {};

    private panel: LibraryPanels = LibraryPanels.browse;

    public get showBrowse(): boolean {
        return this.panel === LibraryPanels.browse;
    }
    public get showNewTrigger(): boolean {
        return this.panel === LibraryPanels.newTrigger;
    }
    public get showEditTrigger(): boolean {
        return this.panel === LibraryPanels.editTrigger;
    }
    public get showDetailsModel(): boolean {
        return this.panel === LibraryPanels.viewTrigger;
    }
    public get showTagSelector(): boolean {
        return this.category != null;
    }
    private _tagOptions: string[] = null;
    public get tagOptions(): string[] {
        if ( this._tagOptions == null ) {
            this._tagOptions = _.uniq( [].concat.apply( [], this.packages?.filter( f => f.category === this.category || this.category === null ).map( f => f.tags ) ) );;
        }
        return this._tagOptions;
    }

    public get filteredPackages(): TriggerPackageListModel[] {
        let packages = this.packages?.filter( f => f.category === this.category || this.category === null || ( this.category === 'installed' && this.installedTriggers[ f.triggerPackageId ] ) );
        if ( this.tags?.length > 0 ) {
            return packages.filter( f => ArrayUtility.IsContainedIn( this.tags, f.tags ) );
        } else {
            return packages;
        }
    }

    public get selectedCategory(): string {
        return this.category === 'installed' ? null : this.category;
    }

    constructor( private ipcService: IpcService, private dialogService: DialogService, private snackBar: MatSnackBar,  private libraryService: TriggerLibraryService, private settingsService: SettingsService ) { }

    ngOnInit() {

        this.loadPackages();

        this.ipcService.getAuthor().subscribe( author => {
            this.author = author;
            if ( author?.authorId ) {
                this.settingsService.isTrusted( author.authorId ).subscribe( trusted => this.trustedAuthor = trusted );
            }
        } );

    }










    /**
     * Returns true if the specified tag exists in the selection.
     * 
     * @param tag The tag to check.
     */
    isTagSelected( tag: string ): boolean {
        return this.tags?.indexOf( tag ) > -1;
    }










    /**
     * Toggles the select state on the given tag.
     * 
     * @param tag The tag to toggle.
     */
    toggleTag( tag: string ) {
        this.tags = this.tags?.length > 0 ? this.tags : [];
        let i = this.tags.indexOf( tag );
        if ( i > -1 ) {
            this.tags.splice( i, 1 );
        } else {
            this.tags.push( tag );
        }
    }
    









    /**
     * Selects the given category, allowing the fitler to remove packages not in the category.
     * 
     * @param category The category to select.
     */
    selectCategory( category: string ) {
        this._tagOptions = null;
        this.category = this.panel === LibraryPanels.browse && this.isCategorySelected( category ) ? null : category;
        this.panel = LibraryPanels.browse;
    }










    /**
     * Returns true if the given category matches the selected category.
     * 
     * @param category The category to compare.
     */
    isCategorySelected( category: string ) {
        return this.category === category;
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
            // this.showNewTrigger = true;
            this.panel = LibraryPanels.newTrigger;
        }
    }









    
    /**
     * Reloads the trigger packages when the user makes a change.
     * 
     * @param triggerPackage The new trigger package.
     */
    onNewPackage( triggerPackage: TriggerPackageMetaModel ): void {

        if ( triggerPackage != null ) {
            this.loadPackages();
        }

        this.panel = LibraryPanels.browse;

    }









    
    /**
     * Reloads the trigger packages when the user makes a change.
     * 
     * @param triggerPackage The updated trigger package.
     */
    onSavePackage( triggerPackage: TriggerPackageMetaModel ): void {
        
        if ( triggerPackage != null ) {
            this.loadPackages();
        }
        
        this.panel = LibraryPanels.browse;

    }









    
    /**
     * Shows the details panel on the given trigger package.
     * 
     * @param triggerPackage The desired trigger package.
     */
    showTriggerDetails( packageId: string ): void {
        this.viewPackageId = packageId;
        this.panel = LibraryPanels.viewTrigger;
    }










    /**
     * Shows the edit package panel for the specified package.
     * 
     * @param packageId The id of the package.
     */
    showEditPackage( packageId: string ): void {
        this.editPackageId = packageId;
        this.panel = LibraryPanels.editTrigger;
    }









    
    /**
     * Loads the available packages from the server.
     */
    loadPackages() {
        this.loadingLibrary = true;
        this.libraryService.getPackagesList().subscribe( packages => {
            this.packages = packages.sort( ( a, b ) => a.name < b.name ? -1 : a.name == b.name ? 0 : 1 );
            packages.forEach( pkg => {
                this.ipcService.isPackageInstalled( pkg.triggerPackageId ).subscribe( installed => this.installedTriggers[ pkg.triggerPackageId ] = installed );
            } );
            this.loadingLibrary = false;
        } );
    }
    








    
    /**
     * Shows the browse panel.
     */
    showBrowsePackages() {
        this.panel = LibraryPanels.browse;
    }










}
