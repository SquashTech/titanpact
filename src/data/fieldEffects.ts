// Field Effects (docs/field-effects.md): a single global battlefield state,
// one active at a time, lasting a flat 5 rounds regardless of which one it is
// (engine/combat/fieldEffectEngine.ts FIELD_EFFECT_DURATION_ROUNDS). The
// engine reads FieldEffectDefinition flags generically (fieldEffectEngine.ts,
// engine/combat/manaRegen.ts, statusEngine.ts, combat/priority.ts, state.ts)
// rather than special-casing each effect by name — same discipline as
// statuses/passives. Every effect here is global (both sides), even though
// each is flavored around one type (`flavorType`, presentational only — the
// view layer's badge/glow color, engine never reads it).
//
// Surging Magic is the first: it resolves docs/mana.md's former "weather
// subsystem" open question (Field Effects IS that subsystem, generalized —
// 2026-08-21 designer sign-off). Set by the Arcane move `arcaneSurge`
// (src/data/moves.ts) — mainly an Arcane-flavored effect, but per its
// mpRegenMultiplier it benefits every hero on the field, both sides alike.
//
// Scorched Land / Stasis Bubble / Sanctuary / Verdant Earth (2026-08-21) are
// the second batch, one per new FieldEffectDefinition shape — each sets from
// its own dedicated move (moves.ts "Field Effect moves").
//
// Each setter is tied to its type's starter, but as a LEVEL-UP unlock, not a
// starting move (2026-08-26): every one of them costs 20 mana, which made it
// the outlier in a kit otherwise built from a cheap main-type move and one
// or two supports, and it was the 4th slot in a hero that had one — the
// thing that stopped starting kits being uniform three across the draft
// screen. So the attachment lives in src/data/progression.ts moveTiers now
// (crimson→spreadingBlaze, wildOracle→overgrowth, dawnwarden→consecrate,
// runescribe→arcaneSurge, mindweaver→stasisField), and each effect is
// something a run grows into rather than opens with.

import type { FieldEffectDefinition } from '../engine/content';

export const fieldEffects: Record<string, FieldEffectDefinition> = {
  surgingMagic: {
    id: 'surgingMagic',
    name: 'Surging Magic',
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
    name: 'Stasis Bubble',
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
