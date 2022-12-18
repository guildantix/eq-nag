const { screen } = require( "electron" );
const NumberUtilities = require( "./numbers" );

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
}

let ElectronUtilities = {
    determineContainingDisplay: determineContainingDisplay,
};

module.exports = ElectronUtilities;