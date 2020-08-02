var dkpEntryIds = 0;

class DkpEntryModel {

    entryId = null;
    timeStamp = new Date();
    character = '';
    item = '';
    dkp = 0;
    entered = false;
    dateEntered = null;

    constructor( timeStamp, character, item, dkp ) {
        this.timeStamp = timeStamp;
        this.character = character;
        this.item = item;
        this.dkp = dkp;
        this.entered = false;
        this.dateEntered = null;
    }

}

module.exports = DkpEntryModel;
