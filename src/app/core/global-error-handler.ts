import { HttpErrorResponse } from '@angular/common/http';
import { ErrorHandler, Injectable, NgZone } from '@angular/core';
import { IpcService } from '../ipc.service';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
    constructor(
        private ipcService: IpcService
    ) { }

    handleError( error: Error | any ) {
        if ( error instanceof Error ) {
            this.ipcService.logException( error.stack );
        } else {
            this.ipcService.logException( error );
        }

        console.error( error );
    }
}
