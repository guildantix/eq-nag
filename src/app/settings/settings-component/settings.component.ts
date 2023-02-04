import { Component, Input, OnInit } from '@angular/core';
import { DialogService } from 'src/app/dialogs/dialog.service';
import { IpcService } from 'src/app/ipc.service';
import { MatTable } from '@angular/material/table';
import { customAlphabet } from 'nanoid';
import { ActionTypes, AuthorModel, CapturePhrase, DeathRecapPreferences, OverlayWindowModel, TriggerAction, TriggerModel } from 'src/app/core.model';
import { SettingsService } from '../settings-http.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SetupService } from 'src/app/setup/setup.service';
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const nanoid = customAlphabet( alphabet, 16 );
import * as _ from 'lodash-es';
import { CharactersListComponent } from 'src/app/characters-list/characters-list.component';
import { nagId } from 'src/app/core/nag-id.util';

interface IPhoneticTransform {
    id: string;
    originalText?: string;
    phoneticText?: string;
}

@Component( {
    selector: 'app-settings',
    templateUrl: 'settings.component.html', 
    styleUrls: [ 'settings.component.scss', '../../core.scss' ],
} )
export class SettingsComponent implements OnInit {
    
    public phoneticTransforms: IPhoneticTransform[] = [];
    public phoneticTransformsModified: boolean = false;
    public version: string;
    public masterVolume: number = 100;
    public voiceOptions: SpeechSynthesisVoice[] = [];
    public voiceIndex: number = null;
    public loadingGinaConfig: boolean = false;
    public author: AuthorModel = new AuthorModel();
    public trustedAuthor: boolean = false;
    public detrimentalOverlayId: string = null;
    public beneficialOverlayId: string = null;
    public alertOverlayId: string = null;
    public enableQuickShareImports: boolean = false;
    public deathRecapPreferences: DeathRecapPreferences = new DeathRecapPreferences();
    public minimizeToTrayOnLoad: boolean = false;
    public glowOnStartup: boolean = true;

    public get timerOverlays(): OverlayWindowModel[] {
        return this.overlays?.filter( m => m.overlayType === 'Timer' );
    }

    public get alertOverlays(): OverlayWindowModel[] {
        return this.overlays?.filter( m => m.overlayType === 'Alert' );
    }

    private overlays: OverlayWindowModel[] = [];

    @Input() public characterList: CharactersListComponent;

    constructor( private ipcService: IpcService, private dialogService: DialogService, private settingsService: SettingsService, private snackBar: MatSnackBar, private setupService: SetupService ) {
        speechSynthesis.onvoiceschanged = () => {
            this.voiceOptions = speechSynthesis.getVoices();
        };
    }

    ngOnInit() {

        this.ipcService.getAppVersion().subscribe( version => this.version = version );
        
        this.ipcService.tickReceived().subscribe( data => {
            this.masterVolume = data.masterVolume;
            this.voiceIndex = data.voiceIndex;
            this.overlays = data.overlays;
            
            this.phoneticTransforms = [];
            if ( data.phoneticTransforms ) {
                for ( let key of Object.keys( data.phoneticTransforms ) ) {
                    this.phoneticTransforms.push( { id: nanoid(), originalText: key, phoneticText: data.phoneticTransforms[ key ] } );
                }
            }

        } );

        this.loadSettings();
    }










    /**
     * Loads the settings data.
     */
    public loadSettings() {
        this.ipcService.getPhoneticTransforms().subscribe( transforms => {
            this.phoneticTransforms = [];
            if ( transforms ) {
                for ( let key of Object.keys( transforms ) ) {
                    this.phoneticTransforms.push( { id: nanoid(), originalText: key, phoneticText: transforms[ key ] } );
                }
            }
        } );
        
        this.ipcService.getAuthor().subscribe( author => {
            if ( author != null ) {
                this.author = author;
                this.settingsService.isTrusted( author.authorId ).subscribe( trusted => this.trustedAuthor = trusted );
            }
        } );

        this.ipcService.getOverlayWindows().subscribe( overlays => this.overlays = overlays );
        this.ipcService.getDetrimentalOverlayId().subscribe( id => this.detrimentalOverlayId = id );
        this.ipcService.getBeneficialOverlayId().subscribe( id => this.beneficialOverlayId = id );
        this.ipcService.getAlertOverlayId().subscribe( id => this.alertOverlayId = id );
        this.ipcService.getEnableQuickShareImports().subscribe( enabled => this.enableQuickShareImports = enabled );
        this.ipcService.getMinimizeToTrayOnLoad().subscribe( enabled => this.minimizeToTrayOnLoad = enabled );
        this.ipcService.getDeathRecapPreferences().subscribe( recapPrefs => this.deathRecapPreferences = recapPrefs ?? new DeathRecapPreferences() );
        this.ipcService.getEnableGlowOnStartup().subscribe( f => this.glowOnStartup = f );

    }









    
    /**
     * Saves changes to the user preference.
     */
    onQuickShareImportsChange(): void {
        this.ipcService.updateEnableQuickShareImports( this.enableQuickShareImports );
    }









    
    /**
     * Saves changes to the user preference.
     */
    onGlowOnStartupChanged(): void {
        this.ipcService.updateEnableGlowOnStartup( this.glowOnStartup );
    }










    /**
     * Saves changes to the user preference.
     */
    onMinimizeToTrayOnLoadChange(): void {
        this.ipcService.updateMinimizeToTrayOnLoad( this.minimizeToTrayOnLoad );
    }










    /**
     * Saves changes to the death recap preferences.
     */
    onDeathRecapPrefsChange(): void {
        
        let capturePhrase = new CapturePhrase();
        capturePhrase.phraseId = nagId();
        capturePhrase.requirePreviousPhrase = false;
        capturePhrase.useRegEx = true;
        capturePhrase.duration = null;

        if ( this.deathRecapPreferences.engageMode === 'hotkey' ) {
            this.deathRecapPreferences.hotkeyPhrase = '/hot "Death Recap" /em wonders how they died.';
            capturePhrase.phrase = '^${Character} wonders how they died\\.$';

        } else if ( this.deathRecapPreferences.engageMode === 'automatic' ) {
            capturePhrase.phrase = '^You have been slain by (?<slayer>[^!]*)!$';
            this.deathRecapPreferences.hotkeyPhrase = null;

        } else {
            return;
        }

        if ( this.deathRecapPreferences.triggerId != null ) {

            this.ipcService.getTrigger( this.deathRecapPreferences.triggerId ).subscribe( trigger => {
                
                // Rename the trigger.
                trigger.name = `Death Recap [${this.deathRecapPreferences.engageMode === 'hotkey' ? 'Hotkey' : 'Auto'}]`;
                
                // Assign the built capture phrase.
                trigger.capturePhrases = [ capturePhrase ];

                // Build the trigger action and assign to existing trigger.
                let action = new TriggerAction();
                action.phrases = [ capturePhrase.phraseId ];
                action.actionType = ActionTypes.DisplayDeathRecap;
                action.actionId = nagId();
                trigger.actions = [ action ];
                
                this.ipcService.updateTrigger( trigger ).subscribe( success => {
                    this.ipcService.updateDeathRecapPreferences( this.deathRecapPreferences );
                    this.snackBar.open( 'The death recap trigger has been updated!', 'Dismiss', { duration: 5000 } );
                } );
            } );
            
        } else {

            this.dialogService.showSelectTriggerFolderDialog( null, 'Select Trigger Folder', 'Select the folder that will contain the generated trigger.' ).subscribe( folderId => {
                if ( folderId ) {
                    
                    // Initialize a new trigger model.
                    let trigger = new TriggerModel();
                    trigger.name = `Death Recap [${this.deathRecapPreferences.engageMode === 'hotkey' ? 'Hotkey' : 'Auto'}]`;
                    trigger.folderId = folderId;
            
                    // Assign the built capture phrase.
                    trigger.capturePhrases = [ capturePhrase ];

                    // Build the trigger action.
                    let action = new TriggerAction();
                    action.phrases = [ capturePhrase.phraseId ];
                    action.actionType = ActionTypes.DisplayDeathRecap;
                    action.actionId = nagId();
                    trigger.actions = [ action ];

                    this.ipcService.createNewTrigger( trigger ).subscribe( triggerId => {

                        // Save the death recap preferences.
                        this.deathRecapPreferences.triggerId = triggerId;

                        this.ipcService.updateDeathRecapPreferences( this.deathRecapPreferences );
                        this.snackBar.open( 'The death recap trigger has been created!', 'Dismiss', { duration: 5000 } );
                    } );
                }
            } );
        }

    }










    /**
     * Copies the death recap command to the user's clipboard.
     */
    onCopyDeathRecapHotkeyCommand(): void {
        this.ipcService.sendTextToClipboard( this.deathRecapPreferences.hotkeyPhrase );

        this.snackBar.open( 'The command has been copied to your clipboard!', 'Dismiss', { duration: 5000 } );
    }









    
    /**
     * Allows the user to save a copy of their current log file, in zip form.
     */
    downloadLogFile() {
        this.ipcService.downloadLogZip();
    }









    
    /**
     * Stores the default detrimental overlay id.
     */
    saveDetrimentalOverlayId() {
        this.ipcService.saveDetrimentalOverlayId( this.detrimentalOverlayId );
    }









    
    /**
     * Stores the default beneficial overlay id.
     */
    saveBeneficialOverlayId() {
        this.ipcService.saveBeneficialOverlayId( this.beneficialOverlayId );
    }









    
    /**
     * Stores the default alert overlay id.
     */
    saveAlertOverlayId() {
        this.ipcService.saveAlertOverlayId( this.alertOverlayId );
    }









    
    /**
     * Uses TTS to speak the given phrase.
     * 
     * @param phrase The phrase to speak.
     */
    speakPhrase( phrase: string ): void {
        var utter = new SpeechSynthesisUtterance();
        utter.text = phrase;
        utter.voice = this.voiceOptions[ this.voiceIndex ];
        utter.onend = function ( event ) { }
        speechSynthesis.speak( utter );
    }









    
    /**
     * Stores the selected voice index.
     */
    onChangeVoice(): void {
        this.ipcService.updateVoiceIndex( this.voiceIndex );
    }









    
    /**
     * Stores the new master volume setting.
     */
    onChangeMasterVolume(): void {
        this.ipcService.updateMasterVolume( this.masterVolume );
    }









    
    /**
     * Opens the GINA import dialog.
     */
    openImportGinaDialog(): void {
        this.loadingGinaConfig = true;
        this.ipcService.showGinaImportWindow().subscribe( loaded => {
            this.loadingGinaConfig = false;
            if ( !loaded ) {
                this.dialogService.showErrorDialog( 'GINA Import', 'Could not load GINA data.' );
            }
        } );
    }









    
    /**
     * Adds a new empty phonetic transform.
     * 
     * @param table A reference to the MatTable object.
     */
    addPhoneticTransform( table: MatTable<IPhoneticTransform> ): void {
        this.phoneticTransforms.push( { id: nanoid() } );
        table?.renderRows();
        this.phoneticTransformsModified = true;
    }









    
    /**
     * Deletes the desired transform, after confirmation.
     * 
     * @param index The index of the desired transform.
     * @param table A reference to the MatTable object.
     */
    deletePhoneticTransform( index: number, table: MatTable<IPhoneticTransform> ): void {
        this.dialogService.showConfirmDialog(
            `Are you sure you want to delete ${this.phoneticTransforms[ index ].originalText}?`,
            'Click "Yes" to delete this transform.', 'Click "No" to close this dialog without deleting the transform.',
            confirmed => {
                if ( confirmed === true ) {
                    this.phoneticTransforms.splice( index, 1 );
                    this.ipcService.savePhoneticTransforms( this.getPhoneticTransformsRecord() );
                    table?.renderRows();
                    this.phoneticTransformsModified = true;
                }
            } );
    }









    
    /**
     * Saves the current phonetic transforms.
     */
    savePhoneticTransforms(): void {
        this.ipcService.savePhoneticTransforms( this.getPhoneticTransformsRecord() );
        this.phoneticTransformsModified = false;
    }









    
    /**
     * Returns the currently stored phonetic transforms.
     */
    getPhoneticTransformsRecord(): Record<string, string> {
        let transforms: Record<string, string> = {};
        let duplicates: string[] = [];

        this.phoneticTransforms.forEach( t => {
            if ( !transforms.hasOwnProperty( t.originalText ) ) {
                transforms[ t.originalText ] = t.phoneticText;
            } else {
                duplicates.push( t.originalText );
            }
        } );

        if ( duplicates.length > 0 ) {
            this.dialogService.showWarningDialog( 'Phonetics removed', [ 'Some of the phonetics in the list had duplicate original texts and were not saved.  Please review the list: ' ].concat( duplicates ) );
        }

        return transforms;
    }









    
    /**
     * Opens a dialog to show their current verified user status.
     */
    showVerifiedUserInfo() {
        this.dialogService.showCustomNotificationDialog( 'Verified Users', [ 'Your author account has been verified.', 'Verified authors are able to publish their triggers to the universal library.' ], 'verified_user' );
    }
    








    
    /**
     * Creates a new author record on the server.
     */
    createAuthor() {
        this.settingsService.createAuthor( this.author.name, this.author.discord ).subscribe( author => {
            this.ipcService.saveAuthor( author );
            this.author = author;
        } );
    }









    
    /**
     * For verified authors, allows the user to update their author details.
     */
    updateAuthor() {
        this.settingsService.updateAuthor( this.author ).subscribe( success => {
            if ( success ) {
                this.snackBar.open( 'Author file updated!', 'dismiss', { duration: 5000 } );
                this.ipcService.saveAuthor( this.author );
            }
        } );
    }









    
    /**
     * Submits a request for permissions to author and share package libraries.
     */
    requestVerification() {
        this.settingsService.requestVerification( this.author.authorId ).subscribe( success => {
            if ( success ) {
                this.snackBar.open( 'Request submitted!', 'dismiss', { duration: 5000 } );
            }
        } );
    }










    /**
     * Executes the setup wizard.
     */
    runSetupWizard() {
        this.setupService.showSetupWizard().subscribe( () => {
            this.ipcService.requestTick();
            this.characterList?.loadCharacters();
        } );
    }

}
