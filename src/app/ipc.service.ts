import { Injectable, NgZone } from '@angular/core';
import { IpcRenderer } from 'electron';
import { Observable, Observer } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { DataTickModel, DkpEntryModel, TriggerModel, OverlayWindowModel, ActionTypes, FocusEffectSettings, CharacterModel, BasicError, TriggerFolder, FileModel, Tag } from './core.model';
import { GinaConfiguration, GinaTriggerGroups } from './gina.model';

@Injectable( { providedIn: 'root' })
export class IpcService {
    
    private ipc: IpcRenderer;
    private _tickObservers: Observer<DataTickModel>[] = [];
    private _transmitObservers: Observer<DkpEntryModel[]>[] = [];
    private _logFileChangeObservers: Observer<string>[] = [];
    private _dkpAddedObservers: Observer<DkpEntryModel>[] = [];
    private _dkpRemovedObservers: Observer<string>[] = [];
    private _consoleLogRequestObservers: Observer<any>[] = [];
    private _logActivatedObservers: Observer<any>[] = [];
    private _logDeactivatedObservers: Observer<any>[] = [];

    constructor( private ngZone: NgZone ) {
        if ( ( <any>window ).require ) {
            try {
                this.ipc = ( <any>window ).require( 'electron' ).ipcRenderer;

                this.ipc.on( 'tick', ( event: any, data: DataTickModel ) => {
                    ngZone.run( () => {
                        this._tickObservers?.forEach( f => {
                            f.next( data );
                        } );
                    } );
                } );
                
                this.ipc.on( 'dkp:event:transmit', ( event: any, data: DkpEntryModel[] ) => {
                    ngZone.run( () => {
                        this._transmitObservers?.forEach( f => {
                            f.next( data );
                        } );
                    } );
                } );

                this.ipc.on( 'log:changed', ( event: any, data: string ) => {
                    ngZone.run( () => {
                        this._logFileChangeObservers?.forEach( f => {
                            f.next( data );
                        } );
                    } );
                } );

                this.ipc.on( 'dkp:add', ( event: any, data: DkpEntryModel ) => {
                    ngZone.run( () => {
                        this._dkpAddedObservers?.forEach( f => {
                            f.next( data );
                        } );
                    } );
                } );

                this.ipc.on( 'dkp:event:removed', ( event: any, data: any ) => {
                    ngZone.run( () => {
                        this._dkpRemovedObservers?.forEach( f => {
                            f.next( data );
                        } );
                    } );
                } );

                this.ipc.on( 'console:log', ( event: any, data: any ) => {
                    console.log( data );
                } );

                this.ipc.on( 'log:character:activated', ( event: any, data: any ) => {
                    ngZone.run( () => {
                        this._logActivatedObservers?.forEach( f => {
                            f.next( data );
                        } );
                    } );
                } );

                this.ipc.on( 'log:character:deactivated', ( event: any, data: any ) => {
                    ngZone.run( () => {
                        this._logDeactivatedObservers?.forEach( f => {
                            f.next( data );
                        } );
                    } );
                } );

            } catch ( e ) {
                throw e;
            }
        } else {
            console.warn( 'App not running inside Electron!' );
        }
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
            
            this.ipc.once( 'app:version', ( e, v ) => {
                this.ngZone.run( () => {
                    observer.next( v.version );
                    observer.complete();
                } );
            } );
            this.ipc.send( 'app:version' );

        } );

        return obs;
    }

    public getAppIsDev(): Observable<boolean> {
        let obs: Observable<boolean> = new Observable<boolean>( ( observer: Observer<boolean> ) => {
            
            this.ipc.once( 'app:isDev', ( e, isDev ) => {
                this.ngZone.run( () => {
                    observer.next( isDev );
                    observer.complete();
                } );
            } );
            this.ipc.send( 'app:isDev' );

        } );

        return obs;
    }

    public consoleLogRequested(): Observable<any> {
        let obs: Observable<any> = new Observable<any>( ( observer: Observer<any> ) => {
            this._consoleLogRequestObservers.push( observer );
        } );

        return obs;
    }

    public removeDkpAward( entry: DkpEntryModel ): void {
        this.ipc.send( 'dkp:remove', entry );
    }

    public quitApp(): void {
        this.ipc.send( 'app:quit' );
    }

    public minimizeApp(): void {
        this.ipc.send( 'app:minimize' );
    }

    public updateLogFile( logFile: string ): void {
        this.ipc.send( 'log:select', logFile );
    }

    public updateVoiceIndex( index: number ): void {
        this.ipc.send( 'voice:select', index );
    }

    public updateFocusEffectSettings( model: FocusEffectSettings ): void {
        this.ipc.send( 'settings:set:focus-effects', model );
    }

    public updateEnableFct( enabled: boolean ): void {
        this.ipc.send( 'settings:set:fct', enabled );
    }

    public updateDamageDealtOverlayId( overlayId: string ): void {
        this.ipc.send( 'settings:set:damageDealtOverlayId', overlayId );
    }

    public updateDamageReceivedOverlayId( overlayId: string ): void {
        this.ipc.send( 'settings:set:damageReceivedOverlayId', overlayId );
    }

    public sendTextToClipboard( value: string ): void {
        this.ipc.send( 'clipboard:writeText', value );
    }

    public markDkpEntriesAsEntered( entries: DkpEntryModel[] ): void {
        this.ipc.send( 'dkp:markAsEntered', entries );
    }

    public clearDkpLog(): void {
        this.ipc.send( 'dkp:reset' );
    }

    public showNewTriggerDialog( folderId?: string ): void {
        this.ipc.send( 'trigger:dialog:new', folderId );
    }

    public showEditTriggerDialog( triggerId: string ): void {
        this.ipc.send( 'trigger:dialog:edit', triggerId );
    }

    public closeThisChild(): void {
        this.ipc.send( 'window:child:close' );
    }

    public resizeTriggerWindow( width: number = null, height: number = null ): void {
        this.ipc.send( 'trigger:dialog:resize', { width: width, height: height } );
    }

    public showGinaImportWindow(): Observable<boolean> {
        let obs: Observable<boolean> = new Observable<boolean>( ( observer: Observer<boolean> ) => {
            
            this.ipc.once( 'gina:dialog:import', ( e, loaded ) => {
                this.ngZone.run( () => {
                    observer.next( loaded );
                    observer.complete();
                } );
            } );
            this.ipc.send( 'gina:dialog:import', null );

        } );

        return obs;
    }

    public simulateLogParse( file: string ): void {
        this.ipc.send( 'log:simulate:file', file );
    }

    public createNewTrigger( model: TriggerModel ): Observable<string> {
        let obs: Observable<string> = new Observable<string>( ( observer: Observer<string> ) => {
            
            this.ipc.once( 'trigger:create', ( e, triggerId ) => {
                this.ngZone.run( () => {
                    observer.next( triggerId );
                    observer.complete();
                } );
            } );
            this.ipc.send( 'trigger:create', model );

        } );

        return obs;
    }

    public getTriggers(): Observable<TriggerModel[]> {
        let obs: Observable<TriggerModel[]> = new Observable<TriggerModel[]>( ( observer: Observer<TriggerModel[]> ) => {
            
            this.ipc.once( 'trigger:get', ( e, triggers: TriggerModel[] ) => {
                this.ngZone.run( () => {
                    observer.next( triggers );
                    observer.complete();
                } );
            } );
            this.ipc.send( 'trigger:get', null );

        } );

        return obs;
    }

    public getTrigger( triggerId: string ): Observable<TriggerModel> {
        let obs: Observable<TriggerModel> = new Observable<TriggerModel>( ( observer: Observer<TriggerModel> ) => {
            
            this.ipc.once( 'trigger:get', ( e, trigger: TriggerModel ) => {
                this.ngZone.run( () => {
                    observer.next( trigger );
                    observer.complete();
                } );
            } );
            this.ipc.send( 'trigger:get', triggerId );

        } );

        return obs;
    }

    public searchTriggers( term: string ): Observable<TriggerModel[]> {
        let obs: Observable<TriggerModel[]> = new Observable<TriggerModel[]>( ( observer: Observer<TriggerModel[]> ) => {
            
            this.ipc.once( 'trigger:search', ( e, triggers: TriggerModel[] ) => {
                this.ngZone.run( () => {
                    observer.next( triggers );
                    observer.complete();
                } );
            } );
            this.ipc.send( 'trigger:search', term );

        } );

        return obs;
    }

    public updateTrigger( model: TriggerModel ): Observable<boolean> {
        let obs: Observable<boolean> = new Observable<boolean>( ( observer: Observer<boolean> ) => {
            
            this.ipc.once( 'trigger:update', ( e, updated: boolean ) => {
                this.ngZone.run( () => {
                    observer.next( updated );
                    observer.complete();
                } );
            } );
            this.ipc.send( 'trigger:update', model );

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
            
            this.ipc.once( 'trigger:update:batch', ( e, failed: TriggerModel[] ) => {
                this.ngZone.run( () => {
                    observer.next( failed );
                    observer.complete();
                } );
            } );
            this.ipc.send( 'trigger:update:batch', triggers );

        } );

        return obs;
    }

    public deleteTrigger( triggerId: string ): Observable<boolean> {
        let obs: Observable<boolean> = new Observable<boolean>( ( observer: Observer<boolean> ) => {
            
            this.ipc.once( 'trigger:delete', ( e, deleted: boolean ) => {
                this.ngZone.run( () => {
                    observer.next( deleted );
                    observer.complete();
                } );
            } );
            this.ipc.send( 'trigger:delete', triggerId );

        } );

        return obs;
    }

    public getTriggerFolders(): Observable<TriggerFolder[]> {
        let obs: Observable<TriggerFolder[]> = new Observable<TriggerFolder[]>( ( observer: Observer<TriggerFolder[]> ) => {
            
            this.ipc.once( 'folders:get', ( e, folders: TriggerFolder[] ) => {
                this.ngZone.run( () => {
                    observer.next( folders );
                    observer.complete();
                } );
            } );
            this.ipc.send( 'folders:get', null );

        } );

        return obs;
    }

    public updateTriggerFolders( folders: TriggerFolder[] ): Observable<TriggerFolder[]> {
        let obs: Observable<TriggerFolder[]> = new Observable<TriggerFolder[]>( ( observer: Observer<TriggerFolder[]> ) => {
            
            this.ipc.once( 'folders:update', ( e, updatedFolders: TriggerFolder[] ) => {
                this.ngZone.run( () => {
                    observer.next( updatedFolders );
                    observer.complete();
                } );
            } );
            this.ipc.send( 'folders:update', folders );

        } );

        return obs;
    }

    /**
     * Returns a list of all stored variables.
     */
    public getStoredVariables(): Observable<string[]> {
        let obs: Observable<string[]> = new Observable<string[]>( ( observer: Observer<string[]> ) => {
            
            this.ipc.once( 'trigger:get:stored-variables', ( e, storedVariables: string[] ) => {
                this.ngZone.run( () => {
                    observer.next( storedVariables );
                    observer.complete();
                } );
            } );
            this.ipc.send( 'trigger:get:stored-variables', null );

        } );

        return obs;
    }

    public createNewOverlayWindow( model: OverlayWindowModel ): Observable<string> {
        let obs: Observable<string> = new Observable<string>( ( observer: Observer<string> ) => {
            
            this.ipc.once( 'overlay:create', ( e, overlayId ) => {
                this.ngZone.run( () => {
                    observer.next( overlayId );
                    observer.complete();
                } );
            } );
            this.ipc.send( 'overlay:create', model );

        } );

        return obs;
    }

    public getOverlayWindows(): Observable<OverlayWindowModel[]> {
        let obs: Observable<OverlayWindowModel[]> = new Observable<OverlayWindowModel[]>( ( observer: Observer<OverlayWindowModel[]> ) => {
            
            this.ipc.once( 'overlay:get', ( e, overlays: OverlayWindowModel[] ) => {
                this.ngZone.run( () => {
                    observer.next( overlays );
                    observer.complete();
                } );
            } );
            this.ipc.send( 'overlay:get', null );

        } );

        return obs;
    }

    public getOverlayWindow( overlayId: string ): Observable<OverlayWindowModel> {
        let obs: Observable<OverlayWindowModel> = new Observable<OverlayWindowModel>( ( observer: Observer<OverlayWindowModel> ) => {
            
            this.ipc.once( 'overlay:get', ( e, overlay: OverlayWindowModel ) => {
                this.ngZone.run( () => {
                    observer.next( overlay );
                    observer.complete();
                } );
            } );
            this.ipc.send( 'overlay:get', overlayId );

        } );

        return obs;
    }

    public updateOverlayWindow( model: OverlayWindowModel ): Observable<boolean> {
        let obs: Observable<boolean> = new Observable<boolean>( ( observer: Observer<boolean> ) => {
            
            this.ipc.once( 'overlay:update:meta', ( e, updated: boolean ) => {
                this.ngZone.run( () => {
                    observer.next( updated );
                    observer.complete();
                } );
            } );
            this.ipc.send( 'overlay:update:meta', model );

        } );

        return obs;
    }

    public deleteOverlayWindow( overlayId: string ): Observable<boolean> {
        let obs: Observable<boolean> = new Observable<boolean>( ( observer: Observer<boolean> ) => {
            
            this.ipc.once( 'overlay:delete', ( e, deleted: boolean ) => {
                this.ngZone.run( () => {
                    observer.next( deleted );
                    observer.complete();
                } );
            } );
            this.ipc.send( 'overlay:delete', overlayId );

        } );

        return obs;
    }

    public createCharacter( model: CharacterModel ): Observable<string> {
        let obs: Observable<string> = new Observable<string>( ( observer: Observer<string> ) => {
            
            this.ipc.once( 'character:create', ( e, characterId: string ) => {
                this.ngZone.run( () => {
                    observer.next( characterId );
                    observer.complete();
                } );
            } );
            this.ipc.send( 'character:create', model );

        } );

        return obs;
    }

    public getCharacters(): Observable<CharacterModel[]> {
        let obs: Observable<CharacterModel[]> = new Observable<CharacterModel[]>( ( observer: Observer<CharacterModel[]> ) => {
            
            this.ipc.once( 'character:get', ( e, overlays: CharacterModel[] ) => {
                this.ngZone.run( () => {
                    observer.next( overlays );
                    observer.complete();
                } );
            } );
            this.ipc.send( 'character:get', null );

        } );

        return obs;
    }

    public getCharacter( characterId: string ): Observable<CharacterModel> {
        let obs: Observable<CharacterModel> = new Observable<CharacterModel>( ( observer: Observer<CharacterModel> ) => {
            
            this.ipc.once( 'character:get', ( e, character: CharacterModel ) => {
                this.ngZone.run( () => {
                    observer.next( character );
                    observer.complete();
                } );
            } );
            this.ipc.send( 'character:get', characterId );

        } );

        return obs;
    }

    public updateCharacter( model: CharacterModel ): Observable<boolean> {
        let obs: Observable<boolean> = new Observable<boolean>( ( observer: Observer<boolean> ) => {
            
            this.ipc.once( 'character:update', ( e, updated: boolean ) => {
                this.ngZone.run( () => {
                    observer.next( updated );
                    observer.complete();
                } );
            } );
            this.ipc.send( 'character:update', model );

        } );

        return obs;
    }

    public deleteCharacter( characterId: string ): Observable<boolean> {
        let obs: Observable<boolean> = new Observable<boolean>( ( observer: Observer<boolean> ) => {
            
            this.ipc.once( 'character:delete', ( e, deleted: boolean ) => {
                this.ngZone.run( () => {
                    observer.next( deleted );
                    observer.complete();
                } );
            } );
            this.ipc.send( 'character:delete', characterId );

        } );

        return obs;
    }

    public getEqInstallFolder(): Observable<string> {
        let obs: Observable<string> = new Observable<string>( ( observer: Observer<string> ) => {
            
            this.ipc.once( 'settings:get:everquest-folder', ( e, folder: string ) => {
                this.ngZone.run( () => {
                    observer.next( folder );
                    observer.complete();
                } );
            } );
            this.ipc.send( 'settings:get:everquest-folder', null );

        } );

        return obs;
    }

    public getEqSpellIcons(): Observable<string[]> {
        let obs: Observable<string[]> = new Observable<string[]>( ( observer: Observer<string[]> ) => {
            
            this.ipc.once( 'game-resources:get:eq:icons', ( e, icons: string[] ) => {
                this.ngZone.run( () => {
                    observer.next( icons );
                    observer.complete();
                } );
            } );
            this.ipc.once( 'game-resources:get:eq:icons:error', ( e, error: BasicError ) => {
                this.ngZone.run( () => {
                    observer.error( error );
                    observer.complete();
                } );
            } );
            this.ipc.send( 'game-resources:get:eq:icons', null );

        } );

        return obs;
    }

    public setEqInstallFolder( folder: string ): void {
        this.ipc.send( 'settings:set:everquest-folder', folder );
    }

    public enableOverlayEditMode( overlayId: string ): void {
        this.ipc.send( 'overlay:enable-edit', overlayId );
    }

    public disableOverlayEditMode( overlayId: string ): void {
        this.ipc.send( 'overlay:disable-edit', overlayId );
    }

    public showEditOverlayDialog( overlayId: string ): void {
        this.ipc.send( 'overlay:dialog:edit', overlayId );
    }

    public broadcastOverlayModel( overlay: OverlayWindowModel ): void {
        this.ipc.send( 'overlay:broadcast', overlay );
    }

    public sendOverlayComponent( component: any ): void {
        this.ipc.send( 'overlay:send:component', component );
    }

    public highlightOverlay( overlayId: string ): void {
        this.ipc.send( 'overlay:highlight', overlayId );
    }

    public dimOverlay( overlayId: string ): void {
        this.ipc.send( 'overlay:dim', overlayId );
    }

    public requestTick(): void {
        this.ipc.send( 'app:request:tick', null );
    }

    public sendTestFn( rawLogLine: string ): void {
        this.ipc.send( 'log:send:raw', rawLogLine );
    }

    public getAudioFiles(): Observable<FileModel[]> {
        let obs: Observable<FileModel[]> = new Observable<FileModel[]>( ( observer: Observer<FileModel[]> ) => {
            
            this.ipc.once( 'audio-file:get', ( e, audioFiles: FileModel[] ) => {
                this.ngZone.run( () => {
                    observer.next( audioFiles );
                    observer.complete();
                } );
            } );
            this.ipc.send( 'audio-file:get', null );

        } );

        return obs;
    }

    public getAudioFileUrl( fileId: string ): Observable<string> {
        let obs: Observable<string> = new Observable<string>( ( observer: Observer<string> ) => {
            
            this.ipc.once( 'audio-file:get:url', ( e, fileUrl: string ) => {
                this.ngZone.run( () => {
                    observer.next( fileUrl );
                    observer.complete();
                } );
            } );
            this.ipc.send( 'audio-file:get:url', fileId );

        } );

        return obs;
    }

    public saveAudioFile( file: File ): Observable<string> {
        let obs: Observable<string> = new Observable<string>( ( observer: Observer<string> ) => {
            let name = file.name;

            let reader = new FileReader();
            reader.onload = () => {
                if ( reader.readyState === 2 ) {
                    let buffer = Buffer.from( reader.result );
                    this.ipc.send( 'audio-file:save', { name: name, buffer: buffer } );
                }
            };
            reader.readAsArrayBuffer( file );

            this.ipc.once( 'audio-file:save', ( e, fileId: string ) => {
                this.ngZone.run( () => {
                    observer.next( fileId );
                    observer.complete();
                } );
            } );

        } );

        return obs;
    }

    public getPhoneticTransforms(): Observable<Record<string, string>> {
        let obs: Observable<Record<string, string>> = new Observable<Record<string, string>>( ( observer: Observer<Record<string, string>> ) => {
            
            this.ipc.once( 'settings:get:phonetic-transforms', ( e, phoneticTransforms: Record<string, string> ) => {
                this.ngZone.run( () => {
                    observer.next( phoneticTransforms );
                    observer.complete();
                } );
            } );
            this.ipc.send( 'settings:get:phonetic-transforms', null );

        } );

        return obs;
    }

    public savePhoneticTransforms( transforms: Record<string, string> ): void {
        this.ipc.send( 'settings:set:phonetic-transforms', transforms );
    }

    public getIgnoredGinaObjects(): Observable<string[]> {
        let obs: Observable<string[]> = new Observable<string[]>( ( observer: Observer<string[]> ) => {
            
            this.ipc.once( 'settings:get:ignore-gina-objects', ( e, ignoredGinaObjects: string[] ) => {
                this.ngZone.run( () => {
                    observer.next( ignoredGinaObjects );
                    observer.complete();
                } );
            } );
            this.ipc.send( 'settings:get:ignoredGinaObjects', null );

        } );

        return obs;
    }

    public saveIgnoredGinaObjects( ignoredGinaObjects: string[] ): void {
        this.ipc.send( 'settings:set:ignore-gina-objects', ignoredGinaObjects );
    }

    /**
     * Returns the GINA configuration file if the GINA data folder was found.
     */
    public getGinaConfiguration(): Observable<GinaConfiguration> {
        let obs: Observable<GinaConfiguration> = new Observable<GinaConfiguration>( ( observer: Observer<GinaConfiguration> ) => {
            
            this.ipc.once( 'gina:get:configuration', ( e, ginaConfig: GinaConfiguration ) => {
                this.ngZone.run( () => {

                    // Because the source is XML, we need to process all arrays so that even if an array has a single element it's still an array.  I just don't want a bunch of "if property is array" statements in other areas of the code.
                    if ( !( ginaConfig.BehaviorGroups.Behavior instanceof Array ) ) {
                        ginaConfig.BehaviorGroups.Behavior = [ ginaConfig.BehaviorGroups.Behavior ];
                    }

                    if ( !( ginaConfig.Settings.PhoneticTransforms.Transform instanceof Array ) ) {
                        ginaConfig.Settings.PhoneticTransforms.Transform = [ ginaConfig.Settings.PhoneticTransforms.Transform ];
                    }

                    this.processGinaTriggerGroup( ginaConfig.TriggerGroups );
                    
                    observer.next( ginaConfig );
                    observer.complete();

                } );
            } );
            this.ipc.send( 'gina:get:configuration', null );

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
            
            this.ipc.once( 'tags:get', ( e, tags: Tag[] ) => {
                this.ngZone.run( () => {

                    let tagDictionary: Record<string, Tag> = {};
                    tags.forEach( t => tagDictionary[ t.tagId ] = t );

                    observer.next( tagDictionary );
                    observer.complete();
                } );
            } );
            this.ipc.send( 'tags:get', null );

        } );

        return obs;
    }

    public createTag( model: Tag ): Observable<string> {
        let obs: Observable<string> = new Observable<string>( ( observer: Observer<string> ) => {
            
            this.ipc.once( 'tags:create', ( e, tagId: string ) => {
                this.ngZone.run( () => {
                    observer.next( tagId );
                    observer.complete();
                } );
            } );
            this.ipc.send( 'tags:create', model );

        } );

        return obs;
    }

    public updateTag( model: Tag ): void {
        this.ipc.send( 'tags:update', model );
    }

    public deleteTag( tagId: string ): void {
        this.ipc.send( 'tags:delete', tagId );
    }

    public sendTestModel( displayText: string ): void {
        // let comp = new OverlayComponent();
        // let comp: any = {
        //     action: Object.assign( new TriggerAction(), action ),
        //     action.displayText : `${f.name} --== {1} ==--`,
        //     overlayId : action.overlayId,
        //     matches : res.result,
        // };
        this.ipc.send( 'overlay:send:component', {
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

}
