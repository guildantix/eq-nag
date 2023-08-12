import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { MatSliderChange } from '@angular/material/slider';
import { StylePropertiesModel } from 'src/app/core.model';

const availableFonts = {
    'Roboto': [ 100, 300, 400, 500, 700, 900 ],
    'Red Rose': [ 300, 400, 700 ],
    'Oswald': [ 200, 300, 400, 500, 600, 700 ],
    'Roboto Mono': [ 100, 200, 300, 400, 500, 600, 700 ],
    'Open Sans Condensed': [ 300, 700 ],
    'Ranchers': [ 400 ],
    'Press Start 2P': [ 400 ],
};

@Component( {
    selector: 'app-style-properties',
    templateUrl: 'style-properties.component.html',
    styleUrls: [ 'style-properties.component.scss' ],
} )
export class StylePropertiesComponent implements OnInit {
    
    @Input('style') public model: StylePropertiesModel;
    @Input() public label: string = 'Style Name';
    @Output() public onChange: EventEmitter<StylePropertiesModel> = new EventEmitter<StylePropertiesModel>();
    @Input( 'style-element' ) public styleElement: HTMLElement | null = null;

    public fontWeightIndex: number = 0;
    public borderIntensity: number = 0;
    public glowIntensity: number = 0;
    
    public get maxFontWeightIndex(): number {
        if ( this.model?.fontFamily != null ) {
            return availableFonts[ this.model.fontFamily ].length - 1;
        } else {
            return 1;
        }
    }

    constructor() { }

    ngOnInit() {
        this.fontWeightIndex = availableFonts[ this.model.fontFamily ].indexOf( this.model.fontWeight );
        this.borderIntensity = Math.round( this.model.borderIntensity * 100 );
        this.glowIntensity = Math.round( this.model.glowIntensity * 100 );

        if ( this.styleElement != null ) {
            StylePropertiesModel.applyStyles( this.styleElement, this.model );
        }
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

        this.emitChange();
    }

    public onChangeBorderTransparency(): void {
        this.model.borderIntensity = this.borderIntensity / 100;
        this.emitChange();
    }

    public onChangeGlowTransparency(): void {
        this.model.glowIntensity = this.glowIntensity / 100;
        this.emitChange();
    }

    emitChange() {
        if ( this.model != null ) {
            this.model.fontWeight = availableFonts[ this.model.fontFamily ][ this.fontWeightIndex ];
            this.onChange.emit( this.model );
            if (this.styleElement != null) {
                StylePropertiesModel.applyStyles( this.styleElement, this.model );
            }
        }
    }

    updateElementFontWeight( e: MatSliderChange ) {
        console.log( 'e', e );
        if ( this.styleElement != null ) {
            let x = Object.assign( new StylePropertiesModel(), this.model );
            x.fontWeight = availableFonts[ this.model.fontFamily ][ e.value ];
            StylePropertiesModel.applyStyles( this.styleElement, x );
        }
    }

    updateElementFontStyle( e: MatSliderChange ) {
        if ( this.styleElement != null ) {
            let x = Object.assign( new StylePropertiesModel(), this.model );
            // x.fontWeight = availableFonts[ this.model.fontFamily ][ this.fontWeightIndex ];
            x.fontSize = e.value;
            StylePropertiesModel.applyStyles( this.styleElement, x );
        }
    }

    updateElementBorderIntensity(e: MatSliderChange) {
        if ( this.styleElement != null ) {
            let x = Object.assign( new StylePropertiesModel(), this.model );
            x.borderIntensity = e.value / 100;
            StylePropertiesModel.applyStyles( this.styleElement, x );
        }
    }

    updateElementGlowIntensity( e: MatSliderChange ) {
        if ( this.styleElement != null ) {
            let x = Object.assign( new StylePropertiesModel(), this.model );
            x.glowIntensity = e.value / 100;
            StylePropertiesModel.applyStyles( this.styleElement, x );
        }
    }

    updateElementGlowSize( e: MatSliderChange ) {
        if ( this.styleElement != null ) {
            let x = Object.assign( new StylePropertiesModel(), this.model );
            x.glowSize = e.value;
            StylePropertiesModel.applyStyles( this.styleElement, x );
        }
    }

}
