import { Component, Inject, OnInit, ViewChild } from '@angular/core';
import { MatDialogRef, MatDialog, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatHorizontalStepper } from '@angular/material/stepper';
import { CharactersListComponent } from 'src/app/characters-list/characters-list.component';
import { IpcService } from 'src/app/ipc.service';

@Component( {
    selector: 'app-setup-wizard',
    templateUrl: 'setup-wizard.component.html',
    styleUrls: [ 'setup-wizard.component.scss' ]
} )
export class SetupWizardComponent implements OnInit {

    public enableFct: boolean = false;
    public groupedTimers: boolean = null;
    public get onLastStep(): boolean {
        return this.stepper?.selectedIndex > 0 && this.stepper?.selectedIndex === this.stepper?.steps.length - 1;
    }

    @ViewChild( 'stepper', { static: false, read: MatHorizontalStepper } ) public stepper: MatHorizontalStepper;
    
    constructor(
        public dialogRef: MatDialogRef<SetupWizardComponent>,
        @Inject( MAT_DIALOG_DATA ) public data: { characterList: CharactersListComponent },
        public dialog: MatDialog,
        private ipcService: IpcService ) {
        
    }

    ngOnInit() { }

    next() {
        this.stepper.next();
        console.log( 'selected step', this.stepper.selected );
    }

    previous() {
        this.stepper.previous();
    }

    addNewCharacter() {
        console.log( 'testing', this.data );
        this.data.characterList.newCharacter();
    }
}
