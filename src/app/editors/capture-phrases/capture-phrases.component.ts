import { Component, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core';
import { MatTable } from '@angular/material/table';
import { CapturePhrase } from 'src/app/core.model';
import { DialogService } from 'src/app/dialogs/dialog.service';
import { getRegexHighlightedHtml } from 'src/app/utilities/regex-highlighter.utilities';
import { customAlphabet } from 'nanoid';

const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const nanoid = customAlphabet(alphabet, 16);











/**
 * Component for managing capture phrases with regex highlighting support.
 * Provides functionality to add, edit, delete, and reorder capture phrases,
 * with visual regex pattern highlighting and cooldown configuration.
 */
@Component({
    selector: 'app-capture-phrases',
    templateUrl: 'capture-phrases.component.html',
    styleUrls: ['capture-phrases.component.scss', '../../core.scss', '../../modal.scss']
})
export class CapturePhrasesComponent implements OnInit {











    /**
     * Tracks which phrase overlay is currently open for regex highlighting.
     * null or -1 indicates no overlay is open.
     */
    overlayOpenIndex: number | null = null;











    /**
     * Array of HTML strings containing syntax-highlighted regex patterns.
     * Each index corresponds to the highlighted version of the phrase at the same index.
     */
    highlightedPhrases: string[] = [];











    /**
     * Internal storage for capture phrases array.
     */
    private _capturePhrases: CapturePhrase[] = [];











    /**
     * Gets the current array of capture phrases.
     * @returns The capture phrases array
     */
    public get capturePhrases(): CapturePhrase[] {
        return this._capturePhrases;
    }











    /**
     * Sets the capture phrases array and updates highlights.
     * @param value - The new capture phrases array
     */
    @Input() public set capturePhrases(value: CapturePhrase[]) {
        this._capturePhrases = value;
        this.updateAllHighlights();
    }











    /**
     * Emits when the capture phrases array changes.
     */
    @Output() public capturePhrasesChange: EventEmitter<CapturePhrase[]> = new EventEmitter<CapturePhrase[]>();











    /**
     * The capture method to use for phrases.
     */
    @Input() public captureMethod: string;











    /**
     * Emits when the capture method changes.
     */
    @Output() public captureMethodChange: EventEmitter<string> = new EventEmitter<string>();











    /**
     * Whether to use cooldown between captures.
     */
    @Input() public useCooldown: boolean;











    /**
     * Emits when the cooldown usage setting changes.
     */
    @Output() public useCooldownChange: EventEmitter<boolean> = new EventEmitter<boolean>();











    /**
     * Duration of the cooldown in seconds.
     */
    @Input() public cooldownDuration: number;











    /**
     * Emits when the cooldown duration changes.
     */
    @Output() public cooldownDurationChange: EventEmitter<number> = new EventEmitter<number>();











    /**
     * Whether to start the component with a new empty phrase.
     * Defaults to true.
     */
    @Input() public startWithNewPhrase: boolean = true;











    /**
     * Column definitions for the capture phrases table.
     */
    public capturePhraseTableColumns = ['moveIndex', 'number', 'phrase', 'regEx', 'regExOptions', 'delete'];






















    /**
     * Reference to the Material table for rendering updates.
     */
    @ViewChild('capturePhrasesTable') private capturePhrasesTable: MatTable<any>;











    /**
     * Creates an instance of CapturePhrasesComponent.
     * @param dialogService - Service for displaying dialog boxes
     */
    constructor(private dialogService: DialogService) { }











    /**
     * Angular lifecycle hook called after component initialization.
     * Adds a new capture phrase if startWithNewPhrase is true.
     */
    ngOnInit() {
        if (this.startWithNewPhrase) {
            this.addNewCapturePhrase();
            this.updateAllHighlights();
        }
    }

































    /**
     * Adds a new empty capture phrase to the collection.
     * Generates a unique ID and updates the table display.
     */
    public addNewCapturePhrase(): void {
        let phrase: CapturePhrase = new CapturePhrase();
        phrase.phraseId = nanoid();
        this.capturePhrases.push(phrase);
        this.capturePhrasesChange.emit(this.capturePhrases);
        this.capturePhrasesTable?.renderRows();
        this.updateAllHighlights();
    }











    /**
     * Toggles the case-insensitive flag for a capture phrase.
     * @param phrase - The phrase to toggle case sensitivity for
     */
    public toggleIgnoreCase(phrase: CapturePhrase): void {
        phrase.ignoreCase = !phrase.ignoreCase;
        this.updateAllHighlights();
    }











    /**
     * Deletes a capture phrase after confirmation dialog.
     * @param index - The index of the phrase to delete
     */
    public deleteCapturePhrase(index: number): void {
        if (this.dialogService) {
            this.dialogService.showConfirmDialog(
                'Are you certain you want to delete this capture phrase?',
                'Click "Yes" to delete the capture phrase.',
                'Click "No" to cancel and close this dialog without deleting the capture phrase.',
                (confirmed) => {
                    if (confirmed) {
                        this.doDelete(index);
                        this.updateAllHighlights();
                    }
                });
        } else {
            this.doDelete(index);
            this.updateAllHighlights();
        }
    }











    /**
     * Performs the actual deletion of a capture phrase.
     * @param index - The index of the phrase to delete
     */
    private doDelete(index: number): void {
        this.capturePhrases?.splice(index, 1);
        this.capturePhrasesChange.emit(this.capturePhrases);
        this.capturePhrasesTable?.renderRows();
        this.updateAllHighlights();
    }











    /**
     * Moves a capture phrase up one position in the list.
     * @param index - The index of the phrase to move up
     */
    public movePhraseUp(index: number): void {
        if (index > 0) {
            this.capturePhrases.splice(index - 1, 0, this.capturePhrases.splice(index, 1)[0]);
            this.capturePhrasesTable?.renderRows();
            this.updateAllHighlights();
        }
    }











    /**
     * Moves a capture phrase down one position in the list.
     * @param index - The index of the phrase to move down
     */
    public movePhraseDown(index: number): void {
        if (index < this.capturePhrases.length - 1) {
            this.capturePhrases.splice(index + 1, 0, this.capturePhrases.splice(index, 1)[0]);
            this.capturePhrasesTable?.renderRows();
            this.updateAllHighlights();
        }
    }











    /**
     * Displays an informational dialog explaining how capture cooldowns work.
     * Provides context about EverQuest action logging and raid optimization.
     */
    public explainCooldowns() {
        this.dialogService.showInfoDialog(
            'Capture Cooldowns',
            [
                'Not all of EverQuest actions are logged. For example, Lord Nagafen doesn\'t have a casting emote for Fire Breath.',
                'The common way to deal with these abilities is to capture when someone is hit with this ability. However, the size of the raid can make these captures expensive.',
                'In this example, by enabling capture cooldown and setting the duration to 1 second, the trigger will effectively only capture the first person hit with this ability.',
                'During the cooldown, the capture phrase regular expressions are not executed.'
            ]);
    }











    /**
     * Handles changes to the regex checkbox for a phrase.
     * Closes the overlay if regex is disabled.
     * @param index - The index of the phrase being modified
     * @param checked - The new checkbox state
     */
    public onRegexChange(index: number, checked: boolean) {
        this.capturePhrases[index].useRegEx = checked;
        
        // Close overlay if the Regex checkbox gets unchecked
        if (!checked && this.overlayOpenIndex === index) {
            this.overlayOpenIndex = -1;
        }
        
        this.capturePhrasesChange.emit(this.capturePhrases);
    }











    /**
     * Updates syntax highlighting for all capture phrases.
     * Should be called whenever phrases are modified to keep highlights in sync.
     */
    private updateAllHighlights() {
        this.highlightedPhrases = this.capturePhrases.map(p =>
            getRegexHighlightedHtml(p.phrase, p.useRegEx)
        );
    }











    /**
     * Handler for phrase text changes.
     * Strips newlines and updates the highlight for the specific phrase.
     * @param index - The index of the phrase that changed
     */
    public onPhraseChange(index: number) {
        this.capturePhrases[index].phrase = this.capturePhrases[index].phrase?.replace(/\r?\n|\r/g, ' ') || '';

        const p = this.capturePhrases[index];
        this.highlightedPhrases[index] = getRegexHighlightedHtml(p.phrase, p.useRegEx);
        this.capturePhrasesChange.emit(this.capturePhrases);
    }











    /**
     * Toggles the regex highlighting overlay for a phrase.
     * Only one overlay can be open at a time.
     * @param index - The index of the phrase to toggle overlay for
     */
    public toggleOverlay(index: number) {
        if (this.overlayOpenIndex === index) {
            this.overlayOpenIndex = null;
            this.updateAllHighlights();
        } else {
            this.overlayOpenIndex = index;
        }
    }











    /**
     * Handler for paste events on phrase inputs.
     * Uses setTimeout to ensure pasted content is in the model before processing.
     * @param index - The index of the phrase being pasted into
     */
    public onPaste(index: number) {
        setTimeout(() => {
            this.onPhraseChange(index);
        }, 0);
    }
}
