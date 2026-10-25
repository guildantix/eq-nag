import { Component, OnInit } from '@angular/core';
import { animate, state, style, transition, trigger } from '@angular/animations';
import { ActivatedRoute } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';

import { IpcService } from 'src/app/ipc.service';
import { DialogService } from '../dialog.service';
import { ColorUtility } from 'src/app/utilities';
import { TriggerModel, ActionTypes, TriggerAction, OverlayWindowModel, OperatorTypes, ImportTypes, ExternalDataSources } from 'src/app/core.model';
import { Observable } from 'rxjs';

@Component( {
    selector: 'app-trigger-dialog',
    templateUrl: 'trigger-dialog.component.html',
    styleUrls: [ 'trigger-dialog.component.scss', '../../core.scss', '../../modal.scss' ],
    animations: [
        trigger( 'detailExpand', [
            state( 'collapsed', style( { height: '0px', minHeight: '0' } ) ),
            state( 'expanded', style( { height: '*' } ) ),
            transition( 'expanded <=> collapsed', animate( '225ms cubic-bezier(0.4, 0.0, 0.2, 1)' ) ),
        ] ),
    ],
} )
export class TriggerDialogComponent implements OnInit {

    public model: TriggerModel;
    public triggerId: string = null;
    public folderId: string = null;
    public actionTypes: typeof ActionTypes = ActionTypes;
    public operatorTypes: typeof OperatorTypes = OperatorTypes;
    public isDev: boolean = false;
    private _fullName: string = '';
    public get fullName(): string {
        return this._fullName;
    }
    public set fullName( value: string ) {
        this._fullName = value;
    }
    public get fullNamePrefix(): string {
        // Return the first half of the full name, by size.
        if ( this.fullName.length > 0 ) {
            let half = Math.floor( this.fullName.length / 2 );
            // if the first part of the second half is a slash, increment half by 1 to include the slash in the first half.
            if ( this.fullName[ half ] === '/' ) {
                half++;
            }
            return this.fullName.substring( 0, half );
        } else {
            return '';
        }
    }
    public get fullNameSuffix(): string {
        // Return the second half of the full name, by size.
        if ( this.fullName.length > 0 ) {
            let half = Math.floor( this.fullName.length / 2 );
            // if the first part of the second half is a slash, increment half by 1 to include the slash in the first half.
            if ( this.fullName[ half ] === '/' ) {
                half++;
            }
            return this.fullName.substring( half );
        } else {
            return '';
        }
    }

    public get showReimportFromAlla(): boolean {
        if ( this.model.importType == ImportTypes.None || this.model.allakhazamUrl == null ) {
            return false;
        }
        if ( this.model.externalSource === ExternalDataSources.Allakhazam ) {
            // Allakhazam triggers move to EQ Spell Resources, which has no raid
            // ability generator.
            return this.model.importType !== ImportTypes.Ability;
        }
        return this.model.externalSource === ExternalDataSources.EqSpellResources;
    }

    /** Re-imports always come from EQ Spell Resources; Allakhazam is no longer used. */
    public get serviceName(): string {
        return this.model.importType != ImportTypes.None ? 'EQ Spell Resources' : 'None';
    }

    constructor( private ipcService: IpcService, private route: ActivatedRoute, public dialogService: DialogService, private snackBar: MatSnackBar ) { }

    ngOnInit() {
        this.model = new TriggerModel();

        this.route.params.subscribe( params => {
            
            this.triggerId = params[ 'id' ];
            this.folderId = params[ 'folderId' ];

            if ( this.triggerId != null ) {
                this.ipcService.getTrigger( this.triggerId ).subscribe( trigger => {
                    this.model = trigger;
                } );
                this.ipcService.getTriggerFullName( this.triggerId ).subscribe( fullName => this.fullName = fullName );
            }

            // In a real app: dispatch action to load the details here.
        } );
        
        this.ipcService.getAppIsDev().subscribe( isDev => this.isDev = isDev );
    }

    public closeModal(): void {
        this.ipcService.closeThisChild();
    }

    public onChangeTabs( index: number ): void {
        
    }

    public save(): Observable<boolean> {

        return new Observable( observer => {

            let listActionCount = this.model.actions?.filter( x => x.actionType === ActionTypes.List ).length ?? 0;

            if ( listActionCount > 1 ) {
                this.dialogService.showErrorDialog( 'Error!', 'Only one list action is allowed per trigger.' );
                observer.next( false );
                observer.complete();
                return;
            }

            this.model.actions?.forEach( ( action: TriggerAction ) => {
    
                if ( action.actionType === ActionTypes.StoreVariable ) {
                    // No special processing operations are required for store variable actions.
                    
                } else {
    
                    if ( action.useCustomColor === true ) {
                        action.overrideTimerColor = action.overrideTimerColor;
                        action.timerBackgroundColor = ColorUtility.FromHex( action.overrideTimerColor ).darken( 0.93 ).toString( 0.75 );
                    } else {
                        action.overrideTimerColor = null;
                        action.timerBackgroundColor = null;
                    }
    
                    if ( action.ifEndingSoon === true && action.endingDuration > 0 ) {
                        if ( action.endingSoonChangeColor === true ) {
                            action.endingSoonBackgroundColor = ColorUtility.FromHex( action.endingSoonColor ).darken( 0.93 ).toString( 0.75 );
                        } else {
                            action.endingSoonBackgroundColor = null;
                        }
                    } else {
                        action.endingDuration = null;
                        action.endingSoonColor = null;
                    }
    
                    if ( action.actionType === ActionTypes.Stopwatch || ( action.remainAfterEnded === true && action.remainDuration > 0 ) ) {
                        if ( action.endedChangeColor === true ) {
                            action.endedBackgroundColor = ColorUtility.FromHex( action.endedColor ).darken( 0.93 ).toString( 0.75 );
                        } else {
                            action.endedBackgroundColor = null;
                        }
                    } else {
                        action.remainAfterEnded = false;
                        action.remainDuration = null;
                        action.endedColor = null;
                        action.endedBackgroundColor = null;
                    }
    
                }
    
            } );

            if ( this.triggerId == null ) {
                this.model.folderId = this.folderId?.length > 0 ? this.folderId : null;
                this.ipcService.createNewTrigger( this.model ).subscribe( triggerId => {
                    this.triggerId = triggerId;
                    this.model.triggerId = triggerId;
                    observer.next( true );
                    observer.complete();
                } );
            } else {
                this.ipcService.updateTrigger( this.model ).subscribe( success => {
                    observer.next( success );
                    observer.complete();
                } );
            }
        } );

    }

    public saveAndClose(): void {
        this.save().subscribe( success => {
            if ( success ) {
                this.closeModal();
            }
        } );
    }

    public applyChanges(): void {
        this.save().subscribe();
    }

    public copyJson(excludeNull = false, format = false): void {
        let replacer = null;
        let space = 0;

        // Set replacer if we need to exclude nulls
        if (excludeNull) {
            replacer = (key: string, value: any) => value === null ? undefined : value;
        }

        // Set indentation if we need to format
        if (format) {
            space = 4;
        }

        // Stringify and copy
        this.ipcService.sendTextToClipboard(JSON.stringify(this.model, replacer, space));
        this.snackBar.open('Trigger details copied!', 'Dismiss', { duration: 5000 });
    }

    public reimportFromAllakhazam(): void {
        if ( this.model.externalSource === ExternalDataSources.Allakhazam ) {
            this.dialogService.showEqsrUrlDialog().subscribe( url => {
                if ( url ) {
                    this.model.allakhazamUrl = url;
                    this.model.externalSource = ExternalDataSources.EqSpellResources;
                    this.reimportFromAllakhazam();
                }
            } );
            return;
        }

        if ( this.model.importType === ImportTypes.DotTimer ) {
            this.reimportDotTimerFromAllakhazam();
        } else if ( this.model.importType === ImportTypes.Ability ) {
            this.reimportAbilityFromAllakhazam();
        } else if ( this.model.importType === ImportTypes.Buff || this.model.importType === ImportTypes.OthersBuff ) {
            this.reimportBuffFromAllakhazam();
        }
    }

    private reimportDotTimerFromAllakhazam(): void {
        this.dialogService.showReimportDotTimerDialog( this.model, this.model.externalSource );
    }

    private reimportAbilityFromAllakhazam(): void {
        this.dialogService.showReimportRaidAbilityDialog( this.model, this.model.externalSource );
    }

    private reimportBuffFromAllakhazam(): void {
        this.dialogService.showReimportBuffDialog( this.model, this.model.externalSource );
    }

}
