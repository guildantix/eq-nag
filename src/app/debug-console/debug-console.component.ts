import { Component, DoCheck, ElementRef, HostListener, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { IpcService } from '../ipc.service';
import * as _ from 'lodash-es';
import { ConsoleListComponent } from './console-list.component';

@Component( {
    selector: 'app-debug-console',
    templateUrl: 'debug-console.component.html',
    styleUrls: [ 'debug-console.component.scss' ],
} )
export class DebugConsoleComponent implements OnInit, OnDestroy, DoCheck {

    public show: boolean = false;
    public showInput: boolean = true;
    public consoleCommand: string | undefined = undefined;
    public showTriggerHistory: boolean = false;
    public characterId: string = null;
    // public parseType: 'successful' | 'failed' = 'successful';
    public searchText: string = null;
    /** The search text applied to the filter after the typing delay. */
    public appliedSearchText: string = null;
    /** The timeout id of the pending search text update. */
    private _searchTimeoutId: any = null;
    public characterOptions: { id: string, name: string, server: string }[] = [];
    private _atBottom: boolean = true;
    public get atBottom(): boolean {
        return this._atBottom;
    }
    public get showBottomTools(): boolean {
        return !this.atBottom;
    }

    @ViewChild( 'consoleList', { static: false } ) consoleList: ConsoleListComponent;
    @ViewChild( 'container', { static: false } ) container: ElementRef<HTMLDivElement>;
    
    @HostListener( 'document:keyup', [ '$event' ] ) onKeydownHandler( event: KeyboardEvent ) {
        if ( event.key === 'F12' ) {
            this.show = !this.show;
        }
    }

    public scrolling: boolean = false;

    @HostListener( 'wheel', [ '$event' ] ) onScroll( event: Event ) {
        
        if ( this.container.nativeElement.scrollTop >= this.container.nativeElement.scrollHeight - this.container.nativeElement.offsetHeight ) {
            this.scrolling = false;
        } else {
            this.scrolling = true;
        }
        
    }

    constructor(
        private readonly ipcService: IpcService,
    ) { }

    ngOnInit() {
        
        this.ipcService.getCharacters().subscribe( options => {
            this.characterOptions = _.orderBy( options.map( x => ( { id: x.characterId, name: x.name, server: x.server } ) ), [ 'server', 'name' ] );
        } );

    }

    ngOnDestroy(): void {
        clearTimeout( this._searchTimeoutId );
    }










    ngDoCheck(): void {
        if ( this.container?.nativeElement ) {
            this._atBottom = this.container.nativeElement.scrollTop >= this.container.nativeElement.scrollHeight - this.container.nativeElement.offsetHeight;
        }
    }










    /**
     * Applies the search text to the list after the user stops typing.
     *
     * @param value The current search text.
     */
    public onSearchTextChanged( value: string ): void {
        this.searchText = value;
        clearTimeout( this._searchTimeoutId );
        this._searchTimeoutId = setTimeout( () => this.appliedSearchText = this.searchText, 150 );
    }










    /**
     * Sends the entered console command to the server.
     */
    sendConsoleCommand(): void {
        if ( this.consoleCommand ) {
            this.ipcService.sendConsoleCommand( this.consoleCommand );
            this.consoleCommand = undefined;
        }
    }









    
    /**
     * Clears all trigger history.
     */
    public clear() {
        this.ipcService.clearTriggerHistory();
        this.consoleList.clear();
    }









    
    /**
     * Changes the view back to the full history.
     */
    public hideTriggerHistory() {
        this.consoleList.hideTriggerHistory();
    }









    
    /**
     * Opens the trigger editor dialog.
     */
    public showEditTriggerDialog() {
        this.consoleList.showEditTriggerDialog();
    }









    
    /**
     * Filters the console list by the given parse type.
     * 
     * @param parseType The type of parse to show.
     */
    public setParseType( parseType: 'successful' | 'failed' ) {
        this.consoleList.setParseType( parseType );
    }









    
    /**
     * Scrolls to the bottom of the console when the list is updated.
     */
    public onListUpdated( scrollBottom: boolean ): void {
        if ( scrollBottom ) {
            if ( !this.scrolling && this.container?.nativeElement ) {
                this.container.nativeElement.scrollTop = this.container.nativeElement.scrollHeight;
            }
        }
    }










    /**
     * Scrolls to the bottom of the console and sets the scrolling flag to false.
     */
    public scrollToBottom(): void {
        this.scrolling = false;
        this.container.nativeElement.scrollTop = this.container.nativeElement.scrollHeight;
    }









    
}
