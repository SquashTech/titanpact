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
  clock. Trying to re-cast Magical Surge while it's already up just wastes the mana
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
  statBonusEqualToStatusMagnitude?: { statusId: StatusId; stats: readonly StatKey[] };
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
- **`statBonusEqualToStatusMagnitude`** — `engine/state.ts` `getEffectiveStat`. A genuine
  stat-pipeline bonus (pipeline 1, not a damage modifier): every stat in `stats` gains a
  bonus equal to the combatant's **own current magnitude of `statusId`** — for Verdant
  Earth, its Renew. Read live off the status each call, so the bonus decays as Renew
  halves and is 0 for a hero not carrying it: the effect is a payoff for building around
  the status, not a flat buff to the whole field. Keyed by status id rather than
  hardcoding Renew, so a later effect can scale a stat off any magnitude-shape status.
  Threaded as an optional `FieldEffectContext` argument (`{ active, defs }`) so every existing 3-arg call site
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
Magical Surge — mechanically **global**, affecting both sides. The original setting
moves all mirrored `arcaneSurge`'s shape (`kind: 'buff'`, `target: 'self'`, 20 mana,
sets its field effect), the same "small dedicated buff move" pattern `moves.ts`'s file
header documents for status-granting moves like `vanish` (Stealth) and `secondWind`
(Renew). **Every one of those bare setters is now gone**, folded by the authored slates
into a move that also *does* something — Nature's Magic Growth and Force of Nature,
Light's Consecrate (a 45-mana `bothAllies` heal that turns the ground on the way past)
and Arcane's Mana Font and Magic Cloak (all 2026-08-30):

**Surging Magic was renamed Magical Surge** on 2026-08-30, when the Arcane design table
arrived calling it that three times over. Display name only — the `surgingMagic` id is
unchanged, so nothing else moved.

| Field Effect | flavorType | Effect | Move (starter) |
| --- | --- | --- | --- |
| Magical Surge | Arcane | Doubles MP Regen | `manaFont`, `magicCloak` (Glyph) |
| Scorched Land | Fire | Burn no longer decays | `spreadingBlaze` (Brimstone) |
| Stasis Field | Mind | Reverses same-bracket Speed order | `stasis` (Cortex) |
| Sanctuary | Light | Heal-kind moves get +1 priority | `consecrate` (Solace) |
| Verdant Earth | Nature | +Attack/+Intelligence equal to your own Renew | `magicGrowth`, `forceOfNature` (Sylva) |

### A field effect as a damage condition (2026-08-30, Light)

Sanctuary is the first field effect a **move reads back**, rather than only being
affected by: Light's Smite doubles its BasePower while Sanctuary is the active effect
(`MoveDefinition.conditionalPower.requiresFieldEffect` — see `docs/combat.md`). Three
properties of the subsystem become load-bearing the moment content does this, and all
three are the LOCKED shape rather than anything new:

- **One slot.** Any other effect overrides Sanctuary and switches the bonus straight
  off — so a Magical Surge cast by either side is real counterplay to a Light team,
  which is the first time "whose field is up" has been a damage question.
- **No owner.** The side that sets it arms *every* Smite on the field, its own and the
  enemy's. The setter is a tempo commitment, not a private buff.
- **A 5-round clock.** The bonus is rented, never owned; nothing in the type can
  refresh it except re-paying for the setter, and re-applying the *active* effect is a
  no-op that does not restart the clock.

`consumesStatus` is deliberately inert on this form. "Consume the field effect" would
end a global, both-sides state early — a field-effect mechanic, not a status one — and
it has not been decided.

### A field effect as a TARGETING condition (2026-08-30, Arcane)

Magical Surge is the second field a move reads back, and the first read for something
other than damage: Arcane's Overload is `singleEnemy` normally and `bothEnemies` while
Magical Surge is up (`MoveDefinition.conditionalTarget` — see `docs/combat.md`).

The same three properties above apply unchanged, and the same way round: one slot, so
any other field switches the spread off; no owner, so an enemy's Magical Surge spreads
your Overload; a 5-round rented clock. What is new is only that the type now **sets the
field it reads** — Mana Font and Magic Cloak are both Arcane, both in the same slate as
Overload, and Mana Font sits in the same level-up pool. That is the deliberate
counterpart to Light's Consecrate/Smite pairing: the combo grows on one hero rather
than depending on a second draft of the same type.

Worth noting that Magical Surge is now doing two unrelated jobs at once — doubling MP
Regen (which the Arcane battery is built around) and spreading one move. Neither
interferes with the other, but it does mean an Arcane player has one field they always
want up for two reasons, where Light's Sanctuary is a genuine choice.

Each move is tied to that starter through `progressionTable.moveTiers`
(`src/data/progression.ts`) — a **level-up unlock**, not part of the starting kit.
It was originally granted as a fourth starting move, which made those five heroes the
only ones opening with four (2026-08-26): starting kits are now uniformly three across
the whole roster, both because the draft screen compares four candidates side by side
and because a 20-mana field setter is a strange thing to hand a level-1 hero whose
other moves cost 10-15. A hero that wants its field effect grows into it.

This is placeholder-tier balance content (mana costs, and which starter carries each
move, are both open to reassignment) — the mechanics and the definitions are real, but
nothing here has been through a tuning pass.

### View layer: per-effect color

The battlefield glow/border and the divider badge (`FightScreen.tsx`) were originally
hardcoded to Magical Surge's Arcane purple — the CSS itself flagged this as
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
  through a reactive Passive hook firing mid-fight? **Half of the premise this was
  written on has since changed** (2026-08-31): `PassiveHook` now includes
  `SwitchedIn`, the entry hook Imposing Presence needed (docs/events.md), and it fires
  for the opening lead as well as for every mid-fight arrival
  (`passiveEngine.ts` `resolveBattleStartEntries`). So a relic granting a Field
  Effect on entry IS now reachable — a relic-held `{ hook: 'SwitchedIn', effect:
  { kind: 'setFieldEffect' } }` would set it the moment a fight opens, since a relic
  broadcasts to every combatant on the side. The question that remains is narrower and
  still open: should it be expressible as a plain build-time grant (like
  `RelicDefinition.grantsStatusIds`) rather than as a hook that has to fire? Nothing
  needs either yet.
- **Verdant Earth's bonus size**, as of the Nature slate, is no longer bounded by the
  20–30 Renew the fixture content granted: Overgrowth's Renew 100 makes this a ~+125
  Attack/Intelligence swing. **Signed off 2026-08-30** — see docs/combat.md "Renew's
  stacked payoffs". Renew is a slow passive effect and its payoffs are meant to be
  worth the turn; the halving curve is what bounds the window rather than the
  magnitude. Not a finding; do not re-report it.
- **Verdant Earth's bonus applying to benched heroes too** — `getEffectiveStat` has no
  active/bench distinction, so (like Magical Surge's `mpRegenMultiplier`) the
  Attack/Intelligence bonus applies to any combatant carrying Renew regardless of bench
  status. Mostly moot while the bonus only feeds the damage pipeline (a benched hero
  isn't attacking), but it means a hero can be switched in mid-effect already boosted.
  Consistent with existing precedent, but not something a designer has explicitly
  signed off on for this specific effect — flag if that's ever meant to be
  active-only.
