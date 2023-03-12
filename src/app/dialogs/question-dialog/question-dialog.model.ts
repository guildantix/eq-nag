import { ColoredString } from "../dialog.model";

export class QuestionDialogAnswerModel {
    
    public question: ( string | ColoredString )[] = [];
    public buttonText: string;
    public action: () => void;
    public cssClass: string;

}

export class QuestionDialogModel {

    public title: string;
    public message: ( string | ColoredString )[] = [];
    public questions: QuestionDialogAnswerModel[] = [];
    public cancellable: boolean = true;
}
