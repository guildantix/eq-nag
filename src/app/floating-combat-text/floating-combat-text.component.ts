import { Component, DoCheck, KeyValueChanges, KeyValueDiffer, KeyValueDiffers, OnInit } from '@angular/core';
import { DialogService } from '../dialogs/dialog.service';
import { FctCombatGroup, HitStartPositionTypes, OverlayWindowModel, QuickShareFctMetaModel, QuickShareFctModel, QuickShareFctTransferModel, StylePropertiesModel } from '../core.model';
import { nagId } from '../core/nag-id.util';
import { IpcService } from '../ipc.service';
import { MatCheckboxChange } from '@angular/material/checkbox';
import { QuestionDialogAnswerModel } from '../dialogs/question-dialog/question-dialog.model';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Observable } from 'rxjs';
import { ColoredString } from '../dialogs/dialog.model';
import { QuickShareService } from '../core/quick-share.service';

// TODO: FCT Features
// 1. Consolidation configuration settings: by time and by source.
// 2. Enable FCT by character.
// 3. Healing - incoming excludes overheal while outgoing shows overheal.

const animateBlowoutDuration = 4000;
const animateFadeOutDuration = 7000;
const animateFadeInDuration = 500;
const animateFloatDuration = 1000;
const animateGrowShrinkDuration = 500;

const combatMessageTypes: string[] = [
    'yourHits', // actor = you, no other modifiers
    'yourFlurry', // actor = you, flurry modifier
    'yourCrits', // actor = you, critical modifier
    'yourCripplingBlows', // actor = you, crippling modifier
    'youBeingHit', // target = you, no other modifiers
    
    'yourPetHits', // actor = your pet, no other modifiers // TODO: add pet assignment "/pet leader"
    'yourPetCrits', // actor = your pet, critical modifier
    'yourPetFlurry', // actor = your pet, flurry modifier
    'yourPetRampage', // actor = your pet, rampage modifier
    'yourPetBeingHit', // target = your pet, no other modifiers

    'tauntMessages', // undetermined // TODO: Find logs of taunt message to determine what we can do with this
    'yourCombatAbilitiesHits', // undetermined // TODO: Find logs of combat abilities to determine what we can do with this
    'yourCombatAbilitiesCrits', // undetermined // TODO: Find logs of combat abilities to determine what we can do with this
    
    'yourMeleeWarnings', // undetermined // TODO: Find logs of melee warnings to determine what we can do with this
    'combatAbilityReuse', // undetermined // TODO: Find logs of combat ability reuse to determine what we can do with this

    'yourSpellHits', // actor = you, no other modifiers
    'yourSpellCrits', // actor = you, critical modifier
    'yourSpellResists', // actor = you, target = other, resist modifier
    'yourSpellImmunes', // actor = you, target = other, immune modifier
    'yourSpellInterrupts', // actor = you, interrupt modifier
    'yourDoTHits', // actor = you, DoT modifier
    'yourDoTCrits', // actor = you, DoT modifier, critical modifier
    'yourHeals', // actor = you, target = other, no other modifiers
    'yourCritHeals', // actor = you, target = other, critical modifier
    'youBeingHealed', // target = you, no other modifiers
    'youBeingCritHealed', // target = you, critical modifier
    'yourOvertimeHeals', // actor = you, target = other, no other modifiers
    'yourOvertimeCritHeals', // actor = you, target = other, critical modifier
    'youBeingOvertimeHealed', // target = you, no other modifiers
    'youBeingOvertimeCritHealed', // target = you, critical modifier
    'yourDamageShieldHits', // actor = you, target = other, no other modifiers
    'youBeingHitByDamageShield', // target = you, no other modifiers
    'youBeingHitByEnvironmentalDamage', // target = you, no other modifiers
];

@Component( {
    selector: 'app-floating-combat-text',
    templateUrl: 'floating-combat-text.component.html',
    styleUrls: [ 'floating-combat-text.component.scss', '../core.scss' ],
} )
export class FloatingCombatTextComponent implements OnInit, DoCheck {

    public combatGroups: FctCombatGroup[] = [];
    private changes: Record<string, boolean> = {};
    private changeTracking: Record<string, string> = {};
    public overlays: OverlayWindowModel[] = [];
    public hitPositionTypes: typeof HitStartPositionTypes = HitStartPositionTypes;
    public hasFlag: ( value: number, flag: number ) => boolean = window.api.utils.numbers.hasFlag;
    public toggleFlag: ( value: number, flag: number ) => number = window.api.utils.numbers.toggleFlag;
    public removeFlag: ( value: number, flag: number ) => number = window.api.utils.numbers.removeFlag;
    public addFlag: ( value: number, flag: number ) => number = window.api.utils.numbers.addFlag;
    public isDev: boolean = false;
    public selectedPanelIndex: number = 0;
    public enableFct: boolean = false;
    
    public get fctOverlays(): OverlayWindowModel[] {
        return this.overlays.filter( f => f.overlayType === 'FCT' );
    }

    constructor(
        private readonly dialogService: DialogService,
        private readonly ipcService: IpcService,
        private readonly snackBar: MatSnackBar,
        private readonly differs: KeyValueDiffers,
        private readonly quickShareService: QuickShareService,
    ) { }

    ngOnInit() {

        this.ipcService.getAppIsDev().subscribe( isDev => this.isDev = isDev );
        this.ipcService.getFctCombatGroups().subscribe( data => {
            this.combatGroups = data;
            this.combatGroups.forEach( ( group, i ) => this.changeTracking[ group.combatGroupId ] = FctCombatGroup.getHashValue( group ) );
        } );
        this.ipcService.getOverlayWindows().subscribe( data => this.overlays = data );
        this.ipcService.tickReceived().subscribe( data => {
            
            this.overlays = data.overlays;

        } );

        this.ipcService.tickReceived().subscribe( data => {
            
            this.overlays = data.overlays;
            this.enableFct = data.enableFct;
            
        } );

        this.ipcService.onAskCombatGroupMigration().subscribe( canMigrate => {
            let statements: string[] = [];
            let questions: QuestionDialogAnswerModel[] = [];

            statements = ['Floating combat text is disabled by default.', 'To enable FCT, we need to create some new combat groups.'];

            if ( canMigrate ) {
                
                questions.push( {
                    question: [ 'You have existing styles in the older format, would you like to migrate those styles?' ],
                    buttonText: 'Migrate existing styles',
                    action: () => {
                        this.ipcService.migrateFctCombatGroups().subscribe( success => {
                            this.ipcService.getFctCombatGroups().subscribe( data => {
                                console.log( 'data', data );
                                this.combatGroups = data;
                            } );
                        } );
                    },
                    cssClass: 'color-green',
                } );

            }

            questions.push( {
                question: [ 'You could have the system initialize FCT with default combat groups.' ],
                buttonText: 'Create default combat groups',
                action: () => {
                    this.ipcService.initializeFctCombatGroups().subscribe( success => {
                        this.ipcService.getFctCombatGroups().subscribe( data => {
                            console.log( 'data', data );
                            this.combatGroups = data;
                        } );
                    } );
                },
                cssClass: canMigrate ? 'color-white' : 'color-green',
            } );

            questions.push( {
                question: [ 'Do nothing and create your own combat groups from scratch.' ],
                buttonText: 'Do nothing and stop asking',
                action: () => {
                    this.ipcService.updateSetting<boolean>( 'askForCombatGroupMigrations', false );
                },
                cssClass: 'color-orange',
            } );

            this.dialogService.showQuestionDialog( `Floating Combat Text ${canMigrate ? 'Migration' : 'Initialization'}`, statements, questions, true, 'wide' );

        } );
    }

    ngDoCheck() {
        this.combatGroups.forEach( group => {
            this.changes[ group.combatGroupId ] = this.changeTracking[ group.combatGroupId ] !== FctCombatGroup.getHashValue( group );
        } );
    }

    onEnableFctChange(): void {
        this.ipcService.updateEnableFct( this.enableFct );
    }

    createQuickShare(): void {
        let model = new QuickShareFctModel();
        model.fctGroups = this.combatGroups.slice();
        model.overlays = this.overlays.filter( x => model.fctGroups.findIndex( y => y.overlayId === x.overlayId ) > -1 );
        model.primaryDisplaySize = window.api.utils.screens.primaryDisplaySize();

        let transfer = new QuickShareFctTransferModel();
        transfer.model = model;
        transfer.notes = '';

        this.ipcService.getAuthor().subscribe( author => {
            this.quickShareService.createQuickShareFct( author.authorId, model, '' ).subscribe( quickShareId => {
                let quickShareCode = `{NAG:fct/${quickShareId}}`;
                this.ipcService.sendTextToClipboard( quickShareCode );
                this.snackBar.open( 'Quick share code copied to clipboard', 'Dismiss', { duration: 3000 } );
            } );
        })
    }

    /**
     * Opens the quick share dialog and allows the user to enter in a quick share code for FCT.
     */
    installQuickShare(): void {
        this.dialogService
            .showInputDialog(
                'Install Quick Share',
                [ 'To install shared combat groups, paste the code below' ],
                'Quick share code',
                'Paste in the quick share code',
                null,
                false )
            .subscribe( response => {
                if ( response ) {
                    let handled = false;

                    // {NAG:fct/a3fASS34127BGggsr1}
                    let pkg = /{NAG:fct\/(?<packageId>.+?)}/g.exec( response );
                    if ( pkg?.groups?.packageId ) {
                        this.installFctPackage( pkg.groups.packageId );
                        handled = true;
                    }

                    if ( !handled ) {
                        this.dialogService.showErrorDialog( 'Error', [ 'Could not parse code, no packages installed!' ] );
                    }

                }
            } );
    }

    /**
     * Installs the specified combat group package.
     * 
     * @param packageId The id of the FCT combat groups package.
     */
    installFctPackage( packageId: string ): void {
        this.quickShareService.getQuickShareFct( packageId ).subscribe( data => {
            if ( data.length > 0 ) {
                const quickShare = data[ 0 ];
                // Copy all overlays.
                this.ipcService.installOverlays( quickShare.model.overlays, quickShare.model.primaryDisplaySize ).subscribe( overlays => {

                    // Update the overlays list.
                    this.overlays = overlays;

                    // Install all combat groups.
                    this.ipcService.installCombatGroups( quickShare.model.fctGroups ).subscribe( combatGroups => {
                        this.combatGroups = combatGroups;
                        this.combatGroups.forEach( ( group, i ) => this.changeTracking[ group.combatGroupId ] = FctCombatGroup.getHashValue( group ) );
                    } );

                } );
            }
        } );
    }










    /**
     * Serializes the given combat group to JSON and copies it to the clipboard.
     * 
     * @param group The combat group to serialize.
     */
    copyJson( group: FctCombatGroup ): void {
        // We'll need to clear out some data before we copy it, so let's make sure we don't mess with the original.
        let copy: FctCombatGroup = Object.assign( new FctCombatGroup(), JSON.parse( JSON.stringify( group ) ) );
        
        copy._editorTabIndex = -1;
        copy.combatGroupId = null;
        copy.overlayId = null;
        copy.editStylesType = 'value';
                            
        copy._animationCompletePercent = 0;
        copy._animationComplete = true;
        copy._animationIntervalId = undefined;
        copy._animationResetTimeoutId = undefined;

        this.ipcService.sendTextToClipboard( JSON.stringify( copy ) );
        this.snackBar.open( 'Copied to clipboard', 'Dismiss', { duration: 3000 } );
    }









    
    /**
     * Add a new combat group to the list of combat groups.
     * 
     * @param name The name of the new combat group.
     */
    addGroup( name: string ): void {
        let group = Object.assign( new FctCombatGroup(), {
            name: name,
            combatGroupId: nagId(),
        } );

        group.valueStyles.fontWeight = 700;
        group.valueStyles.fontSize = 34;
        group.valueStyles.paddingTop = 3;
        group.valueStyles.glowSize = 3;
        group.startingPosition = HitStartPositionTypes.left | HitStartPositionTypes.bottom;

        group.sourceStyles.fontColor = '#1976d2';
        group.sourceStyles.paddingLeft = 8;

        this.combatGroups.push( group );
        this.changes[ group.combatGroupId ] = false;
        this.changeTracking[ group.combatGroupId ] = FctCombatGroup.getHashValue( group );
    }









    
    /**
     * Returns true if the combat group with the given id has been changed.
     * 
     * @param id The id of the combat group to check.
     */
    hasChanges( id: string ): boolean {
        return this.changes[ id ] === true;
    }








    
    /**
     * Rollback the changes made to the combat group with the given id.
     * 
     * @param id The id of the combat group to rollback.
     */
    rollbackChanges( id: string ): void {
        let i = this.combatGroups.findIndex( g => g.combatGroupId === id );
        this.ipcService.getFctCombatGroup( id ).subscribe( data => {
            window.setTimeout( () => {
                this.combatGroups[ i ] = data;
                this.changes[ id ] = false;
                this.changeTracking[ id ] = FctCombatGroup.getHashValue( data );
            } );
        } );
    }










    /**
     * Update the position of the given group in the list of combat groups.
     * 
     * @description This method will immediately save the changes made.
     * 
     * @param group The whose position is changing.
     * @param direction The direction the group is moving.
     * @param e The click event args.
     */
    updatePosition( group: FctCombatGroup, direction: -1 | 1, e: MouseEvent | undefined = undefined ): void {
        console.log( 'e', e );
        if ( e ) {
            e.preventDefault();
            e.stopPropagation();
        }
    
        let i = this.combatGroups.findIndex( g => g.combatGroupId === group.combatGroupId );
        let newIndex = i + direction;
    
        if ( newIndex >= 0 && newIndex < this.combatGroups.length ) {
            this.selectedPanelIndex = -1;
            let temp = this.combatGroups[ newIndex ];
            this.combatGroups[ newIndex ] = group;
            this.combatGroups[ i ] = temp;
            this.saveChanges( group ).subscribe( () => {
                this.snackBar.open( 'Combat group order updated', 'Dismiss', { duration: 3000 } );
            } );
        }

    }









    
    /**
     * Saves changes made to the combat group with the given id and marks it as no longer changed.
     * 
     * @param id The id of the combat group to save.
     * @param e The click event args.
     */
    saveChanges( combatGroup: FctCombatGroup, e: MouseEvent | undefined = undefined ): Observable<string> {
        
        if ( e ) {
            e.preventDefault();
            e.stopPropagation();
        }

        let obs = this.ipcService.updateFctCombatGroup( combatGroup, this.combatGroups.map( f => f.combatGroupId ) );
        obs.subscribe( groupId => {
            if ( groupId !== combatGroup.combatGroupId ) {
                let i = this.combatGroups.findIndex( g => g.combatGroupId === combatGroup.combatGroupId );
                this.combatGroups[ i ].combatGroupId = groupId;
                this.changeTracking[ groupId ] = FctCombatGroup.getHashValue( this.combatGroups[ i ] );
                this.changes[ groupId ] = false;
            } else {
                this.changes[ combatGroup.combatGroupId ] = false;
                this.changeTracking[ combatGroup.combatGroupId ] = FctCombatGroup.getHashValue( combatGroup );
            }
        } );

        return obs;
    }









    
    /**
     * Show a dialog to create a new combat group, allowing the user to enter a 
     * name for the new group.
     */
    newCombatGroup(): void {
        this.dialogService.showInputDialog(
            'Create new combat group',
            'Enter a name for the new combat group' )
            .subscribe( name => {
                if ( name?.trim().length > 0 ) {
                    this.addGroup( name );
                }
            } );
    }









    
    /**
     * Show a dialog to create a new combat group, allowing the user to enter a 
     * name for the new group.
     * 
     * @param group The group to copy.
     * @param e The click event args.
     */
    copyCombatGroup( group: FctCombatGroup, e: MouseEvent | undefined = undefined ): void {
        
        if ( e ) {
            e.preventDefault();
            e.stopPropagation();
        }

        this.dialogService.showInputDialog(
            'Create new combat group',
            'Enter a name for the new combat group', null, null, group.name + ' (copy)' )
            .subscribe( name => {
                if ( name?.trim().length > 0 ) {
                    let sourceIndex = this.combatGroups.findIndex( g => g.combatGroupId === group.combatGroupId );
                    let copy = FctCombatGroup.hydrateModel( JSON.parse( JSON.stringify( group ) ) );

                    copy.name = name;
                    copy.combatGroupId = nagId();

                    if ( sourceIndex > -1 ) {
                        this.combatGroups.splice( sourceIndex + 1, 0, copy );
                    } else {
                        this.combatGroups.push( copy );
                    }

                    this.saveChanges( copy );
                }
            } );
    }









    
    /**
     * Show a dialog to rename a combat group.
     * 
     * @param index The index of the combat group to rename.
     * @param e The click event args.
     */
    changeCombatGroupName( index: number, e: MouseEvent | undefined = undefined ): void {
        
        if ( e ) {
            e.preventDefault();
            e.stopPropagation();
        }

        this.dialogService.showInputDialog(
            'Change combat group name',
            'Enter a new name for the combat group',
            null,
            null,
            this.combatGroups[ index ].name )
            .subscribe( name => {
                if ( name?.trim().length > 0 ) {
                    this.combatGroups[ index ].name = name;
                }
            } );
    }









    
    /**
     * Ask the user to confirm before deleting a combat group.
     * 
     * @param index The index of the combat group to delete.
     * @param combatGroupId The id of the combat group to delete.
     * @param e The click event args.
     */
    deleteCombatGroup( index: number, combatGroupId: string, e: MouseEvent | undefined = undefined ): void {

        if ( e ) {
            e.preventDefault();
            e.stopPropagation();
        }

        this.dialogService.showConfirmationDialog(
            `Are you sure you want to delete "${this.combatGroups[index]?.name ?? 'this combat group'}"?`,
            'Click "Yes" to delete this combat group.',
            'Click "No" to cancel and close this dialog without deleting this combat group.' )
            .subscribe( confirmed => {
                if ( confirmed ) {
                    this.ipcService.deleteFctCombatGroup( combatGroupId ).subscribe( success => {
                        if ( success ) {
                            this.combatGroups.splice( index, 1 );
                        }
                    } );
                }
            } );
    }









    
    /**
     * When the user enables accumlation, ignore hits must be disabled.
     * 
     * @param group The group that has changed.
     */
    public onAccumulateHitsChange( group: FctCombatGroup ): void {
        if ( group.accumulateHits && group.ignoreHits ) {
            group.ignoreHits = false;
        }
    }









    
    /**
     * When the user enables ignore hits, accumulation must be disabled.
     * 
     * @param group The group that has changed.
     */
    public onIgnoreHitsChange( group: FctCombatGroup ): void {
        if ( group.accumulateHits && group.ignoreHits ) {
            group.accumulateHits = false;
        }
    }









    
    /**
     * Displays the threshold description.
     */
    public displayIgnoreThresholdDescription() {
        this.dialogService.showInfoDialog(
            'Threshold',
            [
                'Threshold can be set as a percent of max hit or you can specifiy a specific threshold value.',
                new ColoredString('If your median hit is **500**, then the max hit will be ~~1000~~. If you set the threshold to ~~80%~~, any hit below ~~**800**~~ will be ignored. This is generally better when you play more than one character.', 'white'),
                'Alternatively, you can set a specific threshold value. If you set the threshold to 500, then any hit below 500 will be ignored.'
            ],
            'normal' );
    }









    
    /**
     * Displays the threshold description.
     */
    public displayConsolidationThresholdDescription() {
        this.dialogService.showInfoDialog(
            'Threshold',
            [
                'Threshold can be set as a percent of max median hit or you can specifiy a specific threshold value.',
                new ColoredString('If your median hit is **500**, then the max hit will be ~~1000~~. If you set the threshold to ~~80%~~, any hit below ~~**800**~~ will be added up until a hit of 800 or more is reached. This is generally better when you play more than one character.', 'white'),
                'Alternatively, you can set a specific threshold value. If you set the threshold to 500, then any hit below 500 will be added up until a hit of 500 or more is reached.'
            ],
            'normal' );
    }









    
    /**
     * Apply the given styles to the given element.
     * 
     * @param el The element to apply the styles to.
     * @param style The styles to apply.
     */
    public applyFctStyles( el: HTMLElement, style: StylePropertiesModel ): void {
        StylePropertiesModel.applyStyles( el, style );
    }









    
    /**
     * Toggle the given flag on the given combat group's starting position.  
     * Ensures the user cannot choose both top and bottom, left and right, or 
     * random and any other position.  Additionally executes the animation 
     * preview.
     * 
     * @param group The combat group that has changed.
     * @param flag The flag that has changed.
     * @param divA The first div that will be used to demonstrate the animation.
     * @param divB The second div that will be used to demonstrate the animation.
     * @param e The event that triggered the change.
     */
    public toggleStartingPositionFlag( group: FctCombatGroup, flag: HitStartPositionTypes, divA: HTMLDivElement, divB: HTMLDivElement, e: MatCheckboxChange | undefined = undefined  ): void {
        
        if ( flag === HitStartPositionTypes.bottom && !this.hasFlag( group.startingPosition, HitStartPositionTypes.bottom ) ) {
            // If we're adding the bottom flag, remove the top and random flag
            group.startingPosition = this.removeFlag( group.startingPosition, HitStartPositionTypes.top );
            group.startingPosition = this.removeFlag( group.startingPosition, HitStartPositionTypes.random );

        } else if ( flag === HitStartPositionTypes.top && !this.hasFlag( group.startingPosition, HitStartPositionTypes.top ) ) {
            // If we're adding the top flag, remove the bottom and random flag
            group.startingPosition = this.removeFlag( group.startingPosition, HitStartPositionTypes.bottom );
            group.startingPosition = this.removeFlag( group.startingPosition, HitStartPositionTypes.random );

        } else if ( flag === HitStartPositionTypes.left && !this.hasFlag( group.startingPosition, HitStartPositionTypes.left ) ) {
            // If we're adding the left flag, remove the right and random flag
            group.startingPosition = this.removeFlag( group.startingPosition, HitStartPositionTypes.right );
            group.startingPosition = this.removeFlag( group.startingPosition, HitStartPositionTypes.random );

        } else if ( flag === HitStartPositionTypes.right && !this.hasFlag( group.startingPosition, HitStartPositionTypes.right ) ) {
            // If we're adding the right flag, remove the left and random flag
            group.startingPosition = this.removeFlag( group.startingPosition, HitStartPositionTypes.left );
            group.startingPosition = this.removeFlag( group.startingPosition, HitStartPositionTypes.random );

        } else if ( flag === HitStartPositionTypes.random && !this.hasFlag( group.startingPosition, HitStartPositionTypes.random ) ) {
            // If we're adding the random flag, remove all other position flags
            group.startingPosition = this.removeFlag( group.startingPosition, HitStartPositionTypes.top );
            group.startingPosition = this.removeFlag( group.startingPosition, HitStartPositionTypes.bottom );
            group.startingPosition = this.removeFlag( group.startingPosition, HitStartPositionTypes.left );
            group.startingPosition = this.removeFlag( group.startingPosition, HitStartPositionTypes.right );

            // Additionally, remove the scroll animation.
            group.combatAnimations.scroll = false;

        }

        group.startingPosition = this.toggleFlag( group.startingPosition, flag );

        if ( !this.hasFlag( group.startingPosition, HitStartPositionTypes.random ) && !this.hasFlag( group.startingPosition, HitStartPositionTypes.left ) && !this.hasFlag( group.startingPosition, HitStartPositionTypes.right ) ) {
            group.startingPosition = this.toggleFlag( group.startingPosition, HitStartPositionTypes.left );
        }

        if ( !this.hasFlag( group.startingPosition, HitStartPositionTypes.random ) && !this.hasFlag( group.startingPosition, HitStartPositionTypes.top ) && !this.hasFlag( group.startingPosition, HitStartPositionTypes.bottom ) ) {
            group.startingPosition = this.toggleFlag( group.startingPosition, HitStartPositionTypes.bottom );
        }

        this.applyGroupAnimations( group, divA, divB );
    }









    
    /**
     * Returns the ngClass object for the given flag.
     * 
     * @param startPosition The flag starting position.
     */
    public getGroupPositionNgClass( startPosition: number ): any {
        return {
            'fct-left': this.hasFlag( startPosition, HitStartPositionTypes.left ),
            'fct-right': this.hasFlag( startPosition, HitStartPositionTypes.right ),
            'fct-top': this.hasFlag( startPosition, HitStartPositionTypes.top ),
            'fct-bottom': this.hasFlag( startPosition, HitStartPositionTypes.bottom ),
            'fct-random': this.hasFlag( startPosition, HitStartPositionTypes.random )
        };
    }









    
    /**
     * Executes the animation preview for the given combat group.  Additionally, 
     * ensures specific animations cannot be mixed together.
     * 
     * @param group The combat group that to apply the animations to.
     * @param divA The first div that will be used to demonstrate the animation.
     * @param divB The second div that will be used to demonstrate the animation.
     * @param e The event that triggered the change.
     */
    public applyGroupAnimations( group: FctCombatGroup, divA: HTMLDivElement, divB: HTMLDivElement, e: MatCheckboxChange | undefined = undefined ): void {
        
        // NOTE: Applying combat animations on the renderer will be simpler
        // than this. This is an animation preview, so values need to be reset 
        // after the animation is complete, and that can have a variable 
        // duration.
        if ( e?.source.name.includes( 'fountain' ) && group.combatAnimations.fountain ) {
            group.combatAnimations.scroll = false;
            group.combatAnimations.blowout = false;

        } else if ( e?.source.name.includes( 'scroll' ) && group.combatAnimations.scroll ) {
            group.combatAnimations.fountain = false;
            
        } else if ( e?.source.name.includes( 'blowout' ) && group.combatAnimations.blowout ) {
            group.combatAnimations.fountain = false;
            
        }
        
        if ( group._animationIntervalId > 0 ) {
            window.clearInterval( group._animationIntervalId );
            group._animationIntervalId = undefined;
        }

        if ( group._animationResetTimeoutId > 0 ) {
            window.clearTimeout( group._animationResetTimeoutId );
            group._animationResetTimeoutId = undefined;
        }
        
        group._animationCompletePercent = 0;
        
        let subA = divA.querySelector( 'div.fct-sub-animation' ) as HTMLElement;
        let subB = divB.querySelector( 'div.fct-sub-animation' ) as HTMLElement;
    
        let textA = subA?.querySelector( 'div.fct-text-layer' ) as HTMLElement;
        let textB = subB?.querySelector( 'div.fct-text-layer' ) as HTMLElement;

        const clearAnimations = () => {

            divA.style.animation = null;
            divB.style.animation = null;
    
            divA.style.opacity = null;
            divB.style.opacity = null;
    
            if ( subA ) {
                subA.style.animation = null;
                subA.style.opacity = null;
            }
            if ( subB ) {
                subB.style.animation = null;
                subB.style.opacity = null;
            }
    
            if ( textA ) {
                textA.style.animation = null;
                textA.style.opacity = null;
                textA.style.transform = null;
            }
            if ( textB ) {
                textB.style.animation = null;
                textB.style.opacity = null;
                textB.style.transform = null;
            }

        };

        clearAnimations();

        let animation: string = '';
        let subAnimation: string = '';
        let textAnimation: string = '';
        let duration: number = 0;
        let animationDelay: number = 0;

        if ( group.combatAnimations.blowout ) {
            animation += ( animation.length > 0 ? ', ' : '' ) + `${group.combatAnimations.fadeOut ? 'animate-blowout-fadeout' : 'animate-blowout'} ${animateBlowoutDuration}ms ease-out`;
            duration = duration < animateBlowoutDuration ? animateBlowoutDuration : duration;
        }

        if ( group.combatAnimations.fountain ) {

            divA.classList.add( 'animation-absolute' );
            divB.classList.add( 'animation-absolute' );

            let durationVariance: number = animateFloatDuration * 0.25;
            let durationVarianceRange: number = durationVariance / 2;

            [ divA, divB ].forEach( div => {
                
                // Give the animation a random duration, within a variance constraint.
                let r: number = ( Math.random() * durationVariance ) - durationVarianceRange;
                let d = animateFloatDuration + r;
                div.style.setProperty( '--animation-duration', d + 'ms' );

                duration = duration < d ? d : duration;
                
                // Give the animation a random y direction.
                r = 150 - ( Math.random() * 50 ); // 100 - 150
                let n = group.startingPosition & HitStartPositionTypes.top ? 1 : -1; // We use n to determine if the direction is up or down.
                div.style.setProperty( '--random-y', ( n * r ) + 'px' ); // r must be negative to float in the upward direction.
                div.style.setProperty( '--y-direction', ( n * 40 * -1 ) + 'px' ); // y direction creates the downward/opposite motion at the apex of the curve.
                
                // Give the animation a random x direction.
                n = Math.random() - 0.5 >= 0 ? 1 : -1; // We use n to determine if the direction is left or right.
                r = ( 100 - ( Math.random() * 50 ) ) * n; // ( n ) * ( 100 - 150 ), n = 1 or -1
                div.style.setProperty( '--random-x', r + 'px' );
            } );

            animation += ( animation.length > 0 ? ', ' : '' ) + `animate-fountain-floatup var(--animation-duration)`;
            subAnimation += ( subAnimation.length > 0 ? ', ' : '' ) + `animate-fountain-horizontal var(--animation-duration)`;
            
        } else if ( group.combatAnimations.scroll ) {
            
            divA.style.display = 'none';
            divB.style.display = 'none';

            window.setTimeout( () => {
                divA.style.display = 'block';
            }, 100 );
            window.setTimeout( () => {
                divB.style.display = 'block';
            }, 1500 );

            if ( group.combatAnimations.fadeOut ) {
                window.setTimeout( () => {
                    divA.style.opacity = '0';
                    divB.style.opacity = '0';
                }, animateFadeOutDuration );
            }

            animationDelay = 1500;
        }

        // The last two animations applied must be fade out then fade in.  Fade
        // out's duration should match the longest animation, or set it's own 
        // duration.  If apply fade in first, it's duration is faster than fade 
        // out. 
        // NOTE: This may need to become more complicated as animations are added.

        if ( group.combatAnimations.fadeOut && !group.combatAnimations.blowout ) {
            // The fadeout duration is the duration of the longest animation, or a default preconfigured duration.
            let fadeOutDuration: number = duration > 0 ? duration : animateFadeOutDuration;
            let timingFn: string = fadeOutDuration === animateFadeOutDuration ? 'ease-out' : 'ease-in';

            animation += ( animation.length > 0 ? ', ' : '' ) + `animate-fadeout ${fadeOutDuration}ms ${timingFn}`;
            duration = fadeOutDuration === animateFadeOutDuration ? animateFadeOutDuration : duration;
            console.log( 'fadeOutDuration', fadeOutDuration, timingFn );
        }

        if ( group.combatAnimations.fadeIn ) {
            animation += ( animation.length > 0 ? ', ' : '' ) + `animate-fadein ${animateFadeInDuration}ms ease-out`;
            duration = duration < animateFadeInDuration ? animateFadeInDuration : duration;
        }

        // The grow/shrink animations do not alter the duration of the total animation, so we can apply them last.
        if ( group.combatAnimations.shrink ) {
            if ( group.combatAnimations.fountain ) {
                let animationDuration = animateGrowShrinkDuration < duration ? duration : animateGrowShrinkDuration;
                textAnimation += ( textAnimation.length > 0 ? ', ' : '' ) + `animate-shrink ${animationDuration}ms ease-in`;
            } else {
                let animationDelay = duration - animateGrowShrinkDuration;
                animationDelay = animationDelay < 0 ? 0 : animationDelay;
                textAnimation += ( textAnimation.length > 0 ? ', ' : '' ) + `animate-shrink ${animateGrowShrinkDuration}ms ease-out ${animationDelay}ms`;
            }
        }

        if ( group.combatAnimations.grow ) {
            let animationDuration = animateGrowShrinkDuration;
            if ( group.combatAnimations.fountain ) {
                animationDuration = animateGrowShrinkDuration < duration ? duration : animateGrowShrinkDuration;
            } else {
                animationDuration = animateGrowShrinkDuration > duration ? duration : animateGrowShrinkDuration;
            }
            
            textAnimation += ( textAnimation.length > 0 ? ', ' : '' ) + `animate-grow ${animationDuration}ms ease-out`;
        }

        console.log( 'animation', animation, duration );

        if ( animation.length === 0 && subAnimation.length === 0 && textAnimation.length === 0 ) {
        } else {

            window.setTimeout( () => {

                [ divA, divB ].forEach( div => {
                    div.style.animation = animation;
                } );

                if ( subAnimation ) {

                    [ subA, subB ].forEach( div => {
                        div.style.animation = subAnimation;
                    } );

                }

                if ( textAnimation ) {
                        
                    [ textA, textB ].forEach( div => {
                        div.style.animation = textAnimation;
                    } );

                }
            } );

            group._animationIntervalId = window.setInterval( () => {

                group._animationCompletePercent += 1;
                group._animationComplete = group._animationCompletePercent >= 100;

                if ( group._animationComplete ) {

                    window.clearInterval( group._animationIntervalId );
                    group._animationIntervalId = undefined;

                    group._animationResetTimeoutId = window.setTimeout( () => {
                        group._animationResetTimeoutId = undefined;
                        group._animationCompletePercent = 0;

                        // Let's reset any styles that were applied.
                        divA.classList.remove( 'animation-absolute' );
                        divB.classList.remove( 'animation-absolute' );
                        divA.style.opacity = '1';
                        divB.style.opacity = '1';

                        clearAnimations();

                    }, 500 );

                }

            }, ( duration + animationDelay ) / 100 );

        }
    }










}
