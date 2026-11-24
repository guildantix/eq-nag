/**
 * The damage amounts the Push tab sliders move through: 1, 2.5 and 5 for every power of ten from
 * 1K to 5B, then 10B.  The main process checks values against a copy of this list before storing
 * them (damageSteps in src/electron/data/models/push-recap.js): change both together.
 */
export const pushDamageSteps: number[] = buildDamageSteps();










/**
 * Builds the list of damage steps.
 */
function buildDamageSteps(): number[] {
    const steps: number[] = [];
    for ( let exponent = 3; exponent <= 9; exponent++ ) {
        [ 1, 2.5, 5 ].forEach( multiplier => steps.push( multiplier * Math.pow( 10, exponent ) ) );
    }
    steps.push( 1e10 );
    return steps;
}










/**
 * Returns the slider position of a damage amount, or of the closest step when it is not one.
 *
 * @param damage The damage amount.
 */
export function damageStepIndex( damage: number ): number {
    let best = 0;
    pushDamageSteps.forEach( ( step, index ) => {
        if ( Math.abs( step - damage ) < Math.abs( pushDamageSteps[ best ] - damage ) ) {
            best = index;
        }
    } );
    return best;
}










/**
 * Writes a damage step the short way, for example 1K, 2.5M or 10B.
 *
 * @param damage The damage amount.
 */
export function formatDamageStep( damage: number ): string {
    const units: { size: number, suffix: string }[] = [ { size: 1e9, suffix: 'B' }, { size: 1e6, suffix: 'M' }, { size: 1e3, suffix: 'K' } ];
    const unit = units.find( u => damage >= u.size );
    if ( unit === undefined ) {
        return String( damage );
    }
    return `${damage / unit.size}${unit.suffix}`;
}
