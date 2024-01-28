import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, HostListener, Input, OnInit, Output } from '@angular/core';
import { ConsoleMessageModel, LogTypes, TriggerParseHistoryModel } from '../core.model';
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
    private consoleMessages: ConsoleMessageModel[] = [];

    public logTypes: typeof LogTypes = LogTypes;
    public triggerId: string | null = null;
    public triggerName: string | null = null;

    public history: ( ConsoleMessageModel | TriggerParseHistoryModel )[] = [];

    constructor(
        private readonly ipcService: IpcService,
        private readonly sanitizer: DomSanitizer,
        private readonly changeDetector: ChangeDetectorRef,
    ) { }

    ngOnInit() {

        // This is called because the console list is destroyed when hidden.
        this.ipcService.getConsoleData().subscribe( history => {
            this.setHistories( history.successful, history.failed, history.consoleMessages );
        } );
        
        this.ipcService.onBatchParseHistory().subscribe( history => {
            this.appendHistories( history.successful, history.exceptions );
        } );

        this.ipcService.onConsoleSuccess().subscribe( log => {
            this.consoleMessages.push( log );
            this.renderHistory();
        } );

        this.ipcService.onConsoleError().subscribe( log => {
            this.consoleMessages.push( log );
            this.renderHistory();
        } );

    }










    /**
     * Returns the given console message as a trigger parse history model.
     * 
     * @param log The log entry item.
     */
    public asTriggerParseHistoryModel( log: ConsoleMessageModel ): TriggerParseHistoryModel {
        return log as TriggerParseHistoryModel;
    }









    
    /**
     * Returns true if the given log is a trigger event.
     * 
     * @param log The log to evaluate.
     */
    public isTriggerEvent( log: ConsoleMessageModel | TriggerParseHistoryModel ): boolean {
        return log instanceof TriggerParseHistoryModel;
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
    public setHistories( successful: TriggerParseHistoryModel[], exceptions: TriggerParseHistoryModel[], consoleMessages: ConsoleMessageModel[] ) {
        this.histories.successful = successful;
        this.histories.exceptions = exceptions;
        this.consoleMessages = consoleMessages;
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

            this.history = Array.prototype.concat( this.histories.successful, this.histories.exceptions, this.consoleMessages );
            this.history = _.orderBy( this.history, [ 'timestamp' ], [ 'asc' ] );

        }
    
        let search = this.searchText?.toLowerCase();
        this.history = this.history.filter( x => {
            if ( x instanceof TriggerParseHistoryModel ) {
                return ( !search || x.rawLogEntry.toLowerCase().indexOf( search.toLowerCase() ) > -1 ) &&
                    ( !this.characterId || x.characterId === this.characterId );
            } else {
                return ( !search || x.message.toLowerCase().indexOf( search.toLowerCase() ) > -1 );
            }
        } );
        
        if ( !this.triggerId ) {
            for ( let i = 0; i < this.history.length; i++ ) {
                const item = this.history[ i ];
                if ( item instanceof TriggerParseHistoryModel ) {
                    item.duplicateCount = 0;
                }
            }

            for ( let i = this.history.length - 1; i >= 0; i-- ) {
                if ( i !== 0 ) {
                    const prev = this.history[ i - 1 ];
                    const curr = this.history[ i ];
                    if ( prev instanceof TriggerParseHistoryModel && curr instanceof TriggerParseHistoryModel && TriggerParseHistoryModel.sameError( prev, curr ) ) {
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
    public trackByFn( index: number, item: ConsoleMessageModel ) {
        return item.logId;
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
     * Shows the edit trigger dialog for the specified trigger.
     * 
     * @param triggerId The id of the desired trigger.
     */
    public showEditTriggerDialog( triggerId: string | null = null ): void {
        if ( triggerId || this.triggerId ) {
            this.ipcService.showEditTriggerDialog( triggerId ?? this.triggerId );
        }
    }

}
