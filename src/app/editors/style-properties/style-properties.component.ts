import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { MatSliderChange } from '@angular/material/slider';
import { StylePropertiesModel, getFontWeights } from 'src/app/core.model';

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
        const weights = getFontWeights( this.model?.fontFamily );

        if ( weights !== undefined ) {
            return weights.length - 1;
        } else {
            return 1;
        }
    }










    /**
     * Whether the selected font family has weights to choose from; the weight 
     * slider is disabled otherwise because there is nothing to pick.
     */
    public get hasFontWeights(): boolean {
        return getFontWeights( this.model?.fontFamily ) !== undefined;
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
        this.fontWeightIndex = getFontWeights( this.model.fontFamily )?.indexOf( this.model.fontWeight ) ?? -1;
        this.borderIntensity = Math.round( this.model.borderIntensity * 100 );
        this.glowIntensity = Math.round( this.model.glowIntensity * 100 );

        if ( this.styleElement?.length > 0 ) {
            this.styleElement.forEach( e => StylePropertiesModel.applyStyles( e, this.model ) );
        }
    }









    
    /**
     * Calculates the font weight from the font weight index and calls 
     * emitChange.
     */
    public onChangeFontFamily(): void {
        const weights = getFontWeights( this.model.fontFamily );

        // Without weights for this family, keep the stored weight and show no selection.
        if ( weights === undefined ) {
            this.fontWeightIndex = -1;
            return;
        }

        const fi: number = weights.indexOf( this.model.fontWeight );
        this.fontWeightIndex = -1;

        if ( fi > -1 ) {
            this.fontWeightIndex = fi;

        } else {

            for ( let i = 100; i < 500; i += 100 ) {
                const lfi: number = weights.indexOf( this.model.fontWeight - i );
                const ufi: number = weights.indexOf( this.model.fontWeight + i );
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









    
    /**
     * Calculates the border transparency from the border transparency and 
     * calls emitChange.
     */
    public onChangeBorderTransparency(): void {
        this.model.borderIntensity = this.borderIntensity / 100;
        this.emitChange();
    }









    
    /**
     * Calculates the glow transparency from the glow transparency and calls 
     * emitChange.
     */
    public onChangeGlowTransparency(): void {
        this.model.glowIntensity = this.glowIntensity / 100;
        this.emitChange();
    }









    
    /**
     * Emits the onChange event for this component and applies the styles to 
     * the style element.
     */
    emitChange() {
        if ( this.model != null ) {
            const weights = getFontWeights( this.model.fontFamily );

            // An index of -1 means the stored weight is not in the family's list; keep it.
            if ( weights !== undefined && this.fontWeightIndex >= 0 ) {
                this.model.fontWeight = weights[ this.fontWeightIndex ];
            }

            this.onChange.emit( this.model );
            if ( this.styleElement?.length > 0 ) {
                this.styleElement.forEach( e => StylePropertiesModel.applyStyles( e, this.model ) );
            }
        }
    }










    /**
     * Saves changes to the style element.
     * 
     * @param propertyName The name of the property to update.
     * @param e The mat slider change event.
     */
    updateStyleElement( propertyName: 'paddingLeft' | 'paddingRight' | 'paddingTop' | 'paddingBottom' | 'glowSize' | 'glowIntensity' | 'borderIntensity' | 'fontWeight' | 'fontSize', e: MatSliderChange ) {
        if ( this.styleElement?.length > 0 ) {
            let x = Object.assign( new StylePropertiesModel(), this.model );
            if ( propertyName == 'fontWeight' ) {
                x.fontWeight = getFontWeights( this.model.fontFamily )?.[ e.value ] ?? x.fontWeight;
            } else if ( propertyName === 'glowIntensity' || propertyName === 'borderIntensity' ) {
                x[ propertyName ] = e.value / 100;
            } else {
                x[ propertyName ] = e.value;
            }
            this.styleElement.forEach( e => StylePropertiesModel.applyStyles( e, x ) );
        }
    }









    
}
