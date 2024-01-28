import { Component, Input, NgZone, OnInit } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { getPackageImportProperties, getTriggerOverlayDescriptors } from '../core.decorators';
import { actionOverlayMap, OverlayWindowModel, TriggerAction, TriggerModel } from '../core.model';
import { ActionOverlayUseModel } from '../dialogs/action-overlay-reassignment-dialog/action-overlay-reassignment.model';
import { ColoredString, CustomButton } from '../dialogs/dialog.model';
import { DialogService } from '../dialogs/dialog.service';
import { NotificationDialogModel, NotificationTypes } from '../dialogs/notification-dialog/notification-dialog.model';
import { IpcService } from '../ipc.service';

@Component( {
    selector: 'app-overlays',
    templateUrl: 'overlays.component.html',
    styleUrls: [ './overlays.component.scss' ],
} )
export class OverlaysComponent implements OnInit {

    @Input() public damageDealtOverlayId: string;
    @Input() public damageTakenOverlayId: string;
    @Input() public isDev: boolean = false;
    public overlayAssignCounts: Record<string, number> = {};
    public overlays: OverlayWindowModel[] = [];

    constructor(
        private snackBar: MatSnackBar,
        private ipcService: IpcService,
        private dialogService: DialogService,
        private ngZone: NgZone
    ) { }

    ngOnInit() {

        this.ipcService.tickReceived().subscribe( data => {
            
            this.overlays = data.overlays;
            
            this.calculateOverlayUseCounts( data.triggers );
            
        } );
        
        this.ipcService.displayWarningDialog().subscribe( e => {
            let dialogArgs = new NotificationDialogModel();
            if ( e.code === 'Renderer:ResolutionChanged' ) {
                dialogArgs.message = [
                    new ColoredString( 'The resolution of one or more of your monitors has changed.', '#f0e069', true ),
                    'Your overlay positions have been automatically moved to match.',
                    'To manually arrange your overlays, click on the Arrange button below.' ];
                dialogArgs.title = 'Your resolution has changed!';
                dialogArgs.notificationType = NotificationTypes.Warning;
                
                let arrangeBtn = new CustomButton();
                arrangeBtn.cssClassString = 'color-blue';
                arrangeBtn.matIcon = 'view_quilt';
                arrangeBtn.matIconsOutlined = true;
                arrangeBtn.text = 'Arrange Overlays';
                arrangeBtn.onClick = () => {
                    this.arrangeOverlays();
                    return true;
                };

                dialogArgs.customButtons = [ arrangeBtn ];

                this.dialogService.showNotificationDialog( dialogArgs );
            }
        } );
    }









    
    /**
     * Enables the arrange overlays mode, allowing move/resize of all overlays at once.
     */
    public arrangeOverlays() {
        this.ipcService.showArrangeOverlaysDialog();
    }









    
    /**
     * Shows the new overlay modal.
     */
    showNewOverlayDialog(): void {
        this.dialogService
            .showOverlayDetailsDialog( new OverlayWindowModel() )
            .subscribe( model => {
                if ( model?.isValid() === true ) {
                    model.windowWidth = 500;
                    model.windowHeight = 400;
                    this.ipcService.createNewOverlayWindow( model ).subscribe( overlayId => {
                        window.setTimeout( () => this.ipcService.showEditOverlayDialog( overlayId ) );
                    } );
                }
            } );
    }









    
    /**
     * Enables move/resize of the specified overlay.
     * 
     * @param overlayId The id of the desired overlay.
     */
    enableOverlayEdit( overlayId: string ): void {
        this.ipcService.showEditOverlayDialog( overlayId );
    }









    
    /**
     * The id of the overlay.
     * 
     * @param overlayId The desired overlayId.
     */
    getOverlayCountLabel( overlayId: string ): string | number {
        if ( overlayId === this.damageDealtOverlayId || overlayId === this.damageTakenOverlayId ) {
            return 'FCT';
        } else {
            return this.overlayAssignCounts[ overlayId ] ?? 0;
        }
    }









    
    /**
     * Calculates all overlay uses in the given list of triggers.
     * 
     * @param triggers The list of triggers to use in the calculations.
     */
    calculateOverlayUseCounts( triggers: TriggerModel[] ) {
        this.overlayAssignCounts = {};
        triggers.forEach( trigger => {
            trigger.actions.forEach( action => {
                let actionProperties = getPackageImportProperties( Object.assign( new TriggerAction(), action ) );
                actionProperties.overlayIds.forEach( overlayId => {
                    this.overlayAssignCounts[ overlayId ] = this.overlayAssignCounts[ overlayId ] > 0 ? this.overlayAssignCounts[ overlayId ] + 1 : 1;
                } );
            } );
        } );
    }









    
    /**
     * Finds missing overlays.
     */
    findMissingOverlays() {
        let data: ActionOverlayUseModel[] = [];

        let overlayIds = this.overlays.map( f => f.overlayId );
        this.ipcService.getTriggers().subscribe( triggers => {
            triggers.forEach( trigger => {
                trigger.actions.forEach( action => {
                    if ( actionOverlayMap[ action.actionType ] !== '' && ( !trigger.onlyExecuteInDev || this.isDev ) && ( !trigger.predefined || this.isDev ) ) {
                        let propertyDescriptors = getTriggerOverlayDescriptors( Object.assign( new TriggerAction(), action ) );
                        let overlayKeys = Object.keys( propertyDescriptors );

                        overlayKeys.forEach( overlayKey => {
                            const overlayId = action[ overlayKey ];
                            if ( overlayId != null && overlayIds.indexOf( overlayId ) === -1 ) {
                                data.push( {
                                    trigger: trigger,
                                    actionId: action.actionId,
                                    overlayKey: overlayKey,
                                    propertyName: propertyDescriptors[ overlayKey ].name,
                                    propertyDesc: propertyDescriptors[ overlayKey ].description,
                                    actionType: action.actionType,
                                } );
                            }
                        } );
                    }
                } );
            } );

            if ( data?.length > 0 ) {
                // If there are missing overlays, let the user assign overlays where required.
                this.dialogService.showOverlayAssignment( data ).subscribe( assignments => {
                    if ( assignments?.actionUses?.length > 0 ) {
                        triggers.forEach( trigger => {
                            let triggerOverlayAssignments = assignments.actionUses.filter( f => f.triggerId == trigger.triggerId );

                            triggerOverlayAssignments.forEach( triggerAssignment => {
                                const action = trigger.actions.find( f => f.actionId == triggerAssignment.actionId );
                                if ( action ) {
                                    action[ triggerAssignment.overlayKey ] = triggerAssignment.overlayId;
                                }
                            } );
                        
                        } );

                        this.ipcService.updateTriggers( triggers ).subscribe( updated => {
                            this.calculateOverlayUseCounts( triggers );
                        } );
                    }
                } );

            } else {
                // If there are no missing overlays, let the user know.
                this.dialogService.showInfoDialog( 'Missing Overlays', [ 'There are no missing overlays found.' ] );

            }
        } );
    }









    
    /**
     * Deletes the specified overlay.
     * 
     * @param index The index of the overlay to delete.
     */
    deleteOverlay( index: number ): void {
        if ( this.overlayAssignCounts[ this.overlays[ index ].overlayId ] > 0 ) {
            let overlayIds = this.overlays.map( f => f.overlayId );
            let data: ActionOverlayUseModel[] = [];
            
            this.ipcService.getTriggers().subscribe( triggers => {
                triggers.forEach( trigger => {
                    trigger.actions.forEach( action => {
                        let propertyDescriptors = getTriggerOverlayDescriptors( Object.assign( new TriggerAction(), action ) );
                        let overlayKeys = Object.keys( propertyDescriptors );
                        
                        overlayKeys.forEach( overlayKey => {
                            const overlayId = action[ overlayKey ];
                            if ( overlayId === this.overlays[ index ].overlayId ) {
                                data.push( {
                                    trigger: trigger,
                                    actionId: action.actionId,
                                    overlayKey: overlayKey,
                                    propertyName: propertyDescriptors[ overlayKey ].name,
                                    propertyDesc: propertyDescriptors[ overlayKey ].description,
                                    actionType: action.actionType,
                                } );
                            }
                        } );
                    } );
                } );
    
                this.dialogService.showOverlayReassignment( this.overlays[ index ], data, true ).subscribe( reassignment => {

                    if ( reassignment?.actionUses?.length > 0 ) {
                        triggers.forEach( trigger => {
                            let triggerOverlayAssignments = reassignment.actionUses.filter( f => f.triggerId == trigger.triggerId );

                            triggerOverlayAssignments.forEach( triggerAssignment => {
                                const action = trigger.actions.find( f => f.actionId == triggerAssignment.actionId );
                                if ( action ) {
                                    action[ triggerAssignment.overlayKey ] = triggerAssignment.overlayId;
                                }
                            } );
                        
                        } );

                        this.ipcService.updateTriggers( triggers ).subscribe( updated => {
                            this.calculateOverlayUseCounts( triggers );
                            this.deleteOverlay( index );
                        } );
                    }

                } );
            } );

        } else {
            this.dialogService.showConfirmDialog(
                `Are you sure you want to delete ${this.overlays[ index ].name}?`,
                'Click "Yes" to delete this overlay.', 'Click "No" to close this dialog without deleting this overlay.',
                confirmed => {
                    if ( confirmed === true ) {
                        this.ipcService.deleteOverlayWindow( this.overlays[ index ].overlayId ).subscribe();
                    }
                } );
        }
    }










    /**
     * Sends the specified overlay to the center of the primary monitor.
     * 
     * @param overlayId The id of the desired overlay.
     */
    sendToOrigin( overlayId: string ) {
        const overlay = this.overlays.find( f => f.overlayId === overlayId );
        this.dialogService.showMonitorSelect( 'Select which monitor to move this overlay to.', overlay?.displayId ?? null ).subscribe( displayId => {
            if ( displayId !== null ) {
                window.api.logger.info( `[Overlays:sendToOrigin] Sending overlay ${overlayId} to display ${displayId}` );
                this.ipcService.sendOverlayToOrigin( overlayId, displayId );
            }
        } );
    }

}
