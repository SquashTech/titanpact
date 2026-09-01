// Field Effects (docs/field-effects.md): one global battlefield state at a time, flat 5 rounds.
// The engine reads the flags generically; `flavorType` is presentational only.
// Ids predate the display names (surgingMagic = Magical Surge, stasisBubble = Stasis Field).

import type { FieldEffectDefinition } from '../engine/content';

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
    description: 'Burn no longer decays.',
    flavorType: 'Fire',
    suppressesStatusDecay: ['Burn'],
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
    description: 'Healing moves gain +1 priority.',
    flavorType: 'Light',
    healPriorityBonus: 1,
  },
  verdantEarth: {
    id: 'verdantEarth',
    name: 'Verdant Earth',
    description: 'Heroes have bonus Attack and Intelligence equal to their current Renew value.',
    flavorType: 'Nature',
    statBonusEqualToStatusMagnitude: { statusId: 'Renew', stats: ['attack', 'intelligence'] },
  },
};
