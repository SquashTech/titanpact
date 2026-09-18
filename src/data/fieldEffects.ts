// Field Effects (docs/field-effects.md): one global battlefield state at a time, flat 5 rounds.
// The engine reads the flags generically; `flavorType` is presentational only.
// Ids predate the display names (surgingMagic = Magical Surge, stasisBubble = Stasis Field).

import type { FieldEffectDefinition } from '../engine/content';

/** Withering Gaze's share a round: five rounds unanswered is a quarter of a hero. The dial the sim reads first — a tenth measured as the Eyes phase's whole margin (docs/titan-eyes.md §10.3). */
export const WITHERING_GAZE_FRACTION = 0.05;

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
    description: 'Burn keeps three quarters of its value each round instead of half.',
    flavorType: 'Fire',
    slowsStatusDecay: { statusIds: ['Burn'], retain: 0.75 },
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
    description: 'Heroes have bonus Attack and Intelligence equal to their current Renew value.',
    flavorType: 'Nature',
    statBonusEqualToStatusMagnitude: { statusId: 'Renew', stats: ['attack', 'intelligence'] },
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
