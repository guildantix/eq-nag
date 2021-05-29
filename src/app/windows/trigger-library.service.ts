import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { environment } from 'src/environments/environment';
import { TriggerPackageMetaModel, TriggerPackageModel, TriggerPackageTransferModel } from '../core.model';
import { catchError, map } from 'rxjs/operators';

@Injectable()
export class TriggerLibraryService {

    constructor( private httpClient: HttpClient ) { }

    getLibrary(): Observable<TriggerPackageMetaModel[]> {
        return this.httpClient.get<TriggerPackageMetaModel[]>( `${environment.shareServiceUrl}/triggers/library` )
            .pipe( catchError( this.handleError ) );
    }

    isAuthor( packageId: string, authorId: string ): Observable<boolean> {
        return this.httpClient.get<boolean>( `${environment.shareServiceUrl}/triggers/${packageId}/is-author/${authorId}` )
            .pipe( catchError( this.handleError ) );
    }

    createPackage( authorId: string, meta: TriggerPackageMetaModel, notes: string ): Observable<TriggerPackageMetaModel> {
        let data = new TriggerPackageTransferModel();

        data.model = meta.model;
        data.name = meta.name;
        data.notes = notes;
        data.description = meta.description;

        return this.httpClient.post<TriggerPackageMetaModel>( `${environment.shareServiceUrl}/triggers/${authorId}`, data )
            .pipe(
                catchError( this.handleError )
            );
    }

    updatePackage( authorId: string, meta: TriggerPackageMetaModel, notes: string ): Observable<TriggerPackageMetaModel> {
        let data = new TriggerPackageTransferModel();

        data.model = meta.model;
        data.name = meta.name;
        data.notes = notes;
        data.description = meta.description;

        return this.httpClient.put<TriggerPackageMetaModel>( `${environment.shareServiceUrl}/triggers/${authorId}/update/${meta.triggerPackageId}`, data )
            .pipe(
                catchError( this.handleError )
            );
    }

    getPackage( packageId: string | string[] ): Observable<TriggerPackageMetaModel[]> {
        
        packageId = Array.isArray( packageId ) ? packageId : [ packageId ];
        
        return this.httpClient.get<TriggerPackageMetaModel[]>( `${environment.shareServiceUrl}/triggers?packageIds=${packageId.join(',')}` )
            .pipe( catchError( this.handleError ) );
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
