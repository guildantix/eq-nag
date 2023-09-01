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
        let q: Color = hexToRgba( pSBC( percent, this.toHex(), undefined, undefined ) );
        this.r = q.r;
        this.g = q.g;
        this.b = q.b;

        return q;
    }

    public darken( percent: number ): Color {
        let q: Color = hexToRgba( pSBC( -1 * percent, this.toHex(), undefined, undefined ) );
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


// https://github.com/PimpTrizkit/PJs/wiki/12.-Shade,-Blend-and-Convert-a-Web-Color-(pSBC.js)
// Version 4.0
const pSBCr = ( d, r, g, b, a, i, m ) => {
    let n = d.length, x: any = {};
    if ( n > 9 ) {
        [ r, g, b, a ] = d = d.split( "," ), n = d.length;
        if ( n < 3 || n > 4 ) return null;
        x.r = i( r[ 3 ] == "a" ? r.slice( 5 ) : r.slice( 4 ) ), x.g = i( g ), x.b = i( b ), x.a = a ? parseFloat( a ) : -1
    } else {
        if ( n == 8 || n == 6 || n < 4 ) return null;
        if ( n < 6 ) d = "#" + d[ 1 ] + d[ 1 ] + d[ 2 ] + d[ 2 ] + d[ 3 ] + d[ 3 ] + ( n > 4 ? d[ 4 ] + d[ 4 ] : "" );
        d = i( d.slice( 1 ), 16 );
        if ( n == 9 || n == 5 ) x.r = d >> 24 & 255, x.g = d >> 16 & 255, x.b = d >> 8 & 255, x.a = m( ( d & 255 ) / 0.255 ) / 1000;
        else x.r = d >> 16, x.g = d >> 8 & 255, x.b = d & 255, x.a = -1
    } return x
};
const pSBC = ( p: any, c0: any, c1: any, l: any ) => {
    let r: any, g: any, b: any, P: any, f: any, t: any, h: any, i = parseInt, m = Math.round, a: any = typeof ( c1 ) == "string";
    if ( typeof ( p ) != "number" || p < -1 || p > 1 || typeof ( c0 ) != "string" || ( c0[ 0 ] != 'r' && c0[ 0 ] != '#' ) || ( c1 && !a ) ) return null;
    h = c0.length > 9, h = a ? c1.length > 9 ? true : c1 == "c" ? !h : false : h, f = pSBCr( c0, r, g, b, a, i, m ), P = p < 0, t = c1 && c1 != "c" ? pSBCr( c1, r, g, b, a, i, m ) : P ? { r: 0, g: 0, b: 0, a: -1 } : { r: 255, g: 255, b: 255, a: -1 }, p = P ? p * -1 : p, P = 1 - p;
    if ( !f || !t ) return null;
    if ( l ) r = m( P * f.r + p * t.r ), g = m( P * f.g + p * t.g ), b = m( P * f.b + p * t.b );
    else r = m( ( P * f.r ** 2 + p * t.r ** 2 ) ** 0.5 ), g = m( ( P * f.g ** 2 + p * t.g ** 2 ) ** 0.5 ), b = m( ( P * f.b ** 2 + p * t.b ** 2 ) ** 0.5 );
    a = f.a, t = t.a, f = a >= 0 || t >= 0, a = f ? a < 0 ? t : t < 0 ? a : a * P + t * p : 0;
    if ( h ) return "rgb" + ( f ? "a(" : "(" ) + r + "," + g + "," + b + ( f ? "," + m( a * 1000 ) / 1000 : "" ) + ")";
    else return "#" + ( 4294967296 + r * 16777216 + g * 65536 + b * 256 + ( f ? m( a * 255 ) : 0 ) ).toString( 16 ).slice( 1, f ? undefined : -2 )
};
const RGB_Linear_Blend = ( p, c0, c1 ) => {
    var i = parseInt, r = Math.round, P = 1 - p, [ a, b, c, d ] = c0.split( "," ), [ e, f, g, h ] = c1.split( "," ), x = d || h, j = x ? "," + ( !d ? h : !h ? d : r( ( parseFloat( d ) * P + parseFloat( h ) * p ) * 1000 ) / 1000 + ")" ) : ")";
    return "rgb" + ( x ? "a(" : "(" ) + r( i( a[ 3 ] == "a" ? a.slice( 5 ) : a.slice( 4 ) ) * P + i( e[ 3 ] == "a" ? e.slice( 5 ) : e.slice( 4 ) ) * p ) + "," + r( i( b ) * P + i( f ) * p ) + "," + r( i( c ) * P + i( g ) * p ) + j;
};

const RGB_Linear_Shade = ( p, c ) => {
    var i = parseInt, r = Math.round, [ a, b, c, d ] = c.split( "," ), P: any = p < 0, t = P ? 0 : 255 * p, P = P ? 1 + p : 1 - p;
    return "rgb" + ( d ? "a(" : "(" ) + r( i( a[ 3 ] == "a" ? a.slice( 5 ) : a.slice( 4 ) ) * P + t ) + "," + r( i( b ) * P + t ) + "," + r( i( c ) * P + t ) + ( d ? "," + d : ")" );
};

const RGB_Log_Blend = ( p, c0, c1 ) => {
    var i = parseInt, r = Math.round, P = 1 - p, [ a, b, c, d ] = c0.split( "," ), [ e, f, g, h ] = c1.split( "," ), x = d || h, j = x ? "," + ( !d ? h : !h ? d : r( ( parseFloat( d ) * P + parseFloat( h ) * p ) * 1000 ) / 1000 + ")" ) : ")";
    return "rgb" + ( x ? "a(" : "(" ) + r( ( P * i( a[ 3 ] == "a" ? a.slice( 5 ) : a.slice( 4 ) ) ** 2 + p * i( e[ 3 ] == "a" ? e.slice( 5 ) : e.slice( 4 ) ) ** 2 ) ** 0.5 ) + "," + r( ( P * i( b ) ** 2 + p * i( f ) ** 2 ) ** 0.5 ) + "," + r( ( P * i( c ) ** 2 + p * i( g ) ** 2 ) ** 0.5 ) + j;
};

const RGB_Log_Shade = ( p, c ) => {
    var i = parseInt, r = Math.round, [ a, b, c, d ] = c.split( "," ), P: any = p < 0, t = P ? 0 : p * 255 ** 2, P = P ? 1 + p : 1 - p;
    return "rgb" + ( d ? "a(" : "(" ) + r( ( P * i( a[ 3 ] == "a" ? a.slice( 5 ) : a.slice( 4 ) ) ** 2 + t ) ** 0.5 ) + "," + r( ( P * i( b ) ** 2 + t ) ** 0.5 ) + "," + r( ( P * i( c ) ** 2 + t ) ** 0.5 ) + ( d ? "," + d : ")" );
};