const { ipcRenderer } = require( "electron" );
const { TriggerParseHistoryModel, getActionLabel, TriggerAction, LogTypes, Trigger } = require( "../data/models/trigger" );
const { nagId } = require( "./nag-id" );
const { LogTrigger, PhraseParse } = require( "../threads/log.model" );
const hasher = require( 'crypto' ).createHash;

const batchTriggerParseHistoryTimeoutDuration = 100;

class LogHistoryManager {

    /** @type {TriggerParseHistoryModel[]} */
    successfulParses = [];
    /** @type {TriggerParseHistoryModel[]} */
    failedParses = [];
    /** @type {TriggerParseHistoryModel[]} */
    exceptionParses = [];
    /** @type {number} */
    batchTriggerParseHistoryTimeoutId = null;
    /** @type {string[]} */
    errorHashes = [];

    #counters = () => { };
    get counters() {
        return this.#counters();
    }

    #storedVariables = () => { };
    get storedVariables() {
        return this.#storedVariables();
    }

    #triggers = () => [];
    get triggers() {
        return this.#triggers();
    }

    /**
     * 
     * @param {string} characterId The character id.
     * @param {string} characterName The character name.
     * @param {() => Record<string, {value: number, lastUpdate: Date, resetDelay: number, _parse: (logEntry: string) => boolean}>} getCounters The counters for the character.
     * @param {() => Record<string, string[]>} getStoredVariables The stored variables for the character.
     * @param {() => LogTrigger[]} getTriggers The triggers for the character.
     */
    constructor(
        characterId,
        characterName,
        getCounters,
        getStoredVariables,
        getTriggers,
    ) {
        this.#counters = getCounters;
        this.#storedVariables = getStoredVariables;
        this.#triggers = getTriggers;
    }









    
    /**
     * Sends the error information to the main thread for logging.
     * 
     * @param {any} err The error object.
     * @param {string} raw The log entry currently processing.
     * @param {boolean} simulating True if we're simulating a log file.
     * @param {number} padTime The number of seconds to add to log time.
     * @param {string} errorDesc An error description to send to the debug console for the user.
     * @param {LogTrigger|undefined|null} trigger The trigger that caused the error.
     * @param {TriggerAction|undefined|null} action The trigger that caused the error.
     * @param {'End Early' | 'Trigger Action' | 'Exclude Target' | 'Trigger Secondary Action'} parseType The type of parse.
     * @param {string} renderedPhrase The rendered phrase.
     * @param {string} unrenderedPhrase The unrendered phrase.
     */
    logParseError( err, raw, simulating, padTime, errorDesc, trigger, action, parseType, renderedPhrase, unrenderedPhrase ) {
        
        let eid = ( trigger?.triggerId ?? '' ) + ( action?.actionId ?? '' ) + ( errorDesc ?? '' ) + ( errorDesc ? err ?? '' : '' ) + ( parseType ?? '' );
        let hash = hasher( 'sha1' ).update( eid ).digest( 'base64' );
        if ( this.errorHashes.includes( hash ) ) {
            return;
        } else {
            this.errorHashes.push( hash );
        }

        if ( raw ) {
            ipcRenderer.send( 'app:log:exception', {
                source: 'log-watcher.js',
                error: err,
                logEntry: raw,
                simulating: simulating === true,
                padTime: padTime === undefined ? 'undefined' :
                    padTime === null ? 'null' :
                        padTime,
            } );
        } else {
            ipcRenderer.send( 'app:log:exception', err );
        }
    
        if ( errorDesc ) {
            
            // If there is an error description, send it to the debug console.
    
            let entry = new TriggerParseHistoryModel();
    
            entry.parseId = nagId();
            entry.timestamp = new Date();
            entry.triggerId = trigger?.triggerId;
            entry.triggerName = trigger?.name;
            entry.actionId = action ? action.actionId : null;
            entry.actionTypeLabel = action ? getActionLabel( action.actionType ) : null;
            entry.rawLogEntry = raw;
            entry.logType = LogTypes.error;
            entry.error = err + '';
            entry.errorDescription = errorDesc;
            entry.parseType = parseType;
            entry.renderedPhrase = renderedPhrase;
            entry.unrenderedPhrase = unrenderedPhrase;
            entry.conditionResults = trigger?._conditionResults;
            entry.deltaTime = trigger?._deltaTime;
            entry.phraseId = null;
            entry.regexResult = null;
            entry.dependencyRegexResult = null;
            entry.counters = JSON.parse( JSON.stringify( this.counters ?? {} ) );
            entry.storedVariables = JSON.parse( JSON.stringify( this.storedVariables ?? {} ) );
            entry.hash = hash;
    
            entry.characterId = this.characterId;
            entry.characterName = this.characterName;
    
            this.exceptionParses.push( entry );
    
        }
    }









    
    /**
     * Sends the error information to the main thread for logging.
     * 
     * @param {any} err The error object.
     * @param {string} raw The log entry currently processing.
     * @param {boolean} simulating True if we're simulating a log file.
     * @param {number} padTime The number of seconds to add to log time.
     * @param {string} errorDesc An error description to send to the debug console for the user.
     * @param {LogTrigger|undefined|null} trigger The trigger that caused the error.
     * @param {TriggerAction|undefined|null} action The trigger that caused the error.
     */
    logError( err, raw, simulating, padTime, errorDesc, trigger, action ) {
        this.logParseError( err, raw, simulating, padTime, errorDesc, trigger, action );
    };









    
    /**
     * Starts the batch trigger parse history process, sending the batch of parses to the main process.
     */
    startBatchTriggerParseHistory() {
        this.batchTriggerParseHistoryTimeoutId = window.setTimeout( () => this.#batchTriggerParseHistory(), batchTriggerParseHistoryTimeoutDuration );
    }









    
    /**
     * Sends the batch of parses to the main process, clears the batch, and sets 
     * the timeout to run again.
     */
    #batchTriggerParseHistory() {

        ipcRenderer.once( 'trigger:batch:complete', ( event, data ) => {

            // Set the timeout to run again.
            this.batchTriggerParseHistoryTimeoutId = window.setTimeout( () => this.#batchTriggerParseHistory(), batchTriggerParseHistoryTimeoutDuration );
                
        } );

        // Send the batch of parses to the main process.
        ipcRenderer.send( 'trigger:batch-history', { successful: this.successfulParses, failed: this.failedParses, exceptions: this.exceptionParses } );

        // Clear the batch.
        this.successfulParses = [];
        this.failedParses = [];
        this.exceptionParses = [];

    }









    
    /**
     * Creates a new parse history entry.
     * 
     * @returns {TriggerParseHistoryModel} Returns the parse history entry.
     * 
     * @param {string} rawLogEntry The raw log entry.
     * @param {LogTypes} logType The log entry type.
     * @param {Trigger} trigger The trigger that was triggered.
     * @param {string} actionId The id of the action that was triggered.
     * @param {'End Early' | 'Trigger Action' | 'Exclude Target' | 'Trigger Secondary Action'} parseType The type of parse.
     * @param {string} renderedPhrase The rendered phrase.
     * @param {string} unrenderedPhrase The unrendered phrase.
     * @param {PhraseParse | undefined} parsedPhrase The parsed phrase.
     * @param {Record<string, string>} conditionResults The results of the trigger condition checks.
     * @param {number | undefined} deltaTime The time in milliseconds between the sequential phrases.
     */
    #getParseHistoryEntry( rawLogEntry, logType, trigger, actionId, parseType, renderedPhrase, unrenderedPhrase, parsedPhrase, conditionResults, deltaTime ) {
        let entry = new TriggerParseHistoryModel();

        entry.parseId = nagId();
        entry.timestamp = new Date();
        entry.triggerId = trigger.triggerId;
        entry.triggerName = trigger.name;
        entry.actionId = actionId;
        entry.actionTypeLabel = getActionLabel( trigger.actions.find( a => a.actionId === actionId )?.actionType );
        entry.parseType = parseType;
        entry.renderedPhrase = renderedPhrase;
        entry.unrenderedPhrase = unrenderedPhrase;
        entry.phraseId = parsedPhrase?.phraseId;
        entry.regexResult = parsedPhrase?.result;
        entry.dependencyRegexResult = parsedPhrase?.dependencyResult;
        entry.conditionResults = conditionResults;
        entry.deltaTime = deltaTime;
        entry.counters = JSON.parse( JSON.stringify( this.counters ?? {} ) );
        entry.storedVariables = JSON.parse( JSON.stringify( this.storedVariables ?? {} ) );
        entry.characterId = this.characterId;
        entry.characterName = this.characterName;
        entry.rawLogEntry = rawLogEntry;
        entry.logType = logType;

        return entry;
    };









    
    /**
     * Adds a successful trigger parsed event to the batch.
     * 
     * @param {string} rawLogEntry The raw log entry.
     * @param {string} triggerId The id of the trigger that was triggered.
     * @param {string} actionId The id of the action that was triggered.
     * @param {'End Early' | 'Trigger Action' | 'Trigger Sequential Action' | 'Trigger Action Loopback' | 'Exclude Target' | 'Trigger Cancel Action' | 'Trigger Secondary Action' | 'Reset Counter'} parseType The type of parse.
     * @param {string} renderedPhrase The rendered phrase.
     * @param {string} unrenderedPhrase The unrendered phrase.
     * @param {PhraseParse | undefined} parsedPhrase The parsed phrase.
     * @param {Record<string, string>} conditionResults The results of the trigger condition checks.
     * @param {number | undefined} deltaTime The time in milliseconds between the sequential phrases.
     */
    addSuccessfulTriggerParsedEvent( rawLogEntry, triggerId, actionId, parseType, renderedPhrase, unrenderedPhrase, parsedPhrase, conditionResults, deltaTime ) {
        let trigger = this.triggers.find( t => t.triggerId === triggerId );
        if ( trigger ) {
            let entry = this.#getParseHistoryEntry( rawLogEntry, LogTypes.info, trigger, actionId, parseType, renderedPhrase, unrenderedPhrase, parsedPhrase, conditionResults, deltaTime );

            // Add the entry to the batch.
            this.successfulParses.push( entry );
        }
    };










}

module.exports = {
    LogHistoryManager,
};
