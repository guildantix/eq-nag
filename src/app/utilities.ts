import { Observable, Observer } from 'rxjs';
import * as _ from 'lodash-es';

export class StringUtility {

    /**
     * Inserts the given value into the given string value at the specified 
     * value.
     * 
     * @param string The original string value
     * @param value The value to insert into string.
     * @param position The position to perform operation.
     * 
     * @returns Returns a new string with the given value inserted into the 
     * specified position.
     */
    public static Insert( string: string, value: string, position: number ): string {
        return string.substr( 0, position ) + value + string.substr( position );
    }

    /**
     * Returns true if the given value is null, undefined, empty, or whitespace only.
     * 
     * @param value The string value to check.
     */
    public static isNullOrWhitespace( value: string ): boolean {
        return value === null || value === undefined || value.trim().length === 0;
    }

    /**
     * Returns an array of all named group matches in the given string against the given regexp.
     * 
     * @param value The string value to execute regex against.
     * @param regex The regex to execute.
     * @param groupName The capture group name to catch.
     * @param limit The maximum number of times to search string.
     * @returns 
     */
    public static MatchAll( value: string, regex: RegExp, groupName: string, limit: number = 50 ): string[] {
        limit = limit > 0 ? limit : 50;
        let output: string[] = [];
        // x = /(?:\(\?\<(?<variableName>\S+?)\>.+?\))/gi;

        regex.lastIndex = 0;
        let currentValue = regex.exec( value )?.groups[ groupName ];
        let crazy = 0;
        while ( currentValue && crazy < limit ) {
            crazy++;
            output.push( currentValue );
            currentValue = regex.exec( value )?.groups[ groupName ];
        }
        
        return output;
    }










    /**
     * Limits the length of a string to the specified max value.
     * 
     * @param value The original string value.
     * @param maxLength The max length allowed.
     * @param ellipsis If true, an ellipsis will be appended to the end.
     */
    public static LimitLength( value: string, maxLength: number, ellipsis: boolean = true ) {
        maxLength = ellipsis ? maxLength - 4 : maxLength;

        if ( value?.length >= maxLength ) {
            return value.substring( 0, maxLength ) + ( ellipsis ? ' ...' : '' );
        } else {
            return value;
        }
    }
}

export class ArrayUtility {

    /**
     * Returns true if the first all of the first array's elements exist in the 
     * second array.
     * 
     * @param a The first array of values.
     * @param b The second array of values.
     * @returns 
     */
    public static IsContainedIn<T>( a: T[], b: T[] ): boolean {
        return !_.some(a.map( f => b.indexOf( f ) ), i => i < 0);
    }

    /**
     * Returns true if the first array contains a value that also exists in the 
     * second array.
     * 
     * @param a The first array of values.
     * @param b The second array of values.
     * @returns 
     */
    public static Like<T>( a: T[], b: T[] ): boolean {
        
        for ( let i = 0; i < a?.length; i++ ) {
            let fi = b?.indexOf( a[ i ] );
            if ( fi > -1 ) {
                return true;
            }
        }

        return false;
    }
}

export class ImageUtility {

    public static toDataUrl( file: Blob ): Observable<string> {
        let obs: Observable<string> = new Observable<string>( ( observer: Observer<string> ) => {
            
            let reader: FileReader = new FileReader();

            reader.onload = () => {
                observer.next( reader.result.toString() );
                observer.complete();
            };

            reader.readAsDataURL( file );
            
            // let fileUrl: string = `file:\\\\${filePath}`;
            // let img: HTMLImageElement = new Image();
            // let canvas: HTMLCanvasElement = document.createElement( 'canvas' );
            // let context = canvas.getContext( '2d' );

            // img.onload = () => {
            //     // context.drawImage( img, img.width, img.height );
            // };
            // img.src = fileUrl;

        } );

        return obs;
    }

    // https://stackoverflow.com/a/49093626
    // public static fromUrlToDataUrl
}

export class ColorUtility {
    public static FromHex( hex: string ): Color {
        return hexToRgba( hex );
    }

    public static lighten( color: Color, percent: number ): Color {
        let q: Color = new Color( color.r, color.g, color.b, color.a );
        q.lighten( percent );
        return q;
    }

    public static hexLighten( hex: string, percent: number ): Color {
        let q: Color = hexToRgba( hex );
        q.lighten( percent );
        return q;
    }

    public static rgbLighten( r: number, g: number, b: number, percent: number ): Color {
        let q: Color = new Color( r, g, b, 1 );
        q.lighten( percent );
        return q;
    }

    public static rgbaLighten( r: number, g: number, b: number, a: number, percent: number ): Color {
        let q: Color = new Color( r, g, b, a );
        q.lighten( percent );
        return q;
    }

}

function hexToRgba( hex: string ): Color {
    let defaultRgba: Color = new Color( 255, 255, 255, 1 );

    if ( hex ) {

        if ( hex.charAt( 0 ) !== '#' ) {
            hex = '#' + hex;
        }

        let shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
        hex = hex.replace( shorthandRegex, function ( m, r, g, b ) {
            return r + r + g + g + b + b;
        } );

        let values = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})*$/i.exec( hex );
        if ( values ) {
            let r: number = parseInt( values[ 1 ], 16 );
            let g: number = parseInt( values[ 2 ], 16 );
            let b: number = parseInt( values[ 3 ], 16 );
            let a: number = values[ 4 ] ? parseInt( values[ 4 ], 16 ) / 255 : 1;
            return new Color( r, g, b, a );
        } else {
            return defaultRgba;
        }
    }

    return defaultRgba;
}

function rgbaToHex( r: number | string, g: number | string, b: number | string, a: number | string ) {

    r = r.toString( 16 );
    g = g.toString( 16 );
    b = b.toString( 16 );
    a = +a >= 0 && +a <= 1 ? Math.round( +a * 255 ).toString( 16 ) : a.toString( 16 );
  
    if ( r.length == 1 )
        r = "0" + r;
    if ( g.length == 1 )
        g = "0" + g;
    if ( b.length == 1 )
        b = "0" + b;
    if ( a.length == 1 )
        a = "0" + a;
    
    if ( a == "ff" )
        return "#" + r + g + b;
    else
        return "#" + r + g + b + a;
}

export class Color {

    constructor( _r: number, _g: number, _b: number, _a: number = 1 ) {
        this.r = _r;
        this.g = _g;
        this.b = _b;
        this.a = _a;
    }

    public lighten( percent: number ): Color {
        let q: Color = hexToRgba( window.api.utils.colors.pSBC( percent, this.toHex(), undefined, undefined ) );
        this.r = q.r;
        this.g = q.g;
        this.b = q.b;

        return q;
    }

    public darken( percent: number ): Color {
        let q: Color = hexToRgba( window.api.utils.colors.pSBC( -1 * percent, this.toHex(), undefined, undefined ) );
        this.r = q.r;
        this.g = q.g;
        this.b = q.b;

        return q;
    }

    public toString( alpha?: number ): string {
        this.a = alpha > 0 ? alpha : this.a;
        return `rgba(${this.r},${this.g},${this.b},${this.a})`;
    }

    public toHexString( alpha?: number ): string {
        this.a = alpha > 0 ? alpha : this.a;
        return rgbaToHex( this.r, this.g, this.b, this.a );
    }

    public toRgb(): string {
        return `rgba(${this.r},${this.g},${this.b})`;
    }

    public toHex(): string {
        return rgbaToHex( this.r, this.g, this.b, this.a );
    }

    public equals( color: Color ): boolean {
        return color.r === this.r && color.g === this.g && color.b === this.b && color.a === this.a;
    }

    public r: number;
    public g: number;
    public b: number;
    public a: number;
}
