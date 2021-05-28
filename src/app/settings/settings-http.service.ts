import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { AuthorModel } from '../core.model';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

@Injectable()
export class SettingsService {

    constructor( private httpClient: HttpClient ) { }

    createAuthor( name: string, discord: string ): Observable<AuthorModel> {
        let m = new AuthorModel();
        m.name = name;
        m.discord = discord;
        return this.httpClient.post<AuthorModel>( `${environment.shareServiceUrl}/authors`, m )
            .pipe(
                catchError( this.handleError )
            );
    }

    updateAuthor( model: AuthorModel ): Observable<boolean> {
        return this.httpClient.put( `${environment.shareServiceUrl}/authors`, model, { observe: 'response' } )
            .pipe(
                map( value => value.status === 201 ),
                catchError( this.handleError )
            );
    }

    isTrusted( authorId: string ): Observable<boolean> {
        return this.httpClient.get<boolean>( `${environment.shareServiceUrl}/authors/approved/${authorId}` );
    }

    private handleError( error: HttpErrorResponse ) {
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
