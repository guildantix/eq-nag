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
