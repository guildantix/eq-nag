import { AfterViewChecked, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { DialogService } from '../dialogs/dialog.service';
import { IpcService } from '../ipc.service';

export class ServerConsoleMessage {
    
    public message: string;
    public cssClass?: string;
    public timestamp: Date;

}

// Create 72 test player names
const testPlayerNames: string[] = [
    'Ent',
    'Aaagent',
    'Aaagentding',
    'Aachent',
    'Aagent',
    'Aagent',
    'Aament',
    'Aarenthyl',
    'Aargent',
    'Abatement',
    'Abcent',
    'Abhorrentx',
    'Abisenthe',
    'Aborent',
    'Abrentos',
    'Absent',
    'Absente',
    'Absente',
    'Absenth',
    'Absenth',
    'Absenth',
    'Absenth',
    'Absorbent',
    'Abssent',
    'Accidental',
    'Accidents',
    'Acentia',
    'Achentrader',
    'Achievements',
    'Achievements',
    'Abscam',
    'Acam',
    'Aicamglorcam',
    'Amancamgurth',
    'Arcam',
    'Arcamedes',
    'Arcamedies',
    'Arcametese',
    'Arcamp',
    'Bandcamp',
    'Bandcampp',
    'Bocamdon',
    'Bowcam',
    'Brucambell',
    'Bucamore',
    'Cama',
    'Cama',
    'Cama1',
    'Camaan',
    'Camaboom',
    'Camac',
    'Camacho',
    'Camadarion',
    'Camadary',
    'Camaddar',
    'Camaddar',
    'Camaddor',
    'Camaden',
    'Aaashamanaaa',
    'Aaashammy',
    'Ablaham',
    'Abrham',
    'Abrham',
    'ABshaman',
    'Aceshammy',
    'Adhamh',
    'Adhamh',
    'Ahamanx',
    'Ahamay',
    'Ahamix',
    'Alashama',
    'Aldhamerst',
];

@Component( {
    selector: 'app-combat-statistics',
    templateUrl: './combat-statistics.component.html',
    styleUrls: [ './combat-statistics.component.scss', '../core.scss' ]
} )
export class CombatStatisticsComponent implements OnInit, AfterViewChecked {

    @ViewChild( 'consoleElement', { static: true } ) private consoleElement: ElementRef<HTMLElement>;
    public lines: ServerConsoleMessage[] = [];
    public connected: boolean = false;

    public connectedPeers: string[] = [].concat( ...testPlayerNames );

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

    private _whitelist: string[] = [];
    public get whitelist(): string {
        return this._whitelist.join( '\r\n' );
    }
    public set whitelist( value: string ) {
        this._whitelist = value.split( '\r\n' );
        // TODO: Save to settings
    }

    public get peerHeight(): number {
        return Math.ceil( this.connectedPeers.length / 9 ) * 36 + 36;
    }

    constructor(
        private readonly dialogService: DialogService,
        private readonly ipcService: IpcService,
    ) { }

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

        this.ipcService.getChatRoomServerLogData().subscribe( data => {
            data.forEach( x => this.addLine( x ) );
        } );
        
        this.ipcService.onChatRoomServerLog().subscribe( data => this.addLine( data ) );
        this.ipcService.onChatRoomConnected().subscribe( () => this.connected = true );
        this.ipcService.onChatRoomDisconnected().subscribe( () => this.connected = false );

    }

    public test() {
        this.addLine( `This is a test of the national broadcasting system.  This is only a test.` );
    }

    public clearConsole() {
        this.lines = [];
        this.ipcService.clearChatRoomServerLogData();
    }

    public scrollToBottom() {
        this.consoleElement.nativeElement.scrollTop = this.consoleElement.nativeElement.scrollHeight + 1000;
    }

    public addLine( message: string, cssClass?: string ) {
        this.lines.push( { message, cssClass, timestamp: new Date() } );
        
        // Because we can't scroll to the bottom until the view is updated, we need to schedule it.
        this.scheduleScroll = true;
    }

    public explainServerTrust() {
        this.dialogService.showInfoDialog(
            'Server Trust',
            [
                'Server trust will allow you add players to a trusted/blocked list.',
                'If you use a trusted player list, then only players in this list can trigger the join server dialog.',
                'Any player from the blocked list posting a server will be ignored.',
            ],
            'wide',
        );
    }

    public createChatRoom() {
        this.ipcService.createChatRoom();
    }

    public joinChatRoom() {
        this.dialogService.showInputDialog(
            'Join Log Sync Server',
            'Enter in the nag p2p link to join the server',
            undefined,
            'Server Link',
        ).subscribe( result => {
            if ( result ) {
                this.ipcService.joinChatRoom( result );
            }
        } );
    }

    public disconnect() {
        this.ipcService.disconnectChatRoom();
    }

}
