const { TriggerConditionTypes, OperatorTypes } = require( '../data/models/trigger' );
const StringUtilities = require( './string' );
const { parseConditionValues } = require( './condition-values' );

/**
 * @typedef {object} TriggerGateState
 * @property {Record<string, string[]>} storedVariables The stored variables.
 * @property {Record<string, {value: number}>} counters The counters.
 * @property {string|null|undefined} characterClass The class of the character.
 */










/**
 * Returns whether the stored values of the key include the value (or any of
 * the values).  The gate keeps its own copy of this check so it answers the
 * same way the log watcher does when a trigger's conditions are checked.
 *
 * @param {Record<string, string[]>} stored The stored variables.
 * @param {string} key The key of the stored variable.
 * @param {any|any[]} value The value to check.
 * @returns {{exists: boolean, value: any}}
 */
function storeHasValue( stored, key, value ) {

    if ( stored[ key ]?.length > 0 ) {
        if ( value instanceof Array ) {
            for ( let i = 0; i < value.length; i++ ) {
                const index = stored[ key ].indexOf( value[ i ] );
                if ( index > -1 ) {
                    return { exists: true, value: value[ i ] };
                }
            }
        } else {
            const index = stored[ key ].indexOf( value );
            return index > -1 ? { exists: true, value: value } : { exists: false };
        }
    }

    return { exists: false };

}










/**
 * Returns whether any stored value of the key contains the value (or any of
 * the values), ignoring case.
 *
 * @param {Record<string, string[]>} stored The stored variables.
 * @param {string} key The key of the stored variable.
 * @param {any|any[]} value The value to check.
 * @returns {{exists: boolean, value: any}}
 */
function storeContainsValue( stored, key, value ) {

    if ( stored[ key ]?.length > 0 && value?.length > 0 ) {
        if ( value instanceof Array ) {
            const lowerValues = value.map( item => item.toLowerCase() );
            for ( let i = 0; i < stored[ key ].length; i++ ) {
                for ( let v = 0; v < lowerValues.length; v++ ) {
                    if ( stored[ key ][ i ].toLowerCase().indexOf( lowerValues[ v ] ) > -1 ) {
                        return { exists: true, value: stored[ key ][ i ] };
                    }
                }
            }
        } else {
            const lowerValue = value.toLowerCase();
            for ( let i = 0; i < stored[ key ].length; i++ ) {
                if ( stored[ key ][ i ].toLowerCase().indexOf( lowerValue ) > -1 ) {
                    return { exists: true, value: stored[ key ][ i ] };
                }
            }
        }
    }

    return { exists: false };
}










/**
 * Stage 1 of trigger matching: decides which triggers can fire at all right
 * now, from what only changes between log lines (class, stored variables and
 * counters).  The log watcher only runs the open triggers.
 *
 * Conditions that depend on the log line (named group values) are not part of
 * the gate; they are still checked after a match.
 */
class TriggerGate {

    /** @type {() => TriggerGateState} */
    #getState;
    /** @type {any[]} */
    #triggers = [];
    /** @type {{condition: any, values: string[]|null}[][]} The gated conditions, per trigger. */
    #conditions = [];
    /** @type {((index: number) => void)|null} Called when a trigger opens after a state change. */
    #onOpen;
    /** @type {Map<string, number[]>} The triggers that use each stored variable. */
    #variableIndex = new Map();
    /** @type {Map<string, number[]>} The triggers that use each counter. */
    #counterIndex = new Map();

    /** @type {Uint8Array} 1 where the trigger at that index can fire. */
    open = new Uint8Array( 0 );
    /** True if any trigger opened or closed since the last acknowledge(). */
    changed = false;
    /** @type {number} How many triggers are open. */
    openCount = 0;

    /**
     * Creates a gate.  Call build() before using it.
     *
     * @param {() => TriggerGateState} getState Returns the current state to gate on.
     * @param {((index: number) => void)|null} onOpen Called with the index of each trigger
     *     that opens after build().
     */
    constructor( getState, onOpen ) {
        this.#getState = getState;
        this.#onOpen = onOpen ?? null;
    }










    /**
     * Rebuilds the dependency index and gates every trigger.  The index lets a
     * changed variable or counter re-gate only the triggers that use it.
     *
     * @param {any[]} triggers The enabled triggers of the character.
     */
    build( triggers ) {
        this.#triggers = triggers;
        this.#conditions = [];
        this.#variableIndex = new Map();
        this.#counterIndex = new Map();

        triggers.forEach( ( trigger, index ) => {
            const allConditions = [ ...( trigger.conditions ?? [] ), ...( trigger._folderConditions ?? [] ) ];

            const gatedConditions = [];
            allConditions.forEach( condition => {
                const isVariable = condition.conditionType === TriggerConditionTypes.VariableValue;
                const isCounter = condition.conditionType === TriggerConditionTypes.CounterValue;
                if ( !isVariable && !isCounter ) {
                    return;
                }

                gatedConditions.push( { condition: condition, values: parseConditionValues( condition.variableValue ) } );

                const dependencyIndex = isVariable ? this.#variableIndex : this.#counterIndex;
                const dependentTriggers = dependencyIndex.get( condition.variableName ) ?? [];
                if ( dependentTriggers[ dependentTriggers.length - 1 ] !== index ) {
                    dependentTriggers.push( index );
                }
                dependencyIndex.set( condition.variableName, dependentTriggers );
            } );

            this.#conditions.push( gatedConditions );
        } );

        this.open = new Uint8Array( triggers.length );
        this.openCount = 0;
        for ( let i = 0; i < triggers.length; i++ ) {
            this.open[ i ] = this.#evaluate( i ) ? 1 : 0;
            this.openCount += this.open[ i ];
        }
        this.changed = true;
    }










    /**
     * Re-gates the triggers that depend on the stored variable.
     *
     * @param {string} name The variable name.
     */
    variableChanged( name ) {
        this.#regate( this.#variableIndex.get( name ) );
    }










    /**
     * Re-gates the triggers that depend on the counter.
     *
     * @param {string} name The counter name.
     */
    counterChanged( name ) {
        this.#regate( this.#counterIndex.get( name ) );
    }










    /**
     * Re-gates every trigger, for when many variables or counters changed at
     * once and tracking each one isn't worth it.
     */
    allChanged() {
        for ( let i = 0; i < this.#triggers.length; i++ ) {
            this.#regateOne( i );
        }
    }










    /**
     * Marks the changes as handled.
     */
    acknowledge() {
        this.changed = false;
    }










    /**
     * Re-gates the given triggers.
     *
     * @param {number[]|undefined} indices The triggers to re-gate.
     */
    #regate( indices ) {
        if ( indices ) {
            for ( let i = 0; i < indices.length; i++ ) {
                this.#regateOne( indices[ i ] );
            }
        }
    }










    /**
     * Re-gates one trigger and reports it if it just opened, because the
     * prefilter was built without it.
     *
     * @param {number} index The trigger index.
     */
    #regateOne( index ) {
        const isOpenNow = this.#evaluate( index ) ? 1 : 0;
        if ( isOpenNow !== this.open[ index ] ) {
            this.open[ index ] = isOpenNow;
            this.openCount += isOpenNow ? 1 : -1;
            this.changed = true;
            if ( isOpenNow ) {
                this.#onOpen?.( index );
            }
        }
    }










    /**
     * Returns true if the trigger can fire with the current state.
     *
     * @param {number} index The trigger index.
     * @returns {boolean}
     */
    #evaluate( index ) {
        const trigger = this.#triggers[ index ];
        if ( typeof trigger._parse !== 'function' || trigger._passesClassCondition === false ) {
            return false;
        }

        const state = this.#getState();

        if ( !StringUtilities.isNullOrWhitespace( state.characterClass ) && trigger.classLevels?.length > 0 ) {
            const classLevels = trigger.classLevels.filter( classLevel => classLevel.class?.trim().length > 0 );
            if ( classLevels.length > 0 && !classLevels.some( classLevel => classLevel.class === state.characterClass ) ) {
                return false;
            }
        }

        const conditions = this.#conditions[ index ];
        for ( let i = 0; i < conditions.length; i++ ) {
            if ( !this.#conditionPasses( conditions[ i ].condition, conditions[ i ].values, state ) ) {
                return false;
            }
        }

        return true;
    }










    /**
     * Checks one variable or counter condition against the current state.  The
     * rules mirror the log watcher's own condition check, so the gate never
     * closes a trigger that check would let through.
     *
     * @param {any} condition The condition.
     * @param {string[]|null} values The values the condition compares against.
     * @param {TriggerGateState} state The current state.
     * @returns {boolean}
     */
    #conditionPasses( condition, values, state ) {
        const name = condition.variableName;

        if ( condition.conditionType === TriggerConditionTypes.VariableValue ) {
            const stored = state.storedVariables;

            if ( condition.operatorType === OperatorTypes.Equals ) {
                return storeHasValue( stored, name, values ).exists;

            } else if ( condition.operatorType === OperatorTypes.IsNull ) {
                return !( stored[ name ]?.length > 0 );

            } else if ( condition.operatorType === OperatorTypes.DoesNotEqual ) {
                if ( values && storeHasValue( stored, name, values ).exists ) {
                    return false;
                }

                // Explicit null and undefined checks: the stored list can be either.
                const hasNoValues = values === null || values === undefined;
                const hasNoStoredValues = stored[ name ] === null || stored[ name ] === undefined || stored[ name ]?.length === 0;
                return !( hasNoValues && hasNoStoredValues );

            } else if ( condition.operatorType === OperatorTypes.Contains ) {
                return storeContainsValue( stored, name, values ).exists;
            }

        } else if ( condition.conditionType === TriggerConditionTypes.CounterValue ) {
            const counterValue = state.counters[ name ]?.value ?? null;
            const hasConditionValue = condition.variableValue && !StringUtilities.isNullOrWhitespace( condition.variableValue );
            const conditionValue = hasConditionValue ? +condition.variableValue : null;
            const conditionNullMatch = counterValue === null && conditionValue === null;

            if ( condition.operatorType === OperatorTypes.Equals ) {
                return conditionNullMatch || counterValue - conditionValue === 0;
            } else if ( condition.operatorType === OperatorTypes.GreaterThan ) {
                return !( conditionNullMatch || counterValue - conditionValue <= 0 );
            } else if ( condition.operatorType === OperatorTypes.LessThan ) {
                return !( conditionNullMatch || conditionValue - counterValue <= 0 );
            } else if ( condition.operatorType === OperatorTypes.DoesNotEqual ) {
                return !( conditionNullMatch || counterValue - conditionValue === 0 );
            }
        }

        return true;
    }

}

module.exports = { TriggerGate, storeHasValue, storeContainsValue };
