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

## Turn & round structure (LOCKED — 2026-08-15 designer sign-off)

- A **round** is one full cycle in which every active combatant takes one action.
- A **turn** is a single combatant's action within a round.
- At the **start of a round**, both players declare all their active combatants'
  actions (including switches). Actions then resolve in priority/speed order.
- **Bench regen** and any per-round bookkeeping tick at round boundaries.

This matches the already-implemented model (`resolveRound.ts`) — locking it promotes
it from draft to rule; no code change was needed.

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
- **A declared single-target that's gone by the time its action resolves is a
  no-op, not an error.** Declare-then-resolve means an earlier-resolving action this
  same round can knock out the one target a later action already committed to (e.g.
  two attackers both declaring against the same lone enemy). `resolveRound.ts`
  catches this specifically (`targeting.ts`'s `TargetNoLongerValidError`) and emits
  `ActionBlocked` (`reason: 'noValidTarget'`) instead of throwing — the action fizzles,
  no mana spent. This is a normal mid-round race, not a UI bug to prevent upstream.

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

**Stacking policy (LOCKED — 2026-08-15 designer sign-off): multiplicative.** Each
modifier multiplies onto the running total, matching how STAB/TypeMult/Variance/Crit
already combine. `damagePipeline.ts resolveMultiplierTerm` implements both policies
as a one-line swap by design — the default should now be `'multiplicative'`, not
`'additive'`.

### Crit

`Crit` is 1× on a normal hit and the crit multiplier on a crit (multiplier value
lives in `/data`).

**Crit source (LOCKED — 2026-08-15 designer sign-off): loadout/equipment layer, not
a base stat.** Base crit is ~0 for everyone; crit chance is something built toward
via equipment/relics — it does not become a per-hero authoring axis.
**NOT YET IMPLEMENTED:** `equipment.ts` has no crit-chance field yet (only the
`StatKey` stat line), and `damagePipeline.ts`'s flat `PROVISIONAL_CRIT_CHANCE`
(1/16, sourced from nothing) is still a placeholder. Wiring crit into equipment is
follow-up work: add a crit-chance grant to equipment/relic definitions and thread it
into `rollDamage` in place of the flat constant.

---

## Stat modifiers

- Stat modifiers are **flat numeric additives** — not the VGC stage/bracket system.
  A +10 Attack modifier adds 10 to effective Attack.
- They flow through the **stat pipeline**, so they change the `Atk/Def` ratio (and
  Speed, and so on), never the damage multiplier term.

**Persistence on switch (LOCKED — 2026-08-15 designer sign-off): stat mods persist
through a switch.** Cycling doesn't launder a bad board state — a debuffed hero
comes back debuffed. This matches the already-implemented state shape
(`state.ts StatModifiers` attaches to the `Combatant` record, not the active slot),
so no code change was needed. Still interacts with the unresolved sixth (status)
engine contract for anything status-shaped, not just flat stat mods.

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
