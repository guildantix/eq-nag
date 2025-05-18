const { screen } = require( "electron" );
const NumberUtilities = require( "./numbers" );










/**
 * Returns true if the given rectangles match.
 * 
 * @param {Electron.Rectangle} a The first rectangle.
 * @param {Electron.Rectangle} b The second rectangle.
 * @param {boolean|null} nearlyEqual If true, returns true if the x/y coords are close "enough".  If false|null, only returns true if a and b are exactly equal.
 */
function compareRectangles( a, b, nearlyEqual ) {
    if ( nearlyEqual ) {
        return Math.abs( a.height - b.height ) < 5 && Math.abs( a.width - b.width ) < 5 && Math.abs( a.x - b.x ) < 5 && Math.abs( a.y - b.y ) < 5;
    } else {
        return a.height === b.height && a.width === b.width && a.x === b.x && a.y === b.y;
    }
}










/**
 * Evaluates the given bounds to determine if they are invalid.
 * 
 * @returns {boolean} Retturns true if the bounds are invalid.
 * 
 * @param {Electron.Rectangle} bounds The bounds to evaluate.
 */
function invalidScreenBounds( bounds ) {
    // Returns true if the bounds are undefined/null or if any values are non-integer.
    if ( !bounds ) {
        return true;
    }
    if ( bounds.x % 1 !== 0 || bounds.y % 1 !== 0 || bounds.width % 1 !== 0 || bounds.height % 1 !== 0 ) {
        return true;
    }

    return false;
}










/**
 * Returns the display that contains the given bounding area.
 * 
 * @param {Electron.Rectangle} bounds The bounding area to evaluate.
 */
function determineContainingDisplay( bounds ) {
    let displays = screen.getAllDisplays();

    // Evaluate by top left corner.
    for ( let i = 0; i < displays.length; i++ ) {
        const display = displays[ i ];

        if ( NumberUtilities.rectContainsPoint( display.bounds, bounds.x, bounds.y ) ) {
            return display;
        }

    }

    // Evaluate by top right corner.
    for ( let i = 0; i < displays.length; i++ ) {
        const display = displays[ i ];

        if ( NumberUtilities.rectContainsPoint( display.bounds, bounds.x + bounds.width, bounds.y ) ) {
            return display;
        }

    }

    // Evaluate by bottom right corner.
    for ( let i = 0; i < displays.length; i++ ) {
        const display = displays[ i ];

        if ( NumberUtilities.rectContainsPoint( display.bounds, bounds.x + bounds.width, bounds.y + bounds.height ) ) {
            return display;
        }

    }

    // Evaluate by bottom left corner.
    for ( let i = 0; i < displays.length; i++ ) {
        const display = displays[ i ];

        if ( NumberUtilities.rectContainsPoint( display.bounds, bounds.x, bounds.y + bounds.height ) ) {
            return display;
        }

    }

    return undefined;
}










/**
 * Returns an array of keys on the given object.
 * 
 * @template T
 * 
 * @param {Record<T, any>} record The object.
 */
function getRecordKeys( record ) {
    if ( !record ) {
        return [];
    }

    /** @type {T[]} */
    let output = [];

    for ( let key in record ) {
        if ( record.hasOwnProperty( key ) ) {
            output.push( key );
        }
    }

    return output;
}










/**
 * Returns the bounds for the renderer window.
 * 
 * @returns {import("electron").Rectangle}
 */
function calculateRendererBounds() {
        
    let displays = screen.getAllDisplays();
    let left = 0, right = 0;
    let top = 0, bottom = 0;

    displays.forEach( display => {

        let absLeft = display.bounds.x * display.scaleFactor;
        let absRight = ( display.bounds.x + display.bounds.width ) * display.scaleFactor;
        let absTop = display.bounds.y * display.scaleFactor;
        let absBottom = ( display.bounds.y + display.bounds.height ) * display.scaleFactor;


        left = absLeft < left ? absLeft : left;
        right = absRight > right ? absRight : right;
        top = absTop < top ? absTop : top;
        bottom = absBottom > bottom ? absBottom : bottom;

    } );

    return {
        x: Math.floor( left),
        y: Math.floor( top ) - 50,
        width: Math.floor( right - left ),
        height: Math.floor( bottom - top ) + 50,
    };
}










let ElectronUtilities = {
    determineContainingDisplay: determineContainingDisplay,
    getRecordKeys: getRecordKeys,
    compareRectangles: compareRectangles,
    calculateRendererBounds: calculateRendererBounds,
    invalidScreenBounds: invalidScreenBounds,
};

module.exports = ElectronUtilities;
