// The Trials (docs/constructed.md §6): fourteen authored teams, one a type, each that type's six.
// Pilot set — Fire, Water, Iron — to fix the authoring rules before the other eleven.
// A slot is the same TeamSlot the player builds with; test/constructed pins every one legal.

import type { ConstructedContent, TrialDefinition } from '../run/constructed';
import { classes } from './classes';
import { equipment } from './equipment';
import { heroes } from './heroes';
import { progressionTable } from './progression';

export const constructedContent: ConstructedContent = { heroes, table: progressionTable, equipment, classes };

export const trials: Record<string, TrialDefinition> = {
  fire: {
    id: 'fire',
    type: 'Fire',
    name: 'The Kindling',
    line: 'Everything here was lit before you arrived.',
    gameplan: 'Burn both foes from the first round, then cash every Burn in — Crimson feeds on the ticks, Immolate and Flashover spend them.',
    cover: 'Tinder, Cinder and Drake carry Storm into Water; Brimstone’s Nature hits Water and Stone alike; Cinder’s Rend Armor is Iron into Stone.',
    leads: ['brimstone', 'tinder'],
    team: {
      name: 'The Kindling',
      slots: [
        {
          heroId: 'brimstone',
          pathId: 'brimstone-hexfume',
          moveIds: ['hearthfire', 'forceOfNature', 'sparkFlash', 'enfeeble'],
          itemIds: ['staff.mythic.blazing', 'orb.mythic', 'tome.mythic'],
          classId: 'warlock',
        },
        {
          heroId: 'tinder',
          pathId: 'tinder-sparkler',
          moveIds: ['grandFinale', 'chainLightning', 'spreadingBlaze', 'flareUp'],
          itemIds: ['staff.mythic.blazing', 'wand.mythic', 'ring.mythic'],
          classId: 'hexer',
        },
        {
          heroId: 'crimson',
          pathId: 'crimson-pyroclasm',
          moveIds: ['flashover', 'immolate', 'inferno', 'setAlight'],
          itemIds: ['staff.mythic.blazing', 'tome.mythic', 'orb.mythic'],
          classId: 'sorcerer',
        },
        {
          heroId: 'cinderKnight',
          pathId: 'cinderKnight-thunderblaze',
          moveIds: ['hammerbrand', 'stormLash', 'setAlight', 'rendArmor'],
          itemIds: ['sword.mythic.blazing', 'greataxe.mythic', 'plate.mythic'],
          classId: 'berserker',
        },
        {
          heroId: 'drake',
          pathId: 'drake-wyvern',
          moveIds: ['wyrmfire', 'shockSlice', 'firebrand', 'kindle'],
          itemIds: ['sword.mythic.blazing', 'dagger.mythic', 'boots.mythic'],
          classId: 'duelist',
        },
        {
          heroId: 'ashwing',
          pathId: 'ashwing-sunbird',
          moveIds: ['risingPyre', 'consecrate', 'mend', 'divineGrace'],
          itemIds: ['tome.mythic', 'robe.mythic', 'crest.mythic'],
          classId: 'cleric',
        },
      ],
    },
  },

  water: {
    id: 'water',
    type: 'Water',
    name: 'The Long Tide',
    line: 'It mends faster than you can hurt it, and every mend sharpens the claw.',
    gameplan: 'Outlast: Selkie keeps Renew on the line and every tick of it gives Kappa Attack, Pincer and Riptide hold the Shields, and Leviathan floods Water Force into the kill.',
    cover: 'Kappa’s Heavy Blow is Iron into Frost and its Rock Toss Stone into Storm; Leviathan’s Avalanche is Frost and Nautilus’s Umbral Beam Shadow into Nature; Leviathan’s Magic Bolt is Arcane into Storm.',
    leads: ['selkie', 'kappa'],
    team: {
      name: 'The Long Tide',
      slots: [
        {
          heroId: 'selkie',
          pathId: 'selkie-tidewife',
          moveIds: ['sealskinCloak', 'highTide', 'wildBloom', 'refresh'],
          itemIds: ['robe.mythic', 'tome.mythic', 'ring.mythic'],
          classId: 'herald',
        },
        {
          heroId: 'kappa',
          pathId: 'kappa-deepPool',
          moveIds: ['pullUnder', 'waveShred', 'heavyBlow', 'rockToss'],
          itemIds: ['sword.mythic.tidal', 'greataxe.mythic', 'plate.mythic'],
          classId: 'berserker',
        },
        {
          heroId: 'leviathan',
          pathId: 'leviathan-deepfrost',
          moveIds: ['deepsurge', 'maelstrom', 'avalanche', 'magicBolt'],
          itemIds: ['staff.mythic.tidal', 'orb.mythic', 'wand.mythic'],
          classId: 'warlock',
        },
        {
          heroId: 'pincer',
          pathId: 'pincer-ironshell',
          moveIds: ['vise', 'tideGuard', 'heavyBlow', 'juggernaut'],
          itemIds: ['shield.mythic', 'plate.mythic', 'guardianPlate'],
          classId: 'guardian',
        },
        {
          heroId: 'nautilus',
          pathId: 'nautilus-mimic',
          moveIds: ['inkCloud', 'enfeeble', 'umbralBeam', 'torrent'],
          itemIds: ['tome.mythic', 'robe.mythic', 'staff.mythic.tidal'],
          classId: 'hexer',
        },
        {
          heroId: 'tidecaller',
          pathId: 'tidecaller-tidecaller',
          moveIds: ['lizardRush', 'aquaSlice', 'iceShard', 'seawall'],
          itemIds: ['crest.mythic', 'dagger.mythic', 'sword.mythic.tidal'],
          classId: 'ranger',
        },
      ],
    },
  },

  iron: {
    id: 'iron',
    type: 'Iron',
    name: 'The Charged Line',
    line: 'Ferra charges the field. Every blade on the line answers it.',
    gameplan: 'Ferra leaves both foes Conducting on entry and on every Arcane hit; the line swings Metallic Blade and Overcharge free while a foe carries it, behind Warden’s Shields.',
    cover: 'Ferra’s Arcane Blast hits Storm and Mech alike; Valor’s Stoneheart and Warden’s Body Blow are Stone into Storm; Scallywag’s Aqua Slice is Water into Mech.',
    leads: ['ferra', 'ronin'],
    team: {
      name: 'The Charged Line',
      slots: [
        {
          heroId: 'ferra',
          pathId: 'ferra-magnetar',
          moveIds: ['ferrousCrush', 'arcaneBlast', 'conjuredSword', 'stunningBolt'],
          itemIds: ['staff.mythic.runed', 'orb.mythic', 'wand.mythic'],
          classId: 'sorcerer',
        },
        {
          heroId: 'ronin',
          pathId: 'ronin-raijin',
          moveIds: ['drawCut', 'shockSlice', 'overcharge', 'sharpen'],
          itemIds: ['sword.mythic.tempered', 'boots.mythic', 'duskreaverScythe'],
          classId: 'duelist',
        },
        {
          heroId: 'ironWarden',
          pathId: 'ironWarden-bulwark',
          moveIds: ['wallStrike', 'bastion', 'bodyBlow', 'metallicBlade'],
          itemIds: ['shield.mythic', 'plate.mythic', 'aegisEternal'],
          classId: 'warden',
        },
        {
          heroId: 'valor',
          pathId: 'valor-shieldwall',
          moveIds: ['oathstrike', 'stoneheart', 'metallicBlade', 'reinforce'],
          itemIds: ['sword.mythic.tempered', 'crest.mythic', 'plate.mythic'],
          classId: 'cleric',
        },
        {
          heroId: 'gallant',
          pathId: 'gallant-charger',
          moveIds: ['fullTilt', 'rideTheLightning', 'metallicBlade', 'onslaught'],
          itemIds: ['sword.mythic.tempered', 'dagger.mythic', 'worldbreaker'],
          classId: 'berserker',
        },
        {
          heroId: 'scallywag',
          pathId: 'scallywag-seawise',
          moveIds: ['broadside', 'aquaSlice', 'metallicBlade', 'heavyBlow'],
          itemIds: ['greataxe.mythic', 'leathers.mythic', 'sword.mythic.tempered'],
          classId: 'rogue',
        },
      ],
    },
  },
};

export const TRIAL_LIST: readonly TrialDefinition[] = Object.values(trials);
