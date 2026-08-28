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

- Each active combatant declares one action per round: a **move** (with target), a
  **switch**, or **Rest** (CLAUDE.md "Mana & tempo": recovers mana, no defensive
  benefit — see below).
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

### Rest

- **`RestAction` (`engine/combat/actions.ts`).** Skips the acting hero's turn and
  fully restores their Mana to max — untargeted, no HP/status interaction. Resolves
  dead last in priority order (`priority.ts` `REST_PRIORITY_BRACKET`, below even the
  lowest authored move priority), symmetric with switches resolving first.
- **Forced fallback (the reason it exists):** if none of a hero's currently-unlocked
  moves are affordable and there's no live bench hero to switch to instead, the hero
  would otherwise have **no legal action** — a softlock. The move grid is replaced
  with a single Rest button in this state (`FightScreen.tsx`); the engine itself
  doesn't gate on this (it executes whatever `Action` it's given) — legality here is
  a query the view/AI consult (`state.ts` `hasAffordableMove`), per `mana.md`
  "Engine placement".
- **Also freely choosable any other time**, as a deliberate tempo play — dump mana
  into one big hit, then Rest it back to full the following round. Not restricted to
  the forced case.
- Switching still takes priority as an *option* when a bench hero is available and
  the side isn't locked in: Rest only replaces the move grid, never the Switch
  button.

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

## The healing formula

```
Heal = HealPower           ← authored per move (MoveDefinition.healPower)
     × WisdomMult          ← the caster's Wisdom
     × STAB (1.25×)        ← the caster's types vs the move's type
```

```
WisdomMult = 1 + (effectiveWisdom − 50) / 100,  clamped to [0.5, 2.0]
```

Implemented in `engine/heal/healPipeline.ts` and applied by
`combat/resolveRound.ts`'s `heal` case. `effectiveWisdom` is read through
`getEffectiveStat`, so buffs, equipment, Class grants and Field Effects all
reach it without being folded back into a stat — the same two-pipeline
discipline the damage side keeps.

`HealPower` is the authored figure, **not** a guaranteed HP amount: it is what
a Wisdom-50 caster with no STAB restores. That reference point is deliberate,
so an authored number reads as "what an average caster gets" and the existing
values needed no retuning when the formula landed.

### What this buys

The same move is worth different amounts in different hands, which is the
entire point — a heal is a fact about the caster, not about the move:

| Caster | Move | Wis | STAB | Heal |
|---|---|---|---|---|
| Cinder (Fire/Iron) | Restore Vigor 40 | 40 | — | 36 |
| Sylva (Nature) | Mend Wounds 45 | 60 | — | 50 |
| Revenant (Spirit) | Mend Wounds 45 | 46 | ✓ | 54 |
| Solace (Light) | Restore Vigor 40 | 70 | ✓ | 60 |

Wisdom rather than the move's category off-stat (Intelligence/Attack) so that
support is **its own build axis** instead of collapsing into "mage who
sometimes heals" — a healer invests in a defensive stat, pays for it in
offence, and in exchange heals harder *and* survives to keep healing. It also
forecloses a degenerate case: a category rule would let a future physical
self-heal scale off a 90-Attack bruiser.

The 1-point-of-Wisdom = 1% shape lines up with the locked "flat additives in
multiples of 5 or 10" rule, so it reads at the design table as **"+10 Wisdom is
+10% healing"** — a Fortify visibly helps the healer.

### Three deliberate asymmetries with the damage formula

Each is a decision, not an omission. Re-adding any of them "for symmetry" is a
regression.

1. **No target max-HP term.** A heal buys *turns*, not hit points, and turns
   bought = heal ÷ incoming damage per hit. A wall's high Defence already makes
   a flat heal worth roughly 3× more turns on it than on a glass caster;
   scaling by max HP would multiply that same bias again and make low-HP heroes
   effectively un-healable — straight into CLAUDE.md's "no hero is a trap pick".
   Healing is absolute, and that is the point. It also means a `bothAllies` heal
   resolves **once** and pays every ally the same number.
2. **No variance.** Variance is load-bearing on *damage* — it blurs the kill
   range so the attacker cannot compute a guaranteed lethal. On a heal the
   planner and the randomised party are the same person, so it punishes correct
   play without creating a decision.
3. **No defender-side term at all.** Healing is unopposed: nothing scales
   against it. That is why the Wisdom term is a gentle linear nudge rather than
   a full off/def ratio, which would run away without an opposing stat, and why
   it carries a `[0.5, 2.0]` clamp.

### Heal-over-turn (Renew)

A HoT is healing, so it runs the same formula — **snapshotted at application
time** off the caster, not recomputed per tick off whoever holds it. Renew
persists through a switch (`conditions.md`), and the caster earned the
magnitude; re-reading the holder's Wisdom every round would make the same
Second Wind worth more on a bulkier ally who had nothing to do with casting it.
Decay-by-halving operates on whatever magnitude the snapshot produced.

The scaling is gated on `StatusDefinition.pipeline === 'hot'`, not on the
move's kind, so a damage move that grants Renew scales its Renew and a heal
move that inflicts Burn does not scale the Burn.

**Passive heals are not scaled.** `PassiveEffect { kind: 'heal' }` — Sanguine's
"heal for the amount that Bleed tick dealt" — is already derived from another
number; running it through the formula as well would compound two multipliers.

### Settled alongside the formula (2026-08-28 designer sign-off)

- **Wisdom is the heal stat**, and stays one. More ways to raise it are coming,
  which is also what earns the `[0.5, 2.0]` clamp its keep: nothing on the
  roster reaches either end today, so the guardrail is there for the stacking
  Wisdom sources that will exist, not for anything current. Do not remove it as
  dead code.

### Open questions

- **Balance target.** The invariant to tune against is that a heal turn restores
  *less* than an attack turn deals to that target. In doubles two enemies act
  per round against one healer, so even a heal at parity with a single attacker
  loses ground — which is what stops healing from stalling fights into a grind.
  The current move numbers are placeholders, so nothing is calibrated to this
  yet; it is the rule to calibrate *by* once real numbers are authored.

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
  switching a *productive* action, not a purely defensive one. Renew ticks at round
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
- **No percentage-of-max-HP healing, and no variance on heals.** Both are covered
  in "The healing formula" above, with the reasoning; both look like consistency
  fixes and are regressions.
