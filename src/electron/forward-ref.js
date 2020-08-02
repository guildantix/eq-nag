class ForwardRef {

    /** @type {() => any} */
    #refFn;

    get reference() {
        return this.#refFn();
    }

    /**
     * Constructs the forward ref object.
     * @param {() => any} refFn The function to pull a reference to an object.
     */
    constructor( refFn ) {
        this.#refFn = refFn;
    }
}

module.exports = ForwardRef;