import { Injectable, NgZone } from '@angular/core';
import { IpcRenderer } from 'electron';
import { Observable, Observer } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { DataTickModel, DkpEntryModel, TriggerModel, OverlayWindowModel } from './core.model';

@Injectable()
export class IpcService {
    
    private ipc: IpcRenderer;
    private _tickObservers: Observer<DataTickModel>[] = [];
    private _transmitObservers: Observer<DkpEntryModel[]>[] = [];
    private _logFileChangeObservers: Observer<string>[] = [];
    private _dkpAddedObservers: Observer<DkpEntryModel>[] = [];
    private _dkpRemovedObservers: Observer<number>[] = [];
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

                this.ipc.on( 'changeLogFile', ( event: any, data: string ) => {
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
                    console.log( 'log', data );
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

    public dkpEntryRemoved(): Observable<number> {
        let obs: Observable<number> = new Observable<number>( ( observer: Observer<number> ) => {
            this._dkpRemovedObservers.push( observer );
        } );

        return obs;
    }

    public getAppVersion(): Observable<string> {
        let obs: Observable<string> = new Observable<string>( ( observer: Observer<string> ) => {
            
            this.ipc.once( 'app_version', ( e, v ) => {
                this.ngZone.run( () => {
                    observer.next( v.version );
                    observer.complete();
                } );
            } );
            this.ipc.send( 'app_version' );

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
        this.ipc.send( 'quitApp' );
    }

    public updateLogFile( logFile: string ): void {
        this.ipc.send( 'logSelected', logFile );
    }

    public updateVoiceIndex( index: number ): void {
        this.ipc.send( 'selectVoice', index );
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

}
