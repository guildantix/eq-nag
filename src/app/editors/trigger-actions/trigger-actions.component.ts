import { Component, ElementRef, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core';
import { ActionTypeIcons, ActionTypeLabels, ActionTypes, CapturePhrase, OverlayWindowModel, TriggerAction } from 'src/app/core.model';
import { DialogService } from 'src/app/dialogs/dialog.service';
import { IpcService } from 'src/app/ipc.service';

@Component( {
    selector: 'app-trigger-actions',
    templateUrl: 'trigger-actions.component.html',
    styleUrls: ['trigger-actions.component.scss', '../../core.scss', '../../modal.scss']
} )
export class TriggerActionsComponent implements OnInit {

    @Input() public actions: TriggerAction[];
    @Output() public actionsChange: EventEmitter<TriggerAction[]> = new EventEmitter<TriggerAction[]>();

    @Input() public isDev: boolean = false;
    @Input() public predefined: boolean = false;
    @Input() public capturePhrases: CapturePhrase[] = [];

    public actionTypes: typeof ActionTypes = ActionTypes;
    public actionTypeLabels = ActionTypeLabels;
    public actionTypeIcons = ActionTypeIcons;
    public overlays: OverlayWindowModel[] = [];
    
    public get alertOverlays(): OverlayWindowModel[] {
        return this.overlays.filter( f => f.overlayType === 'Alert' );
    }

    public get logOverlays(): OverlayWindowModel[] {
        return this.overlays.filter( f => f.overlayType === 'Log' );
    }

    public get timerOverlays(): OverlayWindowModel[] {
        return this.overlays.filter( f => f.overlayType === 'Timer' );
    }

    @ViewChild( 'content', { static: true } ) content: ElementRef<HTMLDivElement>;

    private _scrollTimeoutId: number | undefined = undefined;
    private _scrolling: boolean = false;
    public get scrolling(): boolean {
        return this._scrolling;
    }
    public set scrolling( value: boolean ) {
        this._scrolling = value;
        if ( value ) {
            if ( this._scrollTimeoutId ) {
                window.clearTimeout( this._scrollTimeoutId );
            }
            this._scrollTimeoutId = window.setTimeout( () => {
                this.scrolling = false;
                this.scrollIndex = -1;
            }, 3000 );
        }
    }
    public scrollIndex: number = -1;

    constructor( private dialogService: DialogService, private ipcService: IpcService ) { }

    ngOnInit() {
        
        this.ipcService.getOverlayWindows().subscribe( overlays => this.overlays = overlays );

    }









    
    /**
     * Adds a new empty action.
     */
    public addNewAction(): void {
        this.actions.push( new TriggerAction() );
        this.actionsChange.emit( this.actions );
    }









    
    /**
     * Deletes the specified action, after confirming with the user.
     * 
     * @param index The index of the action to remove.
     */
    public deleteAction( index: number ): void {
        this.dialogService
            .showConfirmationDialog(
                'Are you certain you want to delete this action?',
                'Click "Yes" to delete the action.',
                'Click "No" to cancel and close this dialog without deleting the action.' )
            .subscribe( confirmed => {
                if ( confirmed ) {
                    this.actions?.splice( index, 1 );
                    this.actionsChange.emit( this.actions );
                }
            } );
    }









    
    /**
     * Returns a list of trigger actions not matching the given id.
     * 
     * @param actionId The action id to exclude.
     */
    public getOtherActions( actionId: string ): TriggerAction[] {
        return this.actions.filter( f => f.actionId !== actionId );
    }









    
    /**
     * Moves the action at the given index up one position.
     * 
     * @param index The index of the action to move up.
     */
    public moveUp( index: number, ev: MouseEvent ): void {

        this.scrolling = true;

        if ( index > 0 ) {
            const action = this.actions[ index ];
            this.actions.splice( index, 1 );
            this.actions.splice( index - 1, 0, action );
            this.actionsChange.emit( this.actions );
            this.scrollIndex = index - 1;
        }
    }









    
    /**
     * Moves the action at the given index down one position.
     * 
     * @param index The index of the action to move down.
     */
    public moveDown( index: number, ev: MouseEvent ): void {

        this.scrolling = true;

        if ( index < this.actions.length - 1 ) {
            const action = this.actions[ index ];
            this.actions.splice( index, 1 );
            this.actions.splice( index + 1, 0, action );
            this.actionsChange.emit( this.actions );
            this.scrollIndex = index + 1;
        }
    }










}
