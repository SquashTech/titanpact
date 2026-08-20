// ⚠️ TEST FIXTURE CONTENT — two passives sufficient to exercise both
// PassiveDefinition effect shapes end to end (engine/combat/passiveEngine.ts):
// Sanguine proves the reactive family (granted by Lucius's Evolution, see
// src/data/progression.ts), Emberheart proves the damage-modifier family
// (granted by a relic, see src/data/relics.ts). Not authored balance content.

import type { PassiveDefinition } from '../engine/content';

export const passives: Record<string, PassiveDefinition> = {
  sanguine: {
    id: 'sanguine',
    name: 'Sanguine',
    description: 'Whenever an enemy takes Bleed damage, this hero heals for the same amount.',
    reactive: {
      hook: 'StatusTicked',
      condition: { relativeTo: 'enemy', eventFieldEquals: { statusId: 'Bleed', kind: 'damage' } },
      effect: { kind: 'heal', target: 'self', amount: { kind: 'matchTriggerAmount' } },
    },
  },
  emberheart: {
    id: 'emberheart',
    name: 'Emberheart',
    description: 'Deals 20% bonus damage with Fire-type moves.',
    damageModifier: { eventFieldEquals: { moveType: 'Fire' }, amount: 0.2 },
  },
};
