import { ChangeDetectorRef, Component, Input, NgZone, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { DialogService } from 'src/app/dialogs/dialog.service';
import { IpcService } from 'src/app/ipc.service';
import { MatTable } from '@angular/material/table';
import { MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field';
import { customAlphabet } from 'nanoid';
import { ActionTypes, AuthorModel, CapturePhrase, DeathRecapPreferences, PushRecapPreferences, pushRecapHotkeyCommand, LogMaintenanceRules, LogMaintenancePlanTypes, OverlayWindowModel, QuickShareAuthorListTypes, TriggerAction, TriggerModel, ScheduledTask, Range, SettingsKeys, SharedTriggerPermissions, DpsMeterSettings, FileReadDelays } from 'src/app/core.model';
import { SettingsService } from '../settings-http.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SetupService } from 'src/app/setup/setup.service';
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const nanoid = customAlphabet( alphabet, 16 );
import * as _ from 'lodash-es';
import { CharactersListComponent } from 'src/app/characters-list/characters-list.component';
import { nagId } from 'src/app/core/nag-id.util';
import { DateUtilities } from 'src/app/utilities/date.utilities';
import { MathUtilities } from 'src/app/utilities/math.utilities';
import { RollTrackerSettings } from 'src/app/rolls/rolls.component';

interface IPhoneticTransform {
    id: string;
    originalText?: string;
    phoneticText?: string;
}

interface IWatchStatus {
    characterId: string;
    name: string;
    class: string | null;
    watching: boolean;
    lastLineAt: number | null;
}

interface ISettingsSection {
    id: string;
    label: string;
}

const advancedStorageKey = 'nagSettingsAdvanced';

/** Readable names for the message ids a dialog can hide; the raw ids mean nothing to a user. */
const hiddenMessageNames: { [ modalId: string ]: string } = {
    'triggers-component:copy-hotkey:success-modal': 'Hotkey help (after copying a hotkey)',
};










/**
 * The Settings tab: a list of sections, each with an everyday part and an Advanced part.
 */
@Component( {
    selector: 'app-settings',
    templateUrl: 'settings.component.html', 
    styleUrls: [ 'settings.component.scss', '../../core.scss' ],
    // Scoped here, not in app.module, so fields outside Settings keep the default label.
    providers: [ { provide: MAT_FORM_FIELD_DEFAULT_OPTIONS, useValue: { floatLabel: 'always' } } ],
} )
export class SettingsComponent implements OnInit, OnDestroy {

    public readonly sections: ISettingsSection[] = [
        { id: 'status', label: 'Status' },
        { id: 'characters', label: 'Characters & log' },
        { id: 'overlays', label: 'Overlays' },
        { id: 'sound', label: 'Sound & voice' },
        { id: 'sharing', label: 'Sharing' },
        { id: 'rolls', label: 'Roll tracker' },
        { id: 'death', label: 'Death recap' },
        { id: 'push', label: 'Push recap' },
        { id: 'combat', label: 'Combat' },
        { id: 'advanced', label: 'Advanced' },
        { id: 'diagnostics', label: 'Diagnostics' },
    ];
    public section: string = 'status';
    public advancedOpen: boolean = false;
    public watchStatus: IWatchStatus[] = [];
    public statusNow: number = Date.now();
    public triggerCount: number = 0;
    public activeTriggerCount: number = 0;
    private statusTimerId: any = null;
    private statusActive: boolean = false;

    public phoneticTransforms: IPhoneticTransform[] = [];
    public phoneticTransformsModified: boolean = false;
    public version: string;
    public guidesUrl: string = 'https://guildantix.github.io/eq-nag/';
    public masterVolume: number = 100;
    public speechVolume: number = 100;
    public audioVolume: number = 100;
    public voiceOptions: SpeechSynthesisVoice[] = [];
    public voiceIndex: number = null;
    public author: AuthorModel = new AuthorModel();
    public trustedAuthor: boolean = false;
    public detrimentalOverlayId: string = null;
    public beneficialOverlayId: string = null;
    public alertOverlayId: string = null;
    public enableQuickShareImports: boolean = false;
    public sharedTriggerPermissions: SharedTriggerPermissions = new SharedTriggerPermissions();
    public deathRecapPreferences: DeathRecapPreferences = new DeathRecapPreferences();
    public pushRecapPreferences: PushRecapPreferences = new PushRecapPreferences();
    public pushRecapHotkeyCommand: string = pushRecapHotkeyCommand;
    /** The last saved death recap choice, so a failed change can restore the radio buttons. */
    private savedDeathRecapPreferences: DeathRecapPreferences = new DeathRecapPreferences();
    private pushRecapSubscription: Subscription = new Subscription();
    public minimizeToTrayOnLoad: boolean = false;
    public glowOnStartup: boolean = true;
    public quickShareAuthorListTypes: typeof QuickShareAuthorListTypes = QuickShareAuthorListTypes;
    public quickShareAuthorListType: QuickShareAuthorListTypes;
    public quickShareAuthorList: string = '';
    public settingsKeys: typeof SettingsKeys = SettingsKeys;
    public logMaintenancePlanTypes: typeof LogMaintenancePlanTypes = LogMaintenancePlanTypes; 
    public logMaintenanceRules: LogMaintenanceRules = new LogMaintenanceRules();
    public logTime: string|null;
    public logDays: number[] = [];
    public allowPrerelease: boolean = false;
    public enableCheckWindowPosition: boolean = true;
    // public enableGpuAcceleration: boolean = false;
    public exampleSpeech: string = 'Hello, my name is nag.';
    public baseSpeakingRate: number = 1;
    public utter: SpeechSynthesisUtterance | undefined = undefined;
    public updatedSettings: string[] = [];
    public rollSettings: RollTrackerSettings | null = null;
    public rollDefaults: RollTrackerSettings | null = null;
    public hiddenMessages: { id: string, name: string }[] = [];
    private fileReadDelays: FileReadDelays | null = null;
    private rollAdvancedChecked: boolean = false;
    private hasStoredAdvanced: boolean = false;

    public get timerOverlays(): OverlayWindowModel[] {
        return this.overlays?.filter( m => m.overlayType === 'Timer' );
    }

    public get alertOverlays(): OverlayWindowModel[] {
        return this.overlays?.filter( m => m.overlayType === 'Alert' );
    }

    private overlays: OverlayWindowModel[] = [];

    @Input() public characterList: CharactersListComponent;

    constructor(
        private readonly ipcService: IpcService,
        private readonly dialogService: DialogService,
        private readonly settingsService: SettingsService,
        private readonly snackBar: MatSnackBar,
        private readonly setupService: SetupService,
        private readonly ngZone: NgZone,
    ) {
        speechSynthesis.onvoiceschanged = () => {
            this.voiceOptions = speechSynthesis.getVoices();
        };
    }

    ngOnInit() {

        let storedAdvanced: any = null;
        try {
            storedAdvanced = JSON.parse( localStorage.getItem( advancedStorageKey ) );
        } catch ( error ) { }
        this.hasStoredAdvanced = storedAdvanced !== null && storedAdvanced !== undefined;
        this.advancedOpen = storedAdvanced === true;

        this.ipcService.getAppVersion().subscribe( version => this.version = version );
        
        this.ipcService.tickReceived().subscribe( data => {
            this.masterVolume = data.masterVolume;
            this.speechVolume = data.speechVolume;
            this.audioVolume = data.audioVolume;
            this.baseSpeakingRate = data.baseSpeakingRate;
            this.voiceIndex = data.voiceIndex;
            this.overlays = data.overlays;
            const userTriggers = data.triggers?.filter( t => !t.predefined ) ?? [];
            this.triggerCount = userTriggers.length;
            this.activeTriggerCount = userTriggers.filter( t => t.enabled !== false ).length;

            this.phoneticTransforms = [];
            if ( data.phoneticTransforms ) {
                for ( let key of Object.keys( data.phoneticTransforms ) ) {
                    this.phoneticTransforms.push( { id: nanoid(), originalText: key, phoneticText: data.phoneticTransforms[ key ] } );
                }
            }

        } );

        window.api.ipc.on( 'rolls:state', ( event: any, state: { settings: RollTrackerSettings, defaults: RollTrackerSettings } ) => {
            this.ngZone.run( () => {
                this.rollSettings = state.settings;
                this.rollDefaults = state.defaults;
                if ( !this.rollAdvancedChecked ) {
                    this.rollAdvancedChecked = true;
                    if ( !this.hasStoredAdvanced ) {
                        this.advancedOpen = state.settings?.advancedOpen === true;
                    } else if ( ( state.settings?.advancedOpen === true ) !== this.advancedOpen ) {
                        this.updateRollSettings( { advancedOpen: this.advancedOpen } );
                    }
                }
            } );
        } );
        window.api.ipc.send( 'rolls:get', null );

        this.loadHiddenMessages();
        // Subscribed once here, not in loadSettings, which runs on every visit to the tab.
        this.pushRecapSubscription.add( this.ipcService.onPushRecapPreferencesChanged().subscribe( recapPrefs => this.pushRecapPreferences.hiddenProcTexts = recapPrefs?.hiddenProcTexts ?? [] ) );

        this.loadSettings();
    }










    /**
     * Stops the Status card refresh and the Push Recap subscription when the page is destroyed.
     */
    ngOnDestroy(): void {
        if ( this.statusTimerId !== null && this.statusTimerId !== undefined ) {
            clearInterval( this.statusTimerId );
        }
        this.pushRecapSubscription.unsubscribe();
    }










    /**
     * Saves changed roll tracker settings; a null value restores that setting's default.
     *
     * @param changes The settings to change; a null value restores that setting's default.
     */
    updateRollSettings( changes: { [ K in keyof RollTrackerSettings ]?: RollTrackerSettings[ K ] | null } ): void {
        window.api.ipc.send( 'rolls:settings:set', changes );
    }










    /**
     * Saves a roll tracker text setting; a blank value restores the default, which is shown in the
     * box again.
     *
     * @param input The text box the value was typed in.
     * @param key The setting to save.
     */
    saveRollText( input: HTMLInputElement, key: 'pastePrefix' | 'pasteTemplate' | 'speakWinnerPhrase' | 'speakTiePhrase' ): void {
        if ( input.value.trim() === '' ) {
            input.value = this.rollDefaults?.[ key ] ?? '';
            this.updateRollSettings( { [ key ]: null } );
        } else {
            this.updateRollSettings( { [ key ]: key === 'pastePrefix' ? input.value.trim() : input.value } );
        }
    }










    /**
     * Saves a roll tracker number setting clamped to min and max; a blank value restores the
     * default. The box shows the saved value.
     *
     * @param input The number box the value was typed in.
     * @param key The setting to save.
     * @param min The lowest value allowed.
     * @param max The highest value allowed.
     */
    saveRollNumber( input: HTMLInputElement, key: 'closeAfterSeconds' | 'topCount' | 'resultSeconds', min: number, max: number ): void {
        const value = this.toRollNumber( input.value, min, max );
        input.value = String( value ?? this.rollDefaults?.[ key ] ?? '' );
        this.updateRollSettings( { [ key ]: value } );
    }










    /**
     * Speaks the phrase with sample values, using the default phrase when it is blank.
     *
     * @param phrase The phrase typed in the box.
     * @param kind Which default phrase to use when the box is blank.
     */
    previewRollPhrase( phrase: string, kind: 'winner' | 'tie' ): void {
        const fallback = ( kind === 'winner' ? this.rollDefaults?.speakWinnerPhrase : this.rollDefaults?.speakTiePhrase ) ?? '';
        const sample: Record<string, string> = { winner: 'Soandso', winners: 'Soandso, Brindle', roll: '692', min: '0', max: '1000', count: '3' };
        const text = phrase?.trim() ? phrase : fallback;
        try {
            const utterance = new SpeechSynthesisUtterance( text.replace( /\$\{(winner|winners|roll|min|max|count)\}/g, ( match, key ) => sample[ key ] ) );
            window.speechSynthesis.cancel();
            window.speechSynthesis.speak( utterance );
        } catch ( error ) {
            console.error( 'Roll Tracker > Failed to speak the preview', error );
        }
    }










    /**
     * Returns the input value as a whole number between min and max, or null, which restores the
     * default, when it is not a number.
     *
     * @param value The text typed in the number box.
     * @param min The lowest value allowed.
     * @param max The highest value allowed.
     * @returns The whole number, or null when the text is not a number.
     */
    toRollNumber( value: string, min: number, max: number ): number | null {
        const parsed = Math.round( +value );
        return value.trim() === '' || isNaN( parsed ) ? null : Math.min( max, Math.max( min, parsed ) );
    }









    
    /**
     * Shows the update notes window.
     */
    showUpdateNotes(): void {
        this.ipcService.getAppVersion().subscribe( currentVersion => {
            this.ipcService.showUpdateNotesWindow( `v${currentVersion}` );
        } );
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
        this.ipcService.getDeathRecapPreferences().subscribe( recapPrefs => {
            this.deathRecapPreferences = recapPrefs ?? new DeathRecapPreferences();
            this.savedDeathRecapPreferences = Object.assign( new DeathRecapPreferences(), this.deathRecapPreferences );
        } );
        this.ipcService.getPushRecapPreferences().subscribe( recapPrefs => {
            // Fills in defaults for fields an older saved file doesn't have yet.
            this.pushRecapPreferences = Object.assign( new PushRecapPreferences(), recapPrefs );
        } );
        this.ipcService.getEnableGlowOnStartup().subscribe( f => this.glowOnStartup = f );
        this.ipcService.getQuickShareAuthorsListType().subscribe( f => this.quickShareAuthorListType = f );
        this.ipcService.getQuickShareAuthorsList().subscribe( f => {
            this.quickShareAuthorList = f == null ? '' : f.join( '\r\n' );
        } );

        this.ipcService.getSetting<FileReadDelays>( 'fileReadDelays', false ).subscribe( f => this.fileReadDelays = f );
        this.ipcService.getSetting<boolean>( SettingsKeys.allowPrerelease ).subscribe( f => this.allowPrerelease = f );
        this.ipcService.getSetting<boolean>( SettingsKeys.enableCheckWindowPosition ).subscribe( f => this.enableCheckWindowPosition = f );

        // this.ipcService.getSetting<boolean>( SettingsKeys.enableGpuAcceleration ).subscribe( f => this.enableGpuAcceleration = f );
        this.ipcService.getSetting<LogMaintenanceRules>( SettingsKeys.logMaintenanceRules ).subscribe( f => {

            this.logMaintenanceRules = f;
            this.logTime = `${f.logSchedule?.hour ?? 0}:${f.logSchedule?.minute ?? 0}`;

            if ( f.logSchedule?.dayOfWeek instanceof Array ) {
                this.logDays = f.logSchedule.dayOfWeek;
            } else if (f.logSchedule?.dayOfWeek instanceof Range || (f.logSchedule?.dayOfWeek.hasOwnProperty('start') && f.logSchedule.dayOfWeek.hasOwnProperty('end'))) {
                this.logDays = Range.toArray( f.logSchedule.dayOfWeek as Range );
            } else if ( f.logSchedule?.dayOfWeek > 0 ) {
                this.logDays.push( +f.logSchedule.dayOfWeek );
            }

        } );
        this.ipcService.getSetting<SharedTriggerPermissions>( SettingsKeys.sharedTriggerPermissions ).subscribe( f => this.sharedTriggerPermissions = f ?? new SharedTriggerPermissions() );

    }

    public saveLogMaintenance(): void {

        if ( this.logMaintenanceRules.maintenancePlan === LogMaintenancePlanTypes.BySize ) {

            if ( !this.logMaintenanceRules.maxLogFileSizeMb || +this.logMaintenanceRules.maxLogFileSizeMb < 1 ) {
                this.logMaintenanceRules.maxLogFileSizeMb = 50;
            }

        } else if ( this.logMaintenanceRules.maintenancePlan === LogMaintenancePlanTypes.BySchedule ) {
            
            if ( !this.logTime && this.logDays.length > 0 ) {
                // If the user selects a day without selecting a time, default time is midnight.
                this.logTime = '12:00 AM';
            }

            if ( this.logTime ) {
                let logMaintenanceTime = DateUtilities.parseTimeString( this.logTime );
                this.logMaintenanceRules.logSchedule = new ScheduledTask();
                this.logMaintenanceRules.logSchedule.second = logMaintenanceTime.seconds;
                this.logMaintenanceRules.logSchedule.minute = logMaintenanceTime.minute;
                this.logMaintenanceRules.logSchedule.hour = logMaintenanceTime.hour;
                this.logMaintenanceRules.logSchedule.dayOfWeek = this.logDays;
            }

        }
        
        this.updateSetting( this.settingsKeys.logMaintenanceRules, this.logMaintenanceRules, 5 * 1000 );
    }









    
    /**
     * Generic setting update function.
     * 
     * @param key The setting key.
     * @param value The setting value.
     * @param delay Wait the given milliseconds before submitting changes.  If another change for the same key comes, the timeout is restarted.
     */
    public updateSetting<T>( key: SettingsKeys, value: T, delay: number = null, onExecuted: () => void = null ) {
        this.ipcService.updateSetting( key, value, delay, onExecuted );
        this.updatedSettings.push( key );
    }









    
    /**
     * Saves changes to the user preference.
     */
    onQuickShareImportsChange(): void {
        if ( this.quickShareAuthorList ) {
            let list = this.quickShareAuthorList.split( /\r\n|\n|\r/g ).filter( f => f != '' );
            this.ipcService.updateQuickShareAuthorsList( list );
        } else {
            this.ipcService.updateQuickShareAuthorsList( [] );
        }
        this.ipcService.updateEnableQuickShareImports( this.enableQuickShareImports );
        this.ipcService.updateQuickShareAuthorsListType( this.quickShareAuthorListType ?? QuickShareAuthorListTypes.Disabled );
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
     * Applies the chosen death recap mode: Off disables the trigger, the others enable it with
     * the matching capture phrase. The radio buttons only keep the new choice once it is saved.
     */
    onDeathRecapPrefsChange(): void {
        const chosenMode = this.deathRecapPreferences.engageMode;
        if ( chosenMode !== 'off' && chosenMode !== 'hotkey' && chosenMode !== 'automatic' ) {
            return;
        }

        const newPreferences = new DeathRecapPreferences();
        newPreferences.triggerId = this.savedDeathRecapPreferences.triggerId;
        newPreferences.engageMode = chosenMode;
        newPreferences.hotkeyPhrase = chosenMode === 'hotkey' ? '/hot "Death Recap" /em wonders how they died.' : null;

        const hasStoredTrigger = newPreferences.triggerId !== null && newPreferences.triggerId !== undefined;
        if ( !hasStoredTrigger ) {
            this.setUpDeathRecapTriggerForMode( newPreferences );
            return;
        }

        this.ipcService.getTrigger( newPreferences.triggerId ).subscribe( {
            next: trigger => {
                try {
                    if ( trigger === null || trigger === undefined ) {

                        // The trigger was deleted since the choice was saved.
                        newPreferences.triggerId = null;
                        this.setUpDeathRecapTriggerForMode( newPreferences );
                        return;
                    }

                    trigger.enabled = chosenMode !== 'off';
                    if ( chosenMode !== 'off' ) {
                        const capturePhrase = this.buildDeathRecapCapturePhrase( chosenMode );
                        trigger.name = this.getDeathRecapTriggerName( chosenMode );
                        trigger.capturePhrases = [ capturePhrase ];
                        trigger.actions = [ this.buildDeathRecapAction( capturePhrase ) ];
                    }

                    this.ipcService.updateTrigger( trigger ).subscribe( success => {
                        if ( success !== true ) {
                            this.revertDeathRecapChange( 'The death recap trigger could not be saved, so the setting was not changed.' );
                            return;
                        }
                        this.commitDeathRecapPreferences( newPreferences, chosenMode === 'off' ? 'The death recap trigger has been turned off.' : 'The death recap trigger has been updated!' );
                    } );
                } catch ( error ) {
                    this.revertDeathRecapChange( `The death recap setting could not be changed: ${error?.message ?? error}` );
                }
            },
            error: error => this.revertDeathRecapChange( `The death recap setting could not be changed: ${error?.message ?? error}` ),
        } );
    }










    /**
     * Handles a mode change when there is no trigger to update: Off just saves the choice,
     * the other modes create the trigger.
     *
     * @param newPreferences The preferences to save once the trigger exists.
     */
    private setUpDeathRecapTriggerForMode( newPreferences: DeathRecapPreferences ): void {
        if ( newPreferences.engageMode === 'off' ) {
            this.commitDeathRecapPreferences( newPreferences, 'Death recap is off.' );
            return;
        }

        this.dialogService.showSelectTriggerFolderDialog( null, 'Choose a folder', 'Select the folder that will contain the generated trigger.' ).subscribe( folderId => {
            if ( !folderId ) {

                // Nothing was saved, so show the saved choice again instead of an unsaved one.
                this.revertDeathRecapChange( null );
                return;
            }

            const capturePhrase = this.buildDeathRecapCapturePhrase( newPreferences.engageMode );
            const trigger = new TriggerModel();
            trigger.name = this.getDeathRecapTriggerName( newPreferences.engageMode );
            trigger.folderId = folderId;
            trigger.capturePhrases = [ capturePhrase ];
            trigger.actions = [ this.buildDeathRecapAction( capturePhrase ) ];

            this.ipcService.createNewTrigger( trigger ).subscribe( triggerId => {
                if ( triggerId === null || triggerId === undefined || triggerId === '' ) {
                    this.revertDeathRecapChange( 'The death recap trigger could not be created, so the setting was not changed.' );
                    return;
                }
                newPreferences.triggerId = triggerId;
                this.commitDeathRecapPreferences( newPreferences, 'The death recap trigger has been created!' );
            } );
        } );
    }










    /**
     * Builds the capture phrase that starts the death recap for a mode.
     *
     * @param mode The chosen mode, hotkey or automatic.
     */
    private buildDeathRecapCapturePhrase( mode: 'off' | 'hotkey' | 'automatic' ): CapturePhrase {
        const capturePhrase = new CapturePhrase();
        capturePhrase.phraseId = nagId();
        capturePhrase.requirePreviousPhrase = false;
        capturePhrase.useRegEx = true;
        capturePhrase.duration = null;

        if ( mode === 'hotkey' ) {

            // Live servers prefix /emote messages with "~ "; emulators don't.
            // Sample line: "~ Soandso wonders how they died."
            capturePhrase.phrase = '^(?:~ )?${Character} wonders how they died\\.$';
        } else {

            // Sample line: "You have been slain by a gnoll pup!"
            capturePhrase.phrase = '^You have been slain by (?<slayer>[^!]*)!$';
        }

        return capturePhrase;
    }










    /**
     * Builds the trigger action that opens the death recap window.
     *
     * @param capturePhrase The capture phrase that fires the action.
     */
    private buildDeathRecapAction( capturePhrase: CapturePhrase ): TriggerAction {
        const action = new TriggerAction();
        action.phrases = [ capturePhrase.phraseId ];
        action.actionType = ActionTypes.DisplayDeathRecap;
        action.actionId = nagId();
        return action;
    }










    /**
     * Gets the name of the death recap trigger for a mode.
     *
     * @param mode The chosen mode, hotkey or automatic.
     */
    private getDeathRecapTriggerName( mode: 'off' | 'hotkey' | 'automatic' ): string {
        return `Death Recap [${mode === 'hotkey' ? 'Hotkey' : 'Auto'}]`;
    }










    /**
     * Saves the new death recap choice and remembers it as the last saved one.
     *
     * @param newPreferences The preferences that were applied to the trigger.
     * @param message What to tell the user.
     */
    private commitDeathRecapPreferences( newPreferences: DeathRecapPreferences, message: string ): void {
        this.deathRecapPreferences = newPreferences;
        this.savedDeathRecapPreferences = Object.assign( new DeathRecapPreferences(), newPreferences );
        this.ipcService.updateDeathRecapPreferences( newPreferences );
        this.snackBar.open( message, 'Dismiss', { duration: 5000 } );
    }










    /**
     * Puts the radio buttons back to the last saved choice and optionally explains why.
     *
     * @param message What to tell the user, or null to stay silent (the user cancelled).
     */
    private revertDeathRecapChange( message: string | null ): void {
        this.deathRecapPreferences = Object.assign( new DeathRecapPreferences(), this.savedDeathRecapPreferences );
        if ( message !== null ) {
            this.snackBar.open( message, 'Dismiss', { duration: 8000 } );
        }
    }










    /**
     * Saves changes to the push recap quiet gap.
     */
    onPushRecapGapChange(): void {
        const gap = Math.round( +this.pushRecapPreferences.quietGapSeconds );
        this.pushRecapPreferences.quietGapSeconds = isNaN( gap ) ? 30 : Math.min( 300, Math.max( 5, gap ) );
        this.ipcService.updatePushRecapPreferences( this.pushRecapPreferences );
    }










    /**
     * Copies the push recap hotbutton to the user's clipboard.
     */
    onCopyPushRecapHotkeyCommand(): void {
        this.ipcService.sendTextToClipboard( pushRecapHotkeyCommand );

        this.snackBar.open( 'The command has been copied to your clipboard!', 'Dismiss', { duration: 5000 } );
    }










    /**
     * Saves changes to the Push tab preferences.
     */
    onPushRecapTabPrefsChange(): void {
        this.ipcService.updatePushRecapPreferences( this.pushRecapPreferences );
    }










    /**
     * Copies the death recap command to the user's clipboard.
     */
    onCopyDeathRecapHotkeyCommand(): void {
        this.ipcService.sendTextToClipboard( this.deathRecapPreferences.hotkeyPhrase );

        this.snackBar.open( 'The command has been copied to your clipboard!', 'Dismiss', { duration: 5000 } );
    }









    
    /**
     * Shows one section of the page.
     *
     * @param id The id of the section to show.
     */
    selectSection( id: string ): void {
        this.section = id;
        if ( id === 'advanced' ) {
            this.loadHiddenMessages();
        }
        this.updateStatusTimer();
    }










    /**
     * Shows or hides the Advanced part of every section; the choice is remembered.
     */
    toggleAdvanced(): void {
        this.setAdvanced( !this.advancedOpen );
    }










    /**
     * Sets the Advanced state of every section; the choice is remembered.
     *
     * @param open True to show the Advanced part of every section.
     */
    setAdvanced( open: boolean ): void {
        this.advancedOpen = open;
        this.hasStoredAdvanced = true;
        try {
            localStorage.setItem( advancedStorageKey, JSON.stringify( this.advancedOpen ) );
        } catch ( error ) { }
        if ( this.rollSettings ) {
            this.updateRollSettings( { advancedOpen: this.advancedOpen } );
        }
    }










    /**
     * Tells the page whether the Settings tab is on screen, so the Status card only
     * reads the log files then.
     *
     * @param active True while the Settings tab is the visible tab.
     */
    setActive( active: boolean ): void {
        this.statusActive = active;
        this.updateStatusTimer();
    }










    /**
     * Starts or stops the Status card refresh, which only runs while the Status section is visible.
     */
    private updateStatusTimer(): void {
        const needed = this.statusActive && this.section === 'status';
        if ( needed && ( this.statusTimerId === null || this.statusTimerId === undefined ) ) {
            this.refreshStatus();
            this.statusTimerId = setInterval( () => this.refreshStatus(), 3000 );
        } else if ( !needed && this.statusTimerId !== null && this.statusTimerId !== undefined ) {
            clearInterval( this.statusTimerId );
            this.statusTimerId = null;
        }
    }










    /**
     * Reads which characters are being watched and when their log files last changed.
     */
    private refreshStatus(): void {
        window.api.ipc.invoke( 'app:status:watching' )?.then( ( status: IWatchStatus[] ) => {
            this.ngZone.run( () => {
                this.watchStatus = status ?? [];
                this.statusNow = Date.now();
            } );
        } ).catch( () => { } );
    }










    /**
     * The characters whose log is being read now.
     */
    get watchedCharacters(): IWatchStatus[] {
        return this.watchStatus.filter( status => status.watching );
    }










    /**
     * Tells whether a setting hidden behind a section's Advanced switch differs from its default.
     *
     * @param id The id of the section to check.
     */
    customised( id: string ): boolean {
        if ( id === 'characters' ) {
            const delays = this.fileReadDelays;
            if ( delays === null || delays === undefined ) {
                return false;
            }
            return delays.readDelayMs !== 200 || delays.readErrorDelayMs !== 1000 || delays.flushDelayMs !== 1000;
        }
        if ( id === 'overlays' ) {
            return this.enableCheckWindowPosition === false;
        }
        if ( id === 'sound' ) {
            const volumesChanged = this.speechVolume !== 100 || this.audioVolume !== 100;
            return volumesChanged || this.baseSpeakingRate !== 1 || this.phoneticTransforms.length > 0;
        }
        if ( id === 'sharing' ) {
            const listType = this.quickShareAuthorListType;
            const listEnabled = listType !== null && listType !== undefined && listType !== QuickShareAuthorListTypes.Disabled;
            const permissions = this.sharedTriggerPermissions;
            return listEnabled || permissions.disableSharedGlowEffects === true || permissions.disableAllGlowEffects === true;
        }
        if ( id === 'rolls' ) {
            const roll = this.rollSettings;
            const defaults = this.rollDefaults;
            if ( roll === null || roll === undefined || defaults === null || defaults === undefined ) {
                return false;
            }
            const advancedKeys = [
                'closeAfterSeconds', 'topCount', 'resultSeconds', 'rerollRule',
                'pasteTemplate', 'speakWinnerPhrase', 'speakTiePhrase',
            ] as ( keyof RollTrackerSettings )[];
            return advancedKeys.some( key => roll[ key ] !== defaults[ key ] );
        }
        if ( id === 'push' ) {
            const hiddenTexts = this.pushRecapPreferences.hiddenProcTexts;
            const hasHiddenTexts = hiddenTexts !== null && hiddenTexts !== undefined && hiddenTexts.length > 0;
            return this.pushRecapPreferences.quietGapSeconds !== 30 || hasHiddenTexts;
        }
        return false;
    }










    /**
     * Describes how long ago the newest log file change was, or null when there is none.
     */
    get lastLineAge(): string | null {
        const times = this.watchedCharacters.map( status => status.lastLineAt ).filter( time => time !== null && time !== undefined );
        if ( times.length === 0 ) {
            return null;
        }
        const seconds = Math.max( 0, Math.round( ( this.statusNow - Math.max( ...times ) ) / 1000 ) );
        if ( seconds < 60 ) {
            return `${seconds} s ago`;
        } else if ( seconds < 3600 ) {
            return `${Math.floor( seconds / 60 )} min ago`;
        } else if ( seconds < 86400 ) {
            return `${Math.floor( seconds / 3600 )} h ago`;
        }
        return `${Math.floor( seconds / 86400 )} d ago`;
    }










    /**
     * Allows the user to save a copy of their current log file, in zip form.
     */
    downloadLogFile() {
        this.ipcService.downloadLogZip();
    }









    
    /**
     * Allows the user to save a copy of their current data files, in zip form.
     */
    downloadDataFiles() {
        this.ipcService.downloadDataFilesZip();
    }
    








    
    /**
     * Shows the current data folder in file explorer.
     */
    showDataFolder() {
        this.ipcService.showDataFolder();
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
    speakPhrase( phrase: string, rate: number | undefined = undefined ): void {
        
        if ( rate !== undefined ) {
            let x = Math.random();
            if ( x >= 0 && x <= 0.05 ) {
                phrase = 'I promise not to overthrow my human overlords.';
            }
        }

        rate = rate ?? 0;

        if ( this.baseSpeakingRate < 1 ) {
            rate = rate - ( 1 - this.baseSpeakingRate );
        } else if ( rate < this.baseSpeakingRate ) {
            rate = this.baseSpeakingRate;
        }

        if ( this.utter ) {
            speechSynthesis.cancel();
            this.utter = undefined;
        }

        this.utter = new SpeechSynthesisUtterance();
        this.utter.text = phrase;
        this.utter.voice = this.voiceOptions[ this.voiceIndex ];
        this.utter.onend = function ( event ) { }
        this.utter.rate = MathUtilities.clamp( rate, 0.1, 4 );
        this.utter.volume = ( this.speechVolume / 100 ) * ( this.masterVolume / 100 );
        speechSynthesis.speak( this.utter );

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










    /**
     * Reads the hidden messages again; a dialog can hide one while this page is open.
     */
    loadHiddenMessages(): void {
        this.ipcService.getHiddenModalIds().subscribe( hiddenModalIds => {
            // An older or hand-edited file may hold anything; only an array counts.
            const storedIds = Array.isArray( hiddenModalIds ) ? hiddenModalIds : [];
            this.hiddenMessages = storedIds.map( hiddenModalId => {
                const known = typeof hiddenModalId === 'string' && Object.prototype.hasOwnProperty.call( hiddenMessageNames, hiddenModalId );
                return { id: hiddenModalId, name: known ? hiddenMessageNames[ hiddenModalId ] : 'Other message' };
            } );
        } );
    }










    /**
     * Shows one hidden message again and keeps the others hidden.
     *
     * @param hiddenModalId The id of the message to show again.
     */
    showHiddenMessageAgain( hiddenModalId: string ): void {
        // Re-read first, so a message hidden in another window meanwhile isn't lost.
        this.ipcService.getHiddenModalIds().subscribe( hiddenModalIds => {
            const storedIds = Array.isArray( hiddenModalIds ) ? hiddenModalIds : [];
            this.ipcService.saveHiddenModalIds( storedIds.filter( storedId => storedId !== hiddenModalId ) );
            this.hiddenMessages = this.hiddenMessages.filter( hiddenMessage => hiddenMessage.id !== hiddenModalId );
            this.snackBar.open( 'That message will now appear again.', 'dismiss', { duration: 5000 } );
        } );
    }










    /**
     * Shows every hidden message again.
     */
    resetHiddenModals() {
        this.hiddenMessages = [];
        this.ipcService.resetHiddenModalIds();
        this.snackBar.open( 'All hidden messages will now appear again.', 'dismiss', { duration: 5000 } );
    }










    /**
     * Shows a dialog that explains window checking.
     */
    explainWindowChecking() {
        this.dialogService.showInfoDialog(
            'Relative Window Positioning',
            [
                'When the renderer loads an overlay, it will check to ensure that the monitor containing the overlay has moved.',
                'If the monitor has moved, the renderer will recalculate the position of the overlay relative to the containing monitor. This will ensure that the overlay appears in the same location on the monitor.',
                'However, on some systems the OS reports the monitor as having moved, even when it has not.',
                'Disabling this setting will prevent this check from happening, which may resolve the issue.',
                'However, if disabled and your monitor positions have changed, the overlay may appear in the wrong location or entirely off-screen.  When this happens, you can use the Send to Origin button on the overlay list to reset the overlay position.',
            ],
            'wide',
        );
    }










}
