import { Component, OnInit, ViewChild } from '@angular/core';
import { MatDialogRef, MatDialog } from '@angular/material/dialog';
import { MatHorizontalStepper } from '@angular/material/stepper';
import { IpcService } from 'src/app/ipc.service';

@Component( {
    selector: 'app-setup-wizard',
    templateUrl: 'setup-wizard.component.html',
    styleUrls: [ 'setup-wizard.component.scss' ]
} )
export class SetupWizardComponent implements OnInit {

    public enableFct: boolean = false;
    public groupedTimers: boolean = null;

    @ViewChild( 'stepper', { static: false, read: MatHorizontalStepper } ) public stepper: MatHorizontalStepper;
    
    constructor(
        public dialogRef: MatDialogRef<SetupWizardComponent>,
        public dialog: MatDialog,
        private ipcService: IpcService ) {
        
    }

    ngOnInit() { }

    next() {
        this.stepper.next();
    }

    previous() {
        this.stepper.previous();
    }
}
