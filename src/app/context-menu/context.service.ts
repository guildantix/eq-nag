import { Injectable, NgZone } from '@angular/core';
import { Observable, Observer } from 'rxjs';
import { Phrase, TriggerAction, TriggerCondition } from '../core.model';
import { TriggerEndedProperties } from './context-menu.model';
import { IpcRenderer } from 'electron';
import { ContextMenuComponent } from './context-menu.component';
import * as _ from 'lodash-es';

@Injectable()
export class ContextService {

    private ipc: IpcRenderer;
    private actionEndedProperties: TriggerEndedProperties = null;
    private actionProperties: TriggerAction = null;
    private openedMenu: ContextMenuComponent;

    constructor( private ngZone: NgZone ) {
        this.ipc = ( <any>window ).require( 'electron' ).ipcRenderer;
        this.get<TriggerEndedProperties>( 'action-ended' ).subscribe( model => this.actionEndedProperties = model );
        this.get<TriggerAction>( 'trigger-properties' ).subscribe( model => {
            console.log( 'retrieved', model );
            this.actionProperties = model;
        } );
    }

    public copyActionEndedProperties( action: TriggerAction ): void {
        this.actionEndedProperties = new TriggerEndedProperties();

        this.copyProperties( action, this.actionEndedProperties, Object.keys( new TriggerEndedProperties() ) );
        this.store( 'action-ended', this.actionEndedProperties );

    }

    /**
     * Copies the properties from the given trigger action into the virtual 
     * clipboard.
     * 
     * @param action The action to copy.
     */
    public copyTriggerActionProperties( action: TriggerAction ): void {

        this.actionProperties = new TriggerAction();
        
        Object.assign( this.actionProperties, action );
        
        this.actionProperties.hideConditions = _.map( action.hideConditions, cond => Object.assign( new TriggerCondition(), cond ) );
        this.actionProperties.excludeTargets = _.map( action.excludeTargets, phrase => Object.assign( new Phrase(), phrase ) );
        this.actionProperties.endEarlyPhrases = _.map( action.endEarlyPhrases, phrase => Object.assign( new Phrase(), phrase ) );
        this.actionProperties.resetCounterPhrases = _.map( action.resetCounterPhrases, phrase => Object.assign( new Phrase(), phrase ) );

        this.store( 'trigger-properties', this.actionProperties );

    }

    /**
     * Copies the properties from the trigger action in the virtual clipboard 
     * to the given action.
     * 
     * @param action The target action.
     */
    public pasteTriggerActionProperties( action: TriggerAction ): void {
        
        if ( this.actionProperties ) {
            Object.assign( action, this.actionProperties );

            action.hideConditions = _.map( this.actionProperties.hideConditions, cond => Object.assign( new TriggerCondition(), cond ) );
            action.excludeTargets = _.map( this.actionProperties.excludeTargets, phrase => Object.assign( new Phrase(), phrase ) );
            action.endEarlyPhrases = _.map( this.actionProperties.endEarlyPhrases, phrase => Object.assign( new Phrase(), phrase ) );
            action.resetCounterPhrases = _.map( this.actionProperties.resetCounterPhrases, phrase => Object.assign( new Phrase(), phrase ) );
        }

    }

    public get hasActionEnded(): boolean {
        return this.actionEndedProperties != null;
    }

    public get hasActionProperties(): boolean {
        return this.actionProperties != null;
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
            
            this.ipc.once( `context:get:pseudo-clipboard:${key}`, ( e, model ) => {
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

    public closeAllButThis( menu: ContextMenuComponent ): void {
        if ( this.openedMenu != null && this.openedMenu.isOpen && menu != this.openedMenu ) {
            this.openedMenu.close();
        }
        this.openedMenu = menu;
    }

    public clearOpenedMenu(): void {
        this.openedMenu = null;
    }
    
}
