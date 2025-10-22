import { Component, OnInit, ViewChild, ElementRef, forwardRef, HostListener, EventEmitter, Output, Input } from '@angular/core';
import { Color, ColorUtility } from 'src/app/utilities';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { IpcService } from 'src/app/ipc.service';
import * as Palettes from './color-picker.palettes';

@Component( {
    selector: 'app-color-picker',
    templateUrl: 'color-picker.component.html',
    styleUrls: [ 'color-picker.component.scss' ],
    providers: [
        {
            provide: NG_VALUE_ACCESSOR,
            useExisting: forwardRef( () => ColorPickerComponent ),
            multi: true
        }
    ],
} )

export class ColorPickerComponent implements OnInit, ControlValueAccessor {
    /**
     * Use chrome native color picker. Built in
     */
    @ViewChild( 'nativeColorInput' ) nativeColorInput!: ElementRef<HTMLInputElement>;










    /**
     * Opens the native color picker via an anchor/link.
     *
     * @param {Event} event - The click event triggered by the link.
     * @returns {void}
     */
    openColorPickerLink( event: Event ) {
        event.preventDefault();
        this.openNativeColorPicker( event );
    }










    /**
     * Opens the native color picker input element.
     *
     * @param {Event} event - The click event that triggered opening the color picker.
     * @returns {void}
     */
    openNativeColorPicker( event: Event ) {
        event.preventDefault();

        let colorToSet = this.manualColorInput;

        if ( !colorToSet && this.value ) {
            colorToSet = this.value.toHex();
        }

        if ( !colorToSet ) {
            colorToSet = '#FFFFFF';
        }

        this.nativeColorInput.nativeElement.value = colorToSet;
        this.nativeColorInput.nativeElement.click();
    }










    /**
     * Handler for native color input change event.
     *
     * @param {Event} event - The native input change event.
     * @returns {void}
     */
    onNativeColorPicked( event: Event ) {
        const input = event.target as HTMLInputElement;
        const colorValue = input.value; // format: #RRGGBB

        this.manualColorInput = colorValue;
        this.previewColorRgb = colorValue;

        this.onManualColorChange( colorValue );
    }










    /**
     * Tooltip text describing accepted color formats.
     */
    tooltipText: string = `Examples:
        Hex: #FF085A
        Hex with Alpha: #FF085AAA
        RGB: rgb(255, 8, 90)
        RGBA: rgba(255, 8, 90, 0.5)`;


    /**
     * ControlValueAccessor onChange callback placeholder.
     */
    onChange: any = () => { }



    /**
     * ControlValueAccessor onTouch callback placeholder.
     */
    onTouch: any = () => { }



    /**
     * The grid palette as rows of Color arrays, used by the template.
     */
    public colorPalette: Color[][] = [];


    /**
     * Whether the color picker popup is visible.
     */
    public showPopup: boolean = false;


    /**
     * Internal palette name storage.
     */
    private _paletteName: 'nag' | 'gina' | 'manual' | 'palette01' | 'palette02' | 'palette03' | 'palette04' | 'palette05' = 'nag';


    /**
     * Gets the current palette name.
     *
     * @returns {'nag'|'gina'|'manual'|'palette01'|'palette02'|'palette03'|'palette04'|'palette05'} The current palette identifier.
     */
    public get paletteName(): 'nag' | 'gina' | 'manual' | 'palette01' | 'palette02' | 'palette03' | 'palette04' | 'palette05' {
        return this._paletteName;
    }


    /**
     * Sets the current palette name and updates the palette.
     *
     * @param {'nag'|'gina'|'manual'|'palette01'|'palette02'|'palette03'|'palette04'|'palette05'} val - The palette identifier to set.
     * @returns {void}
     */
    public set paletteName( val: 'nag' | 'gina' | 'manual' | 'palette01' | 'palette02' | 'palette03' | 'palette04' | 'palette05' ) {
        this._paletteName = val;
        if ( val === 'manual' ) {
            if ( this.value ) {
                this.manualColorInput = this.value.toHex();
                this.previewColorRgb = this.value.toHex();
            } else {
                this.manualColorInput = '';
                this.previewColorRgb = 'transparent';
            }
        }
        this.updateColorPalette();
    }





    /**
     * Internal currently selected value.
     */
    private _value: Color;


    /**
     * Internal flat color list backing the grid.
     */
    private _colors: Color[];


    /**
     * Manual color string input (e.g. #RRGGBB).
     */
    public manualColorInput: string = '';


    /**
     * Preview color used in the manual input UI.
     */
    public previewColorRgb: string = 'transparent';


    /**
     * Whether the picker is inline or a popup.
     */
    @Input() public inline: boolean = false;


    /**
     * Value setter - syncs changes and updates external listeners.
     *
     * @param {Color} val - The new Color value to set.
     * @returns {void}
     */
    public set value( val: Color ) {
        if ( val !== undefined && val !== null && this._value !== val ) {
            this._value = val;
            this.onChange( val.toHex() );
            this.onTouch( val.toHex() );
            this.change.emit( val.toHex() );

            // Sync preview color to manual selector
            if ( this.paletteName === 'manual' ) {
                this.manualColorInput = val.toHex();
                this.previewColorRgb = val.toHex();
            }
        }
    }





    /**
     * Value getter.
     *
     * @returns {Color} The current Color value.
     */
    public get value(): Color {
        return this._value;
    }





    /**
     * Emits change events when color selection changes.
     */
    @Output( 'change' ) public change: EventEmitter<string> = new EventEmitter<string>();


    /**
     * Reference to the color input element wrapper.
     */
    @ViewChild( 'colorInput' ) public colorInputEl: ElementRef<HTMLDivElement>;


    /**
     * Constructor.
     *
     * @param {IpcService} ipcService - IPC service for retrieving and updating settings.
     */
    constructor( private ipcService: IpcService ) { }










    /**
     * Angular lifecycle hook - component initialization.
     *
     * Initializes palette and default color, and subscribes to default palette setting.
     *
     * @returns {void}
     */
    ngOnInit() {
        this.updateColorPalette();
        this.ipcService.getSetting<string>( 'defaultPaletteName' ).subscribe( pn => {
            const validPalettes = [ 'nag', 'gina', 'manual', 'palette01', 'palette02', 'palette03', 'palette04', 'palette05' ];
            if ( validPalettes.includes( pn ) ) {
                this.paletteName = pn as any;
            } else {
                this.paletteName = 'nag';
            }

            // Explicitly initialize default color AFTER palette is set, as this broke after adding stricter logic
            if ( !this.value ) {
                this.value = new Color( 255, 255, 255, 1 );  // default to white
            }
        });

        // Fallback in case IPC doesn't return quickly
        if ( !this.value ) {
            this.value = new Color( 255, 255, 255, 1 );  // default to white
        }
    }










    /**
     * Updates the color palette grid based on the selected palette name.
     *
     * @returns {void}
     */
    public updateColorPalette() {
        if ( this.paletteName === 'manual' ) {
            this._colors = [];
            this.colorPalette = [];
            return;
        }

        const paletteMap: Record<string, Color[]> = {
            'gina': Palettes.ginaColors,
            'nag': Palettes.baseColors,
            'palette01': Palettes.palette01,
            'palette02': Palettes.palette02,
            'palette03': Palettes.palette03,
            'palette04': Palettes.palette04,
            'palette05': Palettes.palette05,
        };

        this._colors = paletteMap[this.paletteName] || Palettes.baseColors;

        this.colorPalette = [];
        for ( let r = 0; r < Math.ceil( this._colors.length / 10 ); r++ ) {
            this.colorPalette[r] = [];
            for ( let c = 0; c < 10; c++ ) {
                const index = r * 10 + c;
                if ( index < this._colors.length ) {
                    this.colorPalette[r][c] = this._colors[index];
                }
            }
        }
    }










    /**
     * Handles selecting a color from the palette and persists the default palette setting.
     *
     * @param {Color} val - The selected color instance.
     * @returns {void}
     */
    public selectColor( val: Color ): void {

        this.ipcService.updateSetting( 'defaultPaletteName', this.paletteName );

        this.value = val;
        this.showPopup = false;
    }










    /**
     * Toggles the color picker popup.
     *
     * @returns {void}
     */
    public toggle(): void {
        if ( !this.showPopup )
            window.setTimeout( () => this.showPopup = !this.showPopup );
        else
            this.showPopup = false;
    }










    /**
     * Called when the manual color input changes (hex or rgb formats).
     *
     * @param {string} value - The manual color string input.
     * @returns {void}
     */
    public onManualColorChange( value: string ) {
        if ( this.isValidHex( value ) ) {
            const color = ColorUtility.FromHex( value );
            this.value = color;
            this.previewColorRgb = color.toHex();
        } else if ( this.isValidRgb( value ) ) {
            const color = this.parseRgb( value );
            if ( color ) {
                this.value = color;
                this.previewColorRgb = color.toHex();
            }
        } else {
                this.previewColorRgb = 'transparent'; // invalid input
        }
    }










    /**
     * Hex validation - accept complete 6-digit OR 8-digit (alpha) hex codes.
     *
     * @param {string} value - The hex string to validate.
     * @returns {boolean} True if the string is valid hex format, otherwise false.
     */
    private isValidHex( value: string ): boolean {
        return /^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/.test( value );
    }










    /**
     * RGB validation - accepts rgb(r,g,b) OR rgba(r,g,b,a)
     *
     * @param {string} value - The rgb/rgba string to validate.
     * @returns {boolean} True if the string matches rgb/rgba format, otherwise false.
     */
    private isValidRgb( value: string ): boolean {
        // Standard rgb() format
        if ( /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/.test( value ) ) {
            return true;
        }
        // RGBA format
        if ( /^rgba\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*([01]?\.?\d*)\s*\)$/.test( value ) ) {
            return true;
        }
        return false;
    }










    /**
     * parse rgb string into Color object - handles rgb() and rgba() formats
     *
     * @param {string} value - The rgb/rgba string to parse.
     * @returns {Color | null} The parsed Color object, or null if parsing failed.
     */
    private parseRgb( value: string ): Color | null {
        let match;

        // Try standard rgb() format first
        match = value.match( /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/ );
        if ( match ) {
            const r = Number( match[1] );
            const g = Number( match[2] );
            const b = Number( match[3] );
            if ( r > 255 || g > 255 || b > 255 ) return null;
            return new Color( r, g, b, 1 );
        }

        // Try rgba() format
        match = value.match( /^rgba\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*([01]?\.?\d*)\s*\)$/ );
        if ( match ) {
            const r = Number( match[1] );
            const g = Number( match[2] );
            const b = Number( match[3] );
            const a = Number( match[4] );
            if ( r > 255 || g > 255 || b > 255 || a < 0 || a > 1 ) return null;
            return new Color( r, g, b, a );
        }

        return null;
    }










    /**
     * Helper method to determine if a color input is valid.
     *
     * @param {string} value - The color string to validate.
     * @returns {boolean} True if the input is a valid color format, otherwise false.
     */
    public isValidColorInput( value: string ): boolean {
        return this.isValidHex( value ) || this.isValidRgb( value );
    }










    /**
     * Writes a new value coming from ControlValueAccessor.
     *
     * @param {string} value - The hex string value to write.
     * @returns {void}
     */
    writeValue( value: string ) {
        if ( value ) {
            this.value = ColorUtility.FromHex( value );
        }
    }










    /**
     * Registers ControlValueAccessor change callback.
     *
     * @param {any} fn - The callback function to register.
     * @returns {void}
     */
    registerOnChange( fn: any ) {
        this.onChange = fn
    }










    /**
     * Registers ControlValueAccessor touched callback.
     *
     * @param {any} fn - The touched callback function to register.
     * @returns {void}
     */
    registerOnTouched( fn: any ) {
        this.onTouch = fn
    }
}
