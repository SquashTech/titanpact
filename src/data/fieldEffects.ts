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
// Magical Surge is the first: it resolves docs/mana.md's former "weather
// subsystem" open question (Field Effects IS that subsystem, generalized —
// 2026-08-21 designer sign-off). Set by the Arcane moves `manaFont` and
// `magicCloak` (src/data/moves.ts) — mainly an Arcane-flavored effect, but per
// its mpRegenMultiplier it benefits every hero on the field, both sides alike.
//
// It was displayed as "Surging Magic" until 2026-08-30, when the Arcane slate
// arrived calling it Magical Surge; the display name follows the design table
// and the `surgingMagic` id is unchanged, so nothing else moved.
//
// Scorched Land / Stasis Bubble / Sanctuary / Verdant Earth (2026-08-21) are
// the second batch, one per new FieldEffectDefinition shape — each sets from
// its own dedicated move (moves.ts "Field Effect moves").
//
// Each setter is tied to its type's starter, but as a LEVEL-UP unlock, not a
// starting move (2026-08-26): the original five all cost 20 mana, which made
// one the outlier in a kit otherwise built from a cheap main-type move and one
// or two supports, and it was the 4th slot in a hero that had one — the
// thing that stopped starting kits being uniform three across the draft
// screen. So the attachment lives in src/data/progression.ts moveTiers now
// (crimson→spreadingBlaze, wildOracle→magicGrowth, dawnwarden→consecrate,
// runescribe→manaFont, mindweaver→stasisField), and each effect is
// something a run grows into rather than opens with.
//
// The authored slates have since replaced the bare 20-mana setters with moves
// that also DO something, which is the better shape — the field is a rider on
// a cast you wanted anyway rather than a turn spent on nothing:
//
//   - Verdant Earth is the one exception to "one setter per effect"
//     (2026-08-30): the Nature slate sets it from TWO of its own moves — Magic
//     Growth (40, a Renew grant) and Force of Nature (75, the type's biggest
//     hit) — and the standalone setter that used to carry it was deleted, its
//     `overgrowth` id reused by the slate's Renew 100 buff.
//   - Magical Surge is the other exception (2026-08-30): the Arcane slate
//     sets it from Mana Font (which also hands the side +10 MP Regen) and
//     Magic Cloak (which also hides the caster), and the standalone
//     `arcaneSurge` was deleted rather than reused. Its own Overload then
//     READS the field back as a targeting condition
//     (engine/content.ts conditionalTarget) — the second field effect a move
//     reads, and the first one read for something other than damage.
//   - Sanctuary keeps exactly one setter, but the Light slate (2026-08-30)
//     reused the `consecrate` id for a 45-mana bothAllies HEAL that turns the
//     ground on the way past. Sanctuary is also the first field effect a MOVE
//     READS BACK: Light's Smite doubles its BasePower while it is active
//     (engine/content.ts conditionalPower.requiresFieldEffect), which makes
//     "whose field is up" a damage question and not only a tempo one.

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
