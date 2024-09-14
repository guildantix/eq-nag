import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { concat, forkJoin, Observable, of } from 'rxjs';
import { concatAll, map } from 'rxjs/operators';
import { TriggerHotkey } from 'src/app/core.model';
import { nagId } from 'src/app/core/nag-id.util';
import { DialogService } from 'src/app/dialogs/dialog.service';
import { IpcService } from 'src/app/ipc.service';
import { QuickActionService } from 'src/app/services/quick-action.service';
import { StringUtility } from 'src/app/utilities';

@Component( {
    selector: 'app-trigger-hotkeys',
    templateUrl: './trigger-hotkeys.component.html',
    styleUrls: [ './trigger-hotkeys.component.scss', '../../core.scss' ]
} )
export class TriggerHotkeysComponent implements OnInit {

    @Input() public hotkeys: TriggerHotkey[] = [];
    @Output() public hotkeysChange: EventEmitter<TriggerHotkey[]> = new EventEmitter<TriggerHotkey[]>();

    public hotkeyTableColumns = [ 'action', 'quickAction', 'name', 'description', 'delete' ];

    constructor(
        private readonly dialogService: DialogService,
        private readonly quickActionService: QuickActionService,
    ) { }

    ngOnInit(): void {
    }

    editHotkey( hotkey: TriggerHotkey ): void {
        this.dialogService.showTriggerHotkey( hotkey ).subscribe( hotkey => {
            if ( hotkey ) {
                let index = this.hotkeys.findIndex( f => f.hotkeyId === hotkey.hotkeyId );
                this.hotkeys[ index ] = hotkey;
                this.hotkeys = [ ...this.hotkeys ];
                this.hotkeysChange.emit( this.hotkeys );
            }
        } );
    }

    generateEqHotkey( hotkey: TriggerHotkey ): void {
        this.quickActionService.generateEqHotkey( hotkey );
    }

    addNewHotkey(): void {
        this.dialogService.showTriggerHotkey( new TriggerHotkey() ).subscribe( hotkey => {
            if ( hotkey ) {

                hotkey.hotkeyId = nagId();
                
                if ( this.hotkeys?.length > 0 ) {
                    this.hotkeys = [ ...this.hotkeys, hotkey ];
                } else {
                    this.hotkeys = [ hotkey ];
                }
                
                this.hotkeysChange.emit( this.hotkeys );
            }
        } );
    }

    deleteHotkey( index: number ): void {
        this.dialogService.showConfirmationDialog( 'Are you sure you want to delete this hotkey?', 'Click "Yes" to delete this hotkey', 'Click "No" to close this dialog without deleting the hotkey.' ).subscribe( result => {
            if ( result ) {
                this.hotkeys.splice( index, 1 );
                this.hotkeys = [ ...this.hotkeys ];
                this.hotkeysChange.emit( this.hotkeys );
            }
        } );
    }
}
