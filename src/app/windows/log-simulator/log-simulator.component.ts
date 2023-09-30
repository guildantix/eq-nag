import { trigger, state, style, transition, animate } from '@angular/animations';
import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import * as _ from 'lodash-es';
import { CharacterModel } from 'src/app/core.model';
import { nagId } from 'src/app/core/nag-id.util';
import { DialogService } from 'src/app/dialogs/dialog.service';
import { IpcService } from 'src/app/ipc.service';
import { SettingsService } from 'src/app/settings/settings-http.service';
import { StringUtility } from 'src/app/utilities';

// TODO: Move away from highlighting the current line and instead highlight all lines at the current second.  And remove the intervals, scrolling the last element into view immediately.
// TODO: On close, stop the sim.

@Component( {
    selector: 'app-log-simulator',
    templateUrl: 'log-simulator.component.html',
    styleUrls: [ 'log-simulator.component.scss', '../../core.scss', '../../modal.scss' ],
    animations: [
        trigger( 'detailExpand', [
            state( 'collapsed', style( { height: '0px', minHeight: '0' } ) ),
            state( 'expanded', style( { height: '*' } ) ),
            transition( 'expanded <=> collapsed', animate( '225ms cubic-bezier(0.4, 0.0, 0.2, 1)' ) ),
        ] ),
    ],
} )
export class LogSimulatorComponent implements OnInit {

    public lines: string[] = [ 'Paste your log entries and select your character(s) to begin.' ];
    public nagId: ( size?: number ) => string = nagId;
    public rawData: string | null = null;
    public characters: CharacterModel[] = [];
    public characterId: string | null = null;
    public simulationStatus: 'idle' | 'paused' | 'running' | 'complete' = 'idle';
    public simulationTimerId: number | null = null;
    public simulationRuntime: number = 0;
    public simulationExpectedRuntime: number = 0;
    public simulationLineIndex: number = -1;
    public get simulationProgressPercent(): number {
        if ( this.simulationExpectedRuntime === 0 ) {
            return 0;
        }
        return this.simulationRuntime / this.simulationExpectedRuntime * 100;
    }
    public get simulationProgressTimeRemainingString(): string {
        if ( this.simulationExpectedRuntime === 0 ) {
            return 'Calculating...';
        }
        const remaining = this.simulationExpectedRuntime - this.simulationRuntime;
        if ( remaining < 0 ) {
            return 'Calculating...';
        }
        return window.api.utils.dates.getDurationLabel( remaining / 1000 );
    }
    public lastIndexScrolled: number = -1;

    constructor(
        private readonly ipcService: IpcService,
        private readonly dialogService: DialogService,
        private readonly snackBar: MatSnackBar,
        private readonly settingsService: SettingsService,
    ) { }

    ngOnInit() {
        this.ipcService.getCharacters().subscribe( characters => {
            this.characters = _.sortBy( characters, [ 'server', 'name' ] );
        } );
    }

    /**
     * Closes this modal.
     */
    public closeModal(): void {
        this.ipcService.closeThisChild();
    }

    public showPasteDialog(): void {
        this.dialogService.showInputDialog( 'Paste Log Entries', [ 'Enter the lines of the log file that you want to simulate.' ], 'Log lines', null, this.rawData, true ).subscribe( data => {
            if ( data === null || data === undefined ) {
                return;
            }
            this.rawData = data;
            let lines = data.split( /\r\n|\r|\n/gi );
            for ( let i = 0; i < lines.length; i++ ) {
                if ( StringUtility.isNullOrWhitespace( lines[ i ] ) ) {
                    lines.splice( i, 1 );
                    i--;
                    continue;
                }
                
                const lineDateMatch = /^\[(.*?)\]\s*/gi.exec( lines[ i ] );
                if ( !lineDateMatch ) {
                    let nearestDate: string = undefined;

                    if ( i === 0 ) {
                        let j = i;
                        while ( j < lines.length && nearestDate == undefined ) {
                            j++;
                            const nextLineDateMatch = /^\[(.*?)\]\s*/gi.exec( lines[ j ] );
                            if ( nextLineDateMatch ) {
                                nearestDate = nextLineDateMatch[ 0 ];
                            }
                        }
                    } else {
                        let j = i;
                        while ( j >= 0 && nearestDate == undefined ) {
                            j--;
                            const prevLineDateMatch = /^\[(.*?)\]\s*/gi.exec( lines[ j ] );
                            if ( prevLineDateMatch ) {
                                nearestDate = prevLineDateMatch[ 0 ];
                            }
                        }
                    }
                    
                    if ( nearestDate ) {
                        lines[ i ] = `${nearestDate}${lines[ i ]}`;
                    } else {
                        lines.splice( i, 1 );
                        i--;
                    }
                }
            }
            this.lines = lines;
        } );
    }

    public getSelectValue(): string {
        if ( this.characterId != null ) {
            let c = this.characters.find( c =>  c.characterId === this.characterId );
            return `${c.name} (${c.server})`;
        }

        return '';
    }

    public getTrClass( index: number, trRef: HTMLTableRowElement ): string {
        if ( index === this.simulationLineIndex ) {
            if ( this.lastIndexScrolled !== index ) {
                trRef.scrollIntoView( { block: "end" } );
                this.lastIndexScrolled = index;
            }
            return 'current';
        } else {
            return '';
        }
    }

    public simulationId: string | null = null;
    public beginSimulation(): void {
        this.ipcService.beginSimulation( this.lines, this.characterId ).subscribe( simulationId => {
            this.simulationId = simulationId;
            this.simulationRuntime = 0;
            this.snackBar.open( 'Simulation started.', 'OK', { duration: 3000 } );
            this.ipcService.getSimulationStatus( simulationId ).subscribe( status => {
                
                if ( status.simulationPaused ) {
                    this.simulationStatus = 'paused';
                } else {
                    this.simulationStatus = 'running';
                }
                let lineDistance = status.lineIndex - this.simulationLineIndex;
                if ( lineDistance > 1 ) {
                    let _ms = 500 / lineDistance;
                    let _fn = () => {
                        this.simulationLineIndex++;
                        if ( this.simulationLineIndex < status.lineIndex ) {
                            window.setTimeout( _fn, _ms );
                        }
                    }
                    window.setTimeout( _fn, _ms );
                } else {
                    this.simulationLineIndex = status.lineIndex;
                }

                if ( status.lineIndex === 0 ) {
                    this.simulationExpectedRuntime = status.msRemaining;
                } else if ( status.msRemaining !== ( this.simulationExpectedRuntime - status.msRemaining ) ) {
                    this.simulationRuntime = this.simulationExpectedRuntime - status.msRemaining;
                }

                if ( !status.simulationPaused && !this.simulationTimerId ) {
                    this.simulationTimerId = window.setInterval( () => {
                        this.simulationRuntime += 100;
                    }, 100 );
                } else if ( this.simulationTimerId && status.simulationPaused ) {
                    window.clearInterval( this.simulationTimerId );
                    this.simulationTimerId = null;
                }

                if ( status.isComplete ) {
                    this.simulationStatus = 'idle';
                    if ( this.simulationTimerId ) {
                        window.clearInterval( this.simulationTimerId );
                    }
                    this.simulationTimerId = null;
                    this.simulationRuntime = 0;
                    this.simulationExpectedRuntime = 0;
                    this.snackBar.open( 'Simulation complete.', 'OK', { duration: 3000 } );

                    this.simulationLineIndex = this.lines.length - 1;
                    window.setTimeout( () => this.simulationLineIndex = -1, 750 );
                }

            } );
        } );
    }

    public stopSimulation(): void {
        this.ipcService.stopSimulation( this.simulationId );
    }

    // TODO: Remove this commented code.
    // public onPaste( event: ClipboardEvent, lineIndex: number ): boolean {
    //     // console.log( 'onPaste', event.clipboardData.getData( 'text/plain' ) );
    //     let lines = event.clipboardData.getData( 'text/plain' ).split( /\r\n|\r|\n/gi );
    //     // console.log( 'lines', lines );
    //     // console.log( 'lineIndex', lineIndex );
    //     // window.setTimeout( () => {
    //     let del = this.lines[ lineIndex ].length > 0 ? 0 : 1;
    //     this.lines.splice( lineIndex + 1, del, ...lines );
    //     return false;
    // }

    // public onKeyDown( event: KeyboardEvent, lineIndex: number ): boolean {
    //     console.log( 'event, lineIndex', event, lineIndex );
    //     if ( event.key === 'Enter' ) {
    //         if ( lineIndex === this.lines.length - 1 )
    //             this.lines.push( '' );
    //         else
    //             this.lines.splice( lineIndex + 1, 0, '' );
    //         return false;
    //     } else if ( event.key === 'Backspace' ) {
    //         if ( lineIndex === 0 && this.lines[ lineIndex ] === '' ) {
    //             this.lines.splice( lineIndex, 1 );
    //             return false;
    //         } else if ( lineIndex > 0 && this.lines[ lineIndex ] === '' ) {
    //             this.lines.splice( lineIndex, 1 );
    //             return false;
    //         }
    //     } else if ( event.key === 'Delete' ) {
    //         if ( lineIndex === this.lines.length - 1 && this.lines[ lineIndex ] === '' ) {
    //             this.lines.splice( lineIndex, 1 );
    //             return false;
    //         } else if ( lineIndex < this.lines.length - 1 && this.lines[ lineIndex ] === '' ) {
    //             this.lines.splice( lineIndex, 1 );
    //             return false;
    //         }
    //     } else if ( event.key === 'ArrowUp' ) {
    //         if ( lineIndex === 0 ) {
    //             return false;
    //         }
    //     } else if ( event.key === 'ArrowDown' ) {
    //         if ( lineIndex === this.lines.length - 1 ) {
    //             return false;
    //         }
    //     }

    //     this.lines[ lineIndex ] = event.target[ 'innerText' ];
    //     // console.log( 'onKeyDown', event );
    //     // console.log('test data', window)
    //     return true;
    // }

    // public onContentChanged( event: InputEvent | any, lineIndex: number ): boolean {
    //     console.log( 'onContentChanged', event );
    //     const e = event as InputEvent;
    //     const target = e.target as HTMLDivElement;

    //     if ( e.inputType === 'insertText' ) {
    //     } else if ( e.inputType === 'insertParagraph' ) {
    //         if ( lineIndex === this.lines.length - 1 )
    //             this.lines.push( '' );
    //         else
    //             this.lines.splice( lineIndex + 1, 0, '' );
    //     } else if ( e.inputType === 'insertFromPaste' ) {
    //         let lines = target.innerText.split( /\r\n|\r|\n/gi );
    //         // console.log( 'lines', lines );
    //         console.log( 'lineIndex', lineIndex );
    //         // window.setTimeout( () => {
    //             this.lines.splice( lineIndex, 1, ...lines );
    //         // }, 500 );
    //         // this.lines = this.lines.concat( ...lines );
    //     } else if ( e.inputType === 'insertFromDrop' ) {
    //     } else if ( e.inputType === 'insertFromYank' ) {
    //     } else if ( e.inputType === 'deleteContentBackward' ) {
    //     } else if ( e.inputType === 'deleteContentForward' ) {
    //     } else if ( e.inputType === 'deleteContent' ) {
    //     } else if ( e.inputType === 'deleteByCut' ) {
    //     } else if ( e.inputType === 'deleteByDrag' ) {
    //     } else if ( e.inputType === 'deleteByKeyboard' ) {
    //     }

    //     e.preventDefault();
    //     e.stopPropagation();
    //     // console.log('this.lines', this.lines);
    //     // this.lines = this.lines.filter( line => line.length > 0 );
    //     // if ( event.target.innerText ) {
    //     //     this.content = event.target.innerText;
    //     //     this.content = this.content.replace( /\n\n$/gi, '\n' );
    //     //     let lines = this.content.split( /\r\n|\r|\n/gi );
    //     //     this.lineNumbers = new Array( lines.length ).fill( 0 ).map( ( x, i ) => i + 1 );
    //     //     // event.target.innerText = this.content;
    //     // }

    //     return false
    // }

    // public someFunction(): void {
    // }

}
