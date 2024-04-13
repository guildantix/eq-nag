import { Component, OnInit } from '@angular/core';

@Component( {
    selector: 'app-combat-statistics',
    templateUrl: './combat-statistics.component.html',
    styleUrls: [ './combat-statistics.component.scss' ]
} )
export class CombatStatisticsComponent implements OnInit {

    public _enableCombatStatistics: boolean = true;
    public get enableCombatStatistics(): boolean {
        return this._enableCombatStatistics;
    }
    public set enableCombatStatistics( value: boolean ) {
        this._enableCombatStatistics = value;
        // TODO: Save to settings
    }

    constructor() { }

    ngOnInit(): void {
    }

}
