import { animate, state, style, transition, trigger } from '@angular/animations';
import { FlatTreeControl } from '@angular/cdk/tree';
import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { MatTreeFlatDataSource, MatTreeFlattener } from '@angular/material/tree';
import { forkJoin, Observable } from 'rxjs';
import { DialogService } from 'src/app/dialogs/dialog.service';
import { GinaConfiguration, GinaMultiSelectDataModel, GinaOverlayIds, GinaPhoneticTransform, GinaTimerTypes, GinaTreeNode, GinaTreeObject, GinaTrigger, GinaTriggerGroup, TriggerReviewModel } from 'src/app/gina.model';
import { IpcService } from 'src/app/ipc.service';
import * as _ from 'lodash-es';
import { ContextMenuModel } from 'src/app/context-menu/context-menu.model';
import { GinaImporter } from '../../utilities/gina.import';
import { ActionTypes, CapturePhrase, OperatorTypes, OverlayWindowModel, TriggerAction, TriggerCondition, TriggerConditionTypes, TriggerFolder, TriggerModel } from 'src/app/core.model';
import { MatTabGroup } from '@angular/material/tabs';
import { customAlphabet } from 'nanoid';
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const nanoid = customAlphabet( alphabet, 16 );
import { MatSnackBar } from '@angular/material/snack-bar';
import { nagId } from 'src/app/core/nag-id.util';
import { map } from 'rxjs/operators';

@Component( {
    selector: 'app-gina-import-window',
    templateUrl: 'gina-import-window.component.html',
    styleUrls: [ 'gina-import-window.component.scss', '../../core.scss', '../../modal.scss' ],
    animations: [
        trigger( 'detailExpand', [
            state( 'collapsed', style( { height: '0px', minHeight: '0' } ) ),
            state( 'expanded', style( { height: '*' } ) ),
            transition( 'expanded <=> collapsed', animate( '225ms cubic-bezier(0.4, 0.0, 0.2, 1)' ) ),
        ] ),
    ],
} )
export class GinaImportWindowComponent implements OnInit {

    private _transformer = ( node: GinaTreeObject, level: number ) => {
        let m = <GinaTreeNode>{
            expandable: node.children?.length > 0,
            name: node.name,
            level: level,
            item: node.phoneticTransform ? node.phoneticTransform : node.trigger,
            ginaName: node.ginaName,
            imported: node.imported,
            folders: node.folders,
            id: node.id,
        };

        Object.defineProperty( m, 'selected', {
            get: () => node.selected,
            set: ( v: boolean ) => {
                this.updateFolderHierarchySelectedState( node, v );
                this.checkForMultipleSelects();
                if ( this.hasMultipleSelected ) {
                    this.generateFlatSelectData();
                }
            },
        } );

        return m;
    }
    public treeControl = new FlatTreeControl<GinaTreeNode>( node => node ? node.level : 1, node => node.expandable );
    public treeFlattener = new MatTreeFlattener<GinaTreeObject, GinaTreeNode, GinaTreeNode>(this._transformer, node => node.level, node => node.expandable, node => node.children);
    public dataSource = new MatTreeFlatDataSource( this.treeControl, this.treeFlattener );
    public expandedNodes: string[] = [];
    public hasChild = ( _: number, node: GinaTreeNode ) => node.expandable;
    public isSelected = ( _: number, node: GinaTreeNode ) => node.selected;
    public hasChildIsSelected = ( _: number, node: GinaTreeNode ) => node.selected && node.expandable;
    public selectedGinaData: GinaMultiSelectDataModel[] = [];
    public startReview: boolean = false;
    public categoryOverlayMap: Record<string, GinaOverlayIds> = {};
    public ginaConfig: GinaConfiguration = null;

    public loadingGinaConfig: boolean = true;
    public showImported: boolean = false;
    public importedTriggerNames: string[] = [];
    public importedPhoneticTransforms: string[] = [];
    public ignoredGinaObjects: string[] = [];
    public hasMultipleSelected: boolean = false;

    public selectedPhoneticTransform: GinaPhoneticTransform = null;
    public selectedTrigger: GinaTrigger = null;
    public selectedGinaName: string = null;
    public selectedGinaFolders: string[] = null;

    public voiceOptions: SpeechSynthesisVoice[] = [];
    public voiceIndex: number;
    public ginaTimerTypes: typeof GinaTimerTypes = GinaTimerTypes;
    
    public actionTypes: typeof ActionTypes = ActionTypes;
    public overlays: OverlayWindowModel[] = [];
    public eqZones: string[] = [];
    public triggerFolders: TriggerFolder[] = [];
    
    public get alertOverlays(): OverlayWindowModel[] {
        return this.overlays.filter( f => f.overlayType === 'Alert' );
    }

    public get logOverlays(): OverlayWindowModel[] {
        return this.overlays.filter( f => f.overlayType === 'Log' );
    }

    public get timerOverlays(): OverlayWindowModel[] {
        return this.overlays.filter( f => f.overlayType === 'Timer' );
    }

    public triggerReviews: TriggerReviewModel[] = [];
    public nTrigger: TriggerModel;
    public duplicateTriggers: TriggerModel[] = [];
    public skipDuplicateTriggerCheck: boolean = false;
    public get showCapturePhraseSuggestion(): boolean {
        if ( this.nTrigger == null ) {
            return false;
        } else {
            let bad = _.some( this.nTrigger.capturePhrases, ( cp: CapturePhrase ) => {
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
    public get showMissingOverlays(): boolean {
        if ( this.nTrigger == null ) {
            return false;
        } else {
            let bad = _.some( this.nTrigger.actions, ( ac: TriggerAction ) => {
                if ( ac.actionType === ActionTypes.DisplayText ) {
                    return ac.overlayId == null;
                } else if ( ac.actionType === ActionTypes.Countdown || ac.actionType === ActionTypes.DotTimer || ac.actionType === ActionTypes.Timer || ac.actionType === ActionTypes.Stopwatch || ac.actionType === ActionTypes.BeneficialTimer ) {
                    return ( ac.overlayId == null || (ac.ifEndingSoon && ac.endingSoonDisplayText && ac.endingSoonTextOverlayId == null) || (ac.notifyWhenEnded && ac.endedDisplayText && ac.endedTextOverlayId == null) )
                }
            } );
            return bad;
        }
    }
    public get showDuplicateTriggers(): boolean {
        return this.duplicateTriggers?.length > 0;
    }

    @ViewChild( 'nTriggerTabs', { static: false, read: MatTabGroup } ) public nTriggerTabs: MatTabGroup;
    @ViewChild( 'scrollingElement' ) public scrollingElement: ElementRef<HTMLDivElement>;

    constructor( private ipcService: IpcService, private dialogService: DialogService, private snackBar: MatSnackBar ) {
        speechSynthesis.onvoiceschanged = () => {
            this.voiceOptions = speechSynthesis.getVoices();
        };
    }

    ngOnInit() {

        let tickSub = this.ipcService.tickReceived().subscribe( data => {
            // this.dkpEntries = data.dkpEntries;
            // this.logFile = data.logFile;
            this.voiceIndex = data.voiceIndex;
            this.ignoredGinaObjects = data.ignoredGinaObjects?.length > 0 ? data.ignoredGinaObjects : [];
            this.overlays = data.overlays;
            
            data.triggers?.forEach( trigger => {
                this.importedTriggerNames.push( trigger.importIdentifier );
            } );

            this.importedPhoneticTransforms = Object.keys( data.phoneticTransforms ?? {} );
            
            this.loadGinaConfig();

            // We need to ignore other ticks.
            tickSub.unsubscribe();

        } );
        
        this.ipcService.requestTick();
        this.ipcService.getEverquestZones().subscribe( zones => this.eqZones = zones );
        this.ipcService.getTriggerFolders().subscribe( folders => {
            this.triggerFolders = folders;
        } );

    }

    /**
     * Reloads the current gina configuration, showing or hiding imported items.
     * 
     * @param showImported If true, the tree will show imported items. If false, it will hide imported items.
     */
    public onShowImportedChange( showImported: boolean ): void {
        this.showImported = showImported;
        this.dataSource.data = [];
        this.loadGinaConfig( true );
    }

    public loadGinaConfig( refreshCache: boolean = false ): void {

        refreshCache = refreshCache === true;

        if ( refreshCache ) {
            this.loadingGinaConfig = true;
        }

        this.ipcService
            .getGinaConfiguration( refreshCache )
            .subscribe( ginaConfig => {
                if ( ginaConfig == null ) {
                    this.dialogService.showWarningDialog( 'GINA failure', 'Could not find the GINA data directory' );
                } else {
                    this.ginaConfig = ginaConfig;

                    // Build the category to overlay map
                    ginaConfig.Categories.Category.forEach( category => {
                        this.categoryOverlayMap[ category.Name ] = { textOverlayName: category.TextOverlay, timerOverlayName: category.TimerOverlay };
                    } );
                    let transformsNode = new GinaTreeObject();
                    let data: GinaTreeObject[] = [];
                    transformsNode.name = 'Phonetic Transforms';
                    transformsNode.ginaName = 'INTERNAL:Transforms Group';
                    ginaConfig.Settings?.PhoneticTransforms?.Transform?.forEach( transform => {
                        transformsNode.children.push( {
                            name: transform.ActualWord,
                            children: [],
                            trigger: null,
                            phoneticTransform: transform,
                            ginaName: `${transform.ActualWord}`,
                            imported: this.ignoredGinaObjects.indexOf( transform.ActualWord ) > -1 || this.importedPhoneticTransforms.indexOf( transform.ActualWord ) > -1,
                            folders: [ 'Phonetic Transforms' ],
                            selected: false,
                            id: nagId(),
                        } );
                    } );

                    if ( transformsNode.children.length > 0 ) {
                        transformsNode.imported = !_.some( transformsNode.children, n => n.imported === false );
                        data.push( transformsNode );
                    }

                    data = data.concat( this.getGinaTriggerGroupNodes( ginaConfig.TriggerGroups.TriggerGroup, 'GINA:', [] ) );
                    
                    this.trimGroups( data );
                    this.dataSource.data = data;
                    
                    this.treeControl.dataNodes?.forEach( n => {
                        if ( this.expandedNodes.indexOf( n.ginaName ) > -1 ) {
                            this.treeControl.expand( n );
                        }
                    } );
                    this.loadingGinaConfig = false;

                }
            } );

    }

    private trimGroups( data: GinaTreeObject[] ): void {
        _.remove( data, c => c.imported && !this.showImported );
        data?.forEach( group => {
            if ( group.children?.length > 0 ) {
                this.trimGroups( group.children );
            }
        } );
    }

    private getGinaTriggerGroupNodes( groups: GinaTriggerGroup[], ginaName: string, ginaFolders: string[] ): GinaTreeObject[] {
        let nodes: GinaTreeObject[] = [];

        groups?.forEach( group => {
            let groupNode = new GinaTreeObject();

            groupNode.id = nagId();
            groupNode.name = group.Name;
            groupNode.ginaName = `${ginaName}/${group.Name}`;
            groupNode.folders = ginaFolders.concat( [ group.Name ] );
            groupNode.selected = false;

            if ( group.TriggerGroups?.TriggerGroup?.length > 0 ) {
                groupNode.children = this.getGinaTriggerGroupNodes( group.TriggerGroups.TriggerGroup, groupNode.ginaName, groupNode.folders );
            }

            group.Triggers?.Trigger?.forEach( trigger => {
                groupNode.children.push( {
                    name: trigger.Name,
                    children: [],
                    trigger: trigger,
                    phoneticTransform: null,
                    ginaName: `${groupNode.ginaName}/${trigger.Name}`,
                    imported: this.ignoredGinaObjects.indexOf( `${groupNode.ginaName}/${trigger.Name}` ) > -1 || this.importedTriggerNames.indexOf( `${groupNode.ginaName}/${trigger.Name}` ) > -1,
                    folders: groupNode.folders,
                    selected: false,
                    id: nagId(),
                } );
            } );
            
            if ( groupNode.children?.length > 0 ) {
                groupNode.imported = !_.some( groupNode.children, n => n.imported === false );
                nodes.push( groupNode );
            }
        } );

        return nodes;
    }

    public selectForImport( item: GinaTrigger | GinaPhoneticTransform, ginaName: string, ginaFolders: string[] ): void {

        this.selectedGinaName = ginaName;
        this.selectedGinaFolders = ginaFolders;
        this.showZoneNameDialog = true;
        this.skipDuplicateTriggerCheck = false;
        this.duplicateTriggers = null;
        this.nTrigger = null;

        if ( 'ActualWord' in item ) {
            this.selectedPhoneticTransform = item;
        } else {
            this.selectedTrigger = item;
        }
    }

    public speakPhrase( phrase: string ): void {
        var utter = new SpeechSynthesisUtterance();
        utter.text = phrase;
        utter.voice = this.voiceOptions[ this.voiceIndex ];
        utter.onend = function ( event ) { }
        utter.rate = 1;
        speechSynthesis.speak( utter );
    }

    public importPhoneticTransform( transform: GinaPhoneticTransform ): void {
        this.ipcService.getPhoneticTransforms().subscribe( transforms => {
            transforms[ transform.ActualWord ] = transform.PhoneticWord;
            this.ipcService.savePhoneticTransforms( transforms );
            this.selectedPhoneticTransform = null;
            this.selectedGinaName = null;
            this.selectedGinaFolders = null;
        } );
    }

    public getGinaTreeObject( ginaName: string, data: GinaTreeObject[] ): GinaTreeObject {
        
        for ( let i = 0; i < data.length; i++ ) {
            
            if ( data[ i ].ginaName === ginaName ) {
                return data[ i ];
            }
            
            if ( data[ i ].children?.length > 0 ) {
                let found = this.getGinaTreeObject( ginaName, data[ i ].children );
                if ( found ) {
                    return found;
                }
            }

        }
    }

    public onExpand( node: GinaTreeNode ): void {
        if ( this.treeControl.isExpanded( node ) ) {
            this.expandedNodes.push( node.ginaName );
        } else {
            _.remove( this.expandedNodes, n => n === node.ginaName );
        }
    }

    public playAudioFile( path: string ): void {
        let player = new Audio( `file://${path}` );
        player.play();
    }

    public playAudioFileId( fileId: string ): void {
        this.ipcService.getAudioFileUrl( fileId ).subscribe( url => {
            let player = new Audio( url );
            player.play();
        } );
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

    /**
     * Returns a context menu definition for the specified gina object.
     * 
     * @param node The gina tree node.
     */
    public getObjectContextMenu( node: GinaTreeNode ): ContextMenuModel[] {
        let context = '';
        if ( 'ActualWord' in node.item ) {
            context = 'transform';
        } else {
            context = 'trigger';
        }
        return [ <ContextMenuModel>{
            label: `Ignore this ${context}`,
            action: () => this.ignoreThisGinaObject( node ),
            disabled: () => false,
            hide: () => false,
            matIcon: 'remove_circle',
        } ];
    }

    public getGroupContextMenu( node: GinaTreeNode ): ContextMenuModel[] {

        return [ <ContextMenuModel>{
            label: `Ignore this group`,
            action: () => this.ignoreThisGinaGroup( node ),
            disabled: () => false,
            hide: () => false,
            matIcon: 'remove_circle',
        } ];

    }

    public ignoreThisGinaGroup( node: GinaTreeNode ): void {
        
        this.dialogService
            .showConfirmDialog( [`Are you sure you want to ignore ${node.name}?`,`This action will ignore all triggers in this group and all triggers in all sub-groups.`],
                `Click "Yes" to remove all triggers and sub-groups from ${node.name} and never see them again.`,
                `Click "No" to cancel and close this dialog without ignoring this ${node.name}.`,
                ( confirmed ) => {
                    if ( confirmed ) {
                        let obj = this.getGinaTreeObject( node.ginaName, this.dataSource.data );
                        this.addAllToIgnoredObjects( obj );
                        this.ipcService.saveIgnoredGinaObjects( this.ignoredGinaObjects );
                    }
                } );
        
    }

    public addAllToIgnoredObjects( group: GinaTreeObject ): void {
        if ( group.children?.length > 0 ) {
            group.children.forEach( child => this.addAllToIgnoredObjects( child ) );
        } else {
            if ( this.selectedGinaName == group.ginaName ) {
                this.selectedGinaName = null;
                this.selectedTrigger = null;
                this.showZoneNameDialog = true;
                this.skipDuplicateTriggerCheck = false;
                this.duplicateTriggers = null;
                this.nTrigger = null;
                this.selectedGinaFolders = null;
            }
            this.ignoredGinaObjects.push( group.ginaName );
        }
    }

    public ignoreThisGinaObject( node: GinaTreeNode ): void {
        let context = '';
        if ( 'ActualWord' in node.item ) {
            context = 'transform';
        } else {
            context = 'trigger';
        }
        this.dialogService
            .showConfirmDialog( `Are you sure you want to ignore ${node.name}?`,
                `Click "Yes" to remove this ${context} from the list and never see it again.`,
                `Click "No" to cancel and close this dialog without ignoring this ${context}.`,
                ( confirmed ) => {
                    if ( confirmed ) {
                        if ( this.selectedGinaName == node.ginaName ) {
                            this.selectedGinaName = null;
                            this.selectedTrigger = null;
                            this.showZoneNameDialog = true;
                            this.skipDuplicateTriggerCheck = false;
                            this.duplicateTriggers = null;
                            this.nTrigger = null;
                            this.selectedGinaFolders = null;
                        }
                        this.ignoredGinaObjects.push( node.ginaName );
                        this.ipcService.saveIgnoredGinaObjects( this.ignoredGinaObjects );
                    }
                } );
    }

    public createTriggerModel(): void {
        GinaImporter.GetTrigger( this.selectedTrigger, this.ipcService ).subscribe( n => this.nTrigger = n );
    }

    public alertMissingOverlays( overlayType: string ): void {
        this.dialogService.showErrorDialog( `Missing Overlays`, `Could not find an overlay of type [${overlayType}].` );
    }

    /**
     * Shows the edit trigger dialog for the specified trigger.
     * 
     * @param triggerId The id of the desired trigger.
     */
    public showEditTriggerDialog( triggerId: string ): void {
        this.ipcService.showEditTriggerDialog( triggerId );
    }

    public changeTimerType( newType: GinaTimerTypes ): void {
        this.selectedTrigger.TimerType = newType;
    }









    /**
     * Asks the user for a zone name, and adds that to the trigger as a 
     * condition for CurrentZone.
     * 
     * @param onZoneAdded Callback executed when the user enters in a zone name.
     */
    public requestZoneName( onZoneAdded: () => void ): void {
        this.dialogService
            .showAutocompleteDialog(
                'Restrict by zone',
                [ 'Enter the name of the zone as it appears in the log.' ],
                this.eqZones,
                'EverQuest Zone Name',
                'You can enter any value you want, or choose from the list.' )
            .subscribe( zone => {
                if ( zone ) {
                    this.zoneName = zone;
                                    
                    this.nTrigger.conditions = this.nTrigger.conditions?.length > 0 ? this.nTrigger.conditions : [];
                    let zoneCondition = new TriggerCondition();
                    zoneCondition.conditionId = nanoid();
                    zoneCondition.conditionType = TriggerConditionTypes.VariableValue;
                    zoneCondition.operatorType = OperatorTypes.Contains;
                    zoneCondition.variableName = 'CurrentZone';
                    zoneCondition.variableValue = zone;
                    this.nTrigger.conditions.push( zoneCondition );

                    if ( onZoneAdded ) {
                        onZoneAdded();
                    }
                }
            } );
    }










    private showZoneNameDialog: boolean = true;
    private zoneName: string = null;

    /**
     * Starts the actual import process, gathering and verifying data.
     */
    public importTrigger(): void {
        
        if ( this.showZoneNameDialog ) {
            
            this.dialogService
                .showConfirmDialog(
                    [ `Should this trigger only be enabled for a single zone?`, `You can change your selection in the general tab under Conditions.` ],
                    `Click "Yes" to add a zone restriction to this trigger.`,
                    `Click "No" to continue without adding a zone restriction.`,
                    ( confirmed ) => {
                        if ( confirmed ) {
                            this.requestZoneName( () => {
                                this.showZoneNameDialog = false;
                                this.importTrigger();
                            } );
                        } else {
                            this.showZoneNameDialog = false;
                            this.importTrigger();
                        }
                    } );

        } else if ( this.showMissingOverlays ) {
            this.dialogService
                .showConfirmDialog(
                    [ `Not all triggers have an overlay.`, `Would you like to auto-select appropriate overlays?` ],
                    `Click "Yes" to auto-select an appropriate overlay for all actions.`,
                    `Click "No" to cancel and close this dialog.`,
                    confirmed => {
                        if ( confirmed ) {
                            let allSelected = true;

                            this.nTrigger?.actions?.forEach( ac => {
                                if ( ac.overlayId == null && ac.actionType === ActionTypes.DisplayText ) {
                                    
                                    if ( this.alertOverlays?.length > 0 ) {
                                        ac.overlayId = this.alertOverlays[ 0 ]?.overlayId;
                                    } else {
                                        this.alertMissingOverlays( 'Alert Overlay' );
                                        allSelected = false;
                                        return;
                                    }

                                } else if ( ac.actionType === ActionTypes.Countdown || ac.actionType === ActionTypes.DotTimer || ac.actionType === ActionTypes.Timer || ac.actionType === ActionTypes.Stopwatch || ac.actionType === ActionTypes.BeneficialTimer ) {
                                    
                                    if ( ac.overlayId == null ) {
                                        if ( this.timerOverlays?.length > 0 ) {
                                            ac.overlayId = this.timerOverlays[ 0 ]?.overlayId;
                                        } else {
                                            this.alertMissingOverlays( 'Timer Overlay' );
                                            allSelected = false;
                                            return;
                                        }
                                    }

                                    if ( ac.ifEndingSoon && ac.endingSoonDisplayText && ac.endingSoonTextOverlayId == null ) {
                                        if ( this.alertOverlays?.length > 0 ) {
                                            ac.endingSoonTextOverlayId = this.alertOverlays[ 0 ]?.overlayId;
                                        } else {
                                            this.alertMissingOverlays( 'Alert Overlay' );
                                            allSelected = false;
                                            return;
                                        }
                                    }

                                    if ( ac.notifyWhenEnded && ac.endedDisplayText && ac.endedTextOverlayId == null ) {
                                        if ( this.alertOverlays?.length > 0 ) {
                                            ac.endedTextOverlayId = this.alertOverlays[ 0 ]?.overlayId;
                                        } else {
                                            this.alertMissingOverlays( 'Alert Overlay' );
                                            allSelected = false;
                                            return;
                                        }
                                    }
                                    
                                }
                            } );

                            if ( allSelected ) {
                                this.importTrigger();
                            }
                        }
                    } );
        } else if ( !this.skipDuplicateTriggerCheck ) {
            let phrases = [];
            let speakText = [];
            let displayText = [];
            let clipboardText = [];

            this.nTrigger.capturePhrases.forEach( p => phrases.push( p.phrase ) );
            this.nTrigger.actions.forEach( action => {
                
                if ( action.actionType === ActionTypes.Speak ) {
                    speakText.push( action.displayText );
                } else if ( action.actionType === ActionTypes.DisplayText ) {
                    displayText.push( action.displayText );
                } else if ( action.actionType === ActionTypes.Clipboard ) {
                    clipboardText.push( action.displayText );
                } else if ( action.actionType === ActionTypes.Countdown || action.actionType === ActionTypes.Timer || action.actionType === ActionTypes.DotTimer ) {
                    displayText.push( action.displayText );
                    if ( action.endingSoonDisplayText ) {
                        displayText.push( action.endingSoonText );
                    }
                    if ( action.endedDisplayText ) {
                        displayText.push( action.endedText );
                    }
                    if ( action.endingClipboard ) {
                        clipboardText.push( action.endingClipboardText );
                    }
                    if ( action.endedClipboard ) {
                        clipboardText.push( action.endedClipboardText );
                    }
                    if ( action.endingSoonSpeak ) {
                        speakText.push( action.endingSoonSpeakPhrase );
                    }
                    if ( action.endedSpeak ) {
                        speakText.push( action.endedSpeakPhrase );
                    }
                }

            } );

            this.ipcService
                .searchTriggerProperties( phrases, speakText, displayText, clipboardText, this.nTrigger.name, this.nTrigger.comments )
                .subscribe( matches => {
                    this.skipDuplicateTriggerCheck = true;
                    if ( matches?.length > 0 ) {
                        this.duplicateTriggers = matches;
                        this.scrollingElement.nativeElement.scrollTop = 0;
                        this.nTriggerTabs.selectedIndex = 3;
                    } else {
                        this.importTrigger();
                    }
                } );
        } else if ( this.nTrigger.folderId == null ) {
            let autoFolder = this.getTriggerFolder();
            if ( autoFolder == null ) {
                this.dialogService.showConfirmDialog(
                    [ `An existing trigger folder could not be found.`, `Would you like to auto-generate the folder structure?` ],
                    `Click "Yes" to auto-generate the missing folders.`,
                    `Click "No" to select an existing folder.`,
                    ( confirmed ) => {
                        if ( confirmed ) {
                            this.createTriggerFolder( folder => {
                                this.nTrigger.folderId = folder.folderId;
                                this.importTrigger();
                            } );
                        } else {
                            this.selectExistingFolder();
                        }
                    } );
            } else {
                this.selectExistingFolder();
            }
        } else {

            this.nTrigger.importIdentifier = this.selectedGinaName;

            this.ipcService
                .createNewTrigger( this.nTrigger )
                .subscribe( triggerId => {
                    if ( triggerId ) {
                        this.showZoneNameDialog = true;
                        this.skipDuplicateTriggerCheck = false;
                        this.duplicateTriggers = null;
                        this.nTrigger = null;
                        
                        this.dataSource.data = [];
                        this.ignoredGinaObjects.push( this.selectedGinaName );
                        this.loadGinaConfig( true );
                        
                        this.snackBar.open( 'Trigger created.', 'Dismiss', { duration: 1500 } );
                    } else {
                        this.snackBar.open( 'Could not create trigger!', 'Dismiss', { duration: 5000 } );
                    }
                } );
        }
    }

    private selectExistingFolder(): void {
        this.dialogService
            .showSelectTriggerFolderDialog()
            .subscribe( folderId => {
                this.nTrigger.folderId = folderId;
                this.importTrigger();
            } );
    }

    private createTriggerFolder( onSelected: ( folder: TriggerFolder ) => void ): void {
        let ginaFolders = this.selectedGinaFolders.slice();
        let folders = this.triggerFolders;

        for ( let i = 0; i < ginaFolders?.length; i++ ){
            let found = false;

            for ( let f = 0; f < folders.length; f++ ) {
                if ( folders[ f ].name?.trim() === ginaFolders[ i ]?.trim() ) {
                    folders[ f ].children = folders[ f ].children?.length > 0 ? folders[ f ].children : [];
                    folders = folders[ f ].children;
                    found = true;
                    break;
                }
            }

            if ( found ) {
                continue;
            } else {
                let newFolder = new TriggerFolder();

                newFolder.folderId = nanoid();
                newFolder.name = ginaFolders[ i ]?.trim();
                newFolder.expanded = false;
                newFolder.active = true;
                newFolder.comments = null;
                newFolder.children = [];

                folders.push( newFolder );
                folders = newFolder.children;
            }
        }

        this.ipcService
            .updateTriggerFolders( this.triggerFolders )
            .subscribe( folders => {
                this.triggerFolders = folders;
                onSelected( this.getTriggerFolder() );
            } );

        return null;
    }

    private getTriggerFolder(): TriggerFolder {
        // GINA:/Raids/Omens of War (critical)/Asylum of Anguish/Overlord Mata Muram/Mata Muram's Gaze
        let ginaFolders = this.selectedGinaFolders.slice();
        
        let folder: TriggerFolder = null;
        let folders = this.triggerFolders;
        for ( let i = 0; i < ginaFolders?.length - 1; i++ ) {
            for ( let x = 0; x < folders?.length; x++ ) {
                if ( folders[ x ].name?.trim() === ginaFolders[ i ]?.trim() ) {
                    folders = folders[ x ].children;
                    break;
                }
            }
        }

        for ( let x = 0; x < folders?.length; x++ ) {
            if ( folders[ x ].name === ginaFolders[ ginaFolders?.length - 1 ] ) {
                folder = folders[ x ];
            }
        }

        return folder;
    }

    public closeModal(): void {
        this.ipcService.closeThisChild();
    }

    private updateFolderHierarchySelectedState( node: GinaTreeObject, selected: boolean ) {
        node.selected = selected;
        node.children?.forEach( c => this.updateFolderHierarchySelectedState( c, selected ) );
    }

    private checkForMultipleSelects( data: GinaTreeObject[] = null, count: number = 0 ) {
        
        if ( data == null ) {
            data = this.dataSource.data;
            this.hasMultipleSelected = false;
        }

        for ( let i = 0; i < data?.length; i++ ) {
            if ( data[ i ].selected ) {
                count += 1;
            }
            if ( count > 1 ) {
                this.hasMultipleSelected = true;
                break;
            } else if ( data[ i ].children?.length > 0 ) {
                this.checkForMultipleSelects( data[ i ].children, count );
            }
        }

    }

    private generateFlatSelectData( data: GinaTreeObject[] = null, family: string = null ) {

        let f = family ? family : '';

        if ( data == null ) {
            data = this.dataSource.data;
            this.selectedGinaData = [];
        }

        for ( let i = 0; i < data?.length; i++ ) {
            
            if ( data[ i ].children?.length > 0 ) {
                this.generateFlatSelectData( data[ i ].children, f + '/' + data[ i ].name );
            } else if ( data[ i ].selected ) {
                this.selectedGinaData.push( {
                    model: data[ i ],
                    folderFamily: f,
                } );
            }

        }
    }

    public startReviews(): void {
        this.startReview = true;
    }

    public resetTriggerSelection(): void {
        if ( this.startReview ) {
            this.triggerReviews = [];
            this.startReview = false;
        }
    }

    public onMassImportComplete( importedGinaNames: string[] ): void {
        
        this.resetTriggerSelection();
        this.hasMultipleSelected = false;

        this.ignoredGinaObjects = Array.prototype.concat( [], this.ignoredGinaObjects, importedGinaNames ?? [] );
        this.dataSource.data = [];
        this.loadGinaConfig( true );
        
    }

}
