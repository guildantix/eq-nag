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
}

declare global {
    interface Window {
        api: WindowApi
    }
}

export default global;