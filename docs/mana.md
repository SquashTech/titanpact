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

## What is OPEN (do not resolve unilaterally)

Mana is deliberately underspecified below the level of "it's the balance lever." Each
of these needs a designer decision before it's coded. Flag, propose, wait — don't
default any of them to make the prototype run.

> 🔒 **OPEN — do not resolve without designer sign-off.** *Resource model.*
> Is mana a **per-hero pool** or a **shared team pool**? This is the foundational
> question the rest of the system hangs on and it interacts with bring-6-pick-4 and
> switching. Do not assume per-hero just because `MP Regen` is a per-hero stat — a
> per-hero regen stat could still feed a shared pool.

> 🔒 **OPEN — do not resolve without designer sign-off.** *Regen mechanics.*
> How does `MP Regen` actually apply — per round, per turn, on switch-in, only while
> benched? Does mana regenerate on the **bench** the way HP does (`combat.md`)? If it
> does, mana becomes another reason switching is productive, which is desirable but
> must be a deliberate choice, not an accident.

> 🔒 **OPEN — do not resolve without designer sign-off.** *Starting state.*
> How much mana does a hero/team start a fight with? Full, empty, partial? This sets
> whether opening turns are high-cost or a ramp.

> 🔒 **OPEN — do not resolve without designer sign-off.** *Weather subsystem
> dependency.* Whether a weather subsystem exists at all, and whether it interacts
> with mana (regen, costs), is unresolved. Do not build weather hooks into the mana
> system speculatively. If weather is cut, mana must stand on its own; if it's in, the
> interaction is a deliberate design pass, not a default.

---

## Engine placement

- Mana is **combat state** (`architecture.md`): it lives on the fight, spends when a
  move is used, and regenerates per the (open) regen rules.
- Mana changes emit a **`ManaChanged` event** (proposed event set, `architecture.md`)
  so the presentation layer can show the resource draining and refilling — same
  engine/presentation discipline as HP. The engine spends and regenerates mana; the
  view shows it. Never gate a move's *legality* in the view — legality (can this move
  be afforded?) is an engine decision surfaced as state.

---

## Note for Claude Code

This is the least-specified of the five systems. It's load-bearing (it's the balance
lever), so the temptation to "just pick something reasonable" is strong — resist it.
Building the **shape** (mana is combat state, spends on use, regenerates via a stat,
emits events) is safe and expected. Deciding **per-hero vs. shared, regen cadence,
starting mana, and weather coupling** is not — those are flagged OPEN above for a
reason.
