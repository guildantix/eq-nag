import { Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { CharactersListComponent } from '../characters-list/characters-list.component';
import { SetupWizardComponent } from './setup-wizard/setup-wizard.component';

@Injectable({providedIn: 'root'})
export class SetupService {
    
    constructor( private dialog: MatDialog ) { }
    
    public showSetupWizard(): Observable<null> {

        return this.dialog.open<SetupWizardComponent, any, null>( SetupWizardComponent, {
            width: '920px',
            panelClass: 'app-dialog',
        } ).afterClosed();
        
    }
}
