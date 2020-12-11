import { animate, state, style, transition, trigger } from '@angular/animations';
import { FlatTreeControl } from '@angular/cdk/tree';
import { Component, OnInit } from '@angular/core';
import { MatTreeFlatDataSource, MatTreeFlattener } from '@angular/material/tree';
import { forkJoin } from 'rxjs';
import { DialogService } from 'src/app/dialogs/dialog.service';
import { GinaPhoneticTransform, GinaTrigger, GinaTriggerGroup } from 'src/app/gina.model';
import { IpcService } from 'src/app/ipc.service';
import * as _ from 'lodash';

interface GinaTreeNode {
    expandable: boolean;
    name: string;
    level: number;
    item: GinaTrigger | GinaPhoneticTransform;
    ginaName: string;
    imported: boolean;
}

class GinaTreeObject {
    name: string;
    children: GinaTreeObject[] = [];
    trigger: GinaTrigger;
    phoneticTransform: GinaPhoneticTransform;
    ginaName: string;
    imported: boolean;
}

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
        return {
            expandable: node.children?.length > 0,
            name: node.name,
            level: level,
            item: node.phoneticTransform ? node.phoneticTransform : node.trigger,
            ginaName: node.ginaName,
            imported: node.imported,
        };
    }
    public treeControl = new FlatTreeControl<GinaTreeNode>( node => node ? node.level : 1, node => node.expandable );
    public treeFlattener = new MatTreeFlattener(this._transformer, node => node.level, node => node.expandable, node => node.children);
    public dataSource = new MatTreeFlatDataSource( this.treeControl, this.treeFlattener );
    public expandedNodes: string[] = [];
    public hasChild = ( _: number, node: GinaTreeNode ) => node.expandable;

    public loadingGinaConfig: boolean = true;
    public showImported: boolean = false;
    public importedTriggerNames: string[] = [];
    public importedPhoneticTransforms: string[] = [];
    public selectedPhoneticTransform: GinaPhoneticTransform = null;
    public voiceOptions: SpeechSynthesisVoice[] = [];
    public voiceIndex: number;

    constructor( private ipcService: IpcService, private dialogService: DialogService ) {
        speechSynthesis.onvoiceschanged = () => {
            this.voiceOptions = speechSynthesis.getVoices();
        };
    }

    ngOnInit() {

        this.ipcService.tickReceived().subscribe( data => {
            // this.dkpEntries = data.dkpEntries;
            // this.logFile = data.logFile;
            this.voiceIndex = data.voiceIndex;
            // this.overlays = data.overlays;
            // this.enableFct = data.enableFct;
            // this.damageDealtOverlayId = data.damageDealtOverlayId;
            // this.damageTakenOverlayId = data.damageReceivedOverlayId;
            // this.focusEffectSettings.hasExtendedDotFocus = data.hasExtendedDotFocus;
            // this.focusEffectSettings.extendedDotFocusPercent = data.extendedDotFocusPercent;
            // this.focusEffectSettings.extendedDotFocusDecayLevel = data.extendedDotFocusDecayLevel;

            data.triggers?.forEach( trigger => {
                this.importedTriggerNames.push( trigger.importIdentifier );
            } );

            this.importedPhoneticTransforms = Object.keys( data.phoneticTransforms );
            
            this.loadGinaConfig();

        } );
        
        this.ipcService.requestTick();
    }

    public loadGinaConfig(): void {

        this.ipcService
            .getGinaConfiguration()
            .subscribe( ginaConfig => {
                if ( ginaConfig == null ) {
                    this.dialogService.showWarningDialog( 'GINA failure', 'Could not find the GINA data directory' );
                } else {
                    
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
                            imported: this.importedPhoneticTransforms.indexOf( transform.ActualWord ) > -1,
                        } );
                    } );

                    if ( transformsNode.children.length > 0 ) {
                        transformsNode.imported = !_.some( transformsNode.children, n => n.imported === false );
                        data.push( transformsNode );
                    }

                    data = data.concat( this.getGinaTriggerGroupNodes( ginaConfig.TriggerGroups.TriggerGroup, 'GINA:' ) );
                    
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
        _.remove( data, c => c.imported );
        data?.forEach( group => {
            if ( group.children?.length > 0 ) {
                this.trimGroups( group.children );
            }
        } );
    }

    private getGinaTriggerGroupNodes( groups: GinaTriggerGroup[], ginaName: string ): GinaTreeObject[] {
        let nodes: GinaTreeObject[] = [];

        groups?.forEach( group => {
            let groupNode = new GinaTreeObject();

            groupNode.name = group.Name;
            groupNode.ginaName = `${ginaName}/${group.Name}`;

            if ( group.TriggerGroups?.TriggerGroup?.length > 0 ) {
                groupNode.children = this.getGinaTriggerGroupNodes( group.TriggerGroups.TriggerGroup, groupNode.ginaName );
            }

            group.Triggers?.Trigger?.forEach( trigger => {
                groupNode.children.push( {
                    name: trigger.Name,
                    children: [],
                    trigger: trigger,
                    phoneticTransform: null,
                    ginaName: `${ginaName}/${trigger.Name}`,
                    imported: this.importedTriggerNames.indexOf( trigger.Name ) > -1,
                } );
            } );
            
            if ( groupNode.children?.length > 0 ) {
                groupNode.imported = !_.some( groupNode.children, n => n.imported === false );
                nodes.push( groupNode );
            }
        } );

        return nodes;
    }

    public selectForImport( item: GinaTrigger | GinaPhoneticTransform ): void {
        if ( 'ActualWord' in item ) {
            this.selectedPhoneticTransform = item;
        }
    }

    public speakPhrase( phrase: string ): void {
        var utter = new SpeechSynthesisUtterance();
        utter.text = phrase;
        utter.voice = this.voiceOptions[ this.voiceIndex ];
        utter.onend = function ( event ) { }
        speechSynthesis.speak( utter );
    }

    public importPhoneticTransform( transform: GinaPhoneticTransform ): void {
        this.ipcService.getPhoneticTransforms().subscribe( transforms => {
            transforms[ transform.ActualWord ] = transform.PhoneticWord;
            this.ipcService.savePhoneticTransforms( transforms );
            this.selectedPhoneticTransform = null;
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

    public hasImportedAllChildren( group: GinaTreeObject ): boolean {

        for ( let i = 0; i < group.children?.length; i++ ) {
            
            if ( group.children[ i ].phoneticTransform != null ) {
                if ( this.importedPhoneticTransforms.indexOf( group.children[ i ].ginaName ) == -1 ) {
                    return true;
                }
            } else if ( group.children[ i ].trigger != null ) {
                if ( this.importedTriggerNames.indexOf( group.children[ i ].ginaName ) == -1 ) {
                    return true;
                }
            }

        }

        return false;
    }

    public onExpand( node: GinaTreeNode ): void {
        if ( this.treeControl.isExpanded( node ) ) {
            this.expandedNodes.push( node.ginaName );
        } else {
            _.remove( this.expandedNodes, n => n === node.ginaName );
        }
    }

    public closeModal(): void {
        this.ipcService.closeThisChild();
    }

}
