import { AfterViewChecked, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { DialogService } from '../dialogs/dialog.service';
import { GoodbyePayloadModel, HandshakePayloadModel, IpcService } from '../ipc.service';
import { ServerConsoleMessage } from '../core.model';
import { MatSnackBar } from '@angular/material/snack-bar';

export interface IConnectedPeer {
    
    version: string;
    peerId: string;
    characterName: string;
    serverName: string;

}

@Component( {
    selector: 'app-combat-statistics',
    templateUrl: './combat-statistics.component.html',
    styleUrls: [ './combat-statistics.component.scss', '../core.scss' ]
} )
export class CombatStatisticsComponent implements OnInit, AfterViewChecked {

    @ViewChild( 'consoleElement', { static: true } ) private consoleElement: ElementRef<HTMLElement>;
    public lines: ServerConsoleMessage[] = [];
    public connected: boolean = false;
    public chatRoomId: string | undefined = undefined;
    public get serverLink(): string | undefined {
        return this.chatRoomId ? `{NAG:p2p/${this.chatRoomId}}` : undefined;
    }

    public connectedPeers: IConnectedPeer[] = [];

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
        private readonly snackBar: MatSnackBar,
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

        this.ipcService.getChatRoomServerLogData().subscribe( data => data.forEach( x => this.appendLind( x ) ) );
        this.ipcService.onChatRoomServerLog().subscribe( data => this.appendLind( data ) );
        this.ipcService.onChatRoomConnected().subscribe( chatRoomId => {
            this.connected = true;
            this.chatRoomId = chatRoomId;
        } );
        this.ipcService.onChatRoomDisconnected().subscribe( () => {
            this.connected = false;
            this.chatRoomId = undefined;
        } );
        this.ipcService.onServerEvent().subscribe( data => {

            if ( data.type === 'handshake' && this.connectedPeers.find( x => x.peerId === data.payload.peerId ) === undefined ) {
                let payload = data.payload as HandshakePayloadModel;
                this.connectedPeers.push( {
                    version: payload.version,
                    peerId: payload.peerId,
                    characterName: payload.characterName,
                    serverName: payload.serverName,
                } );
                
            } else if ( data.type === 'disconnect' ) {
                this.connectedPeers = this.connectedPeers.filter( x => x.peerId !== data.payload.peerId );

            } else if ( data.type === 'character' ) {
                let payload = data.payload as HandshakePayloadModel;
                let peer = this.connectedPeers.find( x => x.peerId === payload.peerId );
                if ( peer ) {
                    peer.characterName = payload.characterName;
                }

            }

        } );

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

    public appendLind( line: ServerConsoleMessage ): void {
        this.lines.push( line );
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

    public copyServerLink() {
        if ( this.chatRoomId ) {
            this.ipcService.sendTextToClipboard( this.serverLink );
            this.snackBar.open( 'Server link copied to clipboard', 'Dismiss', { duration: 3000 } );
        }
    }

    public disconnect() {
        this.ipcService.disconnectChatRoom();
    }

}
