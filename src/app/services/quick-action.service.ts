import { Injectable } from '@angular/core';
import { TriggerHotkey } from '../core.model';
import { StringUtility } from '../utilities';
import { DialogService } from '../dialogs/dialog.service';
import { IpcService } from '../ipc.service';
import { MatSnackBar } from '@angular/material/snack-bar';

@Injectable( { providedIn: 'root' } )
export class QuickActionService {

    constructor(
        private readonly dialogService: DialogService,
        private readonly ipcService: IpcService,
        private readonly snackBar: MatSnackBar,
    ) { }

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

                            if ( hotkey.simpleCommand ) {
                                // If this is a command, we immediately send the first line to the clipboard.
                                this.ipcService.sendTextToClipboard( lines[ 0 ] );
                                this.snackBar.open( 'Line copied to clipboard.', 'Dismiss', {
                                    duration: 3000,
                                } );

                            } else {
                                // Show the hotkey with the variables replaced.
                                this.dialogService.showRenderedTriggerHotkey( hotkey, lines ).subscribe();

                            }
                        }
                    } );
                }

                ask( variables[ i ] );
            } else {
                // If there are no variables, just show the hotkey.
                this.dialogService.showRenderedTriggerHotkey( hotkey, hotkey.lines ).subscribe();
            }
        }
    }
    
}