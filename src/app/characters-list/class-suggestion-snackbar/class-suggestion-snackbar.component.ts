import { Component, Inject } from '@angular/core';
import { MAT_SNACK_BAR_DATA, MatSnackBarRef } from '@angular/material/snack-bar';
import { ClassSuggestionModel } from '../../core.model';

/** What the player chose on the class suggestion prompt. */
export type ClassSuggestionAnswer = 'updated' | 'declined';










/** The data the snackbar is opened with. */
export interface ClassSuggestionSnackbarData {
    suggestion: ClassSuggestionModel;
    onAnswer: ( answer: ClassSuggestionAnswer ) => void;
}










/**
 * A snackbar that asks whether to update a character's class after the log showed a persona swap.
 * It has two buttons, which the stock snackbar can't, and stays open until the player answers
 * because a swap is easy to miss while playing.
 */
@Component( {
    selector: 'app-class-suggestion-snackbar',
    templateUrl: './class-suggestion-snackbar.component.html',
    styleUrls: [ './class-suggestion-snackbar.component.scss' ],
} )
export class ClassSuggestionSnackbarComponent {

    constructor(
        private readonly snackBarRef: MatSnackBarRef<ClassSuggestionSnackbarComponent>,
        @Inject( MAT_SNACK_BAR_DATA ) public data: ClassSuggestionSnackbarData,
    ) { }










    /**
     * Reports the player's answer and closes the snackbar.
     *
     * @param answer What the player chose.
     */
    public answer( answer: ClassSuggestionAnswer ): void {
        this.data.onAnswer( answer );
        this.snackBarRef.dismiss();
    }

}
