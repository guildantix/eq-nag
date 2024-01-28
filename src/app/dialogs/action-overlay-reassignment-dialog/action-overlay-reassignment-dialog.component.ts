import { Component, Inject, OnInit } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { actionOverlayMap, ActionTypes, OverlayWindowModel, TriggerFolder } from 'src/app/core.model';
import { IpcService } from 'src/app/ipc.service';
import { ActionOverlayReviewModel, OverlayReassignments } from './action-overlay-reassignment.model';

@Component( {
    selector: 'app-action-overlay-reassignment-dialog',
    templateUrl: 'action-overlay-reassignment-dialog.component.html',
    styleUrls: [ './action-overlay-reassignment-dialog.component.scss', '../dialog.styles.scss' ]
} )
export class ActionOverlayReassignmentDialogComponent implements OnInit {

    private allOverlays: OverlayWindowModel[] = [];
    public fullReassignmentOverlayId: string;
    public folders: TriggerFolder[] = [];

    constructor(
        public dialogRef: MatDialogRef<ActionOverlayReassignmentDialogComponent>,
        @Inject( MAT_DIALOG_DATA ) public data: ActionOverlayReviewModel,
        private ipcService: IpcService,
    ) { }

    ngOnInit() {
        this.ipcService.getOverlayWindows().subscribe( overlays => this.allOverlays = overlays );
        this.ipcService.getTriggerFolders().subscribe( folders => this.folders = folders );
    }

    public getOverlays( actionType: ActionTypes ): OverlayWindowModel[] {
        return this.allOverlays.filter( f => f.overlayId !== this.data.overlay?.overlayId && actionOverlayMap[ actionType ] === f.overlayType );
    }

    public getOverlaysOfType( overlayType: 'Log' | 'Alert' | 'Timer' | 'FCT' | 'Chart' | '' ): OverlayWindowModel[] {
        return this.allOverlays.filter( f => f.overlayId !== this.data.overlay?.overlayId && f.overlayType === overlayType );
    }
    






    /**
     * Returns the family name of the given trigger.  If the trigger's folder is the currently selected folder, returns null.
     * 
     * @example May return "\Raids\OoW\Anguish\OMM"
     * 
     * @param triggerFolderId The trigger's folder id.
     */
    public getTriggerFamily( triggerFolderId: string ): string {

        let folderFamilyNames = this.getFolderFamilyNames( triggerFolderId, this.folders, [] );
        if ( folderFamilyNames?.length > 0 ) {
            let name = `\\${folderFamilyNames[ 0 ]}`;
            for ( let i = 1; i < folderFamilyNames.length; i++ ) {
                name += `\\${folderFamilyNames[ i ]}`;
            }
            return name;
        } else {
            return null;
        }
    }










    /**
     * Returns an array of names, starting from root to specified child, of folder names.
     * 
     * @example This may return ["Omens of War","Asylum of Anguish","Overlord Mata Muram"], if you have the Omens of war selected and the target folder is OMM.
     * 
     * @param folderId The desired descendent folder id.
     * @param folders The hierarchy of folders that contains the desired descendent.
     * @param names The array of names.
     */
    private getFolderFamilyNames( folderId: string, folders: TriggerFolder[], names: string[] ): string[] {
        
        for ( let i = 0; i < folders?.length; i++ ) {

            if ( folders[ i ].folderId === folderId ) {
                return names.concat( [ folders[ i ].name ] );

            } else if ( folders[ i ]?.children?.length > 0 ) {
                
                let d = this.getFolderFamilyNames( folderId, folders[ i ].children, names.concat( [ folders[ i ].name ] ) );

                if ( d?.length > 0 ) {
                    return d;
                }

            }

        }
    }










    /**
     * Returns true when the name of the trigger must be rendered.
     * 
     * @param index The index of the current use action.
     */
    showTriggerName( index: number ) {
        return index === 0 || this.data.actionUses[ index ].trigger.triggerId !== this.data.actionUses[ index - 1 ].trigger.triggerId;
    }









    
    /**
     * Closes the dialog and passes null to the dialog ref.
     */
    cancel() {
        this.dialogRef.close( null );
    }










    /**
     * Closes this dialog and passes the user value to the dialog ref.
     */
    accept() {
        let model = new OverlayReassignments();
        this.data.actionUses.forEach( au => {
            model.actionUses.push( {
                triggerId: au.trigger.triggerId,
                actionId: au.actionId,
                overlayKey: au.overlayKey,
                overlayId: this.fullReassignmentOverlayId ?? au.reassignmentOverlayId,
            } );
        } );
        
        this.dialogRef.close( model ?? null );
    }

}
