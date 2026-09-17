// What a map node LOOKS like: its name, its colour, and how much weight it carries. What it PAYS
// is nodeFacts.ts, read off the run constants.
// Shared by the route the player picks from (MapRoute) and the screen around it (MapScreen).

import type { MapNodeType } from '../../run/map';

// Name carries recruitability (Titanspawn vs Skirmish); NODE_COLORS carries
// difficulty. The two channels are deliberately not redundant.
export const NODE_NAMES: Record<MapNodeType, string> = {
  fight: 'Titanspawn',
  skirmish: 'Skirmish',
  battle: 'Titanspawn',
  elite: 'Skirmish',
  boss: 'Guardian',
  shop: 'Guild Hall',
  equipmentReward: 'Item',
  scrollReward: 'Scroll Cache',
  passiveReward: 'Boon',
  currencyReward: 'Gold',
  manaWellReward: 'Mana Well',
  forgeReward: 'Forge',
  leyLineReward: 'Ley Line',
  restReward: 'Rest',
  mentorReward: 'Mentor',
  tutorReward: 'Tutor',
  scribeReward: 'Scribe',
  event: 'Event',
  muster: 'The Vigil',
  finale: 'Endbringer',
  titan: 'The Titan',
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
  equipmentReward: 'var(--physical)',
  // The Scribe's parchment: the two Scroll nodes are one currency, and the count on the glyph tells them apart.
  scrollReward: '#e0c27a',
  // Arcane violet, the hue the whole passive vocabulary already sits on (passiveIcons' fallback).
  passiveReward: 'var(--magical)',
  currencyReward: 'var(--accent)',
  // The MP gauge's own blue (RunGlyph RESOURCE_COLORS mpPotion): a Mana Well reads as the bar it deepens.
  manaWellReward: '#8fb4ff',
  // The HP bar's own green: a Rest reads as the bar it refills.
  restReward: 'var(--hp-high)',
  // The Guild Hall's hearth amber: the Forge is the Smithy's Anvil, out on the road and free.
  forgeReward: '#ec9640',
  // Ember red, the Force chip's family colour (statusIcons FORCE): the Ley Line grants that chip.
  leyLineReward: '#e8643c',
  // Forge orange: the only node that hands out a permanent SLOT rather than a thing to put in one.
  mentorReward: 'var(--buff)',
  // The only cyan on the map — the Tutor is rare enough that it should never be mistaken at a
  // glance for the Mana Well beside it.
  tutorReward: '#48c9e8',
  // Parchment: the only warm neutral on the map, so the Scroll's row reads as its own thing
  // beside the Mentor's green book and the Forge's orange.
  scribeReward: '#e0c27a',
  event: 'var(--tier-common)',
  muster: 'var(--accent)',
  // The two nodes in a run that wear the mythic red: the Herald, and what looks down after it.
  finale: 'var(--tier-mythic)',
  titan: 'var(--tier-mythic)',
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
  equipmentReward: 'reward',
  scrollReward: 'reward',
  passiveReward: 'reward',
  currencyReward: 'reward',
  manaWellReward: 'reward',
  forgeReward: 'reward',
  leyLineReward: 'reward',
  restReward: 'reward',
  mentorReward: 'reward',
  tutorReward: 'reward',
  scribeReward: 'reward',
  event: 'reward',
  muster: 'landmark',
  finale: 'ancient',
  titan: 'ancient',
};
