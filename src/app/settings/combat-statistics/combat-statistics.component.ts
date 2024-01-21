import { AfterViewInit, ChangeDetectorRef, Component, Input, OnDestroy, OnInit } from '@angular/core';
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

interface IPetGridInfo {
    
    name: string;
    ownerName: string;

}

const pageSize = 10;

let settingsSection: HTMLDivElement = null;
let scrolling: boolean = false;
let scrollDistance: number = 0;
let timeoutId: number = null;
const executeScroll = ( deltaY ) => {
    lastScrollHeight = settingsSection.scrollTop;
    settingsSection.scrollBy( { top: deltaY, behavior: 'smooth' } );
    scrolling = true;
    window.requestAnimationFrame( checkForScrolling );
};
const disableWheelEvent = ( e: WheelEvent ) => {
    e.preventDefault();
    e.stopPropagation();

    settingsSection = settingsSection ?? document.querySelector( 'settings-window section' );
    if ( settingsSection ) {
        scrollDistance += e.deltaY;

        if ( !scrolling ) {
            if ( timeoutId ) {
                window.clearTimeout( timeoutId );
            }
            timeoutId = window.setTimeout( () => {
                executeScroll( scrollDistance );
                scrollDistance = 0;
            }, 40 );
        }
    }
    
    return false;
};

let lastScrollHeight: number = 0;
let lastChangedFrame = 0;
let frameCount = 0;
const checkForScrolling = () => {
    frameCount++;
    if ( frameCount > 120 || ( frameCount - lastChangedFrame ) > 5 ) {
        scrolling = false;
        frameCount = 0;
        if ( scrollDistance !== 0 ) {
            
            timeoutId = window.setTimeout( () => {
                executeScroll( scrollDistance );
                scrollDistance = 0;
            }, 20 );
        }
    }
    settingsSection = settingsSection ?? document.querySelector( 'settings-window section' );
    if ( settingsSection && settingsSection.scrollTop !== lastScrollHeight ) {
        scrolling = true;
        lastChangedFrame = frameCount;
        lastScrollHeight = settingsSection.scrollTop;
    }
    if ( scrolling ) {
        window.requestAnimationFrame( checkForScrolling );
    }
}

@Component( {
    selector: 'combat-statistics',
    templateUrl: 'combat-statistics.component.html',
    styleUrls: [ '../settings-component/settings.component.scss', '../../core.scss', './combat-statistics.component.scss' ],
} )
export class CombatStatisticsComponent implements OnInit, AfterViewInit, OnDestroy {

    @Input() public showCombatDatabase: boolean = false;

    private _dpsMeterSettings: DpsMeterSettings = new DpsMeterSettings();
    private _dpsPlayerDelayIntervalId: number = null;
    private _dpsPlayerDelayRestoreValue: number | undefined = undefined;
    
    public get pageSize(): number {
        return pageSize;
    }

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
    public petPageIndices: Record<string, number> = {};
    public npcPageIndices: Record<string, number> = {};
    public serverSearchText: Record<string, string> = {};
    public verifiedPlayersGridData: Record<string, IPlayerGridInfo[]> = {};
    public verifiedPetsGridData: Record<string, IPetGridInfo[]> = {};
    public verifiedNpcsGridData: Record<string, string[]> = {};
    public playersDataLength: Record<string, number> = {};
    public petDataLength: Record<string, number> = {};
    public npcDataLength: Record<string, number> = {};

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
            this.petPageIndices[ db.server ] = 0;
            this.npcPageIndices[ db.server ] = 0;
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

    ngAfterViewInit(): void {
        document.querySelector('mat-tab-group')?.addEventListener( 'wheel', disableWheelEvent );
    }

    ngOnDestroy(): void {
        document.querySelector('mat-tab-group')?.removeEventListener( 'wheel', disableWheelEvent );
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
     * Updates the pet page index for the given server.
     * 
     * @param server The server to page.
     * @param event The page event args.
     */
    public handlePetPageEvent( server: string, event: PageEvent ): void {
        this.petPageIndices[ server ] = event.pageIndex;
        this.refreshLists();
    }










    /**
     * Updates the npc page index for the given server.
     * 
     * @param server The server to page.
     * @param event The page event args.
     */
    public handleNpcPageEvent( server: string, event: PageEvent ): void {
        this.npcPageIndices[ server ] = event.pageIndex;
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

        const skip = this.playerPageIndices[ server ] * pageSize;
        const take = skip + pageSize > filteredData.length ? filteredData.length : skip + pageSize;
        const result: IPlayerGridInfo[] = [];
        for ( let i = skip; i < take; i++ ) {
            result.push( filteredData[ i ] );
        }

        this.verifiedPlayersGridData[ server ] = result;

        const pets = this.combatDatabases.find( f => f.server === server )?.verifiedPets?.sort() ?? [];
        const petOwners = this.combatDatabases.find( f => f.server === server )?.petOwners ?? {};
        let filteredPetData: IPetGridInfo[] = [];
        for ( let i = 0; i < pets.length; i++ ) {
            let petName = pets[ i ];
            let ownerName = petOwners[ petName ];
            if ( search != null && search.length > 0 && petName.toLowerCase().indexOf( search ) < 0 && ( ownerName?.toLowerCase()?.indexOf( search ) ?? -1 ) < 0 ) {
                continue;
            }
            let namedPet = petName.indexOf( '`' ) > 0;
            if ( !namedPet ) {
                filteredPetData.push( { name: petName, ownerName: ownerName } );
            }
        }
        this.petDataLength[ server ] = filteredPetData.length;

        const skipPet = this.petPageIndices[ server ] * pageSize;
        const takePet = skipPet + pageSize > filteredPetData.length ? filteredPetData.length : skipPet + pageSize;
        const resultPet: IPetGridInfo[] = [];
        for ( let i = skipPet; i < takePet; i++ ) {
            resultPet.push( filteredPetData[ i ] );
        }
        this.verifiedPetsGridData[ server ] = resultPet;


        const npcs = this.combatDatabases.find( f => f.server === server )?.verifiedNpcs?.sort() ?? [];
        let filteredNpcData: string[] = npcs.filter( f => search == null || search.length === 0 || f.toLowerCase().indexOf( search ) >= 0 );
        this.npcDataLength[ server ] = filteredNpcData.length;

        const skipNpc = this.npcPageIndices[ server ] * pageSize;
        const takeNpc = skipNpc + pageSize > filteredNpcData.length ? filteredNpcData.length : skipNpc + pageSize;
        const resultNpc: string[] = [];
        for ( let i = skipNpc; i < takeNpc; i++ ) {
            resultNpc.push( filteredNpcData[ i ] );
        }
        this.verifiedNpcsGridData[ server ] = resultNpc;
        
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
        let playerIndex = this.playerPageIndices[ server ];
        if ( playerIndex > Math.floor( this.playersDataLength[ server ] / pageSize ) ) {
            playerIndex = Math.floor( this.playersDataLength[ server ] / pageSize );
        }

        let petIndex = this.petPageIndices[ server ];
        if ( petIndex > Math.floor( this.petDataLength[ server ] / pageSize ) ) {
            petIndex = Math.floor( this.petDataLength[ server ] / pageSize );
        }

        let npcIndex = this.npcPageIndices[ server ];
        if ( npcIndex > Math.floor( this.npcDataLength[ server ] / pageSize ) ) {
            npcIndex = Math.floor( this.npcDataLength[ server ] / pageSize );
        }

        // If we've changed the index, then we need to refresh the lists again.
        if ( playerIndex !== this.playerPageIndices[ server ] || petIndex !== this.petPageIndices[ server ] || npcIndex !== this.npcPageIndices[ server ] ) {
            this.playerPageIndices[ server ] = playerIndex;
            this.petPageIndices[ server ] = petIndex;
            this.npcPageIndices[ server ] = npcIndex;
            this.refreshLists();
        }
    }









    
    /**
     * Moves the specified player or npc to the pets list.
     * 
     * @param server The name of the server.
     * @param name The name of the player or npc.
     * @param type The type of the entity.
     */
    public moveToPets( server: string, name: string, type: 'player' | 'npc' ): void {
        const db = this.combatDatabases.find( f => f.server === server );
        
        if ( db == null ) {
            return;
        }

        if ( type === 'player' ) {
            let player = db.verifiedPlayers[ name ] as IPlayerGridInfo;
            if ( player != null ) {
                delete db.verifiedPlayers[ name ];

                this.playerNames[ db.server ] = ( Object.keys( db.verifiedPlayers ) ?? [] ).sort();
            }
        } else if ( type === 'npc' ) {
            let npc = db.verifiedNpcs.find( f => f === name );
            if ( npc != null ) {
                db.verifiedNpcs.splice( db.verifiedNpcs.findIndex( f => f === name ), 1 );
            }
        }

        let pet = db.verifiedPets.find( f => f === name );
        if ( pet == null ) {
            db.verifiedPets.push( name );
        }

        this.saveChanges( server );
        this.refreshLists();
    }










    /**
     * Updates the database for the specified server.
     * 
     * @param server The server to update.
     */
    public saveChanges( server: string ): void {
        const db = this.combatDatabases.find( f => f.server === server );
        console.warn( 'Not Yet Implemented', 'CombatStatisticsComponent.saveChanges' );
        console.log( 'saving db', db );
        // TODO: Save the database.
        // this.ipcService.saveCombatDatabase( db ).subscribe( f => {
        //     this.combatDatabases = f;
        //     this.refreshLists();
        // } );
    }










}
