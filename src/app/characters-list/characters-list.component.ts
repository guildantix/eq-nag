import { Component, OnInit } from '@angular/core';
import { DialogService } from '../dialogs/dialog.service';

@Component( {
    selector: 'app-characters-list',
    templateUrl: 'characters-list.component.html',
    styleUrls: [ 'characters-list.component.scss' ]
} )
export class CharactersListComponent implements OnInit {

    constructor( private dialogService: DialogService ) { }

    ngOnInit(): void { }

    public newCharacter(): void {
        this.dialogService.showNewCharacterDialog();
    }

}
