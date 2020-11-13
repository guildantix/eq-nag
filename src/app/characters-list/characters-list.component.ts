import { Component, OnInit } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CharacterModel } from '../core.model';
import { DialogService } from '../dialogs/dialog.service';
import { IpcService } from '../ipc.service';
import * as _ from 'lodash';

@Component( {
    selector: 'app-characters-list',
    templateUrl: 'characters-list.component.html',
    styleUrls: [ 'characters-list.component.scss' ]
} )
export class CharactersListComponent implements OnInit {

    public characters: CharacterModel[] = [];
    public selectedTabIndex: number = -1;

    constructor( private dialogService: DialogService, private ipcService: IpcService, private snackBar: MatSnackBar ) { }

    ngOnInit(): void {
        this.loadCharacters();
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

    public updateCharacter( character: CharacterModel ): void {
        this.ipcService.updateCharacter( character ).subscribe( updated => {
            if ( updated ) {
                this.snackBar.open( 'Character updated!', 'Dismiss', { duration: 2500 } );
            }
        } );
    }

    public deleteCharacter(character: CharacterModel): void {
        this.dialogService
            .showConfirmDialog(
                `Are you certain you would like to remove ${character.name} [${character.server}]?`, `Click 'Yes' to delete ${character.name}.`, `Click 'No' to keep your character.`,
                confirmed => {
                    if ( confirmed ) {
                        this.ipcService.deleteCharacter( character.characterId ).subscribe( deleted => {
                            if ( deleted ) {
                                
                                if ( document.activeElement instanceof HTMLElement ) {
                                    // This is a workaround to prevent the error:
                                    // 
                                    //      ExpressionChangedAfterItHasBeenCheckedError: Expression has changed after it was checked. Previous value for 'mat-form-field-should-float': 'false'. Current value: 'true'.
                                    //
                                    // I'm sure there's some deeper meaning behind it, but for some 
                                    // reason when the confirm dialog's `Yes` button is still the 
                                    // active element at this point, that error is written to the 
                                    // console.
                                    document.activeElement.blur();
                                }
                                
                                this.snackBar.open( 'Character deleted!', 'Dismiss', { duration: 2500 } );
                                this.loadCharacters();
                            }
                        } );
                    }
                } );
    }

}
