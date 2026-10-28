import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { DialogService } from '../dialogs/dialog.service';
import { IpcService } from '../ipc.service';
import { ShareFileReadResult } from '../core.model';

@Injectable( { providedIn: 'root' } )
export class ShareFileService {

    /** The pending imports. Each one reads a share file and shows its dialogs before the next one starts. */
    private _queue: ( () => Observable<ShareFileReadResult> )[] = [];
    private _busy: boolean = false;

    constructor( private readonly dialogService: DialogService, private readonly ipcService: IpcService ) { }










    /**
     * Queues an import from a file the user picks in the open dialog.
     */
    importFromDialog(): void {
        this.enqueue( () => this.ipcService.openShareFile() );
    }










    /**
     * Queues an import from the share file at the given absolute path.
     *
     * @param filePath The absolute file path.
     */
    importFromPath( filePath: string ): void {
        this.enqueue( () => this.ipcService.readShareFilePath( filePath ) );
    }










    /**
     * Adds an import to the queue and starts it if nothing is running.
     *
     * @param source Reads the share file.
     */
    private enqueue( source: () => Observable<ShareFileReadResult> ): void {
        this._queue.push( source );
        this.processNext();
    }










    /**
     * Runs the next queued import. The queue always moves on, even if an import fails.
     */
    private processNext(): void {

        if ( this._busy || this._queue.length === 0 ) {
            return;
        }

        this._busy = true;
        let source = this._queue.shift();
        let finished = false;
        let finish = () => {
            if ( !finished ) {
                finished = true;
                this._busy = false;
                this.ipcService.requestTick();
                this.processNext();
            }
        };

        try {
            let received = false;
            source().subscribe( {
                next: result => {
                    received = true;
                    try {
                        this.handleReadResult( result ).subscribe( { complete: finish, error: finish } );
                    } catch ( error ) {
                        finish();
                    }
                },
                error: finish,
                complete: () => received || finish(),
            } );
        } catch ( error ) {
            finish();
        }

    }









    /**
     * Handles the result of opening or reading a share file. Shows the receive quick share dialog for a valid file, or an error for an invalid one.
     *
     * @returns Returns an observable that completes once the user is done with the result.
     *
     * @param result The result of reading the share file.
     */
    handleReadResult( result: ShareFileReadResult ): Observable<void> {

        if ( !result || result.code === 'cancelled' ) {
            return of( undefined );
        }

        if ( !result.ok ) {
            return this.showReadError( result );
        }

        let newerVersion = result.warnings?.find( f => f.code === 'newerVersion' );

        if ( newerVersion ) {
            let unknownKeys = newerVersion.unknownKeys ?? [];
            let message = [
                `This file was made with a newer version of Nag (${newerVersion.fileVersion}). It can still be imported, but ${unknownKeys.length} setting${unknownKeys.length === 1 ? '' : 's'} this version doesn't recognize will be skipped.`,
            ];

            if ( unknownKeys.length > 0 ) {
                message.push( `Unrecognized: ${unknownKeys.join( ', ' )}` );
            }

            return new Observable<void>( observer => {
                this.dialogService
                    .showConfirmationDialog( message, null, null, null, 'normal', null, { Yes: 'Review import', No: 'Cancel' } )
                    .subscribe( confirmed => {
                        if ( confirmed ) {
                            this.showReceive( result ).subscribe( {
                                complete: () => {
                                    observer.next();
                                    observer.complete();
                                },
                                error: error => observer.error( error ),
                            } );
                        } else {
                            observer.next();
                            observer.complete();
                        }
                    }, error => observer.error( error ) );
            } );
        }

        return this.showReceive( result );

    }










    /**
     * Shows the receive quick share dialog for the given result's payload.
     *
     * @param result The successful result of reading a share file.
     */
    private showReceive( result: ShareFileReadResult ): Observable<void> {
        return new Observable<void>( observer => {
            this.dialogService
                .showReceiveQuickShareDialog( result.payload.quickShares, result.payload.files )
                .subscribe( () => {
                    observer.next();
                    observer.complete();
                }, error => observer.error( error ) );
        } );
    }










    /**
     * Shows the error message for a failed read result.
     *
     * @returns Returns an observable that completes when the error dialog is closed.
     *
     * @param result The failed result.
     */
    private showReadError( result: ShareFileReadResult ): Observable<void> {

        let name = `“${result.fileName}”`;
        let bytes = +( /(\d+) bytes/.exec( result.details ?? '' )?.[ 1 ] ?? NaN );
        let size = isNaN( bytes ) ? null : this.formatSize( bytes );
        let message: string;

        switch ( result.code ) {
            case 'wrongType':
                message = `${name} isn't a trigger file. Nag can import .nag, .zip and .json files.`;
                break;
            case 'tooLarge':
                message = `${name} is ${size ? size + ', ' : ''}larger than a trigger file can be, so Nag didn't open it.`;
                break;
            case 'unpackTooLarge':
                message = `${name} would unpack to ${size ?? 'a very large size'}, so Nag stopped before extracting it.`;
                break;
            case 'notNagFile':
                message = `${name} doesn't contain Nag triggers. If someone sent it to you, ask them to save it again from Nag's share dialog.`;
                break;
            default:
                message = `${name} is damaged and can't be read. Ask the sender to save it again.`;
                break;
        }

        return this.dialogService.showErrorDialog( 'Import from File', message ).pipe( map( () => undefined ) );

    }










    /**
     * Returns a short size label, like 26 MB.
     *
     * @param bytes The size in bytes.
     */
    private formatSize( bytes: number ): string {
        if ( bytes >= 1024 * 1024 ) {
            return `${Math.round( bytes / ( 1024 * 1024 ) )} MB`;
        }

        return `${Math.max( 1, Math.round( bytes / 1024 ) )} KB`;
    }

}
