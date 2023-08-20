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
    @Input( 'style-element' ) public styleElement: HTMLElement[] | null = null;
    @Input( 'enable-padding-horizontal' ) public enablePaddingHorizontal: boolean = false;
    @Input( 'enable-padding-vertical' ) public enablePaddingVertical: boolean = false;
    @Input( 'enable-inline-block' ) public enableInlineBlock: boolean = false;
    @Input( 'enable-justify' ) public enableJustify: boolean = false;

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

    public get showBlock(): boolean {
        return this.model.position == 'block';
    }
    public set showBlock( value: boolean ) {
        this.model.position = value ? 'block' : 'inline';
    }

    public get showInline(): boolean {
        return this.model.position == 'inline';
    }
    public set showInline( value: boolean ) {
        this.model.position = value ? 'inline' : 'block';
    }


    constructor() { }

    ngOnInit() {
        this.fontWeightIndex = availableFonts[ this.model.fontFamily ].indexOf( this.model.fontWeight );
        this.borderIntensity = Math.round( this.model.borderIntensity * 100 );
        this.glowIntensity = Math.round( this.model.glowIntensity * 100 );

        if ( this.styleElement?.length > 0 ) {
            this.styleElement.forEach( e => StylePropertiesModel.applyStyles( e, this.model ) );
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
            if ( this.styleElement?.length > 0 ) {
                this.styleElement.forEach( e => StylePropertiesModel.applyStyles( e, this.model ) );
            }
        }
    }

    // updateElementFontWeight( e: MatSliderChange ) {
    //     console.log( 'e', e );
    //     if ( this.styleElement?.length > 0 ) {
    //         let x = Object.assign( new StylePropertiesModel(), this.model );
    //         x.fontWeight = availableFonts[ this.model.fontFamily ][ e.value ];
    //         StylePropertiesModel.applyStyles( this.styleElement, x );
    //     }
    // }

    // updateElementFontStyle( e: MatSliderChange ) {
    //     if ( this.styleElement?.length > 0 ) {
    //         let x = Object.assign( new StylePropertiesModel(), this.model );
    //         // x.fontWeight = availableFonts[ this.model.fontFamily ][ this.fontWeightIndex ];
    //         x.fontSize = e.value;
    //         this.styleElement.forEach( e => StylePropertiesModel.applyStyles( e, x ) );
    //     }
    // }

    // updateElementBorderIntensity(e: MatSliderChange) {
    //     if ( this.styleElement?.length > 0 ) {
    //         let x = Object.assign( new StylePropertiesModel(), this.model );
    //         x.borderIntensity = e.value / 100;
    //         this.styleElement.forEach( e => StylePropertiesModel.applyStyles( e, x ) );
    //     }
    // }

    // updateElementGlowIntensity( e: MatSliderChange ) {
    //     if ( this.styleElement?.length > 0 ) {
    //         let x = Object.assign( new StylePropertiesModel(), this.model );
    //         x.glowIntensity = e.value / 100;
    //         this.styleElement.forEach( e => StylePropertiesModel.applyStyles( e, x ) );
    //     }
    // }

    // updateElementGlowSize( e: MatSliderChange ) {
    //     if ( this.styleElement?.length > 0 ) {
    //         let x = Object.assign( new StylePropertiesModel(), this.model );
    //         x.glowSize = e.value;
    //         this.styleElement.forEach( e => StylePropertiesModel.applyStyles( e, x ) );
    //     }
    // }

    updateStyleElement( propertyName: 'paddingLeft' | 'paddingRight' | 'paddingTop' | 'paddingBottom' | 'glowSize' | 'glowIntensity' | 'borderIntensity' | 'fontWeight' | 'fontSize', e: MatSliderChange ) {
        if ( this.styleElement?.length > 0 ) {
            let x = Object.assign( new StylePropertiesModel(), this.model );
            if ( propertyName == 'fontWeight' ) {
                x.fontWeight = availableFonts[ this.model.fontFamily ][ e.value ];
            } else if ( propertyName === 'glowIntensity' || propertyName === 'borderIntensity' ) {
                x[ propertyName ] = e.value / 100;
            } else {
                x[ propertyName ] = e.value;
            }
            this.styleElement.forEach( e => StylePropertiesModel.applyStyles( e, x ) );
        }
    }

}
