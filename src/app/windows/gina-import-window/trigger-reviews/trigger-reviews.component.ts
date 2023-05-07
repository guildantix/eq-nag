import { Component, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core';
import { NgForm } from '@angular/forms';
import { MatTable, MatTableDataSource } from '@angular/material/table';
import { ActionTypeLabels, ActionTypes, CapturePhrase, DuplicateTriggerAction, FileModel, OverlayWindowModel, OwnedTriggerAction, TimerRestartBehaviors, TriggerAction, TriggerFolder, TriggerModel } from 'src/app/core.model';
import { GinaConfiguration, GinaMultiSelectDataModel, GinaOverlayIds, GinaToNagOverlay, TriggerIdNameModel, TriggerReviewModel } from 'src/app/gina.model';
import * as _ from 'lodash-es';
import { IpcService } from 'src/app/ipc.service';
import { DialogService } from 'src/app/dialogs/dialog.service';
import { Observable, forkJoin, timer } from 'rxjs';
import { map } from 'rxjs/operators';
import { MatPaginator } from '@angular/material/paginator';
import { GinaImporter } from 'src/app/utilities/gina.import';
import { Dictionary } from 'lodash';
import { nagId } from 'src/app/core/nag-id.util';
import { MatTreeFlatDataSource, MatTreeFlattener } from '@angular/material/tree';
import { FlatTreeControl } from '@angular/cdk/tree';

interface DuplicateTriggerSubject {
    triggerId: string;
    phrase: string;
    subjectAction: TriggerAction;
}

interface ExampleFlatNode {
    expandable: boolean;
    name: string;
    level: number;
    folderId: string;
}
  
@Component( {
    selector: 'app-trigger-reviews',
    templateUrl: 'trigger-reviews.component.html',
    styleUrls: [ './trigger-reviews.component.scss', '../../../core.scss', '../../../modal.scss' ],
} )
export class TriggerReviewsComponent implements OnInit {

    private _transformer = ( node: TriggerFolder, level: number ) => {
        return {
            expandable: !!node.children && node.children.length > 0,
            name: node.name,
            level: level,
            active: node.active,
            // selected: node.selected,
            selected: false,
            folderId: node.folderId,
        };
    }
    public folderTreeControl = new FlatTreeControl<ExampleFlatNode>( node => node.level, node => node.expandable );
    public treeFlattener = new MatTreeFlattener(this._transformer, node => node.level, node => node.expandable, node => node.children);
    public folderDataSource = new MatTreeFlatDataSource(this.folderTreeControl, this.treeFlattener);
    hasChild = (_: number, node: ExampleFlatNode) => node.expandable;

    // public selectedGinaTriggers: GinaMultiSelectDataModel[] = [];
    private _selectedGinaTriggers: GinaMultiSelectDataModel[] = [];
    private audioFiles: FileModel[] = [];
    public get selectedGinaTriggers(): GinaMultiSelectDataModel[] {
        return this._selectedGinaTriggers;
    }
    @Input() public set selectedGinaTriggers( data: GinaMultiSelectDataModel[] ) {
        if ( data ) {
            // let observables: Observable<TriggerIdNameModel[]|any>[] = [ timer( 1 ) ];
            // this.triggers = triggers;
            this._selectedGinaTriggers = data;
            this.showGinaOverlayMapping();


            this.importedGinaObjects = [];
            data.forEach( t => {
                this.importedGinaObjects.push( t.model.ginaName );
            } );

            // this.ipcService.searchForDuplicates( _.map( triggers, f => f.nagTrigger ) ).subscribe( duplicateData => {
            //     console.log( 'duplicateData', duplicateData );
                
            //     this.triggers = triggers;
            //     this.tableData = new MatTableDataSource( this.triggers );
            //     this.tableData.paginator = this.paginator;

            // } );
        
            // forkJoin( observables ).subscribe( doesntmatter => {
            //     console.log( 'done' );
            //     this.triggers = triggers;
            //     this.tableData = new MatTableDataSource( this.triggers );
            //     this.tableData.paginator = this.paginator;
            // } );
        } else {
            this._selectedGinaTriggers = [];
        }
    }
    public triggers: TriggerReviewModel[] = [];
    public tableData: MatTableDataSource<TriggerReviewModel> = new MatTableDataSource( [] );

    public actionTypes: typeof ActionTypes = ActionTypes;
    public timerRestartBehaviors: typeof TimerRestartBehaviors = TimerRestartBehaviors;
    public panel: 'triggerList' | 'overlayAssignment' | 'duplicatesCheck' | 'foldersCheck' | 'default' = 'overlayAssignment';
    public ginaOverlayMapping: GinaToNagOverlay[] = [];
    public duplicates: DuplicateTriggerAction[] = [];
    public duplicateGroups: Record<string, DuplicateTriggerSubject[]> = {};
    public get duplicatePhrases(): string[] {
        return Object.keys( this.duplicateGroups );
    }
    public duplicateDetailsShown: Record<string, boolean> = {};
    public triggerMergeSelected: Record<string, Record<string, boolean>> = {};
    public triggerIgnoreSelected: Record<string, Record<string, boolean>> = {};
    public importedGinaObjects: string[] = [];

    @Input() public alertOverlays: OverlayWindowModel[] = [];
    @Input() public logOverlays: OverlayWindowModel[] = [];
    @Input() public timerOverlays: OverlayWindowModel[] = [];
    @Input() public categoryOverlayMap: Record<string, GinaOverlayIds> = {};
    @Input() public ginaConfig: GinaConfiguration;

    @Output() public onSpeak: EventEmitter<string> = new EventEmitter<string>();
    @Output() public onPlayAudioFileId: EventEmitter<string> = new EventEmitter<string>();
    
    @ViewChild( 'paginator', { static: false, read: MatPaginator } ) private paginator: MatPaginator;
    @ViewChild( 'triggersTable' ) private triggersTable: MatTable<any>;
    @ViewChild( 'mappingForm' ) private mappingForm: NgForm;

    constructor(
        private ipcService: IpcService,
        private dialogService: DialogService,
    ) {
        this.ipcService.getAudioFiles().subscribe( files => this.audioFiles = files );
    }

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

    public getAudioFilename( fileId: string ): string {
        return this.audioFiles.find( f => f.fileId === fileId )?.fileName;
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

    public generateTriggerModels(): Observable<any> {
        
        let obs = new Observable<any>( subscriber => {
            
            if ( this.selectedGinaTriggers?.length > 0 ) {
                let observables: Observable<TriggerReviewModel>[] = [];
                this.selectedGinaTriggers.forEach( gd => {
                    observables.push( GinaImporter.GetTrigger( gd.model.trigger, this.ipcService, this.ginaOverlayMapping, this.ginaConfig ).pipe( map( value => new TriggerReviewModel( value, gd.model, gd.folderFamily ) ) ) );
                } );
            
                // NOTE: For some reason, using concat() will stop processing
                // triggers when the observable uses the forkJoin operator inside of 
                // the subscriber.  When an audio file needs to be imported, the 
                // observable waits for that observable(s) to complete before 
                // completing the subscriber, and moving the concat to the next 
                // observable. 
                // ... observable observable observable.
            
                forkJoin( observables ).subscribe( triggers => {
                    this.triggers = triggers;

                    subscriber.next();
                    subscriber.complete();
                } );
            
            } else {
                subscriber.next();
                subscriber.complete();
            }

        } );
        return obs;
        
    }

    showGinaOverlayMapping() {

        this.ginaOverlayMapping = [];
        this.panel = 'overlayAssignment';

        this.ipcService.getSetting<GinaToNagOverlay[]>( 'ginaOverlayMapping' ).subscribe( data => {
            this.ginaOverlayMapping = data;

            if ( this.ginaConfig ) {
                
                let textOverlays = _.uniq( this.ginaConfig?.Categories?.Category?.filter( f => this.ginaOverlayMapping.find( x => x.GinaOverlay === f.TextOverlay && x.GinaOverlayType === 'text' ) == null ).map( f => f.TextOverlay ) );

                textOverlays.forEach( f => {
                    let m = new GinaToNagOverlay();
                    m.GinaOverlayType = 'text';
                    m.GinaOverlay = f;
                    this.ginaOverlayMapping.push( m );
                } );
                
                let timerOverlays = _.uniq( this.ginaConfig?.Categories?.Category?.filter( f => this.ginaOverlayMapping.find( x => x.GinaOverlay === f.TimerOverlay && x.GinaOverlayType === 'timer' ) == null ).map( f => f.TimerOverlay ) );
                timerOverlays.forEach( f => {
                    let m = new GinaToNagOverlay();
                    m.GinaOverlayType = 'timer';
                    m.GinaOverlay = f;
                    this.ginaOverlayMapping.push( m );
                } );
                
            }

        } );

    }

    updateGinaOverlayMapping() {

        if ( this.mappingForm.valid ) {
            this.panel = 'default';
            this.ipcService.updateSetting( 'ginaOverlayMapping', this.ginaOverlayMapping );
            this.generateTriggerModels().subscribe( () => {
                this.showDuplicates();
            } );
        }
    }

    public newFolderIds: string[] = [];
    isNewFolder( folderId: string ): boolean {
        return this.newFolderIds.indexOf( folderId ) > -1;
    }

    showFolderCheck() {
        this.panel = 'foldersCheck';

        this.ipcService.getTriggerFolders().subscribe( folders => {

            this.newFolderIds = [];
            let usedFolderIds: string[] = [];
            this.folderDataSource.data = [];

            this.triggers.forEach( trigger => {
                let folder: TriggerFolder = null;
                
                for ( let i = 0; i < trigger.ginaData.folders?.length; i++ ){
                    const folderName = trigger.ginaData.folders[ i ];

                    let subFolder = folder ? folder.children.find( f => f.name.toLowerCase() === folderName.toLowerCase() ) : folders.find( f => f.name.toLowerCase() === folderName.toLowerCase() );

                    if ( subFolder == null ) {
                        subFolder = new TriggerFolder();

                        subFolder.folderId = nagId();
                        subFolder.name = folderName;
                        subFolder.expanded = false;
                        subFolder.active = true;
                        subFolder.comments = 'Imported from Gina';
                        subFolder.children = [];
                        subFolder.folderConditions = [];

                        this.newFolderIds.push( subFolder.folderId );

                        if ( folder == null ) {
                            folders.push( subFolder );
                            // folderData.push( subFolder );
                        } else {
                            folder.children.push( subFolder );
                        }
                    }

                    trigger.nagTrigger.folderId = subFolder.folderId;
                    usedFolderIds.push( subFolder.folderId );
                    folder = subFolder;
                }
                
            } );

            // let folderData: TriggerFolder[] = [];

            this.folderDataSource.data = this.buildReviewFolderStructure( folders, usedFolderIds );
            this.folderTreeControl.expandAll();
        
        } );
        
    }

    buildReviewFolderStructure( folders: TriggerFolder[], usedIds: string[] ): TriggerFolder[] {
        let output: TriggerFolder[] = [];

        for ( let i = 0; i < folders?.length; i++ ) {
            if ( usedIds.indexOf( folders[ i ].folderId ) > -1 ) {
                let c = Object.assign( new TriggerFolder(), folders[ i ] );
                c.children = this.buildReviewFolderStructure( folders[ i ].children, usedIds );
                output.push( c );
            }
        }

        return output;
    }

    public newFolderMap: Record<string, string> = {};
    mapGinaFolder( newFolderId: string ): void {
        this.dialogService.showSelectTriggerFolderDialog( null, 'Select an existing folder', 'Select an existing folder that you would like to use.' ).subscribe( folderId => {
            let i = this.newFolderIds.indexOf( newFolderId );

            if ( folderId ) {
                this.newFolderMap[ newFolderId ] = folderId;
                
                if ( i > -1 ) {
                    this.newFolderIds.splice( i, 1 );
                }

            } else if ( this.newFolderMap[ newFolderId ] ) {
                delete this.newFolderMap[ newFolderId ];
                if ( i === -1 ) {
                    this.newFolderIds.push( newFolderId );
                }
            }

        } );
    }

    importTriggers() {
        // this.dialogService.showConfirmationDialog('Are you ready')
        this.panel = 'default';
    }

    showDuplicates() {

        this.duplicates = [];
        this.duplicateDetailsShown = {};
        this.triggerMergeSelected = {};
        this.triggerIgnoreSelected = {};
        this.panel = 'duplicatesCheck';

        this.ipcService.searchForDuplicates( _.map( this.triggers, f => f.nagTrigger ) ).subscribe( duplicateData => {
            console.log( 'duplicateData', duplicateData );
            
            if ( duplicateData?.length > 0 ) {
                this.duplicates = duplicateData;

                let subjectData: DuplicateTriggerSubject[] = [];
                for ( let i = 0; i < duplicateData?.length; i++ ) {
                    const d = duplicateData[ i ];
                    if ( subjectData.findIndex( f => f.triggerId === d.triggerId ) === -1 ) {
                        subjectData.push( {
                            triggerId: d.triggerId,
                            phrase: d.phrase,
                            subjectAction: d.subjectAction,
                        } );
                    }
                }

                this.duplicateGroups = _.groupBy( subjectData, f => f.phrase );
                let keys = this.duplicatePhrases;
                for ( let i = 0; i < keys.length; i++ ) {
                    this.triggerMergeSelected[ keys[ i ] ] = {};
                    this.triggerIgnoreSelected[ keys[ i ] ] = {};
                }
                console.log( 'grouped duplicates', this.duplicateGroups );
            } else {
                this.showFolderCheck();
            }

        } );
    }

    toggleFadeOut( el: HTMLElement ): void {
        if ( el.classList.contains( 'shown' ) ) {
            el.classList.remove( 'shown' );
        } else {
            el.classList.add( 'shown' );
        }
    }

    mergeSelected( phrase: string ): void {
        let targetTriggerId: string = null;
        for ( let i = this.duplicateGroups[ phrase ]?.length - 1; i >= 0; i-- ) {
            const triggerId = this.duplicateGroups[ phrase ][ i ].triggerId;

            if ( this.triggerMergeSelected[ phrase ][ triggerId ] === true ) {
                if ( targetTriggerId == null ) {
                    targetTriggerId = triggerId;
                } else {

                    if ( this.copyActionsToTrigger( targetTriggerId, triggerId ) ) {

                        this.removeFromImport( triggerId );
                
                        this.duplicateGroups[ phrase ].splice( i, 1 );
                        delete this.triggerMergeSelected[ phrase ][ triggerId ];
                    }
                }
            }
        }
        
        if ( this.duplicateGroups[ phrase ]?.length <= 1 ) {
            delete this.duplicateGroups[ phrase ];
        }
        
        if ( Object.keys( this.duplicateGroups )?.length === 0 ) {
            this.showFolderCheck();
        }
    }

    /**
     * Copies the actions of subject trigger onto target trigger.
     * 
     * @returns Returns true if the target and subject triggers were found.
     * 
     * @param targetTriggerId The id of the trigger actions should be copied to.
     * @param subjectTriggerId The id of the trigger actions should be copied from.
     * 
     */
    copyActionsToTrigger( targetTriggerId: string, subjectTriggerId: string ): boolean {
        // The copy action in the gina importer are simple because each trigger can execute only one capture phrase.
        let targetTrigger = this.triggers?.find( f => f.nagTrigger.triggerId === targetTriggerId )?.nagTrigger;
        let subjectTrigger = this.triggers?.find( f => f.nagTrigger.triggerId === subjectTriggerId )?.nagTrigger;

        if ( targetTrigger && subjectTrigger ) {
            let capturePhraseId = targetTrigger.capturePhrases[ 0 ].phraseId;
            subjectTrigger.actions.forEach( action => {
                action.phrases = [ capturePhraseId ];
                targetTrigger.actions.push( action );
            } );

            return true;
        }

        return false;
    }

    ignoreSelected( phrase: string ): void {
        for ( let i = this.duplicateGroups[ phrase ]?.length - 1; i >= 0; i-- ) {
            const triggerId = this.duplicateGroups[ phrase ][ i ].triggerId;
            if ( this.triggerIgnoreSelected[ phrase ][ triggerId ] === true ) {
                console.log( 'checked', triggerId );
                this.removeFromImport( triggerId );
                
                this.duplicateGroups[ phrase ].splice( i, 1 );
                delete this.triggerIgnoreSelected[ phrase ][ triggerId ];
            }
        }

        if ( this.duplicateGroups[ phrase ]?.length <= 1 ) {
            delete this.duplicateGroups[ phrase ];
        }
        
        if ( Object.keys( this.duplicateGroups )?.length === 0 ) {
            this.showFolderCheck();
        }
    }

    removeFromImport( triggerId: string ): void {
        
        // Remove this trigger from the triggers list.}
        _.remove( this.triggers, t => t.nagTrigger.triggerId === triggerId );

        // Remove this trigger from the duplicates list.
        _.remove( this.duplicates, d => d.triggerId === triggerId );

        // Remove all references of this trigger from the duplicates list.
        this.duplicates.forEach( dup => {
            _.remove( dup.actions, a => a.triggerId === triggerId );
        } );

    }

    /**
     * This will tell future Gina import runs to ignore all of the gina triggers in the current model.
     */
    updateGinaIgnoreList(): void {
        this.ipcService.getIgnoredGinaObjects().subscribe( ignoredGinaObjects => {
            let updatedList = _.uniq( Array.prototype.concat( ignoredGinaObjects, this.importedGinaObjects ) );
            this.ipcService.saveIgnoredGinaObjects( updatedList );
        } );
    }

    getTriggerName( triggerId: string ): string {
        let trigger = this.triggers.find( f => f.nagTrigger.triggerId == triggerId );
        return trigger?.nagTrigger.name ?? 'Unknown';
    }

    getTriggerFamily( triggerId: string ): string {
        let trigger = this.triggers.find( f => f.nagTrigger.triggerId == triggerId );
        return trigger?.folderFamilyName ?? 'Unknown';
    }

    getActionText( action: TriggerAction|OwnedTriggerAction ): string {
        return (action as TriggerAction)?.displayText ?? 'UNKNOWN';
    }

    getActionTypeLabel( actionType: ActionTypes ): string {
        return ActionTypeLabels( actionType );
    }

    isTimerType( actionType: ActionTypes ): boolean {
        return actionType === ActionTypes.Timer || actionType === ActionTypes.DotTimer || actionType === ActionTypes.BeneficialTimer || actionType === ActionTypes.Countdown;
    }

    public getDurationLabel( seconds: number | string ): string {
        
        seconds = +seconds;

        if ( seconds > 0 ) {
            let hours = Math.floor( seconds / 3600 );
            let mins = Math.floor( ( seconds % 3600 ) / 60 );
            let secs = seconds % 3600 % 60;
    
            let label = '';
    
            if ( hours > 0 ) {
                label += `${hours}h `;
            }
            if ( mins > 0 ) {
                label +=  `${mins}m `;
            }
            if ( secs > 0 ) {
                label +=  `${secs}s `;
            }

            return label;

        } else {
            return `${seconds}s`;

        }

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