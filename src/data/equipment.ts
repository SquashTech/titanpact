// Equipment content.
//
// Every item here spends its rarity's POINT BUDGET exactly — common 10, rare
// 20, epic 30, legendary 40, mythic 50 (src/run/equipment.ts RARITY_BUDGET,
// user direction 2026-08-30). Stats, Elemental Force magnitudes and granted
// passives all convert into the same points (STAT_POINT_VALUE,
// FORCE_POINT_VALUE, PASSIVE_ITEM_COST), and test/equipment.test.ts asserts
// the whole catalog against it, so an item that comes in under- or
// over-curve is a build failure rather than a balance surprise five acts in.
//
// The other half of that direction is the drop curve, which lives entirely in
// src/run/equipment.ts (rarityWeightsFor): legendary/mythic cannot appear in
// Act 1 and commons cannot appear in Act 5, so the catalog below is authored
// for the act each tier actually shows up in.
//
// Four layers, in file order:
//   1. The Act-1 commons — the 12 weapons the designer authored by hand
//      ("Iron Blade / Dagger / Torch / ..."), verbatim, plus armor and
//      accessory kits built in the same idiom: 10 points, usually split 5/5
//      across two things, and freely mixing stats with a type's Elemental
//      Force. That split IS the brief ("these stats should cover more
//      possibilities") — a common weapon is no longer just "10 Attack".
//   2. Generated per-type gear (weapon + armor + accessory for each of the
//      14 non-Ancient types, docs/types-and-heroes.md) — same discipline
//      src/data/statuses.ts uses for Elemental Force: derive 42 items from
//      TYPES rather than hand-duplicating the same 3-slot shape 14 times.
//      Ancient is skipped — no hero is Ancient-typed (it's reserved for the
//      Guardian fights), so that gear would be unusable by any player. This
//      layer is rare-and-up only; Act 1's shelf is hand-curated in layer 1.
//   3. Hand-authored signature items spanning all 3 slots and rare through
//      mythic, including the ones wired to equipment-flavored passives
//      (src/data/passives.ts) — CLAUDE.md "Equipment and relics use the same
//      hook-and-condition system as abilities."
//   4. Nothing — but note that six ids are load-bearing for tests and App.tsx
//      (ironBlade must stay common/cheap, guardianPlate mythic/expensive,
//      dagger the Goblin Skulker's starter weapon, emberBand's FireForce
//      magnitude 10, plus arcaneFocus/oakenArmor/swiftBoots/vitalCharm).
//      Their ids and rarities are pinned; their numbers were re-budgeted.

import type { EquipmentDefinition } from '../run/equipment';
import { RARITY_BUDGET, type EquipmentRarity } from '../run/equipment';
import { TYPES, type TitanpactType } from './typechart';

// ---------------------------------------------------------------------------
// 1. Act-1 commons — 10 points each
// ---------------------------------------------------------------------------

/**
 * The designer's authored common weapons, transcribed exactly (2026-08-30).
 * Read them as the worked example for the whole tier: 10 points, spent as one
 * 10 or as two 5s, and the second 5 is allowed to be ANY stat or a type's
 * Elemental Force. Torch (5 Attack / 5 Fire Force) is what pins
 * FORCE_POINT_VALUE at 1.
 */
const commonWeapons: Record<string, EquipmentDefinition> = {
  ironBlade: {
    id: 'ironBlade',
    name: 'Iron Blade',
    slot: 'weapon',
    rarity: 'common',
    statGrants: { attack: 10 },
  },
  // Also the Goblin Skulker's starter weapon — see App.tsx equipTestDagger,
  // which arms it in the run's opening battle so the equip-slot inspect UI
  // has a real item to show.
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

/** The armor half of the Act-1 shelf, built to the same 10-point rule. HP appears in 10s and 20s rather than 5s because it is priced at half (STAT_POINT_VALUE) — 20 HP and 10 Defense cost the same. */
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

/** The accessory half of the Act-1 shelf. Mana appears in 20s for the same reason HP appears in 10s and 20s — half price, so 20 Mana costs a common's other 5 points. MP Regen is absent from the whole tier: at triple price the cheapest legal grant (+5) would eat 15 of a 10-point budget. */
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

// ---------------------------------------------------------------------------
// 2. Generated per-type gear — 14 types x 3 slots
// ---------------------------------------------------------------------------

/** The tiers generated gear is allowed to roll on. Common is excluded on purpose: Act 1 is the only act that sees commons in quantity (rarityWeightsFor), and its shelf is the hand-authored kit in layer 1 rather than 42 machine-shaped pieces. */
const GENERATED_TIERS: readonly EquipmentRarity[] = ['rare', 'epic', 'legendary', 'mythic'];

interface TypeGearFlavor {
  /** Physical types grant Attack (weapon) / Defense (armor); magical types grant Intelligence (weapon) / Wisdom (armor) — CLAUDE.md's physical/magical pair split. */
  kind: 'attack' | 'intelligence';
  /** The non-Force half of this type's accessory. Rotated across the roster so the 14 accessories aren't one shape repainted — Fire runs fast, Water runs deep, Frost runs thick. `mpRegen` is deliberately absent: at triple price it cannot split a budget evenly. */
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
 * Generated per-type gear: 14 types x 3 slots = 42 items. Rarity is staggered
 * per slot (offsets of 0/1/2 through GENERATED_TIERS) so a single type's
 * weapon/armor/accessory never all land on the same tier — a Fire player
 * should have to hunt across acts to complete the set, not find it all at
 * once.
 *
 * Each shape spends its whole budget B, split in half by point value:
 *   - weapon:    B/2 of the offensive stat + B/2 of the type's Force. The
 *     Force half is what makes these build-arounds rather than stat sticks,
 *     and it stacks additively with the accessory's (run/statusGrants.ts), so
 *     a matched weapon + accessory is a deliberate payoff, not an oversight.
 *   - armor:     B HP (half price = B/2 points) + B/2 of the defensive stat.
 *   - accessory: B/2 of the type's Force + the flavor stat, sized by its own
 *     point value so the halves cost the same.
 */
const generatedTypeEquipment: Record<string, EquipmentDefinition> = {};
TYPES.filter((type) => type !== 'Ancient').forEach((type, i) => {
  const gear = TYPE_GEAR[type];
  const weaponRarity = GENERATED_TIERS[i % GENERATED_TIERS.length];
  const armorRarity = GENERATED_TIERS[(i + 1) % GENERATED_TIERS.length];
  const accessoryRarity = GENERATED_TIERS[(i + 2) % GENERATED_TIERS.length];

  const weaponId = `${lowerFirst(type)}Weapon`;
  const weaponBudget = RARITY_BUDGET[weaponRarity];
  generatedTypeEquipment[weaponId] = {
    id: weaponId,
    name: gear.weaponName,
    slot: 'weapon',
    rarity: weaponRarity,
    statGrants: { [gear.kind]: weaponBudget / 2 },
    grantsStatusIds: [{ statusId: `${type}Force`, magnitude: weaponBudget / 2 }],
  };

  const armorId = `${lowerFirst(type)}Armor`;
  const armorBudget = RARITY_BUDGET[armorRarity];
  generatedTypeEquipment[armorId] = {
    id: armorId,
    name: gear.armorName,
    slot: 'armor',
    rarity: armorRarity,
    statGrants: { hp: armorBudget, [gear.kind === 'attack' ? 'defense' : 'wisdom']: armorBudget / 2 },
  };

  const accessoryId = `${lowerFirst(type)}Charm`;
  const accessoryBudget = RARITY_BUDGET[accessoryRarity];
  // speed is priced 1:1, hp and manaPool at half — so the same half-budget
  // buys twice as much of the latter two. Deriving the amount from the point
  // table rather than authoring it keeps the two halves equal by construction.
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

// ---------------------------------------------------------------------------
// 3. Signature items — rare through mythic
// ---------------------------------------------------------------------------

/** Hand-authored signature items. These are where the budget gets spent in shapes the generator can't produce: a drawback funding a spike (Berserker's Cleaver), a passive eating two thirds of a tier (Bloodletter Fang), and the wide five-stat mythics. */
const signatureEquipment: Record<string, EquipmentDefinition> = {
  // --- Weapons -----------------------------------------------------------
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
  // The drawback item. -10 Defense refunds 10 points, which is what pays for
  // an Attack line a full tier above its rarity — see the open question in
  // docs/progression.md about capping how much of a budget a downside may buy.
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

  // --- Armor -------------------------------------------------------------
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

  // --- Accessories -------------------------------------------------------
  swiftBoots: {
    id: 'swiftBoots',
    name: 'Swift Boots',
    slot: 'accessory',
    rarity: 'rare',
    statGrants: { speed: 20 },
  },
  // FireForce magnitude 10 is pinned by test/elementalForce.test.ts; the
  // Attack line is what brings the item up to its rare budget.
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
  // The two MP Regen items in the catalog, both legendary — at triple price
  // (STAT_POINT_VALUE) +10 MP Regen alone is 30 of a 40-point budget, so the
  // stat cannot appear below this tier without swallowing the whole item.
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
