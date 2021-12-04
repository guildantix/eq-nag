import { HttpErrorResponse } from '@angular/common/http';
import { ErrorHandler, Injectable, NgZone } from '@angular/core';
import { IpcService } from '../ipc.service';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
    constructor(
        private ipcService: IpcService
    ) { }

    handleError( error: Error | any ) {
        console.log( 'handleError', arguments );
        // Check if it's an error from an HTTP response
        // if ( !( error instanceof HttpErrorResponse ) ) {
        //     error = error.rejection; // get the error object
        // }
        // this.zone.run(() =>
        //   this.errorDialogService.openDialog(
        //     error?.message || 'Undefined client error'
        //   )
        // );

        console.error( 'Error from global error handler', error );
        this.ipcService.logException( error );
        
    }
}
