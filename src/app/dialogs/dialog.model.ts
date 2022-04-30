import { TriggerModel } from '../core.model';

export class NewTriggerDialogModel {
    
    trigger: TriggerModel;
    selectedFolderId: string;

}

export class ColoredString {
    constructor( public value: string, public color: string, public bold: boolean = false ) { }
}

export class CustomButton {

    public get showIcon(): boolean {
        return this.matIcon !== null && this.matIcon !== undefined && this.matIcon.trim().length > 0;
    }
    
    /** Method executed when the user presses the button.  If the method returns true, the dialog will close. */
    public onClick: () => any;
    public text: string;
    public matIconButton: boolean = false;
    public cssClassString: string;
    public matIconsOutlined: boolean = false;
    public matIcon: string;

}
