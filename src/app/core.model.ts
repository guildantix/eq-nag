export class TriggerModel {
    
    public triggerId: string = null;
    public name: string = '';
    public capturePhrases: CapturePhrase[] = [];
    public comments: string = '';
    public actions: any[] = [];
    public captureMethod: string = 'Any match';

}

export class CapturePhrase {
    public phrase: string;
    public useRegEx: boolean = false;
    public requirePreviousPhrase: boolean = false;
    public duration: number = null;
}

export class DkpEntryModel {

    public entryId: number = 0;
    public timeStamp: Date = new Date();
    public character: string = '';
    public item: string = '';
    public dkp: number = 0;
    public entered: boolean = false;
    public dateEntered: Date = null;

}

export class OverlayWindowModel {

    public overlayId: string = null;
    public windowHeight: number = null;
    public windowWidth: number = null;
    public x: number = null;
    public y: number = null;
    public name: string = '';
    public overlayType: string = '';
    public fontFamily: string = 'Roboto';
    public fontSize: number = 14;
    public lineHeight: number = 90;
    public fontWeight: number = 400;
    public fontColor: string = '#ffffff';
    public fontTransparency: number = 1.0;
    public backgroundColor: string = '#000000';
    public backgroundTransparency: number = 1.0;
    public borderColor: string = '#000000';
    public borderTransparency: number = 1.0;

    public isValid (): boolean {
        return name != null && this.overlayType != null;
    }

}

export class DataTickModel {

    public dkpEntries: DkpEntryModel[] = [];
    public logFile: string;
    public voiceIndex: number;
    public triggers: TriggerModel[] = [];
    public overlays: OverlayWindowModel[] = [];

}

// export enum TriggerActionTypes {
//     TextToSpeech = 1
// }

// export interface ITriggerAction {

//     actionType: TriggerActionTypes;
//     label: string;

// }

// export class TtsTriggerActionModel implements ITriggerAction {
    
//     public actionType: TriggerActionTypes = TriggerActionTypes.TextToSpeech;
//     public label: string;

// }
