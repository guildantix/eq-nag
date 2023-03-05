import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { environment } from 'src/environments/environment';
import { PackageFileModel, TriggerPackageListModel, TriggerPackageMetaModel, TriggerPackageModel, TriggerPackageTransferModel, TriggerPackageVersionInfoModel } from '../core.model';
import { catchError, map } from 'rxjs/operators';
import { DialogService } from '../dialogs/dialog.service';
import { IpcService } from '../ipc.service';

@Injectable()
export class TriggerLibraryService {

    constructor( private httpClient: HttpClient, private dialogService: DialogService, private ipcService: IpcService ) { }









    
    /**
     * Returns all trigger packages.
     * 
     * @deprecated The method should not be used, use getPackagesList instead.
     */
    getLibrary(): Observable<TriggerPackageMetaModel[]> {
        return this.httpClient.get<TriggerPackageMetaModel[]>( `${environment.shareServiceUrl}/triggers/library` )
            .pipe( catchError( error => this.handleError( error ) ) );
    }
    









    /**
     * Returns all trigger packages.
     */
    getPackagesList(): Observable<TriggerPackageListModel[]> {
        return this.httpClient.get<TriggerPackageListModel[]>( `${environment.shareServiceUrl}/triggers/library/list` )
            .pipe( catchError( error => this.handleError( error ) ) );
    }









    
    /**
     * Returns the latest version information for the given package(s).
     * 
     * @param packageIds The id of the desired package(s).
     * @returns 
     */
    getLatestVersionInfo(packageIds: string[]): Observable<TriggerPackageVersionInfoModel[]> {
        return this.httpClient.post<TriggerPackageVersionInfoModel[]>( `${environment.shareServiceUrl}/triggers/version-info`, packageIds )
            .pipe( catchError( error => this.handleError( error ) ) );
    }









    
    /**
     * Returns true if the specified author is the author of the specified 
     * package.
     * 
     * @param packageId The id of the package.
     * @param authorId The id of the author.
     */
    isAuthor( packageId: string, authorId: string ): Observable<boolean> {
        return this.httpClient.get<boolean>( `${environment.shareServiceUrl}/triggers/${packageId}/is-author/${authorId}` )
            .pipe( catchError( error => this.handleError( error ) ) );
    }









    
    /**
     * Creates a new trigger package on the server.
     * 
     * @param authorId The id of the author.
     * @param meta The package meta data.
     * @param notes The update notes.
     */
    createPackage( authorId: string, meta: TriggerPackageMetaModel, notes: string ): Observable<TriggerPackageMetaModel> {
        let data = new TriggerPackageTransferModel();

        data.model = meta.model;
        data.files = meta.files;
        data.name = meta.name;
        data.notes = notes;
        data.description = meta.description;
        data.category = meta.category;
        data.tags = meta.tags;

        return this.httpClient.post<TriggerPackageMetaModel>( `${environment.shareServiceUrl}/triggers/${authorId}`, data )
            .pipe(
                catchError( error => this.handleError( error ) )
            );
    }









    
    /**
     * Updates the trigger package.
     * 
     * @param authorId The id of the author.
     * @param meta The updated package meta data.
     * @param notes The update notes describing this update.
     */
    updatePackage( authorId: string, meta: TriggerPackageMetaModel, notes: string ): Observable<TriggerPackageMetaModel> {
        let data = new TriggerPackageTransferModel();

        data.model = meta.model;
        data.files = meta.files;
        data.name = meta.name;
        data.notes = notes;
        data.description = meta.description;
        data.category = meta.category;
        data.tags = meta.tags;

        return this.httpClient.put<TriggerPackageMetaModel>( `${environment.shareServiceUrl}/triggers/${authorId}/update/${meta.triggerPackageId}`, data )
            .pipe(
                catchError( error => this.handleError( error ) )
            );
    }









    
    /**
     * Returns the details of the specified package(s).
     * 
     * @param packageId The id of the desired package(s).
     */
    getPackage( packageId: string | string[] ): Observable<TriggerPackageMetaModel[]> {
        
        packageId = Array.isArray( packageId ) ? packageId : [ packageId ];
        
        return this.httpClient.get<TriggerPackageMetaModel[]>( `${environment.shareServiceUrl}/triggers?packageIds=${packageId.join( ',' )}` )
            .pipe( catchError( error => this.handleError( error ) ) );
    }









    
    /**
     * Returns the files to install with the specified package.
     * 
     * @param packageId The id of the desired package.
     */
    getPackageFiles( packageId: string ): Observable<PackageFileModel[]> {
        
        return this.httpClient.get<PackageFileModel[]>( `${environment.shareServiceUrl}/triggers/${packageId}/files` )
            .pipe( catchError( error => this.handleError( error ) ) );
    }

    // TODO: Remove when recovery options are built-in.
    // getAllFiles(): Observable<PackageFileModel[]> {
        
    //     return this.httpClient.get<PackageFileModel[]>( `${environment.shareServiceUrl}/triggers/all/files` )
    //         .pipe( catchError( error => this.handleError( error ) ) );
        
    // }










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
