import { Component, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core';
import { MatTable } from '@angular/material/table';
import { Phrase } from 'src/app/core.model';
import { DialogService } from 'src/app/dialogs/dialog.service';
import { customAlphabet } from 'nanoid';
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const nanoid = customAlphabet( alphabet, 16 );

@Component({
    selector: 'app-phrases',
    templateUrl: 'phrases.component.html',
    styleUrls: ['phrases.component.scss', '../../core.scss', '../../modal.scss']
})
export class PhrasesComponent implements OnInit {

    // @Input() public message: string;

    @Input() public phrases: Phrase[];
    @Output() public phrasesChange: EventEmitter<Phrase[]> = new EventEmitter<Phrase[]>();

    @ViewChild( 'phrasesTable' ) private phrasesTable: MatTable<any>;

    public phraseTableColumns = [ 'phrase', 'regEx', 'delete' ];

    constructor( private dialogService: DialogService ) { }

    ngOnInit() { }

    public addPhrase(): void {
        let phrase: Phrase = new Phrase();
        phrase.phraseId = nanoid();
        this.phrases = this.phrases?.length > 0 ? this.phrases : [];
        this.phrases.push( phrase );
        this.phrasesChange.emit( this.phrases );
        this.phrasesTable?.renderRows();
    }

    public deletePhrase( deleteIndex: number ): void {
        this.dialogService.showConfirmDialog(
            'Are you certain you want to delete this phrase?',
            'Click "Yes" to delete the phrase.',
            'Click "No" to cancel and close this dialog without deleting the phrase.',
            ( confirmed ) => {
                if ( confirmed ) {
                    this.doDelete( deleteIndex );
                }
            } );
    }

    private doDelete( index: number ): void {
        this.phrases?.splice( index, 1 );
        this.phrasesChange.emit( this.phrases );
        this.phrasesTable?.renderRows();
    }

}