import { Component, Input, OnInit } from '@angular/core';
import { ContextMenuModel } from 'src/app/context-menu/context-menu.model';
import { ContextService } from 'src/app/context-menu/context.service';
import { TriggerAction } from 'src/app/core.model';
import { IpcService } from 'src/app/ipc.service';

@Component({
    selector: 'app-trigger-action-screen-glow',
    templateUrl: 'trigger-action-screen-glow.component.html',
    styleUrls: ['trigger-action-screen-glow.component.scss']
})
export class TriggerActionScreenGlowComponent implements OnInit {
    
    @Input() public action: TriggerAction;
    
    constructor(
        private ipcService: IpcService,
        private contextService: ContextService,
    ) { }

    ngOnInit() { }

    public getActionCtxMenu( action: TriggerAction ): ContextMenuModel[] {
        // TODO: I wonder if this could be done async with an observable and the async pipe?
        return [ <ContextMenuModel>{
            label: 'Copy Properties',
            action: () => this.contextService.copyTriggerActionProperties( action ),
            disabled: () => false,
            hide: () => false,
            matIcon: 'content_copy',
        }, <ContextMenuModel>{
            label: 'Paste Properties',
            action: () => this.contextService.pasteTriggerActionProperties( action ),
            disabled: () => !this.contextService.hasActionProperties,
            hide: () => false,
            matIcon: 'content_paste',
        } ];
    }
}
