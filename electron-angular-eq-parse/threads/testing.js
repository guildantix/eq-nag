const { Test } = require( "tslint" );

const chokidar = require( "chokidar" );

function TestMethod() {
    console.log( 'is this thing on?' );
    chokidar.watch( "E:\\everquest\\Logs\\eqlog_Halindar_aradune.txt" ).on( "all", ( event, path ) => {
        console.log( event, path );
    } );
}
// TestMethod();

module.exports = TestMethod;