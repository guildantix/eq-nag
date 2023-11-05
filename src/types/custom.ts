export class WindowApiIpc {
    send: ( channel: string, data?: any ) => void;
    once: ( channel: string, handler: ( event: Electron.IpcRendererEvent, ...args: any[] ) => void ) => void;
    on: ( channel: string, handler: ( event: Electron.IpcRendererEvent, ...args: any[] ) => void ) => void;
    invoke: <T>( channel: string, ...args: any[] ) => Promise<T>;
}

export class WindowApi {
    ipc: WindowApiIpc;
    close: () => void;
    setVersionNumberViewed: ( version: string ) => void;
    utils: {
        dates: {
            /**
             * Returns a string representing the duration in the format of "1h 2m 3s".
             * 
             * @param duration The duration in seconds.
             */
            getDurationLabel: ( duration: number ) => string;
        },
        styles: {
            /**
             * Returns the right-hand text-shadow value for a given border color.
             * 
             * @param {string} hexColorCode The hex color for the text border.
             * @param {number} transparency The transparency value, between 0 and 1.
             */
            textOutline: ( hexColorCode: string, transparency: number ) => string;
            /**
             * Returns the right-hand text-shadow value for a given glow property.
             * 
             * @param {string} hexColorCode The hex color code for the text glow.
             * @param {number} glowSize The distance the glow will spread.
             * @param {number} transparency The transparency value, between 0 and 1.
             */
            textGlow: ( hexColorCode: string, glowSize: number, transparency: number ) => string;
        },
        numbers: {
            /**
             * Returns true if the given value contains the given flag.
             * 
             * @returns {boolean} Returns true if the given value contains the given flag.
             * 
             * @param {number} value The value that may contain the given flag.
             * @param {number} flag The flag to check for.
             */
            hasFlag: ( value: number, flag: number ) => boolean;
            /**
             * Adds the given flag to the given value.
             * 
             * @returns {number} Returns the value with the flag added.
             * 
             * @param {number} value The value to add the flag to.
             * @param {number} flag The flag to add.
             */
            addFlag: ( value: number, flag: number ) => number;
            /**
             * Removes the given flag from the given value.
             * 
             * @returns {number} Returns the value with the flag removed.
             * 
             * @param {number} value The value to remove the flag from.
             * @param {number} flag The flag to remove.
             */
            removeFlag: ( value: number, flag: number ) => number;
            /**
             * Toggles the given flag on the given value.
             * 
             * @returns {number} Returns the value with the flag toggled.
             * 
             * @param {number} value The value to toggle the flag on.
             * @param {number} flag The flag to toggle.
             */
            toggleFlag: ( value: number, flag: number ) => number;
        }
        screens: {
            /**
             * Returns the size of the primary display.
             * 
             * @returns {Electron.Size} The size of the primary display.
             */
            primaryDisplaySize: () => Electron.Size;
        }
    };
    logger: {
        info: ( ...params: any[] ) => void
    };
}

declare global {
    interface Window {
        api: WindowApi
    }
}

export default global;
