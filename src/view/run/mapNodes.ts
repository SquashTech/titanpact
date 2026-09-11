// What a map node LOOKS like: its name, its colour, and how much weight it carries. What it PAYS
// is nodeFacts.ts, read off the run constants.
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
  scrollReward: 'Scrolls',
  passiveReward: 'Boon',
  currencyReward: 'Gold',
  loneScrollReward: 'Scroll',
  forgeReward: 'Forge',
  mentorReward: 'Mentor',
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
  // The Scroll's own violet (RunGlyph RESOURCE_COLORS) — one colour per concept, wherever it is drawn.
  scrollReward: '#c9a2ff',
  // Arcane violet, the hue the whole passive vocabulary already sits on (passiveIcons' fallback).
  passiveReward: 'var(--magical)',
  currencyReward: 'var(--accent)',
  loneScrollReward: '#c9a2ff',
  // Forge orange: the only node that hands out a permanent SLOT rather than a thing to put in one.
  forgeReward: '#f0913c',
  mentorReward: 'var(--buff)',
  // The only cyan on the map — the Tutor is rare enough that it should never be mistaken at a
  // glance for the Mana Well beside it.
  tutorReward: '#48c9e8',
  event: 'var(--tier-common)',
  muster: 'var(--accent)',
  // The only node in a run that wears the mythic red, because there is only one of it.
  finale: 'var(--tier-mythic)',
};

// How much weight a choice card carries — the Guardian is not a Boon.
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
  scrollReward: 'reward',
  passiveReward: 'reward',
  currencyReward: 'reward',
  loneScrollReward: 'reward',
  forgeReward: 'reward',
  mentorReward: 'reward',
  tutorReward: 'reward',
  event: 'reward',
  muster: 'landmark',
  finale: 'ancient',
};
