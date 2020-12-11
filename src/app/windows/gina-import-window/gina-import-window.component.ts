import { animate, state, style, transition, trigger } from '@angular/animations';
import { FlatTreeControl } from '@angular/cdk/tree';
import { Component, OnInit } from '@angular/core';
import { MatTreeFlatDataSource, MatTreeFlattener } from '@angular/material/tree';
import { forkJoin } from 'rxjs';
import { DialogService } from 'src/app/dialogs/dialog.service';
import { GinaPhoneticTransform, GinaTrigger, GinaTriggerGroup } from 'src/app/gina.model';
import { IpcService } from 'src/app/ipc.service';

interface GinaTreeNode {
    expandable: boolean;
    name: string;
    level: number;
    item: GinaTrigger | GinaPhoneticTransform;
    imported: boolean;
}

class GinaTreeObject {
    name: string;
    children: GinaTreeObject[] = [];
    trigger: GinaTrigger;
    phoneticTransform: GinaPhoneticTransform;
    imported: boolean;
    ginaName: string;
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
            imported: node.imported,
        };
    }
    public treeControl = new FlatTreeControl<GinaTreeNode>( node => node.level, node => node.expandable );
    public treeFlattener = new MatTreeFlattener(this._transformer, node => node.level, node => node.expandable, node => node.children);
    public dataSource = new MatTreeFlatDataSource(this.treeControl, this.treeFlattener);
    public hasChild = ( _: number, node: GinaTreeNode ) => node.expandable;
    public showChild = ( node: GinaTreeNode ) => !node.imported || this.showImported;

    public loadingGinaConfig: boolean = false;
    public showImported: boolean = false;
    public importedTriggerNames: string[] = [];
    public importedPhoneticTransforms: string[] = [];

    private _data: GinaTreeObject[] = [];

    constructor( private ipcService: IpcService, private dialogService: DialogService ) { }

    ngOnInit() {
        
        forkJoin( [
            this.ipcService.getTriggers(),
            this.ipcService.getPhoneticTransforms(),
        ] ).subscribe( ( results ) => {

            results[ 0 ]?.forEach( trigger => {
                this.importedTriggerNames.push( trigger.importIdentifier );
            } );

            this.importedPhoneticTransforms = Object.keys( results[ 1 ] );
            
            this.loadGinaConfig();
        } );
    }

    public loadGinaConfig(): void {

        this.loadingGinaConfig = true;

        this.ipcService
            .getGinaConfiguration()
            .subscribe( ginaConfig => {
                this.loadingGinaConfig = false;
                if ( ginaConfig == null ) {
                    this.dialogService.showWarningDialog( 'GINA failure', 'Could not find the GINA data directory' );
                } else {
                    
                    let transformsNode = new GinaTreeObject();
                    let data: GinaTreeObject[] = [];
                    transformsNode.name = 'Phonetic Transforms';
                    ginaConfig.Settings?.PhoneticTransforms?.Transform?.forEach( transform => {
                        transformsNode.children.push( {
                            name: transform.ActualWord,
                            children: [],
                            trigger: null,
                            phoneticTransform: transform,
                            imported: this.importedPhoneticTransforms.indexOf( transform.ActualWord ) > -1,
                            ginaName: `${transform.ActualWord}`,
                        } );
                    } );

                    if ( transformsNode.children.length > 0 ) {
                        data.push( transformsNode );
                    }

                    data = data.concat( this.getGinaTriggerGroupNodes( ginaConfig.TriggerGroups.TriggerGroup, 'GINA:' ) );

                    this.dataSource.data = data;

                }
            } );

    }

    private getGinaTriggerGroupNodes( groups: GinaTriggerGroup[], ginaName: string ): GinaTreeObject[] {
        let nodes: GinaTreeObject[] = [];

        groups?.forEach( group => {
            let groupNode = new GinaTreeObject();

            groupNode.name = group.Name;

            if ( group.TriggerGroups?.TriggerGroup?.length > 0 ) {
                groupNode.children = this.getGinaTriggerGroupNodes( group.TriggerGroups.TriggerGroup, `${ginaName}/${group.Name}` );
            }

            group.Triggers?.Trigger?.forEach( trigger => {
                groupNode.children.push( {
                    name: trigger.Name,
                    children: [],
                    trigger: trigger,
                    phoneticTransform: null,
                    imported: this.importedTriggerNames.indexOf( trigger.Name ) > -1,
                    ginaName: `${ginaName}/${trigger.Name}`,
                } );
            } );
            
            if ( groupNode.children?.length > 0 ) {
                nodes.push( groupNode );
            }
        } );

        return nodes;
    }

    public closeModal(): void {
        this.ipcService.closeThisChild();
    }

}
