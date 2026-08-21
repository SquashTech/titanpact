# mana.md

> The mana / MP resource system. Mana replaced accuracy as the primary balance lever,
> so this system carries a lot of load — but several of its mechanics are still
> underspecified. This doc states what's locked and **flags the open sub-questions
> explicitly** rather than inventing mechanics. Do not fill the gaps unilaterally.

## Why mana matters: it is the primary balance lever

Accuracy was removed from Titanpact entirely (`combat.md`). **Mana cost is what took
its place as the primary balance lever.** A powerful move isn't gated by a miss
chance — it's gated by what it costs and how fast you can pay again. This means mana
is not a flavor resource; it is *the* knob that keeps strong moves in check.

Practical consequence: when a move feels oppressive, the first tuning lever is its
**mana cost**, not a nerf to its power or the invention of an accuracy roll.

---

## What's locked

- **Mana cost is the primary balance lever** (above).
- **`Mana / MP Regen` is a stat** on the core stat line (`HP, Attack, Defense,
  Intelligence, Wisdom, Speed, Mana/MP Regen`). So a hero's ability to sustain
  high-cost moves is itself a stat you can build and modify.
- **Mana nodes** exist as a progression investment (see the tuning invariant below).

### The mana-node payout invariant (LOCKED)

> **Mana investment must pay out later than the point at which a weak team dies.**

This is a recorded tuning invariant. In plain terms: investing in mana is a *scaling*
play, and its return has to arrive **after** the moment a fragile team would already
have lost. If mana investment paid off early, it would be a strictly-correct opening
and collapse the decision. The payoff curve must sit past the weak-team death point.
Treat this as a hard constraint when tuning mana-node values in `/data`.

---

## Resolved (2026-08-15 designer sign-off)

- **Resource model: per-hero pool.** Each hero has their own mana pool, fed by their
  own `MP Regen` stat. Not a shared team pool.
- **Regen mechanics: every round, active and benched alike.** `MP Regen` ticks at
  every round boundary (same cadence as bench HP regen, `combat.md`) for both active
  and benched combatants — mana regen is one more reason switching is productive,
  same as HP.
- **Starting state: full.** Every hero starts a fight with a full mana pool.
- **Implemented.** The regen tick above is wired into the engine
  (`engine/combat/manaRegen.ts`, called from `resolveRound.ts` at the round
  boundary alongside bench HP regen), emitting a `ManaRegenTicked` event per
  combatant whose mana changed. It walks every non-fainted combatant (active
  and benched) rather than reusing the bench-only `applyBenchHpRegen` path,
  since mana regen — unlike HP regen — isn't bench-exclusive.

## Resolved (2026-08-21 designer sign-off)

- **Weather subsystem interaction with mana: RESOLVED.** Field Effects
  (`docs/field-effects.md`) **is** the weather subsystem, generalized beyond just
  weather-flavored effects — a single global battlefield state, one active at a time,
  lasting a flat 5 rounds. The first content, Surging Magic, doubles every hero's MP
  Regen while active (`engine/combat/manaRegen.ts`, `engine/combat/
  fieldEffectEngine.ts`). This was the mana system's only remaining open question.

## What is still OPEN (do not resolve unilaterally)

Nothing currently — see `docs/field-effects.md`'s own open questions for what's still
undecided about Field Effects specifically (a type-restricted damage-modifier surface,
whether relics should be able to grant one passively).

---

## Engine placement

- Mana is **combat state** (`architecture.md`): it lives on the fight, spends when a
  move is used, and regenerates per the (open) regen rules.
- Mana changes emit a **`ManaChanged` event** (proposed event set, `architecture.md`)
  so the presentation layer can show the resource draining and refilling — same
  engine/presentation discipline as HP. The engine spends and regenerates mana; the
  view shows it. Never gate a move's *legality* in the view — legality (can this move
  be afforded?) is an engine decision surfaced as state (`engine/state.ts`
  `hasAffordableMove`, a pure query over mana + move costs that both the player UI
  and the AI consult).
- **Rest** (`combat.md` "Rest") is the resolution to the case where a hero can afford
  *none* of their moves: it fully restores Mana instead of spending it, implemented
  as its own `Action` kind (`engine/combat/actions.ts`) rather than a move, so it
  can't be folded into a hero's authored movepool or accidentally costed/tuned like
  one.

---

## Numerical Examples for future reference:

A "standard" starting mana stat would be something like 80. A decent attack might cost
roughly 30 mana, and the hero's mana regen stats may be 30. This allows easy usage
of that attack. However, a more powerful attack may cost 60 mana. With only 30 
regen, continuous usage of this attack will not be possible without careful
management.

## Note for Claude Code

Resource model, regen cadence, and starting mana are now locked (above) — build
against them directly, including the regen tick, which is implemented. Weather
coupling is also resolved now, via Field Effects (`docs/field-effects.md`) — this
doc has no open questions of its own left.
