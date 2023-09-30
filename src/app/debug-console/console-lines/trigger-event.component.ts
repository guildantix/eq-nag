import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { LogTypes, TriggerParseHistoryModel } from 'src/app/core.model';
import { IpcService } from 'src/app/ipc.service';

@Component( {
    selector: 'console-trigger-event',
    templateUrl: 'trigger-event.component.html',
    styleUrls: [ 'trigger-event.component.scss' ],
} )
export class ConsoleTriggerEventComponent implements OnInit {

    @Input( 'item' ) public item: TriggerParseHistoryModel;
    @Output( 'showTriggerHistory' ) public showTriggerHistory: EventEmitter<{ triggerId: string, triggerName: string }> = new EventEmitter<{ triggerId: string, triggerName: string }>();
    public logTypes: typeof LogTypes = LogTypes;
    public expanded: boolean = false;
    
    constructor(
        private readonly ipcService: IpcService,
        private readonly sanitizer: DomSanitizer,
    ) { }

    ngOnInit() { }









    
    /**
     * Renders the given object as an unordered list.
     * 
     * @returns The rendered html.
     * 
     * @param obj The object to render.
     */
    public renderParseToHtml( obj: TriggerParseHistoryModel ): SafeHtml {
        
        if ( !obj._modelHtml ) {
            obj._modelHtml = this.renderJsonHtml( obj );
        }

        return this.sanitizer.bypassSecurityTrustHtml( obj._modelHtml );
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










    /**
     * Returns the text for the given log.
     * 
     * @param log The log to get the text for.
     */
    public getLogText( log: TriggerParseHistoryModel ): string {
        if ( log.logType === LogTypes.error ) {
            return log.errorDescription;
        } else {
            return Array.isArray( log.rawLogEntry ) ? log.rawLogEntry[ 0 ] ?? '' : log.rawLogEntry;
        }
    }










    /**
     * Returns the title for the given log.
     * 
     * @param log The log to get the title for.
     */
    public getTitle( log: TriggerParseHistoryModel ): string {
        if ( log.actionTypeLabel ) {
            return `${log.triggerName}  ≡  ${log.actionTypeLabel}`;
        } else {
            return log.triggerName;
        }
    }









    
    /**
     * Show the trigger history for the given trigger.
     * 
     * @param triggerId The id of the trigger to show history for.
     * @param triggerName The name of the trigger to show history for.
     */
    public showTriggerParseHistory( triggerId: string, triggerName: string ) {
        this.showTriggerHistory.emit( { triggerId, triggerName } );
    }









    
    /**
     * Shows the edit trigger dialog for the specified trigger.
     * 
     * @param triggerId The id of the desired trigger.
     */
    public showEditTriggerDialog( triggerId: string ): void {
        if ( triggerId ) {
            this.ipcService.showEditTriggerDialog( triggerId );
        }
    }

}
