import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { IpcService } from '../ipc.service';
import { QuickShareFctMetaModel, QuickShareFctModel, QuickShareFctTransferModel, QuickShareFileModel, QuickShareMetaModel, QuickShareModel, QuickShareTransferModel, QuickShareVersion } from '../core.model';
import { Observable, throwError } from 'rxjs';
import { environment } from 'src/environments/environment';
import { catchError, map } from 'rxjs/operators';
import * as _ from 'lodash-es';
import { MatDialog } from '@angular/material/dialog';
import { NotificationDialogComponent } from '../dialogs/notification-dialog/notification-dialog.component';
import { NotificationTypes } from '../dialogs/notification-dialog/notification-dialog.model';

@Injectable( { providedIn: 'root' } )
export class QuickShareService {

    constructor( private httpClient: HttpClient, private dialog: MatDialog, private ipcService: IpcService ) { }









    
    /**
     * Creates a new quick share.
     * 
     * @returns Returns the quick share id.
     * 
     * @param authorId The id of the author.
     * @param model The quickshare model.
     * @param files The files used in the quickshare.
     * @param notes Notes attached to this update.
     */
    createQuickShare( authorId: string, model: QuickShareModel, files: QuickShareFileModel[], notes: string ): Observable<string> {
        let data = new QuickShareTransferModel();

        data.model = model;
        data.files = files;
        data.notes = notes;

        return this.httpClient.post<string>( `${environment.shareServiceUrl}/quick-shares/${authorId}`, data )
            .pipe( catchError( error => this.handleError( error ) ) );
    }









    
    /**
     * Creates a new quick share.
     * 
     * @returns Returns the quick share id.
     * 
     * @param authorId The id of the author.
     * @param model The quickshare model.
     * @param notes Notes attached to this update.
     */
    createQuickShareFct( authorId: string, model: QuickShareFctModel, notes: string ): Observable<string> {
        let data = new QuickShareFctTransferModel();

        data.model = model;
        data.notes = notes;

        return this.httpClient.post<string>( `${environment.shareServiceUrl}/quick-shares/${authorId}/fct`, data )
            .pipe( catchError( error => this.handleError( error ) ) );
    }









    
    /**
     * Returns a list of the latest version information for the specified quickshares.
     * 
     * @param quickShareIds The list of installed quickshare ids.
     */
    getQuickSharedUpdates( quickShareIds: string[] ): Observable<QuickShareVersion[]> {
        
        return this.httpClient.get( `${environment.shareServiceUrl}/quick-shares/version-info` )
            .pipe(
                map<any[], QuickShareVersion[]>( updates => _.map( updates, update => Object.assign( new QuickShareVersion(), update ) ) ),
                catchError( error => this.handleError( error ) )
            );
        
    }









    
    /**
     * Returns the specified quickshare.
     * 
     * @param quickShareFctId The id of the desired quickshare.
     */
    getQuickShareFct( quickShareFctId: string ): Observable<QuickShareFctMetaModel[]> {
        
        return this.httpClient.get( `${environment.shareServiceUrl}/quick-shares/${quickShareFctId}/fct` )
            .pipe(
                map<any[], QuickShareFctMetaModel[]>( quickShareFcts => _.map( quickShareFcts, quickShareFct => Object.assign( new QuickShareFctMetaModel(), quickShareFct ) ) ),
                catchError( error => this.handleError( error ) )
            );
        
    }









    
    /**
     * Returns the specified quickshare.
     * 
     * @param quickShareId The id of the desired quickshare.
     */
    getQuickShare( quickShareId: string ): Observable<QuickShareMetaModel[]> {
        
        return this.httpClient.get( `${environment.shareServiceUrl}/quick-shares/${quickShareId}` )
            .pipe(
                map<any[], QuickShareMetaModel[]>( quickShares => _.map( quickShares, quickShare => Object.assign( new QuickShareMetaModel(), quickShare ) ) ),
                catchError( error => this.handleError( error ) )
            );
        
    }









    
    /**
     * Returns a list of files used in the specified quickshare.
     * 
     * @param quickShareId The id of the desired quickshare.
     */
    getQuickShareFiles( quickShareId: string ): Observable<QuickShareFileModel[]> {
        
        return this.httpClient.get( `${environment.shareServiceUrl}/quick-shares/${quickShareId}/files` )
            .pipe(
                map<any[], QuickShareFileModel[]>( updates => _.map( updates, update => Object.assign( new QuickShareFileModel(), update ) ) ),
                catchError( error => this.handleError( error ) )
            );
        
    }









    
    /**
     * Updates the quickshare on the server.
     * 
     * @returns Returns the update model.
     * 
     * @param authorId The user's author id.
     * @param quickShareFctId The quickshare id.
     * @param model The updated quickshare model.
     * @param notes Update notes.
     */
    updateQuickShareFct( authorId: string, quickShareFctId: string, model: QuickShareFctModel, notes: string ): Observable<QuickShareFctMetaModel[]> {
        let data = new QuickShareFctTransferModel();
        
        data.model = model;
        data.notes = notes;

        return this.httpClient.put( `${environment.shareServiceUrl}/quick-shares/${authorId}/update/${quickShareFctId}/fct`, data )
            .pipe(
                map<any[], QuickShareFctMetaModel[]>( quickShareFcts => _.map( quickShareFcts, quickShareFct => Object.assign( new QuickShareFctMetaModel(), quickShareFct ) ) ),
                catchError( error => this.handleError( error ) )
            );

    }









    
    /**
     * Updates the quickshare on the server.
     * 
     * @returns Returns the update model.
     * 
     * @param authorId The user's author id.
     * @param quickShareId The quickshare id.
     * @param model The updated quickshare model.
     * @param files The files used by this quickshare.
     * @param notes Update notes.
     */
    updateQuickShare( authorId: string, quickShareId: string, model: QuickShareModel, files: QuickShareFileModel[], notes: string ): Observable<QuickShareMetaModel[]> {
        let data = new QuickShareTransferModel();
        
        data.files = files;
        data.model = model;
        data.notes = notes;

        return this.httpClient.put( `${environment.shareServiceUrl}/quick-shares/${authorId}/update/${quickShareId}`, data )
            .pipe(
                map<any[], QuickShareMetaModel[]>( quickShares => _.map( quickShares, quickShare => Object.assign( new QuickShareMetaModel(), quickShare ) ) ),
                catchError( error => this.handleError( error ) )
            );

    }









    
    /**
     * Returns true if the specifed author id is the author of the specified quickshare.
     * 
     * @param authorId The user's author id.
     * @param quickShareFctId The id of the quickshare.
     */
    isAuthorOfQuickShareFct( authorId: string | void, quickShareFctId: string ): Observable<boolean> {
        
        authorId = authorId ?? 'undefined';

        return this.httpClient.get<boolean>( `${environment.shareServiceUrl}/quick-shares/${quickShareFctId}/is-author/${authorId}/fct` )
            .pipe( catchError( error => this.handleError( error ) ) );

    }









    
    /**
     * Returns true if the specifed author id is the author of the specified quickshare.
     * 
     * @param authorId The user's author id.
     * @param quickShareId The id of the quickshare.
     */
    isAuthorOfQuickShare( authorId: string | void, quickShareId: string ): Observable<boolean> {
        
        authorId = authorId ?? 'undefined';

        return this.httpClient.get<boolean>( `${environment.shareServiceUrl}/quick-shares/${quickShareId}/is-author/${authorId}` )
            .pipe( catchError( error => this.handleError( error ) ) );

    }
    









    /**
     * Logs the error to the console and the log file, displays the error to the user, then throws an observable error.
     * 
     * @param error The captured error.
     */
     private handleError( error: HttpErrorResponse ) {

        // Log the error to the user log file.
        this.ipcService.logException( error.error );

        if ( error.status === 0 ) {
            // A client-side or network error occurred. Handle it accordingly.
            console.error( 'An error occurred:', error.error );
            
            this.dialog.open( NotificationDialogComponent, {
                width: '450px',
                data: {
                    title: 'Unknown Error',
                    message: [ 'An error occurred:', error.error.Message ],
                    notificationType: NotificationTypes.Error,
                },
                panelClass: 'app-dialog',
            } ).afterClosed().subscribe();

        } else {
            // The backend returned an unsuccessful response code.
            // The response body may contain clues as to what went wrong.
            console.error(
                `Backend returned code ${error.status}, ` +
                `body was:`, error.error );
            
                this.dialog.open( NotificationDialogComponent, {
                    width: '450px',
                    data: {
                        title: `[${error.status}] Error`,
                        message: [ 'An error was thrown while attempting the request.', error.error.Message ],
                        notificationType: NotificationTypes.Error,
                    },
                    panelClass: 'app-dialog',
                } ).afterClosed().subscribe();
        }

        // Return an observable with a user-facing error message.
        return throwError(
            'Something bad happened; please try again later.' );
    }
}
