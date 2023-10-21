import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CharacterModel, TriggerFolder, TriggerModel, TriggersProfileModel } from '../core.model';
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
    treeControl: FlatTreeControl<CharacterTriggerTreeNode>;
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
    public treeFlattener = new MatTreeFlattener(this._transformer, node => node.level, node => node.expandable, node => node.children);
    public hasChild = ( _: number, node: CharacterTriggerTreeNode ) => node.expandable;
    public characterData: Record<string, CharacterTriggerData> = {};
    public characterTriggerSaveDelayMs: number = 1000;
    public characterSaveTimeoutIds: Record<string, number> = {};

    public characters: CharacterModel[] = [];
    public selectedTabIndex: number = -1;
    public activeLogFilesDictionary: any = {};
    public triggerProfiles: TriggersProfileModel[] = [];
    
    @ViewChild( 'fileSelector' ) private fileSelector: ElementRef<HTMLInputElement>;
    @ViewChild( 'savedLabel' ) private savedLabel: ElementRef<HTMLDivElement>;

    private snackBarTimeoutId: number = null;

    constructor( private dialogService: DialogService, private ipcService: IpcService, private snackBar: MatSnackBar ) { }

    ngOnInit(): void {
        this.loadCharacters();
        this.ipcService.characterLogActivated().subscribe( chrId => this.activeLogFilesDictionary[ chrId ] = true );
        this.ipcService.characterLogDeactivated().subscribe( chrId => this.activeLogFilesDictionary[ chrId ] = false );
        this.ipcService.getTriggerProfiles().subscribe( profiles => this.triggerProfiles = profiles );
        
        this.ipcService.tickReceived().subscribe( tick => {
            
            if ( tick.triggerProfileDisabledTriggers?.length > 0 ) {
                tick.triggerProfileDisabledTriggers.forEach( tp => {
                    let profile = this.triggerProfiles.find( f => f.profileId === tp.triggerProfileId );
                    if ( profile ) {
                        profile.disabledTriggers = tp.disabledTriggers;
                        // Loading character profile isn't necessary, because profile is only used to set an initial state.  Any changes further are only applied when actively used by the user. via the Update for all, or reapply for one.
                    }
                } );
            }

            if ( tick.characterDisabledTriggers?.length > 0 ) {
                tick.characterDisabledTriggers.forEach( cd => {
                    let character = this.characters.find( f => f.characterId === cd.characterId );
                    if ( character ) {
                        let intersection = character.disabledTriggers.filter( x => cd.disabledTriggers.includes( x ) );
                        if ( tick.triggerChanges || intersection.length !== character.disabledTriggers.length || intersection.length !== cd.disabledTriggers.length ) {
                            character.disabledTriggers = cd.disabledTriggers;
                            
                            if ( this.characterData[ character.characterId ] ) {
                                delete this.characterData[ character.characterId ];
                                if ( this.selectedTabIndex === this.characters.findIndex( f => f.characterId === character.characterId ) ) {
                                    this.onCharacterSelected( character );
                                }
                            }
                        }
                    }
                } );
            }
        } );
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

    /**
     * Loads the triggers for the specified character and builds the tree 
     * data.  If the data has already been loaded, it is refreshed.
     * 
     * @param character The character that was selected.
     * @param index The index of the tab that was selected.
     */
    public onCharacterSelected( character: CharacterModel, index: number | undefined = undefined ): void {
        this.selectedTabIndex = index === 0 || index > 0 ? index : _.findIndex( this.characters, f => f.characterId === character.characterId );

        if ( !this.characterData[ character.characterId ] ) {
            this.ipcService.getTriggerFolders().subscribe( folders => {
                this.ipcService.getTriggers().subscribe( triggers => {

                    let data: CharacterTriggerTreeObject[] = [];
                    folders.forEach( folder => this.processFolder( folder, triggers, data, character.disabledTriggers ) );
                    let treeControl = new FlatTreeControl<CharacterTriggerTreeNode>( node => node ? node.level : 1, node => node.expandable );

                    this.characterData[ character.characterId ] = {
                        folders: folders,
                        triggers: triggers,
                        treeControl: treeControl,
                        dataSource: new MatTreeFlatDataSource( treeControl, this.treeFlattener ),
                    };
                    
                    this.characterData[ character.characterId ].dataSource.data = data;
    
                    this.updateFolderStates( character );
                    
                } );
            } );
        } else {
            this.updateCharacterTrigerSelectState( character );
            this.onTriggerSelectChange( character );
            this.updateFolderStates( character );
        }
    }

    /**
     * Confirms the user wants to delete the specified trigger profile, then if 
     * confirmed deletes the profile.
     * 
     * @param event The mouse event that triggered this method.
     * @param profileId The id of the profile to delete.
     */
    public deleteTriggerProfile(event: MouseEvent, profileId: string): void {
        event.preventDefault();
        event.stopPropagation();

        let profile = this.triggerProfiles.find( f => f.profileId === profileId );
        if ( profile ) {
            this.dialogService
                .showConfirmationDialog( 'Are you sure you want to delete this profile?', 'Click "Yes" to delete this profile.', 'Click "No" to close this dialog without deleting the profile.' )
                .subscribe( confirmed => {
                    if ( confirmed ) {
                        this.ipcService.deleteTriggerProfile( profile.profileId ).subscribe( deleted => {
                            if ( deleted ) {
                                this.triggerProfiles.splice( this.triggerProfiles.indexOf( profile ), 1 );
                                this.snackBar.open( 'Profile deleted!', 'Dismiss', { duration: 2500 } );
                                this.characters.forEach( c => {
                                    if ( c.triggerProfile === profile.profileId ) {
                                        c.triggerProfile = null;
                                    }
                                    this.ipcService.updateCharacter( c ).subscribe( updated => { } );
                                } );
                            }
                        } );
                    }
                } );
        }
    }

    /**
     * Returns the specified profile's name.
     * 
     * @param profileId The id of the profile
     */
    public getProfileName( profileId: string ): string {
        let profile = this.triggerProfiles.find( f => f.profileId === profileId );
        return profile?.name ?? 'Unknown';
    }

    /**
     * Adds a new trigger profile to the server and adds it to the given 
     * character. The new profile will have the same disabled triggers as the 
     * character.
     * 
     * @param character The character to add the trigger profile to.
     */
    public addTriggerProfile( character: CharacterModel ): void {
        this.dialogService
            .showInputDialog( 'Add Trigger Profile', 'Enter a name for the new profile.', undefined, 'Profile Name' )
            .subscribe( name => {
                if ( name ) {
                    
                    let profile = new TriggersProfileModel();
                    
                    profile.name = name;
                    profile.disabledTriggers = character.disabledTriggers?.slice() ?? [];
                    profile.disableTriggersByDefault = character.disableTriggersByDefault;

                    this.ipcService.updateTriggerProfile( profile ).subscribe( profileId => {
                        if ( profileId ) {
                            profile.profileId = profileId;
                            this.triggerProfiles.push( profile );
                            character.triggerProfile = profileId;
                            this.snackBar.open( 'Profile added!', 'Dismiss', { duration: 2500 } );
                        }
                    } );

                }
            } );
    }

    /**
     * Updates the specified profile's disabled trigger list to match exactly 
     * the given character's list of disabled triggers.
     * 
     * @param character The character to update the profile for.
     * @param profileId The id of the profile.
     */
    public updateTriggerProfile( character: CharacterModel, profileId: string ): void {
        let profile = this.triggerProfiles.find( f => f.profileId === profileId );

        const execute = () => {
            // Updates the profile with the new disabled triggers.
            profile.disabledTriggers = character.disabledTriggers.slice();
            profile.disableTriggersByDefault = character.disableTriggersByDefault;

            // Updates all characters using this profile with the new disabled triggers.
            this.characters.forEach( character => {
                if ( character.triggerProfile === profile.profileId ) {
                    
                    character.disabledTriggers = profile.disabledTriggers.slice();
                    character.disableTriggersByDefault = profile.disableTriggersByDefault;

                    if ( this.characterData[ character.characterId ] ) {

                        // If their triggers list has been loaded, let's update the tree.
                        this.updateCharacterTrigerSelectState( character );
                        this.onTriggerSelectChange( character );
                        this.updateFolderStates( character );

                    }
                    
                    // Finally, save the character.
                    this.saveCharacterDelay( character, true );
                }
            } );

            // Finally, send the updated profile to the server.
            this.ipcService.updateTriggerProfile( profile ).subscribe( updated => {
                if ( updated ) {
                    this.snackBar.open( 'Profile updated!', 'Dismiss', { duration: 2500 } );
                }
            } );
        }

        if ( profile ) {
            this.dialogService.showConfirmationDialog(
                [ `Are you sure you want to update the "${profile.name}" profile?`, 'This will update the profile to include all enabled and disabled triggers from this character, and update all other characters using the same profile.' ],
                'Click "Yes" to update this profile and all characters using this profile.',
                'Click "No" to close this dialog without updating the profile.' )
                .subscribe( confirmed => {
                    if ( confirmed ) {
                        execute();
                    }
                } );
        }
    }

    /**
     * Applies the given profile to the given character.
     * 
     * @param character The character to apply the profile to.
     * @param profile The profile to apply.
     */
    private applyTriggerProfile( character: CharacterModel, profile: TriggersProfileModel ): void {
        character.disabledTriggers = profile.disabledTriggers.slice();
        character.disableTriggersByDefault = profile.disableTriggersByDefault;
        this.updateCharacterTrigerSelectState( character );
        this.onTriggerSelectChange( character );
        this.updateFolderStates( character );
        this.saveCharacterDelay( character );
    }

    /**
     * Reapplies the specified profile to the given character. This will reset 
     * their selected disabled triggers and folders.
     * 
     * @param character The character to reapply the profile to.
     * @param profileId The id of the profile to reapply.
     */
    public reapplyTriggerProfile( character: CharacterModel, profileId: string ): void {
        let profile = this.triggerProfiles.find( f => f.profileId === profileId );

        if ( profile ) {
            this.dialogService.showConfirmationDialog(
                [ `Are you sure you want to reapply the "${profile}" profile?`, 'This will reset the character\'s enabled and disabled triggers and reapply from the profile.' ],
                'Click "Yes" to reapply the profile to this character.',
                'Click "No" to close this dialog without reapplying the profile.' )
                .subscribe( confirmed => {
                    if ( confirmed ) {
                        this.applyTriggerProfile( character, profile );
                    }
                } );
        }
    }

    /**
     * Reapplies the selected states for the given character's triggers based 
     * on their disabled triggers array.
     * 
     * @param character The character to reapply trigger select states for.
     */
    public updateCharacterTrigerSelectState( character: CharacterModel ): void {
            
        this.characterData[ character.characterId ].dataSource.data.forEach( node => {
            if ( node.trigger?.triggerId && character.disabledTriggers.includes( node.trigger.triggerId ) ) {
                node.selected = true;
            } else {
                node.selected = false;
            }
        } );

        this.characterData[ character.characterId ].treeControl.dataNodes.forEach( node => {
            if ( !node.isFolder && character.disabledTriggers.includes( node.id ) ) {
                node.selected = true;
            } else if ( !node.isFolder ) {
                node.selected = false;
            }
        } );

    }

    /**
     * Reapplies the profile for the given character, if they have a profile 
     * selected.
     * 
     * @param character The character that had their trigger profile changed.
     */
    public onTriggerProfileChanged( character: CharacterModel ): void {
        let profile = this.triggerProfiles.find( f => f.profileId === character.triggerProfile );

        if ( profile ) {
            this.applyTriggerProfile( character, profile );
        }
    }

    /**
     * Triggers the update folder states method.
     */
    onTriggerSelectChange( character: CharacterModel ): void {
        this.updateFolderStates( character );
    }

    /**
     * Saves the given character after a delay. If the character is saved 
     * again, the delay is restarted.
     * 
     * @param character The character to save.
     * @param silent If true, no snackbar will be shown.
     */
    saveCharacterDelay( character: CharacterModel, silent: boolean = false ): void {

        // If there is already a save timeout, clear it.
        if ( this.characterSaveTimeoutIds[ character.characterId ] ) {
            window.clearTimeout( this.characterSaveTimeoutIds[ character.characterId ] );
            delete this.characterSaveTimeoutIds[ character.characterId ];
        }

        // Set a new save timeout.
        this.characterSaveTimeoutIds[ character.characterId ] = window.setTimeout( () => {
            this.ipcService.updateCharacter( character ).subscribe( updated => {
                if ( updated && !silent ) {
                    this.snackBar.open( 'Character updated!', 'Dismiss', { duration: 2500 } );
                }

                delete this.characterSaveTimeoutIds[ character.characterId ];
            } );
        }, this.characterTriggerSaveDelayMs );
    }

    /**
     * Toggles the selected state of the given trigger.  If the node is a 
     * trigger, it is added/removed from the disabled triggers list. If the 
     * node is a folder, all triggers in the folder are added/removed from 
     * the disabled triggers list.
     * 
     * @param character The character to toggle the trigger for.
     * @param node The tree view node, either folder or trigger, to toggle.
     */
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

        this.saveCharacterDelay( character );
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
            let triggers = this.characterData[ character.characterId ].treeControl.dataNodes.filter( t => !t.isFolder && t.item.folderId === familyIds[ i ] );
            triggers.forEach( f => {
                f.selected = value;
                if ( value && !character.disabledTriggers.includes( f.id ) ) {
                    character.disabledTriggers.push( f.id );
                } else if ( !value && character.disabledTriggers.includes( f.id ) ) {
                    character.disabledTriggers.splice( character.disabledTriggers.indexOf( f.id ), 1 );
                }
            } );
        }
        
        this.updateFolderStates( character );

        this.saveCharacterDelay( character );
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
    private updateFolderStates( character: CharacterModel ): void {

        this.characterData[ character.characterId ].treeControl.dataNodes.forEach( f => {
            if ( f.isFolder ) {
                let folder = this.findFolderById( f.id, this.characterData[ character.characterId ].folders );
                let familyIds = this.getDescendantFolderIds( folder );
                let triggerCount = 0;
                let selectedTriggerCount = 0;
                
                for ( let i = 0; i < familyIds?.length; i++ ) {
                    let triggers = this.characterData[ character.characterId ].treeControl.dataNodes.filter( t => !t.isFolder && t.item.folderId === familyIds[ i ] );
                    triggerCount += triggers.length;
                    selectedTriggerCount += triggers.filter( t => t.selected ).length;
                }

                f.folderState = triggerCount === selectedTriggerCount && triggerCount > 0 ? 'all' :
                    selectedTriggerCount === 0 ? 'none' : 'partial';
            }
        } );
        
    }

    public updateCharacter( character: CharacterModel ): void {

        character.extendedDotFocusPercent = this.calculateFocusPercent( character.extendedDotFocusPercent );
        character.extendedBeneficialFocusPercent = this.calculateFocusPercent( character.extendedBeneficialFocusPercent );
        character.beneficialCastingSpeedFocusPercent = this.calculateFocusPercent( character.beneficialCastingSpeedFocusPercent );
        character.beneficialCastingSpeedFocusAaPercent = this.calculateFocusPercent( character.beneficialCastingSpeedFocusAaPercent );
        character.extendedBeneficialFocusAaPercent = this.calculateFocusPercent( character.extendedBeneficialFocusAaPercent );

        if ( character.beneficialCastingSpeedFocusAaDurationLimit ) {
            let limit = +character.beneficialCastingSpeedFocusAaDurationLimit;
            if ( limit < 100 ) {
                character.beneficialCastingSpeedFocusAaDurationLimit = limit * 1000;
            } else {
                character.beneficialCastingSpeedFocusAaDurationLimit = limit;
            }
        } else {
            character.beneficialCastingSpeedFocusAaDurationLimit = null;
        }
        
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
