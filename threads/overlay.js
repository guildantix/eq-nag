const DomUtilities = require( '../utilities/dom' );
const { ipcRenderer } = require( 'electron' );


// <!-- Roboto(i): 100, 300, 400, 500, 700, 900 -->
// <!-- Red Rose: 300, 400, 700 -->
// <!-- Oswald: 200, 300, 400, 500, 600, 700 -->
// <!-- Roboto Mono (i): 100, 200, 300, 400, 500, 600, 700 -->
// <!-- Open Sans Condensed: 300(i), 700 -->
// <!-- Ranchers: 400 -->
// <!-- Press Start 2P: 400 -->

function Overlay() {

    DomUtilities.docReady( f => {
        // document.querySelector( '#header' ).textContent = 'Overlay LOADED';
        var selectElements = document.querySelectorAll('select');
        var instances = M.FormSelect.init( selectElements, {} );
    } );
    // console.log( 'overlay loaded' );

    ipcRenderer.on( 'overlay:window:enable-edit', function ( event, data ) {
        document.querySelector( 'section.body' ).classList.add( 'drag' );
        document.querySelector( 'body' ).classList.add( 'show-border' );
    } );

    ipcRenderer.on( 'overlay:window:disable-edit', function ( event, data ) {
        document.querySelector( 'section.body' ).classList.remove( 'drag' );
        document.querySelector( 'body' ).classList.remove( 'show-border' );
    } );

    ipcRenderer.on( 'overlay:window:model', function ( event, data ) {
        console.log( 'overlay:window:model received', data );
        let contentArea = document.querySelector( '.content-area' );
        contentArea.style.fontFamily = `"${data.fontFamily}"`;
        contentArea.style.fontSize = `${data.fontSize}px`;
        contentArea.style.lineHeight = `${( data.lineHeight > 10 ? data.lineHeight : 90 ) / 100}em`;
        contentArea.style.fontWeight = data.fontWeight > 0 ? data.fontWeight : 300;
        // document.querySelector( '.content-area' ).style.fontFamily = 'Press Start 2P';
        // document.querySelectorAll( '.content-area' ).forEach( f => {
        //     console.log( 'found', f );
        //     f.style.fontFamily = data.fontFamily;
        // } );
    } );
}

module.exports = Overlay;
