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
        }
    }
}

declare global {
    interface Window {
        api: WindowApi
    }
}

export default global;
