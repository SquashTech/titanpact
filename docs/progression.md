# progression.md

> How heroes and teams grow across a run: the level-up currency, rank-ups, equipment,
> relics, XP, and the raise-vs-recruit axis. Rules only — grant values, XP rates, and
> equipment/relic content are **data** (`/data`). Combat effects of these systems
> resolve through the stat and damage pipelines in `architecture.md`.

## Progression philosophy: level-ups unlock, they don't inflate

The core rule that keeps balance legible:

- **Level-ups never directly raise a stat.** Leveling **unlocks moves** and **drives
  rank-ups**. It does not silently pump numbers.
- Stat growth, where it happens, comes through **rank-up branches** as explicit
  grants — never as an invisible per-level drip.

This separation is deliberate: it means a hero's power at any moment is explained by
*visible choices* (which moves, which rank branch, which gear, which relics), not by
an opaque level curve.

---

## The level-up currency (pooled, freely distributed)

- Leveling uses a **pooled level-up currency**, distributed **freely** across the
  roster by the player — not a per-hero locked XP track for spending. (Bench XP
  *earning* is separate; see below.)
- The player chooses where to invest the pool. This is a strategic decision surface,
  not an automatic allocation.

### Bench XP

- Benched heroes earn XP at a **reduced rate — 33% is the current playtest starting
  point** (a tunable value in `/data`, not a locked constant).
- This creates a real cost to sidelining a developing hero, which feeds the
  raise-vs-recruit timing dynamics below.

---

## Rank-ups (LOCKED rules)

- Level-ups **drive rank-ups**; rank-ups are where a hero's identity branches.
- **Rank-up branches differ in kind, not degree.** A branch is not "the same hero but
  bigger numbers" — branches take the hero in genuinely different directions
  (different kits, roles, tools). Do not implement branches as tiered stat bumps.
- **The hero's innate type is immutable across all rank-ups** (`types-and-heroes.md`).
- **Mono is a valid terminal rank state** — a hero can be fully realized without ever
  branching into a second type. Don't gate "finished" on dual-typing.

### Stat grants

- Where a rank-up (or other source) grants stats, **grants are always multiples of 5
  or 10.** Never grant 7, never grant 12. This keeps the number space clean and
  readable.
- Grants feed the **stat pipeline** (`architecture.md`) as part of effective stats.

---

## Equipment (per-hero)

- **3 slots per hero: weapon, armor, accessory.**
- Equipment contributes through the **stat pipeline** (stat-shaped effects) or the
  **damage multiplier term** (damage-shaped effects) per the pipeline rules in
  `architecture.md` — same discipline as everywhere: stat effects go in stats, damage
  modifiers go in the multiplier term.
- **Equipment strips on contract termination.** When a hero leaves the team
  (contract terminated), their gear is removed. Model equipment as attached to the
  hero's roster slot, not permanently bound to the hero object, so termination cleanly
  reclaims it.

> The **crit source** question (`combat.md`) lands partly here: if crit is a
> loadout/equipment layer rather than a base stat, it's an equipment concern. Do not
> build crit into equipment until that 🔒 OPEN item is signed off.

---

## Relics (team-wide)

- Relics are **team-wide passives** and a **separate progression axis** from per-hero
  equipment. Do not merge relic logic into the equipment system — they progress
  independently and apply to the whole team, not a slot.
- Relic effects still respect the pipeline discipline: stat-shaped → stat pipeline,
  damage-shaped → multiplier term.

---

## The raise-vs-recruit axis (LOCKED design intent)

Two sources of heroes, with intentionally different value curves:

- **Guild Hall heroes (raise).** Carry **runway value** — upside you unlock by
  investing level-up currency and time. That runway **decays late-run**: there's
  eventually not enough run left to cash in the investment.
- **Contract heroes (recruit).** **Flat-value veterans** — they don't develop much,
  but they're immediately useful and don't need runway.

The intended play pattern — **develop early, plug-and-play late** — should **emerge
from these timing dynamics**, not from scripting. Don't hard-code "late-run, prefer
contracts." Set the value curves and let the correct behavior fall out. If it doesn't
emerge, that's a tuning signal on the curves (bench XP rate, grant sizes, run length),
not a reason to script the AI or nudge the player.

---

## Per-run reset vs. meta-progression

> 🔒 **OPEN — do not resolve without designer sign-off.**
> **What (if anything) carries across runs is unresolved.** This is the same seam as
> the run-state / meta-state boundary in `architecture.md`. Build progression so it
> reads and writes through that boundary cleanly — do not assume a hero, relic, or
> currency either persists or resets until the call is made. A wrong hard-wire here is
> expensive to unwind because it touches save format, roster identity, and equipment
> ownership all at once.
