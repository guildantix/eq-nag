import { AfterViewChecked, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { DialogService } from '../dialogs/dialog.service';
import { GoodbyePayloadModel, HandshakePayloadModel, IpcService } from '../ipc.service';
import { ServerConsoleMessage, SettingsKeys } from '../core.model';
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

    private _trustedPlayers: string = '';
    public get trustedPlayers(): string {
        return this._trustedPlayers;
    }
    public set trustedPlayers( value: string ) {
        this._trustedPlayers = value;

        this.serverTrustedPlayers[ this.serverTrustServer ] = value.split( /\r?\n/g );
        this.ipcService.updateSetting( SettingsKeys.serverTrustedPlayers, this.serverTrustedPlayers, 1500, () => this.snackBar.open( 'Trusted players updated', 'Dismiss', { duration: 3000 } ) );
    }

    private _blockedPlayers: string = '';
    public get blockedPlayers(): string {
        return this._blockedPlayers;
    }
    public set blockedPlayers( value: string ) {
        this._blockedPlayers = value;
        
        this.serverBlockedPlayers[ this.serverTrustServer ] = value.split( /\r?\n/g );
        this.ipcService.updateSetting( SettingsKeys.serverBlockedPlayers, this.serverBlockedPlayers, 1500, () => this.snackBar.open( 'Blocked players updated', 'Dismiss', { duration: 3000 } ) );
    }

    private _serverTrustServer: string | undefined = undefined;
    public get serverTrustServer(): string {
        return this._serverTrustServer || '';
    }
    public set serverTrustServer( value: string ) {
        this._serverTrustServer = value;

        this._trustedPlayers = ( this.serverTrustedPlayers[ value ] || [] ).join( '\r\n' ) + '\r\n';
        this._blockedPlayers = ( this.serverBlockedPlayers[ value ] || [] ).join( '\r\n' ) + '\r\n';

        localStorage.setItem( 'cachedServerTrustServer', value );
    }

    public serverTrustServerOptions: string[] = [];
    private serverTrustedPlayers: Record<string, string[]> = {};
    private serverBlockedPlayers: Record<string, string[]> = {};


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

        this.ipcService.watchSetting<Record<string, string[]>>( SettingsKeys.serverTrustedPlayers ).subscribe( data => {
            this.serverTrustedPlayers = data;
            if ( this.serverTrustServer ) {
                this._trustedPlayers = ( data[ this.serverTrustServer ] || [] ).join( '\r\n' ) + '\r\n';
            }
        } );
        this.ipcService.watchSetting<Record<string, string[]>>( SettingsKeys.serverBlockedPlayers ).subscribe( data => {
            this.serverBlockedPlayers = data;
            if ( this.serverTrustServer ) {
                this._blockedPlayers = ( data[ this.serverTrustServer ] || [] ).join( '\r\n' ) + '\r\n';
            }
        } );
        this.ipcService.getServerList().subscribe( data => {
            this.serverTrustServerOptions = data;
            this.serverTrustServer = localStorage.getItem( 'cachedServerTrustServer' ) ?? data[ 0 ];
        } );

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

    public openCombatStatsSettings(): void {
        this.ipcService.showSettingsWindow( 'combatStatistics' );
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
                'When someone links a server, you will get a popup asking if you want to join the server.',
                'If the player is in the trusted list, you will automatically join the server.',
                'Any player from the blocked list will be ignored.',
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
