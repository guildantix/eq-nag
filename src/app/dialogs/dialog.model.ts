import { TriggerModel } from '../core.model';

export class NewTriggerDialogModel {
    
    trigger: TriggerModel;
    selectedFolderId: string;

}

export class ColoredString {
    constructor( public value: string, public color: string, public bold: boolean = false ) { }
}
