
function format( format, args ) {
    // let args = Array.prototype.slice.call( arguments, 1 );
    return format.replace( /{(\d+)}/g, function ( match, number ) {
        return typeof args[ number ] != 'undefined' ? args[ number ] : match;
    } );
}

let StringUtilities = {
    format: format
};

module.exports = StringUtilities;
