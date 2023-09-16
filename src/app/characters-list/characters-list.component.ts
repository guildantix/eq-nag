import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CharacterModel } from '../core.model';
import { DialogService } from '../dialogs/dialog.service';
import { IpcService } from '../ipc.service';
import * as _ from 'lodash-es';

@Component( {
    selector: 'app-characters-list',
    templateUrl: 'characters-list.component.html',
    styleUrls: [ 'characters-list.component.scss' ]
} )
export class CharactersListComponent implements OnInit {

    public characters: CharacterModel[] = [];
    public selectedTabIndex: number = -1;
    public activeLogFilesDictionary: any = {};
    public triggerProfiles: string[] = [ 'Main', 'Alt', 'Box' ];
    
    @ViewChild( 'fileSelector' ) private fileSelector: ElementRef<HTMLInputElement>;
    @ViewChild( 'savedLabel' ) private savedLabel: ElementRef<HTMLDivElement>;

    private snackBarTimeoutId: number = null;

    constructor( private dialogService: DialogService, private ipcService: IpcService, private snackBar: MatSnackBar ) { }

    ngOnInit(): void {
        this.loadCharacters();
        this.ipcService.characterLogActivated().subscribe( chrId => this.activeLogFilesDictionary[ chrId ] = true );
        this.ipcService.characterLogDeactivated().subscribe( chrId => this.activeLogFilesDictionary[ chrId ] = false );
    }

    public newCharacter(): void {
        this.dialogService.showNewCharacterDialog( characterId => this.loadCharacters( characterId ) );
    }

    public loadCharacters( characterId?: string ): void {
        this.ipcService.getCharacters().subscribe( data => {
            this.characters = data;
            if ( characterId != null ) {
                let i: number = _.findIndex( this.characters, f => f.characterId === characterId );
                this.selectedTabIndex = i >= 0 && i < this.characters.length ? i : -1;
            }
        } );
    }

    public onCharacterSelected( character: CharacterModel, index: number | undefined = undefined ): void {
        this.selectedTabIndex = index === 0 || index > 0 ? index : _.findIndex( this.characters, f => f.characterId === character.characterId );
    }

    public onTriggerProfileChanged( character: CharacterModel ): void {
        
    }

    public updateTriggerProfile( character: CharacterModel, profile: string ): void {
        this.dialogService.showConfirmationDialog(
            [ `Are you sure you want to update the "${profile}" profile?`, 'This will update the profile to include all enabled and disabled triggers from this character, and update all other characters using the same profile.' ],
            'Click "Yes" to update this profile and all characters using this profile.',
            'Click "No" to close this dialog without updating the profile.' )
            .subscribe( confirmed => {
                if ( confirmed ) {
                    
                }
            } );
    }

    public reapplyTriggerProfile( character: CharacterModel, profile: string ): void {
        this.dialogService.showConfirmationDialog(
            [ `Are you sure you want to reapply the "${profile}" profile?`, 'This will reset the character\'s enabled and disabled triggers and reapply from the profile.' ],
            'Click "Yes" to reapply the profile to this character.',
            'Click "No" to close this dialog without reapplying the profile.' )
            .subscribe( confirmed => {
                if ( confirmed ) {
                    
                }
            } );
    }

    public updateCharacter( character: CharacterModel ): void {

        character.extendedDotFocusPercent = this.calculateFocusPercent( character.extendedDotFocusPercent );
        character.extendedBeneficialFocusPercent = this.calculateFocusPercent( character.extendedBeneficialFocusPercent );
        character.beneficialCastingSpeedFocusPercent = this.calculateFocusPercent( character.beneficialCastingSpeedFocusPercent );
        character.extendedBeneficialFocusAaPercent = this.calculateFocusPercent( character.extendedBeneficialFocusAaPercent );
        // let dotExtFocusPct = /([0-9]*)\+([0-9]*)/gi.exec( character.extendedDotFocusPercent?.toString() );
        // if ( dotExtFocusPct?.length > 0 ) {
        //     character.extendedDotFocusPercent = +dotExtFocusPct[ 1 ] + +dotExtFocusPct[ 2 ];
        // } else if ( character.extendedDotFocusPercent ) {
        //     character.extendedDotFocusPercent = +character.extendedDotFocusPercent;
        // } else {
        //     character.extendedDotFocusPercent = null;
        // }

        // let benExtFocusPct = /([0-9]*)\+([0-9]*)/gi.exec( character.extendedBeneficialFocusPercent?.toString() );
        // if ( benExtFocusPct?.length > 0 ) {
        //     character.extendedBeneficialFocusPercent = +benExtFocusPct[ 1 ] + +benExtFocusPct[ 2 ];
        // } else if ( character.extendedBeneficialFocusPercent ) {
        //     character.extendedBeneficialFocusPercent = +character.extendedBeneficialFocusPercent;
        // } else {
        //     character.extendedBeneficialFocusPercent = null;
        // }

        // let benHasteFocusPct = /([0-9]*)\+([0-9]*)/gi.exec( character.beneficialCastingSpeedFocusPercent?.toString() );
        // if ( benHasteFocusPct?.length > 0 ) {
        //     character.beneficialCastingSpeedFocusPercent = +benHasteFocusPct[ 1 ] + +benHasteFocusPct[ 2 ];
        // } else if ( character.beneficialCastingSpeedFocusPercent ) {
        //     character.beneficialCastingSpeedFocusPercent = +character.beneficialCastingSpeedFocusPercent;
        // } else {
        //     character.beneficialCastingSpeedFocusPercent = null;
        // }

        this.ipcService.updateCharacter( character ).subscribe( updated => {
            if ( updated ) {
                if ( this.snackBarTimeoutId != null ) {
                    this.savedLabel.nativeElement.style.display = 'none';
                    window.clearTimeout( this.snackBarTimeoutId );
                    this.snackBarTimeoutId = window.setTimeout( () => {
                        this.savedLabel.nativeElement.style.display = 'block';
                        this.snackBarTimeoutId = window.setTimeout( () => this.savedLabel.nativeElement.style.display = 'none', 5000 );
                    }, 250 );
                } else {
                    this.savedLabel.nativeElement.style.display = 'block';
                    this.snackBarTimeoutId = window.setTimeout( () => this.savedLabel.nativeElement.style.display = 'none', 5000 );
                }

                
            }
        } );
    }

    private calculateFocusPercent( value: string | number ): number {

        let exMatch = /([0-9]*)\+([0-9]*)/gi.exec( value?.toString() );
        let percent: number = null;
        
        if ( exMatch?.length > 0 ) {
            percent = +exMatch[ 1 ] + +exMatch[ 2 ];
        } else if ( value ) {
            percent = +value;
        }

        return isNaN( percent ) ? null : percent;
    }

    public deleteCharacter(character: CharacterModel): void {
        this.dialogService
            .showConfirmDialog(
                `Are you certain you would like to remove ${character.name} [${character.server}]?`, `Click 'Yes' to delete ${character.name}.`, `Click 'No' to keep your character.`,
                confirmed => {
                    if ( confirmed ) {
                        this.ipcService.deleteCharacter( character.characterId ).subscribe( deleted => {
                            if ( deleted ) {
                                
                                this.snackBar.open( 'Character deleted!', 'Dismiss', { duration: 2500 } );
                                this.loadCharacters();
                            }
                        } );
                    }
                } );
    }

    showFileSelector( characterId: string ) {
        this.fileSelector.nativeElement.click();
        this.fileSelector.nativeElement.setAttribute( 'character-id', characterId );
    }

    fileSelected( e: any ) {
        let characterId: string = this.fileSelector.nativeElement.getAttribute( 'character-id' );

        this.fileSelector.nativeElement.setAttribute( 'character-id', null );

        if ( this.fileSelector.nativeElement.files?.length > 0 ) {
            
            let index: number = _.findIndex( this.characters, f => f.characterId === characterId );
            this.characters[ index ].logFile = this.fileSelector.nativeElement.files[ 0 ].path;
            this.ipcService.updateCharacter( this.characters[ index ] ).subscribe( updated => {
                if ( updated ) {
                    this.snackBar.open( 'Character updated!', 'Dismiss', { duration: 2500 } );
                }
            } );

        }
    }

}
