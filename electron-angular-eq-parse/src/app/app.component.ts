import { Component } from '@angular/core';
import { IpcRenderer } from 'electron';

@Component( {
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: [ './app.component.css' ],
} )
export class AppComponent {

    private ipc: IpcRenderer;
    public msg: string;

    constructor() {
        if ( ( <any>window ).require ) {
            try {
                this.ipc = ( <any>window ).require( 'electron' ).ipcRenderer;
                this.ipc.on( 'info', ( event, data ) => {
                    console.log( 'data', data, this );
                    // console.log( data.msg );
                    this.msg = data.msg;
                } );
            } catch ( e ) {
                throw e;
            }
        } else {
            console.warn( 'App not running inside Electron!' );
        }
    }

    openModal () {
        console.log( "Open a modal" );
        this.ipc.send( "openModal" );
    }

    title = 'electron-angular-eq-parse';
}
