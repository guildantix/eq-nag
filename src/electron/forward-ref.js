/** @template T */
class ForwardRef {

    /** @type {() => T} */
    #refFn;

    /** @type {number} */
    #checkIntervalId;

    get reference() {
        return this.#refFn();
    }

    /**
     * Constructs the forward ref object.
     * @param {() => T} refFn The function to pull a reference to an object.
     */
    constructor( refFn ) {
        this.#refFn = refFn;
    }

    /**
     * Executes the given function when the reference is loaded.
     * 
     * @param {() => void)} fn The callback function to execute.
     */
    whenReady( fn ) {
        this.#checkIntervalId = setInterval( () => {
            if ( this.reference ) {
                clearInterval( this.#checkIntervalId );
                fn();
            }
        } );
    }
}

module.exports = ForwardRef;