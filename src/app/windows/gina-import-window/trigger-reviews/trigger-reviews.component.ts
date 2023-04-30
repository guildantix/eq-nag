import { Component, Input, OnInit, ViewChild, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { MatTable, MatTableDataSource } from '@angular/material/table';
import { ActionTypes, CapturePhrase, DuplicateTriggerAction, OverlayWindowModel, TriggerModel } from 'src/app/core.model';
import { GinaConfiguration, GinaOverlayIds, GinaToNagOverlay, TriggerIdNameModel, TriggerReviewModel } from 'src/app/gina.model';
import * as _ from 'lodash-es';
import { IpcService } from 'src/app/ipc.service';
import { DialogService } from 'src/app/dialogs/dialog.service';
import { Observable, forkJoin, timer } from 'rxjs';
import { map } from 'rxjs/operators';
import { MatPaginator } from '@angular/material/paginator';

@Component( {
    selector: 'app-trigger-reviews',
    templateUrl: 'trigger-reviews.component.html',
    styleUrls: [ './trigger-reviews.component.scss', '../../../core.scss', '../../../modal.scss' ],
    providers: [
        {
            provide: NG_VALUE_ACCESSOR,
            useExisting: forwardRef( () => TriggerReviewsComponent ),
            multi: true
        }
    ],
} )
export class TriggerReviewsComponent implements OnInit, ControlValueAccessor {

    public triggers: TriggerReviewModel[] = [];
    public tableData: MatTableDataSource<TriggerReviewModel> = new MatTableDataSource( [] );

    _onChange: () => void = () => { }
    _onTouch: () => void = () => { }
    
    public disabled: boolean = false;
    public actionTypes: typeof ActionTypes = ActionTypes;
    public panel: 'triggerList' | 'overlayAssignment' | 'duplicatesCheck' | 'default' = 'overlayAssignment';
    public ginaOverlayMapping: GinaToNagOverlay[] = [];
    public duplicates: DuplicateTriggerAction[] = [];

    @Input() public alertOverlays: OverlayWindowModel[] = [];
    @Input() public logOverlays: OverlayWindowModel[] = [];
    @Input() public timerOverlays: OverlayWindowModel[] = [];
    @Input() public categoryOverlayMap: Record<string, GinaOverlayIds> = {};
    @Input() public ginaConfig: GinaConfiguration;
    
    @ViewChild( 'paginator', { static: false, read: MatPaginator } ) private paginator: MatPaginator;
    @ViewChild( 'triggersTable' ) private triggersTable: MatTable<any>;

    constructor(
        private ipcService: IpcService,
        private dialogService: DialogService,
    ) { }

    ngOnInit() { }

    public showCapturePhraseSuggestion( trigger: TriggerModel ): boolean {
        if ( trigger == null ) {
            return false;
        } else {
            let bad = _.some( trigger.capturePhrases, ( cp: CapturePhrase ) => {
                if ( cp.phrase ) {
                    if ( !cp.useRegEx ) {
                        return true;
                    } else if ( !cp.phrase.startsWith( '^' ) ) {
                        return true;
                    } else if ( !cp.phrase.endsWith( '$' ) ) {
                        return true;
                    } else if ( cp.phrase.endsWith( '.$' ) && !cp.phrase.endsWith( '\\.$' ) ) {
                        return true;
                    }
                } else {
                    return true;
                }

                return false;
            } );
            return bad;
        }
    }

    public getInvalidCapturePhrases( trigger: TriggerModel ): CapturePhrase[] {
        if ( trigger == null ) {
            return [];
        } else {
            let bad = _.filter( trigger.capturePhrases, ( cp: CapturePhrase ) => {
                if ( cp.phrase ) {
                    if ( !cp.useRegEx ) {
                        return true;
                    } else if ( !cp.phrase.startsWith( '^' ) ) {
                        return true;
                    } else if ( !cp.phrase.endsWith( '$' ) ) {
                        return true;
                    } else if ( cp.phrase.endsWith( '.$' ) && !cp.phrase.endsWith( '\\.$' ) ) {
                        return true;
                    }
                } else {
                    return true;
                }

                return false;
            } );
            return bad;
        }
    }

    public emitChange() {
        this._onChange();
    }

    writeValue( triggers: TriggerReviewModel[] ): void {
        
        if ( triggers ) {
            let observables: Observable<TriggerIdNameModel[]|any>[] = [ timer( 1 ) ];
        
            this.ipcService.searchForDuplicates( _.map( triggers, f => f.nagTrigger ) ).subscribe( duplicateData => {
                console.log( 'duplicateData', duplicateData );
                
                this.triggers = triggers;
                this.tableData = new MatTableDataSource( this.triggers );
                this.tableData.paginator = this.paginator;

                if ( this.ginaConfig ) {
                    this.ginaOverlayMapping = [];
                    let textOverlays = _.uniq( this.ginaConfig?.Categories?.Category?.map( f => f.TextOverlay ) );
                    textOverlays.forEach( f => {
                        let m = new GinaToNagOverlay();
                        m.GinaOverlayType = 'text';
                        m.GinaOverlay = f;
                        this.ginaOverlayMapping.push( m );
                    } );
                    
                    let timerOverlays = _.uniq( this.ginaConfig?.Categories?.Category?.map( f => f.TimerOverlay ) );
                    timerOverlays.forEach( f => {
                        let m = new GinaToNagOverlay();
                        m.GinaOverlayType = 'timer';
                        m.GinaOverlay = f;
                        this.ginaOverlayMapping.push( m );
                    } );
                    // this.ginaConfig?.Categories?.Category?.forEach( ginaCategory => {
                    //     let m = new GinaToNagOverlay();
                    //     m.GinaCategoryName = ginaCategory.Name;
                    //     m.GinaTextOverlay = ginaCategory.TextOverlay;
                    //     m.GinaTimerOverlay = ginaCategory.TimerOverlay;
                    //     this.ginaOverlayMapping.push( m );
                    // } );
                }
            } );
        
            // forkJoin( observables ).subscribe( doesntmatter => {
            //     console.log( 'done' );
            //     this.triggers = triggers;
            //     this.tableData = new MatTableDataSource( this.triggers );
            //     this.tableData.paginator = this.paginator;
            // } );
        } else {
            this.triggers = [];
        }
    }
  
    registerOnChange( fn: any ) {
        this._onChange = fn
    }
  
    registerOnTouched( fn: any ) {
        this._onTouch = fn
    }

    setDisabledState?( isDisabled: boolean ): void {
        this.disabled = isDisabled;
    }

}

// TODO: Move the gina config loading into a new thread.
// TODO: Using the gina config loading thread, also process finding duplicates in the same thread window.

// TODO: Auto mapping of gina overlays based on weighted use between the incoming triggers and the defaults, vs existing triggers and overlay usage.  Use closest to instead of going from most used to less used.

//      Overlay | Nag no. | Gina no. | Gina Name
//     ---------+---------+----------+-------------
//      A       | 123     | 423      | Default
//      C       | 96      |          | --
//      E       | 75      | 56       | Detrimental
//      B       | 12      | 5        | Left
//      D       | 1       |          | --

// Primary rule, overlays get matched if the names are exactly equal, regardless of use counts.
// Secondary rule, match overlays by type and use counts, as close as possible.  It's not a race, the most matches don't win the assignment/mapping.
// Special rule: Overlays with a single mapping get mapped to the same named overlay, or the lowest.  If a gina overlay has 2+, next lowest > 1 mapping count.

// Snaggle: After the assignments are applied, the counts will change which will affect the next set of imports... Maybe normalize the data, weighted by total percentage of triggers from nag to the selected import triggers (or all gina triggers? yes, definitely this).

// NOTES:

// 1. We need to map Gina overlays to Nag overlays, and store that data for later use.  We still need to show the screen on the next import, but it should auto-select the last selected values.
// 2. We need a quicker duplicate check function.  To that end, we really only care if we're actually getting the same trigger multiple times.  Even moreso, that we're not getting duplicate timers and god forbid speaking alerts.
//  a. Here are some examples: Your skin freezes over => skin freeze, this will both operate with each other.  However, we really only care if the actions are also the same actions taken.  Not that the text/timer is the same, but they're both speaking actions?
//  b. We should also limit the results by the conditions, if the two triggers are in different zones then they won't conflict.
//  c. We need to send the entire list of trigger objects to the back-end for checking, and possibly spin up a new thread that performs the checks, and sends back status updates (0%-100% complete).

// More example thoughts:
// Sequentials, if gina capture matches any of the sequence.  The gina trigger will still fire even though the sequential may not if the first phrase was not captured.