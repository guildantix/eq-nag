import { Component, OnInit } from '@angular/core';
import { DialogService } from 'src/app/dialogs/dialog.service';
import { IpcService } from 'src/app/ipc.service';
import { MatTable } from '@angular/material/table';
import { customAlphabet } from 'nanoid';
import { AuthorModel } from 'src/app/core.model';
import { SettingsService } from '../settings-http.service';
import { MatSnackBar } from '@angular/material/snack-bar';
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const nanoid = customAlphabet( alphabet, 16 );

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
    public voiceOptions: SpeechSynthesisVoice[] = [];
    public voiceIndex: number = null;
    public loadingGinaConfig: boolean = false;
    public author: AuthorModel = new AuthorModel();
    public trustedAuthor: boolean = false;

    constructor( private ipcService: IpcService, private dialogService: DialogService, private settingsService: SettingsService, private snackBar: MatSnackBar ) {
        speechSynthesis.onvoiceschanged = () => {
            this.voiceOptions = speechSynthesis.getVoices();
        };
    }

    ngOnInit() {
        this.ipcService.tickReceived().subscribe( data => {
            // this.dkpEntries = data.dkpEntries;
            // this.logFile = data.logFile;
            this.voiceIndex = data.voiceIndex;
            // this.overlays = data.overlays;
            // this.enableFct = data.enableFct;
            // this.damageDealtOverlayId = data.damageDealtOverlayId;
            // this.damageTakenOverlayId = data.damageReceivedOverlayId;
            // this.focusEffectSettings.hasExtendedDotFocus = data.hasExtendedDotFocus;
            // this.focusEffectSettings.extendedDotFocusPercent = data.extendedDotFocusPercent;
            // this.focusEffectSettings.extendedDotFocusDecayLevel = data.extendedDotFocusDecayLevel;

            this.phoneticTransforms = [];
            if ( data.phoneticTransforms ) {
                for ( let key of Object.keys( data.phoneticTransforms ) ) {
                    this.phoneticTransforms.push( { id: nanoid(), originalText: key, phoneticText: data.phoneticTransforms[ key ] } );
                }
            }

        } );

        this.ipcService.getAppVersion().subscribe( version => this.version = version );
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
        })
    }

    speakPhrase( phrase: string ): void {
        var utter = new SpeechSynthesisUtterance();
        utter.text = phrase;
        utter.voice = this.voiceOptions[ this.voiceIndex ];
        utter.onend = function ( event ) { }
        speechSynthesis.speak( utter );
    }

    onChangeVoice(): void {
        this.ipcService.updateVoiceIndex( this.voiceIndex );
    }

    openImportGinaDialog(): void {
        this.loadingGinaConfig = true;
        this.ipcService.showGinaImportWindow().subscribe( loaded => {
            this.loadingGinaConfig = false;
            if ( !loaded ) {
                this.dialogService.showErrorDialog( 'GINA Import', 'Could not load GINA data.' );
            }
        } );
    }

    addPhoneticTransform( table: MatTable<IPhoneticTransform> ): void {
        this.phoneticTransforms.push( { id: nanoid() } );
        table?.renderRows();
        this.phoneticTransformsModified = true;
    }

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

    savePhoneticTransforms(): void {
        this.ipcService.savePhoneticTransforms( this.getPhoneticTransformsRecord() );
        this.phoneticTransformsModified = false;
    }

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

    showVerifiedUserInfo() {
        this.dialogService.showCustomNotificationDialog( 'Verified Users', [ 'Your author account has been verified.', 'Verified authors are able to publish their triggers to the universal library.' ], 'verified_user' );
    }
//https://discord.gg/v2MTmhEc
    createAuthor() {
        this.settingsService.createAuthor( this.author.name, this.author.discord ).subscribe( author => {
            this.ipcService.saveAuthor( author );
            this.author = author;
        } );
    }

    updateAuthor() {
        this.settingsService.updateAuthor( this.author ).subscribe( success => {
            if ( success ) {
                this.snackBar.open( 'Author file updated!', 'dismiss', { duration: 5000 } );
                this.ipcService.saveAuthor( this.author );
            }
        } );
    }

}
