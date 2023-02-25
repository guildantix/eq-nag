import { Injectable, NgZone } from '@angular/core';
import { Observable, Observer } from 'rxjs';
import { Phrase, PhraseProperties, TriggerAction, TriggerActionProperties, TriggerCondition, TriggerConditionProperties } from '../core.model';
import { TriggerEndedProperties } from './context-menu.model';
import { IpcRenderer } from 'electron';
import { ContextMenuComponent } from './context-menu.component';
import * as _ from 'lodash-es';
import { nagId } from '../core/nag-id.util';

@Injectable()
export class ContextService {

    private actionEndedProperties: TriggerEndedProperties = null;
    private actionProperties: TriggerActionProperties = null;
    private openedMenu: ContextMenuComponent;

    constructor( private ngZone: NgZone ) {
        this.get<TriggerEndedProperties>( 'action-ended' ).subscribe( model => this.actionEndedProperties = model );
        this.get<TriggerActionProperties>( 'action-properties' ).subscribe( model => {
            this.actionProperties = model;
        } );
    }









    
    /**
     * Copies only the trigger action properties for a timer's action ended.
     * 
     * @param action The source trigger action.
     */
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

        this.actionProperties = new TriggerActionProperties();
        
        this.copyProperties( action, this.actionProperties, Object.keys( new TriggerActionProperties() ) );
        
        // TODO: Test the copied array of objects.
        this.actionProperties.hideConditions = this.copyArrayProperties( action.hideConditions ?? [], [], Object.keys( new TriggerConditionProperties() ), [ 'conditionId' ] );
        this.actionProperties.excludeTargets = this.copyArrayProperties( action.excludeTargets ?? [], [], Object.keys( new PhraseProperties() ), [ 'phraseId' ] );
        this.actionProperties.endEarlyPhrases = this.copyArrayProperties( action.endEarlyPhrases ?? [], [], Object.keys( new PhraseProperties() ), [ 'phraseId' ] );
        this.actionProperties.resetCounterPhrases = this.copyArrayProperties( action.resetCounterPhrases ?? [], [], Object.keys( new PhraseProperties() ), [ 'phraseId' ] );

        this.store( 'action-properties', this.actionProperties );

    }









    
    /**
     * Copies the properties from the trigger action in the virtual clipboard 
     * to the given action.
     * 
     * @param action The target action.
     */
    public pasteTriggerActionProperties( action: TriggerAction ): void {
        
        if ( this.actionProperties ) {
            
            this.copyProperties( this.actionProperties, action, Object.keys( new TriggerActionProperties() ) );
        
            action.hideConditions = this.copyArrayProperties( this.actionProperties.hideConditions, [], Object.keys( new TriggerConditionProperties() ), [ 'conditionId' ] );
            action.excludeTargets = this.copyArrayProperties( this.actionProperties.excludeTargets, [], Object.keys( new PhraseProperties() ), [ 'phraseId' ] );
            action.endEarlyPhrases = this.copyArrayProperties( this.actionProperties.endEarlyPhrases, [], Object.keys( new PhraseProperties() ), [ 'phraseId' ] );
            action.resetCounterPhrases = this.copyArrayProperties( this.actionProperties.resetCounterPhrases, [], Object.keys( new PhraseProperties() ), [ 'phraseId' ] );
        }

    }









    
    /** Returns true if there is an action ended in the clipboard. */
    public get hasActionEnded(): boolean {
        return this.actionEndedProperties != null;
    }









    
    /** Returns true if there is an action properties in the clipboard. */
    public get hasActionProperties(): boolean {
        return this.actionProperties != null;
    }









    
    /**
     * Pastes only the trigger action properties for a timer's action ended.
     * 
     * @param action The target trigger action.
     */
    public pasteActionEndedProperties( action: TriggerAction ): void {

        this.copyProperties( this.actionEndedProperties, action, Object.keys( new TriggerEndedProperties() ) );
        
    }









    
    /**
     * Copies the specified properties from each of the array in source to the target array.
     * 
     * @param source The source objects.
     * @param target The target objects.
     * @param keys The list of properties to copy.
     * @param newIdFields The list of id fields on the target object.  Each matching key will be instantiated with nagId() instead of copying the value from source.
     */
    private copyArrayProperties( source: any[], target: any[], keys: string[], newIdFields?: string[] ): any[] {
        target = [];

        source.forEach( s => {
            let t = new TriggerCondition();

            this.copyProperties( s, t, keys, newIdFields );

            target.push( t );
        } );

        return target;
    }









    
    /**
     * Copies the specified properties from source object to target.
     * 
     * @param source The source object.
     * @param target The target object.
     * @param keys The list of properties to copy.
     * @param newIdFields The list of id fields on the target object.  Each matching key will be instantiated with nagId() instead of copying the value from source.
     */
    private copyProperties( source: any, target: any, keys: string[], newIdFields?: string[] ): void {

        for ( const key of keys ) {
            if ( newIdFields?.indexOf( key ) > -1 ) {
                target[ key ] = nagId();
            } else {
                target[ key ] = source[ key ];
            }
        }
        
    }









    
    /**
     * Returns the stored value with the given key.
     * 
     * @param key The value identifier.
     */
    private get<T>( key: string ): Observable<T> {
        let obs: Observable<T> = new Observable<T>( ( observer: Observer<T> ) => {
            
            window.api.ipc.once( `context:get:pseudo-clipboard:${key}`, ( e, model ) => {
                this.ngZone.run( () => {
                    observer.next( model );
                    observer.complete();
                } );
            } );
            window.api.ipc.send( 'context:get:pseudo-clipboard', key );

        } );

        return obs;
    }









    
    /**
     * Stores the given value with the given key in the virtual clipboard.
     * 
     * @param key The value identifier.
     * @param value The value to keep.
     */
    private store( key: string, value: any ): void {
        window.api.ipc.send( 'context:store:pseudo-clipboard', { key: key, value: value } );
    }









    
    /**
     * Closes all context menus except the referenced menu.
     * 
     * @param menu The menu to remain open.
     */
    public closeAllButThis( menu: ContextMenuComponent ): void {
        if ( this.openedMenu != null && this.openedMenu.isOpen && menu != this.openedMenu ) {
            this.openedMenu.close();
        }
        this.openedMenu = menu;
    }









    
    /**
     * Clears the cached opened menu reference.
     */
    public clearOpenedMenu(): void {
        this.openedMenu = null;
    }
    









}
