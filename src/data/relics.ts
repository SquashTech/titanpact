// Relics: team-wide passives (docs/progression.md "Relics (team-wide)"), built from the three
// grant shapes statGrants / grantsPassiveIds / grantsStatusIds. Values are provisional.

import type { StatKey } from '../engine/content';
import type { RelicDefinition } from '../run/relics';
import { TYPES } from './typechart';

const originalRelics: Record<string, RelicDefinition> = {
  ironStandard: {
    id: 'ironStandard',
    name: 'Iron Standard',
    description: 'Team-wide +10 Defense.',
    statGrants: { defense: 10 },
  },
  warHorn: {
    id: 'warHorn',
    name: 'War Horn',
    description: 'Team-wide +10 Attack.',
    statGrants: { attack: 10 },
  },
  sagesLantern: {
    id: 'sagesLantern',
    name: "Sage's Lantern",
    description: 'Team-wide +10 Intelligence, +10 Wisdom.',
    statGrants: { intelligence: 10, wisdom: 10 },
  },
  windcallersBanner: {
    id: 'windcallersBanner',
    name: "Windcaller's Banner",
    description: 'Team-wide +10 Speed.',
    statGrants: { speed: 10 },
  },
  deepWellstone: {
    id: 'deepWellstone',
    name: 'Deep Wellstone',
    description: 'Team-wide +20 Mana pool, +5 MP Regen.',
    statGrants: { manaPool: 20, mpRegen: 5 },
  },
  bulwarkCore: {
    id: 'bulwarkCore',
    name: 'Bulwark Core',
    description: 'Team-wide +20 HP.',
    statGrants: { hp: 20 },
  },
  emberheart: {
    id: 'emberheart',
    name: 'Emberheart',
    description: 'Team-wide: grants the Emberheart passive (+20% bonus damage with Fire-type moves).',
    statGrants: {},
    grantsPassiveIds: ['emberheart'],
  },
  cinderStandard: {
    id: 'cinderStandard',
    name: 'Cinder Standard',
    description: 'Team-wide: grants Fire Force 10 (+10 Base Power to Fire moves) to every combatant.',
    statGrants: {},
    grantsStatusIds: [{ statusId: 'FireForce', magnitude: 10 }],
  },
};

// --- Single-stat, stronger tier ---
const singleStatRelics: Record<string, RelicDefinition> = {
  titansBulwark: {
    id: 'titansBulwark',
    name: "Titan's Bulwark",
    description: 'Team-wide +20 Defense.',
    statGrants: { defense: 20 },
  },
  berserkersHorn: {
    id: 'berserkersHorn',
    name: "Berserker's Horn",
    description: 'Team-wide +20 Attack.',
    statGrants: { attack: 20 },
  },
  archmagesFocus: {
    id: 'archmagesFocus',
    name: "Archmage's Focus",
    description: 'Team-wide +20 Intelligence, +20 Wisdom.',
    statGrants: { intelligence: 20, wisdom: 20 },
  },
  zephyrsCrown: {
    id: 'zephyrsCrown',
    name: "Zephyr's Crown",
    description: 'Team-wide +20 Speed.',
    statGrants: { speed: 20 },
  },
  vitalityCore: {
    id: 'vitalityCore',
    name: 'Vitality Core',
    description: 'Team-wide +40 HP.',
    statGrants: { hp: 40 },
  },
  wellspringHeart: {
    id: 'wellspringHeart',
    name: 'Wellspring Heart',
    description: 'Team-wide +40 Mana pool, +10 MP Regen.',
    statGrants: { manaPool: 40, mpRegen: 10 },
  },
};

// --- Two-stat combos ---
const comboStatRelics: Record<string, RelicDefinition> = {
  duelistsSignet: {
    id: 'duelistsSignet',
    name: "Duelist's Signet",
    description: 'Team-wide +10 Attack, +10 Speed.',
    statGrants: { attack: 10, speed: 10 },
  },
  guardiansAegis: {
    id: 'guardiansAegis',
    name: "Guardian's Aegis",
    description: 'Team-wide +10 Defense, +20 HP.',
    statGrants: { defense: 10, hp: 20 },
  },
  battlemagesCrest: {
    id: 'battlemagesCrest',
    name: "Battlemage's Crest",
    description: 'Team-wide +10 Attack, +10 Intelligence.',
    statGrants: { attack: 10, intelligence: 10 },
  },
  sentinelsRing: {
    id: 'sentinelsRing',
    name: "Sentinel's Ring",
    description: 'Team-wide +10 Defense, +10 Wisdom.',
    statGrants: { defense: 10, wisdom: 10 },
  },
  swiftWardCharm: {
    id: 'swiftWardCharm',
    name: 'Swift Ward Charm',
    description: 'Team-wide +10 Speed, +10 Wisdom.',
    statGrants: { speed: 10, wisdom: 10 },
  },
  vanguardPlate: {
    id: 'vanguardPlate',
    name: 'Vanguard Plate',
    description: 'Team-wide +20 HP, +10 Attack.',
    statGrants: { hp: 20, attack: 10 },
  },
  arcaneBulwark: {
    id: 'arcaneBulwark',
    name: 'Arcane Bulwark',
    description: 'Team-wide +10 Intelligence, +10 Defense.',
    statGrants: { intelligence: 10, defense: 10 },
  },
  skirmishersKit: {
    id: 'skirmishersKit',
    name: "Skirmisher's Kit",
    description: 'Team-wide +10 Attack, +10 Defense.',
    statGrants: { attack: 10, defense: 10 },
  },
  stormrunnersCirclet: {
    id: 'stormrunnersCirclet',
    name: "Stormrunner's Circlet",
    description: 'Team-wide +10 Speed, +10 Intelligence.',
    statGrants: { speed: 10, intelligence: 10 },
  },
  stoneheartIdol: {
    id: 'stoneheartIdol',
    name: 'Stoneheart Idol',
    description: 'Team-wide +20 HP, +10 Wisdom.',
    statGrants: { hp: 20, wisdom: 10 },
  },
  windrunnersFlask: {
    id: 'windrunnersFlask',
    name: "Windrunner's Flask",
    description: 'Team-wide +20 Mana pool, +10 Speed.',
    statGrants: { manaPool: 20, speed: 10 },
  },
  overflowingVessel: {
    id: 'overflowingVessel',
    name: 'Overflowing Vessel',
    description: 'Team-wide +20 HP, +20 Mana pool.',
    statGrants: { hp: 20, manaPool: 20 },
  },
  bloodfireCatalyst: {
    id: 'bloodfireCatalyst',
    name: 'Bloodfire Catalyst',
    description: 'Team-wide +10 Attack, +20 Mana pool.',
    statGrants: { attack: 10, manaPool: 20 },
  },
};

// --- Utility ---
const utilityStatRelics: Record<string, RelicDefinition> = {
  balancedWhetstone: {
    id: 'balancedWhetstone',
    name: 'Balanced Whetstone',
    description: 'Team-wide +5 Attack, +5 Defense, +5 Intelligence, +5 Wisdom, +5 Speed.',
    statGrants: { attack: 5, defense: 5, intelligence: 5, wisdom: 5, speed: 5 },
  },
  ironWillTotem: {
    id: 'ironWillTotem',
    name: "Iron Will Totem",
    description: 'Team-wide +10 HP, +10 Defense, +5 MP Regen.',
    statGrants: { hp: 10, defense: 10, mpRegen: 5 },
  },
  manaFont: {
    id: 'manaFont',
    name: 'Mana Font',
    description: 'Team-wide +15 MP Regen.',
    statGrants: { mpRegen: 15 },
  },
  deepReserveFlask: {
    id: 'deepReserveFlask',
    name: 'Deep Reserve Flask',
    description: 'Team-wide +50 Mana pool.',
    statGrants: { manaPool: 50 },
  },
  temposChalice: {
    id: 'temposChalice',
    name: "Tempo's Chalice",
    description: 'Team-wide +10 Speed, +5 MP Regen.',
    statGrants: { speed: 10, mpRegen: 5 },
  },
};

// --- Elemental Force, one per type (cinderStandard above covers Fire) ---
const elementalForceNames: Partial<Record<(typeof TYPES)[number], { id: string; name: string }>> = {
  Water: { id: 'tideStandard', name: 'Tide Standard' },
  Frost: { id: 'rimeStandard', name: 'Rime Standard' },
  Storm: { id: 'thunderStandard', name: 'Thunder Standard' },
  Stone: { id: 'bedrockStandard', name: 'Bedrock Standard' },
  Nature: { id: 'bloomStandard', name: 'Bloom Standard' },
  Light: { id: 'radiantStandard', name: 'Radiant Standard' },
  Shadow: { id: 'umbralStandard', name: 'Umbral Standard' },
  Arcane: { id: 'arcaneStandard', name: 'Arcane Standard' },
  Mind: { id: 'psionicStandard', name: 'Psionic Standard' },
  Spirit: { id: 'wraithStandard', name: 'Wraith Standard' },
  Iron: { id: 'forgeStandard', name: 'Forge Standard' },
  Mech: { id: 'cogStandard', name: 'Cog Standard' },
  Beast: { id: 'feralStandard', name: 'Feral Standard' },
  // Ancient deliberately has no Standard: no hero is Ancient-typed and no hero can reach
  // an Ancient move, so the relic was a null grant occupying a live offer slot.
};

const elementalForceRelics: Record<string, RelicDefinition> = Object.fromEntries(
  Object.entries(elementalForceNames).map(([type, { id, name }]) => [
    id,
    {
      id,
      name,
      description: `Team-wide: grants ${type} Force 10 (+10 Base Power to ${type} moves) to every combatant.`,
      statGrants: {},
      grantsStatusIds: [{ statusId: `${type}Force`, magnitude: 10 }],
    } satisfies RelicDefinition,
  ])
);

// --- One relic per equipment passive (passives.ts), so each has a team-wide path ---
const passiveRelics: Record<string, RelicDefinition> = {
  vampiricIdol: {
    id: 'vampiricIdol',
    name: 'Vampiric Idol',
    description:
      "Team-wide: grants the Bloodthirst passive (whenever this hero's side deals damage to an enemy, heal for 15% of that damage).",
    statGrants: {},
    grantsPassiveIds: ['bloodthirst'],
  },
  wardensTalisman: {
    id: 'wardensTalisman',
    name: "Warden's Talisman",
    description: "Team-wide: grants the Warden's Vigil passive (whenever this hero takes damage, heal for 10% of that damage).",
    statGrants: {},
    grantsPassiveIds: ['wardensVigil'],
  },
  vengeanceIdol: {
    id: 'vengeanceIdol',
    name: 'Vengeance Idol',
    description: 'Team-wide: grants the Vengeful Emblem passive (whenever this hero takes damage, gain +5 Attack).',
    statGrants: {},
    grantsPassiveIds: ['vengefulEmblem'],
  },
  stormcallersIdol: {
    id: 'stormcallersIdol',
    name: "Stormcaller's Idol",
    description: "Team-wide: grants the Stormcaller's Focus passive (+20% bonus damage with Storm-type moves).",
    statGrants: {},
    grantsPassiveIds: ['stormcallersFocus'],
  },
  frostboundIdol: {
    id: 'frostboundIdol',
    name: 'Frostbound Idol',
    description: 'Team-wide: grants the Frostbrand passive (+20% bonus damage with Frost-type moves).',
    statGrants: {},
    grantsPassiveIds: ['frostbrand'],
  },
  shadowfangIdol: {
    id: 'shadowfangIdol',
    name: 'Shadowfang Idol',
    description: 'Team-wide: grants the Shadowfang passive (+20% bonus damage with Shadow-type moves).',
    statGrants: {},
    grantsPassiveIds: ['shadowfang'],
  },
};

// --- Guardian's Banner: the fixed, stackable 1-of-3 after each act 1-4 Guardian (docs/run-loop.md).
// `guardianBanner: true` keeps them out of drawableRelics.
const guardianBanners: Record<string, RelicDefinition> = {
  bannerOfVitality: {
    id: 'bannerOfVitality',
    name: 'Banner of Vitality',
    description: 'Team-wide +30 HP.',
    statGrants: { hp: 30 },
    guardianBanner: true,
  },
  bannerOfTheWellspring: {
    id: 'bannerOfTheWellspring',
    name: 'Banner of the Wellspring',
    // Mana pool alone cannot carry this Banner: batch simulation shows the grant SATURATES —
    // +50, +150 and +300 all measure the same, because a fight ends long before a deeper
    // reserve is ever reached. The Wisdom is what makes it a Banner rather than a dead pick,
    // and it keeps the identity: a wellspring is what a caster draws on, defensively and to heal.
    description: 'Team-wide +40 Mana pool, +20 Wisdom.',
    statGrants: { manaPool: 40, wisdom: 20 },
    guardianBanner: true,
  },
  bannerOfTheEverflow: {
    id: 'bannerOfTheEverflow',
    name: 'Banner of the Everflow',
    description: 'Team-wide +10 MP Regen.',
    statGrants: { mpRegen: 10 },
    guardianBanner: true,
  },
};


// --- Gems: the common, stacking half of the relic axis (docs/run-loop.md "Gems"). One per stat,
// every one a flat +5, handed out often enough that the Relics screen lists all eight from the
// first node — a run is expected to hold several.  keeps them out of drawableRelics:
// they have their own channels (a fight drop, the Gem Cache node, the two stat shrines), and
// letting them into the Shrine pool would only dilute it with the smallest grant in the game.
export const GEM_STAT_GRANT = 5;

/** Stat -> the one Gem that carries it. Ordered by STAT_ORDER, which is the order every Gem surface lists them in. */
const GEM_TABLE: readonly { stat: StatKey; id: string; name: string; label: string }[] = [
  { stat: 'hp', id: 'emeraldGem', name: 'Emerald', label: 'HP' },
  { stat: 'attack', id: 'rubyGem', name: 'Ruby', label: 'Attack' },
  { stat: 'defense', id: 'onyxGem', name: 'Onyx', label: 'Defense' },
  { stat: 'intelligence', id: 'amethystGem', name: 'Amethyst', label: 'Intelligence' },
  { stat: 'wisdom', id: 'aquamarineGem', name: 'Aquamarine', label: 'Wisdom' },
  { stat: 'speed', id: 'citrineGem', name: 'Citrine', label: 'Speed' },
  { stat: 'manaPool', id: 'sapphireGem', name: 'Sapphire', label: 'Mana Pool' },
  { stat: 'mpRegen', id: 'peridotGem', name: 'Peridot', label: 'MP Regen' },
];

const gems: Record<string, RelicDefinition> = Object.fromEntries(
  GEM_TABLE.map(({ stat, id, name, label }) => [
    id,
    {
      id,
      name,
      description: `Team-wide +${GEM_STAT_GRANT} ${label}.`,
      statGrants: { [stat]: GEM_STAT_GRANT },
      gem: true,
    } satisfies RelicDefinition,
  ])
);

export const relics: Record<string, RelicDefinition> = {
  ...originalRelics,
  ...singleStatRelics,
  ...comboStatRelics,
  ...utilityStatRelics,
  ...elementalForceRelics,
  ...passiveRelics,
  ...guardianBanners,
  ...gems,
};

/** The eight Gems in STAT_ORDER — the order every Gem surface lists them in. */
export const gemRelics: RelicDefinition[] = GEM_TABLE.map(({ id }) => gems[id]);

/** The Gem that carries each stat, for the nodes that grant a fixed one rather than offering a choice. */
export const gemForStat: Record<StatKey, RelicDefinition> = Object.fromEntries(
  GEM_TABLE.map(({ stat, id }) => [stat, gems[id]])
) as Record<StatKey, RelicDefinition>;

/** The three fixed Banners, in the order the post-Guardian screen offers them. */
export const guardianBannerRelics: RelicDefinition[] = Object.values(guardianBanners);

/** Every relic a random offer (Shrine, Guild Hall) may draw — the catalog minus the Banners and the Gems. */
export const drawableRelics: RelicDefinition[] = Object.values(relics).filter((relic) => !relic.guardianBanner && !relic.gem);
