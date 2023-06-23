import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { SettingsKeys, TriggerAction } from 'src/app/core.model';
import { IpcService } from 'src/app/ipc.service';

@Component( {
    selector: 'app-trigger-action-speak',
    templateUrl: 'trigger-action-speak.component.html',
    styleUrls: ['trigger-action-speak.component.scss']
} )
export class TriggerActionSpeakComponent implements OnInit {

    @Input() public action: TriggerAction;

    private voiceOptions: SpeechSynthesisVoice[] = [];
    private voiceIndex: number = null;

    constructor(
        private readonly ipcService: IpcService,
    ) {
        speechSynthesis.onvoiceschanged = () => {
            this.voiceOptions = speechSynthesis.getVoices();
        };
        this.voiceOptions = speechSynthesis.getVoices();
    }

    ngOnInit() {
        this.ipcService.getSetting<number>( SettingsKeys.voiceIndex ).subscribe( index => this.voiceIndex = index );
    }

    /**
     * Uses TTS to speak the given phrase.
     * 
     * @param phrase The phrase to speak.
     */
    speakPhrase( phrase: string, rate: number ): void {
        var utter = new SpeechSynthesisUtterance();
        utter.text = phrase.replace( /\$/gi, '' ).replace( /\{/gi, '' ).replace( /\}/gi, '' );
        utter.voice = this.voiceOptions[ this.voiceIndex ];
        utter.onend = function ( event ) { }
        utter.rate = rate ?? 1;
        speechSynthesis.speak( utter );
    }

}
