import { Injectable, NgZone } from '@angular/core';
import { IpcRenderer } from 'electron';
import { Observable, Observer } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { DataTickModel, DkpEntryModel } from './core.model';

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
                
                this.ipc.on( 'transmitDkpDatabase', ( event: any, data: DkpEntryModel[] ) => {
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

                this.ipc.on( 'addDkpEntry', ( event: any, data: DkpEntryModel ) => {
                    ngZone.run( () => {
                        this._dkpAddedObservers?.forEach( f => {
                            f.next( data );
                        } );
                    } );
                } );

                this.ipc.on( 'dkpAwardRemoved', ( event: any, data: any ) => {
                    ngZone.run( () => {
                        this._consoleLogRequestObservers?.forEach( f => {
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

    public tickReceived (): Observable<DataTickModel> {
        let obs: Observable<DataTickModel> = new Observable<DataTickModel>( ( observer: Observer<DataTickModel> ) => {
            this._tickObservers.push( observer );
        } );

        return obs;
    }

    public receiveDkpDatabase (): Observable<DkpEntryModel[]> {
        let obs: Observable<DkpEntryModel[]> = new Observable<DkpEntryModel[]>( ( observer: Observer<DkpEntryModel[]> ) => {
            this._transmitObservers.push( observer );
        } );

        return obs;
    }

    public logFileChanged (): Observable<string> {
        let obs: Observable<string> = new Observable<string>( ( observer: Observer<string> ) => {
            this._logFileChangeObservers.push( observer );
        } );

        return obs;
    }

    public dkpEntryAdded (): Observable<DkpEntryModel> {
        let obs: Observable<DkpEntryModel> = new Observable<DkpEntryModel>( ( observer: Observer<DkpEntryModel> ) => {
            this._dkpAddedObservers.push( observer );
        } );

        return obs;
    }

    public dkpEntryRemoved (): Observable<number> {
        let obs: Observable<number> = new Observable<number>( ( observer: Observer<number> ) => {
            this._dkpRemovedObservers.push( observer );
        } );

        return obs;
    }

    public getAppVersion (): Observable<string> {
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

    public consoleLogRequested (): Observable<any> {
        let obs: Observable<any> = new Observable<any>( ( observer: Observer<any> ) => {
            this._consoleLogRequestObservers.push( observer );
        } );

        return obs;
    }

    public removeDkpAward ( entry: DkpEntryModel ): void {
        this.ipc.send( 'removeDkpAward', entry );
    }

    public quitApp (): void {
        this.ipc.send( 'quitApp' );
    }

    public updateLogFile ( logFile: string ): void {
        this.ipc.send( 'logSelected', logFile );
    }

    public updateVoiceIndex ( index: number ): void {
        this.ipc.send( 'selectVoice', index );
    }

    public sendTextToClipboard ( value: string ): void {
        this.ipc.send( 'clipboard:writeText', value );
    }

    public markDkpEntriesAsEntered ( entries: DkpEntryModel[] ): void {
        this.ipc.send( 'dkp:markAsEntered', entries );
    }

    public clearDkpLog (): void {
        this.ipc.send( 'dkp:reset' );
    }

    public showNewTriggerDialog (): void {
        this.ipc.send( 'trigger:dialog:new' );
    }

    public closeNewTriggerDialog (): void {
        this.ipc.send( 'trigger:dialog:close' );
    }

}
