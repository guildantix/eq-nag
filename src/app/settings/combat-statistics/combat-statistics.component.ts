import { ChangeDetectorRef, Component, Input, OnInit } from '@angular/core';
import { PageEvent } from '@angular/material/paginator';
import { DpsMeterSettings, PlayerInfo, ServerCombatModel, SettingsKeys } from 'src/app/core.model';
import { DialogService } from 'src/app/dialogs/dialog.service';
import { IpcService } from 'src/app/ipc.service';

interface IPlayerGridInfo {
    
    name: string;
    level: number;
    className: string;
    raceName: string;

}

@Component( {
    selector: 'combat-statistics',
    templateUrl: 'combat-statistics.component.html',
    styleUrls: [ '../settings-component/settings.component.scss', '../../core.scss', './combat-statistics.component.scss' ],
} )
export class CombatStatisticsComponent implements OnInit {

    @Input() public showCombatDatabase: boolean = false;

    private _dpsMeterSettings: DpsMeterSettings = new DpsMeterSettings();
    private _dpsPlayerDelayIntervalId: number = null;
    private _dpsPlayerDelayRestoreValue: number | undefined = undefined;
    
    public get dpsShow() : boolean {
        return this._dpsMeterSettings.show;
    }
    public set dpsShow(v : boolean) {
        this._dpsMeterSettings.show = v;
        this.updateSetting( SettingsKeys.dpsMeterSettings, this._dpsMeterSettings, 0 );
    }
    
    public get dpsAutoFade() : boolean {
        return this._dpsMeterSettings.autoFade;
    }
    public set dpsAutoFade(v : boolean) {
        this._dpsMeterSettings.autoFade = v;
        this.updateSetting( SettingsKeys.dpsMeterSettings, this._dpsMeterSettings, 500 );
    }
    
    public get dpsShowOnlyInCombat() : boolean {
        return this._dpsMeterSettings.showOnlyInCombat;
    }
    public set dpsShowOnlyInCombat(v : boolean) {
        this._dpsMeterSettings.showOnlyInCombat = v;
        this.updateSetting( SettingsKeys.dpsMeterSettings, this._dpsMeterSettings, 500 );
    }

    public get dpsOnlyShowWhenFocused() : boolean {
        return !this._dpsMeterSettings.keepOnScreen;
    }
    public set dpsOnlyShowWhenFocused(v : boolean) {
        this._dpsMeterSettings.keepOnScreen = !v;
        this.updateSetting( SettingsKeys.dpsMeterSettings, this._dpsMeterSettings, 0 );
    }

    // TODO: This is going to take some effort on the animation side of things, mixing with mouseenter/mouseleave events.
    // TODO: https://developer.mozilla.org/en-US/docs/Web/API/Element/animationend_event

    // public get dpsFadeDelaySec() : number {
    //     return this._dpsMeterSettings.fadeDelayMs / 1000;
    // }
    // public set dpsFadeDelaySec(v : number) {
    //     this._dpsMeterSettings.fadeDelayMs = v * 1000;
    //     this.updateSetting( SettingsKeys.dpsMeterSettings, this._dpsMeterSettings, 500 );
    // }
    
    // public get dpsFadeDurationSec() : number {
    //     return this._dpsMeterSettings.fadeDurationMs / 1000;
    // }
    // public set dpsFadeDurationSec(v : number) {
    //     this._dpsMeterSettings.fadeDurationMs = v * 1000;
    //     this.updateSetting( SettingsKeys.dpsMeterSettings, this._dpsMeterSettings, 500 );
    // }
    
    // public get dpsFadeOpacity() : number {
    //     return this._dpsMeterSettings.fadeOpacity;
    // }
    // public set dpsFadeOpacity(v : number) {
    //     this._dpsMeterSettings.fadeOpacity = v;
    //     this.updateSetting( SettingsKeys.dpsMeterSettings, this._dpsMeterSettings, 500 );
    // }
    
    public get dpsEncounterResetTimeSec(): number {
        return this._dpsMeterSettings.encounterResetDelayMs / 1000;
    }
    public set dpsEncounterResetTimeSec( value: number ) {
        this._dpsMeterSettings.encounterResetDelayMs = value * 1000;
        this.updateSetting( SettingsKeys.dpsMeterSettings, this._dpsMeterSettings, 500 );
    }
    
    public get dpsEncounterInactiveDelaySec(): number {
        return this._dpsMeterSettings.encounterInactiveDelayMs / 1000;
    }
    public set dpsEncounterInactiveDelaySec( v: number ) {
        this._dpsMeterSettings.encounterInactiveDelayMs = v * 1000;
        this.updateSetting( SettingsKeys.dpsMeterSettings, this._dpsMeterSettings, 500 );
    }
    
    public get dpsPlayerInactiveDelaySec(): number {
        return this._dpsMeterSettings.playerInactiveDelayMs / 1000;
    }
    public set dpsPlayerInactiveDelaySec( v: number ) {
        this.updatePlayerInactiveDelay( v );
    }

    public updatedSettings: string[] = [];

    public playerNames: Record<string, string[]> = {};
    public playerPageIndices: Record<string, number> = {};
    public serverSearchText: Record<string, string> = {};
    public verifiedPlayersGridData: Record<string, IPlayerGridInfo[]> = {};
    public playersDataLength: Record<string, number> = {};

    private _combatDatabases: ServerCombatModel[] = [];
    public get combatDatabases(): ServerCombatModel[] {
        return this._combatDatabases;
    }
    public set combatDatabases( v: ServerCombatModel[] ) {
        this._combatDatabases = v;
        this.playerNames = {};
        for ( const db of v ) {
            this.playerNames[ db.server ] = ( Object.keys( db.verifiedPlayers ) ?? [] ).sort();
            this.playerPageIndices[ db.server ] = 0;
            this.serverSearchText[ db.server ] = null;
        }
        this.refreshLists();
    }

    constructor(
        private readonly ipcService: IpcService,
        private readonly dialogService: DialogService,
        private readonly changeDetectorRef: ChangeDetectorRef,
    ) { }

    ngOnInit() {
        this.loadSettings();
    }










    /**
     * Load settings from the main process.
     */
    loadSettings() {
        this.ipcService.watchSetting<DpsMeterSettings>( SettingsKeys.dpsMeterSettings ).subscribe( f => {
            this._dpsMeterSettings = f;
            this._dpsPlayerDelayRestoreValue = f.playerInactiveDelayMs / 1000;
        } );
        this.ipcService.getCombatDatabases().subscribe( f => this.combatDatabases = f );
    }









    
    /**
     * Generic setting update function.
     * 
     * @param key The setting key.
     * @param value The setting value.
     * @param delay Wait the given milliseconds before submitting changes.  If another change for the same key comes, the timeout is restarted.
     */
    public updateSetting<T>( key: SettingsKeys, value: T, delay: number = null, onExecuted: () => void = null ) {
        this.ipcService.updateSetting( key, value, delay, onExecuted );
        this.updatedSettings.push( key );
    }










    /**
     * Updates the player inactive delay.
     * 
     * @description This is a special case because it has a confirmation dialog if the user chooses a value below the recommended value.
     * 
     * @param v The player inactive delay.
     */
    public updatePlayerInactiveDelay( v: number ) {

        if ( v < 1 ) {
            v = 1;
        }

        if ( this._dpsPlayerDelayIntervalId > 0 ) {
            window.clearTimeout( this._dpsPlayerDelayIntervalId );
        }

        // this._dpsPlayerDelayRestoreValue = this._dpsPlayerDelayRestoreValue ?? this._dpsMeterSettings.playerInactiveDelayMs / 1000;
        this._dpsMeterSettings.playerInactiveDelayMs = v * 1000;
        this.updateSetting( SettingsKeys.dpsMeterSettings, this._dpsMeterSettings, 500, () => this._dpsPlayerDelayRestoreValue = this._dpsPlayerDelayRestoreValue ?? v );

        if ( v < 7 ) {
            this._dpsPlayerDelayIntervalId = window.setTimeout( () => {
                this.dialogService.showConfirmationDialog(
                    [ 'This value should not be less than 7 seconds to account for classes that primarily use damage over time spells.', `Are you sure you want to set this value to ${v} seconds?` ],
                    `Click "Yes" to set the delay to ${v} seconds.`,
                    'Click "Default" to change the delay to 7 seconds.',
                    `Click "Cancel" to close and reset the value back to ${this._dpsPlayerDelayRestoreValue} seconds.`,
                    'normal', null,
                    {
                        'No': 'Default, set to 7 seconds',
                    }
                ).subscribe( confirmed => {
                        if ( confirmed === true ) {
                            this._dpsMeterSettings.playerInactiveDelayMs = v * 1000;
                            this.updateSetting( SettingsKeys.dpsMeterSettings, this._dpsMeterSettings, 500 );
                        } else if ( confirmed === false ) {
                            this._dpsMeterSettings.playerInactiveDelayMs = 7 * 1000;
                            this.updateSetting( SettingsKeys.dpsMeterSettings, this._dpsMeterSettings, 500 );
                        } else {
                            this._dpsMeterSettings.playerInactiveDelayMs = this._dpsPlayerDelayRestoreValue * 1000;
                            this.updateSetting( SettingsKeys.dpsMeterSettings, this._dpsMeterSettings, 500 );
                        }
                        this._dpsPlayerDelayRestoreValue = undefined;
                        this.changeDetectorRef.detectChanges();
                    } );
            }, 2500 );
        } else {
            // this._dpsPlayerDelayRestoreValue = undefined;
        }
    }










    /**
     * Updates the player page index for the given server.
     * 
     * @param server The server to page.
     * @param event The page event args.
     */
    public handlePlayerPageEvent( server: string, event: PageEvent ): void {
        this.playerPageIndices[ server ] = event.pageIndex;
        this.refreshLists();
    }










    /**
     * Updates the lists for each server list, filtering and paging the data.
     * 
     * @param server The server to page and filter.
     */
    public pageAndFilterServerLists( server: string ): void {
        const players = this.combatDatabases.find( f => f.server === server )?.verifiedPlayers ?? {};
        const search = this.serverSearchText[ server ]?.toLowerCase()?.trim();

        let filteredData: IPlayerGridInfo[] = [];
        for ( let i = 0; i < this.playerNames[ server ].length; i++ ) {
            let p = players[ this.playerNames[ server ][ i ] ] as IPlayerGridInfo;
            p.name = this.playerNames[ server ][ i ];
            if ( search != null && search.length > 0 && p.name.toLowerCase().indexOf( search ) < 0 && p.className.toLowerCase().indexOf( search ) < 0 ) {
                continue;
            }
            filteredData.push( p );
        }
        this.playersDataLength[ server ] = filteredData.length;

        const skip = this.playerPageIndices[ server ] * 10;
        const take = skip + 10 > filteredData.length ? filteredData.length : skip + 10;
        const result: IPlayerGridInfo[] = [];
        for ( let i = skip; i < take; i++ ) {
            result.push( filteredData[ i ] );
        }

        this.verifiedPlayersGridData[ server ] = result;
    }










    /**
     * Refreshes all server lists.
     */
    public refreshLists() {
        for ( const db of this.combatDatabases ) {
            this.pageAndFilterServerLists( db.server );
        }
    }










    /**
     * Updates the search text for the given server, and refreshes and filters 
     * all server lists.
     * 
     * @param server The server to search.
     */
    public handleSearchTextChange( server: string ): void {
        
        this.refreshLists();

        // If the index is greater than the number of pages, set it to the last page.
        let i = this.playerPageIndices[ server ];
        if ( i > Math.floor( this.playersDataLength[ server ] / 10 ) ) {
            i = Math.floor( this.playersDataLength[ server ] / 10 );
        }

        // If we've changed the index, then we need to refresh the lists again.
        if ( i !== this.playerPageIndices[ server ] ) {
            this.playerPageIndices[ server ] = i;
            this.refreshLists();
        }
    }










}
