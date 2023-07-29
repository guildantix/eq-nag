const StringUtilities = require( '../../utilities/string' );

const customAlphabet = require( 'nanoid' ).customAlphabet;
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const nanoid = customAlphabet( alphabet, 16 );

const ErrorCodes = {
    EqFolderNotFound: {
        code: 'EQDIRNULL',
        message: 'Could not locate your EverQuest folder.',
    }
};

class BasicError {
    /** @type string */
    errorCode;
    /** @type string */
    message;
}

class StyleProperties {

    /** @type {string} */
    fontFamily = 'Roboto';

    /** @type {number} */
    fontSize = 14;

    /** @type {number} */
    lineHeight = 90;

    /** @type {number} */
    fontWeight = 400;

    /** @type {string} */
    fontColor = '#ffffff';

    /** @type {number} */
    fontTransparency = 1.0;

    /** @type {boolean} */
    showBorder = true;

    /** @type {string} */
    borderColor = '#000000';

    /** @type {number} */
    borderIntensity = 1;
    
    /** @type {boolean} */
    showGlow = true;

    /** @type {string} */
    glowColor = '#000000';

    /** @type {number} */
    glowIntensity = 1;

    /** @type {number} */
    glowSize = 5;

}

/**
 * @template T
 */
class IpcMessage {

    /** @type {string} */
    id;

    /** @type {T} */
    value;

    /**
     * Constructs the IPC Message object.
     * 
     * @param {T} val The message value.
     */
    constructor( val ) {
        this.id = nanoid();
        this.value = val;
    }
}

class PlayerCharacter {
    /** @type {string} */
    name;
    /** @type {string} */
    class;
}

class PlayerPet {
    /** @type {string} */
    owner;
    /** @type {string} */
    name;
}

const QuickShareAuthorListTypes = {
    '0': 'Disabled',
    '1': 'Whitelist',
    '2': 'Blacklist',
    Disabled: 0,
    Whitelist: 1,
    Blacklist: 2,
}

class Progress {
    
    /** @type {number} */
    completePercent;
    /** @type {string} */
    label;
    /** @type {boolean} */
    isComplete = false;

}

class SimulationProgress extends Progress {
    
    /** @type {number} */
    lineIndex;
    /** @type {number} */
    msRemaining;
    /** @type {boolean} */
    simulationPaused = false;

}

class Range {
    
    /** @type {number} */
    start;
    /** @type {number} */
    end;
    /** @type {boolean} */
    inclusive = true;

}

/**
 *  https://github.com/harrisiirak/cron-parser
 * 
 *      *    *    *    *    *    *
 *      ┬    ┬    ┬    ┬    ┬    ┬
 *      │    │    │    │    │    |
 *      │    │    │    │    │    └ day of week (0 - 7, 1L - 7L) (0 or 7 is Sun)
 *      │    │    │    │    └───── month (1 - 12)
 *      │    │    │    └────────── day of month (1 - 31, L)
 *      │    │    └─────────────── hour (0 - 23)
 *      │    └──────────────────── minute (0 - 59)
 *      └───────────────────────── second (0 - 59, optional)
 */
class ScheduledTask {

    /** @type {string} */
    label;

    /** @type {undefined | number | number[] | Range} */
    second;
    /** @type {undefined | number} */
    secondNth;

    /** @type {undefined | number | number[] | Range} */
    minute;
    /** @type {undefined | number} */
    minuteNth;

    /** @type {undefined | number | number[] | Range} */
    hour;
    /** @type {undefined | number} */
    hourNth;

    /** @type {undefined | number | number[] | Range} */
    dayOfMonth;
    /** @type {undefined | number} */
    dayOfMonthNth;

    /** @type {undefined | number | number[] | Range} */
    month;
    /** @type {undefined | number} */
    monthNth;

    /** @type {undefined | number | number[] | Range} */
    dayOfWeek;
    /** @type {undefined | number} */
    dayOfWeekNth;

    /**
     * Converts this scheduled task into a cron-like schedule.
     * @returns {string}
     */
    toCronSchedule() {
        let s = this.#getCronComponent(this.second, this.secondNth, '');
        let m = this.#getCronComponent(this.minute, this.minuteNth, '*');
        let h = this.#getCronComponent(this.hour, this.hourNth, '*');
        let dM = this.#getCronComponent(this.dayOfMonth, this.dayOfMonthNth, '*');
        let M = this.#getCronComponent(this.month, this.monthNth, '*');
        let dw = this.#getCronComponent(this.dayOfWeek, this.dayOfWeekNth, '*');

        return `${s} ${m} ${h} ${dM} ${M} ${dw}`.trim();
    }
    
    /**
     * Returns the cron schedule component for the given scheduled task component.
     * 
     * @param {undefined | number | number[] | Range} component The scheduled task component.
     * @param {undefined | number} nth The nth value of the component.
     * @param {string} emptyValue The empty value to use if component is empty or whitespace.
     * @returns {string}
     */
    #getCronComponent( component, nth, emptyValue ) {

        if ( component !== null && component !== undefined ) {
            let cronComp = '';

            if ( component instanceof Array ) {
                cronComp += component.join( ',' );
            } else if ( component instanceof Range ) {
                cronComp += ``;
            } else if ( component >= 0 ) {
                cronComp += '' + component;
            }

            if ( nth > 0 ) {
                cronComp += `/${nth}`;
            }

            return cronComp.length > 0 ? cronComp : emptyValue;
        } else {
            return emptyValue;
        }

    }

}

const LogMaintenancePlanTypes = {
    '0': 'BySize',
    '1': 'BySchedule',
    BySize: 0,
    BySchedule: 1,
}

const ArchiveFilePrefix = 'archive_';

class LogMaintenanceRules {

    /** @type {boolean} */
    enableLogFileMaintenance = false;
    /** @type {LogMaintenancePlanTypes} */
    maintenancePlan = LogMaintenancePlanTypes.BySize;
    /** @type {boolean} */
    includeAllWatched = true;
    /** @type {string[]} */
    includeLogFiles = [];
    /** @type {string[]} */
    excludeLogFiles = [];
    /** @type {ScheduledTask | null} */
    logSchedule;
    /** @type {number} */
    maxLogFileSizeMb = 50;

}

class LogMaintenanceHistory {

    /** @type {Date} */
    timestamp;
    /** @type {string} */
    logSchedule;
    /** @type {boolean} */
    success;

}

class Version {

    /**
     * Returns -1 if a is less than b, 0 if a and b are equal, and 1 if a is greater than b.
     * 
     * @param {string} a The first compare value.
     * @param {string} b The second compare value.
     */
    static compareVersions( a, b ) {
        // https://regex101.com/r/nu5Aqw/1
        let aev = /(?<major>\d+)\.(?<minor>\d+)\.(?<revision>\d+)/gi.exec( a );
        let bev = /(?<major>\d+)\.(?<minor>\d+)\.(?<revision>\d+)/gi.exec( b );

        let av = {
            major: +aev.groups.major,
            minor: +aev.groups.minor,
            revision: +aev.groups.revision,
        };
        let bv = {
            major: +bev.groups.major,
            minor: +bev.groups.minor,
            revision: +bev.groups.revision,
        };
        
        let avMajor = av.major === bv.major ? 0 : av.major < bv.major ? -1 : 1;
        let avMinor = av.minor === bv.minor ? 0 : av.minor < bv.minor ? -1 : 1;
        let avRevision = av.revision === bv.revision ? 0 : av.revision < bv.revision ? -1 : 1;

        if ( avMajor === 0 && avMinor === 0 && avRevision === 0 ) {
            return 0;
        } else if ( avMajor >= 0 && avMinor >= 0 && avRevision >= 0 ) {
            return 1;
        } else {
            return -1;
        }
    }

}

module.exports = {
    StyleProperties,
    BasicError,
    ErrorCodes,
    IpcMessage,
    PlayerCharacter,
    PlayerPet,
    QuickShareAuthorListTypes,
    Progress,
    SimulationProgress,
    Range,
    ScheduledTask,
    LogMaintenancePlanTypes, 
    LogMaintenanceRules, 
    ArchiveFilePrefix, 
    LogMaintenanceHistory, 
    Version, 
};
