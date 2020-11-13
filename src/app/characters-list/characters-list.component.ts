import { Component, OnInit } from '@angular/core';
import { CharacterModel } from '../core.model';
import { DialogService } from '../dialogs/dialog.service';
import { IpcService } from '../ipc.service';

@Component( {
    selector: 'app-characters-list',
    templateUrl: 'characters-list.component.html',
    styleUrls: [ 'characters-list.component.scss' ]
} )
export class CharactersListComponent implements OnInit {

    public characters: CharacterModel[] = [];

    constructor( private dialogService: DialogService, private ipcService: IpcService ) { }

    ngOnInit(): void {
        this.loadCharacters();
    }

    public newCharacter(): void {
        this.dialogService.showNewCharacterDialog( () => this.loadCharacters() );
    }

    public loadCharacters(): void {
        this.ipcService.getCharacters().subscribe( data => this.characters = data );
    }

}
