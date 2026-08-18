// ⚠️ TEST FIXTURE CONTENT — a handful of equipment items sufficient to
// exercise the stat-pipeline half of src/run/equipment.ts (one item per slot,
// a couple of stat-focused alternates). Not authored equipment content; no
// hero restrictions are modeled (any item fits any slot's hero).

import type { EquipmentDefinition } from '../run/equipment';

export const equipment: Record<string, EquipmentDefinition> = {
  ironBlade: {
    id: 'ironBlade',
    name: 'Iron Blade',
    slot: 'weapon',
    rarity: 'common',
    statGrants: { attack: 10 },
  },
  arcaneFocus: {
    id: 'arcaneFocus',
    name: 'Arcane Focus',
    slot: 'weapon',
    rarity: 'epic',
    statGrants: { intelligence: 10 },
  },
  oakenArmor: {
    id: 'oakenArmor',
    name: 'Oaken Armor',
    slot: 'armor',
    rarity: 'rare',
    statGrants: { defense: 10 },
  },
  guardianPlate: {
    id: 'guardianPlate',
    name: 'Guardian Plate',
    slot: 'armor',
    rarity: 'mythic',
    statGrants: { hp: 20, defense: 10 },
  },
  swiftBoots: {
    id: 'swiftBoots',
    name: 'Swift Boots',
    slot: 'accessory',
    rarity: 'rare',
    statGrants: { speed: 10 },
  },
  vitalCharm: {
    id: 'vitalCharm',
    name: 'Vital Charm',
    slot: 'accessory',
    rarity: 'legendary',
    statGrants: { manaPool: 10, mpRegen: 5 },
  },
  // Test fixture — see App.tsx's equipTestDagger, which arms the Goblin
  // Skulker in the run's opening battle so the equip-slot inspect UI has a
  // real item to show without waiting on the equipment-reward economy.
  dagger: {
    id: 'dagger',
    name: 'Dagger',
    slot: 'weapon',
    rarity: 'common',
    statGrants: { attack: 5 },
  },
};
