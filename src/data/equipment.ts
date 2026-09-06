// Item catalog. Items are uncategorised — any item goes in any of a hero's slots, and the
// weapon/armor/trinket groupings below are authoring flavour only. Every item spends its
// rarity's point budget exactly (RARITY_BUDGET, STAT_POINT_VALUE, PASSIVE_ITEM_COST —
// enforced by test/equipment.test.ts). Three layers: hand-authored Act-1 commons,
// generated per-type gear (rare+), hand-authored signatures.
// Ids pinned by tests/App.tsx: ironBlade (common), guardianPlate (mythic), dagger,
// emberBand (FireForce 15), arcaneFocus, oakenArmor, swiftBoots, vitalCharm.

import type { EquipmentDefinition } from '../run/equipment';
import { STAT_POINT_VALUE, type EquipmentRarity } from '../run/equipment';
import { TYPES, type TitanpactType } from './typechart';

// --- 1. Act-1 commons — 30 points each ---

const commonWeapons: Record<string, EquipmentDefinition> = {
  ironBlade: {
    id: 'ironBlade',
    name: 'Iron Blade',
    rarity: 'common',
    statGrants: { attack: 30 },
  },
  dagger: {
    id: 'dagger',
    name: 'Dagger',
    rarity: 'common',
    statGrants: { attack: 15, speed: 15 },
  },
  torch: {
    id: 'torch',
    name: 'Torch',
    rarity: 'common',
    statGrants: { attack: 10 },
    grantsStatusIds: [{ statusId: 'FireForce', magnitude: 10 }],
  },
  huntersBow: {
    id: 'huntersBow',
    name: "Hunter's Bow",
    rarity: 'common',
    statGrants: { attack: 15, wisdom: 15 },
  },
  pummelGloves: {
    id: 'pummelGloves',
    name: 'Pummel Gloves',
    rarity: 'common',
    statGrants: { attack: 10 },
    grantsStatusIds: [{ statusId: 'IronForce', magnitude: 10 }],
  },
  battleAxe: {
    id: 'battleAxe',
    name: 'Battle Axe',
    rarity: 'common',
    statGrants: { attack: 15, defense: 15 },
  },
  apprenticeWand: {
    id: 'apprenticeWand',
    name: 'Apprentice Wand',
    rarity: 'common',
    statGrants: { intelligence: 30 },
  },
  magicBook: {
    id: 'magicBook',
    name: 'Magic Book',
    rarity: 'common',
    statGrants: { intelligence: 15, wisdom: 15 },
  },
  mysticOrb: {
    id: 'mysticOrb',
    name: 'Mystic Orb',
    rarity: 'common',
    statGrants: { intelligence: 10 },
    grantsStatusIds: [{ statusId: 'ArcaneForce', magnitude: 10 }],
  },
  memento: {
    id: 'memento',
    name: 'Memento',
    rarity: 'common',
    statGrants: { intelligence: 10 },
    grantsStatusIds: [{ statusId: 'SpiritForce', magnitude: 10 }],
  },
  oakStaff: {
    id: 'oakStaff',
    name: 'Oak Staff',
    rarity: 'common',
    statGrants: { intelligence: 15, defense: 15 },
  },
  windGem: {
    id: 'windGem',
    name: 'Wind Gem',
    rarity: 'common',
    statGrants: { intelligence: 15, speed: 15 },
  },
};

// HP appears at double amounts because it is priced at half (STAT_POINT_VALUE); Mana is not,
// since the budget pass moved it to full price.
const commonArmor: Record<string, EquipmentDefinition> = {
  leatherJerkin: {
    id: 'leatherJerkin',
    name: 'Leather Jerkin',
    rarity: 'common',
    statGrants: { defense: 30 },
  },
  paddedGambeson: {
    id: 'paddedGambeson',
    name: 'Padded Gambeson',
    rarity: 'common',
    statGrants: { hp: 60 },
  },
  scoutsLeather: {
    id: 'scoutsLeather',
    name: "Scout's Leather",
    rarity: 'common',
    statGrants: { defense: 15, speed: 15 },
  },
  travelersGarb: {
    id: 'travelersGarb',
    name: "Traveler's Garb",
    rarity: 'common',
    statGrants: { hp: 30, defense: 15 },
  },
  acolytesRobe: {
    id: 'acolytesRobe',
    name: "Acolyte's Robe",
    rarity: 'common',
    statGrants: { wisdom: 30 },
  },
  linenWrap: {
    id: 'linenWrap',
    name: 'Linen Wrap',
    rarity: 'common',
    statGrants: { hp: 30, wisdom: 15 },
  },
  kiteShield: {
    id: 'kiteShield',
    name: 'Kite Shield',
    rarity: 'common',
    statGrants: { defense: 10 },
    grantsStatusIds: [{ statusId: 'IronForce', magnitude: 10 }],
  },
  mossweaveShawl: {
    id: 'mossweaveShawl',
    name: 'Mossweave Shawl',
    rarity: 'common',
    statGrants: { wisdom: 10 },
    grantsStatusIds: [{ statusId: 'NatureForce', magnitude: 10 }],
  },
};

const commonAccessories: Record<string, EquipmentDefinition> = {
  travelersCharm: {
    id: 'travelersCharm',
    name: "Traveler's Charm",
    rarity: 'common',
    statGrants: { speed: 30 },
  },
  apprenticeBand: {
    id: 'apprenticeBand',
    name: "Apprentice's Band",
    rarity: 'common',
    statGrants: { manaPool: 20, wisdom: 10 },
  },
  copperRing: {
    id: 'copperRing',
    name: 'Copper Ring',
    rarity: 'common',
    statGrants: { attack: 15, manaPool: 15 },
  },
  smoothstoneCharm: {
    id: 'smoothstoneCharm',
    name: 'Smoothstone Charm',
    rarity: 'common',
    statGrants: { hp: 60 },
  },
  wardingCharm: {
    id: 'wardingCharm',
    name: 'Warding Charm',
    rarity: 'common',
    statGrants: { defense: 15, wisdom: 15 },
  },
  runedSigil: {
    id: 'runedSigil',
    name: 'Runed Sigil',
    rarity: 'common',
    statGrants: { intelligence: 15, manaPool: 15 },
  },
  boneTotem: {
    id: 'boneTotem',
    name: 'Bone Totem',
    rarity: 'common',
    statGrants: { attack: 10 },
    grantsStatusIds: [{ statusId: 'BeastForce', magnitude: 10 }],
  },
  wornBoots: {
    id: 'wornBoots',
    name: 'Worn Boots',
    rarity: 'common',
    statGrants: { hp: 20, speed: 20 },
  },
};

// --- 2. Generated per-type gear — 14 non-Ancient types x 3 pieces, rare and up ---

const GENERATED_TIERS: readonly EquipmentRarity[] = ['rare', 'epic', 'legendary', 'mythic'];

interface TypeGearFlavor {
  /** 'attack' grants Attack/Defense on weapon/armor; 'intelligence' grants Intelligence/Wisdom. */
  kind: 'attack' | 'intelligence';
  /** The non-Force half of the accessory. No `mpRegen`: at triple price it cannot split a budget evenly. */
  accessoryStat: 'speed' | 'manaPool' | 'hp';
  weaponName: string;
  armorName: string;
  accessoryName: string;
}

const TYPE_GEAR: Record<TitanpactType, TypeGearFlavor> = {
  Fire: { kind: 'attack', accessoryStat: 'speed', weaponName: 'Cinderfang Blade', armorName: 'Emberplate Mail', accessoryName: 'Ashcinder Talisman' },
  Water: { kind: 'intelligence', accessoryStat: 'manaPool', weaponName: 'Tidecaller Staff', armorName: 'Depthguard Scale', accessoryName: 'Riptide Charm' },
  Frost: { kind: 'intelligence', accessoryStat: 'hp', weaponName: 'Glacial Wand', armorName: 'Permafrost Bulwark', accessoryName: 'Rimefrost Pendant' },
  Storm: { kind: 'intelligence', accessoryStat: 'speed', weaponName: 'Thunderclap Rod', armorName: 'Stormward Plate', accessoryName: 'Galebound Ring' },
  Stone: { kind: 'attack', accessoryStat: 'hp', weaponName: 'Quarrybreaker Maul', armorName: 'Bedrock Aegis', accessoryName: 'Cairnstone Amulet' },
  Nature: { kind: 'attack', accessoryStat: 'hp', weaponName: 'Thornbriar Bow', armorName: 'Wildroot Hide', accessoryName: 'Verdant Seed Locket' },
  Light: { kind: 'intelligence', accessoryStat: 'manaPool', weaponName: 'Sunray Sceptre', armorName: 'Radiant Aegis', accessoryName: 'Dawnlight Halo' },
  Shadow: { kind: 'attack', accessoryStat: 'speed', weaponName: 'Nightfall Fang', armorName: 'Umbral Cloak', accessoryName: 'Duskbound Sigil' },
  Arcane: { kind: 'intelligence', accessoryStat: 'manaPool', weaponName: 'Runic Stave', armorName: 'Warded Mantle', accessoryName: 'Prismatic Lens' },
  Mind: { kind: 'intelligence', accessoryStat: 'manaPool', weaponName: 'Psionic Edge', armorName: 'Cognizant Veil', accessoryName: "Seer's Circlet" },
  Spirit: { kind: 'intelligence', accessoryStat: 'hp', weaponName: 'Wraithglass Scythe', armorName: 'Hollowed Vestment', accessoryName: 'Ancestral Beads' },
  Iron: { kind: 'attack', accessoryStat: 'hp', weaponName: 'Forgehammer', armorName: 'Ironclad Bulwark', accessoryName: 'Riveted Band' },
  Mech: { kind: 'attack', accessoryStat: 'speed', weaponName: 'Piston Cleaver', armorName: 'Plated Chassis', accessoryName: 'Servo Core' },
  Beast: { kind: 'attack', accessoryStat: 'speed', weaponName: 'Feral Claws', armorName: 'Beastskin Hide', accessoryName: 'Alpha Fang Necklace' },
  Ancient: { kind: 'attack', accessoryStat: 'hp', weaponName: 'Relic Blade', armorName: 'Timeworn Plate', accessoryName: 'Sunken Idol' },
};

function lowerFirst(value: string): string {
  return value.charAt(0).toLowerCase() + value.slice(1);
}

/**
 * The three pieces' shapes, per tier, in authored amounts — a table rather than the halve-the-
 * budget formula it replaced (2026-09-06). With Elemental Force at 2 points a magnitude and
 * three different flavour-stat prices, no single divisor lands every piece on a multiple of 5,
 * and the Epic+ effect floor has to be cleared piece by piece besides. Every row is checked
 * against RARITY_BUDGET by test/equipment.test.ts, so a wrong number here fails loudly.
 *
 * `flavorPoints` is spent, not granted: the accessory's stat amount is those points divided by
 * its own STAT_POINT_VALUE, and Force takes whatever the budget has left.
 */
const TYPE_GEAR_SHAPE: Record<EquipmentRarity, { weapon: { stat: number; force: number }; armor: { hp: number; stat: number; force: number }; accessory: { flavorPoints: number; force: number } }> = {
  // Common never appears here — GENERATED_TIERS starts at rare — but the record must be total.
  common: { weapon: { stat: 10, force: 10 }, armor: { hp: 20, stat: 10, force: 5 }, accessory: { flavorPoints: 10, force: 10 } },
  rare: { weapon: { stat: 30, force: 10 }, armor: { hp: 40, stat: 30, force: 0 }, accessory: { flavorPoints: 20, force: 15 } },
  epic: { weapon: { stat: 30, force: 20 }, armor: { hp: 40, stat: 20, force: 15 }, accessory: { flavorPoints: 20, force: 25 } },
  legendary: { weapon: { stat: 40, force: 25 }, armor: { hp: 60, stat: 20, force: 20 }, accessory: { flavorPoints: 30, force: 30 } },
  mythic: { weapon: { stat: 50, force: 30 }, armor: { hp: 60, stat: 40, force: 20 }, accessory: { flavorPoints: 40, force: 35 } },
};

// Rarity is staggered so one type's three pieces never share a tier: weapon = stat + Force,
// armor = HP + defensive stat (+ Force from Epic up, which is what clears its effect floor),
// accessory = flavour stat + Force.
const generatedTypeEquipment: Record<string, EquipmentDefinition> = {};
TYPES.filter((type) => type !== 'Ancient').forEach((type, i) => {
  const gear = TYPE_GEAR[type];
  const idPrefix = lowerFirst(type);
  const weaponRarity = GENERATED_TIERS[i % GENERATED_TIERS.length];
  const armorRarity = GENERATED_TIERS[(i + 1) % GENERATED_TIERS.length];
  const accessoryRarity = GENERATED_TIERS[(i + 2) % GENERATED_TIERS.length];

  const weaponId = `${idPrefix}Weapon`;
  const weapon = TYPE_GEAR_SHAPE[weaponRarity].weapon;
  generatedTypeEquipment[weaponId] = {
    id: weaponId,
    name: gear.weaponName,
    rarity: weaponRarity,
    statGrants: { [gear.kind]: weapon.stat },
    grantsStatusIds: [{ statusId: `${type}Force`, magnitude: weapon.force }],
  };

  const armorId = `${idPrefix}Armor`;
  const armor = TYPE_GEAR_SHAPE[armorRarity].armor;
  generatedTypeEquipment[armorId] = {
    id: armorId,
    name: gear.armorName,
    rarity: armorRarity,
    statGrants: { hp: armor.hp, [gear.kind === 'attack' ? 'defense' : 'wisdom']: armor.stat },
    // The Rare armor is the one generated piece with no effect, and it is allowed to be plain.
    ...(armor.force > 0 ? { grantsStatusIds: [{ statusId: `${type}Force`, magnitude: armor.force }] } : {}),
  };

  const accessoryId = `${idPrefix}Charm`;
  const accessory = TYPE_GEAR_SHAPE[accessoryRarity].accessory;
  generatedTypeEquipment[accessoryId] = {
    id: accessoryId,
    name: gear.accessoryName,
    rarity: accessoryRarity,
    statGrants: { [gear.accessoryStat]: accessory.flavorPoints / STAT_POINT_VALUE[gear.accessoryStat] },
    grantsStatusIds: [{ statusId: `${type}Force`, magnitude: accessory.force }],
  };
});

// --- 3. Signature items — rare through mythic ---

const signatureEquipment: Record<string, EquipmentDefinition> = {
  // --- Weapons ---
  battlewornGreatsword: {
    id: 'battlewornGreatsword',
    name: 'Battleworn Greatsword',
    rarity: 'rare',
    statGrants: { attack: 50 },
  },
  duelistsRapier: {
    id: 'duelistsRapier',
    name: "Duelist's Rapier",
    rarity: 'rare',
    statGrants: { attack: 25, speed: 25 },
  },
  sagesTome: {
    id: 'sagesTome',
    name: "Sage's Tome",
    rarity: 'rare',
    statGrants: { intelligence: 35, wisdom: 15 },
  },
  arcaneFocus: {
    id: 'arcaneFocus',
    name: 'Arcane Focus',
    rarity: 'epic',
    statGrants: { intelligence: 30 },
    grantsStatusIds: [{ statusId: 'ArcaneForce', magnitude: 20 }],
  },
  // -10 Defense refunds 10 points; how much a downside may buy is an open question (docs/progression.md).
  berserkersCleaver: {
    id: 'berserkersCleaver',
    name: "Berserker's Cleaver",
    rarity: 'epic',
    statGrants: { attack: 50, defense: -20 },
    grantsPassiveIds: ['sunder'],
  },
  bloodletterFang: {
    id: 'bloodletterFang',
    name: 'Bloodletter Fang',
    rarity: 'epic',
    statGrants: { attack: 30 },
    grantsPassiveIds: ['bloodthirst'],
  },
  vengeanceBlade: {
    id: 'vengeanceBlade',
    name: 'Vengeance Blade',
    rarity: 'legendary',
    statGrants: { attack: 40 },
    grantsPassiveIds: ['vengefulEmblem'],
  },
  tempestRod: {
    id: 'tempestRod',
    name: 'Tempest Rod',
    rarity: 'legendary',
    statGrants: { intelligence: 50 },
    grantsPassiveIds: ['stormcallersFocus'],
  },
  rimeCleaver: {
    id: 'rimeCleaver',
    name: 'Rime Cleaver',
    rarity: 'legendary',
    statGrants: { attack: 50 },
    grantsPassiveIds: ['frostbrand'],
  },
  worldbreaker: {
    id: 'worldbreaker',
    name: 'Worldbreaker',
    rarity: 'mythic',
    statGrants: { attack: 50, hp: 40 },
    grantsStatusIds: [{ statusId: 'IronForce', magnitude: 20 }],
  },
  archonsStaff: {
    id: 'archonsStaff',
    name: "Archon's Staff",
    rarity: 'mythic',
    statGrants: { intelligence: 50, manaPool: 20 },
    grantsPassiveIds: ['arcaneReservoir'],
  },
  duskreaverScythe: {
    id: 'duskreaverScythe',
    name: 'Duskreaver Scythe',
    rarity: 'mythic',
    statGrants: { attack: 55, speed: 15 },
    grantsPassiveIds: ['shadowfang'],
  },

  // --- Armor ---
  oakenArmor: {
    id: 'oakenArmor',
    name: 'Oaken Armor',
    rarity: 'rare',
    statGrants: { hp: 60, defense: 20 },
  },
  templarsBreastplate: {
    id: 'templarsBreastplate',
    name: "Templar's Breastplate",
    rarity: 'rare',
    statGrants: { hp: 40, defense: 30 },
  },
  mysticsRobe: {
    id: 'mysticsRobe',
    name: "Mystic's Robe",
    rarity: 'rare',
    statGrants: { wisdom: 30, manaPool: 20 },
  },
  bulwarkOfTheVanguard: {
    id: 'bulwarkOfTheVanguard',
    name: 'Bulwark of the Vanguard',
    rarity: 'epic',
    statGrants: { hp: 40, defense: 10 },
    grantsPassiveIds: ['secondSkin'],
  },
  runewardCuirass: {
    id: 'runewardCuirass',
    name: 'Runeward Cuirass',
    rarity: 'epic',
    statGrants: { wisdom: 20, manaPool: 20 },
    grantsPassiveIds: ['purifyingWard'],
  },
  phoenixMail: {
    id: 'phoenixMail',
    name: 'Phoenix Mail',
    rarity: 'legendary',
    statGrants: { hp: 100, defense: 10 },
    grantsPassiveIds: ['wardensVigil'],
  },
  dreadnoughtChassis: {
    id: 'dreadnoughtChassis',
    name: 'Dreadnought Chassis',
    rarity: 'legendary',
    statGrants: { hp: 60, defense: 30 },
    grantsStatusIds: [{ statusId: 'IronForce', magnitude: 15 }],
  },
  guardianPlate: {
    id: 'guardianPlate',
    name: 'Guardian Plate',
    rarity: 'mythic',
    statGrants: { hp: 70, defense: 35 },
    grantsPassiveIds: ['secondSkin'],
  },
  aegisEternal: {
    id: 'aegisEternal',
    name: 'Aegis Eternal',
    rarity: 'mythic',
    statGrants: { hp: 60, defense: 20 },
    grantsPassiveIds: ['wardensVigil', 'purifyingWard'],
  },
  mantleOfTheArchmage: {
    id: 'mantleOfTheArchmage',
    name: 'Mantle of the Archmage',
    rarity: 'mythic',
    statGrants: { wisdom: 30, intelligence: 20, manaPool: 20 },
    grantsStatusIds: [{ statusId: 'ArcaneForce', magnitude: 20 }],
  },

  // --- Accessories ---
  swiftBoots: {
    id: 'swiftBoots',
    name: 'Swift Boots',
    rarity: 'rare',
    statGrants: { speed: 50 },
  },
  // FireForce magnitude 10 is pinned by test/elementalForce.test.ts.
  emberBand: {
    id: 'emberBand',
    name: 'Ember Band',
    rarity: 'rare',
    statGrants: { attack: 20 },
    grantsStatusIds: [{ statusId: 'FireForce', magnitude: 15 }],
  },
  huntersInsignia: {
    id: 'huntersInsignia',
    name: "Hunter's Insignia",
    rarity: 'rare',
    statGrants: { attack: 25, speed: 25 },
  },
  focusingLens: {
    id: 'focusingLens',
    name: 'Focusing Lens',
    rarity: 'rare',
    statGrants: { intelligence: 25, wisdom: 25 },
  },
  stormcallersSigil: {
    id: 'stormcallersSigil',
    name: "Stormcaller's Sigil",
    rarity: 'epic',
    statGrants: { speed: 30 },
    grantsPassiveIds: ['stormcallersFocus'],
  },
  frostboundLocket: {
    id: 'frostboundLocket',
    name: 'Frostbound Locket',
    rarity: 'epic',
    statGrants: { wisdom: 30 },
    grantsPassiveIds: ['frostbrand'],
  },
  shroudOfShadows: {
    id: 'shroudOfShadows',
    name: 'Shroud of Shadows',
    rarity: 'epic',
    statGrants: { speed: 30 },
    grantsPassiveIds: ['shadowfang'],
  },
  sanguineTorc: {
    id: 'sanguineTorc',
    name: 'Sanguine Torc',
    rarity: 'epic',
    statGrants: { attack: 30 },
    grantsPassiveIds: ['sanguine'],
  },
  emberheartIdol: {
    id: 'emberheartIdol',
    name: 'Emberheart Idol',
    rarity: 'epic',
    statGrants: { hp: 60 },
    grantsPassiveIds: ['emberheart'],
  },
  // MP Regen is triple price, so +10 alone is 30 points — it cannot appear below legendary.
  vitalCharm: {
    id: 'vitalCharm',
    name: 'Vital Charm',
    rarity: 'legendary',
    statGrants: { manaPool: 20, mpRegen: 10 },
    grantsPassiveIds: ['arcaneReservoir'],
  },
  ringOfVitality: {
    id: 'ringOfVitality',
    name: 'Ring of Vitality',
    rarity: 'legendary',
    statGrants: { hp: 60, mpRegen: 10 },
    grantsPassiveIds: ['quickening'],
  },
  wellspringDiadem: {
    id: 'wellspringDiadem',
    name: 'Wellspring Diadem',
    rarity: 'legendary',
    statGrants: { manaPool: 30, mpRegen: 10 },
    grantsPassiveIds: ['purifyingWard'],
  },
  crownOfTheAncients: {
    id: 'crownOfTheAncients',
    name: 'Crown of the Ancients',
    rarity: 'mythic',
    statGrants: { hp: 20, attack: 15, defense: 15, intelligence: 15, wisdom: 15 },
    grantsPassiveIds: ['rallyingStandard'],
  },
  titansTotem: {
    id: 'titansTotem',
    name: "Titan's Totem",
    rarity: 'mythic',
    statGrants: { hp: 100, defense: 20 },
    grantsStatusIds: [{ statusId: 'StoneForce', magnitude: 20 }],
  },
};

export const equipment: Record<string, EquipmentDefinition> = {
  ...commonWeapons,
  ...commonArmor,
  ...commonAccessories,
  ...generatedTypeEquipment,
  ...signatureEquipment,
};
