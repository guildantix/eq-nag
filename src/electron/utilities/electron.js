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
        return a.height === b.height && a.width === b.width && Math.abs( a.x - b.x ) < 5 && Math.abs( a.y - b.y ) < 5;
    } else {
        return a.height === b.height && a.width === b.width && a.x === b.x && a.y === b.y;
    }
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










let ElectronUtilities = {
    determineContainingDisplay: determineContainingDisplay,
    getRecordKeys: getRecordKeys,
    compareRectangles: compareRectangles,
};

module.exports = ElectronUtilities;
