// Relics (CLAUDE.md "Relics are team-wide passives", docs/progression.md
// "Relics (team-wide)"): a separate progression axis from per-hero equipment,
// applying flat/passive/status grants to the whole side rather than a slot
// (src/run/relics.ts RelicDefinition). This is now a real, sizeable catalog —
// quantity for run variety per designer request (2026-08-23), values are
// still provisional and expected to be tuned later.
//
// The first 8 (ironStandard through cinderStandard) are the original set —
// ironStandard/warHorn/sagesLantern/windcallersBanner/deepWellstone/
// bulwarkCore exercise plain statGrants end to end, emberheart exercises
// grantsPassiveIds (src/run/passives.ts), cinderStandard exercises
// grantsStatusIds (src/run/statusGrants.ts, Elemental Force). Everything
// after reuses those same three grant shapes — no new engine vocabulary —
// to cover: a second, stronger tier of single-stat relics; two-stat combo
// relics; mana/tempo specialists; one Elemental Force relic per type (15
// types total, TYPES in typechart.ts); and relics granting each existing
// reactive/damage-modifier passive (src/data/passives.ts) team-wide.

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

// Second, stronger tier of the same single-stat pattern above.
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

// Two-stat combo relics — each pairs two stats into a small build identity.
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

// Small all-rounder / utility relics that don't fit the single- or two-stat pattern.
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

// One Elemental Force relic per type (statuses.ts elementalForceStatus,
// generated from TYPES) — cinderStandard above already covers Fire, so this
// fills in the remaining 14. Each grants `${Type}Force` magnitude 10 team-wide
// (flat +10 Base Power to that type's moves), same shape as cinderStandard.
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
  Ancient: { id: 'ruinStandard', name: 'Ruin Standard' },
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

// One relic per existing reactive/damage-modifier passive (src/data/passives.ts)
// besides emberheart above, so each of those passives has a relic path onto
// the team, not just equipment.
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


// The Guardian's Banner (docs/run-loop.md): the fixed 1-of-3 handed out after
// every Guardian win in acts 1-4. Deliberately the same three every time and
// deliberately stackable — a player who wants one axis can take it four times
// (a 4-stack Banner of Vitality is +120 HP on every hero, present and future),
// and RelicsOverlay folds duplicates into one card ("Banner of Vitality +3").
// `guardianBanner` keeps all three out of the random pools (drawableRelics
// below), so they are never a Shrine or Guild Hall offer.
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
    description: 'Team-wide +20 Mana pool.',
    statGrants: { manaPool: 20 },
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

export const relics: Record<string, RelicDefinition> = {
  ...originalRelics,
  ...singleStatRelics,
  ...comboStatRelics,
  ...utilityStatRelics,
  ...elementalForceRelics,
  ...passiveRelics,
  ...guardianBanners,
};

/** The three fixed Banners, in the order the post-Guardian screen offers them (App.tsx GuardianBannerScreen). */
export const guardianBannerRelics: RelicDefinition[] = Object.values(guardianBanners);

/**
 * Every relic a random offer may draw — the catalog minus the Guardian
 * Banners. Both random sources use it (the Relic Shrine's 1-of-3 and the
 * Guild Hall's rotating stock); the banners reach the player only through the
 * post-Guardian choice, which is what keeps that choice the same three every
 * act.
 */
export const drawableRelics: RelicDefinition[] = Object.values(relics).filter((relic) => !relic.guardianBanner);
