
/**
 * Splits a condition value into its trimmed, non-empty alternatives.  The
 * trimming has to really happen here: the old per-name code trimmed a copy
 * that was thrown away, so "A | B" never matched a stored "A".  Returns null
 * when there are none.
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
