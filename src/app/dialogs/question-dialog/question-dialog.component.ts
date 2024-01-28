import { Component, OnInit, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { ColoredString } from '../dialog.model';
import { QuestionDialogAnswerModel, QuestionDialogModel } from './question-dialog.model';

@Component( {
    selector: 'app-question-dialog',
    templateUrl: 'question-dialog.component.html',
    styleUrls: [ 'question-dialog.component.scss', '../dialog.styles.scss', '../../core.scss' ]
} )
export class QuestionDialogComponent implements OnInit {

    public title: string = 'Confirm';
    public messages: (string|ColoredString)[] = [];

    constructor(
        public dialogRef: MatDialogRef<QuestionDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public data: QuestionDialogModel ) { }

    ngOnInit(): void {

        if ( this.data.message instanceof Array ) {
            this.messages = this.data.message;
        } else if ( this.data.message ) {
            this.messages.push( this.data.message );
        }

        if ( this.data.title ) {
            this.title = this.data.title ?? 'Question';
        }
    }

    public executeAnswer( answer: QuestionDialogAnswerModel ) {
        answer.action();
        this.dialogRef.close();
    }
    
}
