import { animate, state, style, transition, trigger } from '@angular/animations';
import { Component, OnInit } from '@angular/core';
import { DialogService } from 'src/app/dialogs/dialog.service';
import { IpcService } from 'src/app/ipc.service';

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

    public loadingGinaConfig: boolean = false;

    constructor( private ipcService: IpcService, private dialogService: DialogService ) { }

    ngOnInit() {
        this.loadGinaConfig();
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
                    // this.dialogService.showInfoDialog( 'GINA loaded', 'Data loaded' );
                    console.log( 'derp', ginaConfig );
                    // ginaConfig.TriggerGroups.TriggerGroup
                    // ginaConfig.TriggerGroups.TriggerGroup[ 0 ].Triggers.Trigger[ 4 ].TimerEarlyEnders.EarlyEnder;
                    // // ginaConfig.Settings.PhoneticTransforms.Transform[ 0 ].ActualWord
                    // console.log( 'testing', ginaConfig.Settings.PhoneticTransforms.Transform[ 0 ].ActualWord );
                    // console.log( 'testing', ginaConfig.BehaviorGroups.Behavior[ 0 ].WindowLayout.WINDOWPLACEMENT.normalPosition.Left );
                    // console.log( 'testing', ginaConfig.TriggerGroups.TriggerGroup[ 0 ].Triggers.Trigger[ 4 ].Name );
                    // console.log( 'testing', ginaConfig.TriggerGroups.TriggerGroup[ 0 ].Triggers.Trigger[ 4 ].TimerEndingTrigger.DisplayText );
                    // let earlye = ginaConfig.TriggerGroups.TriggerGroup[ 0 ].Triggers.Trigger[ 4 ].TimerEarlyEnders.EarlyEnder;
                    // console.log( 'testing', (earlye instanceof Array) ? earlye[1].EarlyEndText : earlye.EarlyEndText );
                }
            } );

    }

    public closeModal(): void {
        this.ipcService.closeThisChild();
    }

}
