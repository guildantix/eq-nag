import { Component, OnInit, ViewChild, ElementRef, forwardRef, HostListener, EventEmitter, Output, Input } from '@angular/core';
import { Color, ColorUtility } from 'src/app/utilities';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { IpcService } from 'src/app/ipc.service';

const baseColors: Color[] = [
    new Color( 0, 0, 0, 1 ),new Color( 244, 67, 54, 1 ),new Color( 233, 30, 99, 1 ),new Color( 156, 39, 176, 1 ),new Color( 103, 58, 183, 1 ),new Color( 33, 150, 243, 1 ),new Color( 3, 169, 244, 1 ),new Color( 0, 188, 212, 1 ),new Color( 0, 150, 136, 1 ),new Color( 255, 235, 59, 1 ),
    new Color( 255, 255, 255, 1 ),new Color( 255, 235, 238, 1 ),new Color( 252, 228, 236, 1 ),new Color( 243, 229, 245, 1 ),new Color( 237, 231, 246, 1 ),new Color( 227, 242, 253, 1 ),new Color( 225, 245, 254, 1 ),new Color( 224, 247, 250, 1 ),new Color( 224, 242, 241, 1 ),new Color( 255, 253, 231, 1 ),
    new Color( 242, 242, 242, 1 ),new Color( 255, 205, 210, 1 ),new Color( 248, 187, 208, 1 ),new Color( 225, 190, 231, 1 ),new Color( 209, 196, 233, 1 ),new Color( 187, 222, 251, 1 ),new Color( 179, 229, 252, 1 ),new Color( 178, 235, 242, 1 ),new Color( 178, 223, 219, 1 ),new Color( 255, 249, 196, 1 ),
    new Color( 230, 230, 230, 1 ), new Color( 239, 154, 154, 1 ), new Color( 244, 143, 177, 1 ), new Color( 206, 147, 216, 1 ), new Color( 179, 157, 219, 1 ), new Color( 144, 202, 249, 1 ), new Color( 129, 212, 250, 1 ), new Color( 128, 222, 234, 1 ), new Color( 128, 203, 196, 1 ), new Color( 255, 245, 157, 1 ),
    new Color( 204, 204, 204, 1 ), new Color( 229, 115, 115, 1 ), new Color( 240, 98, 146, 1 ), new Color( 186, 104, 200, 1 ), new Color( 149, 117, 205, 1 ), new Color( 100, 181, 246, 1 ), new Color( 79, 195, 247, 1 ), new Color( 77, 208, 225, 1 ), new Color( 77, 182, 172, 1 ), new Color( 255, 241, 118, 1 ),
    new Color( 179, 179, 179, 1 ), new Color( 239, 83, 80, 1 ), new Color( 236, 64, 122, 1 ), new Color( 171, 71, 188, 1 ), new Color( 126, 87, 194, 1 ), new Color( 66, 165, 245, 1 ), new Color( 41, 182, 246, 1 ), new Color( 38, 198, 218, 1 ), new Color( 38, 166, 154, 1 ), new Color( 255, 238, 88, 1 ),
    new Color( 153, 153, 153, 1 ), new Color( 229, 57, 53, 1 ), new Color( 216, 27, 96, 1 ), new Color( 142, 36, 170, 1 ), new Color( 94, 53, 177, 1 ), new Color( 30, 136, 229, 1 ), new Color( 3, 155, 229, 1 ), new Color( 0, 172, 193, 1 ), new Color( 0, 137, 123, 1 ), new Color( 253, 216, 53, 1 ),
    new Color( 128, 128, 128, 1 ), new Color( 211, 47, 47, 1 ), new Color( 194, 24, 91, 1 ), new Color( 123, 31, 162, 1 ), new Color( 81, 45, 168, 1 ), new Color( 25, 118, 210, 1 ), new Color( 2, 136, 209, 1 ), new Color( 0, 151, 167, 1 ), new Color( 0, 121, 107, 1 ), new Color( 251, 192, 45, 1 ),
    new Color( 102, 102, 102, 1 ), new Color( 198, 40, 40, 1 ), new Color( 173, 20, 87, 1 ), new Color( 106, 27, 154, 1 ), new Color( 69, 39, 160, 1 ), new Color( 21, 101, 192, 1 ), new Color( 2, 119, 189, 1 ), new Color( 0, 131, 143, 1 ), new Color( 0, 105, 92, 1 ), new Color( 249, 168, 37, 1 ),
    new Color( 77, 77, 77, 1 ), new Color( 183, 28, 28, 1 ), new Color( 136, 14, 79, 1 ), new Color( 74, 20, 140, 1 ), new Color( 49, 27, 146, 1 ), new Color( 13, 71, 161, 1 ), new Color( 1, 87, 155, 1 ), new Color( 0, 96, 100, 1 ), new Color( 0, 77, 64, 1 ), new Color( 245, 127, 23, 1 ),
];

const ginaColors: Color[] = [
    new Color( 255, 255, 255 ), new Color( 128, 128, 128 ), new Color( 0, 0, 0 ), new Color( 255, 0, 0 ), new Color( 0, 255, 0 ), new Color( 0, 0, 255 ), new Color( 255, 255, 0 ), new Color( 255, 165, 0 ), new Color( 128, 0, 128 )
];


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

    onChange: any = () => { }
    onTouch: any = () => { }
    public colorPalette: Color[][] = [];
    public showPopup: boolean = false;
    public paletteName: string = 'nag';
    private _value: Color;
    private _colors: Color[];

    @Input() public inline: boolean = false;

    public set value( val: Color ) {
        if ( val !== undefined && this._value !== val ) {
            this._value = val;
            this.onChange( val.toHex() );
            this.onTouch( val.toHex() );
            this.change.emit( val.toHex() );
        }
    }

    public get value(): Color {
        return this._value;
    }

    @Output( 'change' ) public change: EventEmitter<string> = new EventEmitter<string>();
    @ViewChild( 'colorInput' ) public colorInputEl: ElementRef<HTMLDivElement>;

    constructor( private ipcService: IpcService ) { }

    ngOnInit() {
        this.ipcService.getSetting<string>( 'defaultPaletteName' ).subscribe( pn => {
            this.paletteName = pn ? pn : this.paletteName;
            this.updateColorPalette();
        } );
    }

    public updateColorPalette() {

        if ( this.paletteName === 'gina' ) {
            this._colors = ginaColors;
        } else if ( this.paletteName === 'nag' ) {
            this._colors = baseColors;
        } else {
            this._colors = baseColors;
        }

        this.colorPalette = [];
        for ( let r: number = 0; r < Math.ceil( this._colors.length / 10 ); r++ ) {
            this.colorPalette[ r ] = [];
            for ( let c: number = 0; c < 10; c++ ) {
                if ( r * 10 + c < this._colors.length ) {
                    this.colorPalette[ r ][ c ] = this._colors[ r * 10 + c ];
                }
            }
        }
    }

    public selectColor( val: Color ): void {

        this.ipcService.updateSetting( 'defaultPaletteName', this.paletteName );
        
        this.value = val;
        this.showPopup = false;
    }

    public toggle(): void {
        if ( !this.showPopup )
            window.setTimeout( () => this.showPopup = !this.showPopup );
        else
            this.showPopup = false;
    }

    writeValue( value: string ) {
        this.value = ColorUtility.FromHex( value );
    }
  
    registerOnChange( fn: any ) {
        this.onChange = fn
    }
  
    registerOnTouched( fn: any ) {
        this.onTouch = fn
    }

}
