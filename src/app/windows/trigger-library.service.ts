import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { environment } from 'src/environments/environment';
import { PackageFileModel, TriggerPackageMetaModel, TriggerPackageModel, TriggerPackageTransferModel, TriggerPackageVersionInfoModel } from '../core.model';
import { catchError, map } from 'rxjs/operators';
import { DialogService } from '../dialogs/dialog.service';

@Injectable()
export class TriggerLibraryService {

    constructor( private httpClient: HttpClient, private dialogService: DialogService ) { }

    getLibrary(): Observable<TriggerPackageMetaModel[]> {
        return this.httpClient.get<TriggerPackageMetaModel[]>( `${environment.shareServiceUrl}/triggers/library` )
            .pipe( catchError( error => this.handleError( error ) ) );
    }

    getLatestVersionInfo(packageIds: string[]): Observable<TriggerPackageVersionInfoModel[]> {
        return this.httpClient.post<TriggerPackageVersionInfoModel[]>( `${environment.shareServiceUrl}/triggers/version-info`, packageIds )
            .pipe( catchError( error => this.handleError( error ) ) );
    }

    isAuthor( packageId: string, authorId: string ): Observable<boolean> {
        return this.httpClient.get<boolean>( `${environment.shareServiceUrl}/triggers/${packageId}/is-author/${authorId}` )
            .pipe( catchError( error => this.handleError( error ) ) );
    }

    createPackage( authorId: string, meta: TriggerPackageMetaModel, notes: string ): Observable<TriggerPackageMetaModel> {
        let data = new TriggerPackageTransferModel();

        data.model = meta.model;
        data.files = meta.files;
        data.name = meta.name;
        data.notes = notes;
        data.description = meta.description;

        return this.httpClient.post<TriggerPackageMetaModel>( `${environment.shareServiceUrl}/triggers/${authorId}`, data )
            .pipe(
                catchError( error => this.handleError( error ) )
            );
    }

    updatePackage( authorId: string, meta: TriggerPackageMetaModel, notes: string ): Observable<TriggerPackageMetaModel> {
        let data = new TriggerPackageTransferModel();

        data.model = meta.model;
        data.files = meta.files;
        data.name = meta.name;
        data.notes = notes;
        data.description = meta.description;

        return this.httpClient.put<TriggerPackageMetaModel>( `${environment.shareServiceUrl}/triggers/${authorId}/update/${meta.triggerPackageId}`, data )
            .pipe(
                catchError( error => this.handleError( error ) )
            );
    }

    getPackage( packageId: string | string[] ): Observable<TriggerPackageMetaModel[]> {
        
        packageId = Array.isArray( packageId ) ? packageId : [ packageId ];
        
        return this.httpClient.get<TriggerPackageMetaModel[]>( `${environment.shareServiceUrl}/triggers?packageIds=${packageId.join( ',' )}` )
            .pipe( catchError( error => this.handleError( error ) ) );
    }

    getPackageFiles( packageId: string ): Observable<PackageFileModel[]> {
        
        return this.httpClient.get<PackageFileModel[]>( `${environment.shareServiceUrl}/triggers/${packageId}/files` )
            .pipe( catchError( error => this.handleError( error ) ) );
    }

    private handleError( error: HttpErrorResponse ) {
        if ( error.status === 0 ) {
            // A client-side or network error occurred. Handle it accordingly.
            console.error( 'An error occurred:', error.error );
            
            this.dialogService.showErrorDialog( 'Unknown Error', [ 'An error occurred:', error.error.Message ] );

        } else {
            // The backend returned an unsuccessful response code.
            // The response body may contain clues as to what went wrong.
            console.error(
                `Backend returned code ${error.status}, ` +
                `body was:`, error.error );
            
            this.dialogService.showErrorDialog( `[${error.status}] Error`, [ 'An error was thrown while attempting the request.', error.error.Message ] );
        }

        // Return an observable with a user-facing error message.
        return throwError(
            'Something bad happened; please try again later.' );
    }
    
}
