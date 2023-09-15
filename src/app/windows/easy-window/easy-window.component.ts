import { Component, OnInit, ViewChild } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatStepper } from '@angular/material/stepper';
import { DialogService } from 'src/app/dialogs/dialog.service';
import { IpcService } from 'src/app/ipc.service';
import { SettingsService } from 'src/app/settings/settings-http.service';

@Component( {
    selector: 'easy-window',
    templateUrl: 'easy-window.component.html',
    styleUrls: [ 'easy-window.component.scss', '../../core.scss', '../../modal.scss' ],
} )
export class EasyWindowComponent implements OnInit {

    public action: 'triggerEdit' | 'addCharacter' | undefined = undefined;
    public stepIndex: number = 0;
    
    @ViewChild( 'stepper', { static: true, read: MatStepper } ) public stepper: MatStepper;

    constructor(
        private readonly ipcService: IpcService,
        private readonly dialogService: DialogService,
        private readonly snackBar: MatSnackBar,
        private readonly settingsService: SettingsService,
    ) { }

    ngOnInit() { }

    /**
     * Closes this modal.
     */
    public closeModal(): void {
        this.ipcService.closeThisChild();
    }

    public setAction( action: 'addCharacter' | 'triggerEdit' ): void {
        this.action = action;
        window.setTimeout( () => this.stepper.next() );
    }

    // public actionTriggerEdit(): void {
    //     this.action = 'triggerEdit';
    //     this.stepper.next();
    // }

}
