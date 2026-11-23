
/**
 * Splits a condition value on "|" into its alternatives, with the
 * whitespace around each one removed and empty ones dropped.  Returns the
 * list, or null when the input is empty or has only empty alternatives.
 *
 * @param {string} variableValue The value as typed by the user.  Ex: Knowledge | Tranquility
 * @returns {string[]|null}
 */
function parseConditionValues( variableValue ) {
    if ( !variableValue ) {
        return null;
    }

    const values = variableValue.split( /\|/gi ).map( value => value.trim() ).filter( value => value.length > 0 );
    return values.length > 0 ? values : null;
}










module.exports = { parseConditionValues };
