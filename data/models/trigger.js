
    // DisplayText = 0,
    // PlayAudio = 1,
    // Speak = 2,
    // Timer = 3,
    // Countdown = 4,
    // StoreVariable = 5,

var ActionTypes = {
    '0': 'DisplayText',
    '1': 'PlayAudio',
    '2': 'Speak',
    '3': 'Timer',
    '4': 'Countdown',
    '5': 'StoreVariable',
    DisplayText: 0,
    PlayAudio: 1,
    Speak: 2,
    Timer: 3,
    Countdown: 4,
    StoreVariable: 5
}

class TriggerAction {

    actionId = null;
    actionType = ActionTypes.DisplayText;

}

class Trigger {
    
    triggerId = null;
    name = '';
    capturePhrases = [];
    useRegEx = false;
    comments = '';
    actions = [];
    captureMethod = 'Any match';

}

module.exports = { Trigger, TriggerAction, ActionTypes };
