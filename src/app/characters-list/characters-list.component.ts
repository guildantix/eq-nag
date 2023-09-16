import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CharacterModel, TriggerFolder, TriggerModel } from '../core.model';
import { DialogService } from '../dialogs/dialog.service';
import { IpcService } from '../ipc.service';
import * as _ from 'lodash-es';
import { FlatTreeControl } from '@angular/cdk/tree';
import { MatTree, MatTreeFlatDataSource, MatTreeFlattener } from '@angular/material/tree';

interface CharacterTriggerTreeNode {
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

class CharacterTriggerTreeObject {
    name: string;
    children: CharacterTriggerTreeObject[] = [];
    folder: TriggerFolder;
    trigger: TriggerModel;
    selected: boolean;
}

interface CharacterTriggerData {
    folders: TriggerFolder[];
    triggers: TriggerModel[];
    dataSource: MatTreeFlatDataSource<CharacterTriggerTreeObject, CharacterTriggerTreeNode, CharacterTriggerTreeNode>;
    saveTimeoutId: number | undefined;
}

@Component( {
    selector: 'app-characters-list',
    templateUrl: 'characters-list.component.html',
    styleUrls: [ 'characters-list.component.scss' ]
} )
export class CharactersListComponent implements OnInit {

    private _transformer: ( node: CharacterTriggerTreeObject, level: number ) => CharacterTriggerTreeNode = ( node: CharacterTriggerTreeObject, level: number ) => {
        return {
            expandable: node.folder ? true : false, 
            name: node.name,
            level: level,
            item: node.folder ? node.folder : node.trigger,
            selected: node.selected === false ? false : true,
            id: node.folder ? node.folder.folderId : node.trigger.triggerId,
            isFolder: node.folder ? true : false,
            hasChildren: node.children?.length > 0,
        };
    }
    public treeControl = new FlatTreeControl<CharacterTriggerTreeNode>( node => node ? node.level : 1, node => node.expandable );
    public treeFlattener = new MatTreeFlattener(this._transformer, node => node.level, node => node.expandable, node => node.children);
    public hasChild = ( _: number, node: CharacterTriggerTreeNode ) => node.expandable;
    public characterData: Record<string, CharacterTriggerData> = {};
    public characterTriggerSaveDelayMs: number = 1000;

    public characters: CharacterModel[] = [];
    public selectedTabIndex: number = -1;
    public activeLogFilesDictionary: any = {};
    public triggerProfiles: string[] = [ 'Main', 'Alt', 'Box' ];
    
    @ViewChild( 'fileSelector' ) private fileSelector: ElementRef<HTMLInputElement>;
    @ViewChild( 'savedLabel' ) private savedLabel: ElementRef<HTMLDivElement>;

    private snackBarTimeoutId: number = null;

    constructor( private dialogService: DialogService, private ipcService: IpcService, private snackBar: MatSnackBar ) { }

    ngOnInit(): void {
        this.loadCharacters();
        this.ipcService.characterLogActivated().subscribe( chrId => this.activeLogFilesDictionary[ chrId ] = true );
        this.ipcService.characterLogDeactivated().subscribe( chrId => this.activeLogFilesDictionary[ chrId ] = false );
    }

    public newCharacter(): void {
        this.dialogService.showNewCharacterDialog( characterId => this.loadCharacters( characterId ) );
    }

    public loadCharacters( characterId?: string ): void {
        this.ipcService.getCharacters().subscribe( data => {
            this.characters = data;
            if ( characterId != null ) {
                let i: number = _.findIndex( this.characters, f => f.characterId === characterId );
                this.selectedTabIndex = i >= 0 && i < this.characters.length ? i : -1;
            }
        } );
    }

    public getCharacterDataSource( character: CharacterModel ): MatTreeFlatDataSource<CharacterTriggerTreeObject, CharacterTriggerTreeNode, CharacterTriggerTreeNode> {
        return this.characterData[ character.characterId ]?.dataSource;
    }

    public onCharacterSelected( character: CharacterModel, index: number | undefined = undefined ): void {
        this.selectedTabIndex = index === 0 || index > 0 ? index : _.findIndex( this.characters, f => f.characterId === character.characterId );

        if ( !this.characterData[ character.characterId ] ) {
            this.ipcService.getTriggerFolders().subscribe( folders => {
                this.ipcService.getTriggers().subscribe( triggers => {

                    let data: CharacterTriggerTreeObject[] = [];
                    folders.forEach( folder => this.processFolder( folder, triggers, data, character.disabledTriggers ) );


                    this.characterData[ character.characterId ] = {
                        folders: folders,
                        triggers: triggers,
                        dataSource: new MatTreeFlatDataSource( this.treeControl, this.treeFlattener ),
                        saveTimeoutId: undefined,
                    };
                    
                    this.characterData[ character.characterId ].dataSource.data = data;
    
                    this.updateFolderStates( folders );
                    
                } );
            } );
        }
    }

    public onTriggerProfileChanged( character: CharacterModel ): void {
        // TODO: Load the profile and apply it to the character.
        // TODO: Store and load profiles from the database.
    }

    /**
     * Triggers the update folder states method.
     */
    onTriggerSelectChange( character: CharacterModel ): void {
        this.updateFolderStates( this.characterData[ character.characterId ].folders );
    }

    saveCharacterTriggers( character: CharacterModel ): void {

        // If there is already a save timeout, clear it.
        if ( this.characterData[ character.characterId ].saveTimeoutId ) {
            window.clearTimeout( this.characterData[ character.characterId ].saveTimeoutId );
            this.characterData[ character.characterId ].saveTimeoutId = undefined;
        }

        // Set a new save timeout.
        this.characterData[ character.characterId ].saveTimeoutId = window.setTimeout( () => {
            this.ipcService.updateCharacter( character ).subscribe( updated => {
                if ( updated ) {
                    this.snackBar.open( 'Character updated!', 'Dismiss', { duration: 2500 } );
                }
                this.characterData[ character.characterId ].saveTimeoutId = undefined;
            } );
        }, this.characterTriggerSaveDelayMs );
    }

    toggleEnabled( character: CharacterModel, node: CharacterTriggerTreeNode ): void {
        node.selected = !node.selected;
        this.onTriggerSelectChange( character );

        if ( !node.isFolder ) {
            if ( node.selected && !character.disabledTriggers.includes( node.id ) ) {
                character.disabledTriggers.push( node.id );
            } else if ( !node.selected && character.disabledTriggers.includes( node.id ) ) {
                character.disabledTriggers.splice( character.disabledTriggers.indexOf( node.id ), 1 );
            }
        }

        this.saveCharacterTriggers( character );
    }

    /**
     * Selects all triggers in the given folder, including all descendants.
     * 
     * @param node The tree node for the folder.
     * @param value The selected state for the folder.
     */
    onFolderSelectChange( character: CharacterModel, node: CharacterTriggerTreeNode, value: boolean ): void {
        
        let folder = this.findFolderById( node.id, this.characterData[ character.characterId ].folders );
        let familyIds = this.getDescendantFolderIds( folder );
        for ( let i = 0; i < familyIds?.length; i++ ) {
            let triggers = this.treeControl.dataNodes.filter( t => !t.isFolder && t.item.folderId === familyIds[ i ] );
            triggers.forEach( f => {
                f.selected = value;
                if ( value && !character.disabledTriggers.includes( f.id ) ) {
                    character.disabledTriggers.push( f.id );
                } else if ( !value && character.disabledTriggers.includes( f.id ) ) {
                    character.disabledTriggers.splice( character.disabledTriggers.indexOf( f.id ), 1 );
                }
            } );
        }
        
        this.updateFolderStates( this.characterData[ character.characterId ].folders );

        this.saveCharacterTriggers( character );
    }

    /**
     * Generates the tree node data.
     * 
     * @param folder The trigger folder hierarchy.
     * @param triggers The full trigger list.
     * @param data The current node heirarchy.
     * @param includeTriggers The triggers to forcibly select.
     */
    private processFolder( folder: TriggerFolder, triggers: TriggerModel[], data: CharacterTriggerTreeObject[], disabledTriggers: string[] ): void {
        
        let node = new CharacterTriggerTreeObject();
        node.name = folder.name;
        node.children = [];
        node.folder = folder;

        // Push this folder node into the data list.
        data.push( node );

        // Push each child folder into this node's children list.
        folder.children.forEach( f => this.processFolder( f, triggers, node.children, disabledTriggers ) );

        // Find all triggers in this folder
        let myTriggers = triggers.filter( f => f.folderId === folder.folderId );

        // Push each child trigger into this node's children list.
        myTriggers?.forEach( trigger => {
            let triggerNode = new CharacterTriggerTreeObject();
            triggerNode.name = trigger.name;
            triggerNode.children = [];
            triggerNode.trigger = trigger;
            triggerNode.selected = disabledTriggers.includes( trigger.triggerId );
            node.children.push( triggerNode );
        } );
    }

    /**
     * Returns the specified trigger folder in the given hierarchy.
     * 
     * @param folderId The id of the desired folder.
     * @param search The list of folders to query.
     * @returns 
     */
    private findFolderById( folderId: string, search: TriggerFolder[] ): TriggerFolder {

        for ( let i = 0; i < search?.length; i++ ) {
            let folder = search[ i ].folderId === folderId ? search[ i ] : this.findFolderById( folderId, search[ i ].children );

            if ( folder ) {
                return folder;
            }
        }

    }

    /**
     * Returns a list of all direct and descendant child folders.
     * 
     * @param folder The starting folder.
     * @param descendantIds The current list of descendant folder ids.
     * @returns 
     */
    private getDescendantFolderIds( folder: TriggerFolder, descendantIds: string[] = null ): string[]{
        descendantIds = descendantIds ? descendantIds : [];

        descendantIds.push( folder.folderId );

        folder.children.forEach( c => this.getDescendantFolderIds( c, descendantIds ) );

        return descendantIds;
    }


    /**
     * Updates the selection state of all folders, show partial/full/none 
     * selection state based on the direct and descendant selected triggers.
     */
    private updateFolderStates(folders: TriggerFolder[]): void {

        this.treeControl.dataNodes.forEach( f => {
            if ( f.isFolder ) {
                let folder = this.findFolderById( f.id, folders );
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

    public updateTriggerProfile( character: CharacterModel, profile: string ): void {
        this.dialogService.showConfirmationDialog(
            [ `Are you sure you want to update the "${profile}" profile?`, 'This will update the profile to include all enabled and disabled triggers from this character, and update all other characters using the same profile.' ],
            'Click "Yes" to update this profile and all characters using this profile.',
            'Click "No" to close this dialog without updating the profile.' )
            .subscribe( confirmed => {
                if ( confirmed ) {
                    
                }
            } );
    }

    public reapplyTriggerProfile( character: CharacterModel, profile: string ): void {
        this.dialogService.showConfirmationDialog(
            [ `Are you sure you want to reapply the "${profile}" profile?`, 'This will reset the character\'s enabled and disabled triggers and reapply from the profile.' ],
            'Click "Yes" to reapply the profile to this character.',
            'Click "No" to close this dialog without reapplying the profile.' )
            .subscribe( confirmed => {
                if ( confirmed ) {
                    
                }
            } );
    }

    public updateCharacter( character: CharacterModel ): void {

        character.extendedDotFocusPercent = this.calculateFocusPercent( character.extendedDotFocusPercent );
        character.extendedBeneficialFocusPercent = this.calculateFocusPercent( character.extendedBeneficialFocusPercent );
        character.beneficialCastingSpeedFocusPercent = this.calculateFocusPercent( character.beneficialCastingSpeedFocusPercent );
        character.extendedBeneficialFocusAaPercent = this.calculateFocusPercent( character.extendedBeneficialFocusAaPercent );
        // let dotExtFocusPct = /([0-9]*)\+([0-9]*)/gi.exec( character.extendedDotFocusPercent?.toString() );
        // if ( dotExtFocusPct?.length > 0 ) {
        //     character.extendedDotFocusPercent = +dotExtFocusPct[ 1 ] + +dotExtFocusPct[ 2 ];
        // } else if ( character.extendedDotFocusPercent ) {
        //     character.extendedDotFocusPercent = +character.extendedDotFocusPercent;
        // } else {
        //     character.extendedDotFocusPercent = null;
        // }

        // let benExtFocusPct = /([0-9]*)\+([0-9]*)/gi.exec( character.extendedBeneficialFocusPercent?.toString() );
        // if ( benExtFocusPct?.length > 0 ) {
        //     character.extendedBeneficialFocusPercent = +benExtFocusPct[ 1 ] + +benExtFocusPct[ 2 ];
        // } else if ( character.extendedBeneficialFocusPercent ) {
        //     character.extendedBeneficialFocusPercent = +character.extendedBeneficialFocusPercent;
        // } else {
        //     character.extendedBeneficialFocusPercent = null;
        // }

        // let benHasteFocusPct = /([0-9]*)\+([0-9]*)/gi.exec( character.beneficialCastingSpeedFocusPercent?.toString() );
        // if ( benHasteFocusPct?.length > 0 ) {
        //     character.beneficialCastingSpeedFocusPercent = +benHasteFocusPct[ 1 ] + +benHasteFocusPct[ 2 ];
        // } else if ( character.beneficialCastingSpeedFocusPercent ) {
        //     character.beneficialCastingSpeedFocusPercent = +character.beneficialCastingSpeedFocusPercent;
        // } else {
        //     character.beneficialCastingSpeedFocusPercent = null;
        // }

        this.ipcService.updateCharacter( character ).subscribe( updated => {
            if ( updated ) {
                if ( this.snackBarTimeoutId != null ) {
                    this.savedLabel.nativeElement.style.display = 'none';
                    window.clearTimeout( this.snackBarTimeoutId );
                    this.snackBarTimeoutId = window.setTimeout( () => {
                        this.savedLabel.nativeElement.style.display = 'block';
                        this.snackBarTimeoutId = window.setTimeout( () => this.savedLabel.nativeElement.style.display = 'none', 5000 );
                    }, 250 );
                } else {
                    this.savedLabel.nativeElement.style.display = 'block';
                    this.snackBarTimeoutId = window.setTimeout( () => this.savedLabel.nativeElement.style.display = 'none', 5000 );
                }

                
            }
        } );
    }

    private calculateFocusPercent( value: string | number ): number {

        let exMatch = /([0-9]*)\+([0-9]*)/gi.exec( value?.toString() );
        let percent: number = null;
        
        if ( exMatch?.length > 0 ) {
            percent = +exMatch[ 1 ] + +exMatch[ 2 ];
        } else if ( value ) {
            percent = +value;
        }

        return isNaN( percent ) ? null : percent;
    }

    public deleteCharacter(character: CharacterModel): void {
        this.dialogService
            .showConfirmDialog(
                `Are you certain you would like to remove ${character.name} [${character.server}]?`, `Click 'Yes' to delete ${character.name}.`, `Click 'No' to keep your character.`,
                confirmed => {
                    if ( confirmed ) {
                        this.ipcService.deleteCharacter( character.characterId ).subscribe( deleted => {
                            if ( deleted ) {
                                
                                this.snackBar.open( 'Character deleted!', 'Dismiss', { duration: 2500 } );
                                this.loadCharacters();
                            }
                        } );
                    }
                } );
    }

    showFileSelector( characterId: string ) {
        this.fileSelector.nativeElement.click();
        this.fileSelector.nativeElement.setAttribute( 'character-id', characterId );
    }

    fileSelected( e: any ) {
        let characterId: string = this.fileSelector.nativeElement.getAttribute( 'character-id' );

        this.fileSelector.nativeElement.setAttribute( 'character-id', null );

        if ( this.fileSelector.nativeElement.files?.length > 0 ) {
            
            let index: number = _.findIndex( this.characters, f => f.characterId === characterId );
            this.characters[ index ].logFile = this.fileSelector.nativeElement.files[ 0 ].path;
            this.ipcService.updateCharacter( this.characters[ index ] ).subscribe( updated => {
                if ( updated ) {
                    this.snackBar.open( 'Character updated!', 'Dismiss', { duration: 2500 } );
                }
            } );

        }
    }

}
