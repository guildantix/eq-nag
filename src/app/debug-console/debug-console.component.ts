import { Component, HostListener, OnInit } from '@angular/core';
import { IpcService } from '../ipc.service';
import { LogTypes, TriggerParseHistoryModel } from '../core.model';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import * as _ from 'lodash-es';

@Component( {
    selector: 'app-debug-console',
    templateUrl: 'debug-console.component.html',
    styleUrls: [ 'debug-console.component.scss' ],
} )
export class DebugConsoleComponent implements OnInit {

    public show: boolean = false;
    public showInput: boolean = false;
    public allSuccessesParseHistory: TriggerParseHistoryModel[] = [];
    public allExceptionsParseHistory: TriggerParseHistoryModel[] = [];
    public triggerHistory: { successful: TriggerParseHistoryModel[], failed: TriggerParseHistoryModel[] } | undefined;
    public showTriggerHistory: boolean = false;
    public triggerId: string | null = null;
    public triggerName: string | null = null;
    public characterId: string = null;
    public parseType: 'successful' | 'failed' = 'successful';
    public expandedParses: string[] = [];
    public searchText: string = null;
    public characterOptions: { id: string, name: string, server: string }[] = [];
    public logTypes: typeof LogTypes = LogTypes;

    public get history(): TriggerParseHistoryModel[] {
        let output: TriggerParseHistoryModel[] = [];

        if ( this.showTriggerHistory ) {
            output = this.parseType === 'successful' ? this.triggerHistory.successful : this.triggerHistory.failed;
        } else {
            output = Array.prototype.concat( this.allSuccessesParseHistory, this.allExceptionsParseHistory );
        }

        output = output.filter( x => {
            return ( !this.searchText || x.rawLogEntry?.toLowerCase().indexOf( this.searchText.toLowerCase() ) > -1 ) &&
                ( !this.characterId || x.characterId === this.characterId );
        } );

        return _.orderBy( output, [ 'timestamp' ], [ 'asc' ] );
    }
    
    @HostListener( 'document:keyup', [ '$event' ] ) onKeydownHandler( event: KeyboardEvent ) {
        if ( event.key === 'F12' ) {
            this.show = !this.show;
        }
    }

    constructor(
        private readonly ipcService: IpcService,
        private readonly sanitizer: DomSanitizer,
    ) { }

    ngOnInit() {

        this.ipcService.getParseHistory().subscribe( history => {
            this.allSuccessesParseHistory = history.successful;
            this.allExceptionsParseHistory = history.exceptions;
        } );
        
        this.ipcService.onSuccessfulParseHistory().subscribe( history => {
            this.allSuccessesParseHistory = history;
        } );

        this.ipcService.onExceptionParseHistory().subscribe( history => {
            this.allExceptionsParseHistory = history;
        } );
        
        this.ipcService.getCharacters().subscribe( options => {
            this.characterOptions = _.orderBy( options.map( x => ( { id: x.characterId, name: x.name, server: x.server } ) ), [ 'server', 'name' ] );
        } );

    }









    
    /**
     * Clears all trigger history.
     */
    public clear() {
        this.ipcService.clearTriggerHistory();
        this.allSuccessesParseHistory = [];
        this.allExceptionsParseHistory = [];
        this.hideTriggerHistory();
        this.triggerHistory = undefined;
    }

    public getLogText( log: TriggerParseHistoryModel ): string {
        if ( log.logType === LogTypes.error ) {
            return log.errorDescription;
        } else {
            return log.rawLogEntry;
        }
    }









    
    /**
     * Hide the specific trigger history.
     */
    public hideTriggerHistory() {
        this.showTriggerHistory = false;
        this.parseType = 'successful';
        this.triggerId = null;
        this.triggerName = null;
    }









    
    /**
     * Show the trigger history for the given trigger.
     * 
     * @param triggerId The id of the trigger to show history for.
     * @param triggerName The name of the trigger to show history for.
     */
    public showTriggerParseHistory( triggerId: string, triggerName: string ) {
        this.ipcService.getTriggerParseHistory( triggerId ).subscribe( history => {
            this.triggerHistory = history;
            this.showTriggerHistory = true;
            this.triggerName = triggerName;
            this.triggerId = triggerId;
        } );
    }









    
    /**
     * Toggle the expanded state of the given parse.
     * 
     * @param parse The parse to toggle.
     */
    public toggleExpandedParse( parse: TriggerParseHistoryModel ) {
        if ( this.expandedParses.includes( parse.parseId ) )
            this.expandedParses = this.expandedParses.filter( x => x !== parse.parseId );
        else
            this.expandedParses.push( parse.parseId );
    }









    
    /**
     * Returns true if the given parse is expanded.
     * 
     * @param parseId The id  of the parse to check.
     */
    public getExpandedParse( parseId: string ): boolean {
        return this.expandedParses.includes( parseId );
    }









    
    /**
     * Shows the edit trigger dialog for the specified trigger.
     * 
     * @param triggerId The id of the desired trigger.
     */
    public showEditTriggerDialog( triggerId: string ): void {
        this.ipcService.showEditTriggerDialog( triggerId );
    }









    
    /**
     * Renders the given object as an unordered list.
     * 
     * @returns The rendered html.
     * 
     * @param obj The object to render.
     */
    public renderParseToHtml( obj: TriggerParseHistoryModel ): SafeHtml {
        return this.sanitizer.bypassSecurityTrustHtml( this.renderJsonHtml( obj ) );
    }









    
    /**
     * Renders the given json object as an unordered list.
     */
    public renderJsonHtml( json: any ): string {
        if ( json === null ) {
            return '<span class="color-purple"><i>null</i></span>';
        }

        let keys = Object.keys( json );

        if ( keys.length === 0 ) {
            return '<span>{}</span>';
        }

        let html = '<ul>';
        for ( let key of keys ) {
            let obj = false;
            let emptyArray = false;

            let value = json[ key ];
            if ( value !== null && value !== undefined && Array.isArray( value ) && value.length === 0 ) {
                emptyArray = true;
                value = '[]';
            } else if ( value !== null && value !== undefined && typeof value === 'object' ) {
                obj = true;
                value = this.renderJsonHtml( value );
            }

            if ( obj ) {
                html += `<li><b class="color-blue">${key}</b>: ${value}</li>`;
            } else if ( typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint' ) {
                html += `<li><b class="color-blue">${key}</b>: <span class="color-purple">${value}</span></li>`;
            } else if ( value === null ) {
                html += `<li><b class="color-blue">${key}</b>: <span style="color: #808080;"><i>null</i></span></li>`;
            } else if ( value === undefined ) {
                html += `<li><b class="color-blue">${key}</b>: <span style="color: #808080;"><i>undefined</i></span></li>`;
            } else if ( emptyArray ) {
                html += `<li><b class="color-blue">${key}</b>: ${value}</li>`;
            } else if ( typeof value === 'string' && value.match( /\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+([+-][0-2]\d:[0-5]\d|Z)/gi ) ) {
                html += `<li><b class="color-blue">${key}</b>: <span>${new Date(value)}</span></li>`;
            } else {
                html += `<li><b class="color-blue">${key}</b>: <span class="color-brown">"${value?.replace(/</gmi, '&lt;').replace(/>/gmi, '&gt;')}"</span></li>`;
            }
            
        }
        html += '</ul>';

        return html;
    }










}
