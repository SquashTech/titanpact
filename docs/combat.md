# combat.md

> The combat loop: turn/round structure, action resolution, the damage formula,
> switching, and KO handling. Rules only — concrete numbers (base powers, the crit
> multiplier, per-move data) live in `/data`. Type effectiveness details live in
> `types-and-heroes.md`. Where combat lives in code, see `architecture.md`.

## Shape of a fight

- **Doubles, always.** Two active combatants per side, four on the field. This is a
  doubles-only game — there is no singles mode to support and no design should
  assume one.
- **Piloted.** The player declares actions every turn. No auto-battle.
- **Bring-6-pick-4 sideboard.** A team is up to 6 heroes; a fight is fought with 4
  (2 active + 2 benched). Roster rules live in `types-and-heroes.md`.

---

## Turn & round structure

> 🔒 **OPEN — do not resolve without designer sign-off.**
> The **precise definitions of "turn" vs. "round" are unresolved.** The model below
> is a working proposal so the engine has something to build against — do not treat
> the exact boundaries (when regen ticks, when switches happen, when stat mods
> expire) as locked. Flag any code that depends on the boundary.

**Proposed model (draft):**

- A **round** is one full cycle in which every active combatant takes one action.
- A **turn** is a single combatant's action within a round.
- At the **start of a round**, both players declare all their active combatants'
  actions (including switches). Actions then resolve in priority/speed order.
- **Bench regen** and any per-round bookkeeping tick at round boundaries.

The declare-then-resolve structure (both sides commit, then the round plays out) is
what makes prediction the core skill. Preserve it.

---

## Action declaration & targeting

- Each active combatant declares one action per round: a **move** (with target) or a
  **switch**.
- Targeting is on the **2v2 grid** — a move targets a specific slot (single-target),
  both enemies, both allies, self, etc., per the move's definition in `/data`.
- **No spread damage reduction.** Because the game is doubles-only, a move that hits
  both targets deals full damage to each. There is no multi-target penalty; do not
  implement one.

---

## Priority & speed resolution

- Actions resolve by **integer priority brackets** (higher bracket first).
- **Speed is the tiebreaker** within a bracket.
- Speed is an effective stat (base + flat modifiers + equipment + grants), resolved
  by the stat pipeline — see `architecture.md`.

> Ties at equal priority *and* equal speed need a documented, deterministic
> tiebreak (it draws from the seeded RNG, in fixed order). Don't leave this to
> insertion order.

---

## The damage formula (LOCKED)

```
Damage = BasePower
       × (Atk / Def ratio)     ← stat pipeline
       × STAB (1.25×)
       × TypeMult              ← from the 15-type chart (see types-and-heroes.md)
       × Variance (0.85–1.0)   ← seeded roll, intentional, load-bearing
       × Crit
```

Implemented across the **two pipelines** (`architecture.md`):

- **Stat pipeline** produces the `Atk / Def` ratio from effective stats.
- **Damage pipeline** applies `BasePower`, the ratio, `STAB`, `TypeMult`,
  `Variance`, `Crit`, **and a single multiplier term** where all situational damage
  modifiers accumulate.

Fixed terms:

- **STAB = 1.25×** when the move's type matches one of the user's types.
- **Variance = 0.85–1.0**, drawn from the seeded RNG. Do not remove it; it is
  deliberate for replayability and the skill ceiling.
- **TypeMult** comes from the chart, dual-type stacking is multiplicative (up to 4×,
  down to the 0.25× floor). Details and the open floor question are in
  `types-and-heroes.md`.

### The damage-modifier multiplier term

All situational damage modifiers (buffs, weaknesses conferred by abilities/relics,
etc.) collect into the pipeline-2 multiplier term — **not** into stats.

> 🔒 **OPEN — do not resolve without designer sign-off.**
> **Stacking order of damage modifiers (additive vs. multiplicative) is
> unresolved.** This materially changes balance. Do not pick one to make the code
> tidy. Structure the term so either policy is a one-line swap, and flag it.

### Crit

`Crit` is 1× on a normal hit and the crit multiplier on a crit (multiplier value
lives in `/data`).

> 🔒 **OPEN — do not resolve without designer sign-off.**
> **Crit source is unresolved: base-stat-driven vs. a loadout/equipment layer.**
> This determines whether crit is an innate hero property or something you build
> toward via equipment (`progression.md`). Don't wire crit chance to a source until
> this is signed off.

---

## Stat modifiers

- Stat modifiers are **flat numeric additives** — not the VGC stage/bracket system.
  A +10 Attack modifier adds 10 to effective Attack.
- They flow through the **stat pipeline**, so they change the `Atk/Def` ratio (and
  Speed, and so on), never the damage multiplier term.

> 🔒 **OPEN — do not resolve without designer sign-off.**
> **Do stat modifiers persist or reset on switch?** This is load-bearing because of
> bench-regen cycling: if mods reset on switch-out, cycling becomes a way to shed
> debuffs (and lose buffs); if they persist, cycling doesn't launder a bad board
> state. This interacts directly with the switching/lock-in rules below and with the
> unresolved sixth (status) engine contract. Do not default it.

---

## Switching, bench regen, and lock-in

- A combatant can **switch** with a benched ally as its action for the round.
- **Benched heroes regenerate** (HP, and per `mana.md`, possibly mana), which makes
  switching a *productive* action, not a purely defensive one. Regen ticks at round
  boundaries (per the proposed turn/round model above).
- **Lock-in rule (LOCKED):** once a side has **2 or more KOs**, switching is
  **disabled** for that side. This is self-regulating design: early fights are a
  cycling game (switch, regen, reposition); once attrition sets in, the fight
  transitions into a committed late-game slugfest. Do not add extra switch
  restrictions on top of this — the single rule is the mechanic.

Open dependencies for switching: the stat-mods-on-switch question above, and any
mana-on-switch behavior (`mana.md`).

---

## KO handling

- HP reaching 0 emits a `Fainted` event (separate from the `DamageDealt` event that
  caused it — see the event contract in `architecture.md`).
- A KO increments that side's KO count, which feeds the lock-in check.
- Replacement of a fainted active slot follows the switch rules, subject to lock-in.

---

## Explicit anti-features (do NOT implement)

These were deliberately removed or excluded. Re-adding them "for realism" is a
regression:

- **No accuracy stat and no miss chance.** Accuracy was removed entirely. **Mana cost
  is the primary balance lever** for what would otherwise be gated by accuracy — see
  `mana.md`.
- **No spread damage reduction** (doubles-only, covered above).
- **No VGC stat-stage brackets** — modifiers are flat additives (covered above).
