// Equipment content. Started as an 8-item test fixture proving out the
// stat/status/passive pipelines in src/run/equipment.ts; this is now the
// authored (if not yet balance-passed — CLAUDE.md's "don't worry too much
// about balance, inject as much as you can" pass, 2026-08-22) item catalog.
//
// Three layers, in file order below:
//   1. The original 8 fixture items — kept byte-for-byte (ids, rarities,
//      stats) since tests (shop.test.ts, elementalForce.test.ts,
//      recruitment.test.ts, run.test.ts) and App.tsx's equipTestDagger key
//      off specific items (e.g. guardianPlate must stay mythic/expensive,
//      ironBlade must stay common/cheap, dagger must stay the Goblin
//      Skulker's starter weapon).
//   2. Generated per-type gear (weapon + armor + accessory for each of the
//      14 non-Ancient types, docs/types-and-heroes.md) — same discipline
//      src/data/statuses.ts uses for Elemental Force: derive 42 items from
//      TYPES rather than hand-duplicating the same 3-slot shape 14 times.
//      Ancient is skipped — no hero is Ancient-typed (it's reserved for the
//      Ancient boss fights), so that gear would be unusable by any player.
//      Each type's accessory grants that type's Elemental Force status
//      (src/data/statuses.ts) so every type has its own build-around piece,
//      not just Fire (emberBand, layer 1).
//   3. Hand-authored signature items spanning all 3 slots and all 5
//      rarities, including a handful wired to the new equipment-flavored
//      passives (src/data/passives.ts) to exercise grantsPassiveIds for
//      real — CLAUDE.md "Equipment and relics use the same hook-and-
//      condition system as abilities."

import type { EquipmentDefinition } from '../run/equipment';
import { RARITY_ORDER, type EquipmentRarity } from '../run/equipment';
import { TYPES, type TitanpactType } from './typechart';

const fixtureEquipment: Record<string, EquipmentDefinition> = {
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
  emberBand: {
    id: 'emberBand',
    name: 'Ember Band',
    slot: 'accessory',
    rarity: 'rare',
    statGrants: {},
    grantsStatusIds: [{ statusId: 'FireForce', magnitude: 10 }],
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

/** Per-rarity flat stat magnitude for generated weapon/armor gear — mirrors the Class/Evolution +10-per-stat convention, scaled up for rarer tiers, always a multiple of 5. */
const STAT_MAGNITUDE_BY_RARITY: Record<EquipmentRarity, number> = {
  common: 10,
  rare: 15,
  epic: 20,
  legendary: 25,
  mythic: 30,
};

/** Per-rarity Elemental Force magnitude for generated accessories — smaller scale than STAT_MAGNITUDE_BY_RARITY since it feeds BasePower directly (pre-multiplier), matching emberBand's existing rare/10 baseline. */
const FORCE_MAGNITUDE_BY_RARITY: Record<EquipmentRarity, number> = {
  common: 5,
  rare: 10,
  epic: 15,
  legendary: 20,
  mythic: 25,
};

interface TypeGearFlavor {
  /** Physical types grant Attack (weapon) / Defense (armor); magical types grant Intelligence (weapon) / Wisdom (armor) — CLAUDE.md's physical/magical pair split. */
  kind: 'attack' | 'intelligence';
  weaponName: string;
  armorName: string;
  accessoryName: string;
}

const TYPE_GEAR: Record<TitanpactType, TypeGearFlavor> = {
  Fire: { kind: 'attack', weaponName: 'Cinderfang Blade', armorName: 'Emberplate Mail', accessoryName: 'Ashcinder Talisman' },
  Water: { kind: 'intelligence', weaponName: 'Tidecaller Staff', armorName: 'Depthguard Scale', accessoryName: 'Riptide Charm' },
  Frost: { kind: 'intelligence', weaponName: 'Glacial Wand', armorName: 'Permafrost Bulwark', accessoryName: 'Rimefrost Pendant' },
  Storm: { kind: 'intelligence', weaponName: 'Thunderclap Rod', armorName: 'Stormward Plate', accessoryName: 'Galebound Ring' },
  Stone: { kind: 'attack', weaponName: 'Quarrybreaker Maul', armorName: 'Bedrock Aegis', accessoryName: 'Cairnstone Amulet' },
  Nature: { kind: 'attack', weaponName: 'Thornbriar Bow', armorName: 'Wildroot Hide', accessoryName: 'Verdant Seed Locket' },
  Light: { kind: 'intelligence', weaponName: 'Sunray Sceptre', armorName: 'Radiant Aegis', accessoryName: 'Dawnlight Halo' },
  Shadow: { kind: 'attack', weaponName: 'Nightfall Fang', armorName: 'Umbral Cloak', accessoryName: 'Duskbound Sigil' },
  Arcane: { kind: 'intelligence', weaponName: 'Runic Stave', armorName: 'Warded Mantle', accessoryName: 'Prismatic Lens' },
  Mind: { kind: 'intelligence', weaponName: 'Psionic Edge', armorName: 'Cognizant Veil', accessoryName: "Seer's Circlet" },
  Spirit: { kind: 'intelligence', weaponName: 'Wraithglass Scythe', armorName: 'Hollowed Vestment', accessoryName: 'Ancestral Beads' },
  Iron: { kind: 'attack', weaponName: 'Forgehammer', armorName: 'Ironclad Bulwark', accessoryName: 'Riveted Band' },
  Mech: { kind: 'attack', weaponName: 'Piston Cleaver', armorName: 'Plated Chassis', accessoryName: 'Servo Core' },
  Beast: { kind: 'attack', weaponName: 'Feral Claws', armorName: 'Beastskin Hide', accessoryName: 'Alpha Fang Necklace' },
  Ancient: { kind: 'attack', weaponName: 'Relic Blade', armorName: 'Timeworn Plate', accessoryName: 'Sunken Idol' },
};

function lowerFirst(value: string): string {
  return value.charAt(0).toLowerCase() + value.slice(1);
}

/** Generated per-type gear: 14 types x 3 slots = 42 items. Ancient is excluded — no hero is Ancient-typed (it's reserved for the Ancient boss fights, heroes.ts), so Ancient-flavored gear (STAB-less weapon/armor, unusable Ancient Force accessory) would be dead weight in every reward pool. Rarity is staggered per slot (offsets of 0/2/4 through RARITY_ORDER) so a single type's weapon/armor/accessory don't all land on the same tier, and so all 5 rarities end up represented across each slot. */
const generatedTypeEquipment: Record<string, EquipmentDefinition> = {};
TYPES.filter((type) => type !== 'Ancient').forEach((type, i) => {
  const gear = TYPE_GEAR[type];
  const weaponRarity = RARITY_ORDER[i % RARITY_ORDER.length];
  const armorRarity = RARITY_ORDER[(i + 2) % RARITY_ORDER.length];
  const accessoryRarity = RARITY_ORDER[(i + 4) % RARITY_ORDER.length];

  const weaponId = `${lowerFirst(type)}Weapon`;
  generatedTypeEquipment[weaponId] = {
    id: weaponId,
    name: gear.weaponName,
    slot: 'weapon',
    rarity: weaponRarity,
    statGrants: { [gear.kind]: STAT_MAGNITUDE_BY_RARITY[weaponRarity] },
  };

  const armorId = `${lowerFirst(type)}Armor`;
  generatedTypeEquipment[armorId] = {
    id: armorId,
    name: gear.armorName,
    slot: 'armor',
    rarity: armorRarity,
    statGrants: { [gear.kind === 'attack' ? 'defense' : 'wisdom']: STAT_MAGNITUDE_BY_RARITY[armorRarity] },
  };

  const accessoryId = `${lowerFirst(type)}Charm`;
  generatedTypeEquipment[accessoryId] = {
    id: accessoryId,
    name: gear.accessoryName,
    slot: 'accessory',
    rarity: accessoryRarity,
    statGrants: {},
    grantsStatusIds: [{ statusId: `${type}Force`, magnitude: FORCE_MAGNITUDE_BY_RARITY[accessoryRarity] }],
  };
});

/** Hand-authored signature items, spanning every slot and rarity, including a handful wired to the equipment-flavored passives (src/data/passives.ts) so grantsPassiveIds has real content exercising it, not just grantsStatusIds. */
const signatureEquipment: Record<string, EquipmentDefinition> = {
  // Weapons
  battlewornGreatsword: {
    id: 'battlewornGreatsword',
    name: 'Battleworn Greatsword',
    slot: 'weapon',
    rarity: 'common',
    statGrants: { attack: 10 },
  },
  apprenticeWand: {
    id: 'apprenticeWand',
    name: "Apprentice's Wand",
    slot: 'weapon',
    rarity: 'common',
    statGrants: { intelligence: 10 },
  },
  duelistsRapier: {
    id: 'duelistsRapier',
    name: "Duelist's Rapier",
    slot: 'weapon',
    rarity: 'rare',
    statGrants: { attack: 10, speed: 5 },
  },
  sagesTome: {
    id: 'sagesTome',
    name: "Sage's Tome",
    slot: 'weapon',
    rarity: 'rare',
    statGrants: { intelligence: 10, wisdom: 5 },
  },
  berserkersCleaver: {
    id: 'berserkersCleaver',
    name: "Berserker's Cleaver",
    slot: 'weapon',
    rarity: 'epic',
    statGrants: { attack: 25, defense: -10 },
  },
  bloodletterFang: {
    id: 'bloodletterFang',
    name: 'Bloodletter Fang',
    slot: 'weapon',
    rarity: 'epic',
    statGrants: { attack: 10 },
    grantsPassiveIds: ['bloodthirst'],
  },
  vengeanceBlade: {
    id: 'vengeanceBlade',
    name: 'Vengeance Blade',
    slot: 'weapon',
    rarity: 'legendary',
    statGrants: { attack: 15 },
    grantsPassiveIds: ['vengefulEmblem'],
  },
  worldbreaker: {
    id: 'worldbreaker',
    name: 'Worldbreaker',
    slot: 'weapon',
    rarity: 'mythic',
    statGrants: { attack: 30, hp: 20 },
  },
  archonsStaff: {
    id: 'archonsStaff',
    name: "Archon's Staff",
    slot: 'weapon',
    rarity: 'mythic',
    statGrants: { intelligence: 30, manaPool: 20 },
  },

  // Armor
  travelersGarb: {
    id: 'travelersGarb',
    name: "Traveler's Garb",
    slot: 'armor',
    rarity: 'common',
    statGrants: { hp: 10 },
  },
  scoutsLeather: {
    id: 'scoutsLeather',
    name: "Scout's Leather",
    slot: 'armor',
    rarity: 'common',
    statGrants: { defense: 5, speed: 5 },
  },
  templarsBreastplate: {
    id: 'templarsBreastplate',
    name: "Templar's Breastplate",
    slot: 'armor',
    rarity: 'rare',
    statGrants: { hp: 15, defense: 10 },
  },
  mysticsRobe: {
    id: 'mysticsRobe',
    name: "Mystic's Robe",
    slot: 'armor',
    rarity: 'rare',
    statGrants: { wisdom: 15, manaPool: 5 },
  },
  bulwarkOfTheVanguard: {
    id: 'bulwarkOfTheVanguard',
    name: 'Bulwark of the Vanguard',
    slot: 'armor',
    rarity: 'epic',
    statGrants: { hp: 20, defense: 15 },
  },
  phoenixMail: {
    id: 'phoenixMail',
    name: 'Phoenix Mail',
    slot: 'armor',
    rarity: 'legendary',
    statGrants: { hp: 25 },
    grantsPassiveIds: ['wardensVigil'],
  },
  aegisEternal: {
    id: 'aegisEternal',
    name: 'Aegis Eternal',
    slot: 'armor',
    rarity: 'mythic',
    statGrants: { hp: 30, defense: 20, wisdom: 10 },
  },

  // Accessories
  travelersCharm: {
    id: 'travelersCharm',
    name: "Traveler's Charm",
    slot: 'accessory',
    rarity: 'common',
    statGrants: { speed: 5 },
  },
  apprenticeBand: {
    id: 'apprenticeBand',
    name: "Apprentice's Band",
    slot: 'accessory',
    rarity: 'common',
    statGrants: { manaPool: 10 },
  },
  huntersInsignia: {
    id: 'huntersInsignia',
    name: "Hunter's Insignia",
    slot: 'accessory',
    rarity: 'rare',
    statGrants: { attack: 5, speed: 10 },
  },
  focusingLens: {
    id: 'focusingLens',
    name: 'Focusing Lens',
    slot: 'accessory',
    rarity: 'rare',
    statGrants: { intelligence: 5, wisdom: 5 },
  },
  stormcallersSigil: {
    id: 'stormcallersSigil',
    name: "Stormcaller's Sigil",
    slot: 'accessory',
    rarity: 'epic',
    statGrants: {},
    grantsPassiveIds: ['stormcallersFocus'],
  },
  frostboundLocket: {
    id: 'frostboundLocket',
    name: 'Frostbound Locket',
    slot: 'accessory',
    rarity: 'epic',
    statGrants: {},
    grantsPassiveIds: ['frostbrand'],
  },
  shroudOfShadows: {
    id: 'shroudOfShadows',
    name: 'Shroud of Shadows',
    slot: 'accessory',
    rarity: 'epic',
    statGrants: {},
    grantsPassiveIds: ['shadowfang'],
  },
  ringOfVitality: {
    id: 'ringOfVitality',
    name: 'Ring of Vitality',
    slot: 'accessory',
    rarity: 'legendary',
    statGrants: { hp: 20, mpRegen: 10 },
  },
  crownOfTheAncients: {
    id: 'crownOfTheAncients',
    name: 'Crown of the Ancients',
    slot: 'accessory',
    rarity: 'mythic',
    statGrants: { hp: 15, attack: 10, defense: 10, intelligence: 10, wisdom: 10, speed: 10 },
  },
};

export const equipment: Record<string, EquipmentDefinition> = {
  ...fixtureEquipment,
  ...generatedTypeEquipment,
  ...signatureEquipment,
};
