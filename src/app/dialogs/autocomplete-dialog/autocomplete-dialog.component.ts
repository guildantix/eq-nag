import { Component, Inject, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialog } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { InputDialogComponent } from '../input-dialog/input-dialog.component';
import { AutocompleteDialogModel } from './autocomplete-dialog.model';
import Fuse from 'fuse.js';
import * as _ from 'lodash-es';
// import { Fuse } from 'fuse.js';
// import * as fz from 'fuse.js';

@Component( {
    selector: 'app-autocomplete-dialog',
    templateUrl: 'autocomplete-dialog.component.html',
    styleUrls: [ 'autocomplete-dialog.component.scss', '../dialog.styles.scss' ]
} )
export class AutoCompleteDialogComponent implements OnInit {

    public model: string;
    public messages: string[] = [];
    public options: string[] = [];
    public filteredOptions: Observable<string[]>;
    public inputControl = new FormControl<string>( '' );

    constructor(
        public dialogRef: MatDialogRef<InputDialogComponent>,
        @Inject( MAT_DIALOG_DATA ) public data: AutocompleteDialogModel,
        public dialog: MatDialog ) {
        
        if ( data.message instanceof Array ) {
            this.messages = data.message;
        } else {
            this.messages.push( data.message );
        }

        this.options = data.options;
    }

    ngOnInit() {
        
        this.filteredOptions = this.inputControl.valueChanges.pipe(
            startWith( '' ),
            map( value => this._filter( value ) )
        );

    }

    private _filter( value: string ): string[] {
        const fuseConfig = {
            includeScore: true
        };
          
        const fuse = new Fuse( this.options, fuseConfig );
          
        const result = fuse.search( value );

        let scoreLimit = 0.85;
        let scores = result.map( item => item.score );
        let minScore = _.min( scores );

        if ( minScore < 0.35 ) {
            scoreLimit = 0.35;
        } else if ( minScore < 0.50 ) {
            scoreLimit = 0.50;
        }

        return result.filter( v => v.score < scoreLimit ).map( v => v.item );
        // const filterValue = value.toLowerCase();
  
        // return this.options.filter( option => option.toLowerCase().indexOf( filterValue ) === 0 );
    }

}