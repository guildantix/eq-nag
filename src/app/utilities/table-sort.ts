/**
 * Which way a table column is sorted.
 */
export type SortDirection = 'asc' | 'desc';










/**
 * The sorted column of one table and its direction.
 */
export interface TableSortState {
    key: string;
    direction: SortDirection;
}










/**
 * Works out the sort after a header was clicked: a new column starts with its natural direction
 * (A to Z for text, high to low for numbers), the same column flips.
 *
 * @param current The sort before the click.
 * @param key The clicked column.
 * @param textColumn True when the column holds text, so it starts A to Z.
 */
export function nextSortState( current: TableSortState, key: string, textColumn: boolean ): TableSortState {
    if ( current.key === key ) {
        return { key: key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
    }
    return { key: key, direction: textColumn ? 'asc' : 'desc' };
}










/**
 * Returns a sorted copy of the rows.  Equal rows keep the order the tie break gives them, or their
 * old order when there is none, because the sort is stable.  Rows with a missing number go last in
 * both directions, so the comparison stays consistent.
 *
 * @param rows The rows to sort.
 * @param state The column and direction to sort by.
 * @param valueOf Reads the value of a column from a row: a string for text, a number otherwise.
 * @param tieBreak Orders rows whose sorted value is equal.
 */
export function sortRows<T>(
    rows: T[],
    state: TableSortState,
    valueOf: ( row: T, key: string ) => string | number,
    tieBreak?: ( a: T, b: T ) => number,
): T[] {
    const factor = state.direction === 'asc' ? 1 : -1;
    return rows.slice().sort( ( a, b ) => {
        const first = valueOf( a, state.key );
        const second = valueOf( b, state.key );
        const firstMissing = typeof first === 'number' && !Number.isFinite( first );
        const secondMissing = typeof second === 'number' && !Number.isFinite( second );
        if ( firstMissing || secondMissing ) {
            if ( firstMissing && secondMissing ) {
                return tieBreak === null || tieBreak === undefined ? 0 : tieBreak( a, b );
            }
            return firstMissing ? 1 : -1;
        }
        const order = typeof first === 'string' || typeof second === 'string'
            ? String( first ).localeCompare( String( second ) )
            : first - second;
        if ( order !== 0 ) {
            return order * factor;
        }
        return tieBreak === null || tieBreak === undefined ? 0 : tieBreak( a, b );
    } );
}










/**
 * Returns the aria-sort value of a column header.
 *
 * @param state The sort of the table.
 * @param key The column of the header.
 */
export function sortAriaValue( state: TableSortState, key: string ): 'ascending' | 'descending' | 'none' {
    if ( state.key !== key ) {
        return 'none';
    }
    return state.direction === 'asc' ? 'ascending' : 'descending';
}










/**
 * Returns the arrow shown in a column header: down for high to low, up for low to high, nothing
 * for a column that is not sorted.
 *
 * @param state The sort of the table.
 * @param key The column of the header.
 */
export function sortArrow( state: TableSortState, key: string ): string {
    if ( state.key !== key ) {
        return '';
    }
    return state.direction === 'asc' ? '▲' : '▼';
}










/**
 * Reads a stored sort back, using the fallback when it is missing, malformed or for a column that
 * no longer exists.
 *
 * @param value The stored value.
 * @param isKnownKey Tells whether a column key still exists.
 * @param fallback The sort to use instead.
 */
export function parseSortState( value: any, isKnownKey: ( key: string ) => boolean, fallback: TableSortState ): TableSortState {
    const key = value?.key;
    const direction = value?.direction;
    if ( typeof key !== 'string' || !isKnownKey( key ) || ( direction !== 'asc' && direction !== 'desc' ) ) {
        return { key: fallback.key, direction: fallback.direction };
    }
    return { key: key, direction: direction };
}
