import { Component, OnInit } from '@angular/core';
import { DialogService } from '../dialogs/dialog.service';
import { FctCombatGroup, OverlayWindowModel, StylePropertiesModel } from '../core.model';
import { nagId } from '../core/nag-id.util';
import { IpcService } from '../ipc.service';

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

}
