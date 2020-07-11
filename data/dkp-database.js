const Store = require( './store' );
const _ = require( 'lodash' );
const DkpEntryModel = require( './models/dkp-entry' );

class DkpDatabaseStore extends Store {

    #dkpEntryIds = 0;

    /** The data store for this object. */
    #data;

    get count() {
        return this.#data?.entries?.length;
    }

    constructor() {
        super( {
            configName: "dkp-database",
            defaults: { entries: [] },
        } );

        this.#data = this.parseDataFile();
        if ( this.#data && this.#data.entries && this.#data.entries.length > 0 ) {
            this.#dkpEntryIds = _.maxBy( this.#data.entries, f => f.entryId ).entryId;
        }
    }









    
    /**
     * Adds the given dkp entry to the db.
     *
     * @param {DkpEntryModel} entry The dkp entry to add to the db.
     */
    add( entry ) {
        this.#data.entries = this.#data.entries ? this.#data.entries : [];
        this.#data.entries.push( entry );
        entry.entryId = entry.entryId > 0 ? entry.entryId : ++this.#dkpEntryIds;
        this.storeDataFile( this.#data );
    }









    
    /**
     * Removes the dkp entry from the db.
     *
     * @param {DkpEntryModel} entry The dkp entry to remove.
     */
    remove( entry ) {
        this.#data.entries = this.#data.entries ? this.#data.entries : [];
        let count = this.#data.entries.length;
        let i = _.findIndex( this.#data.entries, ( e ) => e.entryId === entry.entryId );
        this.#data.entries.splice( i, 1 );
        this.storeDataFile( this.#data );
        return count > this.#data.entries.length;
    }









    
    /**
     * Removes the entry at the given index
     * 
     * @param {number} i The index of the entry to remove.
     */
    removeIndex( i ) {
        this.#data.entries.splice( i, 1 );
        this.storeDataFile( this.#data );
    }









    
    /**
     * Returns the entry with the given id.
     * 
     * @param {number} entryId The id of the entry to find.
     */
    find( entryId ) {
        let i = _.findIndex( this.#data.entries, ( e ) => e.entryId === entryId );

        return this.#data[ i ];
    }









    
    /**
     * Returns all dkp entries.
     */
    getAll() {
        return this.#data.entries;
    }










    /**
     * Returns all un-entered dkp entries.
     */
    getAllUnentered() {
        return _.filter( this.#data.entries, f => !f.entered );
    }










    /**
     * Removes the given entries from the db.
     * 
     * @param {DkpEntryModel[]} entries The entries to remove.
     */
    removeRange( entries ) {
        _.remove( this.#data.entries, ( f ) => {
            _.some( entries, ( x ) => x.entryId == f.entryId );
        } );
        this.storeDataFile( this.#data );
    }










    /**
     * Marks the given DKP entries as entered.
     * 
     * @param {DkpEntryModel[]} entries The entries in the database that are entered into the DKP portal.
     */
    markRangeEntered( entries ) {
        if ( entries && entries.length > 0 ) {
            entries.forEach( entry => {
                entry.entered = true;
                entry.dateEntered = new Date();
                
                let i = _.findIndex( this.#data.entries, f => f.entryId === entry.entryId );
                if ( i > -1 ) {
                    this.#data.entries[ i ] = entry;
                } else {
                    this.#data.entries.push( entry );
                }

            } );
        }
        this.storeDataFile( this.#data );
    }










    /**
     * Clears the DKP database of all entries.
     */
    clear() {
        this.#data.entries = [];
        this.storeDataFile( this.#data );
    }
}

module.exports = DkpDatabaseStore;
