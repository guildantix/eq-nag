import { Injectable, NgZone } from '@angular/core';
import * as Electron from 'electron';
import { UpdateInfo } from 'electron-updater';
import { Observable, Observer } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { DataTickModel, DkpEntryModel, TriggerModel, OverlayWindowModel, ActionTypes, FocusEffectSettings, CharacterModel, BasicError, TriggerFolder, FileModel, Tag, AuthorModel, PackageFileModel, TriggerPackageMetaModel, TriggerPackageVersion, FctStylesModel, OverlayBoundsChangedEventArgs, DialogEventArgs, QuickShareMetaModel, LogFileLocation, IpcMessage, DeathRecapPreferences, QuickShareAuthorListTypes, Progress, QuitFailureData, DuplicateTriggerAction, ScrapedSpell, ScrapedClickEffect, TriggerParseHistoryModel, SimulationProgress, FctCombatGroup, CombatTypes, StylePropertiesModel, CombatAnimations, TriggersProfileModel, ConsoleMessageModel, LogTypes } from './core.model';
import { GinaConfiguration, GinaTriggerGroups } from './gina.model';
import { ColorUtility } from './utilities';
import { nagId } from './core/nag-id.util';

@Injectable( { providedIn: 'root' })
export class IpcService {

    private _successfulParses: TriggerParseHistoryModel[] = [];
    private _failedParses: TriggerParseHistoryModel[] = [];
    private _consoleMessages: ConsoleMessageModel[] = [];
    
    private _tickObservers: Observer<DataTickModel>[] = [];
    private _transmitObservers: Observer<DkpEntryModel[]>[] = [];
    private _logFileChangeObservers: Observer<string>[] = [];
    private _dkpAddedObservers: Observer<DkpEntryModel>[] = [];
    private _dkpRemovedObservers: Observer<string>[] = [];
    private _consoleLogRequestObservers: Observer<any>[] = [];
    private _logActivatedObservers: Observer<any>[] = [];
    private _logDeactivatedObservers: Observer<any>[] = [];
    private _updateAvailableObservers: Observer<UpdateInfo>[] = [];
    private _overlayBoundsChangedObservers: Observer<OverlayBoundsChangedEventArgs>[] = [];
    private _warningDialogObservers: Observer<DialogEventArgs>[] = [];
    private _onReceivedQuickShare: Observer<string>[] = [];
    private _onReceivedQuickSharePackage: Observer<string>[] = [];
    private _onOrphanedTriggerWarning: Observer<boolean>[] = [];
    private _onMissingPackageOverlay: Observer<OverlayWindowModel>[] = [];
    private _onQuitFalure: Observer<QuitFailureData>[] = [];
    private _onBackupProgress: Observer<Progress>[] = [];
    private _simProgress: Record<string, Observer<SimulationProgress>[]> = {};
    private _successfulParseHistoryObservers: Observer<{ successful: TriggerParseHistoryModel[], exceptions: TriggerParseHistoryModel[] }>[] = [];
    private _consoleSuccessObservers: Observer<ConsoleMessageModel>[] = [];
    private _consoleErrorObservers: Observer<ConsoleMessageModel>[] = [];
    private _onCombatGroupMigrationRequestObservers: Observer<boolean>[] = [];
    private _settingsObservableCache: Record<string, Observable<any>> = {};
    private _settingsCacheObservers: Record<string, Observer<any>[]> = {};

    private _ginaConfigCache: GinaConfiguration = null;

    private _timeoutIds: Record<string, number> = {};

    constructor( private ngZone: NgZone ) {
        if ( window.api ) {
            try {

                window.api.ipc.on( 'ask_combat_group_migration', ( event: any, data: boolean ) => {
                    ngZone.run( () => {
                        this._onCombatGroupMigrationRequestObservers?.forEach( f => {
                            f.next( data );
                        } );
                    } );
                } );

                window.api.ipc.on( 'archive:progress', ( event: any, data: Progress ) => {
                    ngZone.run( () => {
                        this._onBackupProgress?.forEach( f => {
                            f.next( data );
                        } );
                    } );
                } );

                window.api.ipc.on( 'app:quit:failure', ( event: any, data: QuitFailureData ) => {
                    ngZone.run( () => {
                        this._onQuitFalure?.forEach( f => {
                            f.next( data );
                        } );
                    } );
                } );

                window.api.ipc.on( 'color:darken', ( event: any, data: { overlayId: string, color: string } ) => {
                    data.color = ColorUtility.FromHex( data.color ).darken( 0.93 ).toString( 0.75 );
                    window.api.ipc.send( `color:darken`, data );
                } );

                window.api.ipc.on( 'pkg:missing-overlay', ( event: any, data: OverlayWindowModel ) => {
                    ngZone.run( () => {
                        this._onMissingPackageOverlay?.forEach( f => {
                            f.next( data );
                        } );
                    } );
                } );

                window.api.ipc.on( 'orphaned_trigger_warning', ( event: any, data: boolean ) => {
                    ngZone.run( () => {
                        this._onOrphanedTriggerWarning?.forEach( f => {
                            f.next( data );
                        } );
                    } );
                } );

                window.api.ipc.on( 'quickshare_captured', ( event: any, quickShareId: string ) => {
                    ngZone.run( () => {
                        this._onReceivedQuickShare?.forEach( f => {
                            f.next( quickShareId );
                        } );
                    } );
                } );

                window.api.ipc.on( 'quicksharePackage_captured', ( event: any, packageId: string ) => {
                    ngZone.run( () => {
                        this._onReceivedQuickSharePackage?.forEach( f => {
                            f.next( packageId );
                        } );
                    } );
                } );

                window.api.ipc.on( 'update_downloaded', ( event: any, data: UpdateInfo ) => {
                    ngZone.run( () => {
                        this._updateAvailableObservers?.forEach( f => {
                            f.next( data );
                        } );
                    } );
                } );

                window.api.ipc.on( 'overlay:event:bounds-changed', ( event: any, data: OverlayBoundsChangedEventArgs ) => {
                    ngZone.run( () => {
                        this._overlayBoundsChangedObservers?.forEach( f => {
                            f.next( data );
                        } );
                    } );
                } );

                window.api.ipc.on( 'dialog:warning', ( event: any, data: DialogEventArgs ) => {
                    ngZone.run( () => {
                        this._warningDialogObservers?.forEach( f => {
                            f.next( data );
                        } );
                    } );
                } );

                window.api.ipc.on( 'tick', ( event: any, data: DataTickModel ) => {
                    ngZone.run( () => {
                        this._tickObservers?.forEach( f => {
                            f.next( data );
                        } );
                    } );
                } );
                
                window.api.ipc.on( 'dkp:event:transmit', ( event: any, data: DkpEntryModel[] ) => {
                    ngZone.run( () => {
                        this._transmitObservers?.forEach( f => {
                            f.next( data );
                        } );
                    } );
                } );

                window.api.ipc.on( 'log:changed', ( event: any, data: string ) => {
                    ngZone.run( () => {
                        this._logFileChangeObservers?.forEach( f => {
                            f.next( data );
                        } );
                    } );
                } );

                window.api.ipc.on( 'dkp:add', ( event: any, data: DkpEntryModel ) => {
                    ngZone.run( () => {
                        this._dkpAddedObservers?.forEach( f => {
                            f.next( data );
                        } );
                    } );
                } );

                window.api.ipc.on( 'dkp:event:removed', ( event: any, data: any ) => {
                    ngZone.run( () => {
                        this._dkpRemovedObservers?.forEach( f => {
                            f.next( data );
                        } );
                    } );
                } );

                window.api.ipc.on( 'console:log', ( event: any, data: any ) => {
                    console.log( data );
                } );

                window.api.ipc.on( 'log:character:activated', ( event: any, data: any ) => {
                    ngZone.run( () => {
                        this._logActivatedObservers?.forEach( f => {
                            f.next( data );
                        } );
                    } );
                } );

                window.api.ipc.on( 'log:character:deactivated', ( event: any, data: any ) => {
                    ngZone.run( () => {
                        this._logDeactivatedObservers?.forEach( f => {
                            f.next( data );
                        } );
                    } );
                } );

                window.api.ipc.on( 'trigger:batch:parse-history', ( event: any, data: { successful: TriggerParseHistoryModel[], exceptions: TriggerParseHistoryModel[] } ) => {
                    ngZone.run( () => {

                        data.successful = data.successful.map( x => {
                            let m = Object.assign( new TriggerParseHistoryModel(), x );
                            m.timestamp = new Date( x.timestamp );
                            m.logId = nagId();
                            // this._successfulParses.push( m );
                            return m;
                        } );
                        data.exceptions = data.exceptions.map( x => {
                            let m = Object.assign( new TriggerParseHistoryModel(), x );
                            m.timestamp = new Date( x.timestamp );
                            m.logId = nagId();
                            // this._failedParses.push( m );
                            return m;
                        } );

                        this._successfulParseHistoryObservers?.forEach( f => {
                            f.next( data );
                        } );
                    } );
                } );

                window.api.ipc.on( 'console:success', ( event: any, data: ConsoleMessageModel ) => {
                    ngZone.run( () => {
                        this._consoleSuccessObservers?.forEach( f => {
                            let m = Object.assign( new ConsoleMessageModel(), data );
                            m.logType = LogTypes.success;
                            m.logId = nagId();
                            f.next( m );
                        } );
                    } );
                } );

                window.api.ipc.on( 'console:error', ( event: any, data: ConsoleMessageModel ) => {
                    ngZone.run( () => {
                        this._consoleErrorObservers?.forEach( f => {
                            let m = Object.assign( new ConsoleMessageModel(), data );
                            m.logType = LogTypes.error;
                            m.logId = nagId();
                            f.next( m );
                        } );
                    } );
                } );

                this.onConsoleSuccess().subscribe( log => {
                    this._consoleMessages.push( log );
                } );

                this.onConsoleError().subscribe( log => {
                    this._consoleMessages.push( log );
                } );

                this.onBatchParseHistory().subscribe( history => {
                    this._successfulParses.push( ...history.successful );
                    this._failedParses.push( ...history.exceptions );
                } );


            } catch ( e ) {
                throw e;
            }
        } else {
            console.warn( 'App not running inside Electron!' );
        }
    }

    /**
     * Returns an observable that will emit when the main process requests a 
     * combat group migration.  The value will be true if the user has existing 
     * fct styles that can be migrated.
     */
    public onAskCombatGroupMigration(): Observable<boolean> {
        let obs: Observable<boolean> = new Observable<boolean>( ( observer: Observer<boolean> ) => {
            this._onCombatGroupMigrationRequestObservers.push( observer );
        } );

        return obs;
    }

    /**
     * Returns the list of successful parses.
     */
    public onBatchParseHistory(): Observable<{ successful: TriggerParseHistoryModel[], exceptions: TriggerParseHistoryModel[] }> {
        let obs: Observable<{ successful: TriggerParseHistoryModel[], exceptions: TriggerParseHistoryModel[] }> = new Observable<{ successful: TriggerParseHistoryModel[], exceptions: TriggerParseHistoryModel[] }>( ( observer: Observer<{ successful: TriggerParseHistoryModel[], exceptions: TriggerParseHistoryModel[] }> ) => {
            this._successfulParseHistoryObservers.push( observer );
        } );

        return obs;
    }

    public onConsoleSuccess(): Observable<ConsoleMessageModel> {
        let obs: Observable<ConsoleMessageModel> = new Observable<ConsoleMessageModel>( ( observer: Observer<ConsoleMessageModel> ) => {
            this._consoleSuccessObservers.push( observer );
        } );

        return obs;
    }

    public onConsoleError(): Observable<ConsoleMessageModel> {
        let obs: Observable<ConsoleMessageModel> = new Observable<ConsoleMessageModel>( ( observer: Observer<ConsoleMessageModel> ) => {
            this._consoleErrorObservers.push( observer );
        } );

        return obs;
    }

    /**
     * Returns a backup progress when backup emits a progress update.
     */
    public onBackupProgress(): Observable<Progress> {
        let obs: Observable<Progress> = new Observable<Progress>( ( observer: Observer<Progress> ) => {
            this._onBackupProgress.push( observer );
        } );

        return obs;
    }

    /**
     * Retruns a quit failure model when the user attempts to close nag and nag wants to warn the user of possible corruption.
     */
    public onQuitFalure(): Observable<QuitFailureData> {
        let obs: Observable<QuitFailureData> = new Observable<QuitFailureData>( ( observer: Observer<QuitFailureData> ) => {
            this._onQuitFalure.push( observer );
        } );

        return obs;
    }

    public missingPackageOverlayFound(): Observable<OverlayWindowModel> {
        let obs: Observable<OverlayWindowModel> = new Observable<OverlayWindowModel>( ( observer: Observer<OverlayWindowModel> ) => {
            this._onMissingPackageOverlay.push( observer );
        } );

        return obs;
    }

    public packageOverlayMapped( packageOverlayId: string, mappedOverlayId: string ): void {
        window.api.ipc.send( `trigger:missing-overlay:${packageOverlayId}`, mappedOverlayId );
    }

    public orphanedTriggersFound(): Observable<boolean> {
        let obs: Observable<boolean> = new Observable<boolean>( ( observer: Observer<boolean> ) => {
            this._onOrphanedTriggerWarning.push( observer );
        } );

        return obs;
    }

    public quickShareCaptured(): Observable<string> {
        let obs: Observable<string> = new Observable<string>( ( observer: Observer<string> ) => {
            this._onReceivedQuickShare.push( observer );
        } );

        return obs;
    }

    public quickSharePackageCaptured(): Observable<string> {
        let obs: Observable<string> = new Observable<string>( ( observer: Observer<string> ) => {
            this._onReceivedQuickSharePackage.push( observer );
        } );

        return obs;
    }

    public updateAvailable(): Observable<UpdateInfo> {
        let obs: Observable<UpdateInfo> = new Observable<UpdateInfo>( ( observer: Observer<UpdateInfo> ) => {
            this._updateAvailableObservers.push( observer );
        } );

        return obs;
    }

    public overlayBoundsChanged(): Observable<OverlayBoundsChangedEventArgs> {
        let obs: Observable<OverlayBoundsChangedEventArgs> = new Observable<OverlayBoundsChangedEventArgs>( ( observer: Observer<OverlayBoundsChangedEventArgs> ) => {
            this._overlayBoundsChangedObservers.push( observer );
        } );

        return obs;
    }

    public displayWarningDialog(): Observable<DialogEventArgs> {
        let obs: Observable<DialogEventArgs> = new Observable<DialogEventArgs>( ( observer: Observer<DialogEventArgs> ) => {
            this._warningDialogObservers.push( observer );
        } );

        return obs;
    }

    public tickReceived(): Observable<DataTickModel> {
        let obs: Observable<DataTickModel> = new Observable<DataTickModel>( ( observer: Observer<DataTickModel> ) => {
            this._tickObservers.push( observer );
        } );

        return obs;
    }

    public receiveDkpDatabase(): Observable<DkpEntryModel[]> {
        let obs: Observable<DkpEntryModel[]> = new Observable<DkpEntryModel[]>( ( observer: Observer<DkpEntryModel[]> ) => {
            this._transmitObservers.push( observer );
        } );

        return obs;
    }

    public logFileChanged(): Observable<string> {
        let obs: Observable<string> = new Observable<string>( ( observer: Observer<string> ) => {
            this._logFileChangeObservers.push( observer );
        } );

        return obs;
    }

    public dkpEntryAdded(): Observable<DkpEntryModel> {
        let obs: Observable<DkpEntryModel> = new Observable<DkpEntryModel>( ( observer: Observer<DkpEntryModel> ) => {
            this._dkpAddedObservers.push( observer );
        } );

        return obs;
    }

    public dkpEntryRemoved(): Observable<string> {
        let obs: Observable<string> = new Observable<string>( ( observer: Observer<string> ) => {
            this._dkpRemovedObservers.push( observer );
        } );

        return obs;
    }

    public characterLogActivated(): Observable<string> {
        let obs: Observable<string> = new Observable<string>( ( observer: Observer<string> ) => {
            this._logActivatedObservers.push( observer );
        } );

        return obs;
    }

    public characterLogDeactivated(): Observable<string> {
        let obs: Observable<string> = new Observable<string>( ( observer: Observer<string> ) => {
            this._logDeactivatedObservers.push( observer );
        } );

        return obs;
    }

    public getAppVersion(): Observable<string> {
        let obs: Observable<string> = new Observable<string>( ( observer: Observer<string> ) => {
            
            window.api.ipc.once( 'app:version', ( e, v ) => {
                this.ngZone.run( () => {
                    observer.next( v.version );
                    observer.complete();
                } );
            } );
            window.api.ipc.send( 'app:version' );

        } );

        return obs;
    }

    public getAllDisplays(): Observable<Electron.Display[]> {
        let obs: Observable<Electron.Display[]> = new Observable<Electron.Display[]>( ( observer: Observer<Electron.Display[]> ) => {

            window.api.ipc.once( 'app:get:all-display', ( e, displays: Electron.Display[] ) => {
                this.ngZone.run( () => {
                    observer.next( displays );
                    observer.complete();
                } );
            } );
            window.api.ipc.send( 'app:get:all-display' );

        } );

        return obs;
    }

    public getPrimaryDisplay(): Observable<Electron.Display> {
        let obs: Observable<Electron.Display> = new Observable<Electron.Display>( ( observer: Observer<Electron.Display> ) => {
            
            window.api.ipc.once( 'app:get:primary-display', ( e, display ) => {
                this.ngZone.run( () => {
                    observer.next( display );
                    observer.complete();
                } );
            } );
            window.api.ipc.send( 'app:get:primary-display' );

        } );

        return obs;
    }

    public getAppIsDev(): Observable<boolean> {
        let obs: Observable<boolean> = new Observable<boolean>( ( observer: Observer<boolean> ) => {
            
            window.api.ipc.once( 'app:isDev', ( e, isDev ) => {
                this.ngZone.run( () => {
                    observer.next( isDev );
                    observer.complete();
                } );
            } );
            window.api.ipc.send( 'app:isDev' );

        } );

        return obs;
    }

    public consoleLogRequested(): Observable<any> {
        let obs: Observable<any> = new Observable<any>( ( observer: Observer<any> ) => {
            this._consoleLogRequestObservers.push( observer );
        } );

        return obs;
    }

    public mainWindowLoaded(): void {
        window.api.ipc.send( 'app:main-window-loaded', null );
    }

    public quitAndInstallUpdate(): void {
        window.api.ipc.send( 'app:restart', null );
    }

    public logException( ex: any ): void {
        window.api.ipc.send( 'app:log:exception', ex );
    }

    public logInfo( info: string ): void {
        window.api.ipc.send( 'app:log:info', info );
    }

    public downloadLogZip(): void {
        window.api.ipc.send( 'settings:download-log' );
    }

    public downloadDataFilesZip(): void {
        window.api.ipc.send( 'settings:download-data-files' );
    }

    public showDataFolder(): void {
        window.api.ipc.send( 'settings:open-data-folder' );
    }

    public removeDkpAward( entry: DkpEntryModel ): void {
        window.api.ipc.send( 'dkp:remove', entry );
    }

    public quitApp( forceQuit: boolean = false ): void {
        window.api.ipc.send( 'app:quit', forceQuit === true ? true : false );
    }

    public minimizeApp(): void {
        window.api.ipc.send( 'app:minimize' );
    }

    public sendToTray(): void {
        window.api.ipc.send( 'app:minimize:tray' );
    }

    public updateLogFile( logFile: string ): void {
        window.api.ipc.send( 'log:select', logFile );
    }

    public updateVoiceIndex( index: number ): void {
        window.api.ipc.send( 'voice:select', index );
    }

    public clearTriggerHistory(): void {
        window.api.ipc.send( 'trigger:clear:history:all' );
    }

    public sendConsoleCommand( command: string ): void {
        window.api.ipc.send( 'console:command', command );
    }

    /**
     * Generic setting update function.
     * 
     * @param key The setting key.
     * @param value The setting value.
     * @param delay Wait the given milliseconds before sending changes.  If another change for the same key comes, the timeout is restarted.
     */
    public updateSetting<T>( key: string, value: T, delay: number = null ): void {
        
        if ( delay > 0 ) {

            // If there's a timer, clear it.
            if ( this._timeoutIds[ key ] > 0 ) {
                window.clearTimeout( this._timeoutIds[ key ] );
            }

            // Start a new timer.
            this._timeoutIds[ key ] = window.setTimeout( () => {
                window.api.ipc.send( 'settings:set', { key: key, value: value } );
            }, delay );
            
        } else {
            window.api.ipc.send( 'settings:set', { key: key, value: value } );

        }

    }

    /**
     * Returns the specified setting value.
     * 
     * @param key The setting key.
     */
    public getSetting<T>( key: string ): Observable<T> {
        
        if ( this._settingsObservableCache[ key ] ) {
            return this._settingsObservableCache[ key ];

        } else {
            
            // We only need to create one observable for the cache.
            if ( !this._settingsObservableCache[ key ] ) {

                let cacheObs: Observable<T> = new Observable<T>( ( cacheObserver: Observer<T> ) => {
                    // This is called each time the observable is subscribed.
                    this._settingsCacheObservers[ key ] = this._settingsCacheObservers[ key ] ? this._settingsCacheObservers[ key ] : [];
                    this._settingsCacheObservers[ key ].push( cacheObserver );
                } );
                
                this._settingsObservableCache[ key ] = cacheObs;

            }

            let obs: Observable<T> = new Observable<T>( ( observer: Observer<T> ) => {

                // Create a new observer here that can be resolved by the ipc event.
                window.api.ipc.once( `settings:get:${key}:generic`, ( e, value: T ) => {
                    this.ngZone.run( () => {
                        
                        observer.next( value );
                        observer.complete();

                        if ( this._settingsCacheObservers[ key ]?.length > 0 ) {
                            // Notify all observers waiting for the original request to complete.
                            this._settingsCacheObservers[ key ].forEach( f => {
                                f.next( value );
                                f.complete();
                            } );

                            // Reset the cache
                            this._settingsCacheObservers[ key ] = [];
                            this._settingsObservableCache[ key ] = undefined;
                        }

                    } );
                } );
                window.api.ipc.send( 'settings:get', { key: key } );

            } );

            return obs;
        }
    }

    public updateMasterVolume( masterVolume: number ): void {
        window.api.ipc.send( 'settings:set:masterVolume', masterVolume );
    }

    public updateFocusEffectSettings( model: FocusEffectSettings ): void {
        window.api.ipc.send( 'settings:set:focus-effects', model );
    }

    public updateEnableFct( enabled: boolean ): void {
        window.api.ipc.send( 'settings:set:fct', enabled );
    }

    public updateEnableFctShowCriticalsInline( enabled: boolean ): void {
        window.api.ipc.send( 'settings:set:fctShowCriticalsInline', enabled );
    }

    public updateDamageDealtOverlayId( overlayId: string ): void {
        window.api.ipc.send( 'settings:set:damageDealtOverlayId', overlayId );
    }

    public updateDamageReceivedOverlayId( overlayId: string ): void {
        window.api.ipc.send( 'settings:set:damageReceivedOverlayId', overlayId );
    }

    public sendTextToClipboard( value: string ): void {
        window.api.ipc.send( 'clipboard:writeText', value );
    }

    public markDkpEntriesAsEntered( entries: DkpEntryModel[] ): void {
        window.api.ipc.send( 'dkp:markAsEntered', entries );
    }

    public clearDkpLog(): void {
        window.api.ipc.send( 'dkp:reset' );
    }

    public showNewTriggerDialog( folderId?: string ): void {
        window.api.ipc.send( 'trigger:dialog:new', folderId );
    }

    public showEditTriggerDialog( triggerId: string ): void {
        window.api.ipc.send( 'trigger:dialog:edit', triggerId );
    }

    public closeThisChild(): void {
        window.api.ipc.send( 'window:child:close' );
    }

    public resizeTriggerWindow( width: number = null, height: number = null ): void {
        window.api.ipc.send( 'trigger:dialog:resize', { width: width, height: height } );
    }

    public mainWindowAngularReady(): void {
        window.api.ipc.send( 'main:angular-ready' );
    }

    public findPlayerCharacterDeaths( logFile: string ): Observable<LogFileLocation[]> {
        let obs: Observable<LogFileLocation[]> = new Observable<LogFileLocation[]>( ( observer: Observer<LogFileLocation[]> ) => {
            
            let message = new IpcMessage( logFile );

            window.api.ipc.once( `death-recap:find-deaths:${message.id}`, ( e, deathsFound ) => {
                this.ngZone.run( () => {
                    observer.next( deathsFound );
                    observer.complete();
                } );
            } );
            window.api.ipc.send( 'death-recap:find-deaths', message );

        } );

        return obs;
    }

    public showDeathRecap( logFileLoc: LogFileLocation, characterName: string ) {
        let message = new IpcMessage( { logFileLoc: logFileLoc, characterName: characterName } );
        window.api.ipc.send( 'window:death-recap', message );
    }

    public showGinaImportWindow(): Observable<boolean> {
        let obs: Observable<boolean> = new Observable<boolean>( ( observer: Observer<boolean> ) => {
            
            window.api.ipc.once( 'gina:dialog:import', ( e, loaded ) => {
                this.ngZone.run( () => {
                    observer.next( loaded );
                    observer.complete();
                } );
            } );
            window.api.ipc.send( 'gina:dialog:import', null );

        } );

        return obs;
    }

    public showTriggerLibrary(): Observable<boolean> {
        let obs: Observable<boolean> = new Observable<boolean>( ( observer: Observer<boolean> ) => {
            
            window.api.ipc.once( 'trigger:dialog:library', ( e, loaded ) => {
                this.ngZone.run( () => {
                    observer.next( loaded );
                    observer.complete();
                } );
            } );
            window.api.ipc.send( 'trigger:dialog:library', null );

        } );

        return obs;
    }

    public showLogSimulator(): Observable<boolean> {
        let obs: Observable<boolean> = new Observable<boolean>( ( observer: Observer<boolean> ) => {
            
            window.api.ipc.once( 'trigger:dialog:log-simulator', ( e, loaded ) => {
                this.ngZone.run( () => {
                    observer.next( loaded );
                    observer.complete();
                } );
            } );
            window.api.ipc.send( 'trigger:dialog:log-simulator', null );

        } );

        return obs;
    }

    public showEasyWindow(): Observable<boolean> {
        let obs: Observable<boolean> = new Observable<boolean>( ( observer: Observer<boolean> ) => {
            
            window.api.ipc.once( 'trigger:dialog:easy-window', ( e, loaded ) => {
                this.ngZone.run( () => {
                    observer.next( loaded );
                    observer.complete();
                } );
            } );
            window.api.ipc.send( 'trigger:dialog:easy-window', null );

        } );

        return obs;
    }

    public simulateLogParse( file: string ): void {
        window.api.ipc.send( 'log:simulate:file', file );
    }

    public simulateLogLines( lines: string[] ): void {
        window.api.ipc.send( 'log:simulate:lines', lines );
    }

    public beginSimulation( lines: string[], characterId: string, lineIndex: number | null = null ): Observable<string> {
        let obs: Observable<string> = new Observable<string>( ( observer: Observer<string> ) => {
            
            window.api.ipc.once( 'log:simulate:begin', ( e, simulationId ) => {
                this.ngZone.run( () => {

                    this._simProgress[ simulationId ] = [];

                    window.api.ipc.on( `simulation:${simulationId}:progress`, ( event: any, data: SimulationProgress ) => {
                        this.ngZone.run( () => {
                            this._simProgress[ simulationId ]?.forEach( f => {
                                f.next( data );

                                if (data.isComplete) {
                                    f.complete();
                                }
                            } );
                        } );
                    } );
                    
                    observer.next( simulationId );
                    observer.complete();
                } );
            } );
            window.api.ipc.send( 'log:simulate:begin', { lines: lines, characterId: characterId, lineIndex: lineIndex } );

        } );

        return obs;
    }

    public getSimulationStatus( simulationId: string ): Observable<SimulationProgress> {
        let obs: Observable<SimulationProgress> = new Observable<SimulationProgress>( ( observer: Observer<SimulationProgress> ) => {
            this._simProgress[ simulationId ].push( observer );
        } );

        return obs;
    }

    public pauseSimulation( simulationId: string ): void {
        window.api.ipc.send( `log:simulation:${simulationId}:pause`, null );
    }

    public resumeSimulation( simulationId: string, lineIndex: number | null = null ): void {
        window.api.ipc.send( `log:simulation:${simulationId}:resume`, lineIndex );
    }

    public stopSimulation( simulationId: string ): void {
        window.api.ipc.send( `log:simulation:${simulationId}:stop`, null );
    }

    public createNewTriggers( model: TriggerModel[] ): Observable<string[]> {
        let obs: Observable<string[]> = new Observable<string[]>( ( observer: Observer<string[]> ) => {
            
            window.api.ipc.once( 'trigger:mass-create', ( e, triggerIds ) => {
                this.ngZone.run( () => {
                    observer.next( triggerIds );
                    observer.complete();
                } );
            } );
            window.api.ipc.send( 'trigger:mass-create', model );

        } );

        return obs;
    }

    public createNewTrigger( model: TriggerModel ): Observable<string> {
        let obs: Observable<string> = new Observable<string>( ( observer: Observer<string> ) => {
            
            window.api.ipc.once( 'trigger:create', ( e, triggerId ) => {
                this.ngZone.run( () => {
                    observer.next( triggerId );
                    observer.complete();
                } );
            } );
            window.api.ipc.send( 'trigger:create', model );

        } );

        return obs;
    }

    public getTriggers(): Observable<TriggerModel[]> {
        let obs: Observable<TriggerModel[]> = new Observable<TriggerModel[]>( ( observer: Observer<TriggerModel[]> ) => {
            
            window.api.ipc.once( 'trigger:get', ( e, triggers: TriggerModel[] ) => {
                this.ngZone.run( () => {
                    observer.next( triggers );
                    observer.complete();
                } );
            } );
            window.api.ipc.send( 'trigger:get', null );

        } );

        return obs;
    }

    public getTrigger( triggerId: string ): Observable<TriggerModel> {
        let obs: Observable<TriggerModel> = new Observable<TriggerModel>( ( observer: Observer<TriggerModel> ) => {
            
            window.api.ipc.once( 'trigger:get', ( e, trigger: TriggerModel ) => {
                this.ngZone.run( () => {
                    observer.next( trigger );
                    observer.complete();
                } );
            } );
            window.api.ipc.send( 'trigger:get', triggerId );

        } );

        return obs;
    }

    public searchTriggers( term: string, restrictByFolderIds?: string[] ): Observable<TriggerModel[]> {
        let obs: Observable<TriggerModel[]> = new Observable<TriggerModel[]>( ( observer: Observer<TriggerModel[]> ) => {
            
            window.api.ipc.once( 'trigger:search', ( e, triggers: TriggerModel[] ) => {
                this.ngZone.run( () => {
                    observer.next( triggers );
                    observer.complete();
                } );
            } );
            window.api.ipc.send( 'trigger:search', { term: term, folderIds: restrictByFolderIds } );

        } );

        return obs;
    }

    public searchTriggerProperties( phrase: string[], speakText: string[], displayText: string[], clipboardText: string[], name: string, comment: string ): Observable<TriggerModel[]> {
        let obs: Observable<TriggerModel[]> = new Observable<TriggerModel[]>( ( observer: Observer<TriggerModel[]> ) => {
            
            window.api.ipc.once( 'trigger:search:properties', ( e, triggers: TriggerModel[] ) => {
                this.ngZone.run( () => {
                    observer.next( triggers );
                    observer.complete();
                } );
            } );
            window.api.ipc.send( 'trigger:search:properties', { phrase: phrase, speakText: speakText, displayText: displayText, clipboardText: clipboardText, name: name, comment: comment } );

        } );

        return obs;
    }

    public searchForDuplicates( triggers: TriggerModel[] ): Observable<DuplicateTriggerAction[]> {
        let obs: Observable<DuplicateTriggerAction[]> = new Observable<DuplicateTriggerAction[]>( ( observer: Observer<DuplicateTriggerAction[]> ) => {
            
            window.api.ipc.once( 'trigger:strict-search:duplicates', ( e, result: DuplicateTriggerAction[] ) => {
                this.ngZone.run( () => {
                    observer.next( result );
                    observer.complete();
                } );
            } );
            window.api.ipc.send( 'trigger:strict-search:duplicates', triggers );

        } );

        return obs;
    }

    public updateTrigger( model: TriggerModel ): Observable<boolean> {
        let obs: Observable<boolean> = new Observable<boolean>( ( observer: Observer<boolean> ) => {
            
            window.api.ipc.once( 'trigger:update', ( e, updated: boolean ) => {
                this.ngZone.run( () => {
                    observer.next( updated );
                    observer.complete();
                } );
            } );
            window.api.ipc.send( 'trigger:update', model );

        } );

        return obs;
    }

    /**
     * Updates all given triggers.
     * 
     * @returns Returns a list of triggers that failed to update.
     * 
     * @param triggers The list of triggers to update.
     */
    public updateTriggers( triggers: TriggerModel[] ): Observable<TriggerModel[]> {
        let obs: Observable<TriggerModel[]> = new Observable<TriggerModel[]>( ( observer: Observer<TriggerModel[]> ) => {
            
            window.api.ipc.once( 'trigger:update:batch', ( e, failed: TriggerModel[] ) => {
                this.ngZone.run( () => {
                    observer.next( failed );
                    observer.complete();
                } );
            } );
            window.api.ipc.send( 'trigger:update:batch', triggers );

        } );

        return obs;
    }

    public deleteTrigger( triggerId: string ): Observable<boolean> {
        let obs: Observable<boolean> = new Observable<boolean>( ( observer: Observer<boolean> ) => {
            
            window.api.ipc.once( 'trigger:delete', ( e, deleted: boolean ) => {
                this.ngZone.run( () => {
                    observer.next( deleted );
                    observer.complete();
                } );
            } );
            window.api.ipc.send( 'trigger:delete', triggerId );

        } );

        return obs;
    }

    public getTriggerFolders(): Observable<TriggerFolder[]> {
        let obs: Observable<TriggerFolder[]> = new Observable<TriggerFolder[]>( ( observer: Observer<TriggerFolder[]> ) => {
            
            window.api.ipc.once( 'folders:get', ( e, folders: TriggerFolder[] ) => {
                this.ngZone.run( () => {
                    observer.next( folders );
                    observer.complete();
                } );
            } );
            window.api.ipc.send( 'folders:get', null );

        } );

        return obs;
    }

    public updateTriggerFolders( folders: TriggerFolder[] ): Observable<TriggerFolder[]> {
        let obs: Observable<TriggerFolder[]> = new Observable<TriggerFolder[]>( ( observer: Observer<TriggerFolder[]> ) => {
            
            window.api.ipc.once( 'folders:update', ( e, updatedFolders: TriggerFolder[] ) => {
                this.ngZone.run( () => {
                    observer.next( updatedFolders );
                    observer.complete();
                } );
            } );
            window.api.ipc.send( 'folders:update', folders );

        } );

        return obs;
    }

    /**
     * Returns a list of all stored variables.
     */
    public getStoredVariables(): Observable<string[]> {
        let obs: Observable<string[]> = new Observable<string[]>( ( observer: Observer<string[]> ) => {
            
            window.api.ipc.once( 'trigger:get:stored-variables', ( e, storedVariables: string[] ) => {
                this.ngZone.run( () => {
                    observer.next( storedVariables );
                    observer.complete();
                } );
            } );
            window.api.ipc.send( 'trigger:get:stored-variables', null );

        } );

        return obs;
    }

    public updateFctCombatGroup( model: FctCombatGroup, sort: string[] | undefined = undefined ): Observable<string> {
        let obs: Observable<string> = new Observable<string>( ( observer: Observer<string> ) => {
            
            window.api.ipc.once( 'overlay:update:combatGroup', ( e, combatGroupId: string ) => {
                this.ngZone.run( () => {
                    observer.next( combatGroupId );
                    observer.complete();
                } );
            } );
            window.api.ipc.send( 'overlay:update:combatGroup', { group: model, sort: sort } );

        } );

        return obs;
    }

    public getFctCombatGroups(): Observable<FctCombatGroup[]> {
        let obs: Observable<FctCombatGroup[]> = new Observable<FctCombatGroup[]>( ( observer: Observer<FctCombatGroup[]> ) => {
                
                window.api.ipc.once( 'overlay:get:combatGroups', ( e, combatGroups: FctCombatGroup[] ) => {
                    this.ngZone.run( () => {
                        observer.next( combatGroups.map( f => FctCombatGroup.hydrateModel( f ) ) );
                        observer.complete();
                    } );
                } );
                window.api.ipc.send( 'overlay:get:combatGroups', null );
    
        } );

        return obs;
    }

    public getFctCombatGroup( combatGroupId: string ): Observable<FctCombatGroup> {
        let obs: Observable<FctCombatGroup> = new Observable<FctCombatGroup>( ( observer: Observer<FctCombatGroup> ) => {
                
            window.api.ipc.once( 'overlay:get:combatGroup', ( e, combatGroup: FctCombatGroup ) => {
                this.ngZone.run( () => {
                    observer.next( FctCombatGroup.hydrateModel( combatGroup ) );
                    observer.complete();
                } );
            } );
            window.api.ipc.send( 'overlay:get:combatGroup', combatGroupId );
    
        } );

        return obs;
    }

    public deleteFctCombatGroup( combatGroupId: string ): Observable<boolean> {
        let obs: Observable<boolean> = new Observable<boolean>( ( observer: Observer<boolean> ) => {
            
            window.api.ipc.once( 'overlay:delete:combatGroup', ( e, deleted: boolean ) => {
                this.ngZone.run( () => {
                    observer.next( deleted );
                    observer.complete();
                } );
            } );
            window.api.ipc.send( 'overlay:delete:combatGroup', combatGroupId );

        } );

        return obs;
    }

    public createNewOverlayWindow( model: OverlayWindowModel ): Observable<string> {
        let obs: Observable<string> = new Observable<string>( ( observer: Observer<string> ) => {
            
            window.api.ipc.once( 'overlay:create', ( e, overlayId ) => {
                this.ngZone.run( () => {
                    observer.next( overlayId );
                    observer.complete();
                } );
            } );
            window.api.ipc.send( 'overlay:create', model );

        } );

        return obs;
    }

    public getOverlayWindows(): Observable<OverlayWindowModel[]> {
        let obs: Observable<OverlayWindowModel[]> = new Observable<OverlayWindowModel[]>( ( observer: Observer<OverlayWindowModel[]> ) => {
            
            window.api.ipc.once( 'overlay:get', ( e, overlays: OverlayWindowModel[] ) => {
                this.ngZone.run( () => {
                    observer.next( overlays );
                    observer.complete();
                } );
            } );
            window.api.ipc.send( 'overlay:get', null );

        } );

        return obs;
    }

    public getOverlayWindow( overlayId: string ): Observable<OverlayWindowModel> {
        let obs: Observable<OverlayWindowModel> = new Observable<OverlayWindowModel>( ( observer: Observer<OverlayWindowModel> ) => {
            
            window.api.ipc.once( 'overlay:get', ( e, overlay: OverlayWindowModel ) => {
                this.ngZone.run( () => {
                    observer.next( overlay );
                    observer.complete();
                } );
            } );
            window.api.ipc.send( 'overlay:get', overlayId );

        } );

        return obs;
    }

    public updateOverlayWindow( model: OverlayWindowModel ): Observable<boolean> {
        let obs: Observable<boolean> = new Observable<boolean>( ( observer: Observer<boolean> ) => {
            
            window.api.ipc.once( 'overlay:update', ( e, updated: boolean ) => {
                this.ngZone.run( () => {
                    observer.next( updated );
                    observer.complete();
                } );
            } );
            window.api.ipc.send( 'overlay:update', model );

        } );

        return obs;
    }

    public undoOverlayPositionChanges(): void {
        window.api.ipc.send( 'renderer:reset:overlayDimensions', null );
    }

    public saveUpdatedOverlayPositions(): void {
        window.api.ipc.send( 'renderer:save:overlayDimensions', null );
    }

    // TODO: Determine wtf this was?
    // public updateOverlaysPositions( overlays: OverlayWindowModel[] ): Observable<boolean> {
    //     let obs: Observable<boolean> = new Observable<boolean>( ( observer: Observer<boolean> ) => {
            
    //         window.api.ipc.once( 'overlays:update:position', ( e, updated: boolean ) => {
    //             this.ngZone.run( () => {
    //                 observer.next( updated );
    //                 observer.complete();
    //             } );
    //         } );
    //         window.api.ipc.send( 'overlays:update:position', overlays );

    //     } );

    //     return obs;
    // }

    public deleteOverlayWindow( overlayId: string ): Observable<boolean> {
        let obs: Observable<boolean> = new Observable<boolean>( ( observer: Observer<boolean> ) => {
            
            window.api.ipc.once( 'overlay:delete', ( e, deleted: boolean ) => {
                this.ngZone.run( () => {
                    observer.next( deleted );
                    observer.complete();
                } );
            } );
            window.api.ipc.send( 'overlay:delete', overlayId );

        } );

        return obs;
    }

    public createCharacter( model: CharacterModel ): Observable<string> {
        let obs: Observable<string> = new Observable<string>( ( observer: Observer<string> ) => {
            
            window.api.ipc.once( 'character:create', ( e, characterId: string ) => {
                this.ngZone.run( () => {
                    observer.next( characterId );
                    observer.complete();
                } );
            } );
            window.api.ipc.send( 'character:create', model );

        } );

        return obs;
    }

    public getCharacters(): Observable<CharacterModel[]> {
        let obs: Observable<CharacterModel[]> = new Observable<CharacterModel[]>( ( observer: Observer<CharacterModel[]> ) => {
            
            window.api.ipc.once( 'character:get', ( e, characters: CharacterModel[] ) => {
                this.ngZone.run( () => {
                    observer.next( characters.map( c => Object.assign( new CharacterModel(), c ) ) );
                    observer.complete();
                } );
            } );
            window.api.ipc.send( 'character:get', null );

        } );

        return obs;
    }

    public getCharacter( characterId: string ): Observable<CharacterModel> {
        let obs: Observable<CharacterModel> = new Observable<CharacterModel>( ( observer: Observer<CharacterModel> ) => {
            
            window.api.ipc.once( 'character:get', ( e, character: CharacterModel ) => {
                this.ngZone.run( () => {
                    observer.next( character );
                    observer.complete();
                } );
            } );
            window.api.ipc.send( 'character:get', characterId );

        } );

        return obs;
    }

    public updateCharacter( model: CharacterModel ): Observable<boolean> {
        let obs: Observable<boolean> = new Observable<boolean>( ( observer: Observer<boolean> ) => {
            
            window.api.ipc.once( 'character:update', ( e, updated: boolean ) => {
                this.ngZone.run( () => {
                    observer.next( updated );
                    observer.complete();
                } );
            } );
            window.api.ipc.send( 'character:update', model );

        } );

        return obs;
    }

    public deleteCharacter( characterId: string ): Observable<boolean> {
        let obs: Observable<boolean> = new Observable<boolean>( ( observer: Observer<boolean> ) => {
            
            window.api.ipc.once( 'character:delete', ( e, deleted: boolean ) => {
                this.ngZone.run( () => {
                    observer.next( deleted );
                    observer.complete();
                } );
            } );
            window.api.ipc.send( 'character:delete', characterId );

        } );

        return obs;
    }

    public getTriggerProfiles(): Observable<TriggersProfileModel[]> {
        let obs: Observable<TriggersProfileModel[]> = new Observable<TriggersProfileModel[]>( ( observer: Observer<TriggersProfileModel[]> ) => {
            
            window.api.ipc.once( 'character:get:triggerProfiles', ( e, triggerProfiles: TriggersProfileModel[] ) => {
                this.ngZone.run( () => {
                    observer.next( triggerProfiles.map( c => Object.assign( new TriggersProfileModel(), c ) ) );
                    observer.complete();
                } );
            } );
            window.api.ipc.send( 'character:get:triggerProfiles', null );

        } );

        return obs;
    }

    public updateTriggerProfile( model: TriggersProfileModel ): Observable<string> {
        let obs: Observable<string> = new Observable<string>( ( observer: Observer<string> ) => {
            
            window.api.ipc.once( 'character:save:triggerProfile', ( e, profileId: string ) => {
                this.ngZone.run( () => {
                    observer.next( profileId );
                    observer.complete();
                } );
            } );
            window.api.ipc.send( 'character:save:triggerProfile', model );

        } );

        return obs;
    }

    public deleteTriggerProfile( profileId: string ): Observable<boolean> {
        let obs: Observable<boolean> = new Observable<boolean>( ( observer: Observer<boolean> ) => {
            
            window.api.ipc.once( 'character:delete:triggerProfile', ( e, deleted: boolean ) => {
                this.ngZone.run( () => {
                    observer.next( deleted );
                    observer.complete();
                } );
            } );
            window.api.ipc.send( 'character:delete:triggerProfile', profileId );

        } );

        return obs;
    }

    public getEqInstallFolder(): Observable<string> {
        let obs: Observable<string> = new Observable<string>( ( observer: Observer<string> ) => {
            
            window.api.ipc.once( 'settings:get:everquest-folder', ( e, folder: string ) => {
                this.ngZone.run( () => {
                    observer.next( folder );
                    observer.complete();
                } );
            } );
            window.api.ipc.send( 'settings:get:everquest-folder', null );

        } );

        return obs;
    }

    public getEqSpellIcons(): Observable<string[]> {
        let obs: Observable<string[]> = new Observable<string[]>( ( observer: Observer<string[]> ) => {
            
            window.api.ipc.once( 'game-resources:get:eq:icons', ( e, icons: string[] ) => {
                this.ngZone.run( () => {
                    observer.next( icons );
                    observer.complete();
                } );
            } );
            window.api.ipc.once( 'game-resources:get:eq:icons:error', ( e, error: BasicError ) => {
                this.ngZone.run( () => {
                    observer.error( error );
                    observer.complete();
                } );
            } );
            window.api.ipc.send( 'game-resources:get:eq:icons', null );

        } );

        return obs;
    }

    public setEqInstallFolder( folder: string ): void {
        window.api.ipc.send( 'settings:set:everquest-folder', folder );
    }

    public enableOverlayEditMode( overlayId: string ): void {
        window.api.ipc.send( 'overlay:enable-edit', overlayId );
    }

    public arrangeOverlays(): void {
        window.api.ipc.send( 'renderer:arrange-overlays' );
    }

    public endArrangeOverlays(): void {
        window.api.ipc.send( 'renderer:end-arrange-overlays' );
    }

    public disableOverlayEditMode( overlayId: string ): void {
        window.api.ipc.send( 'overlay:disable-edit', overlayId );
    }

    public showEditOverlayDialog( overlayId: string ): void {
        window.api.ipc.send( 'overlay:dialog:edit', overlayId );
    }

    public showArrangeOverlaysDialog(): void {
        window.api.ipc.send( 'overlay:dialog:arrange' );
    }

    public broadcastOverlayModel( overlay: OverlayWindowModel ): void {
        window.api.ipc.send( 'overlay:broadcast', overlay );
    }

    public sendOverlayComponent( component: any ): void {
        window.api.ipc.send( 'overlay:send:component', component );
    }

    public highlightOverlay( overlayId: string ): void {
        window.api.ipc.send( 'overlay:highlight', overlayId );
    }

    public dimOverlay( overlayId: string ): void {
        window.api.ipc.send( 'overlay:dim', overlayId );
    }

    public requestTick(): void {
        window.api.ipc.send( 'app:request:tick', null );
    }

    public sendTestFn( rawLogLine: string ): void {
        window.api.ipc.send( 'log:send:raw', rawLogLine );
    }

    public sendOverlayToOrigin( overlayId: string, displayId: number ): void {
        window.api.logger.info( `[IpcService:sendOverlayToOrigin] Sending overlay ${overlayId} to display ${displayId}` );
        window.api.ipc.send( 'overlay:send-to-origin', { overlayId: overlayId, displayId: displayId } );
    }

    public getAudioFiles(): Observable<FileModel[]> {
        let obs: Observable<FileModel[]> = new Observable<FileModel[]>( ( observer: Observer<FileModel[]> ) => {
            
            window.api.ipc.once( 'audio-file:get', ( e, audioFiles: FileModel[] ) => {
                this.ngZone.run( () => {
                    observer.next( audioFiles );
                    observer.complete();
                } );
            } );
            window.api.ipc.send( 'audio-file:get', null );

        } );

        return obs;
    }

    public getAudioFileData(): Observable<PackageFileModel[]> {
        let obs: Observable<PackageFileModel[]> = new Observable<PackageFileModel[]>( ( observer: Observer<PackageFileModel[]> ) => {
            
            window.api.ipc.once( 'audio-file:getData', ( e, audioFiles: PackageFileModel[] ) => {
                this.ngZone.run( () => {
                    observer.next( audioFiles );
                    observer.complete();
                } );
            } );
            window.api.ipc.send( 'audio-file:getData', null );

        } );

        return obs;
    }

    public getAudioFileUrl( fileId: string ): Observable<string> {
        let obs: Observable<string> = new Observable<string>( ( observer: Observer<string> ) => {
            
            window.api.ipc.once( 'audio-file:get:url', ( e, fileUrl: string ) => {
                this.ngZone.run( () => {
                    observer.next( fileUrl );
                    observer.complete();
                } );
            } );
            window.api.ipc.send( 'audio-file:get:url', fileId );

        } );

        return obs;
    }

    public importPackageFile( file: PackageFileModel ): Observable<string> {
        let obs: Observable<string> = new Observable<string>( ( observer: Observer<string> ) => {

            window.api.ipc.once( 'file:importFromPackage', ( e, fileId: string ) => {
                this.ngZone.run( () => {
                    observer.next( fileId );
                    observer.complete();
                } );
            } );
            window.api.ipc.send( 'file:importFromPackage', file );

        } );

        return obs;
    }

    public installTriggerPackage( triggerPackage: TriggerPackageMetaModel ): Observable<boolean> {
        let obs: Observable<boolean> = new Observable<boolean>( ( observer: Observer<boolean> ) => {

            window.api.ipc.once( 'pkg:install', ( e, installComplete: boolean ) => {
                this.ngZone.run( () => {
                    observer.next( installComplete );
                    observer.complete();
                } );
            } );
            window.api.ipc.send( 'pkg:install', triggerPackage );

        } );

        return obs;
    }

    public uninstallTriggerPackage( packageId: string ): Observable<boolean> {
        let obs: Observable<boolean> = new Observable<boolean>( ( observer: Observer<boolean> ) => {

            window.api.ipc.once( 'pkg:uninstall', ( e, complete: boolean ) => {
                this.ngZone.run( () => {
                    observer.next( complete );
                    observer.complete();
                } );
            } );
            window.api.ipc.send( 'pkg:uninstall', packageId );

        } );

        return obs;
    }

    public isPackageInstalled( packageId: string ): Observable<boolean> {
        let obs: Observable<boolean> = new Observable<boolean>( ( observer: Observer<boolean> ) => {

            window.api.ipc.once( `pkg:isInstalled:${packageId}`, ( e, installed: boolean ) => {
                this.ngZone.run( () => {
                    observer.next( installed );
                    observer.complete();
                } );
            } );
            window.api.ipc.send( 'pkg:isInstalled', packageId );

        } );

        return obs;
    }

    public getInstalledPackages(): Observable<TriggerPackageVersion[]> {
        let obs: Observable<TriggerPackageVersion[]> = new Observable<TriggerPackageVersion[]>( ( observer: Observer<TriggerPackageVersion[]> ) => {

            window.api.ipc.once( 'pkg:get:installed', ( e, installed: TriggerPackageVersion[] ) => {
                this.ngZone.run( () => {
                    observer.next( installed );
                    observer.complete();
                } );
            } );
            window.api.ipc.send( 'pkg:get:installed' );

        } );

        return obs;
    }

    public installQuickShare( quickShare: QuickShareMetaModel ): Observable<boolean> {
        let obs: Observable<boolean> = new Observable<boolean>( ( observer: Observer<boolean> ) => {

            window.api.ipc.once( 'quickShare:install', ( e, installComplete: boolean ) => {
                this.ngZone.run( () => {
                    observer.next( installComplete );
                    observer.complete();
                } );
            } );
            window.api.ipc.send( 'quickShare:install', quickShare );

        } );

        return obs;
    }

    public saveAudioFile( file: File ): Observable<string> {
        let obs: Observable<string> = new Observable<string>( ( observer: Observer<string> ) => {
            let name = file.name;

            if ( !name.endsWith( '.mp3' ) )
                throw 'Only MP3 files are supported!';

            let reader = new FileReader();
            reader.onload = () => {
                if ( reader.readyState === 2 ) {
                    // TODO: Test to make sure upgrading electron didn't break js file handling.
                    let buffer = Buffer.from( <any>reader.result );
                    window.api.ipc.send( 'audio-file:save', { name: name, buffer: buffer } );
                }
            };
            reader.readAsArrayBuffer( file );

            window.api.ipc.once( 'audio-file:save', ( e, fileId: string ) => {
                this.ngZone.run( () => {
                    observer.next( fileId );
                    observer.complete();
                } );
            } );

        } );

        return obs;
    }

    public importAudioFile( filename: string ): Observable<string|undefined> {
        let obs: Observable<string|undefined> = new Observable<string|undefined>( ( observer: Observer<string|undefined> ) => {

            window.api.ipc.once( 'audio-file:import', ( e, fileId: string|undefined ) => {
                this.ngZone.run( () => {
                    observer.next( fileId ?? 'asdf' );
                    observer.complete();
                } );
            } );
            window.api.ipc.send( 'audio-file:import', filename );

        } );

        return obs;
    }

    public getPhoneticTransforms(): Observable<Record<string, string>> {
        let obs: Observable<Record<string, string>> = new Observable<Record<string, string>>( ( observer: Observer<Record<string, string>> ) => {
            
            window.api.ipc.once( 'settings:get:phonetic-transforms', ( e, phoneticTransforms: Record<string, string> ) => {
                this.ngZone.run( () => {
                    observer.next( phoneticTransforms );
                    observer.complete();
                } );
            } );
            window.api.ipc.send( 'settings:get:phonetic-transforms', null );

        } );

        return obs;
    }

    public savePhoneticTransforms( transforms: Record<string, string> ): void {
        window.api.ipc.send( 'settings:set:phonetic-transforms', transforms );
    }

    public getAuthor(): Observable<AuthorModel> {
        let obs: Observable<AuthorModel> = new Observable<AuthorModel>( ( observer: Observer<AuthorModel> ) => {
            
            window.api.ipc.once( 'settings:get:author', ( e, author: AuthorModel ) => {
                this.ngZone.run( () => {
                    observer.next( author );
                    observer.complete();
                } );
            } );
            window.api.ipc.send( 'settings:get:author', null );

        } );

        return obs;
    }

    public resetHiddenModalIds(): void {
        window.api.ipc.send( 'settings:set:hidden-modal-ids', [] );
    }

    public saveHiddenModalIds( hiddenModalIds: string[] ): void {
        window.api.ipc.send( 'settings:set:hidden-modal-ids', hiddenModalIds );
    }

    public addHiddenModalIds( modalId: string ): void {
        window.api.ipc.send( 'settings:set:hidden-modal-ids:add', modalId );
    }

    public getHiddenModalIds(): Observable<string[]> {
        let obs: Observable<string[]> = new Observable<string[]>( ( observer: Observer<string[]> ) => {
            
            window.api.ipc.once( 'settings:get:hidden-modal-ids', ( e, hiddenModalIds: string[] ) => {
                this.ngZone.run( () => {
                    observer.next( hiddenModalIds );
                    observer.complete();
                } );
            } );
            window.api.ipc.send( 'settings:get:hidden-modal-ids', null );

        } );

        return obs;
    }

    public saveDetrimentalOverlayId( detrimentalOverlayId: string ): void {
        window.api.ipc.send( 'settings:set:detrimentalOverlayId', detrimentalOverlayId );
    }

    public getDetrimentalOverlayId(): Observable<string> {
        let obs: Observable<string> = new Observable<string>( ( observer: Observer<string> ) => {
            
            window.api.ipc.once( 'settings:get:detrimentalOverlayId', ( e, detrimentalOverlayId: string ) => {
                this.ngZone.run( () => {
                    observer.next( detrimentalOverlayId );
                    observer.complete();
                } );
            } );
            window.api.ipc.send( 'settings:get:detrimentalOverlayId', null );

        } );

        return obs;
    }

    public saveBeneficialOverlayId( beneficialOverlayId: string ): void {
        window.api.ipc.send( 'settings:set:beneficialOverlayId', beneficialOverlayId );
    }

    public getBeneficialOverlayId(): Observable<string> {
        let obs: Observable<string> = new Observable<string>( ( observer: Observer<string> ) => {
            
            window.api.ipc.once( 'settings:get:beneficialOverlayId', ( e, beneficialOverlayId: string ) => {
                this.ngZone.run( () => {
                    observer.next( beneficialOverlayId );
                    observer.complete();
                } );
            } );
            window.api.ipc.send( 'settings:get:beneficialOverlayId', null );

        } );

        return obs;
    }

    public saveAlertOverlayId( alertOverlayId: string ): void {
        window.api.ipc.send( 'settings:set:alertOverlayId', alertOverlayId );
    }

    public getAlertOverlayId(): Observable<string> {
        let obs: Observable<string> = new Observable<string>( ( observer: Observer<string> ) => {
            
            window.api.ipc.once( 'settings:get:alertOverlayId', ( e, alertOverlayId: string ) => {
                this.ngZone.run( () => {
                    observer.next( alertOverlayId );
                    observer.complete();
                } );
            } );
            window.api.ipc.send( 'settings:get:alertOverlayId', null );

        } );

        return obs;
    }

    public saveDamageDealtOverlayId( damageDealtOverlayId: string ): void {
        window.api.ipc.send( 'settings:set:damageDealtOverlayId', damageDealtOverlayId );
    }

    public getDamageDealtOverlayId(): Observable<string> {
        let obs: Observable<string> = new Observable<string>( ( observer: Observer<string> ) => {
            
            window.api.ipc.once( 'settings:get:damageDealtOverlayId', ( e, damageDealtOverlayId: string ) => {
                this.ngZone.run( () => {
                    observer.next( damageDealtOverlayId );
                    observer.complete();
                } );
            } );
            window.api.ipc.send( 'settings:get:damageDealtOverlayId', null );

        } );

        return obs;
    }

    public saveDamageReceivedOverlayId( damageReceivedOverlayId: string ): void {
        window.api.ipc.send( 'settings:set:damageReceivedOverlayId', damageReceivedOverlayId );
    }

    public getDamageReceivedOverlayId(): Observable<string> {
        let obs: Observable<string> = new Observable<string>( ( observer: Observer<string> ) => {
            
            window.api.ipc.once( 'settings:get:damageReceivedOverlayId', ( e, damageReceivedOverlayId: string ) => {
                this.ngZone.run( () => {
                    observer.next( damageReceivedOverlayId );
                    observer.complete();
                } );
            } );
            window.api.ipc.send( 'settings:get:damageReceivedOverlayId', null );

        } );

        return obs;
    }

    public saveFctStyles( fctStyles: FctStylesModel ): void {
        window.api.ipc.send( 'settings:set:fctStyles', fctStyles );
    }

    public getFctStyles(): Observable<FctStylesModel> {
        let obs: Observable<FctStylesModel> = new Observable<FctStylesModel>( ( observer: Observer<FctStylesModel> ) => {
            
            window.api.ipc.once( 'settings:get:fctStyles', ( e, fctStyles: FctStylesModel ) => {
                this.ngZone.run( () => {
                    observer.next( fctStyles );
                    observer.complete();
                } );
            } );
            window.api.ipc.send( 'settings:get:fctStyles', null );

        } );

        return obs;
    }

    public saveSetupCompleted( completed: boolean ): void {
        completed = !!completed;
        window.api.ipc.send( 'settings:set:setupCompleted', completed );
    }

    public getSetupCompleted(): Observable<boolean> {
        let obs: Observable<boolean> = new Observable<boolean>( ( observer: Observer<boolean> ) => {

            window.api.ipc.invoke<boolean>( 'settings:get:setupCompleted' )
                .then( setupCompleted => {
                    this.ngZone.run( () => {
                        observer.next( setupCompleted );
                        observer.complete();
                    } );
                } );

        } );

        return obs;
    }

    public scrapeEqSpellResourceSpell( url: string ): Observable<ScrapedSpell> {
        let obs: Observable<ScrapedSpell> = new Observable<ScrapedSpell>( ( observer: Observer<ScrapedSpell> ) => {

            window.api.ipc.invoke<ScrapedSpell>( 'scraper:get:eqsr-spell', url )
                .then( spell => {
                    this.ngZone.run( () => {
                        observer.next( spell );
                        observer.complete();
                    } );
                } );

        } );

        return obs;
    }

    public scrapeEqSpellResourceItemClickInfo( url: string ): Observable<ScrapedClickEffect> {
        let obs: Observable<ScrapedClickEffect> = new Observable<ScrapedClickEffect>( ( observer: Observer<ScrapedClickEffect> ) => {

            window.api.ipc.invoke<ScrapedClickEffect>( 'scraper:get:eqsr-itemClick', url )
                .then( spell => {
                    this.ngZone.run( () => {
                        observer.next( spell );
                        observer.complete();
                    } );
                } );

        } );

        return obs;
    }

    public getCharacterOptions(logsPath: string): Observable<Record<string, CharacterModel[]>> {
        let obs: Observable<Record<string, CharacterModel[]>> = new Observable<Record<string, CharacterModel[]>>( ( observer: Observer<Record<string, CharacterModel[]>> ) => {

            window.api.ipc.invoke<Record<string, CharacterModel[]>>( 'character:get:options', logsPath )
                .then( characterOptions => {
                    this.ngZone.run( () => {
                        observer.next( characterOptions );
                        observer.complete();
                    } );
                } );

        } );

        return obs;
    }

    public saveAuthor( author: AuthorModel ): void {
        window.api.ipc.send( 'settings:set:author', author );
    }

    public getIgnoredGinaObjects(): Observable<string[]> {
        let obs: Observable<string[]> = new Observable<string[]>( ( observer: Observer<string[]> ) => {
            
            window.api.ipc.once( 'settings:get:ignore-gina-objects', ( e, ignoredGinaObjects: string[] ) => {
                this.ngZone.run( () => {
                    observer.next( ignoredGinaObjects );
                    observer.complete();
                } );
            } );
            window.api.ipc.send( 'settings:get:ignore-gina-objects', null );

        } );

        return obs;
    }

    public saveIgnoredGinaObjects( ignoredGinaObjects: string[] ): void {
        window.api.ipc.send( 'settings:set:ignore-gina-objects', ignoredGinaObjects );
    }

    /**
     * Returns the GINA configuration file if the GINA data folder was found.
     */
    public getGinaConfiguration( refreshCache: boolean = false ): Observable<GinaConfiguration> {
        
        if ( refreshCache === true ) {
            this._ginaConfigCache = null;
        }

        let obs: Observable<GinaConfiguration> = new Observable<GinaConfiguration>( ( observer: Observer<GinaConfiguration> ) => {
            if ( this._ginaConfigCache === null ) {
                window.api.ipc.once( 'gina:get:configuration', ( e, ginaConfig: GinaConfiguration ) => {
                    this.ngZone.run( () => {

                        // Because the source is XML, we need to process all arrays so that even if an array has a single element it's still an array.  I just don't want a bunch of "if property is array" statements in other areas of the code.
                        if ( !( ginaConfig.BehaviorGroups.Behavior instanceof Array ) ) {
                            ginaConfig.BehaviorGroups.Behavior = [ ginaConfig.BehaviorGroups.Behavior ];
                        }

                        if ( !( ginaConfig.Settings.PhoneticTransforms.Transform instanceof Array ) && ginaConfig.Settings.PhoneticTransforms ) {
                            ginaConfig.Settings.PhoneticTransforms.Transform = [ ginaConfig.Settings.PhoneticTransforms.Transform ];
                        }

                        this.processGinaTriggerGroup( ginaConfig.TriggerGroups );

                        this._ginaConfigCache = ginaConfig;
                        observer.next( ginaConfig );
                        observer.complete();

                    } );
                } );
                window.api.ipc.send( 'gina:get:configuration', null );
            } else {
                
                observer.next( this._ginaConfigCache );
                observer.complete();
            }

        } );

        return obs;
    }

    private processGinaTriggerGroup( groups: GinaTriggerGroups ): void {

        if ( !( groups.TriggerGroup instanceof Array ) ) {
            groups.TriggerGroup = [ groups.TriggerGroup ];
        }

        groups.TriggerGroup.forEach( group => {

            if ( group.Triggers != null && !( group.Triggers.Trigger instanceof Array ) ) {
                group.Triggers.Trigger = [ group.Triggers.Trigger ];
            }

            group.Triggers?.Trigger.forEach( trigger => {

                if ( trigger.TimerEarlyEnders?.EarlyEnder != null && !( trigger.TimerEarlyEnders.EarlyEnder instanceof Array ) ) {
                    trigger.TimerEarlyEnders.EarlyEnder = [ trigger.TimerEarlyEnders.EarlyEnder ];
                }

            } );

            if ( group.TriggerGroups?.TriggerGroup != null ) {
                this.processGinaTriggerGroup( group.TriggerGroups );
            }

        } );

    }

    public getTags(): Observable<Record<string, Tag>> {
        let obs: Observable<Record<string, Tag>> = new Observable<Record<string, Tag>>( ( observer: Observer<Record<string, Tag>> ) => {
            
            window.api.ipc.once( 'tags:get', ( e, tags: Tag[] ) => {
                this.ngZone.run( () => {

                    let tagDictionary: Record<string, Tag> = {};
                    tags.forEach( t => tagDictionary[ t.tagId ] = t );

                    observer.next( tagDictionary );
                    observer.complete();
                } );
            } );
            window.api.ipc.send( 'tags:get', null );

        } );

        return obs;
    }

    public createTag( model: Tag ): Observable<string> {
        let obs: Observable<string> = new Observable<string>( ( observer: Observer<string> ) => {
            
            window.api.ipc.once( 'tags:create', ( e, tagId: string ) => {
                this.ngZone.run( () => {
                    observer.next( tagId );
                    observer.complete();
                } );
            } );
            window.api.ipc.send( 'tags:create', model );

        } );

        return obs;
    }

    public updateTag( model: Tag ): void {
        window.api.ipc.send( 'tags:update', model );
    }

    public deleteTag( tagId: string ): void {
        window.api.ipc.send( 'tags:delete', tagId );
    }

    public getEverquestZones(): Observable<string[]> {
        let obs: Observable<string[]> = new Observable<string[]>( ( observer: Observer<string[]> ) => {
            
            window.api.ipc.once( 'zones:get:everquest', ( e, zones: string[] ) => {
                this.ngZone.run( () => {
                    observer.next( zones );
                    observer.complete();
                } );
            } );
            window.api.ipc.send( 'zones:get:everquest', null );

        } );

        return obs;
    }

    public sendTestModel( displayText: string ): void {
        window.api.ipc.send( 'overlay:send:component', {
            action: {
                displayText: displayText, // `Target Name --== Dot Name ==--`,
                actionType: ActionTypes.DotTimer,
                duration: 2 * 6,
            },
            // action: { displayText: `Dot Name --== {1} ==--` },
            overlayId : 'L3Yrmot0B5F4P0Pa',
            matches : [],
        } );
    }

    public updateEnableQuickShareImports( enabled: boolean ): void {
        window.api.ipc.send( 'settings:set:quickShareImports', enabled );
    }

    public getEnableQuickShareImports(): Observable<boolean> {
        let obs: Observable<boolean> = new Observable<boolean>( ( observer: Observer<boolean> ) => {
            
            window.api.ipc.once( 'settings:get:quickShareImports', ( e, enabled: boolean ) => {
                this.ngZone.run( () => {
                    observer.next( enabled );
                    observer.complete();
                } );
            } );
            window.api.ipc.send( 'settings:get:quickShareImports', null );

        } );

        return obs;
    }

    public updateEnableGlowOnStartup( enabled: boolean ): void {
        window.api.ipc.send( 'settings:set:glowOnStartup', enabled );
    }

    public getEnableGlowOnStartup(): Observable<boolean> {
        let obs: Observable<boolean> = new Observable<boolean>( ( observer: Observer<boolean> ) => {
            
            window.api.ipc.once( 'settings:get:glowOnStartup', ( e, enabled: boolean ) => {
                this.ngZone.run( () => {
                    observer.next( enabled );
                    observer.complete();
                } );
            } );
            window.api.ipc.send( 'settings:get:glowOnStartup', null );

        } );

        return obs;
    }

    public updateQuickShareAuthorsListType( listType: QuickShareAuthorListTypes ): void {
        window.api.ipc.send( 'settings:set:quickShareAuthorsListType', listType );
    }

    public getQuickShareAuthorsListType(): Observable<QuickShareAuthorListTypes> {
        let obs: Observable<QuickShareAuthorListTypes> = new Observable<QuickShareAuthorListTypes>( ( observer: Observer<QuickShareAuthorListTypes> ) => {
            
            window.api.ipc.once( 'settings:get:quickShareAuthorsListType', ( e, enabled: QuickShareAuthorListTypes ) => {
                this.ngZone.run( () => {
                    observer.next( enabled );
                    observer.complete();
                } );
            } );
            window.api.ipc.send( 'settings:get:quickShareAuthorsListType', null );

        } );

        return obs;
    }

    public updateQuickShareAuthorsList( list: string[] ): void {
        window.api.ipc.send( 'settings:set:quickShareAuthorsList', list );
    }

    public getQuickShareAuthorsList(): Observable<string[]> {
        let obs: Observable<string[]> = new Observable<string[]>( ( observer: Observer<string[]> ) => {
            
            window.api.ipc.once( 'settings:get:quickShareAuthorsList', ( e, enabled: string[] ) => {
                this.ngZone.run( () => {
                    observer.next( enabled );
                    observer.complete();
                } );
            } );
            window.api.ipc.send( 'settings:get:quickShareAuthorsList', null );

        } );

        return obs;
    }

    public updateMinimizeToTrayOnLoad( enabled: boolean ): void {
        window.api.ipc.send( 'settings:set:minimizeToTrayOnLoad', enabled );
    }

    public getMinimizeToTrayOnLoad(): Observable<boolean> {
        let obs: Observable<boolean> = new Observable<boolean>( ( observer: Observer<boolean> ) => {
            
            window.api.ipc.once( 'settings:get:minimizeToTrayOnLoad', ( e, enabled: boolean ) => {
                this.ngZone.run( () => {
                    observer.next( enabled );
                    observer.complete();
                } );
            } );
            window.api.ipc.send( 'settings:get:minimizeToTrayOnLoad', null );

        } );

        return obs;
    }

    public setLastUpdatedNotesViewed( version: string ): void {
        window.api.ipc.send( 'settings:set:lastViewedUpdateNotes', version );
    }

    public getLastUpdateNotesViewed(): Observable<string> {
        let obs: Observable<string> = new Observable<string>( ( observer: Observer<string> ) => {
            
            window.api.ipc.once( 'settings:get:lastViewedUpdateNotes', ( e, version: string ) => {
                this.ngZone.run( () => {
                    observer.next( version );
                    observer.complete();
                } );
            } );
            window.api.ipc.send( 'settings:get:lastViewedUpdateNotes', null );

        } );

        return obs;
    }

    public showUpdateNotesWindow(): void {
        window.api.ipc.send( 'window:update-notes:show' );
    }
    
    public updateDeathRecapPreferences( model: DeathRecapPreferences ): void {
        window.api.ipc.send( 'settings:set:deathRecap', model );
    }

    public getDeathRecapPreferences(): Observable<DeathRecapPreferences> {
        let obs: Observable<DeathRecapPreferences> = new Observable<DeathRecapPreferences>( ( observer: Observer<DeathRecapPreferences> ) => {
            
            window.api.ipc.once( 'settings:get:deathRecap', ( e, model: DeathRecapPreferences ) => {
                this.ngZone.run( () => {
                    observer.next( model );
                    observer.complete();
                } );
            } );
            window.api.ipc.send( 'settings:get:deathRecap', null );

        } );

        return obs;
    }

    /**
     * Returns the successful and exception parse history.
     * @returns 
     */
    public getParseHistory(): Observable<{ successful: TriggerParseHistoryModel[], exceptions: TriggerParseHistoryModel[] }> {
        let obs: Observable<{ successful: TriggerParseHistoryModel[], exceptions: TriggerParseHistoryModel[] }> = new Observable<{ successful: TriggerParseHistoryModel[], exceptions: TriggerParseHistoryModel[] }>( ( observer: Observer<{ successful: TriggerParseHistoryModel[], exceptions: TriggerParseHistoryModel[] }> ) => {
            
            window.api.ipc.once( 'trigger:get:history:all', ( e, model: { successful: TriggerParseHistoryModel[], exceptions: TriggerParseHistoryModel[] } ) => {
                this.ngZone.run( () => {
                    model.successful = model.successful.map( x => {
                        let m = Object.assign( new TriggerParseHistoryModel(), x );
                        m.timestamp = new Date( x.timestamp );
                        return m;
                    } );
                    model.exceptions = model.exceptions.map( x => {
                        let m = Object.assign( new TriggerParseHistoryModel(), x );
                        m.timestamp = new Date( x.timestamp );
                        return m;
                    } );
                    observer.next( model );
                    observer.complete();
                } );
            } );
            window.api.ipc.send( 'trigger:get:history:all', null );

        } );

        return obs;
    }

    public getConsoleData(): Observable<{ successful: TriggerParseHistoryModel[], failed: TriggerParseHistoryModel[], consoleMessages: ConsoleMessageModel[] }> {
        let obs: Observable<{ successful: TriggerParseHistoryModel[], failed: TriggerParseHistoryModel[], consoleMessages: ConsoleMessageModel[] }> = new Observable<{ successful: TriggerParseHistoryModel[], failed: TriggerParseHistoryModel[], consoleMessages: ConsoleMessageModel[] }>( ( observer: Observer<{ successful: TriggerParseHistoryModel[], failed: TriggerParseHistoryModel[], consoleMessages: ConsoleMessageModel[] }> ) => {
            let data: { successful: TriggerParseHistoryModel[], failed: TriggerParseHistoryModel[], consoleMessages: ConsoleMessageModel[] } = {
                successful: [],
                failed: [],
                consoleMessages: [],
            };
            data.successful = this._successfulParses.slice();
            data.failed = this._failedParses.slice();
            data.consoleMessages = this._consoleMessages.slice();
            observer.next( data );
            observer.complete();
        } );

        return obs;
    }

    /**
     * Returns the successful and exception parse history for a specific trigger.
     * 
     * @param triggerId The trigger id to get the history for.
     */
    public getTriggerParseHistory( triggerId: string ): Observable<{ successful: TriggerParseHistoryModel[], failed: TriggerParseHistoryModel[] }> {
        let obs: Observable<{ successful: TriggerParseHistoryModel[], failed: TriggerParseHistoryModel[] }> = new Observable<{ successful: TriggerParseHistoryModel[], failed: TriggerParseHistoryModel[] }>( ( observer: Observer<{ successful: TriggerParseHistoryModel[], failed: TriggerParseHistoryModel[] }> ) => {
            
            window.api.ipc.once( 'trigger:get:history', ( e, model: { successful: TriggerParseHistoryModel[], failed: TriggerParseHistoryModel[] } ) => {
                this.ngZone.run( () => {
                    model.successful = model.successful.map( x => {
                        let m = Object.assign( new TriggerParseHistoryModel(), x );
                        m.timestamp = new Date( x.timestamp );
                        return m;
                    } );
                    model.failed = model.failed.map( x => {
                        let m = Object.assign( new TriggerParseHistoryModel(), x );
                        m.timestamp = new Date( x.timestamp );
                        return m;
                    } );
                    
                    observer.next( model );
                    observer.complete();
                } );
            } );
            window.api.ipc.send( 'trigger:get:history', triggerId );

        } );

        return obs;
    }

    public migrateFctCombatGroups(): Observable<boolean> {
        let obs: Observable<boolean> = new Observable<boolean>( ( observer: Observer<boolean> ) => {
                
            window.api.ipc.once( 'overlay:migrate-fct', ( e, success: boolean ) => {
                this.ngZone.run( () => {
                    observer.next( success );
                    observer.complete();
                } );
            } );
            window.api.ipc.send( 'overlay:migrate-fct', undefined );

        } );

        return obs;
    }

    public initializeFctCombatGroups(): Observable<boolean> {
        let obs: Observable<boolean> = new Observable<boolean>( ( observer: Observer<boolean> ) => {
                    
            window.api.ipc.once( 'overlay:initialize-fct', ( e, success: boolean ) => {
                this.ngZone.run( () => {
                    observer.next( success );
                    observer.complete();
                } );
            } );
            window.api.ipc.send( 'overlay:initialize-fct', undefined );

        } );

        return obs;
    }
    
    /**
     * Installs the given overlays, allowing the user to make copies of each 
     * overlay or to map existing overlays to the new overlays.
     * 
     * @returns Returns an object that contains all overlay windows and the overlay window id map.
     * 
     * @param overlays The overlays to install.
     */
    installOverlays( overlays: OverlayWindowModel[], packagePrimaryDisplaySize: Electron.Size ): Observable<OverlayWindowModel[]> {
        let obs: Observable<OverlayWindowModel[]> = new Observable<OverlayWindowModel[]>( ( observer: Observer<OverlayWindowModel[]> ) => {
                    
            window.api.ipc.once( 'overlay:install-overlays', ( e, data: OverlayWindowModel[] ) => {
                this.ngZone.run( () => {
                    observer.next( data );
                    observer.complete();
                } );
            } );
            window.api.ipc.send( 'overlay:install-overlays', { overlays: overlays, packagePrimaryDisplaySize: packagePrimaryDisplaySize } );

        } );

        return obs;
    }

    /**
     * Deletes all existing combat groups and installs the given list of combat groups.
     * 
     * @param fctGroups The list of combat groups to install.
     */
    installCombatGroups( fctGroups: FctCombatGroup[] ): Observable<FctCombatGroup[]> {
        let obs: Observable<FctCombatGroup[]> = new Observable<FctCombatGroup[]>( ( observer: Observer<FctCombatGroup[]> ) => {
                    
            window.api.ipc.once( 'overlay:install-combat-groups', ( e, data: FctCombatGroup[] ) => {
                this.ngZone.run( () => {
                    observer.next( data );
                    observer.complete();
                } );
            } );
            window.api.ipc.send( 'overlay:install-combat-groups', fctGroups );

        } );

        return obs;
    }

}
