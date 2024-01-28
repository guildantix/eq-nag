import { TriggerAction } from '../core.model';

export class ContextMenuModel {
    public label: string;
    public action: () => void;
    public disabled: () => boolean;
    public hide: () => boolean;
    public matIcon: string;
    public matIconCssClass?: string;
    public cssClass?: string;
    public children?: ContextMenuModel[] | undefined;
    public keepOpen?: boolean = false;
}

export class TriggerEndedProperties {
    
    public endedDisplayText: boolean = false;
    public endedTextOverlayId: string = null;
    public endedText: string = null;
    public endedTextDuration: number = null;

    public endedSpeak: boolean = false;
    public endedSpeakPhrase: string = null;

    public endedChangeColor: boolean = false;
    public endedColor: string = null;
    public endedBackgroundColor: string = null;

}
