// Field Effects (docs/field-effects.md): a single global battlefield state,
// one active at a time, lasting a flat 5 rounds regardless of which one it is
// (engine/combat/fieldEffectEngine.ts FIELD_EFFECT_DURATION_ROUNDS). The
// engine reads FieldEffectDefinition flags generically (fieldEffectEngine.ts,
// engine/combat/manaRegen.ts) rather than special-casing each effect by name —
// same discipline as statuses/passives.
//
// Surging Magic is the first: it resolves docs/mana.md's former "weather
// subsystem" open question (Field Effects IS that subsystem, generalized —
// 2026-08-21 designer sign-off). Set by the Arcane move `arcaneSurge`
// (src/data/moves.ts) — mainly an Arcane-flavored effect, but per its
// mpRegenMultiplier it benefits every hero on the field, both sides alike.

import type { FieldEffectDefinition } from '../engine/content';

export const fieldEffects: Record<string, FieldEffectDefinition> = {
  surgingMagic: {
    id: 'surgingMagic',
    name: 'Surging Magic',
    description: "Doubles every hero's MP Regen while active.",
    mpRegenMultiplier: 2,
  },
};
