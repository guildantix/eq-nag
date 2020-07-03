const Store = require( './store' );

class UserPreferencesStore extends Store {

    windowBounds = { width: 800, height: 600 };

    constructor() {
        super( {
            // We'll call our data file 'user-preferences'
            configName: 'user-preferences',
            defaults: { windowBounds: { width: 800, height: 600 }}
        } );
        
        this = this.parseDataFile( this );
    }

}

module.exports = UserPreferencesStore;
