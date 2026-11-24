// Checks the trigger gate (src/electron/utilities/trigger-gate.js) and its use in the log watcher.
//
//   node tools/perf/trigger-gate-check.mjs
//       Unit cases against the real log watcher, with its Electron parts stubbed.
//
//   node tools/perf/trigger-gate-check.mjs --triggers <triggers copy> --log <log copy>
//       [--characters <characters copy>]
//       Also runs the library over the log three ways (every trigger on every
//       line, the prefilter only, the gate and the prefilter) and fails if the
//       gate run matched differently from the plain run.
//       Use copies; only counts are printed, never trigger names, phrases or
//       log lines.

import { createRequire } from 'module';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'fs';
import { fileURLToPath } from 'url';
import { tmpdir } from 'os';
import path from 'path';
import Module from 'module';

const require = createRequire( import.meta.url );
const root = path.resolve( path.dirname( fileURLToPath( import.meta.url ) ), '..', '..' );
const { ActionTypes, TriggerConditionTypes, OperatorTypes } = require( path.join( root, 'src/electron/data/models/trigger.js' ) );
const { TriggerGate } = require( path.join( root, 'src/electron/utilities/trigger-gate.js' ) );
const captureZoneTrigger = JSON.parse( readFileSync( path.join( root, 'src/electron/data/predefined-triggers/capture-zone.json' ), 'utf8' ) );

let failures = 0;
let checks = 0;

/**
 * Counts one check and prints a line if it failed.
 *
 * @param {boolean} condition Whether the check passed.
 * @param {string} label What the check was about, shown on failure.
 */
function check( condition, label ) {
    checks++;
    if ( !condition ) {
        failures++;
        console.log( `FAIL: ${label}` );
    }
}










/**
 * Tells whether two values are equal when written as JSON.
 *
 * @param {any} first The first value.
 * @param {any} second The second value.
 * @returns {boolean}
 */
function same( first, second ) {
    return JSON.stringify( first ) === JSON.stringify( second );
}

// ---- A log watcher with the Electron parts stubbed ----

// The log watcher reads the clock for counter resets and cooldowns, so the
// check controls it to make those repeatable.
let fakeNow = Date.now();
const RealDate = Date;
globalThis.Date = class extends RealDate {

    /**
     * Creates a date; with no arguments it is the fake current time.
     *
     * @param {...any} args The arguments of the Date constructor.
     */
    constructor( ...args ) {
        if ( args.length === 0 ) {
            super( fakeNow );
        } else {
            super( ...args );
        }
    }










    /**
     * Returns the fake current time.
     *
     * @returns {number}
     */
    static now() {
        return fakeNow;
    }
};










/** The watcher that currently receives the IPC traffic. */
let current = null;
const ipcRenderer = {
    invoke: async () => ( {} ),
    on: ( channel, handler ) => {
        current.handlers[ channel ] = handler;
    },
    once: ( channel, handler ) => {
        current.once[ channel ] = handler;
    },
    send: ( channel, ...args ) => {
        if ( channel === 'cache:retrieve' ) {
            const key = `cache:retrieve:${args[ 0 ]}`;
            const fn = current.once[ key ];
            delete current.once[ key ];
            fn?.( {}, null );
        } else if ( channel === 'console:message' ) {
            current.console.push( args[ 0 ]?.message ?? args[ 0 ] );
        }
    },
};
globalThis.window = { onerror: null, setTimeout: setTimeout, clearTimeout: clearTimeout };
globalThis.speechSynthesis = { getVoices: () => [], onvoiceschanged: null, speak() { }, cancel() { } };
globalThis.SpeechSynthesisUtterance = function () { };
globalThis.document = { createElement: () => ( {} ) };

const originalLoad = Module._load;
Module._load = function ( request ) {
    if ( request === 'electron' ) {
        return { ipcRenderer: ipcRenderer, remote: {}, app: {}, shell: {} };
    }
    return originalLoad.apply( this, arguments );
};
process.emitWarning = () => { };

const watcherPath = path.join( root, 'src/electron/threads/log-watcher.js' );
const watcherSource = readFileSync( watcherPath, 'utf8' ) + `
module.exports.__test = {
    parseLogEntries, backfind, saveVariable,
    get activeTriggers() { return activeTriggers; },
    get triggerGate() { return triggerGate; },
    get triggerPrefilter() { return triggerPrefilter; },
    get storedVariables() { return storedVariables; },
    get counters() { return counters; },
    flushTriggerGate,
};
`;

const timestamp = () => {
    const d = new RealDate( fakeNow );
    const p = n => `${n}`.padStart( 2, '0' );
    return `[${[ 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat' ][ d.getDay() ]} ${[ 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec' ][ d.getMonth() ]} ${p( d.getDate() )} ${p( d.getHours() )}:${p( d.getMinutes() )}:${p( d.getSeconds() )} ${d.getFullYear()}]`;
};










/**
 * Loads a fresh copy of the log watcher.
 *
 * @param {object} options What to load: triggers (required), and optionally folders,
 *     characterClass, disabled (trigger ids), env (environment variables set while
 *     loading) and logFile.
 * @returns {object} The watcher, with its internals and the helpers feed, batch, tick and matched.
 */
function createWatcher( options ) {
    const savedEnv = {};
    Object.keys( options.env ?? {} ).forEach( key => {
        savedEnv[ key ] = process.env[ key ];
        process.env[ key ] = options.env[ key ];
    } );

    const watcher = { handlers: {}, once: {}, console: [], matches: [], runs: 0, line: 0 };
    current = watcher;

    const filename = watcherPath;
    const watcherModule = new Module( filename, null );
    watcherModule.filename = filename;
    watcherModule.paths = Module._nodeModulePaths( path.dirname( filename ) );
    watcherModule._compile( watcherSource, filename );

    Object.keys( options.env ?? {} ).forEach( key => {
        if ( savedEnv[ key ] === undefined ) {
            delete process.env[ key ];
        } else {
            process.env[ key ] = savedEnv[ key ];
        }
    } );

    const character = { name: 'Soandso', characterId: 'char1', class: options.characterClass ?? '', logFile: options.logFile ?? 'none.txt', disabledTriggers: [] };
    watcherModule.exports( character, 0 );
    watcher.internals = watcherModule.exports.__test;
    watcher.character = character;

    watcher.tick = () => {
        current = watcher;
        watcher.handlers.tick( {}, {
            triggers: JSON.parse( JSON.stringify( options.triggers ) ),
            folders: options.folders ?? [],
            overlays: [], enableFct: false, isDev: false, phoneticTransforms: [],
            characterModel: character,
            characterDisabledTriggers: [ { characterId: 'char1', disabledTriggers: options.disabled ?? [] } ],
            quickShareAuthorsList: [],
        } );

        // Count the runs and record the matches.
        watcher.internals.activeTriggers.forEach( trigger => {
            const original = trigger._parse;
            if ( typeof original === 'function' && !original.wrapped ) {
                const wrapped = ( value, onMatch ) => {
                    watcher.runs++;
                    return original( value, ( res, delta ) => {
                        watcher.matches.push( `${watcher.line}|${trigger.name}|${res.phraseId}` );
                        onMatch( res, delta );
                    } );
                };
                wrapped.wrapped = true;
                trigger._parse = wrapped;
            }
        } );
    };










    /**
     * Feeds a log line without flushing the gate, like a line in the middle of a batch.
     *
     * @param {string} text The log line, without a timestamp.
     */
    watcher.feed = text => {
        current = watcher;
        watcher.line++;
        watcher.internals.parseLogEntries( `${timestamp()} ${text}` );
    };










    /**
     * Feeds the lines as one batch.
     *
     * @param {string[]} lines The log lines, without timestamps.
     */
    watcher.batch = lines => {
        lines.forEach( watcher.feed );
        watcher.internals.flushTriggerGate();
    };

    watcher.matched = name => watcher.matches.filter( x => x.split( '|' )[ 1 ] === name ).length;

    return watcher;
}

let idCounter = 0;
const nextId = () => `id${++idCounter}`;

/**
 * Makes a capture phrase.
 *
 * @param {string} text The phrase.
 * @param {boolean} useRegEx Whether the phrase is a regular expression.
 * @returns {object}
 */
function phrase( text, useRegEx = true ) {
    return { phraseId: nextId(), phrase: text, useRegEx: useRegEx, ignoreCase: false, requirePreviousPhrase: false, duration: null };
}










/**
 * Makes a trigger with the given phrases, actions and conditions.
 *
 * @param {string} name The trigger name.
 * @param {(string|object)[]} phrases The phrases, as text or made with phrase().
 * @param {object} options Optional captureMethod, actions, conditions, classLevels and folderId.
 * @returns {object}
 */
function makeTrigger( name, phrases, options = {} ) {
    const capturePhrases = phrases.map( p => typeof p === 'string' ? phrase( p ) : p );
    return {
        triggerId: nextId(), name: name, enabled: true, captureMethod: options.captureMethod ?? 'Any match',
        capturePhrases: capturePhrases,
        actions: ( options.actions ?? [] ).map( action => ( {
            actionId: nextId(),
            phrases: capturePhrases.map( capturePhrase => capturePhrase.phraseId ),
            onlyExecuteInDev: false,
            ...action,
        } ) ),
        conditions: options.conditions ?? [], classLevels: options.classLevels ?? [],
        onlyExecuteInDev: false, folderId: options.folderId ?? null, cooldownDuration: 0, useCooldown: false,
        sequentialRestartBehavior: 0,
    };
}

const variableIs = ( variableName, variableValue, operatorType = OperatorTypes.Equals ) => ( {
    conditionType: TriggerConditionTypes.VariableValue,
    operatorType: operatorType,
    variableName: variableName,
    variableValue: variableValue,
} );
const counterIs = ( variableName, variableValue, operatorType ) => ( {
    conditionType: TriggerConditionTypes.CounterValue,
    operatorType: operatorType,
    variableName: variableName,
    variableValue: variableValue,
} );
const storeAction = variableName => ( { actionType: ActionTypes.StoreVariable, variableName: variableName } );
const clearAction = variableName => ( { actionType: ActionTypes.ClearVariable, variableName: variableName } );
const counterAction = ( name, resetSeconds, resetPhrases ) => ( {
    actionType: ActionTypes.Counter,
    displayText: name,
    duration: resetSeconds,
    resetCounterPhrases: resetPhrases ?? [],
} );

// ---- Unit cases ----

// Zone change re-gates, and the trigger gated out by the zone is not run at all.
{
    const folder = { folderId: 'folderA', name: 'Zone folder', folderConditions: [ variableIs( 'CurrentZone', 'Some Zone' ) ], children: [] };
    const watcher = createWatcher( {
        triggers: [
            makeTrigger( 'In zone', [ 'a gnoll hits you' ], { folderId: 'folderA' } ),
            makeTrigger( 'Anywhere', [ 'a gnoll misses you' ] ),
            captureZoneTrigger,
        ],
        folders: [ folder ],
    } );
    watcher.tick();
    const gate = watcher.internals.triggerGate;
    check( gate && gate.openCount === 2, 'zone gate: only the triggers without a zone condition are open at the start' );
    check( !watcher.console.some( x => typeof x === 'string' && x.startsWith( 'Triggers active' ) ), 'zone gate: no console line before a zone change' );

    watcher.batch( [ 'a gnoll hits you', 'a gnoll misses you' ] );
    check( watcher.matched( 'In zone' ) === 0 && watcher.matched( 'Anywhere' ) === 1, 'zone gate: closed trigger does not match' );
    check( watcher.runs === 1, 'zone gate: closed trigger is not run' );

    watcher.batch( [ 'You have entered Some Zone.' ] );
    check( same( watcher.internals.storedVariables.CurrentZone, [ 'Some Zone' ] ), 'zone gate: native zone capture stores the zone' );
    check( gate.openCount === 3, 'zone gate: entering the zone opens the trigger' );
    check( watcher.console.some( x => x === 'Triggers active in this zone: 3 of 3' ), 'zone gate: console line after the zone changed' );
    watcher.batch( [ 'a gnoll hits you' ] );
    check( watcher.matched( 'In zone' ) === 1, 'zone gate: trigger matches in the zone' );

    watcher.batch( [ 'You have entered Other Zone.' ] );
    check( same( watcher.internals.storedVariables.CurrentZone, [ 'Other Zone' ] ), 'zone gate: a new zone replaces the old one' );
    check( gate.openCount === 2, 'zone gate: leaving the zone closes the trigger' );
    const runsBefore = watcher.runs;
    watcher.batch( [ 'a gnoll hits you' ] );
    check( watcher.matched( 'In zone' ) === 1 && watcher.runs === runsBefore, 'zone gate: closed again, not run' );
}

// The zone line in the console is repeated on every zone change, but not on other variable changes.
{
    const folder = { folderId: 'folderD', name: 'Zone folder', folderConditions: [ variableIs( 'CurrentZone', 'Some Zone|Other Zone' ) ], children: [] };
    const watcher = createWatcher( {
        triggers: [ makeTrigger( 'In zone', [ '^a gnoll hits you$' ], { folderId: 'folderD' } ), makeTrigger( 'Setter', [ '^Set flag (\\w+)$' ], { actions: [ storeAction( 'Flag' ) ] } ), captureZoneTrigger ],
        folders: [ folder ],
    } );
    watcher.tick();
    const lines = () => watcher.console.filter( x => typeof x === 'string' && x.startsWith( 'Triggers active' ) ).length;
    watcher.batch( [ 'You have entered Some Zone.' ] );
    const afterFirst = lines();
    watcher.batch( [ 'You have entered Other Zone.' ] );
    check( lines() === afterFirst + 1, 'console: printed again when the zone changed and the count did not' );
    watcher.batch( [ 'Set flag on', 'Set flag on' ] );
    check( lines() === afterFirst + 1, 'console: not printed for other variable changes' );
}

// The built-in Capture Zone trigger and the native capture don't store the zone twice.
{
    const watcher = createWatcher( { triggers: [ captureZoneTrigger ] } );
    watcher.tick();
    watcher.batch( [ 'LOADING, PLEASE WAIT...', 'You have entered Some Zone.' ] );
    check( same( watcher.internals.storedVariables.CurrentZone, [ 'Some Zone' ] ), 'capture zone: one value with the built-in trigger enabled' );
    watcher.batch( [ 'LOADING, PLEASE WAIT...', 'You have entered Other Zone.' ] );
    check( same( watcher.internals.storedVariables.CurrentZone, [ 'Other Zone' ] ), 'capture zone: second zone, one value' );
    watcher.batch( [ 'You have entered the Drunken Monkey stance.' ] );
    check( same( watcher.internals.storedVariables.CurrentZone, [ 'Other Zone' ] ) || watcher.internals.storedVariables.CurrentZone[ 0 ] === 'the Drunken Monkey stance', 'capture zone: stance line handled like the built-in trigger does' );

    const off = createWatcher( { triggers: [ captureZoneTrigger ], disabled: [ captureZoneTrigger.triggerId ] } );
    off.tick();
    off.batch( [ 'You have entered Some Zone.' ] );
    check( off.internals.storedVariables.CurrentZone === undefined, 'capture zone: nothing stored with the trigger disabled' );
}

// The loading line and the zone line in separate batches print one console line per zone change.
{
    const folder = { folderId: 'folderF', name: 'Zone folder', folderConditions: [ variableIs( 'CurrentZone', 'Some Zone|Other Zone' ) ], children: [] };
    const watcher = createWatcher( {
        triggers: [ makeTrigger( 'In zone', [ '^a gnoll hits you$' ], { folderId: 'folderF' } ), captureZoneTrigger ],
        folders: [ folder ],
    } );
    watcher.tick();
    const lines = () => watcher.console.filter( x => typeof x === 'string' && x.startsWith( 'Triggers active' ) ).length;
    watcher.batch( [ 'LOADING, PLEASE WAIT...' ] );
    watcher.batch( [ 'You have entered Some Zone.' ] );
    check( lines() === 1, 'console: one line for a zone change split over two batches' );
    watcher.batch( [ 'LOADING, PLEASE WAIT...' ] );
    watcher.batch( [ 'You have entered Other Zone.' ] );
    check( lines() === 2, 'console: one more line for the next zone change' );
}

// Capture Zone off: the gate leaves CurrentZone alone, so zone conditions stay closed.
{
    const folder = { folderId: 'folderE', name: 'Zone folder', folderConditions: [ variableIs( 'CurrentZone', 'Some Zone' ) ], children: [] };
    const watcher = createWatcher( {
        triggers: [ makeTrigger( 'In zone', [ '^a gnoll hits you$' ], { folderId: 'folderE' } ), makeTrigger( 'Anywhere', [ '^a gnoll misses you$' ] ) ],
        folders: [ folder ],
    } );
    watcher.tick();
    watcher.batch( [ 'LOADING, PLEASE WAIT...', 'You have entered Some Zone.', 'a gnoll hits you', 'a gnoll misses you' ] );
    check( watcher.internals.storedVariables.CurrentZone === undefined, 'capture zone off: CurrentZone untouched' );
    check( watcher.matched( 'In zone' ) === 0 && watcher.matched( 'Anywhere' ) === 1, 'capture zone off: zone condition stays closed' );
    check( !watcher.console.some( x => typeof x === 'string' && x.startsWith( 'Triggers active' ) ), 'capture zone off: no zone change, no console line' );

    const stored = createWatcher( { triggers: [ makeTrigger( 'Anywhere', [ '^a gnoll misses you$' ] ) ] } );
    stored.tick();
    stored.internals.storedVariables.CurrentZone = [ 'Kept Zone' ];
    stored.batch( [ 'You have entered Some Zone.' ] );
    check( same( stored.internals.storedVariables.CurrentZone, [ 'Kept Zone' ] ), 'capture zone off: an existing value is not replaced' );
}

// A variable set and used in the same batch: the trigger that opened mid-batch is not missed.
{
    const watcher = createWatcher( {
        triggers: [
            makeTrigger( 'Setter', [ '^Set flag (\\w+)$' ], { actions: [ storeAction( 'Flag' ) ] } ),
            makeTrigger( 'Clearer', [ '^Clear flag$' ], { actions: [ clearAction( 'Flag' ) ] } ),
            makeTrigger( 'User', [ '^Use the flag$' ], { conditions: [ variableIs( 'Flag', 'on' ) ] } ),
        ],
    } );
    watcher.tick();
    check( watcher.internals.triggerGate.openCount === 2, 'same batch: the conditional trigger starts closed' );
    watcher.batch( [ 'Use the flag', 'Set flag on', 'Use the flag', 'Use the flag' ] );
    check( watcher.matched( 'User' ) === 2, 'same batch: matches after the variable was set earlier in the batch' );
    check( watcher.internals.triggerGate.openCount === 3, 'same batch: gate open after the batch' );
    watcher.batch( [ 'Clear flag', 'Use the flag' ] );
    check( watcher.matched( 'User' ) === 2, 'same batch: no match after the variable was cleared in the same batch' );
    check( watcher.internals.triggerGate.openCount === 2, 'same batch: gate closed again' );

    watcher.feed( 'Set flag on' );
    watcher.feed( 'Clear flag' );
    watcher.feed( 'Set flag on' );
    watcher.feed( 'Use the flag' );
    watcher.internals.flushTriggerGate();
    check( watcher.matched( 'User' ) === 3, 'same batch: set, clear and set again inside one batch' );
}

// A sequential trigger in the middle of a sequence is never gated out.
{
    const watcher = createWatcher( {
        triggers: [
            makeTrigger( 'Sequence', [ '^First step$', '^Second step$' ], { captureMethod: 'Sequential', conditions: [ variableIs( 'Flag', 'on' ) ] } ),
            makeTrigger( 'Setter', [ '^Set flag (\\w+)$' ], { actions: [ storeAction( 'Flag' ) ] } ),
            makeTrigger( 'Clearer', [ '^Clear flag$' ], { actions: [ clearAction( 'Flag' ) ] } ),
        ],
    } );
    watcher.tick();
    const sequence = watcher.internals.activeTriggers.find( t => t.name === 'Sequence' );
    const sequenceIndex = watcher.internals.activeTriggers.indexOf( sequence );
    watcher.batch( [ 'Set flag on', 'First step' ] );
    check( sequence._hasSequence(), 'sequence: a sequence is in progress' );
    watcher.batch( [ 'Clear flag' ] );
    check( watcher.internals.triggerGate.open[ sequenceIndex ] === 0 && sequence._hasSequence(), 'sequence: the gate closed for the trigger mid-sequence' );
    const runsBefore = watcher.runs;
    watcher.batch( [ 'something else' ] );
    check( watcher.runs > runsBefore, 'sequence: still run while the sequence is in progress' );
    check( !sequence._hasSequence(), 'sequence: the failed condition reset the sequence, as without the gate' );
    const runsAfter = watcher.runs;
    watcher.batch( [ 'something else' ] );
    check( watcher.runs === runsAfter, 'sequence: not run once the sequence is over' );

    watcher.batch( [ 'Set flag on', 'First step', 'Second step' ] );
    check( watcher.matched( 'Sequence' ) === 3, 'sequence: runs through when the gate is open' );
}

// Counter conditions.
{
    const watcher = createWatcher( {
        triggers: [
            makeTrigger( 'Hit counter', [ '^You hit it$' ], { actions: [ counterAction( 'Hits', 30, [ phrase( '^Reset hits$' ) ] ) ] } ),
            makeTrigger( 'After two', [ '^Check hits$' ], { conditions: [ counterIs( 'Hits', '2', OperatorTypes.GreaterThan ) ] } ),
            makeTrigger( 'No hits', [ '^Check none$' ], { conditions: [ counterIs( 'Hits', '0', OperatorTypes.Equals ) ] } ),
        ],
    } );
    watcher.tick();
    const gate = watcher.internals.triggerGate;
    const open = name => gate.open[ watcher.internals.activeTriggers.findIndex( t => t.name === name ) ] === 1;
    check( !open( 'After two' ) && open( 'No hits' ), 'counter: gate at counter 0' );
    watcher.batch( [ 'You hit it', 'You hit it' ] );
    check( !open( 'After two' ) && !open( 'No hits' ), 'counter: gate at counter 2' );
    watcher.batch( [ 'You hit it', 'Check hits', 'Check none' ] );
    check( open( 'After two' ) && watcher.matched( 'After two' ) === 1 && watcher.matched( 'No hits' ) === 0, 'counter: opens at 3 and matches' );
    watcher.batch( [ 'Reset hits', 'Check hits', 'Check none' ] );
    check( !open( 'After two' ) && open( 'No hits' ) && watcher.matched( 'After two' ) === 1 && watcher.matched( 'No hits' ) === 1, 'counter: reset phrase re-gates' );
    watcher.batch( [ 'You hit it', 'You hit it', 'You hit it' ] );
    check( open( 'After two' ), 'counter: open again' );
    fakeNow += 60000;
    watcher.batch( [ 'Check hits' ] );
    check( !open( 'After two' ) && open( 'No hits' ) && watcher.matched( 'After two' ) === 1, 'counter: timed reset re-gates' );
}

// Loop-back at the start: values found before the first line opens triggers.
{
    const dir = mkdtempSync( path.join( tmpdir(), 'gate-check-' ) );
    const logFile = path.join( dir, 'eqlog_Soandso_test.txt' );
    const lines = [];
    for ( let i = 0; i < 20; i++ ) {
        lines.push( `${timestamp()} a gnoll hits you for ${i} points of damage.` );
    }
    lines.splice( 5, 0, `${timestamp()} LOADING, PLEASE WAIT...`, `${timestamp()} You have entered Some Zone.` );
    writeFileSync( logFile, lines.join( '\r\n' ) + '\r\n' );

    try {
        const folder = { folderId: 'folderB', name: 'Zone folder', folderConditions: [ variableIs( 'CurrentZone', 'Some Zone' ) ], children: [] };
        const watcher = createWatcher( {
            triggers: [ captureZoneTrigger, makeTrigger( 'In zone', [ '^a gnoll hits you' ], { folderId: 'folderB' } ) ],
            folders: [ folder ], logFile: logFile,
        } );
        watcher.tick();
        check( watcher.internals.triggerGate.openCount === 1, 'loop-back: closed before the log is searched' );
        await watcher.internals.backfind();
        check( same( watcher.internals.storedVariables.CurrentZone, [ 'Some Zone' ] ), 'loop-back: zone found in the log' );
        check( watcher.internals.triggerGate.openCount === 2, 'loop-back: gate open for the first line' );
        watcher.feed( 'a gnoll hits you for 3 points of damage.' );
        check( watcher.matched( 'In zone' ) === 1, 'loop-back: first line matches' );
    } finally {
        rmSync( dir, { recursive: true, force: true } );
    }
}

// Class gate.
{
    const triggers = [ makeTrigger( 'Wizard only', [ '^Cast now$' ], { classLevels: [ { class: 'Wizard', minLevel: 1, maxLevel: 65 } ] } ), makeTrigger( 'Anyone', [ '^Cast now$' ] ) ];
    const wizard = createWatcher( { triggers: triggers, characterClass: 'Wizard' } );
    wizard.tick();
    const cleric = createWatcher( { triggers: triggers, characterClass: 'Cleric' } );
    cleric.tick();
    check( wizard.internals.triggerGate.openCount === 2 && cleric.internals.triggerGate.openCount === 1, 'class: gate follows the character class' );
    wizard.batch( [ 'Cast now' ] );
    cleric.batch( [ 'Cast now' ] );
    check( wizard.matches.length === 2 && cleric.matches.length === 1, 'class: matches follow the character class' );
}

// Kill switch.
{
    const folder = { folderId: 'folderC', name: 'Zone folder', folderConditions: [ variableIs( 'CurrentZone', 'Some Zone' ) ], children: [] };
    const triggers = [ captureZoneTrigger, makeTrigger( 'In zone', [ '^a gnoll hits you$' ], { folderId: 'folderC' } ), makeTrigger( 'Other', [ '^a gnoll misses you$' ] ) ];
    const off = createWatcher( { triggers: triggers, folders: [ folder ], env: { NAG_NO_TRIGGER_GATE: '1' } } );
    off.tick();
    check( off.internals.triggerGate === null, 'kill switch: no gate' );
    check( !off.console.some( x => typeof x === 'string' && x.startsWith( 'Triggers active' ) ), 'kill switch: no console line' );
    off.batch( [ 'a gnoll hits you', 'You have entered Some Zone.', 'a gnoll hits you', 'a gnoll misses you' ] );
    check( off.matched( 'In zone' ) === 1 && off.matched( 'Other' ) === 1, 'kill switch: matches as before' );
    check( off.runs >= 3, 'kill switch: variable-conditioned trigger runs on every line again' );

    const noCapture = createWatcher( { triggers: [ makeTrigger( 'Other', [ '^a gnoll misses you$' ] ) ], env: { NAG_NO_TRIGGER_GATE: '1' } } );
    noCapture.tick();
    noCapture.batch( [ 'You have entered Some Zone.' ] );
    check( noCapture.internals.storedVariables.CurrentZone === undefined, 'kill switch: no native zone capture' );

    const on = createWatcher( { triggers: triggers, folders: [ folder ] } );
    on.tick();
    on.batch( [ 'a gnoll hits you', 'You have entered Some Zone.', 'a gnoll hits you', 'a gnoll misses you' ] );
    check( same( on.matches.map( x => x.split( '|' ).slice( 1 ).join( '|' ) ), off.matches.map( x => x.split( '|' ).slice( 1 ).join( '|' ) ) ), 'kill switch: same matches with and without the gate' );
}

// A trigger that never got a parse function is gated out instead of throwing.
{
    const broken = makeTrigger( 'No phrases', [] );
    const watcher = createWatcher( { triggers: [ broken, makeTrigger( 'Fine', [ '^Hello there$' ] ) ] } );
    watcher.tick();
    watcher.batch( [ 'Hello there' ] );
    check( watcher.matched( 'Fine' ) === 1, 'no parse function: later triggers still run' );
}

// An own condition and an inherited folder condition on the same variable
// both count, and values are trimmed.
{
    const folder = { folderId: 'folderE', name: 'Mode folder', folderConditions: [ variableIs( 'Mode', 'a' ) ], children: [] };
    const watcher = createWatcher( {
        triggers: [
            makeTrigger( 'Both', [ '^Go now$' ], { folderId: 'folderE', conditions: [ variableIs( 'Mode', ' b | c ' ) ] } ),
            makeTrigger( 'Setter', [ '^Set mode (\\w+)$' ], { actions: [ storeAction( 'Mode' ) ] } ),
        ],
        folders: [ folder ],
    } );
    watcher.tick();
    const both = () => watcher.internals.triggerGate.open[ watcher.internals.activeTriggers.findIndex( t => t.name === 'Both' ) ] === 1;
    watcher.batch( [ 'Set mode a' ] );
    check( !both(), 'same variable: the folder condition alone is not enough' );
    watcher.batch( [ 'Set mode c' ] );
    check( both(), 'same variable: both conditions met, alternatives trimmed' );
    watcher.batch( [ 'Go now' ] );
    check( watcher.matched( 'Both' ) === 1, 'same variable: matches' );
}

// The gate decides like the trigger's own condition check, for random states.
{
    const names = [ 'VarA', 'VarB', 'VarC' ];
    // The high bits are used: the low bits of this generator repeat with a
    // short period, which left some condition and state combinations untested.
    let seed = 12345;
    const random = limit => {
        seed = ( seed * 1103515245 + 12345 ) & 0x7fffffff;
        return Math.floor( seed / 0x80000000 * limit );
    };
    const operators = [ OperatorTypes.Equals, OperatorTypes.IsNull, OperatorTypes.DoesNotEqual, OperatorTypes.Contains ];
    const counterOperators = [ OperatorTypes.Equals, OperatorTypes.GreaterThan, OperatorTypes.LessThan, OperatorTypes.DoesNotEqual ];

    const makeCondition = () => {
        if ( random( 3 ) === 0 ) {
            return counterIs( `Count${random( 2 )}`, [ '', '0', '1', '3', null ][ random( 5 ) ], counterOperators[ random( 4 ) ] );
        }
        return variableIs( names[ random( 3 ) ], [ '', 'one', 'two', 'o', 'one|two', null, ' one | two ', 'one|', '|', ' ' ][ random( 10 ) ], operators[ random( 4 ) ] );
    };

    const triggers = [];
    for ( let i = 0; i < 60; i++ ) {
        const conditions = [];
        for ( let c = random( 4 ); c > 0; c-- ) {
            conditions.push( makeCondition() );
        }
        triggers.push( makeTrigger( `Random ${i}`, [ '^Random line$' ], { conditions: conditions, actions: i < 2 ? [ counterAction( 'Count0', 30 ), counterAction( 'Count1', 30 ) ] : [] } ) );
    }

    const watcher = createWatcher( { triggers: triggers } );
    watcher.tick();
    const t = watcher.internals;
    let mismatches = 0;
    for ( let round = 0; round < 300; round++ ) {
        names.forEach( name => {
            t.storedVariables[ name ] = Array.from( { length: random( 3 ) }, () => [ 'one', 'two', 'three', 'one two' ][ random( 4 ) ] );
        } );
        Object.keys( t.counters ).forEach( key => {
            t.counters[ key ].value = random( 5 ) - 1 < 0 ? 0 : random( 5 );
        } );
        t.triggerGate.allChanged();
        t.activeTriggers.forEach( ( trigger, index ) => {
            if ( ( t.triggerGate.open[ index ] === 1 ) !== ( trigger._checkConditions() === true ) ) {
                mismatches++;
            }
        } );
    }
    check( mismatches === 0, `gate versus the trigger's own condition check: ${mismatches} differences` );

    // One variable at a time, as the log watcher re-gates them.
    mismatches = 0;
    for ( let round = 0; round < 300; round++ ) {
        const name = names[ random( 3 ) ];
        t.storedVariables[ name ] = Array.from( { length: random( 3 ) }, () => [ 'one', 'two', 'three', 'one two' ][ random( 4 ) ] );
        t.triggerGate.variableChanged( name );
        t.activeTriggers.forEach( ( trigger, index ) => {
            if ( ( t.triggerGate.open[ index ] === 1 ) !== ( trigger._checkConditions() === true ) ) {
                mismatches++;
            }
        } );
    }
    check( mismatches === 0, `incremental re-gate versus the trigger's own condition check: ${mismatches} differences` );
}

console.log( `${checks - failures} of ${checks} checks passed.` );

// ---- Library mode ----

/**
 * Returns the value after a command line option, or null if it isn't given.
 *
 * @param {string} name The option, such as --log.
 * @returns {string|null}
 */
function argument( name ) {
    const index = process.argv.indexOf( name );
    return index > -1 ? process.argv[ index + 1 ] : null;
}

const triggersFile = argument( '--triggers' );
const logFile = argument( '--log' );

if ( triggersFile && logFile ) {
    const charactersFile = argument( '--characters' );
    const db = JSON.parse( readFileSync( triggersFile, 'utf8' ) );
    let characterClass = '';
    let disabled = [];
    if ( charactersFile ) {
        const characters = JSON.parse( readFileSync( charactersFile, 'utf8' ) ).characters ?? [];
        const withClass = characters.find( c => c.class ) ?? characters[ 0 ];
        characterClass = withClass?.class ?? '';
        disabled = withClass?.disabledTriggers ?? [];
    }

    const lines = readFileSync( logFile, 'latin1' ).split( /\r?\n/ ).filter( l => l.length > 0 );
    const timestampRegex = /^\[(\w{3} \w{3} \d{2} \d{2}:\d{2}:\d{2} \d{4})\]/;
    const batchSize = 25;

    const run = ( label, env ) => {
        const watcher = createWatcher( {
            triggers: db.triggers,
            folders: db.folders,
            characterClass: characterClass,
            disabled: disabled,
            env: env,
        } );
        watcher.tick();
        const started = process.hrtime.bigint();
        let inBatch = 0;
        lines.forEach( raw => {
            const ts = timestampRegex.exec( raw );
            if ( ts ) {
                fakeNow = RealDate.parse( ts[ 1 ] );
            }
            watcher.line++;
            watcher.internals.parseLogEntries( raw );
            if ( ++inBatch >= batchSize ) {
                inBatch = 0;
                watcher.internals.flushTriggerGate();
            }
        } );
        watcher.internals.flushTriggerGate();
        const ms = Number( process.hrtime.bigint() - started ) / 1e6;
        console.log( `${label}: ${watcher.internals.activeTriggers.length} enabled, ${( watcher.runs / lines.length ).toFixed( 1 )} runs per line, ${( ms / lines.length ).toFixed( 4 )} ms per line, ${watcher.matches.length} matches` );
        return [ ...watcher.matches ].sort();
    };

    console.log( `Library: ${db.triggers.length} triggers, ${lines.length} lines.` );
    const plain = run( 'plain', { NAG_NO_TRIGGER_PREFILTER: '1', NAG_NO_TRIGGER_GATE: '1' } );
    run( 'prefilter only', { NAG_NO_TRIGGER_GATE: '1' } );
    const gated = run( 'gate and prefilter', {} );

    let differences = 0;
    const remaining = new Map();
    plain.forEach( x => remaining.set( x, ( remaining.get( x ) ?? 0 ) + 1 ) );
    gated.forEach( x => {
        const count = remaining.get( x );
        if ( count ) {
            remaining.set( x, count - 1 );
        } else {
            differences++;
        }
    } );
    remaining.forEach( count => {
        differences += count;
    } );
    check( differences === 0, `library: ${differences} differences between the plain and gated matches` );
    console.log( `Library: ${differences} differences.` );
}

if ( failures > 0 ) {
    console.log( `${failures} failure(s).` );
    process.exit( 1 );
}

process.exit( 0 );
