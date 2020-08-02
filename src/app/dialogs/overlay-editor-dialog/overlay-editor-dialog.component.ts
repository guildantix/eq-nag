import { Component, OnInit, HostListener } from '@angular/core';
import { IpcService } from 'src/app/ipc.service';
import { OverlayWindowModel, ActionTypes } from 'src/app/core.model';
import { ActivatedRoute } from '@angular/router';
import { ThemePalette } from '@angular/material/core';
import { AbstractControl, FormControl } from '@angular/forms';
import { ColorUtility, Color } from '../../utilities';
// import { Color } from '@angular-material-components/color-picker';
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
    public color: ThemePalette = 'primary';
    public fontColor: Color = new Color( 255, 255, 255, 1 );
    public fontTransparency: number = 100;
    public backgroundTransparency: number = 0;
    public borderTransparency: number = 0;
    public _noChangesModel: OverlayWindowModel;
    
    public get maxFontWeightIndex(): number {
        if ( this.model?.fontFamily != null ) {
            return availableFonts[ this.model.fontFamily ].length - 1;
        } else {
            return 1;
        }
    }

    @HostListener( 'window:beforeunload' ) doSomething() {
        this.ipcService.disableOverlayEditMode( this.overlayId );
    }

    constructor( private ipcService: IpcService, private route: ActivatedRoute ) { }

    ngOnInit() {
        this.model = new OverlayWindowModel();

        this.route.params.subscribe( params => {
            
            this.overlayId = params[ 'id' ];

            if ( this.overlayId != null ) {
                this.ipcService.getOverlayWindow( this.overlayId ).subscribe( overlay => {
                    this.ipcService.enableOverlayEditMode( this.overlayId );
                    this._noChangesModel = Object.assign( new OverlayWindowModel(), overlay );
                    this.model = overlay;

                    this.model.fontFamily = this.model.fontFamily ? this.model.fontFamily : 'Roboto';
                    this.model.fontSize = this.model.fontSize > 0 ? this.model.fontSize : 14;
                    this.model.lineHeight = this.model.lineHeight > 0 ? this.model.lineHeight : 90;
                    this.model.fontWeight = this.model.fontWeight > 100 ? this.model.fontWeight : 400;
                    this.fontWeightIndex = availableFonts[ this.model.fontFamily ].indexOf( this.model.fontWeight );
                    this.fontTransparency = Math.round( this.model.fontTransparency * 100 );
                    this.backgroundTransparency = Math.round( this.model.backgroundTransparency * 100 );
                    this.borderTransparency = Math.round( this.model.borderTransparency * 100 );

                } );
            }
     
        } );
        
    }

    public onChangeFontFamily(): void {
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

    public onChangeFontTransparency(): void {
        this.model.fontTransparency = this.fontTransparency / 100;
        this.broadcastModel();
    }

    public onChangeBackgroundTransparency(): void {
        this.model.backgroundTransparency = this.backgroundTransparency / 100;
        this.broadcastModel();
    }

    public onChangeBorderTransparency(): void {
        this.model.borderTransparency = this.borderTransparency / 100;
        this.broadcastModel();
    }

    public onChangeFontColor(): void {
        this.model.fontColor = this.fontColor.toHex();
        this.broadcastModel();
    }

    public broadcastModel(): void {
        this.model.fontWeight = availableFonts[ this.model.fontFamily ][ this.fontWeightIndex ];
        this.ipcService.broadcastOverlayModel( this.model );
    }

    public cancel(): void {
        this.ipcService.updateOverlayWindow( this._noChangesModel ).subscribe( success => { } );
        this.closeModal();
    }

    public closeModal(): void {
        this.ipcService.closeThisChild();
    }

    public save(): void {
        if ( this.overlayId == null ) {
            this.closeModal();
        } else {
            this.ipcService.updateOverlayWindow( this.model ).subscribe( success => { } );
            this.closeModal();
        }
    }

    public sendDisplayTextTest(): void {
        let phrases: string[] = [
            'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
            'Vivamus viverra luctus nibh, porta consequat neque mattis a.',
            'Etiam mollis justo felis, non suscipit velit commodo sed.',
            'Maecenas lobortis mi sed felis scelerisque viverra.',
            'Phasellus nec nibh a nulla porttitor gravida.',
        ];
        phrases.forEach( phrase => {
            let comp: any = {
                overlayId: this.overlayId,
                action: {
                    actionType: ActionTypes.DisplayText,
                    duration: Math.floor(Math.random() * 5) + 1,
                    displayText: phrase,
                }
            }
            this.ipcService.sendOverlayComponent( comp );
        } );
    }
}
