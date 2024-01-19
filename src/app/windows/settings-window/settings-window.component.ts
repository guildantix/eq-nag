import { Component, OnInit, ViewChild } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatStepper } from '@angular/material/stepper';
import { ActivatedRoute } from '@angular/router';
import { DialogService } from 'src/app/dialogs/dialog.service';
import { IpcService } from 'src/app/ipc.service';
import { SettingsService } from 'src/app/settings/settings-http.service';

@Component( {
    selector: 'settings-window',
    templateUrl: 'settings-window.component.html',
    styleUrls: [ 'settings-window.component.scss', '../../core.scss', '../../modal.scss' ],
} )
export class SettingsWindowComponent implements OnInit {

    public title: string = 'Settings';
    public type: string = 'settings';

    constructor(
        private readonly ipcService: IpcService,
        private readonly dialogService: DialogService,
        private readonly snackBar: MatSnackBar,
        private readonly settingsService: SettingsService,
        private readonly route: ActivatedRoute,
    ) { }

    ngOnInit() {
        
        this.route.params.subscribe( params => {
            
            this.type = params[ 'type' ];
     
        } );

    }









    
    /**
     * Closes this modal.
     */
    public closeModal(): void {
        this.ipcService.closeThisChild();
    }










}
