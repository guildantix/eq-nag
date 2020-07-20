import { Component, OnInit, ViewChild } from '@angular/core';
import { IpcService } from 'src/app/ipc.service';
import { OverlayWindowModel } from 'src/app/core.model';
import { ActivatedRoute } from '@angular/router';
// import { NgForm } from '@angular/forms';

const availableFonts = {
    'Roboto': [ 100, 300, 400, 500, 700, 900 ],
    'Red Rose': [ 300, 400, 700 ],
    'Oswald': [ 200, 300, 400, 500, 600, 700 ],
    'Roboto Mono': [ 100, 200, 300, 400, 500, 600, 700 ],
    'Open Sans Condensed': [ 300, 700 ],
    'Ranchers': [ 400 ],
    'Press Start 2P': [ 400 ],
};
// <!-- Roboto(i): 100, 300, 400, 500, 700, 900 -->
// <!-- Red Rose: 300, 400, 700 -->
// <!-- Oswald: 200, 300, 400, 500, 600, 700 -->
// <!-- Roboto Mono (i): 100, 200, 300, 400, 500, 600, 700 -->
// <!-- Open Sans Condensed: 300(i), 700 -->
// <!-- Ranchers: 400 -->
// <!-- Press Start 2P: 400 -->

@Component( {
    selector: 'app-overlay-editor-dialog',
    templateUrl: 'overlay-editor-dialog.component.html',
    styleUrls: [ 'overlay-editor-dialog.component.scss', '../../core.scss', '../../modal.scss' ],
} )
export class OverlayEditorDialogComponent implements OnInit {

    public model: OverlayWindowModel;
    public phraseTableColumns = [ 'number', 'phrase', 'regEx', 'delete' ];
    public overlayId: string = null;
    public fontWeightIndex: number = 0;

    public get maxFontWeightIndex (): number {
        if ( this.model?.fontFamily != null ) {
            return availableFonts[ this.model.fontFamily ].length - 1;
        } else {
            return 1;
        }
    }

    constructor( private ipcService: IpcService, private route: ActivatedRoute ) { }

    ngOnInit () {
        this.model = new OverlayWindowModel();

        this.route.params.subscribe( params => {
            
            this.overlayId = params[ 'id' ]; 

            if ( this.overlayId != null ) {
                this.ipcService.getOverlayWindow( this.overlayId ).subscribe( overlay => {
                    this.ipcService.enableOverlayEditMode( this.overlayId );
                    this.model = overlay;

                    this.model.fontFamily = this.model.fontFamily ? this.model.fontFamily : 'Roboto';
                    this.model.fontSize = this.model.fontSize > 0 ? this.model.fontSize : 14;
                    this.model.lineHeight = this.model.lineHeight > 0 ? this.model.lineHeight : 90;
                    this.model.fontWeight = this.model.fontWeight > 100 ? this.model.fontWeight : 400;
                    this.fontWeightIndex = availableFonts[ this.model.fontFamily ].indexOf( this.model.fontWeight );

                } );
            }
     
        } );
        
    }

    public onChangeFontFamily (): void {
        let fi: number = availableFonts[ this.model.fontFamily ].indexOf( this.model.fontWeight );
        this.fontWeightIndex = -1;

        if ( fi > -1 ) {
            this.fontWeightIndex = fi;
        } else {

            for ( let i = 100; i < 500; i += 100 ) {
                let lfi: number = availableFonts[ this.model.fontFamily ].indexOf( this.model.fontWeight - i );
                let ufi: number = availableFonts[ this.model.fontFamily ].indexOf( this.model.fontWeight + i );
                if ( lfi > -1 ) {
                    this.fontWeightIndex = lfi;
                    break;
                } else if ( ufi > -1 ) {
                    this.fontWeightIndex = ufi;
                    break;
                }
            }
            
        }

        this.fontWeightIndex = this.fontWeightIndex > -1 ? this.fontWeightIndex : 0;
        this.broadcastModel();
    }

    public broadcastModel (): void {
        this.model.fontWeight = availableFonts[ this.model.fontFamily ][ this.fontWeightIndex ];
        this.ipcService.broadcastOverlayModel( this.model );
    }

    public closeModal (): void {
        this.ipcService.closeThisChild();
    }

    public save (): void {
        if ( this.overlayId == null ) {
            this.closeModal();
        } else {
            this.ipcService.updateOverlayWindow( this.model ).subscribe( success => { } );
            this.closeModal();
        }
    }
}


// <!-- Roboto(i): 100, 300, 400, 500, 700, 900 -->
// <!-- Red Rose: 300, 400, 700 -->
// <!-- Oswald: 200, 300, 400, 500, 600, 700 -->
// <!-- Roboto Mono (i): 100, 200, 300, 400, 500, 600, 700 -->
// <!-- Open Sans Condensed: 300(i), 700 -->
// <!-- Ranchers: 400 -->
// <!-- Press Start 2P: 400 -->
