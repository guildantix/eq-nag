import { Component, Inject, OnInit } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialog } from '@angular/material/dialog';
import { IpcService } from 'src/app/ipc.service';

export enum JoinChatRoomDialogResult {
    None,
    Join,
    Block,
    Trust,
    Ignore,
}

export class JoinChatRoomDialogModel {
    public server: string;
    public player: string;
}

@Component( {
    selector: 'app-join-chat-room-dialog',
    templateUrl: './join-chat-room-dialog.component.html',
    styleUrls: [ './join-chat-room-dialog.component.scss' ]
} )
export class JoinChatRoomDialogComponent implements OnInit {

    constructor(
        public readonly dialogRef: MatDialogRef<JoinChatRoomDialogComponent>,
        @Inject( MAT_DIALOG_DATA ) public data: JoinChatRoomDialogModel,
        public readonly dialog: MatDialog,
    ) { }

    ngOnInit(): void {
    }

    public joinServer( trust: boolean ): void {
        this.dialogRef.close( trust ? JoinChatRoomDialogResult.Trust : JoinChatRoomDialogResult.Join );
    }

    public blockUser(): void {
        this.dialogRef.close( JoinChatRoomDialogResult.Block );
    }

    public cancel(): void {
        this.dialogRef.close( JoinChatRoomDialogResult.Ignore );
    }

}
