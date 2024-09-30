

// https://github.com/PimpTrizkit/PJs/wiki/12.-Shade,-Blend-and-Convert-a-Web-Color-(pSBC.js)
// Version 4.0
const pSBCr = ( d, r, g, b, a, i, m ) => {
    let n = d.length, x = {};
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
const pSBC = ( p, c0, c1, l ) => {
    let r, g, b, P, f, t, h, i = parseInt, m = Math.round, a = typeof ( c1 ) == "string";
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
    var i = parseInt, r = Math.round, [ a, b, c, d ] = c.split( "," ), P = p < 0, t = P ? 0 : 255 * p, P = P ? 1 + p : 1 - p;
    return "rgb" + ( d ? "a(" : "(" ) + r( i( a[ 3 ] == "a" ? a.slice( 5 ) : a.slice( 4 ) ) * P + t ) + "," + r( i( b ) * P + t ) + "," + r( i( c ) * P + t ) + ( d ? "," + d : ")" );
};

const RGB_Log_Blend = ( p, c0, c1 ) => {
    var i = parseInt, r = Math.round, P = 1 - p, [ a, b, c, d ] = c0.split( "," ), [ e, f, g, h ] = c1.split( "," ), x = d || h, j = x ? "," + ( !d ? h : !h ? d : r( ( parseFloat( d ) * P + parseFloat( h ) * p ) * 1000 ) / 1000 + ")" ) : ")";
    return "rgb" + ( x ? "a(" : "(" ) + r( ( P * i( a[ 3 ] == "a" ? a.slice( 5 ) : a.slice( 4 ) ) ** 2 + p * i( e[ 3 ] == "a" ? e.slice( 5 ) : e.slice( 4 ) ) ** 2 ) ** 0.5 ) + "," + r( ( P * i( b ) ** 2 + p * i( f ) ** 2 ) ** 0.5 ) + "," + r( ( P * i( c ) ** 2 + p * i( g ) ** 2 ) ** 0.5 ) + j;
};

const RGB_Log_Shade = ( p, c ) => {
    var i = parseInt, r = Math.round, [ a, b, c, d ] = c.split( "," ), P = p < 0, t = P ? 0 : p * 255 ** 2, P = P ? 1 + p : 1 - p;
    return "rgb" + ( d ? "a(" : "(" ) + r( ( P * i( a[ 3 ] == "a" ? a.slice( 5 ) : a.slice( 4 ) ) ** 2 + t ) ** 0.5 ) + "," + r( ( P * i( b ) ** 2 + t ) ** 0.5 ) + "," + r( ( P * i( c ) ** 2 + t ) ** 0.5 ) + ( d ? "," + d : ")" );
};

/**
 * Returns a lightened color.
 * 
 * @returns {string} Returns the hex code.
 * 
 * @param {string} color The HEX color code to lighten.
 * @param {number} percent The percent change to lighten the color.
 */
const lightenColor = ( color, percent ) => {
    return pSBC( percent, color, undefined, undefined );
}

/**
 * Returns a darkened color.
 * 
 * @returns {string} Returns the hex code.
 * 
 * @param {string} color The HEX color code to darken.
 * @param {number} percent The percent change to darken the color.
 */
const darkenColor = ( color, percent ) => {
    return pSBC( -1 * percent, color, undefined, undefined );
}


module.exports = {
    pSBCr,
    pSBC,
    RGB_Linear_Blend,
    RGB_Linear_Shade,
    RGB_Log_Blend,
    RGB_Log_Shade,
    lightenColor,
    darkenColor,
}