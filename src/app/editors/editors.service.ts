import { Injectable, NgZone } from '@angular/core';
import { IpcRenderer } from 'electron';
import { Observable, Observer } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { DataTickModel, DkpEntryModel, TriggerModel, OverlayWindowModel, ActionTypes, FocusEffectSettings, CharacterModel, BasicError, TriggerFolder, FileModel } from '../core.model';
import { GinaConfiguration, GinaTriggerGroups } from '../gina.model';

@Injectable()
export class EditorsService {
    
    private ipc: IpcRenderer;

    constructor( private ngZone: NgZone ) {
        this.ipc = ( <any>window ).require( 'electron' ).ipcRenderer;
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
    
}
