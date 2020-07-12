export class Trigger {
    
    public triggerId: string = null;
    public name: string = '';
    public capturePhrases: string | string[] = [];
    public useRegEx: boolean = false;
    public comments: string = '';
    public actions: any[] = [];

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
