import { Component, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core';
import { MatTable } from '@angular/material/table';
import { CapturePhrase } from 'src/app/core.model';
import { DialogService } from 'src/app/dialogs/dialog.service';
import { customAlphabet } from 'nanoid';
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const nanoid = customAlphabet( alphabet, 16 );

@Component( {
    selector: 'app-capture-phrases',
    templateUrl: 'capture-phrases.component.html',
    styleUrls: ['capture-phrases.component.scss','../../core.scss', '../../modal.scss']
} )
export class CapturePhrasesComponent implements OnInit {

    @Input() public capturePhrases: CapturePhrase[];
    @Output() public capturePhrasesChange: EventEmitter<CapturePhrase[]> = new EventEmitter<CapturePhrase[]>();

    @Input() public captureMethod: string;
    @Output() public captureMethodChange: EventEmitter<string> = new EventEmitter<string>();

    public capturePhraseTableColumns = [ 'moveIndex', 'number', 'phrase', 'regEx', 'delete' ];

    @ViewChild( 'capturePhrasesTable' ) private capturePhrasesTable: MatTable<any>;
    
    constructor( private dialogService: DialogService ) { }

    ngOnInit() {
        this.addNewCapturePhrase();
    }

    public addNewCapturePhrase(): void {
        let phrase: CapturePhrase = new CapturePhrase();
        phrase.phraseId = nanoid();
        this.capturePhrases.push( phrase );
        this.capturePhrasesChange.emit( this.capturePhrases );
        this.capturePhrasesTable?.renderRows();
    }

    public deleteCapturePhrase( index: number ): void {
        if ( this.dialogService ) {
            this.dialogService.showConfirmDialog(
                'Are you certain you want to delete this capture phrase?',
                'Click "Yes" to delete the capture phrase.',
                'Click "No" to cancel and close this dialog without deleting the capture phrase.',
                ( confirmed ) => {
                    if ( confirmed ) {
                        this.doDelete( index );
                    }
                } );
        } else {
            this.doDelete( index );
        }
    }

    private doDelete( index: number ): void {
        this.capturePhrases?.splice( index, 1 );
        this.capturePhrasesChange.emit( this.capturePhrases );
        this.capturePhrasesTable?.renderRows();
    }

    public movePhraseUp( index: number ): void {
        if ( index > 0 ) {
            this.capturePhrases.splice( index - 1, 0, this.capturePhrases.splice( index, 1 )[ 0 ] );
            this.capturePhrasesTable?.renderRows();
        }
    }

    public movePhraseDown( index: number ): void {
        if ( index < this.capturePhrases.length - 1 ) {
            this.capturePhrases.splice( index + 1, 0, this.capturePhrases.splice( index, 1 )[ 0 ] );
            this.capturePhrasesTable?.renderRows();
        }
    }

}
