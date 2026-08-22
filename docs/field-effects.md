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
  flavorType?: TypeId; // presentational only — the view's badge/glow color
  mpRegenMultiplier?: number; // e.g. 2 = doubled
  suppressesStatusDecay?: readonly StatusId[]; // e.g. ['Burn']
  reversesSpeedOrder?: boolean;
  healPriorityBonus?: number; // added to a heal-kind move's priority bracket
  statBonusEqualToRegen?: readonly StatKey[]; // e.g. ['attack', 'intelligence']
}
```

Same registry pattern as every other content type: a plain object literal keyed by id,
`src/data/fieldEffects.ts`. The engine reads `FieldEffectDefinition` flags
generically — no per-effect special cases, same discipline as
`StatusDefinition`/`PassiveHook` — each flag owned by the one engine module that
actually applies it:

- **`mpRegenMultiplier`** — `engine/combat/manaRegen.ts`. A flat multiplier on every
  combatant's MP Regen, applied in the regen pipeline itself — never folded into the
  `mpRegen` stat, the same discipline that keeps damage modifiers out of the stat
  pipeline (CLAUDE.md "Two-pipeline separation"), generalized to the regen pipeline.
- **`suppressesStatusDecay`** — `engine/combat/statusEngine.ts` `tickEndOfRound`. Lists
  status ids whose end-of-round decay (`StatusDefinition.decay`) is skipped while the
  effect is active; the DoT/HoT tick itself still fires, only the post-tick halving is
  suppressed.
- **`reversesSpeedOrder`** — `engine/combat/priority.ts` `orderActions`. Flips the
  Speed tiebreaker to ascending (slowest-first) *within* a shared priority bracket.
  Priority BRACKETS themselves are untouched — still sorted descending — so a move
  with nonzero authored `priority` still resolves in its own bracket regardless of the
  flip.
- **`healPriorityBonus`** — `engine/combat/priority.ts` `orderActions`
  (`actionPriority`). Added to a `kind: 'heal'` move's priority bracket, read
  generically off the move's own `kind` rather than a per-move/per-status check.
- **`statBonusEqualToRegen`** — `engine/state.ts` `getEffectiveStat`. A genuine
  stat-pipeline bonus (pipeline 1, not a damage modifier): every stat listed gains a
  bonus equal to the combatant's own effective `mpRegen`. Threaded as an optional
  `FieldEffectContext` argument (`{ active, defs }`) so every existing 3-arg call site
  (tests, non-combat stat sheets) is unaffected; `damagePipeline.ts`'s
  `resolveStatRatio` and `resolveRound.ts`'s per-hit `DamageDealt` readout both pass it
  through, and it's recomputed fresh per hit (not hoisted before the action loop) so a
  Field Effect set by a faster action earlier the same round already applies to a
  slower action's damage later that round.

A **type-restricted damage-pipeline modifier** ("certain type of moves" from the
original ask — e.g. a future effect boosting Fire-type moves specifically) remains a
**deliberately deferred extension point**, not yet wired into any engine module.
`PassiveHook` and `StatusDefinition.triggerTypes` were both grown incrementally, one
shape at a time, only when real content needed the next one — Field Effects follows
the same discipline. Add it (a `moveTypes`/`amount` shape on `FieldEffectDefinition`,
collected into `resolveRound.ts`'s `modifiers` array the same way
`collectPassiveDamageModifiers` already is) when the first type-restricted Field
Effect is actually authored.

## Content (2026-08-21 batch)

Each is flavored around one type (`flavorType`, presentational only) but — like
Surging Magic — mechanically **global**, affecting both sides. Every setting move
mirrors `arcaneSurge`'s shape (`kind: 'buff'`, `target: 'self'`, 20 mana, sets its
field effect) and is attached as a fourth move to that type's starter, the same "small
dedicated buff move" pattern `moves.ts`'s file header documents for status-granting
moves like `vanish` (Stealth) and `secondWind` (Regen):

| Field Effect | flavorType | Effect | Move (starter) |
| --- | --- | --- | --- |
| Surging Magic | Arcane | Doubles MP Regen | `arcaneSurge` (Glyph) |
| Scorched Land | Fire | Burn no longer decays | `scorchTheEarth` (Crimson) |
| Stasis Bubble | Mind | Reverses same-bracket Speed order | `stasisField` (Cortex) |
| Sanctuary | Light | Heal-kind moves get +1 priority | `consecrate` (Solace) |
| Verdant Earth | Nature | +Attack/+Intelligence equal to Regen | `overgrowth` (Sylva) |

This is placeholder-tier balance content (mana costs, and which starter carries each
move, are both open to reassignment) — the mechanics and the definitions are real, but
nothing here has been through a tuning pass.

### View layer: per-effect color

The battlefield glow/border and the divider badge (`FightScreen.tsx`) were originally
hardcoded to Surging Magic's Arcane purple — the CSS itself flagged this as
provisional ("revisit if/when a non-Arcane Field Effect ships"). Now generalized:
`FightScreen.tsx` sets a `--field-effect-rgb` custom property (an "r, g, b" triplet
from `typeColors.ts` `getTypeColorRgb(def.flavorType)`) on `.battlefield`, and
`styles.css`'s glow/badge/keyframes all read `rgba(var(--field-effect-rgb, 195, 86,
208), …)` — the fallback triplet is Arcane's own color, so an effect with no
`flavorType` still renders instead of going colorless.
`FieldEffectDetailOverlay.tsx` sets its own border-top-color inline the same way
(`getTypeColor`, not the custom property) since it's portalled to `document.body` and
so sits outside `.battlefield`'s subtree — custom properties don't cross a portal
boundary.

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
- **Verdant Earth's bonus applying to benched heroes too** — `getEffectiveStat` has no
  active/bench distinction, so (like Surging Magic's `mpRegenMultiplier`) the
  Attack/Intelligence bonus applies to every combatant regardless of bench status.
  Consistent with existing precedent, but not something a designer has explicitly
  signed off on for this specific effect — flag if that's ever meant to be
  active-only.
