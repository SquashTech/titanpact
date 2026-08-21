# field-effects.md

Field Effects: a single global battlefield state, one active at a time. This resolves
`mana.md`'s former "weather subsystem" open question — Field Effects **is** that
subsystem, generalized beyond just weather-flavored effects (2026-08-21 designer
sign-off).

---

## Locked shape

- **Only one Field Effect may be active at a time**, global — it affects both sides,
  not a per-side state.
- **Every Field Effect lasts a flat 5 rounds**, regardless of which effect it is.
  Duration is NOT authored per-definition; it's an engine constant
  (`engine/combat/fieldEffectEngine.ts` `FIELD_EFFECT_DURATION_ROUNDS`).
- **Re-applying the currently active effect is a no-op** — it does not refresh the
  clock. Trying to re-cast Surging Magic while it's already up just wastes the mana
  spent on the move; the countdown keeps going as if nothing happened.
- **Setting a different effect while one is active overrides it** — the old effect's
  clock is discarded (not merged/extended), and the new one starts a fresh 5-round
  countdown.
- **Settable two ways**, matching the two vectors already in the engine: a move can
  carry `MoveDefinition.fieldEffectApplication` (own field, any move kind — same
  flexibility `statusApplication` already has), or a Passive (i.e. a relic or an
  ability) can carry the `setFieldEffect` `PassiveEffect` off any existing reactive
  hook. Global, so — unlike `statusApplication`/the other three `PassiveEffect`
  kinds — there's no per-target loop and no `target` field.
- **Ticks at the end of every round**, alongside status ticks and mana regen
  (`resolveRound.ts`) — including the round it was cast in. A Field Effect set mid-round
  is already one tick into its countdown by the time that same round ends (reads as
  4 rounds remaining right after the casting round, not 5).

## Content schema

```ts
interface FieldEffectDefinition {
  id: FieldEffectId;
  name: string;
  description: string;
  mpRegenMultiplier?: number; // e.g. 2 = doubled
}
```

Same registry pattern as every other content type: a plain object literal keyed by id,
`src/data/fieldEffects.ts`. The engine (`fieldEffectEngine.ts`, `manaRegen.ts`) reads
`FieldEffectDefinition` flags generically — no per-effect special cases, same
discipline as `StatusDefinition`/`PassiveHook`.

### Effect surfaces: implemented vs. deferred

The original ask named two kinds of thing a Field Effect should be able to do:
"affect all heroes on the field, or certain type of moves." Only the first is wired up
so far:

- **`mpRegenMultiplier`** (implemented): a flat multiplier on every combatant's MP
  Regen, applied in the regen pipeline itself (`manaRegen.ts`) — never folded into the
  `mpRegen` stat, the same discipline that keeps damage modifiers out of the stat
  pipeline (CLAUDE.md "Two-pipeline separation"), generalized to the regen pipeline.
  Surging Magic (below) is the only content using it.
- **A type-restricted damage-pipeline modifier** ("certain type of moves" — e.g. a
  future "Scorched Land" boosting Fire-type moves for both sides) is a **deliberately
  deferred extension point**, not yet wired into any engine module. `PassiveHook`
  and `StatusDefinition.triggerTypes` were both grown incrementally, one shape at a
  time, only when real content needed the next one — Field Effects follows the same
  discipline rather than speculatively building a damage-modifier hook with zero
  consumers today. Add it (a `moveTypes`/`amount` shape on `FieldEffectDefinition`,
  collected into `resolveRound.ts`'s `modifiers` array the same way
  `collectPassiveDamageModifiers` already is) when the first type-restricted Field
  Effect is actually authored.

## First content: Surging Magic

Arcane-flavored (mainly for Arcane users, per the original ask), but its effect is
global — it doubles MP Regen for every hero on the field, both sides alike, same as
weather would in Pokémon.

- `src/data/fieldEffects.ts` — `surgingMagic`, `mpRegenMultiplier: 2`.
- `src/data/moves.ts` — `arcaneSurge` (Arcane, `kind: 'buff'`, `target: 'self'`,
  20 mana, sets `surgingMagic`). Attached to Glyph's (`runescribe`, the Arcane
  starter) `moveIds` as a fourth move — the same "small dedicated buff move" pattern
  `moves.ts`'s file header already documents for status-granting moves like `vanish`
  (Stealth) and `secondWind` (Regen).

This is placeholder-tier balance content (mana cost, and whether Glyph specifically
should be the one to carry it, are both open to reassignment) — the mechanic and the
first definition are real, but nothing here has been through a tuning pass.

## Open questions — do not silently resolve

- **The damage-modifier surface** (above) — deferred until a concrete type-restricted
  Field Effect is authored.
- **Should a relic be able to grant a Field Effect passively at fight-build time**
  (like `RelicDefinition.grantsStatusIds` does for Elemental Force), rather than only
  through a reactive Passive hook firing mid-fight? Nothing needs this yet — no
  reactive hook exists today that would plausibly fire "on fight start" or "on switch
  in" (`PassiveHook` is `DamageDealt | StatusApplied | StatusTicked` only), so a
  relic-granted Field Effect is currently unreachable in practice even though the
  `setFieldEffect` `PassiveEffect` shape technically supports it. Revisit once a
  Field Effect is actually meant to be always-on from a relic rather than
  move-triggered.
- **Variety beyond Surging Magic** — the framework is generic (any future effect is
  pure data in `src/data/fieldEffects.ts`), but no second Field Effect has been
  designed yet. Nothing here should be read as implying what comes next.
