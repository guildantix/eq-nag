const { ipcRenderer } = require( 'electron' );
const Handlebars = require( "handlebars" );
const _ = require( 'lodash' );
const { IpcMessage } = require( '../data/models/common' );
const CombatParser = require( '../utilities/combat-parser' );
const customAlphabet = require( 'nanoid' ).customAlphabet;
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const nanoid = customAlphabet( alphabet, 16 );
const { DeathRecapEncounterMob, DeathRecapRaidStats, DeathRecapEncounter, DeathRecapLog, DeathRecapDamageSource, DeathRecapModel } = require( '../data/models/death-recap' );
const DomUtilities = require( '../utilities/dom' );
const NumberUtilities = require( '../utilities/numbers' );










/** @type {HandlebarsTemplateDelegate<any>} */
var numberTemplate = null;
/** @type {HandlebarsTemplateDelegate<any>} */
var numberMagnitudeTemplate = null;
/** @type {HandlebarsTemplateDelegate<any>} */
var statItemTemplate = null;
/** @type {HandlebarsTemplateDelegate<any>} */
var statGroupTemplate = null;










/**
 * Returns the format data for the given number.
 * 
 * @returns {{ value: string, magnitude: string? }}
 * 
 * @param {number} numeric The number value.
 */
function getNumberFormat( numeric ) {
    numeric = Math.round( numeric );
    if ( numeric < 1000 ) {
        return { value: `${numeric}`, magnitude: null };

    } else if ( numeric >= 1000 && numeric < 10000 ) {
        return { value: numeric.toString().replace( /\B(?=(\d{3})+(?!\d))/g, "," ), magnitude: null };

    } else if ( numeric >= 10000 && numeric < 100000 ) {
        return { value: `${NumberUtilities.round( numeric / 1000, 1 )}`, magnitude: 'K' };

    } else if ( numeric >= 100000 && numeric < 1000000 ) {
        return { value: `${NumberUtilities.round( numeric / 1000, 0 )}`, magnitude: 'K' };

    } else if ( numeric >= 1000000 && numeric < 10000000 ) {
        return { value: `${NumberUtilities.round( numeric / 1000000, 1 )}`, magnitude: 'M' };

    } else if ( numeric >= 10000000 && numeric < 1000000000 ) {
        return { value: `${NumberUtilities.round( numeric / 1000000, 0 ).toString().replace( /\B(?=(\d{3})+(?!\d))/g, "," )}`, magnitude: 'M' };

    } else if ( numeric >= 1000000000 && numeric < 1000000000000 ) {
        return { value: `${NumberUtilities.round( numeric / 1000000000, 1 )}`, magnitude: 'B' };

    } else if ( numeric >= 1000000000000 && numeric < 1000000000000000 ) {
        return { value: `${NumberUtilities.round( numeric / 1000000000000, 1 )}`, magnitude: 'T' };

    } else if ( numeric >= 1000000000000000 && numeric < 1000000000000000000 ) {
        return { value: `${NumberUtilities.round( numeric / 1000000000000000, 1 )}`, magnitude: 'q' };

    } else if ( numeric >= 1000000000000000000 ) {
        return { value: `${NumberUtilities.round( numeric / 1000000000000000000, 0 ).toString().replace( /\B(?=(\d{3})+(?!\d))/g, "," )}`, magnitude: 'Q' };

    } else {
        return { value: 'n/a', magnitude: null };
    }
}










/**
 * The death recap screen.
 * 
 * @param {string} logFilePath The full path to the log file.
 * @param {number} lineNo The line number at which death occurred.
 * @param {string} messageId The ipc message id.
 * @param {string} characterName The name of the character.
 */
function DeathRecap( logFilePath, lineNo, messageId, characterName ) {
    
    DomUtilities.docReady( f => {
        let title = document.querySelector( '#characterName' );

        if ( title != null ) {
            title.innerHTML = characterName;
        }

        numberTemplate = Handlebars.compile( document.querySelector( '#numberTemplate' ).innerHTML );
        numberMagnitudeTemplate = Handlebars.compile( document.querySelector( '#numberMagnitudeTemplate' ).innerHTML );
        statItemTemplate = Handlebars.compile( document.querySelector( '#statItemTemplate' ).innerHTML );
        statGroupTemplate = Handlebars.compile( document.querySelector( '#statGroupTemplate' ).innerHTML );
    } );

    // "Constructor"
    let combatParser = new CombatParser();

    if ( lineNo !== -1 ) {
        
        combatParser.loadDeathRecap( logFilePath, lineNo, characterName,
            /**
             * Processes the model and renders the view.
             * 
             * @param {DeathRecapModel} data The model data for the death recap.
             */
            ( data ) => {
                document.querySelector( '.dashboard' ).style.display = null;
                document.querySelector( '.css-loader' ).style.display = 'none';

                // Populates the death log view.
                const damageLogContainer = document.querySelector( '#damageLogContainer' );
                for ( let i = data.myDeathLog?.length - 1 ?? -1; i >= 0 && i >= data.myDeathLog?.length - 10; i-- ) {
                    const event = data.myDeathLog[ i ];
                    if ( event.damage > 0 ) {
                        let numberFormat = getNumberFormat( event.damage );
                        let number = numberFormat.magnitude ? numberMagnitudeTemplate( numberFormat ) : numberTemplate( numberFormat );
                        let stat = statItemTemplate( {
                            numberCssClass: 'color-red',
                            value: number,
                            textCssClass: 'color-orange',
                            actor: event.actor,
                            description: event.attackType === 'melee' ? 'Melee' : event.attackName,
                        } );
                        damageLogContainer.innerHTML += stat;

                    } else if ( event.healing > 0 ) {
                        let numberFormat = getNumberFormat( event.healing );
                        let number = numberFormat.magnitude ? numberMagnitudeTemplate( numberFormat ) : numberTemplate( numberFormat );
                        let stat = statItemTemplate( {
                            numberCssClass: 'color-blue',
                            value: number,
                            textCssClass: 'color-light-blue',
                            actor: event.actor,
                            description: event.attackName,
                        } );
                        damageLogContainer.innerHTML += stat;

                    }
                }

                // Populates the damage sources view.
                const damageSourcesContainer = document.querySelector( '#damageSourcesContainer' );
                for ( let i = 0; i < data.damageSources?.length; i++ ) {
                    const event = data.damageSources[ i ];
                    
                    if ( event.damage > 0 ) {
                        let numberFormat = getNumberFormat( event.damage );
                        let number = numberFormat.magnitude ? numberMagnitudeTemplate( numberFormat ) : numberTemplate( numberFormat );
                        let stat = statItemTemplate( {
                            numberCssClass: 'color-red',
                            value: number,
                            textCssClass: 'color-orange',
                            description: event.source,
                        } );
                        damageSourcesContainer.innerHTML += stat;

                    } else if ( event.healing > 0 ) {
                        let numberFormat = getNumberFormat( event.healing );
                        let number = numberFormat.magnitude ? numberMagnitudeTemplate( numberFormat ) : numberTemplate( numberFormat );
                        let stat = statItemTemplate( {
                            numberCssClass: 'color-blue',
                            value: number,
                            textCssClass: 'color-light-blue',
                            description: event.source,
                        } );
                        damageSourcesContainer.innerHTML += stat;

                    }
                }

                const encounterStatsContainer = document.querySelector( '#encounterStatsContainer' );
                if ( data.encounterStatistics.raid != null ) {

                    let model = {
                        groupNameCssClass: 'color-med-green',
                        groupName: 'Raid Stats',
                        statItems: [],
                    };

                    // Raid Healing Received
                    let healingRecNumFmt = getNumberFormat( data.encounterStatistics.raid.healingReceived );
                    model.statItems.push( statItemTemplate( {
                        numberCssClass: 'color-light-blue',
                        value: healingRecNumFmt.magnitude ? numberMagnitudeTemplate( healingRecNumFmt ) : numberTemplate( healingRecNumFmt ),
                        textCssClass: 'color-orange',
                        description: 'Healing Received',
                    } ) );
                    
                    // Raid DPS
                    let raidDpsNumFmt = getNumberFormat( data.encounterStatistics.raid.dps );
                    model.statItems.push( statItemTemplate( {
                        numberCssClass: 'color-light-green',
                        value: raidDpsNumFmt.magnitude ? numberMagnitudeTemplate( raidDpsNumFmt ) : numberTemplate( raidDpsNumFmt ),
                        textCssClass: 'color-orange',
                        description: 'Raid DPS',
                    } ) );
                    
                    // Raid Healing
                    let healingNumFmt = getNumberFormat( data.encounterStatistics.raid.healing );
                    model.statItems.push( statItemTemplate( {
                        numberCssClass: 'color-light-blue',
                        value: healingNumFmt.magnitude ? numberMagnitudeTemplate( healingNumFmt ) : numberTemplate( healingNumFmt ),
                        textCssClass: 'color-orange',
                        description: 'Raid Healing',
                    } ) );
                    
                    // Raid Damage
                    let damageNumFmt = getNumberFormat( data.encounterStatistics.raid.damage );
                    model.statItems.push( statItemTemplate( {
                        numberCssClass: 'color-red',
                        value: damageNumFmt.magnitude ? numberMagnitudeTemplate( damageNumFmt ) : numberTemplate( damageNumFmt ),
                        textCssClass: 'color-orange',
                        description: 'Raid Damage',
                    } ) );
                    
                    encounterStatsContainer.innerHTML += statGroupTemplate( model );

                    for ( let i = 0; i < data.encounterStatistics.mobs?.length; i++ ) {
                        const event = data.encounterStatistics.mobs[ i ];
                        let mobModel = {
                            groupNameCssClass: 'color-light-yellow',
                            groupName: event.name,
                            statItems: [],
                        };
                        let numberFmt;

                        // Total Damage Done
                        numberFmt = getNumberFormat( event.totalDamage );
                        mobModel.statItems.push( statItemTemplate( {
                            numberCssClass: 'color-red',
                            value: numberFmt.magnitude ? numberMagnitudeTemplate( numberFmt ) : numberTemplate( numberFmt ),
                            textCssClass: 'color-orange',
                            description: 'Total Damage Done',
                        } ) );

                        // Quads
                        numberFmt = getNumberFormat( event.quadCount );
                        mobModel.statItems.push( statItemTemplate( {
                            numberCssClass: 'color-red',
                            value: numberFmt.magnitude ? numberMagnitudeTemplate( numberFmt ) : numberTemplate( numberFmt ),
                            textCssClass: 'color-orange',
                            description: 'Quads',
                        } ) );

                        // Avg Hit
                        numberFmt = getNumberFormat( event.avgHit );
                        mobModel.statItems.push( statItemTemplate( {
                            numberCssClass: 'color-red',
                            value: numberFmt.magnitude ? numberMagnitudeTemplate( numberFmt ) : numberTemplate( numberFmt ),
                            textCssClass: 'color-orange',
                            description: 'Avg Hit',
                        } ) );

                        // Avg Defensive Hit
                        numberFmt = getNumberFormat( event.avgDevensiveHit );
                        mobModel.statItems.push( statItemTemplate( {
                            numberCssClass: 'color-light-purple',
                            value: numberFmt.magnitude ? numberMagnitudeTemplate( numberFmt ) : numberTemplate( numberFmt ),
                            textCssClass: 'color-orange',
                            description: 'Avg Defensive Hit',
                        } ) );

                        // Max Hit
                        numberFmt = getNumberFormat( event.maxHit );
                        mobModel.statItems.push( statItemTemplate( {
                            numberCssClass: 'color-red',
                            value: numberFmt.magnitude ? numberMagnitudeTemplate( numberFmt ) : numberTemplate( numberFmt ),
                            textCssClass: 'color-orange',
                            description: 'Max Hit',
                        } ) );

                        // Max Defensive Hit
                        numberFmt = getNumberFormat( event.maxDefensiveHit );
                        mobModel.statItems.push( statItemTemplate( {
                            numberCssClass: 'color-light-purple',
                            value: numberFmt.magnitude ? numberMagnitudeTemplate( numberFmt ) : numberTemplate( numberFmt ),
                            textCssClass: 'color-orange',
                            description: 'Max Defensive Hit',
                        } ) );

                        // Min Hit
                        numberFmt = getNumberFormat( event.minHit );
                        mobModel.statItems.push( statItemTemplate( {
                            numberCssClass: 'color-red',
                            value: numberFmt.magnitude ? numberMagnitudeTemplate( numberFmt ) : numberTemplate( numberFmt ),
                            textCssClass: 'color-orange',
                            description: 'Min Hit',
                        } ) );

                        // Min Defensive Hit
                        numberFmt = getNumberFormat( event.minDefensiveHit );
                        mobModel.statItems.push( statItemTemplate( {
                            numberCssClass: 'color-light-purple',
                            value: numberFmt.magnitude ? numberMagnitudeTemplate( numberFmt ) : numberTemplate( numberFmt ),
                            textCssClass: 'color-orange',
                            description: 'Min Defensive Hit',
                        } ) );

                        // Max Spell
                        numberFmt = getNumberFormat( event.maxSpell );
                        mobModel.statItems.push( statItemTemplate( {
                            numberCssClass: 'color-red',
                            value: numberFmt.magnitude ? numberMagnitudeTemplate( numberFmt ) : numberTemplate( numberFmt ),
                            textCssClass: 'color-orange',
                            description: 'Max Spell',
                        } ) );

                        // Flurries
                        mobModel.statItems.push( statItemTemplate( {
                            numberCssClass: 'color-soft-white',
                            value: event.flurries ? 'Yes' : 'No',
                            textCssClass: 'color-orange',
                            description: 'Flurries',
                        } ) );

                        // Rampage
                        mobModel.statItems.push( statItemTemplate( {
                            numberCssClass: 'color-soft-white',
                            value: event.rampage ? 'Yes' : 'No',
                            textCssClass: 'color-orange',
                            description: 'Rampage',
                        } ) );

                        // Wild Rampage
                        mobModel.statItems.push( statItemTemplate( {
                            numberCssClass: 'color-soft-white',
                            value: event.wildRampage ? 'Yes' : 'No',
                            textCssClass: 'color-orange',
                            description: 'Wild Rampage',
                        } ) );
                        
                        encounterStatsContainer.innerHTML += statGroupTemplate( mobModel );
                    }
                }
            } );

        // Show the window.
        document.querySelector( 'body' ).style.display = 'unset';
        
    } else {
        combatParser.findAllDeaths( logFilePath, found => {
            let message = new IpcMessage( found );
            message.id = messageId;
            ipcRenderer.send( 'death-recap:find-deaths:results', message );
            window.setTimeout( () => ipcRenderer.send( 'window:child:close' ) );
        } );
    }

    docReady( () => {
        let closeBtn = document.querySelector( 'a.close-button' );
        console.log( 'closeBtn', closeBtn );
        closeBtn.addEventListener( 'click', () => ipcRenderer.send( 'window:child:close' ) );
    } );
}










/**
 * Executes the given callback when the document is ready.
 * 
 * @param {() => void)} fn The callback function to execute.
 */
function docReady( fn ) {
    // see if DOM is already available
    if ( document.readyState === "complete" || document.readyState === "interactive" ) {
        // call on next available tick
        setTimeout( fn, 1 );
    } else {
        document.addEventListener( "DOMContentLoaded", fn );
    }
}

module.exports = DeathRecap;