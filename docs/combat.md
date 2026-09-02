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

**A second crit source now exists (2026-08-29, from Fire's authored movepool):
`MoveDefinition.critChance`** — a per-move rate replacing the default for that move
only (Singe and Firebrand at 30%). This does not break the lock: the lock says crit
is not a *base stat* / per-hero authoring axis, and a move-authored rate is neither.
It does raise one question the lock did not anticipate, deliberately left **OPEN**:

> When a crit-chance accessory finally exists, how does it combine with a
> high-crit move — replace, add, or take-higher?

Do not settle that silently while implementing equipment crit. Additive is the
obvious default and is also the one that makes a 30% move plus a +15% accessory
strictly better than the designer priced either at.

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

## Drain (2026-08-30, Water)

`MoveDefinition.drainPercent` (`engine/content.ts`): a damage move returns a
fraction of what it removed to its user. Water's Siphon and Engulf are the first
content; the field is generic vocabulary, not a Water case.

**It does not run the healing formula, deliberately.** The number it scales has
already been through Variance, Crit, STAB and TypeMult *as damage*. Running
`HealPower × WisdomMult × STAB` over it as well would scale one action twice, and
would make a drain move's return a fact about the caster's Wisdom rather than
about the hit it is attached to. So:

- It scales the **HP actually removed**, not the rolled amount — overkill into a
  3-HP target returns 1, not half of 45.
- It resolves **after** the hit lands and **before** Conduct's detonation, as its
  own event (`HealedEvent.drain`), so the Battle Log's damage readout stays a
  readout of the damage formula.
- It is summed per target on a spread move (nothing authored is spread yet).

**Open question this leaves.** A drain's return is now the only healing in the
game that ignores Wisdom. That is right for a rider on an attack, and it is also
a second, parallel way to restore HP that support builds cannot invest in — if a
later type wants a drain that *does* reward the support axis, that is a second
field (a Wisdom-scaled drain), not a change to this one. Flagged rather than
settled.

## Cost that varies with state (2026-08-30, Water)

`MoveDefinition.manaDiscountOnUse`: each cast permanently lowers that move's cost
**for that combatant** for the rest of the fight, stacking, floored at 0. Water's
Wave Shred (80, then 60, then 40, …) is the first and so far only content.

Mana is the primary balance lever (CLAUDE.md), so a cost that moves is a real
extension of the lever rather than a convenience. Two rules keep it honest:

- The discount lives on the **combatant** (`state.ts Combatant.moveManaDiscounts`),
  never on the move — content is shared immutable data, and two heroes holding the
  same move must ramp independently.
- **Every** reader of "what does this cost right now" goes through
  `state.ts effectiveManaCost` — the engine's legality guard, the mana it spends,
  the view's affordability check, and the gem on the button. A second reader of
  `manaCost` is how a button ends up saying 80 while the engine charges 40.

**Open question: the first cast is never discounted**, so a hero whose pool
cannot reach the authored price can never start the ramp at all. Wave Shred at 80
is above every Water hero's pool today (Pincer, its only physical-Water carrier,
sits at 55) — the same shape as Fire's Inferno at 75, and reported rather than
tuned away. If the intent is "expensive to open, cheap to sustain", it works as
written the moment a mana relic or a Guild-Hall stat bump exists. If the intent
is "a ramp you can always start", the discount has to apply *before* the first
cast, or the authored cost has to come down. That is a designer call.

## Status-gated targeting (2026-08-30, Frost)

`MoveDefinition.requiresTargetStatus` (`engine/content.ts`): a move that may
only ever resolve against a combatant already carrying a named status. Frost's
Glaciate and Absolute Zero ("can only target Frozen enemies") are the first
content; the field is generic vocabulary, not a Frost case.

It is the **legality** counterpart to `conditionalPower.requiresTargetStatus`,
which asks the same question and hangs a damage bonus off the answer instead of
a restriction. Three rules:

- **An unmet gate fizzles the action for no mana**, exactly like the
  `noValidTarget` race — it is not a damage penalty, and there is no weaker
  version of the move that lands anyway. Its own `ActionBlocked` reason
  (`targetStatusMissing`), so the Battle Log says *why*.
- **It is read LAST**, after Stealth's redirect and Haunt's spread, because both
  of those move a hit onto a hero the gate never approved. A Frozen-only strike
  bounced by Stealth onto an unmarked partner fizzles rather than landing.
- **One function, both ends** (`statusEngine.ts statusGatedTargets`): the target
  picker refuses to offer an unsatisfiable move and the engine refuses to
  resolve it, off the same code, so declaration-time and resolve-time cannot
  drift apart.

**Open question this leaves.** This is the first move property that can make a
move *unpressable* rather than merely worse, which means a hero's usable
movepool is now a function of the board. Two heroes drafted with Absolute Zero
and no Freeze source between them would be a dead card — content-side today
(both Frozen-only moves sit in a pool that also carries Deep Chill and
Permafrost, and `test/frostMoves.test.ts` asserts the key ships with the lock),
but there is no *engine* rule enforcing it. If gated moves spread beyond Frost,
that assertion wants to become a content validator.

## Spending a status as a cost (2026-08-30, Frost)

`MoveDefinition.conditionalPower.consumesStatus`: the conditional multiplier
still scales the formula's BasePower input exactly as before, and the hit that
actually got the multiplier then **removes** the status it read
(`StatusRemoved`, reason `consumed` — the same reason Conduct's detonation
uses). Frost's Cold Snap is the first content.

- **Keyed off the multiplier that was applied**, not off a second status read,
  so a spread conditional move would strip the mark only from the target it
  doubled against.
- **Its own beat after the damage**, for the same reason Conduct's detonation is
  its own beat: folding it into `DamageDealt` would make the log's formula
  readout describe something other than the formula.
- **Opt-in.** Fire's Immolate authors `conditionalPower` without it and leaves
  the Burn alone; nothing about a conditional implies consumption.

The design tension it exists to create: a Frost side holding both Cold Snap and
a `requiresTargetStatus` move must choose, every time it lands a Freeze, between
cashing the mark in for double damage and keeping it as the key to a bigger move.

## Random targeting (2026-08-30, Storm)

Two new `TargetMode`s, `randomAlly` and `randomEnemy`, plus the same two values
on `StatusApplication.target` so a **rider can resolve its own target
independently of the move's**. Storm's Rising Static ("randomly give an ally
+20 Speed and an enemy Conduct") is the first content, and the first move in the
game whose payload lands on both sides of the field at once.

- **The pure resolver stays pure.** `resolveTargets` returns the candidate
  *pool* for a random mode; `resolveTargetsRolled` is the one that draws
  (`engine/combat/targeting.ts`). Random targeting is the one mode that cannot
  be a function of state alone, so it is fenced off rather than threaded
  through every caller.
- **Inert when absent.** A non-random mode leaves `rngState` byte-identical, so
  every fight authored before this replays exactly as it did — the same
  discipline as `StatusApplication.chance` and `cleanseCount`.
- **The move's target rolls first, then the rider's.** A fixed, documented draw
  order is what keeps the seed reproducible.
- **The view offers no picker.** Random modes are grouped with the fixed-group
  modes at declaration time: the target row shows who *could* be hit and doubles
  as the confirm control, because there is nothing to choose.

**Open question this leaves.** A two-sided move breaks the one-bit Buff/Debuff
glyph (`MoveTile.tsx isDebuff`), whose own comment predicted exactly this and
said the honest answer was probably *two* glyphs rather than a tiebreak. Rising
Static currently reads as **Debuff**, which is half true; the full payload is in
the effect summary, which names the side each half lands on. Left as-is
deliberately — two glyphs is a UI decision, not something to settle inside a
move slate.

## Priority that varies with state (2026-08-30, Storm)

`MoveDefinition.conditionalPriority`: adds a bonus to the move's bracket when
its **declared target** carries a named status. Storm's Electric Burst
("priority +1 if the target has Conduct") is the first content.

The one rule that matters, and it is forced rather than chosen: **it is
evaluated when the round is ORDERED**, off the pre-resolution board. A bracket
has to be settled before anything resolves, so a partner planting Conduct
earlier in the same round cannot retroactively speed this up. The mark has to
already be standing when you press the button, which turns the move into a
payoff for the *previous* round rather than a same-round combo.

This is a deliberate asymmetry with the cost condition below, which *is* read at
resolution and *can* see this round's work. Both are pinned by
`test/stormMoves.test.ts` so the difference changes loudly if it ever changes.

## Cost that varies with the BOARD (2026-08-30, Storm; extended 2026-08-30, Iron)

`MoveDefinition.conditionalManaCost`: a **replacement** price that applies while
the enemy side carries a named status. It has **two sides**, and a move authors
exactly one:

| Side | Reads | Content |
|---|---|---|
| `requiresAllEnemiesStatus` | every active enemy carries it | Storm's Overcharge, "costs 0 mana if both enemies have Conduct" |
| `requiresAnyEnemyStatus` | at least one does | Iron's Metallic Blade, "costs 0 mana if an enemy has Conduct" |
| `requiresPartnerType` | the caster's ACTIVE PARTNER is of a named type | Beast's Pack Leader, "costs 50 mana if partner is a Beast" |

The second authored cost that varies with state, and the first that varies with
something other than the caster's own history (`manaDiscountOnUse`, above).

- **A replacement, not a discount**, so "costs 0" is authored as 0 rather than as
  a subtraction to be checked against the base price. Composes with
  `manaDiscountOnUse` by taking the **lower**.
- **Both sides require at least one active enemy.** A wiped enemy side vacuously
  satisfies "every enemy is marked"; a condition nothing can meet must not read
  as met. The `some` side would answer false on its own, and the guard is
  shared rather than duplicated.
- **The two status sides read the ENEMY side only.** A mark that lands on the
  caster's own partner — which Storm's Rising Static can do, since its rider
  resolves its own target — never discounts anything. The third side is the
  exception that proves it: `requiresPartnerType` reads the caster's OWN row
  and nothing about the enemy at all (see "The same question, asked of the
  PARTNER", below).
- **Exactly one side, unenforced by the type system.** All three fields are
  optional and a move authoring none is a silent dud that never fires. Pinned
  across the whole move table by `test/ironMoves.test.ts`, the same discipline
  `conditionalPower`'s six siblings follow.

**Why "any" is a different mechanic and not a looser "all".** Iron is one of
Conduct's `triggerTypes`, so an Iron damage move *detonates* the mark it reads.
Swing Metallic Blade at the marked foe and it cashes the mark for 10% max HP and
ends its own discount; swing it at the *unmarked* foe and the mark survives, so
the next cast is free too. **Spend it or bank it** is a decision only the "any"
side can pose — a board satisfying "both marked" cannot survive the cast that
reads it, so Overcharge's discount is always self-consuming.
- **One board-aware reader, `state.ts resolveManaCost`**, for the same reason
  `effectiveManaCost` had one: the engine's spend, the view's affordability
  filter, the gem on the button and the crest all go through it.
  `effectiveManaCost` remains correct for surfaces with no live fight (draft,
  level-up, compendium), where the authored price is the honest answer.

**Open question this leaves.** Overcharge (60) sits in the pools of two 50-mana
heroes, so for Squall and Scallywag it is castable *only* at its conditional
price — a move whose row is dead until the board is fully marked. That is either
the best version of the design (a real payoff for a two-move setup, on the two
heroes whose kits can build it) or a row that reads as broken for the first two
rounds of every fight. Reported rather than tuned away, same as Fire's Inferno
and Water's Wave Shred. `test/stormMoves.test.ts` asserts the pairing holds —
any hero who can only afford a conditional-cost move at its discount can also
reach the status it needs — but nothing in the engine enforces it.

**And the Iron half leaves a sharper version of it (2026-08-30).** Metallic
Blade's 40 is affordable outright on Gallant's 45 pool, so it never trips that
assertion — but the Iron slate plants Conduct **zero** times (designer call:
Iron cashes the mark, a Storm partner or Mind's Cerebral Shock sets it). So the
discount is not gated on a setup Iron can perform; it is gated on a *team
composition*. It is the most partner-dependent row in the roster, and unlike
Overcharge nothing in a test can assert the pairing, because the pairing is not
within one hero's reach by construction.

## A move that switches its user out (2026-08-30, Storm)

`MoveDefinition.switchesUserOut` plus `MoveAction.switchToCombatantId`: the
move's payload resolves, then the caster goes to the bench and a **declared**
replacement comes in. Storm's Tailwind ("give your ally +40 Speed, switch out")
is the first content.

- **The incoming hero is chosen at declaration**, alongside the move's own
  target — a pivot is a real decision, and declare-then-resolve is what makes
  prediction the core skill (this file, "Turn & round structure").
- **It respects lock-in** (2026-08-30 designer call). Routed through
  `applyVoluntarySwitch`, so the LOCKED 2+ KO rule blocks it exactly as it
  blocks a declared switch. There is no exemption.
- **A block degrades the move rather than fizzling it.** The buff still lands and
  the mana is still spent; only the pivot half is refused, with its own
  `ActionBlocked` reason (`switchBlocked`). `requiresTargetStatus` is the
  engine's one hard *gate*, and lock-in is already a phase the player is being
  punished by — making Tailwind unpressable on top of that would punish twice.
- **Resolved last**, after every rider, so the payload lands on a board the
  caster is still standing on.

**Open question this leaves.** The view now has two ways to reach the bench
picker — a switch action and a pivot move — and only the first is on the
`SWITCH_PRIORITY_BRACKET`. A pivot resolves in its move's own bracket, which
means Tailwind's replacement arrives *after* attacks that a declared switch
would have dodged. That is almost certainly right (the pivot is paying for a
buff, not for the dodge), but it is a real difference between the two and it has
not been playtested.

---

## An offensive stat that is not the category's (2026-08-30, Stone)

`MoveDefinition.offStatOverride`: the ratio's **numerator** reads a named stat
instead of the one `category` selects. Stone's Body Blow and Body Crush
("calculates the user's Defense in place of Attack") are the first content.

**This is pipeline 1, and that is the whole point.** It does not scale anything;
it changes which of the attacker's stats is read *before the ratio is formed*.
The LOCKED two-pipeline separation is therefore untouched: nothing
damage-shaped entered the stat pipeline, and nothing stat-shaped entered the
multiplier term. A hero buffed to Defense 130 hits with 130 — the same number
Bastion and Toughen Up put there — rather than with a bonus derived from it, and
it composes with every multiplier term exactly as an Attack-based move does.

**Only the numerator moves.** The defender's half of the ratio still comes from
`category`: Body Blow is physical, so it still divides by the target's Defense.
The design row says "in place of Attack" and nothing about the defender, and
swapping both would make the move a Defense-vs-Defense mirror match, which is a
different move.

What it buys Stone is a type engine that is entirely visible: Toughen Up and
Bastion pour Defense in, Body Blow and Body Crush spend it as Attack. Unlike
Storm's Conduct — which fires off every Storm damage move for free and is
invisible in the design table — nothing here is hidden from the player, and
nothing is priced around a rider they cannot see.

---

## Damage that does not run the damage formula (2026-08-30, Stone)

`MoveDefinition.retributionPercent`: the move's entire damage body is a share of
`Combatant.damageTakenSinceLastTurn`. Stone's Retribution (50%) and Stoneheart
(100%) are the first content; both author no `basePower`.

**Fixed (true) damage — 2026-08-30 designer call.** The number is dealt exactly
as counted. No off/def ratio, no STAB, no TypeMult, no variance, no crit, no
multiplier term; `rollDamage` is never called, so these two moves **draw no RNG
at all**.

This is the first damage in the game that does not go through the LOCKED
formula, so it is worth being explicit about what that does and does not mean.
It does **not** break the lock: the formula is still the only way a *BasePower*
move computes damage, and nothing here changes a term of it. What it does create
is a second damage source the type chart cannot touch — a Stone-resistant
defender takes full retribution, and the caster's Attack is irrelevant. That is
the trade the fixed reading was chosen for: the player can do the arithmetic
before pressing the button, which is what makes "eat a hit, then answer it" a
plan rather than a gamble. **Open**: whether a future relic or equipment damage
modifier (`DamageModifier`, the multiplier term) should reach these two. Today it
does not, and "fixed means fixed" is the simplest defensible answer, but nothing
in the engine states that as a rule rather than as a consequence.

### The window: "since its last turn"

`Combatant.damageTakenSinceLastTurn` accumulates at `applyHpDelta` — the one
choke point every HP loss goes through — so it counts attacks, Conduct
detonations, Bleed and Poison ticks and a hero's own recoil without any of them
opting in. It counts **HP actually removed**, so overkill into a nearly-dead
hero banks what was there, not what was rolled.

It resets when the combatant **commits to an action**: a move whose mana is
spent, a Rest, or a completed switch. It does **not** reset on an action that
never happened — a Dazed hero, or one whose target gate went unmet, keeps
banking. That is the literal reading of the row, and it means a Dazed Stone hero
wakes up holding a very large Stoneheart, which is the correct payoff for having
lost a round. (Since Daze became flinch — 2026-08-30, `docs/conditions new.md` —
that is at most **one** round of extra banking rather than two, and only if the
Daze's applier was faster.)

The counter is **live**, which is what separates the two moves beyond their
percentages:

- **Retribution** is priority 0, so a faster enemy's opener this round is
  already in the bank when it resolves.
- **Stoneheart** is priority +1, so it acts before anything can hit it and only
  ever cashes in the previous round.

**Pressing it with nothing banked deals 0 and still costs the mana** (2026-08-30
designer call) rather than gating the move out of the kit the way
`requiresTargetStatus` does. Mistiming it is a real cost, and a button that is
always there is worth more than one that protects the player from themselves.

---

## Recoil (2026-08-30, Stone)

`MoveDefinition.recoilPercent`: the exact mirror of `drainPercent`, and it
inherits that field's reasoning wholesale — it scales the HP **actually
removed**, it is summed across a spread move's targets, and it runs no formula of
its own, because the number it scales has already been through the damage
formula once. Stone's Rubble Rush (75 BP for 25 mana, a quarter back as recoil)
is the first content: the mana price is deliberately low and the recoil is the
real cost.

Two things it does not share with drain:

- **It is paid once, after the whole target loop**, rather than per target.
  Healing cannot kill the caster mid-move; recoil can, and a caster that faints
  against its first target must not go on hitting the second.
- **It can faint the user** (2026-08-30 designer call — no 1 HP floor). It goes
  through `applyHpDelta` like any other damage, so a recoil KO counts toward that
  side's KO count and can be the hit that triggers your own lock-in.

This is the recoil shape `docs/authoring-moves.md` §4 listed as unavailable.
Fire's Volcanic Surge takes its recoil as a self-inflicted Burn instead and
should stay that way — that shape is better content where it fits (it halves,
and switching clears it). It does not fit here: a Burn is a flat authored
magnitude, and this has to be a fraction of a number nobody knows until the hit
lands.

---

## HP as a move's price (2026-08-30, Spirit)

`MoveDefinition.selfHpCost`: the **third** way a move can hurt its own caster,
and the only one whose price is knowable before the button is pressed. Spirit's
Soul Offering (`percentMaxHp: 0.25` — "user loses 25% of max HP") and Last Rites
(`reduceToHp: 1` — "user drops to 1 HP after using this") are the first content.

It is deliberately its own field rather than a mode on either of the other two,
because the three bill against different things:

| Shape | Bills against | Known when? |
|---|---|---|
| `recoilPercent` (Stone) | a fraction of damage this move **dealt** | after the hit lands |
| self-inflicted Burn (Fire) | a flat authored magnitude, spread over rounds | at authoring time, but paid later and cleansable |
| `selfHpCost` (Spirit) | the caster's **own bar**, now | before the move is pressed |

That last column is the mechanic. Recoil is an *outcome* — you press Rubble Rush
and find out what it cost. This is a *decision*: the button says −20 HP and the
player decides whether the +40/+40 on their partner is worth it. Soul Offering
has no damage body at all, so recoil could not have expressed it in any case.

**Two modes, one small union** — the same discipline as
`derivedStatDeltas.source`, so a later slate wanting "half of current HP" adds a
member rather than a field:

- `percentMaxHp` — a flat toll off MAX HP. It costs the same whether you are
  full or nearly dead, which is precisely what makes it dangerous at low HP.
- `reduceToHp` — end at N, losing however much that takes. **Never a heal**: a
  caster already at or below N pays nothing rather than being topped up. The
  wrong reading here would have turned a 120 BP move into a heal.

**It can faint the user**, with no floor (2026-08-30 designer call) — the same
answer `recoilPercent` got, and for a sharper reason. A Spirit hero cashing
itself in to leave its partner +40 Attack and +40 Intelligence is the play the
move exists to offer, and a floor would make the cost *cheapest* exactly when it
should be most dangerous. A `reduceToHp` move cannot faint anyone by
construction; a `percentMaxHp` one at low HP can, and it goes through
`applyHpDelta` like any other damage, so that KO counts toward the side's KO
count and can trigger your own lock-in.

**Paid last, after the payload lands** — the same placement and reasoning as
`switchesUserOut`, which it sits directly in front of, so a caster that killed
itself cannot then pivot. Soul Offering's buff therefore reaches the ally even
when the bill kills the caster, which is what makes it a sacrifice rather than a
gamble on surviving one.

It carries its own `DamageDealtEvent.selfCost` rather than reusing `recoil`,
because the Battle Log has to say which bill it is: *"Revenant pays 20 HP for
Soul Offering (25% of max HP)"* against recoil's *"takes 18 recoil (25% of 72
dealt)"*. Like recoil, every formula term on the event is an identity value —
no formula was evaluated, and printing a chain of 1× terms would be a readout of
a calculation that never happened.

---

## Stat deltas that land on their own side (2026-08-30, Stone)

`MoveDefinition.statDeltaTarget`: where `statDeltas` land, when that is not
simply the move's own resolved targets. Stone's Landslide ("spread damage;
allies gain +20 Defense") is the first move whose damage and whose buff resolve
on **opposite sides of the field**, so the two cannot share one resolution.

The `statDeltas` equivalent of `StatusApplication.target`, and it exists for the
same reason and works the same way. Deliberately a small union
(`'moveTarget' | 'self' | 'bothAllies'`) rather than the full `TargetMode`: the
random modes are excluded because a second independent RNG draw inside one
action is a determinism question worth asking before it is worth having, and
`singleAlly` is excluded because there would be no second target to declare.
Omitted means `'moveTarget'`, which is every move authored before it.

---

## A damage bonus you set up on yourself (2026-08-30, Nature)

`MoveDefinition.conditionalPower.requiresUserStatus`: the same BasePower-stage
multiplier Immolate and Cold Snap use, asked of the **attacker** instead of the
defender. Nature's Seed Shot (30 BP) and Branch Slam (80 BP) are the first
content — both "double damage if the user has Renew", neither consuming it.

A sibling field rather than a `side` discriminator on the existing one: the two
ask genuinely different questions and a move asking both at once has no meaning
worth guessing at. Everything else about the field is unchanged — it scales the
formula's BasePower **input**, not the finished hit (the two-pipeline separation
is LOCKED), it is read off live statuses at resolution, and `consumesStatus`
now spends it from whichever combatant the condition read.

Two consequences worth stating rather than discovering:

- **It is all-or-nothing across a spread.** The target-side form is re-read per
  hit and can double against one foe and not the other; the user-side form asks
  one question about one combatant, so every target of a single cast gets the
  same answer.
- **It reads live, so a partner counts.** A Regrowth cast by a faster ally
  earlier in the same round is already on the attacker when Branch Slam
  resolves. This is the type's whole tempo shape and it is deliberate — Nature
  is the first type whose damage line asks the *support* half of the side to
  act first.

What it changes about the game, which is bigger than the field: a damage bonus
that lives on the caster is one nothing on the enemy side can play around.
Freeze, Burn and Conduct can all be dodged by cleansing, switching, or simply
not being the target; Renew cannot be stripped (it is `positive`, so Cleanse
never touches it) and does not clear on switch.

**Resolved 2026-08-30 (designer call): that is the point.** See "Renew's
stacked payoffs" below — a status whose only job is to tick quietly is not
worth a turn, so the payoffs hanging off it are *supposed* to be large and
*supposed* to be uninterruptible. Do not price this as a risk.

---

## A damage bonus that lives on the board (2026-08-30, Light)

`MoveDefinition.conditionalPower.requiresFieldEffect`: the third sibling on the
same BasePower-stage multiplier, asking about neither combatant. Light's Smite
(50 BP) is the first content — "double damage if Sanctuary is active".

A sibling field rather than a `side` discriminator, for a blunter reason than
the user-side one: a field effect is not a status and **nobody holds it**, so
there is no "whose" to answer. `CombatState.activeFieldEffect` is one global
slot (`docs/field-effects.md`), which means the question has exactly one answer
per moment for every hit on the board. Everything else is unchanged — it scales
the formula's BasePower **input**, not the finished hit (the two-pipeline
separation is LOCKED), and it is read at resolution, so a Consecrate cast by a
faster ally earlier in the same round already counts.

Three consequences worth stating rather than discovering:

- **All-or-nothing across a spread**, for the same reason the user-side form
  is: one question, one answer.
- **The enabler is global, so it arms both sides.** The Consecrate a Light hero
  casts to heal its own team also switches on an enemy Smite. That is the
  locked shape of the subsystem, not an oversight.
- **It is the first damage condition with a clock and an override.** Statuses
  are removed by cleansing, switching or expiry; a field effect is displaced by
  *any other field effect* and runs out after 5 rounds regardless. A Surging
  Magic cast by either side is now counterplay to a Light damage move — the
  first time the field-effect slot has been contested for a reason other than
  its own effect.

`consumesStatus` is **inert** on this form: there is no holder to strip it
from, and ending a global both-sides field early is a different mechanic.
`test/lightMoves.test.ts` pins that it is a no-op rather than a guessed-at
third meaning.

**Open, deliberately:** gating on a field effect's **absence** ("×2 while no
field is up"), and on *any* field rather than a named one, are both
expressible-looking and neither is decided. Neither is authored today.

---

## A damage bonus that reads a NUMBER (2026-08-30, Shadow)

`MoveDefinition.conditionalPower.requiresTargetHpBelow`: the fourth sibling on
the same BasePower-stage multiplier, and the first damage condition in the game
that asks about a **quantity** rather than the presence of something. Shadow's
Rend (40 BP / 30) and Eclipse (100 BP / 80) are the first content — "double
damage if the target is below 50% HP".

Authored as a fraction rather than a boolean flag, so a later slate can write a
0.25 execute without a second field. Everything structural is unchanged from
its three siblings: it scales the formula's BasePower **input**, never the
finished hit (the two-pipeline separation is LOCKED), and it is read against
live state at the moment the hit resolves.

Four things fix its shape, and each was a real fork:

- **Read BEFORE the hit's own damage.** An execute can never double off HP it
  is itself about to remove. That is what makes it a *reward for pressure* — the
  bonus is paid for by whatever softened the target on an earlier action, which
  is exactly the partner-pressure a doubles game wants to price. The other
  reading (check after, so a big hit executes itself) would have made the move a
  self-contained nuke.
- **Strictly below**, so a target sitting on exactly half is not yet
  executable. Pinned in `test/shadowMoves.test.ts` because "below 50%" has two
  readings and the engine only implements one.
- **Read per target**, like the target-status form and unlike the user-side and
  field ones. A spread execute would double against the wounded foe and not the
  healthy one. No content is spread *and* an execute today; the shape is pinned
  so a later slate can author one.
- **`consumesStatus` is inert on it**, exactly as on the field form — there is
  no status and no holder to strip. `resolveRound` resolves the holder as
  `requiresTargetStatus ?? requiresUserStatus`, which this form leaves
  undefined, so a greedy authoring is a no-op rather than a third meaning.

**The one thing worth watching, and NOT settled here.** Every condition before
this one could be answered by looking at a status strip or the field banner —
present or absent, and the player either put it there or the enemy did. An HP
threshold is a *continuous* board state nobody chose, so an execute is the first
damage bonus with no counterplay other than healing above the line, and the
first that gets stronger precisely as the target gets closer to dying anyway.
That is a normal roguelike shape (Pokémon's Brine, VGC's Low Kick family) and
Shadow is a deliberately aggressive type, but it is a category and not a move:
if a second type wants one, it should be priced knowing that this bonus and its
target's remaining HP move in the same direction.

**Open, deliberately:** the *user*-side version ("double damage while YOU are
below half"), an inverse ("double against a target above half"), and reading
any other continuous quantity — mana, stat totals, rounds elapsed — are all
expressible-looking and none is decided. None is authored today.

> **The user-side version is no longer open — Spirit authored it the next day.**
> See the section below. The inverse and the other quantities remain open.

---

## The same NUMBER, asked of the USER (2026-08-30, Spirit)

`MoveDefinition.conditionalPower.requiresUserHpBelow`: the fifth sibling, and
the mirror of `requiresTargetHpBelow` across the field — the relationship
`requiresUserStatus` already has to `requiresTargetStatus`. Spirit's Spite
(35 BP / 25, ×2 below 50%) and Vengeance (60 BP / 45, ×3 below 25%) are the
first content.

Structurally it inherits everything: a fraction rather than a flag, scaling the
formula's BasePower **input** and never the finished hit, strictly below the
line, and `consumesStatus` inert on it for the same reason it is inert on the
field and target-HP forms. Two moves at two different thresholds in one slate
is why the fraction was worth keeping.

**Two things make it a genuinely different mechanic, not the same one pointed
backwards:**

- **Asked ONCE PER CAST, off a snapshot taken before the target loop.** The
  target-side form is re-read per hit; this one is not, matching the user-status
  and field forms. The snapshot is load-bearing rather than incidental: a move
  carrying both this and `drainPercent` would otherwise heal itself back over
  the line between its first target and its second, and a cast would be doubled
  against one foe and not the other for reasons the player cannot see. On this
  type it is not hypothetical — Haunt turns every single-target Spirit move into
  a two-hit cast, so Spirit content asks "per target or per cast" constantly.
- **The condition is a resource the caster spends, not one it inflicts.** An
  execute gets more likely as its victim dies; this gets more likely as *you*
  die. Spirit's damage ceiling and its survival are deliberately the same bar,
  and the type ships its own way to cross it (`selfHpCost`, below) — Last Rites
  drops the caster to 1 HP, which is under every threshold there is, and hands
  the survivor straight to Vengeance.

**The counterplay difference, and it is worth stating because it inverts
Shadow's.** An execute has no counterplay but healing above the line, and the
enemy chose none of it. This one is bounded by the opposite problem: the caster
has to *survive at low HP* to collect, so every point of pressure the enemy
applies is simultaneously enabling the bonus and threatening to remove the hero
holding it. It is self-limiting in a way the target-side form is not, which is
why ×3 at 25% is affordable here where it would not be as an execute.

---

## The same question, asked of the PARTNER (2026-08-30, Beast)

`requiresPartnerType`: the first condition in the game that reads **a
combatant on the caster's own side of the field**, and the only one a player
answers at *draft* time rather than during a fight. Beast authors it in three
places, because the same question hangs a different mechanic each time:

| Field | Hangs | Content |
|---|---|---|
| `conditionalPower.requiresPartnerType` | a BasePower multiplier | Pack Hunt, "double base power if partner is a Beast" |
| `conditionalManaCost.requiresPartnerType` | a replacement price | Pack Leader, "costs 50 mana if partner is a Beast" |
| `conditionalStatDeltas` | a multiplier on the move's own stat grants | Prowl, "+10 Attack and +10 Speed, doubled if partner is a Beast" |

Three sibling fields rather than one shared predicate, for the same reason
`conditionalPower`'s six siblings are siblings: content is **data, not a
predicate function** (CLAUDE.md "Architecture"), and a move that wanted two of
these at once would be unauthorable if they were folded into one.

**What "partner" means — one answer, one reader.** `state.ts
activePartnerTypes` is the only place that resolves it, and it settles three
things (2026-08-30 designer calls):

- **The ACTIVE partner only.** The hero in the other active slot. The bench
  does not count, so switching a Beast in turns the condition on and switching
  one out turns it off — which is what makes it a doubles condition rather
  than a roster one.
- **A fainted partner counts for nothing**, exactly like an empty slot.
- **Effective types** (`grantedTypes` included), so a hero that grafted Beast
  through an Evolution satisfies it exactly as an innate Beast does. This is
  load-bearing rather than incidental: the roster has **one** native Beast
  hero, and the three heroes with a Beast type-graft path (Sylva, Rime,
  Mordrax) are how a player's own team reaches the condition at all.

**Read LIVE, at resolution**, which puts it with `conditionalManaCost` and
`conditionalPower.requiresFieldEffect` rather than with
`conditionalPriority`. The consequence is real and was accepted rather than
designed around: a partner KO'd by a faster action earlier in the same round
takes Pack Leader's discount away **after** the player committed, and if the
caster can no longer cover the difference the action fizzles for no mana —
the same shape a cleansed Overcharge already had.

**The locked decision it brushes against.** Nothing here breaks the
two-pipeline separation (the multiplier is a BasePower-stage input like its
five siblings) or the flat-stat-modifier rule (doubling a multiple of 5 is a
multiple of 5). What is new is the **counterplay surface**: every damage
condition before this one could be answered by the defender — cleanse the
Burn, switch off the Freeze, displace the field, heal above the line. A
partner's TYPE cannot be interacted with at all. It is not answered, it is
*drafted*, and the only thing that changes it mid-fight is the holder's own
switch. Recorded rather than settled by accident, along with the shapes
deliberately left unbuilt: reading the partner's type on the **enemy** side,
reading anything about a partner other than its type, and any version that
counts the bench.

---

## A move that applies more than one status (2026-08-30, Beast)

`MoveDefinition.statusApplication` is now **one rider or a list of them** —
Beast's Toxic Fangs, "afflict Bleed and Poison 10". `docs/authoring-moves.md`
§3 had carried "a move can carry exactly ONE statusApplication" as an engine
change to raise before building since Fire; this is that change, and the
designer's answer was to widen the field rather than re-cut the row.

A union rather than an unconditional array, with `content.ts
statusApplicationsOf` as the single reader every consumer goes through. That
is what keeps the ~50 moves authored before it byte-identical in both the data
and the code path.

Three things fix its shape, and the third is the one that matters:

- **Ordered.** Riders resolve in authored order, so a row reading "apply X,
  then Y" is true rather than incidental — the same discipline
  `detonatesStatus` resolving after `statusApplication` already established.
- **Independent.** Each rider resolves its own targets and rolls its own
  `chance`, and each feeds its own passive reactions before the next runs. Two
  riders on one cast are two applications that share a cast, not a compound
  status.
- **A one-rider move draws exactly the RNG it drew before.** The list path adds
  no draw of its own, which is the determinism rule every optional field since
  Fire has been added under (`docs/architecture.md` "Determinism & RNG"), and
  it is pinned in `test/beastMoves.test.ts` by casting a one-rider and a
  two-rider move from the same state and comparing `rngState`.

---

## Apex Predator's doubling: a derived grant that reads a stat (2026-08-30, Beast)

`derivedStatDeltas.source` gains `'userEffectiveAttack'` — a second member of
an existing union rather than a new field, which is exactly the extension
`content.ts` predicted when Arcane authored the first one.

"Double the user's Attack" is expressed as *grant Attack equal to the Attack
you currently have*, which is what makes it a doubling rather than a flat
number. The designer's call (2026-08-30) was to read **what the bar reads** —
base, plus equipment and relics, plus this fight's buffs, minus its debuffs —
through `getEffectiveStat`, with three consequences that are the whole point:

- **Setup compounds into it.** Rally (+20) and Prowl (+10/+20) before it are
  doubled along with everything else, so Beast's buff rows are a ramp rather
  than a list.
- **A second cast doubles the doubled figure** (90 → 180 → 360). It reads the
  number on the board, the same rule and the same reasoning as
  `doublesStatReductions`; nothing memoises the original.
- **A debuffed caster doubles the debuffed number**, and the floor of 1 applies
  here like everywhere else.

It takes the same exemption from the multiples-of-5/10 rule the mana member
does, and needs it for the same reason: an effective Attack of 53 doubles to
106, and rounding would make the grant disagree with the numeral on the
caster's own stat block. That remains the ONE documented hole in the lock, now
with two members rather than one — a third source should be a conversation,
not a habit.

---

## Base Power that is rolled, not authored (2026-08-30, Mech)

Mech's Jackpot is the first move with no authored `basePower` at all: the
figure is rolled uniformly in [50, 150] at the start of every round and
**shown on the button** before the player commits
(`MoveDefinition.randomBasePower`).

**It is not a second Variance term, and the distinction is load-bearing.**
`Variance` (0.85-1.0, LOCKED, "never remove") is a post-hoc multiplier on the
formula's RESULT that nobody sees before the hit lands. This is a
BasePower-stage input, resolved before the formula runs, and its whole value is
that it is legible in advance — a 61 is a reason not to press the button, which
a hidden roll could never be. The two compose rather than collide, and the
composition is worth stating once: a 50 roll into a 0.85 variance is 42.5
effective power, a 150 into a 1.0 is 150, so **one button spans a 3.5x range**.
That is the widest damage spread in the game by some distance and it is the
intended shape of the row, not a tuning accident.

Because it is a BasePower-stage term it composes with the other two exactly as
an authored number does: `conditionalPower` multiplies the rolled figure, and
Elemental Force is added afterward — the same "multiply, then add" order
Immolate established.

### Randomness that does not come off the shared stream

`resolveRandomBasePower` (`engine/state.ts`) is the first randomness in the
engine that is not drawn from `CombatState.rngState`. `seededRng.ts`'s rule —
its mulberry32 is the only randomness source allowed under `/src/engine` —
still holds, because this uses that same PRNG. What changed is that the SHARED
STREAM is no longer the only place a roll may live.

The value is **derived**: a pure function of
`(seed, round, combatantId, moveId)`. That was forced rather than preferred.
The view has to read the number to paint the button, and a read that advanced
`rngState` would let a player re-roll Jackpot by opening the move dossier
twice. The two alternatives are both worse:

- A **stored** roll needs a new `CombatState` field, a seeding pass in both
  state builders, and a place in the documented draw order.
- A **stream** draw cannot be read before the round resolves at all, which is
  precisely what the design row requires.

Deriving it also bought three properties for free rather than by design: it
re-rolls each round (`round` is an input), it differs per hero
(`combatantId` is one), and every fight authored before it replays
byte-identically, since nothing advances.

**The rule this establishes, and the one to apply to the next random field:**
a roll the player reads BEFORE committing must be derived from state; a roll
they discover AFTER committing must come off the shared stream. Mech's other
three random fields (`randomPriority`, `randomStatDeltas`,
`randomStatusApplication`) are all in the second category and all draw
normally. `randomPriority` is the sharpest case — it is rolled when the round
is ordered, after both sides have committed, and keeping it off the derived
path is what makes Cog Bop a gamble instead of a bracket the player could read
off in advance and plan around.

**Open, deliberately.** Whether a future crit-chance accessory, a damage
modifier, or an Elemental Force grant should be able to shift a rolled range
(rather than the rolled result) is unanswered. Nothing needs it, and "+20 to
the low end of Jackpot" is a different kind of effect from anything the
loadout layer does today.

## Renew's stacked payoffs (LOCKED — 2026-08-30 designer sign-off)

Renew is currently read **three separate ways**, and as of the Nature slate all
three can land on one hero at once:

1. **It heals.** End of round, then halves (`docs/conditions new.md`),
   snapshotted through the healing formula at cast time so the caster's Wisdom
   and STAB are already inside the stored magnitude.
2. **It is a damage condition.** `conditionalPower.requiresUserStatus` — Seed
   Shot and Branch Slam double while the user carries it.
3. **It is a stat.** Under Verdant Earth
   (`FieldEffectDefinition.statBonusEqualToStatusMagnitude`) every hero gains
   flat Attack and Intelligence equal to their **own** current Renew, and the
   Nature slate ships two setters for that field effect.

The consequence at the top of the curve: Overgrowth's Renew 100, snapshotted
through a Nature caster to roughly 125, is simultaneously ~250 HP of healing
across the fight, a doubling of an 80 BP move, and +125 Attack and +125
Intelligence on one hero — larger than any base stat in the roster — decaying
by half a round at a time.

**This is intended, not a stacking accident.** The reasoning is about what
Renew *is*: a slow, passive effect that does nothing on the turn you spend on
it, and returns its value in halving instalments over the rounds after. A
status shaped like that has to have powerful payoffs or it is never worth the
turn — every point of "safe" you tune out of it is a point of "why would I ever
press this". The three readings are the payoff, and the halving curve is the
limit on them: the +125 is +62 next round and +31 the round after, so the swing
is a window a hero has to actually use, not a standing buff.

What this means for a future slate: **do not report Renew's payoffs stacking as
a finding**, the same way "the capstone costs more than a starting pool" is no
longer a finding (`docs/mana.md`). A *fourth* reading of Renew would be a new
conversation — three is the count that has been signed off. Real findings in
this area would be a payoff that does **not** decay with the magnitude
(breaking the window that limits all three), or one that reads a *different*
hero's Renew than its holder's.

**Open, and separate from the above:** the magnitudes themselves are untested
in play — 2026-08-30, "we'll see how these work in practice". The shape is
locked; the numbers are not.

---

## Detonating a status on demand (2026-08-30, Nature)

`MoveDefinition.detonatesStatus`: fires a **timer-shape** status's stored
payload on the move's resolved targets now, instead of when its clock runs out.
Nature's Miasma ("apply Poison 5, then instantly detonate Poison") is the first
and only content.

- **Resolved after the move's own `statusApplication`**, which is what makes
  the design row's "apply, THEN detonate" true rather than merely the order it
  was written in: the 5 Miasma plants is part of what goes off. Into a clean
  target it is worth 5% of max HP; into a Blight + Corrode + Thorn Whip stack,
  45%.
- **Worth exactly what the expiry would have been** — `magnitude`% of the
  holder's max HP, the same number `tickEndOfRound` pays at duration 0. That
  equality is the invariant the move is priced against: Miasma buys *time*, not
  damage. If the two ever diverge it has quietly become its own damage source.
- **Gated on the status SHAPE, not on an id.** Only `pipeline: 'timer'`
  statuses hold an unspent payload, so only they can be detonated; naming Burn
  or Renew is a silent no-op, the same guard discipline `statusApplication`'s
  unknown-id lookup uses.
- **Spent, not expired** (`StatusRemoved`, reason `consumed`), and emitted as
  `StatusDetonated` → `StatusRemoved` → `HpChanged` — the same three-event
  run Conduct's detonation produces, so the view bundles it into one beat with
  no new presentation vocabulary.

Like Stone's retribution, this is **fixed damage the damage formula never
touches**: no ratio, no STAB, no TypeMult, no variance, no crit, and no RNG
drawn. The same open question therefore extends to it — whether a future relic
or equipment `DamageModifier` should reach a detonation. It does not today, and
"fixed means fixed" remains the simplest defensible answer, but the game now has
**two** independent damage sources outside the type chart rather than one, which
is worth deciding on purpose rather than by accumulation.

---

## Targeting that varies with the board (2026-08-30, Arcane)

Arcane's Overload is "spread if Magical Surge is active" — the first move whose
**targeting** depends on the state of the fight. `MoveDefinition.conditionalTarget`
names a field effect and a replacement `TargetMode`; `state.ts resolveTargetMode` is
the one board-aware reader, exactly as `resolveManaCost` is for price.

**Read at RESOLUTION, not when the round is ordered** (2026-08-30 designer call). The
precedent was split and the split is principled:

- `conditionalPriority` reads the board as the round is ORDERED, because a bracket
  has to be settled before anything resolves. It genuinely cannot see a same-round
  setter.
- `conditionalManaCost` and `conditionalPower.requiresFieldEffect` read at
  resolution, because nothing forces them earlier.

A target list is in the second group: it is already resolved per action, in order. So a
partner casting Mana Font earlier in the same round *does* spread Overload, and the two
are a combo rather than a two-round setup.

Three consequences worth knowing:

- **The player still declares against the authored mode.** Overload is authored
  `singleEnemy`, so the target panel opens as normal and the second target is simply
  added on the way in. The move button carries a chip saying whether the swap is
  currently on, so it is never a surprise.
- **Everything downstream reads the EFFECTIVE mode.** Stealth's redirect, Provoke's
  redirect and Haunt's expansion all treat a conditionally-spread move exactly as they
  treat an authored `bothEnemies` one.
- **The enabler is global and has no owner**, like every field-effect condition
  (`docs/field-effects.md`): an enemy's Magical Surge spreads your Overload, and any
  other field effect displaces it and switches the spread back off.

Deliberately left unbuilt, rather than guessed at: a status-gated version of the same
thing, a condition that NARROWS targeting instead of widening it, and any conditional
target read off something other than the one global field slot.

---

## Stat modifiers

- Stat modifiers are **flat numeric additives** — not the VGC stage/bracket system.
  A +10 Attack modifier adds 10 to effective Attack.
- They flow through the **stat pipeline**, so they change the `Atk/Def` ratio (and
  Speed, and so on), never the damage multiplier term.

### A stat grant with no authored number (2026-08-30, Arcane)

Arcane Overflow grants both allies "Attack and Intelligence equal to the user's current
Mana (before casting this)". `MoveDefinition.derivedStatDeltas` is the field: a small
`source` union (`'userManaBeforeCast'` is its only member today) plus the stats it
feeds. The engine expands it into ordinary `StatDelta`s at cast time, so everything
downstream — the target resolution, the `StatChanged` events, `statModifiers` itself
— is byte-for-byte the path an authored delta takes.

Two decisions in it:

- **Read BEFORE the mana is spent.** The design row says so, and it is the shape of
  the move: it cashes in a pool the player spent turns filling, so charging the 80
  first would quietly make it worth 80 less than it reads. Nothing is spent by the
  read — the mana is still there afterwards, which is the point.
- **It is the one documented EXEMPTION from the multiples-of-5/10 rule**
  (2026-08-30 designer call). A mana pool is whatever it is; rounding the grant would
  make the buff disagree with the numeral on the caster's own bar. The lock still binds
  every *authored* delta, and `isValidFlatStatGrant` deliberately does not reach here.
  `test/arcaneMoves.test.ts` pins both halves: this grant lands unrounded, and every
  authored `statDeltas` entry in the game is still a multiple of 5.

Overflow mana counts (`docs/mana.md`), which is the combo the slate is built around:
Font of Power banks 150 past the pool, Arcane Overflow reads the whole figure, and the
mana is still available to spend. That is the same *shape* as Renew's stacked payoffs
(below) and is intended for the same reason — a turn spent not attacking has to buy
something worth the turn.

### A stat grant that is CONDITIONAL on the board (2026-09-01, Fang)

`PassiveDefinition.conditionalStatGrants` (engine/content.ts) is a flat stat grant
that applies only while a board condition holds. First and only content:
**Bloodthirsty** (Fang's Bloodhunt Evolution) — *+20 Attack and +20 Speed while an
enemy is Bleeding.*

It is resolved **live inside `getEffectiveStat`**, on every read, rather than applied
once and revoked later. That placement is the whole decision, and the alternative was
tried on paper first: a reactive `statDelta` off `StatusApplied` would have been wrong
in four ordinary situations that all happen in a normal fight — the Bleeding enemy
switches out, faints, is cleansed, or simply runs its Bleed down. A granted buff
survives all four. There is no "un-apply" verb in the effect vocabulary, and adding one
to serve this would have been the worse design.

Three properties follow from it being a stat hook rather than an effect:

- **It is stat pipeline, not damage pipeline.** Flat additive integers, multiples of
  5/10, feeding the off/def ratio and Speed — never a multiplier term. The
  two-pipeline separation is untouched.
- **Every reader has to see it.** Speed decides turn order, so `orderActions`
  (priority.ts) takes the passive catalog for exactly this reason; the fight screen
  builds one `StatContext` and hands it to every card, dossier and damage forecast, so
  the number displayed and the number rolled cannot disagree.
- **`getMaxHp`/`getMaxMana` deliberately do NOT pass a board.** A conditional grant
  naming `hp` or `manaPool` would swing a hero's maximum mid-fight, which is a
  different and much messier mechanic. No content does it; if some should, that is a
  conversation.

The condition vocabulary is deliberately one member wide (`requiresEnemyStatus`, read
against **active** enemies only — a benched opponent has not been committed to the
fight). Grow it when content needs a second condition, the same discipline
`PassiveHook` and `StatusDefinition.triggerTypes` follow.

### A reaction that lands on the hero it just hit (2026-09-01, Riptide)

`PassiveEffectTarget` gained **`'triggerTarget'`**. Content: **Static Tide** (Riptide's
Maelstrom Evolution) — *every Water attack this hero lands leaves its target
Conducting* — which then feeds its own grafted Storm moves, since Conduct detonates off
any Storm or Iron hit.

The existing `'triggerSubject'` could not express it. A condition reading "**I** dealt
this hit" is `subjectRole: 'source'`, and `'triggerSubject'` follows that role — so the
mark would have landed on the attacker. `'triggerTarget'` is the event's target-role
combatant *whatever the condition read*: the defender of a `DamageDealt`, the arriver of
a `SwitchedIn`. The two are the same target for every target-role passive already
authored, and only diverge for the source-role ones — which is exactly the case that had
no vocabulary.

Attribution is unchanged: the condition still says whose hit it was, so a partner's
Water move plants nothing, and a spread Water move marks each target once (one
`DamageDealt` each). `test/passives.test.ts` pins all four.

> **The content moved, the mechanism did not (2026-09-02).** Evening the starter graft table
> to exactly 2 per type turned Riptide's Storm graft into **Water/Mind**, which would have left
> Static Tide planting a mark nothing could cash. Its replacement, **Enthrall** (Siren), is the
> same shape transposed: Water plants **Haunt**, and the grafted **Mind** line cashes it, because
> `Haunt.spreadTriggerTypes` is Spirit and Mind. Planting and cashing stay in two different
> columns either way — that separation is what makes the graft load-bearing rather than flavour.
>
> **Static Tide and Shock Bubble are RESERVED, not deleted** — held for a future recruit-only
> Water hero that grafts Storm. The passive keeps its four tests (nothing grants it, so nothing
> else covers it), and Shock Bubble sits in the pinned orphan list in `stoneMoves.test.ts` with
> the reason written next to it.

### Reacting to a stat CHANGE (2026-09-02, Rime)

`PassiveHook` gained **`'StatChanged'`**. Content: **Frozen Stone** (Rime's Glacier
Evolution) — *whenever this hero's Defense rises, Freeze a random enemy* — which pairs with
the Stone line the same path opens: Toughen Up and Bastion are now openers, and Body Crush
cashes the Defense back out as damage.

Three pieces had to exist for one passive, and each is worth knowing separately:

- **`eventFieldPositive`** (a `PassiveTriggerCondition` field) names a numeric event field
  that must be `> 0`. It is the whole difference between "rises" and "changes": without it
  Rend Armor would freeze someone for peeling Rime's armor off. A missing or non-numeric
  field never matches — an unreadable condition is a no-fire, not a free pass.
- **`PassiveEffectTarget 'randomEnemy'`** is the first passive target that costs RNG. It
  draws exactly one `nextInt` and only when a passive asks for it, so every existing golden
  replay is byte-identical. Fainted foes are dropped from the pool before the draw, and an
  empty pool draws nothing at all.
- **The hook is fed from a MOVE's stat deltas**, at one checkpoint after both blocks that
  write `statModifiers` and before the move's own status riders. A stat change a *passive*
  caused does not chain into another passive — the reaction pass never re-scans what it
  produced, which is what keeps two stat-reacting passives from feeding each other.

`StatChanged` carries no source, so it is target-role only: the subject is the hero whose
stat moved, and `relativeTo` is what says whose hero that is.

### A payout READ off the event, and a reaction aimed at the partner (2026-09-02, Sylva)

Two additions, both from one hero's Evolution node.

**`PassiveAmount` now names its field.** `matchTriggerAmount` gained an optional
`field` (default `'amount'`, so Sanguine and the two Class passives are untouched), and
`PassiveEffect { kind: 'applyStatus' }`'s `magnitude` accepts a `PassiveAmount` as well
as a flat number. Content: **Restorative Toxin** (Apothecary) — *whenever this hero
applies Poison, it gains twice that amount as Renew* — which reads `StatusApplied`'s
`magnitude` at `multiplier: 2`. Before this, a passive could only hand out a magnitude
the author had typed, so "twice what you just did" had no vocabulary; the `heal`
primitive had it and `applyStatus` did not, for no reason beyond nobody having needed it.

> **Units differ across the 2x, deliberately noted rather than fixed.** Poison's
> magnitude is a *percent of the victim's max HP*; Renew's is *flat HP on the caster*.
> So Toxic Spores (Poison 10) pays Renew 20 — a quarter of Sylva's 80 HP — and Blight,
> which is Poison 20 on *both* foes, fires twice for Renew 40 each, stacking to **80**
> off one cast. Poison stacks too, so a re-application pays again. This is inside the
> "Renew payoffs are intended" call, but 80 is the number to watch first.

**`PassiveEffectTarget` gained `'ally'`** — the owner's *active partner*, never the owner,
resolving to nobody when the owner is alone on the field — and **`PassiveEffect` gained
`{ kind: 'cleanse' }`**, the same `cleanseStatuses` a move's `cleanses` flag runs, with an
optional `count`. Content: **Nature's Purification** (Lightsage) — *when this hero enters
the battlefield, its partner is Cleansed*. Every passive target until now pointed at the
owner, at the event, or at the enemy side; a doubles game with a bench needed one that
points at the hero standing next to you. Cleanse spares `positive` statuses, so it never
strips the partner's own Renew. `test/passives.test.ts` pins all five.

### Reacting to a stat DROP, and off-type coverage as policy (2026-09-02, Cortex)

`PassiveTriggerCondition` gained **`eventFieldNegative`**, the exact mirror of the
`eventFieldPositive` Rime needed, on the same terms: a missing or non-numeric field
never matches, and zero is neither a rise nor a drop. Content: **Entanglement**
(Cortex's Overmind Evolution) — *whenever an enemy's Wisdom drops, that enemy is
Haunted*.

The pairing is the point. Wisdom is the magical `defStat`, so the same debuff that
softens a target now also marks it, and Cortex's slate is a Wisdom shredder end to end
(Psi Bolt, Enervate, Psychock, Disorient, Psionic Wave). Haunt then expands any
**`singleEnemy`** Mind or Spirit move onto the marked hero's partner — and only
`singleEnemy` expands, locked — so Disorient marking both foes turns every single-target
cast into a spread without ever double-hitting a move that already spreads.

> **Attribution is not available here, deliberately.** `StatChangedEvent` carries no
> `sourceCombatantId`, so the condition reads "*an enemy's* Wisdom dropped", not "*I*
> dropped it" — a Mind partner's debuff arms Cortex's passive too. That is the same
> limitation the Frozen Stone note records, not a new one; closing it means adding a
> source to every `StatChanged` emitter, which no content has yet needed.

**Off-type coverage in a natural pool is now policy** (designer call, same day). A hero's
`moveTiers` may carry a few moves outside its own type, with no Evolution and no STAB —
the Pokémon TM precedent, where the option existing matters more than the option being
optimal. First content: Cortex takes **Phantom Strike** (Spirit) and **Cog Bop** (Mech),
the only two things a base Cortex can point its 53 Attack at, since the Mind slate is
100% magical. Coverage is a handful of moves, never a second slate — that is what a
`typeGraft` and its `learnableMoveIds` are for.

### Reacting to a HEAL (2026-09-02, Solace)

`PassiveHook` gained **`'Healed'`**, and `resolveRound`'s heal case gained the reaction
checkpoint it never had — per target, straight after the HP lands, mirroring the
`DamageDealt` one. The healer archetype had no way to react to the thing it does.
Content: **Afterglow** (Solace's Dawnherald Evolution) — *whenever this hero heals an
ally, that ally gains 20 Attack and 20 Intelligence*.

**A heal is never a wasted turn.** The payout is a buff rather than more healing, so the
cast pays out at full HP, when the healing itself is worth nothing — pinned in
`test/passives.test.ts`. Both offensive stats, because Solace does not pick her partner:
it has to be worth the same to a Crag as to a Glyph.

`PassiveEffect { kind: 'statDelta' }` grew to accept `stat` as one key **or several
sharing an amount**, emitting one `StatChanged` each, exactly as a move's `statDeltas`
does — which keeps a stat-reactive passive (Entanglement) reading them one at a time.
Existing single-stat content is untouched.

> **Nothing caps it but the mana.** Consecrate hits both allies, so one 45-mana cast is
> +20/+20 on two heroes and the next cast stacks on top. Compare Rally: a whole turn for
> +20 Attack to both, and no heal. The dial is the amount; 10 is the obvious step down.

> **The hook cannot feed itself, structurally rather than by a guard.** `Healed` has
> exactly two emitters, both on the move resolution path (a `heal`-kind move, and a
> `drainPercent` rider). A **Renew tick emits `StatusTicked`**, never `Healed` — so a
> heal-reactive passive that plants a HoT could not re-arm itself either.

> **Naming:** the old defensive path was called **Sanctuary**, which is also a Light-flavored
> FIELD EFFECT (`src/data/fieldEffects.ts`). Renamed **Solstice**. Worth a scan when authoring
> any path name — field effects, statuses and moves all share the player's vocabulary.

### A passive that grants MANA, and the drain that was missing its hook (2026-09-02, the last four starters)

`PassiveEffect` gained **`{ kind: 'manaGrant' }`** — uncapped, exactly as a move's
`manaGrant` is, because the overflow past the pool is the payout (`docs/mana.md`).
`ManaGrantedEvent.moveId` is now optional, absent when a passive did it. Content:
**Overspill** (Glyph's Thaumaturge) — *on entering the battlefield, gain 50 mana past the
pool*. Mana overflow is a locked pillar that only MOVES could reach until now, and it
matters most on this hero: **Singularity costs 150 against Glyph's 85 pool**, so its best
move was uncastable without help. Overflow survives switching, so the path is the
bench-cycling engine aimed at one enormous cast.

**A drain is a heal, and the `Healed` hook was only half wired.** The checkpoint added
with Solace covered `heal`-kind moves; the `drainPercent` rider emits its own `Healed`
event from the damage path and had no reaction pass at all. Caught by **Communion**
(Revenant's Undying — *whenever this hero is healed, its partner is healed the same*)
simply not firing on Drain. Both emitters now feed the hook.

> **Two authoring traps this batch hit, worth knowing.** `moveTiers` and `evolutions` are
> keyed by the same hero id, so a blind first-match edit rewrites the wrong one — it type-errors
> immediately, but check. And **every Mech Burn move burns its own caster** (Backfire, Overheat
> and Meltdown all carry a `target: 'self'` Burn alongside the target's), which is what makes
> **Combustion** — *whenever this hero is Burned, gain 20 Attack* — read the type's built-in
> drawback as its fuel rather than needing an enemy to cooperate.

**Valor's Tempering** (*whenever this hero takes damage, gain 10 Defense*) is deliberately
unbounded within a fight: Valor is the hero that wins the long one, and the Pact Clock is
what brackets that, not a cap on the passive.

### The floor: no effective stat below 1 (LOCKED — 2026-08-30 designer call)

Raised by the Mind slate, but **not caused by it**. `getEffectiveStat` (state.ts) had
no clamp at all, and the authored slates had already outgrown that: Break Will alone is
−50 Attack, which puts an Attack-25 caster at −25. A **negative** `defStat` inverts the
off/def ratio, so the attack HEALS its target; a `defStat` of exactly **0** makes the
ratio `Infinity`. Neither is a rule anyone wrote — they were what the formula did in a
region no content had reached yet.

The clamp lives in `getEffectiveStat` and nowhere else, because that is the single
chokepoint every reader already goes through: the damage pipeline reads both sides of
its ratio through it, and `getMaxHp`/`getMaxMana` are thin wrappers over it. Three
details:

- **Applied last**, after Freeze's halving and Verdant Earth's bonus, so a Speed-1 hero
  that gets Frozen still reads 1 and still takes a turn.
- **Flat across every `StatKey`**, not carved out per stat. No content debuffs `hp`,
  `manaPool` or `mpRegen` today, so the floor cannot bind on those — and a future
  "MP Regen 0" debuff should be a conversation rather than something this clamp
  silently forbids.
- **The modifier itself is not clamped**, only what is read out of it. A stat driven to
  −9999 stays at −9999 on `statModifiers`; healing it back is still a real amount of
  work, and Brain Flay's third cast into an already-bottomed target is a visible waste
  rather than a hidden one.

`test/mindMoves.test.ts` pins it from both ends: the floored value itself, and that an
attack into a floored defender still deals positive, finite damage.

### Doubling the reductions already on the board (2026-08-30, Mind)

Brain Flay is "spread, double stat reductions on enemies" —
`MoveDefinition.doublesStatReductions`. It carries no `basePower` and no authored
number: what it is worth is entirely what the type has already spent.

- **It reads `statModifiers`, never `baselineStatModifiers`.** That split is the whole
  definition — `statModifiers` is what *this fight* inflicted, `baselineStatModifiers`
  is the loadout (equipment, relics, class, Evolution grants). Doubling the net of the
  two would make a target's armor change how hard its debuffs amplify, which is not a
  relationship anything else in the game has.
- **Every negatively-modified stat, not a named list.** Break Will reduces Attack and
  Lull reduces Intelligence, so restricting it to the magical pair would make the
  slate's own biggest debuff not a payoff for its own capstone. A *positive* modifier is
  untouched — doubling an enemy's own buff would be the opposite of what the row says.
- **It COMPOUNDS** (2026-08-30 designer call): −50 → −100 → −200. It doubles the number
  on the board, which is the rule a player can do in their head, and there is no
  per-fight flag and no memory of the original reduction. The price is 80 mana, a spread
  cast, and needing the debuffs to already be there. The ceiling is bounded by the stat
  floor above rather than by the move.
- **It needs no exemption from the multiples-of-5/10 lock**, unlike
  `derivedStatDeltas`: doubling a multiple of 5 is a multiple of 5.

Pressing it on a clean board changes nothing and still spends the mana — the Retribution
shape (a move worth 0 when mistimed stays *pressable* rather than blinking out of the
kit). That is why the button carries a live `−N more` chip rather than only the rule.

---

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

---

## The Pact Clock — the upper bracket on fight length (LOCKED, 2026-09-01)

### The problem

Three facts about this engine compose into an unbounded fight:

1. **Mana regenerates** every round, for the active pair *and* the bench (`mana.md`), so
   it is not a finite resource over a long enough fight.
2. **There is no accuracy stat and no PP**, so a move's only cost is that mana.
3. **Stat modifiers have no ceiling.** `getEffectiveStat` floors every stat at 1 and
   nothing caps it, and two moves — Arcane Overflow and Beast's Apex Predator — are
   authored to *compound* deliberately.

So a side whose sustain per round exceeds the opposing side's damage per round wins by
attrition, and there was **no round limit anywhere in the engine** to notice. Read the
other way, this is `mana.md`'s own tuning invariant — *"mana investment must pay out later
than the point at which a weak team dies"* — which has always had a lower bracket and
never an upper one. The Pact Clock is the upper one.

### The rule

From **`PACT_START_ROUND` = 30**, at the round boundary, **every combatant on the board**
loses a fraction of its **max HP**:

    fraction = 0.10 + 0.05 × (round − 30)

10% on round 30, 15% on 31, 20% on 32 — cumulatively 100% by round 34, so a combatant at
full HP is dead **five rounds** after the clock starts. Minimum 1 HP per tick, so no
small-pool hero is quietly exempt to rounding.

Four properties, each deliberate:

- **It is direct HP loss, not a damage-pipeline hit.** No Defense, no type chart, no
  variance, no crit — nothing to buff, resist, or wall. A stall is not supposed to be
  survivable by playing the stall better.
- **It hits the BENCH as well as the field.** This is what makes it airtight: a stalling
  side with two healthy heroes in reserve could otherwise cycle fresh bodies in and outlast
  a clock that only touched the active pair. It also matches the fiction — the pact comes
  due on everyone who showed up.
- **No passive-reaction pass follows it** (unlike the status ticks it sits beside in
  `resolveRound`). A passive that healed off the pact would blunt the exact thing that must
  not be blunted, and "the terminator is not a trigger source" is a cheaper rule to hold
  than auditing every future passive against it.
- **Escalating chip, not instant death.** The side that is actually **ahead** still wins;
  the fight ends decisively instead of as a coin flip, and the *stall* is what loses. If
  both sides wipe on the same tick the fight reads as a **loss for the player** —
  `FightScreen`'s winner check tests the player side first — which is the correct fail-safe:
  a player who let the clock run out does not get to take the enemy with them.

### Presentation

The clock is the only thing in the game that can kill a hero the player never let get hit,
so it is the one thing that **must** be seen coming. `FightScreen` shows a strip across the
top of the battlefield from `PACT_WARNING_ROUNDS` = 5 rounds out: amber and counting down
in rounds while it is a warning, red and reporting the escalating percentage once it is
due. The engine emits one **`PactTicked`** event for the whole board — the announcement —
followed by the ordinary `HpChanged`/`Fainted` stream, so a pact death replays exactly the
way a Bleed death does.

### What it is not

It is **not** the answer to setup on its own, and should not be tuned as though it were.
Two cheaper levers were considered alongside it and remain open:

- **A cap on stat modifiers.** `getEffectiveStat` already floors every stat at 1 and never
  ceilings one — the invariant is half-built. Capping the modifier would bound Apex
  Predator and Brain Flay rather than break them, and is the Pokémon-standard, instantly
  legible version of "stats stop going up". **Not implemented.**
- **A stat-clearing effect primitive (a Haze).** Setup bounded by *the opponent having an
  answer* rather than by a number is the VGC-native shape, and it is one new verb in the
  effect vocabulary. **Not implemented.**

> 🔒 **OPEN — flag before hardening.** Round 30 is the designer's number, not a measured
> one. The number to replace it with is the **95th percentile of real Act 3–5 fight
> lengths** — and the measurement has to respect that the switching game is *supposed* to be
> slow: bench mana regen is the resource-cycling engine, and the lock-in rule already turns
> a 2-KO fight into a grind on purpose. A clock set too early does not break a stall, it
> breaks the cycling game. The two fractions (10% base, +5% per round) are chosen only to
> make the wrap-up take five rounds; they are equally provisional.
