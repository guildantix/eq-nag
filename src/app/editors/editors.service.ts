import { Injectable, NgZone } from '@angular/core';
import { IpcRenderer } from 'electron';
import { Observable, Observer } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { DataTickModel, DkpEntryModel, TriggerModel, OverlayWindowModel, ActionTypes, FocusEffectSettings, CharacterModel, BasicError, TriggerFolder, FileModel } from '../core.model';
import { GinaConfiguration, GinaTriggerGroups } from '../gina.model';

    // TODO: This needs to be removed.
@Injectable( { providedIn: 'root' } )
export class EditorsService {
    
    constructor( private ngZone: NgZone ) { }
    
}
