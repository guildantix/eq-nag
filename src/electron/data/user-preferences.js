const Store = require( './store' );

class UserPreferencesStore extends Store {

    /** The data store for this object. */
    #data;

    get windowHeight() {
        return this.#data.windowBounds.height;
    }
    set windowHeight( val ) {
        this.#data.windowBounds.height = val;
        this.storeDataFile( this.#data );
    }

    get windowWidth() {
        return this.#data.windowBounds.width;
    }
    set windowWidth( val ) {
        this.#data.windowBounds.width = val;
        this.storeDataFile( this.#data );
    }

    get windowX() {
        return this.#data.windowBounds.x;
    }
    set windowX( val ) {
        this.#data.windowBounds.x = val;
        this.storeDataFile( this.#data );
    }

    get windowY() {
        return this.#data.windowBounds.y;
    }
    set windowY( val ) {
        this.#data.windowBounds.y = val;
        this.storeDataFile( this.#data );
    }

    get logFile() {
        return this.#data.logFile;
    }
    set logFile( val ) {
        this.#data.logFile = val;
        this.storeDataFile( this.#data );
    }

    get voiceIndex() {
        if ( this.#data && this.#data.voiceIndex > -1 ) {
            return this.#data.voiceIndex;
        } else {
            return 0;
        }
    }
    set voiceIndex( val ) {
        this.#data.voiceIndex = val;
        this.storeDataFile( this.#data );
    }

    constructor() {
        super( {
            // We'll call our data file 'user-preferences'
            configName: 'user-preferences',
            defaults: { logFile: null, windowBounds: { width: 800, height: 600, x: undefined, y: undefined } }
        } );
        // var defaults = { windowBounds: { width: 800, height: 600 } };
        
        this.#data = this.parseDataFile();
        
    }

}

module.exports = UserPreferencesStore;
