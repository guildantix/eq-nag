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

    private _capturePhrases: CapturePhrase[] = [];
    public get capturePhrases(): CapturePhrase[] {
        return this._capturePhrases;
    }
    @Input() public set capturePhrases( value: CapturePhrase[] ) {
        this._capturePhrases = value;
        this.updatePhraseInputTypes();
    }
    @Output() public capturePhrasesChange: EventEmitter<CapturePhrase[]> = new EventEmitter<CapturePhrase[]>();

    @Input() public captureMethod: string;
    @Output() public captureMethodChange: EventEmitter<string> = new EventEmitter<string>();

    @Input() public useCooldown: boolean;
    @Output() public useCooldownChange: EventEmitter<boolean> = new EventEmitter<boolean>();

    @Input() public cooldownDuration: number;
    @Output() public cooldownDurationChange: EventEmitter<number> = new EventEmitter<number>();

    @Input() public startWithNewPhrase: boolean = true;

    public capturePhraseTableColumns = [ 'moveIndex', 'number', 'phrase', 'regEx', 'delete' ];

    public showPhraseTextArea: Record<string, boolean> = {};

    @ViewChild( 'capturePhrasesTable' ) private capturePhrasesTable: MatTable<any>;
    
    constructor( private dialogService: DialogService ) { }

    ngOnInit() {
        if ( this.startWithNewPhrase ) {
            this.addNewCapturePhrase();
        }
    }

    public updatePhraseInputTypes(): void {
        this.capturePhrases.forEach( ( phrase, index ) => {
            this.showPhraseTextArea[ phrase.phraseId ] = phrase.phrase?.length >= 75;
        } );
    }

    public onBlur(): void {
        this.updatePhraseInputTypes();
    }

    public addNewCapturePhrase(): void {
        let phrase: CapturePhrase = new CapturePhrase();
        phrase.phraseId = nanoid();
        this.capturePhrases.push( phrase );
        this.capturePhrasesChange.emit( this.capturePhrases );
        this.capturePhrasesTable?.renderRows();
        this.updatePhraseInputTypes();
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
        this.updatePhraseInputTypes();
    }

    public movePhraseUp( index: number ): void {
        if ( index > 0 ) {
            this.capturePhrases.splice( index - 1, 0, this.capturePhrases.splice( index, 1 )[ 0 ] );
            this.capturePhrasesTable?.renderRows();
            this.updatePhraseInputTypes();
        }
    }

    public movePhraseDown( index: number ): void {
        if ( index < this.capturePhrases.length - 1 ) {
            this.capturePhrases.splice( index + 1, 0, this.capturePhrases.splice( index, 1 )[ 0 ] );
            this.capturePhrasesTable?.renderRows();
            this.updatePhraseInputTypes();
        }
    }

    public explainCooldowns() {
        this.dialogService.showInfoDialog(
            'Capture Cooldowns',
            [
                'Not all of EverQuest actions are logged.  For example, Lord Nagafen doesn\'t have a casting emote for Fire Breath.',
                'The common way to deal with these abilities is to capture when someone is hit with this ability.  However, the size of the raid can make these captures expensive.',
                'In this example, by enabling capture cooldown and setting the duration to 1 second, the trigger will effectively only capture the first person hit with this ability.',
                'During the cooldown, the capture phrase regular expressions are not executed.'
            ] );
    }

}
