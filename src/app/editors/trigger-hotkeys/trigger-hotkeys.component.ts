import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
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

                            console.log( 'hotkey lines', lines );
                        }
                    } );
                }

                ask( variables[ i ] );
            }

            // let variableMap = new Map<string, string>();
            // let observables: Observable<boolean>[] = [];
            // for ( let i = 0; i < variables.length; i++ ) {
            //     const variable = variables[ i ];
            //     observables.push( this.dialogService
            //         .showInputDialog( `${variable}`, `Enter a value for ${variable}`, null, 'Enter a value to be inserted into the macro.' )
            //         .pipe( map<string, boolean>( value => {
            //             if ( value ) {
            //                 variableMap.set( variable, value );
            //             } else {
            //                 variableMap.set( variable, 'n/a' );
            //             }
            //             return true;
            //         } ) )
            //     );
            //     // this.dialogService.showInputDialog( `${variable}`, `Enter a value for ${variable}`, null, 'Enter a value to be inserted into the macro.' ).subscribe( value => {
            //     //     if ( value ) {
            //     //         variableMap.set( variable, value );
            //     //         // hotkey.lines = hotkey.lines.map( line => line.replace( `{{${variable}}}`, value ) );
            //     //     } else {
            //     //         variableMap.set( variable, 'n/a' );
            //     //     }
            //     // } );
            // }

            // let source = of( ...observables ).pipe( concatAll() );

            // source.subscribe( () => {
            //     let lines = hotkey.lines.map( line => {
            //         for ( let [ key, value ] of variableMap ) {
            //             line = line.replace( `{{${key}}}`, value );
            //         }
            //         return line;
            //     } );

            //     console.log( 'hotkey lines', lines );
            // } );

            // // Wait for all observables to complete.
            // concat( observables ).subscribe( () => {
            //     let lines = hotkey.lines.map( line => {
            //         for ( let [ key, value ] of variableMap ) {
            //             line = line.replace( `{{${key}}}`, value );
            //         }
            //         return line;
            //     } );

            //     console.log( 'hotkey lines', lines );
            // } );

            // let lines = hotkey.lines.map( line => {
            //     for ( let [ key, value ] of variableMap ) {
            //         line = line.replace( `{{${key}}}`, value );
            //     }
            //     return line;
            // } );

            // console.log( 'hotkey lines', lines );
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

    }
}
