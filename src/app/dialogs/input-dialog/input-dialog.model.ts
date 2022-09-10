export class InputDialogModel {
    public title: string;
    public message: string | string[];
    public label: string;
    public hint: string;
    public initialValue?: string = null;
    public useTextArea: boolean = false;
}
