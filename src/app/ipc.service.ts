import { Injectable, NgZone } from '@angular/core';
import { IpcRenderer } from 'electron';
import { Observable, Observer } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { DataTickModel, DkpEntryModel, TriggerModel, OverlayWindowModel, ActionTypes, FocusEffectSettings, CharacterModel } from './core.model';

@Injectable()
export class IpcService {
    
    private ipc: IpcRenderer;
    private _tickObservers: Observer<DataTickModel>[] = [];
    private _transmitObservers: Observer<DkpEntryModel[]>[] = [];
    private _logFileChangeObservers: Observer<string>[] = [];
    private _dkpAddedObservers: Observer<DkpEntryModel>[] = [];
    private _dkpRemovedObservers: Observer<string>[] = [];
    private _consoleLogRequestObservers: Observer<any>[] = [];

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

    public showNewTriggerDialog(): void {
        this.ipc.send( 'trigger:dialog:new' );
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

    public sendTestFn( rawLogLine: string ): void {
        this.ipc.send( 'log:send:raw', rawLogLine );
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
