import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { concat, forkJoin, Observable, of } from 'rxjs';
import { concatAll, map } from 'rxjs/operators';
import { TriggerHotkey } from 'src/app/core.model';
import { DialogService } from 'src/app/dialogs/dialog.service';
import { StringUtility } from 'src/app/utilities';

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
                let index = this.hotkeys.findIndex( f => f.hotkeyId === hotkey.hotkeyId );
                this.hotkeys[ index ] = hotkey;
                this.hotkeys = [ ...this.hotkeys ];
                this.hotkeysChange.emit( this.hotkeys );
            }
        } );
    }

    generateEqHotkey( hotkey: TriggerHotkey ): void {
        if ( hotkey ) {
            let variables: string[] = [];

            for ( let i = 0; i < hotkey.lines.length; i++ ) {
                const line = hotkey.lines[ i ];
                let matches = StringUtility.MatchAll( line, /{{(?<variable>.*?)}}/gi, 'variable' );
                if ( matches.length > 0 ) {
                    variables = [ ...variables, ...matches ];
                }
            }

            if ( variables.length > 0 ) {
                let variableMap = new Map<string, string>();
                let i = 0;

                const complete = ( lines: string[] ) => {
                    this.dialogService.showRenderedTriggerHotkey( hotkey, lines ).subscribe();
                };

                const ask = ( variable: string ) => {
                    this.dialogService.showInputDialog( `${variable}`, `Enter a value for ${variable}`, null, 'Enter a value to be inserted into the macro.' ).subscribe( value => {
                        if ( value ) {
                            variableMap.set( variable, value );
                        } else {
                            variableMap.set( variable, 'n/a' );
                            return;
                        }

                        i++;
                        if ( i < variables.length ) {
                            ask( variables[ i ] );
                        } else {
                            let lines = hotkey.lines.map( line => {
                                for ( let [ key, value ] of variableMap ) {
                                    line = line.replace( `{{${key}}}`, value );
                                }
                                return line;
                            } );

                            complete( lines );
                        }
                    } );
                }

                ask( variables[ i ] );
            }
        }
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
        this.dialogService.showConfirmationDialog( 'Are you sure you want to delete this hotkey?', 'Click "Yes" to delete this hotkey', 'Click "No" to close this dialog without deleting the hotkey.' ).subscribe( result => {
            if ( result ) {
                this.hotkeys.splice( index, 1 );
                this.hotkeys = [ ...this.hotkeys ];
                this.hotkeysChange.emit( this.hotkeys );
            }
        } );
    }
}
