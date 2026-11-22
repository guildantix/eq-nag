const { ipcMain } = require( 'electron' );
const ForwardRef = require( './forward-ref' );
const CharacterDatabaseStore = require( './data/character-database' );
const { personaClassNamesByCode } = require( './utilities/persona-class' );

/**
 * Asks the player whether to update a character's class after the log shows a persona swap.
 * The class is never changed without an answer, because an equipment set that happens to be
 * named after a class doesn't prove the character changed class.
 */
class PersonaClassPrompt {

    /** @type {ForwardRef} */
    #mainWindowRef;

    /** @type {CharacterDatabaseStore} */
    #characterDatabase;

    /**
     * The latest unanswered swap of each character, by character id. A newer swap replaces an
     * older one.
     *
     * @type {Map<string, string>}
     */
    #pendingClassCodes = new Map();

    /**
     * The class the player declined for each character, by character id. Cleared when a different
     * class is detected, so swapping away and back asks again.
     *
     * @type {Map<string, string>}
     */
    #declinedClassCodes = new Map();

    /**
     * The request the main window is showing right now, or null. Only one is shown at a time.
     *
     * @type {{ characterId: string, classCode: string }|null}
     */
    #shownRequest = null;










    /**
     * Attaches the ipc events and the window events that deliver a waiting request.
     *
     * @param {ForwardRef} mainWindowRef The main window.
     * @param {CharacterDatabaseStore} characterDatabase The character database.
     */
    attachIpcEvents( mainWindowRef, characterDatabase ) {
        this.#mainWindowRef = mainWindowRef;
        this.#characterDatabase = characterDatabase;

        ipcMain.on( 'character:persona-detected', ( event, detection ) => {
            this.#handleDetection( detection.characterId, detection.classCode );
        } );

        ipcMain.on( 'character:class-suggestion:answer', ( event, answer ) => {
            this.#handleAnswer( answer.characterId, answer.classCode, answer.answer );
        } );

        // The angular side only listens once it has loaded, so an earlier request would be lost.
        // A reloaded page has lost the prompt it was showing, so show it again.
        ipcMain.on( 'main:angular-ready', () => {
            this.#shownRequest = null;
            this.showNextRequest();
        } );

        mainWindowRef.whenReady( () => {
            mainWindowRef.reference.on( 'show', () => this.showNextRequest() );
            mainWindowRef.reference.on( 'restore', () => this.showNextRequest() );
        } );
    }










    /**
     * Sends the oldest waiting request to the main window, when the window can show it and no
     * other request is on screen.
     */
    showNextRequest() {
        if ( this.#shownRequest !== null ) {
            return;
        }

        const mainWindow = this.#mainWindowRef?.reference;
        if ( !mainWindow || mainWindow.isDestroyed() || !mainWindow.isVisible() || mainWindow.isMinimized() ) {
            return;
        }

        const nextEntry = this.#pendingClassCodes.entries().next();
        if ( nextEntry.done ) {
            return;
        }

        const [ characterId, classCode ] = nextEntry.value;
        const character = this.#characterDatabase.find( characterId );
        if ( !character ) {
            this.#pendingClassCodes.delete( characterId );
            this.showNextRequest();
            return;
        }

        this.#shownRequest = { characterId: characterId, classCode: classCode };
        mainWindow.webContents.send( 'character:class-suggestion', {
            characterId: characterId,
            characterName: character.name,
            classCode: classCode,
            className: personaClassNamesByCode[ classCode ],
        } );
    }










    /**
     * Records a persona swap seen in a character's log and shows the prompt when it is a change.
     *
     * @param {string} characterId The character whose log held the line.
     * @param {string} classCode The class code of the persona the character swapped to.
     */
    #handleDetection( characterId, classCode ) {
        const character = this.#characterDatabase.find( characterId );
        if ( !character || !personaClassNamesByCode[ classCode ] ) {
            return;
        }

        if ( character.class === classCode ) {
            this.#pendingClassCodes.delete( characterId );
            this.#declinedClassCodes.delete( characterId );
            return;
        }

        if ( this.#declinedClassCodes.get( characterId ) === classCode ) {
            return;
        }
        this.#declinedClassCodes.delete( characterId );

        // The same swap again while its prompt is on screen needs nothing new.
        if ( this.#shownRequest?.characterId === characterId && this.#shownRequest.classCode === classCode ) {
            return;
        }

        // The log watcher and the combat parser can both report the same /who line.
        if ( this.#pendingClassCodes.get( characterId ) === classCode ) {
            this.showNextRequest();
            return;
        }

        this.#pendingClassCodes.delete( characterId );
        this.#pendingClassCodes.set( characterId, classCode );

        // A newer swap of the character on screen replaces its prompt.
        if ( this.#shownRequest?.characterId === characterId ) {
            this.#shownRequest = null;
        }

        this.showNextRequest();
    }










    /**
     * Handles what the player did with a prompt.
     *
     * @param {string} characterId The character the prompt was about.
     * @param {string} classCode The class the prompt offered.
     * @param {'updated'|'declined'|'dismissed'} answer What happened to the prompt. A dismissed
     *        prompt was closed without an answer (for example, another message replaced it), so
     *        the player is not asked again until the next swap or until the window is shown.
     */
    #handleAnswer( characterId, classCode, answer ) {
        const isAnswerToShownRequest = this.#shownRequest?.characterId === characterId
            && this.#shownRequest.classCode === classCode;
        if ( isAnswerToShownRequest ) {
            this.#shownRequest = null;
        }

        // A stale answer, for a prompt a newer swap already replaced, must not clear the newer one.
        if ( this.#pendingClassCodes.get( characterId ) === classCode && answer !== 'dismissed' ) {
            this.#pendingClassCodes.delete( characterId );
        }

        if ( answer === 'declined' ) {
            this.#declinedClassCodes.set( characterId, classCode );
        }

        if ( answer !== 'dismissed' ) {
            this.showNextRequest();
        }
    }

}










module.exports = PersonaClassPrompt;
