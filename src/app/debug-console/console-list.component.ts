import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, HostListener, Input, OnInit, Output } from '@angular/core';
import { LogTypes, TriggerParseHistoryModel } from '../core.model';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import * as _ from 'lodash-es';
import { IpcService } from '../ipc.service';

@Component( {
    selector: 'console-list',
    templateUrl: 'console-list.component.html',
    styleUrls: [ 'console-list.component.scss' ],
    changeDetection: ChangeDetectionStrategy.OnPush,
} )
export class ConsoleListComponent implements OnInit {

    public showTriggerHistory: boolean = false;
    public parseType: 'successful' | 'failed' = 'successful';
    @Input() public searchText: string = null;
    @Input() public characterId: string = null;
    @Output() public onListUpdated: EventEmitter<void> = new EventEmitter<void>();

    private histories: { successful: TriggerParseHistoryModel[], exceptions: TriggerParseHistoryModel[] } = { successful: [], exceptions: [] };
    private triggerHistories: { successful: TriggerParseHistoryModel[], failed: TriggerParseHistoryModel[] } = { successful: [], failed: [] };

    public logTypes: typeof LogTypes = LogTypes;
    public expandedParses: string[] = [];
    public triggerId: string | null = null;
    public triggerName: string | null = null;

    public history: TriggerParseHistoryModel[] = [];

    constructor(
        private readonly ipcService: IpcService,
        private readonly sanitizer: DomSanitizer,
        private readonly changeDetector: ChangeDetectorRef,
    ) { }

    ngOnInit() {

        this.ipcService.getParseHistory().subscribe( history => {
            this.setHistories( history.successful, history.exceptions );
        } );
        
        this.ipcService.onBatchParseHistory().subscribe( history => {
            this.appendHistories( history.successful, history.exceptions );
        } );

    }










    /**
     * Sets the parse type filter.
     * 
     * @param type The type of parse to render.
     */
    public setParseType( type: 'successful' | 'failed' ) {
        this.parseType = type;
        this.renderHistory();
    }










    /**
     * Adds the given parses to the lists.
     * 
     * @param successful The list of successful parses to append.
     * @param exceptions The list of failed parses to append.
     */
    public appendHistories( successful: TriggerParseHistoryModel[], exceptions: TriggerParseHistoryModel[] ) {
        this.histories.successful = Array.prototype.concat( this.histories.successful, successful );
        this.histories.exceptions = Array.prototype.concat( this.histories.exceptions, exceptions );
        this.trimHistories();
        this.renderHistory();
    }










    /**
     * Sets the history lists.
     * 
     * @param successful The list of successful parses.
     * @param exceptions The list of failed parses.
     */
    public setHistories( successful: TriggerParseHistoryModel[], exceptions: TriggerParseHistoryModel[] ) {
        this.histories.successful = successful;
        this.histories.exceptions = exceptions;
        this.trimHistories();
        this.renderHistory();
    }










    /**
     * Limits the size of the history list to 500 items per list.
     */
    private trimHistories() {
        this.histories.successful = this.histories.successful.slice( -500 );
        this.histories.exceptions = this.histories.exceptions.slice( -500 );
    }










    /**
     * Updates and filters the history list.  Emits the onListUpdated event and 
     * calls for detectChanges.  This should be called whenever the history list 
     * is updated.
     */
    private renderHistory(): void {

        if ( this.triggerId ) {
    
            this.history = this.parseType === 'successful' ? Array.prototype.concat( this.triggerHistories.successful ) : Array.prototype.concat( this.triggerHistories.failed );
            
        } else {

            this.history = Array.prototype.concat( this.histories.successful, this.histories.exceptions );
            this.history = _.orderBy( this.history, [ 'timestamp' ], [ 'asc' ] );

        }
    
        let search = this.searchText?.toLowerCase();
        this.history = this.history.filter( x => {
            return ( !search || x.rawLogEntry.toLowerCase().indexOf( search.toLowerCase() ) > -1 ) &&
                ( !this.characterId || x.characterId === this.characterId );
        } );
        
        if ( !this.triggerId ) {
            for ( let i = 0; i < this.history.length; i++ ) {
                this.history[ i ].duplicateCount = 0;
            }

            for ( let i = this.history.length - 1; i >= 0; i-- ) {
                if ( i !== 0 ) {
                    const prev = this.history[ i - 1 ];
                    const curr = this.history[ i ];
                    if ( TriggerParseHistoryModel.sameError( prev, curr ) ) {
                        this.history.splice( i, 1 );
                        prev.duplicateCount += ( curr.duplicateCount ?? 0 ) + 1;
                    }
                }
            }
        }

        this.changeDetector.detectChanges();
        this.onListUpdated.emit();
    }










    /**
     * Returns the unique id for the given log.
     * 
     * @param index The index of the log in the list.
     * @param item The log item.
     */
    public trackByFn( index: number, item: TriggerParseHistoryModel ) {
        return item.parseId;
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
     * Clears all trigger history.
     */
    public clear() {
        this.histories = { successful: [], exceptions: [] };
        this.triggerHistories = { successful: [], failed: [] };
        this.triggerId = null;
        this.triggerName = null;
        this.hideTriggerHistory();
    }









    
    /**
     * Hide the specific trigger history.
     */
    public hideTriggerHistory() {
        this.showTriggerHistory = false;
        this.parseType = 'successful';
        this.triggerId = null;
        this.triggerName = null;
        this.triggerHistories = { successful: [], failed: [] };

        this.renderHistory();
        
    }









    
    /**
     * Show the trigger history for the given trigger.
     * 
     * @param triggerId The id of the trigger to show history for.
     * @param triggerName The name of the trigger to show history for.
     */
    public showTriggerParseHistory( triggerId: string, triggerName: string ) {
        this.ipcService.getTriggerParseHistory( triggerId ).subscribe( history => {
            this.showTriggerHistory = true;
            this.triggerName = triggerName;
            this.triggerId = triggerId;
            this.triggerHistories = history;
            this.renderHistory();
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
        
        this.changeDetector.detectChanges();
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
    public showEditTriggerDialog( triggerId: string | null = null ): void {
        if ( triggerId || this.triggerId ) {
            this.ipcService.showEditTriggerDialog( triggerId ?? this.triggerId );
        }
    }









    
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

}
