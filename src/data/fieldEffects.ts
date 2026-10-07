// Field Effects (docs/field-effects.md): one global battlefield state at a time, flat 5 rounds.
// The engine reads the flags generically; `flavorType` is presentational only.
// Ids predate the display names (surgingMagic = Magical Surge, stasisBubble = Stasis Field).

import type { FieldEffectDefinition } from '../engine/content';

/** Withering Gaze's share a round: five rounds unanswered is a quarter of a hero. The dial the sim reads first — a tenth measured as the Eyes phase's whole margin (docs/titan-eyes.md §10.3). */
export const WITHERING_GAZE_FRACTION = 0.04;

export const fieldEffects: Record<string, FieldEffectDefinition> = {
  surgingMagic: {
    id: 'surgingMagic',
    name: 'Magical Surge',
    description: "Doubles every hero's MP Regen.",
    flavorType: 'Arcane',
    mpRegenMultiplier: 2,
  },
  scorchedLand: {
    id: 'scorchedLand',
    name: 'Scorched Land',
    description: 'Every Burn lands one level higher.',
    flavorType: 'Fire',
    raisesStatusLevel: { statusIds: ['Burn'], by: 1 },
  },
  stasisBubble: {
    id: 'stasisBubble',
    name: 'Stasis Field',
    description: 'Reverse the move order in each priority bracket.',
    flavorType: 'Mind',
    reversesSpeedOrder: true,
  },
  sanctuary: {
    id: 'sanctuary',
    name: 'Sanctuary',
    description: 'Healing moves gain +1 priority and heal half again as much.',
    flavorType: 'Light',
    healPriorityBonus: 1,
    healMultiplier: 1.5,
  },
  verdantEarth: {
    id: 'verdantEarth',
    name: 'Verdant Earth',
    description: 'Renew heals twice as much, and healing past max HP becomes Shield.',
    flavorType: 'Nature',
    amplifiesStatusHealing: { statusIds: ['Renew'], multiplier: 2, overflowToShield: true },
  },
  // docs/status-ladders-and-fields.md §3–5: a field that bends a status, a chart, or a stat read.
  bloodMoon: {
    id: 'bloodMoon',
    name: 'Blood Moon',
    description: 'Bleeding heroes can’t be healed, and a hit on a Bleeding hero heals the attacker a quarter of the damage dealt.',
    flavorType: 'Beast',
    blocksHealingWhile: 'Bleed',
    lifestealAgainst: { statusId: 'Bleed', percent: 0.25 },
  },
  downpour: {
    id: 'downpour',
    name: 'Downpour',
    description: 'Water and Frost attacks are never resisted — they always hit for at least ×1.',
    flavorType: 'Water',
    unresistedTypes: ['Water', 'Frost'],
  },
  bedrock: {
    id: 'bedrock',
    name: 'Bedrock',
    description: 'Physical attacks hit with the higher of the attacker’s Attack and Defense.',
    flavorType: 'Stone',
    physicalSwingsWithDefense: true,
  },
  // The Titan's (docs/titan-eyes.md §10): set by the Eyes, never by a hero — no Herald, no rider,
  // no reader, so it is the one field with a single route. The fraction is the phase's clock and the
  // first-pass dial; the exemption is what makes it the Titan's rather than everyone's.
  witheringGaze: {
    id: 'witheringGaze',
    name: 'Withering Gaze',
    description: `Everyone on the field but the Titan’s own pieces loses ${Math.round(WITHERING_GAZE_FRACTION * 100)}% of their max HP at the end of each round.`,
    flavorType: 'Ancient',
    drainsPercentMaxHp: { fraction: WITHERING_GAZE_FRACTION, exemptTypes: ['Ancient'] },
  },
};
