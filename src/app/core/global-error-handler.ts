import { HttpErrorResponse } from '@angular/common/http';
import { ErrorHandler, Injectable, NgZone } from '@angular/core';
import { IpcService } from '../ipc.service';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
    constructor(
        private ipcService: IpcService
    ) { }

    handleError( error: Error | any ) {
        this.ipcService.logException( error );
    }
}
