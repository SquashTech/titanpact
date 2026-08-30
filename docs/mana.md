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
  lasting a flat 5 rounds. The first content, Magical Surge, doubles every hero's MP
  Regen while active (`engine/combat/manaRegen.ts`, `engine/combat/
  fieldEffectEngine.ts`). This was the mana system's only remaining open question.

## Mana pools GROW over a run (2026-08-30 designer sign-off)

**A hero's `baseStats.manaPool` is its STARTING pool, not its ceiling.** Heroes are
supposed to gain mana across a run, so **a move costing more than any current hero's
starting pool is fully intentional** — it is a move that comes online partway through a
run, not a mistuned one.

This is the single most-repeated false finding in the project's history: every one of
the first five authored slates (Fire, Water, Frost, Storm, Stone) reported "the top of
the curve is unreachable" as a balance consequence, and all five were wrong in the same
way. They compared an authored move's cost against `baseStats.manaPool` and forgot that
the number on the hero sheet is where the hero *starts*.

### Where the growth actually comes from

There is **no automatic stat growth from leveling** (`CLAUDE.md` — level-ups unlock
moves and surface Evolutions; they never raise stats). Mana growth is a **loadout**
fact, on three independent axes:

| Axis | Scope | What exists today |
|---|---|---|
| **Relics** | Team-wide, accumulate all run | Deep Reserve Flask +50 · Wellspring Heart +40/+10 regen · Deep Wellstone +20/+5 · Overflowing Vessel +20 · Bloodfire Catalyst +20 · Windrunner's Flask +20 |
| **Equipment** | Per hero, 3 slots | Archon's Staff +20 (weapon) · Vital Charm +10/+5 (accessory) · Apprentice's Band +10 (accessory) · Mystic's Robe +5 (armor) |
| **Evolution** | Per hero, once | A mana branch on **9 of 31** heroes: +10 pool / +5 regen. Not universal — do not assume a given hero has one |

All three land in `Combatant.baselineStatModifiers` at fight-build time
(`src/run/buildCombatState.ts`), which is exactly why that field is kept separate from
`statModifiers` — a loadout grant reads as part of the hero's stat block, not as a
temporary combat buff (`engine/state.ts`).

**Scale, concretely.** The two axes that apply to *every* hero are relics and
equipment. A modest mid-run pairing — Deep Wellstone (+20) and an Apprentice's Band
(+10) — is **+30**, which takes Sentinel from 30 to 60 and makes Body Blow (40)
comfortable. A run drafting for mana stacks well past +100: relics alone total +170 if
every mana relic is picked up, and they are team-wide, so both actives get the full
amount. Against that, a 75–80 mana capstone is a move you build toward, which is the
intended shape.

### What this means when authoring a slate

- **Do not price a slate against starting pools.** Price it against the curve
  (`docs/authoring-moves.md` §2), and let the top of it be unreachable at hour zero.
- **A Late-tier move the current roster cannot cast is not a bug.** It is the payoff for
  investing in mana, and the mana tuning invariant (`CLAUDE.md`: "mana investment must
  pay out later than the point at which a weak team dies") is what keeps that investment
  honest rather than free.
- **The one case that IS still a finding**: a hero that cannot afford its own *starting
  kit*, or an ENEMY that cannot act — enemies get no relics, no equipment and no
  Evolution, so their pools really are fixed and really do need checking
  (`docs/authoring-moves.md` §8).

**Classes remain the exception**: `src/data/classes.ts` deliberately grants neither
`manaPool` nor `mpRegen`, which is still an open question and is unaffected by this.

## Overflow: mana above the pool (2026-08-30 designer sign-off, Arcane)

Until the Arcane slate, `Combatant.currentMana` was bounded by `getMaxMana` at every
point that touched it. It no longer is. Four Arcane moves — Infuse (40), Empower (80),
Conduit (150) and Font of Power (150 to both allies) — hand mana to a target and the
design table says, of each one, **"can exceed their max"**.

**The rule, as decided: uncapped, sticky, never clawed back.**

- **No ceiling.** There is no 2× cap and no cap of any other shape. A hero can hold
  whatever it has been handed.
- **MP Regen never LOWERS you.** The round-boundary tick still clamps a *gain* to the
  pool, but a combatant already above the pool simply gains nothing rather than being
  pulled back down to it (`engine/combat/manaRegen.ts`). The pre-Arcane line was
  `Math.min(maxMana, current + regen)`, which would have deleted every grant at the
  end of the round it landed in.
- **Rest tops up TO the pool and never below what you hold.** Resting on an overflowed
  pool is a wasted turn, not a refund (`engine/combat/resolveRound.ts`).
- **It survives a switch to the bench**, like ordinary mana and unlike a status.
- **It ends only by being spent** — or at the next map node, where HP and mana fully
  restore for everyone anyway (`docs/run-loop.md`).

**Why this shape rather than a decaying or capped one.** The mechanic exists so a type
can pay for costs no pool can reach: Arcane authors a 150-mana capstone (Singularity,
200 BP) against a roster whose largest pool is 90, and Conduit is how you cast it. A
cap would put an invisible wall in front of exactly that play, and a decay would turn
a plan into a one-round trick. The cost is paid in tempo instead — every grant is a
turn the battery spent not attacking, and the payoff has to arrive on somebody else's
turn.

**What this obliges every reader of `currentMana` to do.** The value can be greater
than the pool, so anything dividing by the pool has to clamp. The three gauges that
do (`CombatantCard`, `HeroDetailOverlay`, `SwitchInPanel`) clamp the fill at 100% and
draw the surplus as a second, brighter band on top, with the raw `210/85` numeral
beside it in the overflow colour — a bar that silently pinned at full would make the
whole mechanic invisible, and an unclamped one just overflowed its own hidden track.
Affordability checks are `>=` comparisons and needed nothing.

A grant emits its own **`ManaGranted`** event rather than a bare `ManaChanged`
(`engine/events.ts`), carrying the source, the amount and the resulting overflow —
`ManaChanged` is deliberately omitted from the Battle Log as bookkeeping, so a grant
without its own event would be both invisible in the log and unattributable in the
beat stream.

---

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

Note that every figure above is a **starting** one — see "Mana pools GROW over a run"
above. The same hero four relics and three equipment slots later is playing a different
curve, and the authored slates are priced for both ends of it.

## Note for Claude Code

Resource model, regen cadence, and starting mana are now locked (above) — build
against them directly, including the regen tick, which is implemented. Weather
coupling is also resolved now, via Field Effects (`docs/field-effects.md`) — this
doc has no open questions of its own left.
