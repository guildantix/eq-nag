import { Pipe, PipeTransform } from '@angular/core';

@Pipe( {
    name: 'className'
} )
export class ClassNamePipe implements PipeTransform {

    private classes: Record<string, string> = {
        'BRD': 'Bard',
        'BST': 'Beastlord',
        'BER': 'Berserker',
        'CLR': 'Cleric',
        'DRU': 'Druid',
        'ENC': 'Enchanter',
        'MAG': 'Magician',
        'MNK': 'Monk',
        'NEC': 'Necromancer',
        'PAL': 'Paladin',
        'RNG': 'Ranger',
        'ROG': 'Rogue',
        'SHD': 'Shadowknight',
        'SHM': 'Shaman',
        'WAR': 'Warrior',
        'WIZ': 'Wizard',
    };

    transform( value: string ): string {
        return this.classes[ value ];
    }
}