import { Component, OnInit } from '@angular/core';
import { IpcService } from '../ipc.service';
import { TriggerHotkey, TriggerModel } from '../core.model';
import { QuickActionService } from '../services/quick-action.service';

@Component( {
    selector: 'app-quick-actions',
    templateUrl: 'quick-actions.component.html',
    styleUrls: [ 'quick-actions.component.scss' ], 
} )
export class QuickActionsComponent implements OnInit {

    public quickActions: TriggerHotkey[] = [];

    constructor(
        private readonly ipcService: IpcService,
        private readonly quickActionService: QuickActionService,
    ) { }

    ngOnInit() {
        // Initialize the quick actions.
        this.ipcService.getTriggers().subscribe( triggers => this.quickActions = this.reduceToQuickActions( triggers ) );

        // Update the quick actions when a trigger is received/updated.
        this.ipcService.tickReceived().subscribe( data => this.quickActions = this.reduceToQuickActions( data.triggers ) );
    }

    /**
     * Reduces the triggers to quick actions.
     * 
     * @returns Returns the quick actions.
     * 
     * @param triggers The triggers to reduce to quick actions.
     */
    public reduceToQuickActions( triggers: TriggerModel[] ): TriggerHotkey[] {
        let quickActionTriggers = triggers.filter( x => x.hotkeys?.some( y => y.simpleCommand ) );

        return quickActionTriggers.map( x => x.hotkeys.filter( y => y.simpleCommand ) ).reduce( ( a, b ) => a.concat( b ), [] );
    }

    public executeQuickAction( quickAction: TriggerHotkey ): void {
        this.quickActionService.generateEqHotkey( quickAction );
    }

}