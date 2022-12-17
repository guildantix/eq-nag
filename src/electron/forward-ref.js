/** @template T */
class ForwardRef {

    /** @type {() => T} */
    #refFn;

    /** @type {NodeJS.Timer} */
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
     * Sets the ref function.
     * @param {() => T} refFn The function to pull a reference to an object.
     */
    setRefFn( refFn ) {
        this.#refFn = refFn;
    }

    /**
     * Executes the given function when the reference is loaded.
     * 
     * @param {(fn: T) => void} fn The callback function to execute.
     */
    whenReady( fn ) {
        setTimeout( () => this.checkRef( fn ) );
    }

    checkRef(fn) {
        if ( this.reference ) {
            fn();
        } else {
            setTimeout( () => this.checkRef( fn ) );
        }
    }
}

module.exports = ForwardRef;