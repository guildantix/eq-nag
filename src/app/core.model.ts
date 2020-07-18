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

export class DataTickModel {

    public dkpEntries: DkpEntryModel[] = [];
    public logFile: string;
    public voiceIndex: number;

}
