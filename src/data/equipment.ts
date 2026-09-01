// Equipment catalog. Every item spends its rarity's point budget exactly (RARITY_BUDGET,
// STAT_POINT_VALUE, PASSIVE_ITEM_COST — enforced by test/equipment.test.ts). Three layers:
// hand-authored Act-1 commons, generated per-type gear (rare+), hand-authored signatures.
// Ids pinned by tests/App.tsx: ironBlade (common), guardianPlate (mythic), dagger,
// emberBand (FireForce 10), arcaneFocus, oakenArmor, swiftBoots, vitalCharm.

import type { EquipmentDefinition } from '../run/equipment';
import { RARITY_BUDGET, type EquipmentRarity } from '../run/equipment';
import { TYPES, type TitanpactType } from './typechart';

// --- 1. Act-1 commons — 10 points each ---

const commonWeapons: Record<string, EquipmentDefinition> = {
  ironBlade: {
    id: 'ironBlade',
    name: 'Iron Blade',
    slot: 'weapon',
    rarity: 'common',
    statGrants: { attack: 10 },
  },
  dagger: {
    id: 'dagger',
    name: 'Dagger',
    slot: 'weapon',
    rarity: 'common',
    statGrants: { attack: 5, speed: 5 },
  },
  torch: {
    id: 'torch',
    name: 'Torch',
    slot: 'weapon',
    rarity: 'common',
    statGrants: { attack: 5 },
    grantsStatusIds: [{ statusId: 'FireForce', magnitude: 5 }],
  },
  huntersBow: {
    id: 'huntersBow',
    name: "Hunter's Bow",
    slot: 'weapon',
    rarity: 'common',
    statGrants: { attack: 5, wisdom: 5 },
  },
  pummelGloves: {
    id: 'pummelGloves',
    name: 'Pummel Gloves',
    slot: 'weapon',
    rarity: 'common',
    statGrants: { attack: 5 },
    grantsStatusIds: [{ statusId: 'IronForce', magnitude: 5 }],
  },
  battleAxe: {
    id: 'battleAxe',
    name: 'Battle Axe',
    slot: 'weapon',
    rarity: 'common',
    statGrants: { attack: 5, defense: 5 },
  },
  apprenticeWand: {
    id: 'apprenticeWand',
    name: 'Apprentice Wand',
    slot: 'weapon',
    rarity: 'common',
    statGrants: { intelligence: 10 },
  },
  magicBook: {
    id: 'magicBook',
    name: 'Magic Book',
    slot: 'weapon',
    rarity: 'common',
    statGrants: { intelligence: 5, wisdom: 5 },
  },
  mysticOrb: {
    id: 'mysticOrb',
    name: 'Mystic Orb',
    slot: 'weapon',
    rarity: 'common',
    statGrants: { intelligence: 5 },
    grantsStatusIds: [{ statusId: 'ArcaneForce', magnitude: 5 }],
  },
  memento: {
    id: 'memento',
    name: 'Memento',
    slot: 'weapon',
    rarity: 'common',
    statGrants: { intelligence: 5 },
    grantsStatusIds: [{ statusId: 'SpiritForce', magnitude: 5 }],
  },
  oakStaff: {
    id: 'oakStaff',
    name: 'Oak Staff',
    slot: 'weapon',
    rarity: 'common',
    statGrants: { intelligence: 5, defense: 5 },
  },
  windGem: {
    id: 'windGem',
    name: 'Wind Gem',
    slot: 'weapon',
    rarity: 'common',
    statGrants: { intelligence: 5, speed: 5 },
  },
};

// HP and Mana appear at double amounts because they are priced at half (STAT_POINT_VALUE).
const commonArmor: Record<string, EquipmentDefinition> = {
  leatherJerkin: {
    id: 'leatherJerkin',
    name: 'Leather Jerkin',
    slot: 'armor',
    rarity: 'common',
    statGrants: { defense: 10 },
  },
  paddedGambeson: {
    id: 'paddedGambeson',
    name: 'Padded Gambeson',
    slot: 'armor',
    rarity: 'common',
    statGrants: { hp: 20 },
  },
  scoutsLeather: {
    id: 'scoutsLeather',
    name: "Scout's Leather",
    slot: 'armor',
    rarity: 'common',
    statGrants: { defense: 5, speed: 5 },
  },
  travelersGarb: {
    id: 'travelersGarb',
    name: "Traveler's Garb",
    slot: 'armor',
    rarity: 'common',
    statGrants: { hp: 10, defense: 5 },
  },
  acolytesRobe: {
    id: 'acolytesRobe',
    name: "Acolyte's Robe",
    slot: 'armor',
    rarity: 'common',
    statGrants: { wisdom: 10 },
  },
  linenWrap: {
    id: 'linenWrap',
    name: 'Linen Wrap',
    slot: 'armor',
    rarity: 'common',
    statGrants: { hp: 10, wisdom: 5 },
  },
  kiteShield: {
    id: 'kiteShield',
    name: 'Kite Shield',
    slot: 'armor',
    rarity: 'common',
    statGrants: { defense: 5 },
    grantsStatusIds: [{ statusId: 'IronForce', magnitude: 5 }],
  },
  mossweaveShawl: {
    id: 'mossweaveShawl',
    name: 'Mossweave Shawl',
    slot: 'armor',
    rarity: 'common',
    statGrants: { wisdom: 5 },
    grantsStatusIds: [{ statusId: 'NatureForce', magnitude: 5 }],
  },
};

const commonAccessories: Record<string, EquipmentDefinition> = {
  travelersCharm: {
    id: 'travelersCharm',
    name: "Traveler's Charm",
    slot: 'accessory',
    rarity: 'common',
    statGrants: { speed: 10 },
  },
  apprenticeBand: {
    id: 'apprenticeBand',
    name: "Apprentice's Band",
    slot: 'accessory',
    rarity: 'common',
    statGrants: { manaPool: 20 },
  },
  copperRing: {
    id: 'copperRing',
    name: 'Copper Ring',
    slot: 'accessory',
    rarity: 'common',
    statGrants: { attack: 5, manaPool: 10 },
  },
  smoothstoneCharm: {
    id: 'smoothstoneCharm',
    name: 'Smoothstone Charm',
    slot: 'accessory',
    rarity: 'common',
    statGrants: { hp: 20 },
  },
  wardingCharm: {
    id: 'wardingCharm',
    name: 'Warding Charm',
    slot: 'accessory',
    rarity: 'common',
    statGrants: { defense: 5, wisdom: 5 },
  },
  runedSigil: {
    id: 'runedSigil',
    name: 'Runed Sigil',
    slot: 'accessory',
    rarity: 'common',
    statGrants: { intelligence: 5, manaPool: 10 },
  },
  boneTotem: {
    id: 'boneTotem',
    name: 'Bone Totem',
    slot: 'accessory',
    rarity: 'common',
    statGrants: { attack: 5 },
    grantsStatusIds: [{ statusId: 'BeastForce', magnitude: 5 }],
  },
  wornBoots: {
    id: 'wornBoots',
    name: 'Worn Boots',
    slot: 'accessory',
    rarity: 'common',
    statGrants: { hp: 10, speed: 5 },
  },
};

// --- 2. Generated per-type gear — 14 non-Ancient types x 3 slots, rare and up ---

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

// Rarity is staggered per slot so one type's three pieces never share a tier. Each item
// splits its budget in half by point value: weapon = stat + Force, armor = HP + stat,
// accessory = Force + flavor stat.
const generatedTypeEquipment: Record<string, EquipmentDefinition> = {};
TYPES.filter((type) => type !== 'Ancient').forEach((type, i) => {
  const gear = TYPE_GEAR[type];
  const idPrefix = lowerFirst(type);
  const weaponRarity = GENERATED_TIERS[i % GENERATED_TIERS.length];
  const armorRarity = GENERATED_TIERS[(i + 1) % GENERATED_TIERS.length];
  const accessoryRarity = GENERATED_TIERS[(i + 2) % GENERATED_TIERS.length];

  const weaponId = `${idPrefix}Weapon`;
  const weaponBudget = RARITY_BUDGET[weaponRarity];
  generatedTypeEquipment[weaponId] = {
    id: weaponId,
    name: gear.weaponName,
    slot: 'weapon',
    rarity: weaponRarity,
    statGrants: { [gear.kind]: weaponBudget / 2 },
    grantsStatusIds: [{ statusId: `${type}Force`, magnitude: weaponBudget / 2 }],
  };

  const armorId = `${idPrefix}Armor`;
  const armorBudget = RARITY_BUDGET[armorRarity];
  generatedTypeEquipment[armorId] = {
    id: armorId,
    name: gear.armorName,
    slot: 'armor',
    rarity: armorRarity,
    statGrants: { hp: armorBudget, [gear.kind === 'attack' ? 'defense' : 'wisdom']: armorBudget / 2 },
  };

  const accessoryId = `${idPrefix}Charm`;
  const accessoryBudget = RARITY_BUDGET[accessoryRarity];
  // speed is priced 1:1, hp and manaPool at half, so the same half-budget buys twice as much.
  const flavorAmount = gear.accessoryStat === 'speed' ? accessoryBudget / 2 : accessoryBudget;
  generatedTypeEquipment[accessoryId] = {
    id: accessoryId,
    name: gear.accessoryName,
    slot: 'accessory',
    rarity: accessoryRarity,
    statGrants: { [gear.accessoryStat]: flavorAmount },
    grantsStatusIds: [{ statusId: `${type}Force`, magnitude: accessoryBudget / 2 }],
  };
});

// --- 3. Signature items — rare through mythic ---

const signatureEquipment: Record<string, EquipmentDefinition> = {
  // --- Weapons ---
  battlewornGreatsword: {
    id: 'battlewornGreatsword',
    name: 'Battleworn Greatsword',
    slot: 'weapon',
    rarity: 'rare',
    statGrants: { attack: 20 },
  },
  duelistsRapier: {
    id: 'duelistsRapier',
    name: "Duelist's Rapier",
    slot: 'weapon',
    rarity: 'rare',
    statGrants: { attack: 10, speed: 10 },
  },
  sagesTome: {
    id: 'sagesTome',
    name: "Sage's Tome",
    slot: 'weapon',
    rarity: 'rare',
    statGrants: { intelligence: 15, wisdom: 5 },
  },
  arcaneFocus: {
    id: 'arcaneFocus',
    name: 'Arcane Focus',
    slot: 'weapon',
    rarity: 'epic',
    statGrants: { intelligence: 20 },
    grantsStatusIds: [{ statusId: 'ArcaneForce', magnitude: 10 }],
  },
  // -10 Defense refunds 10 points; how much a downside may buy is an open question (docs/progression.md).
  berserkersCleaver: {
    id: 'berserkersCleaver',
    name: "Berserker's Cleaver",
    slot: 'weapon',
    rarity: 'epic',
    statGrants: { attack: 40, defense: -10 },
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
  tempestRod: {
    id: 'tempestRod',
    name: 'Tempest Rod',
    slot: 'weapon',
    rarity: 'legendary',
    statGrants: { intelligence: 20 },
    grantsPassiveIds: ['stormcallersFocus'],
  },
  rimeCleaver: {
    id: 'rimeCleaver',
    name: 'Rime Cleaver',
    slot: 'weapon',
    rarity: 'legendary',
    statGrants: { attack: 20 },
    grantsPassiveIds: ['frostbrand'],
  },
  worldbreaker: {
    id: 'worldbreaker',
    name: 'Worldbreaker',
    slot: 'weapon',
    rarity: 'mythic',
    statGrants: { attack: 30, hp: 40 },
  },
  archonsStaff: {
    id: 'archonsStaff',
    name: "Archon's Staff",
    slot: 'weapon',
    rarity: 'mythic',
    statGrants: { intelligence: 30, manaPool: 40 },
  },
  duskreaverScythe: {
    id: 'duskreaverScythe',
    name: 'Duskreaver Scythe',
    slot: 'weapon',
    rarity: 'mythic',
    statGrants: { attack: 25, speed: 5 },
    grantsPassiveIds: ['shadowfang'],
  },

  // --- Armor ---
  oakenArmor: {
    id: 'oakenArmor',
    name: 'Oaken Armor',
    slot: 'armor',
    rarity: 'rare',
    statGrants: { hp: 20, defense: 10 },
  },
  templarsBreastplate: {
    id: 'templarsBreastplate',
    name: "Templar's Breastplate",
    slot: 'armor',
    rarity: 'rare',
    statGrants: { hp: 20, defense: 10 },
  },
  mysticsRobe: {
    id: 'mysticsRobe',
    name: "Mystic's Robe",
    slot: 'armor',
    rarity: 'rare',
    statGrants: { wisdom: 15, manaPool: 10 },
  },
  bulwarkOfTheVanguard: {
    id: 'bulwarkOfTheVanguard',
    name: 'Bulwark of the Vanguard',
    slot: 'armor',
    rarity: 'epic',
    statGrants: { hp: 30, defense: 15 },
  },
  runewardCuirass: {
    id: 'runewardCuirass',
    name: 'Runeward Cuirass',
    slot: 'armor',
    rarity: 'epic',
    statGrants: { wisdom: 20, manaPool: 20 },
  },
  phoenixMail: {
    id: 'phoenixMail',
    name: 'Phoenix Mail',
    slot: 'armor',
    rarity: 'legendary',
    statGrants: { hp: 50 },
    grantsPassiveIds: ['wardensVigil'],
  },
  dreadnoughtChassis: {
    id: 'dreadnoughtChassis',
    name: 'Dreadnought Chassis',
    slot: 'armor',
    rarity: 'legendary',
    statGrants: { hp: 40, defense: 20 },
  },
  guardianPlate: {
    id: 'guardianPlate',
    name: 'Guardian Plate',
    slot: 'armor',
    rarity: 'mythic',
    statGrants: { hp: 40, defense: 30 },
  },
  aegisEternal: {
    id: 'aegisEternal',
    name: 'Aegis Eternal',
    slot: 'armor',
    rarity: 'mythic',
    statGrants: { hp: 40, defense: 20, wisdom: 10 },
  },
  mantleOfTheArchmage: {
    id: 'mantleOfTheArchmage',
    name: 'Mantle of the Archmage',
    slot: 'armor',
    rarity: 'mythic',
    statGrants: { wisdom: 25, intelligence: 15, manaPool: 20 },
  },

  // --- Accessories ---
  swiftBoots: {
    id: 'swiftBoots',
    name: 'Swift Boots',
    slot: 'accessory',
    rarity: 'rare',
    statGrants: { speed: 20 },
  },
  // FireForce magnitude 10 is pinned by test/elementalForce.test.ts.
  emberBand: {
    id: 'emberBand',
    name: 'Ember Band',
    slot: 'accessory',
    rarity: 'rare',
    statGrants: { attack: 10 },
    grantsStatusIds: [{ statusId: 'FireForce', magnitude: 10 }],
  },
  huntersInsignia: {
    id: 'huntersInsignia',
    name: "Hunter's Insignia",
    slot: 'accessory',
    rarity: 'rare',
    statGrants: { attack: 10, speed: 10 },
  },
  focusingLens: {
    id: 'focusingLens',
    name: 'Focusing Lens',
    slot: 'accessory',
    rarity: 'rare',
    statGrants: { intelligence: 10, wisdom: 10 },
  },
  stormcallersSigil: {
    id: 'stormcallersSigil',
    name: "Stormcaller's Sigil",
    slot: 'accessory',
    rarity: 'epic',
    statGrants: { speed: 10 },
    grantsPassiveIds: ['stormcallersFocus'],
  },
  frostboundLocket: {
    id: 'frostboundLocket',
    name: 'Frostbound Locket',
    slot: 'accessory',
    rarity: 'epic',
    statGrants: { wisdom: 10 },
    grantsPassiveIds: ['frostbrand'],
  },
  shroudOfShadows: {
    id: 'shroudOfShadows',
    name: 'Shroud of Shadows',
    slot: 'accessory',
    rarity: 'epic',
    statGrants: { speed: 10 },
    grantsPassiveIds: ['shadowfang'],
  },
  sanguineTorc: {
    id: 'sanguineTorc',
    name: 'Sanguine Torc',
    slot: 'accessory',
    rarity: 'epic',
    statGrants: { attack: 10 },
    grantsPassiveIds: ['sanguine'],
  },
  emberheartIdol: {
    id: 'emberheartIdol',
    name: 'Emberheart Idol',
    slot: 'accessory',
    rarity: 'epic',
    statGrants: { hp: 20 },
    grantsPassiveIds: ['emberheart'],
  },
  // MP Regen is triple price, so +10 alone is 30 points — it cannot appear below legendary.
  vitalCharm: {
    id: 'vitalCharm',
    name: 'Vital Charm',
    slot: 'accessory',
    rarity: 'legendary',
    statGrants: { manaPool: 20, mpRegen: 10 },
  },
  ringOfVitality: {
    id: 'ringOfVitality',
    name: 'Ring of Vitality',
    slot: 'accessory',
    rarity: 'legendary',
    statGrants: { hp: 20, mpRegen: 10 },
  },
  wellspringDiadem: {
    id: 'wellspringDiadem',
    name: 'Wellspring Diadem',
    slot: 'accessory',
    rarity: 'legendary',
    statGrants: { manaPool: 40, mpRegen: 5, wisdom: 5 },
  },
  crownOfTheAncients: {
    id: 'crownOfTheAncients',
    name: 'Crown of the Ancients',
    slot: 'accessory',
    rarity: 'mythic',
    statGrants: { hp: 20, attack: 10, defense: 10, intelligence: 10, wisdom: 10 },
  },
  titansTotem: {
    id: 'titansTotem',
    name: "Titan's Totem",
    slot: 'accessory',
    rarity: 'mythic',
    statGrants: { hp: 60, defense: 10, wisdom: 10 },
  },
};

export const equipment: Record<string, EquipmentDefinition> = {
  ...commonWeapons,
  ...commonArmor,
  ...commonAccessories,
  ...generatedTypeEquipment,
  ...signatureEquipment,
};
