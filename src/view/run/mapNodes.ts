// What a map node LOOKS like: its name, its colour, what it pays, and how much weight it carries.
// Shared by the route the player picks from (MapRoute) and the screen around it (MapScreen).

import type { MapNodeType } from '../../run/map';

// Name carries recruitability (Monsters vs Skirmish); NODE_COLORS carries
// difficulty. The two channels are deliberately not redundant.
export const NODE_NAMES: Record<MapNodeType, string> = {
  fight: 'Monsters',
  skirmish: 'Skirmish',
  battle: 'Monsters',
  elite: 'Skirmish',
  boss: 'Guardian',
  shop: 'Guild Hall',
  blacksmith: 'Blacksmith',
  equipmentReward: 'Item',
  gemReward: 'Gem',
  passiveReward: 'Boon',
  currencyReward: 'Gold',
  upgradeReward: 'XP',
  forgeReward: 'Forge',
  hpBoostReward: 'Vitality',
  manaBoostReward: 'Mana',
  classReward: 'Mentor',
  tutorReward: 'Tutor',
  event: 'Event',
  muster: 'The Vigil',
  finale: 'Endbringer',
};

// Stat-reward colours match StatBars' STAT_COLORS. `battle` stays `--ally`,
// not `--enemy`: two reds a shade apart on the Elite-or-Battle row was illegible.
export const NODE_COLORS: Record<MapNodeType, string> = {
  fight: 'var(--enemy)',
  skirmish: 'var(--ally)',
  battle: 'var(--ally)',
  elite: 'var(--crit)',
  boss: 'var(--accent)',
  shop: 'var(--mana)',
  // A burnt copper beside the Forge's orange: same family (both are about what a hero can
  // carry), different silhouette tier, so they read as related rather than as each other.
  blacksmith: '#c67a4c',
  equipmentReward: 'var(--physical)',
  // A rose nothing else on the map wears: a Gem can be any stat, so it cannot borrow one stat's colour.
  gemReward: '#d9569b',
  // Arcane violet, the hue the whole passive vocabulary already sits on (passiveIcons' fallback).
  passiveReward: 'var(--magical)',
  currencyReward: 'var(--accent)',
  upgradeReward: 'var(--hp-high)',
  // Forge orange: the only node that hands out a permanent SLOT rather than a thing to put in one.
  forgeReward: '#f0913c',
  hpBoostReward: 'var(--hp-high)',
  manaBoostReward: 'var(--mana)',
  classReward: 'var(--buff)',
  // The only cyan on the map — the Tutor is rare enough that it should never be mistaken at a
  // glance for the Mana Well beside it.
  tutorReward: '#48c9e8',
  event: 'var(--tier-common)',
  muster: 'var(--accent)',
  // The only node in a run that wears the mythic red, because there is only one of it.
  finale: 'var(--tier-mythic)',
};

// The line under a choice card's name: what the node pays out, and nothing else. Difficulty
// rides on NODE_COLORS, recruitability on NODE_NAMES.
const NODE_DESCRIPTIONS: Record<MapNodeType, string> = {
  fight: '15–25g · 2 XP · item',
  skirmish: '15–25g · 4 XP · 25% item · recruitable',
  battle: '30–45g · 3 XP · item',
  elite: '15–25g · 4 XP · 55% elite item · recruitable — enemies carry +10 to 2 stats',
  boss: '4 XP · 70% elite item · 1 Recruit Contract',
  shop: 'Buy heroes, contracts and gear — and sell what you are not carrying',
  blacksmith: 'Buy an item slot, a tier at the Anvil, or an element at the Enchanter — acts 3+',
  equipmentReward: '1 of 3 items',
  gemReward: '1 of 3 Gems, 4 of them — poured into whichever heroes you like',
  passiveReward: '1 of 3 Boons, granted to one hero for the rest of the run',
  currencyReward: '15–30g',
  upgradeReward: '2 XP',
  forgeReward: '+1 item slot to one hero, for the rest of the run',
  hpBoostReward: '+20 max HP to one hero',
  manaBoostReward: 'Sapphire ×4 — +5 Mana Pool apiece, on whoever you pour them into',
  classReward: '1 of 3 Classes, taught to one hero',
  tutorReward: 'One hero learns ANY move from its level-up pool — acts 4 and 5 only',
  event: 'Hidden until you arrive: a move, a passive, gear or a trade',
  muster: 'Fill the roster to six, then spend everything left',
  finale: 'The five seals you broke — then the thing they were holding',
};

// Every Guardian pays a Banner now that the finale act follows act 5 (App.tsx).
export function nodeRewardText(type: MapNodeType): string {
  const base = NODE_DESCRIPTIONS[type];
  return type === 'boss' ? `${base} · Guardian’s Banner` : base;
}

// How much weight a choice card carries — the Guardian is not a Gem.
export type NodeTier = 'reward' | 'encounter' | 'landmark' | 'ancient';

export const NODE_TIERS: Record<MapNodeType, NodeTier> = {
  fight: 'encounter',
  skirmish: 'encounter',
  battle: 'encounter',
  elite: 'encounter',
  boss: 'ancient',
  shop: 'landmark',
  blacksmith: 'landmark',
  equipmentReward: 'reward',
  gemReward: 'reward',
  passiveReward: 'reward',
  currencyReward: 'reward',
  upgradeReward: 'reward',
  forgeReward: 'reward',
  hpBoostReward: 'reward',
  manaBoostReward: 'reward',
  classReward: 'reward',
  tutorReward: 'reward',
  event: 'reward',
  muster: 'landmark',
  finale: 'ancient',
};
