import { AfterViewChecked, Component, ElementRef, OnInit, ViewChild } from '@angular/core';

export class ServerConsoleMessage {
    
    public message: string;
    public cssClass?: string;
    public timestamp: Date;

}

@Component( {
    selector: 'app-combat-statistics',
    templateUrl: './combat-statistics.component.html',
    styleUrls: [ './combat-statistics.component.scss', '../core.scss' ]
} )
export class CombatStatisticsComponent implements OnInit, AfterViewChecked {

    @ViewChild( 'consoleElement', { static: true } ) private consoleElement: ElementRef<HTMLElement>;
    public lines: ServerConsoleMessage[] = [];

    private visible: boolean = false;
    private scheduleScroll: boolean = false;

    public _enableCombatStatistics: boolean = true;
    public get enableCombatStatistics(): boolean {
        return this._enableCombatStatistics;
    }
    public set enableCombatStatistics( value: boolean ) {
        this._enableCombatStatistics = value;
        // TODO: Save to settings
    }

    constructor() { }

    ngAfterViewChecked(): void {
        
        // If previously not visible, and now visible, scroll to bottom.
        if ( this.visible === false && this.consoleElement.nativeElement.offsetHeight > 0 ) {
            this.scrollToBottom();
            this.visible = true;
        } else if ( this.visible === true && this.consoleElement.nativeElement.offsetHeight === 0 ) {
            this.visible = false;
        }

        // If we have a scroll scheduled, scroll to the bottom.
        if ( this.scheduleScroll === true ) {
            this.scrollToBottom();
            this.scheduleScroll = false;
        }
    }

    ngOnInit(): void {

        this.addLine( 'Server Connecting Server Connecting Server Connecting Server Connecting Server Connecting Server Connecting Server Connecting Server Connecting Server Connecting Server Connecting Server Connecting Server Connecting Server Connecting Server Connecting Server Connecting Server Connecting Server Connecting Server Connecting ...' );
        this.addLine( 'Server Connecting Error: This is a test, reattempting', 'color-red' );

    }

    public test() {
        this.addLine( `This is a test of the national broadcasting system.  This is only a test.` );
    }

    public clearConsole() {
        this.lines = [];
    }

    public scrollToBottom() {
        this.consoleElement.nativeElement.scrollTop = this.consoleElement.nativeElement.scrollHeight + 1000;
    }

    public addLine( message: string, cssClass?: string ) {
        this.lines.push( { message, cssClass, timestamp: new Date() } );
        
        // Because we can't scroll to the bottom until the view is updated, we need to schedule it.
        this.scheduleScroll = true;
    }

}
