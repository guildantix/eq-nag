import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { AuthorModel } from '../core.model';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { IpcService } from '../ipc.service';

@Injectable({providedIn: 'root'})
export class SettingsService {

    constructor( private httpClient: HttpClient, private ipcService: IpcService ) { }









    
    /**
     * Submits the name/discord handle of the current user to create a new 
     * author record on the server.  This does not allow the user to create new 
     * packages, they must still be verified.
     * 
     * @returns Returns the created author model.
     * 
     * @param name The name of the author.
     * @param discord The discord account for the author.
     */
    createAuthor( name: string, discord: string ): Observable<AuthorModel> {
        let m = new AuthorModel();
        m.name = name;
        m.discord = discord;
        return this.httpClient.post<AuthorModel>( `${environment.shareServiceUrl}/authors`, m )
            .pipe(
                catchError( this.handleError )
            );
    }









    
    /**
     * Updates author name/discord handle.
     * 
     * @param model The author model.
     */
    updateAuthor( model: AuthorModel ): Observable<boolean> {
        return this.httpClient.put( `${environment.shareServiceUrl}/authors`, model, { observe: 'response' } )
            .pipe(
                map( value => value.status === 204 ),
                catchError( this.handleError )
            );
    }









    
    /**
     * Returns true if the current author has been verified.
     * 
     * @param authorId The id of the author.
     */
    isTrusted( authorId: string ): Observable<boolean> {
        return this.httpClient.get<boolean>( `${environment.shareServiceUrl}/authors/approved/${authorId}` );
    }









    
    /**
     * Submits a request to be verified as an author.
     * 
     * @param authorId The id of the author.
     */
    requestVerification( authorId: string ): Observable<boolean> {
        return this.httpClient.post( `${environment.shareServiceUrl}/authors/${authorId}/request-verification`, null, { observe: 'response' } )
            .pipe(
                map( value => value.status === 200 ),
                catchError( this.handleError )
            );
    }










    /**
     * Logs the error to the console and the log file, then throws an 
     * observable error.
     * 
     * @param error The captured error.
     */
    private handleError( error: HttpErrorResponse ) {

        // Log the error to the user log file.
        this.ipcService.logException( error.error );

        if ( error.status === 0 ) {
            // A client-side or network error occurred. Handle it accordingly.
            console.error( 'An error occurred:', error.error );
        } else {
            // The backend returned an unsuccessful response code.
            // The response body may contain clues as to what went wrong.
            console.error(
                `Backend returned code ${error.status}, ` +
                `body was: ${error.error}` );
        }

        // Return an observable with a user-facing error message.
        return throwError(
            'Something bad happened; please try again later.' );
    }

}
