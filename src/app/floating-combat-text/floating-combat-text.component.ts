import { Component, OnInit } from '@angular/core';
import { DialogService } from '../dialogs/dialog.service';
import { FctCombatGroup, HitStartPositionTypes, OverlayWindowModel, StylePropertiesModel } from '../core.model';
import { nagId } from '../core/nag-id.util';
import { IpcService } from '../ipc.service';
import { MatCheckboxChange } from '@angular/material/checkbox';

const animatePulsateDuration = 4000;
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
export class FloatingCombatTextComponent implements OnInit {

    public combatGroups: FctCombatGroup[] = [];
    private changes: Record<string, boolean> = {};
    private rollback: Record<string, string> = {};
    public overlays: OverlayWindowModel[] = [];
    public hitPositionTypes: typeof HitStartPositionTypes = HitStartPositionTypes;
    public hasFlag: ( value: number, flag: number ) => boolean = window.api.utils.numbers.hasFlag;
    public toggleFlag: ( value: number, flag: number ) => number = window.api.utils.numbers.toggleFlag;
    public removeFlag: ( value: number, flag: number ) => number = window.api.utils.numbers.removeFlag;
    public addFlag: ( value: number, flag: number ) => number = window.api.utils.numbers.addFlag;
    
    public get fctOverlays(): OverlayWindowModel[] {
        return this.overlays.filter( f => f.overlayType === 'FCT' );
    }

    constructor(
        private readonly dialogService: DialogService,
        private readonly ipcService: IpcService,
    ) { }

    ngOnInit() {
        this.addGroup( 'Default' );
        this.addGroup( 'Healing' );
        this.addGroup( 'Damage' );
        this.addGroup( 'Criticals' );

        this.ipcService.getOverlayWindows().subscribe( data => this.overlays = data );
        this.ipcService.tickReceived().subscribe( data => {
            
            this.overlays = data.overlays;

        } );
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
        this.rollback[ group.combatGroupId ] = JSON.stringify( group );
    }









    
    /**
     * Set the combat group with the given id as having been changed.
     * 
     * @param id The id of the combat group that has changed.
     */
    addChange( id: string ): void {
        this.changes[ id ] = true;
    }









    
    /**
     * Returns true if the combat group with the given id has been changed.
     * 
     * @param id The id of the combat group to check.
     */
    hasChanges( id: string ): boolean {
        return this.changes[ id ] === true || false;
    }









    
    /**
     * Rollback the changes made to the combat group with the given id.
     * 
     * @param id The id of the combat group to rollback.
     */
    rollbackChanges( id: string ): void {
        this.combatGroups[ this.combatGroups.findIndex( g => g.combatGroupId === id ) ] = Object.assign( new FctCombatGroup(), JSON.parse( this.rollback[ id ] ) );
        this.changes[ id ] = false;
    }









    
    /**
     * Saves changes made to the combat group with the given id and marks it as no longer changed.
     * 
     * @param id The id of the combat group to save.
     */
    saveChanges( id: string ): void {
        // this.ipcService.saveCombatGroup( this.combatGroups.find( g => g.combatGroupId === id ) );
        this.changes[ id ] = false;
        this.rollback[ id ] = JSON.stringify( this.combatGroups.find( g => g.combatGroupId === id ) );
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
     * Show a dialog to rename a combat group.
     * 
     * @param index The index of the combat group to rename.
     */
    changeCombatGroupName( index: number ): void {
        this.dialogService.showInputDialog(
            'Change combat group name',
            'Enter a new name for the combat group',
            null,
            null,
            this.combatGroups[ index ].name )
            .subscribe( name => {
                if ( name?.trim().length > 0 ) {
                    this.combatGroups[ index ].name = name;
                    this.addChange( this.combatGroups[ index ].combatGroupId );
                }
            } );
    }









    
    /**
     * Ask the user to confirm before deleting a combat group.
     * 
     * @param index The index of the combat group to delete.
     */
    deleteCombatGroup( index: number ): void {
        this.dialogService.showConfirmationDialog(
            'Are you sure you want to delete this combat group?',
            'Click "Yes" to delete this combat group.',
            'Click "No" to cancel and close this dialog without deleting this combat group.' )
            .subscribe( confirmed => {
                if ( confirmed ) {
                    this.combatGroups.splice( index, 1 );
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
                'If you set the threshold to 50% and the max hit is 1000, then any hit below 500 will be ignored.  This is generally better when you play more than one character.',
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
                'Threshold can be set as a percent of max hit or you can specifiy a specific threshold value.',
                'If you set the threshold to 50% and the max hit is 1000, then any hit below 500 will be added up until a hit of 500 or more is reached.  This is generally better when you play more than one character.',
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
        console.log( 'testing', e?.source.name, group.combatAnimations );
        if ( e?.source.name.includes( 'fountain' ) && group.combatAnimations.fountain ) {
            group.combatAnimations.scroll = false;
            group.combatAnimations.pulsate = false;
            console.log( 'fountain', group.combatAnimations );

        } else if ( e?.source.name.includes( 'scroll' ) && group.combatAnimations.scroll ) {
            group.combatAnimations.fountain = false;
            console.log( 'scroll', group.combatAnimations );
            
        } else if ( e?.source.name.includes( 'pulsate' ) && group.combatAnimations.pulsate ) {
            group.combatAnimations.fountain = false;
            console.log( 'pulsate', group.combatAnimations );
            
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

        let textA = subA?.querySelector( 'div.fct-text-layer' ) as HTMLElement;
        let textB = subB?.querySelector( 'div.fct-text-layer' ) as HTMLElement;

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

        let animation: string = '';
        let subAnimation: string = '';
        let textAnimation: string = '';
        let duration: number = 0;
        let animationDelay: number = 0;

        if ( group.combatAnimations.pulsate ) {
            animation += ( animation.length > 0 ? ', ' : '' ) + `${group.combatAnimations.fadeOut ? 'animate-pulsate-fadeout' : 'animate-pulsate'} ${animatePulsateDuration}ms ease-out`;
            duration = duration < animatePulsateDuration ? animatePulsateDuration : duration;
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

        if ( group.combatAnimations.fadeOut && !group.combatAnimations.pulsate ) {
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

                    }, 500 );

                }

            }, ( duration + animationDelay ) / 100 );

        }
    }










}
