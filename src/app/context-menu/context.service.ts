import { Injectable, NgZone } from '@angular/core';
import { Observable, Observer } from 'rxjs';
import { TriggerAction } from '../core.model';
import { TriggerEndedProperties } from './context-menu.model';
import { IpcRenderer } from 'electron';

@Injectable()
export class ContextService {

    private ipc: IpcRenderer;
    private actionEndedProperties: TriggerEndedProperties = null;

    constructor( private ngZone: NgZone ) {
        this.ipc = ( <any>window ).require( 'electron' ).ipcRenderer;
        this.get<TriggerEndedProperties>( 'action-ended' ).subscribe( model => this.actionEndedProperties = model );
    }

    public copyActionEndedProperties( action: TriggerAction ): void {
        this.actionEndedProperties = new TriggerEndedProperties();

        this.copyProperties( action, this.actionEndedProperties, Object.keys( new TriggerEndedProperties() ) );
        this.store( 'action-ended', this.actionEndedProperties );

    }

    public get hasActionEnded(): boolean {
        return this.actionEndedProperties != null;
    }

    public pasteActionEndedProperties( action: TriggerAction ): void {

        this.copyProperties( this.actionEndedProperties, action, Object.keys( new TriggerEndedProperties() ) );
        
    }

    private copyProperties( source: any, target: any, keys: string[] ): void {

        for ( const key of keys ) {
            target[ key ] = source[ key ];
        }
        
    }

    private get<T>( key: string ): Observable<T> {
        let obs: Observable<T> = new Observable<T>( ( observer: Observer<T> ) => {
            
            this.ipc.once( 'context:get:pseudo-clipboard', ( e, model ) => {
                this.ngZone.run( () => {
                    observer.next( model );
                    observer.complete();
                } );
            } );
            this.ipc.send( 'context:get:pseudo-clipboard', key );

        } );

        return obs;
    }

    private store( key: string, value: any ): void {
        this.ipc.send( 'context:store:pseudo-clipboard', { key: key, value: value } );
    }
    
}
