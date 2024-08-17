import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { TriggerHotkey } from 'src/app/core.model';
import { DialogService } from 'src/app/dialogs/dialog.service';

@Component( {
    selector: 'app-trigger-hotkeys',
    templateUrl: './trigger-hotkeys.component.html',
    styleUrls: [ './trigger-hotkeys.component.scss', '../../core.scss' ]
} )
export class TriggerHotkeysComponent implements OnInit {

    @Input() public hotkeys: TriggerHotkey[] = [];
    @Output() public hotkeysChange: EventEmitter<TriggerHotkey[]> = new EventEmitter<TriggerHotkey[]>();

    public hotkeyTableColumns = [ 'action', 'name', 'description', 'delete' ];

    constructor(
        private readonly dialogService: DialogService,
    ) { }

    ngOnInit(): void {
    }

    editHotkey( hotkey: TriggerHotkey ): void {
        this.dialogService.showTriggerHotkey( hotkey ).subscribe( hotkey => {
            if ( hotkey ) {
                this.hotkeys = [ ...this.hotkeys ];
                this.hotkeysChange.emit( this.hotkeys );
            }
        } );
    }

    generateEqHotkey( hotkey: TriggerHotkey ): void {
    }

    addNewHotkey(): void {
        this.dialogService.showTriggerHotkey( new TriggerHotkey() ).subscribe( hotkey => {
            if ( hotkey ) {
                
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

    }
}
