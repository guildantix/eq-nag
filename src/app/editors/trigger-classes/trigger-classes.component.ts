import { Component, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core';
import { CharacterClasses, CharacterClassLevel, CharacterClassNames, SelectableClassLevel } from 'src/app/core.model';
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

    public tableData: SelectableClassLevel[] = [];
    public get leftTableData(): SelectableClassLevel[] {
        return this.tableData.slice( 0, 8 );
    }
    public get rightTableData(): SelectableClassLevel[] {
        return this.tableData.slice( 8 );
    }
    @Input() public set classLevels( value: CharacterClassLevel[] ) {
        if ( this.tableData.length === 0 ) {
            this.tableData = _.map( CharacterClassNames, ( tdValue, key ) => {
                let classLevel = _.find( value, f => CharacterClasses[ tdValue ] === f.class );
                return <SelectableClassLevel>{
                    class: tdValue,
                    level: classLevel?.level,
                    selected: classLevel != null,
                };
            } );
            this.classesTable?.renderRows();
        }
    }
    public get classLevels(): CharacterClassLevel[] {
        let data = _.map( this.tableData.filter( f => f.selected ), f => {
            return <CharacterClassLevel>{
                class: CharacterClasses[f.class],
                level: f.selected ? f.level : null,
            };
        } );
        return data;
    }
    @Output() public classLevelsChange: EventEmitter<CharacterClassLevel[]> = new EventEmitter<CharacterClassLevel[]>();

    public classesTableColumns: string[] = [ 'selected', 'class', 'level' ];

    @ViewChild( 'classesTable' ) private classesTable: MatTable<CharacterClassLevel>;

    constructor() { }

    ngOnInit() { }









    
    /**
     * Emits the change event for the class levels.
     */
    public emitChange() {
        this.tableData.forEach( f => f.level = f.selected ? f.level : null ); // clear out levels for unselected classes
        this.classLevelsChange.emit( this.classLevels );
    }









    
    /**
     * Toggles the selected state of the class level.
     * 
     * @param classLevel The selectable class level to toggle.
     */
    public toggleSelected( classLevel: SelectableClassLevel ): void {
        classLevel.selected = !classLevel.selected;
        this.emitChange();
    }










}