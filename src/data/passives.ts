// ⚠️ sanguine/emberheart below are TEST FIXTURE CONTENT — the two passives
// sufficient to exercise both triggered PassiveDefinition effect shapes end
// to end (engine/combat/passiveEngine.ts): Sanguine proves the reactive
// family (granted by Lucius's Evolution, see src/data/progression.ts),
// Emberheart proves the damage-modifier family (granted by a relic, see
// src/data/relics.ts). Not authored balance content.
//
// `passives` below is the FULL catalog every screen imports by this one name
// (EquipmentBox, ReferenceOverlay, HeroDetailOverlay, formatEvent, buildBeats,
// FightScreen, RelicsOverlay, resolveRound's config.passives) — merging in
// the authored Class catalog (src/data/classes.ts) here, rather than
// touching every one of those import sites, keeps a single source of truth.
// A Class IS a Passive (statGrants-only, no trigger) so it needs to resolve
// through this same lookup by id like any other.

import type { PassiveDefinition } from '../engine/content';
import { classes } from './classes';

const fixturePassives: Record<string, PassiveDefinition> = {
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

export const passives: Record<string, PassiveDefinition> = { ...fixturePassives, ...classes };
