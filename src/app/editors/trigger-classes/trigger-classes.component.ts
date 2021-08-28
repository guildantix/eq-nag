import { Component, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core';
import { CharacterClasses, CharacterClassLevel } from 'src/app/core.model';
import * as _ from 'lodash-es';
import { DialogService } from 'src/app/dialogs/dialog.service';
import { MatTable } from '@angular/material/table';
// import { TriggerAction } from 'src/app/core.model';

@Component( {
    selector: 'app-trigger-classes',
    templateUrl: 'trigger-classes.component.html',
    styleUrls: ['trigger-classes.component.scss', '../../core.scss']
} )
export class TriggerClassesComponent implements OnInit {

    @Input() public classLevels: CharacterClassLevel[];
    @Output() public classLevelsChange: EventEmitter<CharacterClassLevel[]> = new EventEmitter<CharacterClassLevel[]>();

    public classesTableColumns: string[] = [ 'class', 'level', 'delete' ];

    @ViewChild( 'classesTable' ) private classesTable: MatTable<CharacterClassLevel>;

    constructor( private dialogService: DialogService ) { }

    ngOnInit() { }

    public addClassLevel(): void {
        this.classLevels = this.classLevels ? this.classLevels : [];
        this.classLevels.push( new CharacterClassLevel() );
        this.classLevelsChange.emit( this.classLevels );
        this.classesTable?.renderRows();
    }

    public deleteClassLevel( index: number ): void {
        let classLabel: string = _.find( Object.keys( CharacterClasses ), f => CharacterClasses[ f ] === this.classLevels[ index ].class );
        let action = () => {
            this.classLevels?.splice( index, 1 );
            this.classLevelsChange.emit( this.classLevels );
            this.classesTable?.renderRows();
        };

        if ( classLabel ) {
            this.dialogService.showConfirmDialog(
                `Are you certain you want to remove ${classLabel} from this trigger?`,
                'Click "Yes" to remove this class.',
                'Click "No" to cancel and close this dialog without removing the class.',
                ( confirmed ) => {
                    if ( confirmed ) {
                        action();
                    }
                } );
        } else {
            action();
        }
        
    }

}