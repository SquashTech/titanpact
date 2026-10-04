# mana.md

> The mana / MP resource system. Mana replaced accuracy as the primary balance lever,
> so this system carries a lot of load. Every question this doc once flagged is resolved;
> Field Effects keep their own open questions (`docs/field-effects.md`).

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
- **Implemented** in `engine/combat/manaRegen.ts`, called from `resolveRound.ts` at the round
  boundary, emitting `ManaRegenTicked` per combatant whose mana changed. It walks every
  non-fainted combatant, active and benched.

## Resolved (2026-08-21 designer sign-off)

- **Weather subsystem interaction with mana: RESOLVED.** Field Effects
  (`docs/field-effects.md`) **is** the weather subsystem; Magical Surge doubles every hero's MP
  Regen while active.

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

See "Growing the pool" below for every faucet in force. (The original table here — relics,
equipment, Evolution stat branches — is gone: the relic pool was deleted, Evolution paths grant no
stats, and levels do grow stats.) Loadout grants land in `Combatant.baselineStatModifiers` at
fight build (`src/run/buildCombatState.ts`), kept separate from `statModifiers` so a loadout
grant reads as part of the hero's stat block, not a temporary combat buff.

### What this means when authoring a slate

- **Do not price a slate against starting pools.** Price it against the curve
  (`docs/authoring-moves.md` §2), and let the top of it be unreachable at hour zero.
- **A Late-tier move the current roster cannot cast is not a bug.** It is the payoff for
  investing in mana, and the mana tuning invariant (`CLAUDE.md`: "mana investment must
  pay out later than the point at which a weak team dies") is what keeps that investment
  honest rather than free.
- **The one case that IS still a finding**: a hero that cannot afford its own *starting
  kit*, or an ENEMY that cannot act — an enemy gets no Banners, no Mana Well and no events, so
  its pool grows only by level (and gear from Act 4) and really does need checking
  (`docs/authoring-moves.md` §8).

**Classes grant no mana**: a Class is a verb, never a stat (`CLAUDE.md`).

### Growing the pool (2026-09-13, XP Overhaul phase 6)

Measured against the schedule, a Late move at 70+ against a 50–95 pool
plus 10 a round was castable **once a fight**, so "reachable" was never the question — twice a
fight is. Every faucet a pool has today, and what each is:

| Faucet | Scope | Size | Kind |
|---|---|---|---|
| **Growth** (`run/growth.ts`) | every hero, every level | **1 mana a point** (`GROWTH_UNIT_MANA`, 2 → 1 on 2026-09-28; a B grade ≈ +1.3 a level, ~+38 by level 30) | automatic, no screen |
| **Banner of the Wellspring** | team-wide, 1-of-3 at each Guardian | +25 pool, +5 regen (+50 HP), stackable | a choice against two other Banners |
| **Banner of the Bulwark** | team-wide, 1-of-3 at each Guardian | +5 regen (+15 Def/Wis), stackable | a choice against two other Banners |
| **The Mana Well** (`manaWellReward`) | one chosen hero, a reward-row seat at weight 20 | **+40 max Mana, +5 MP Regen** (`MANA_WELL_AMOUNT`, `MANA_WELL_REGEN`), stacks | the one bare-number screen — pick who |
| **Equipment** | per hero, per slot | authored on the item, ⅓ point a mana | the item's whole budget |
| **The Deep Well** (`data/events.ts`) | one chosen hero, when the event rolls | **−20 HP for +40 Mana, +5 MP Regen** | a TRADE, narrated — the events grammar's `statShift` |
| **Arcane overflow** | the caster, in a fight | a mana grant past the pool | a move |
| **MP Potion** | one active hero, in a fight | half of max, 3 held | a consumable |

On top of those, **Late-tier mana was re-priced ×0.75** the same day (`docs/authoring-moves.md`),
which is the other half of the same fix. Together: Late casts went from 4.5% of the run to 14%,
and from 11% of Act 4's casts to 21%, 18% of Act 5's to 33%, 23% of the finale's to 40%.
**Pushed part-way back on 2026-09-17** (`docs/authoring-moves.md`): Late +10, spread damage +20
at Late and +15 at Mid — mana had stopped reading as a cost, and a spread hit at a single hit's
price was the top of every damage-per-mana table. Late is still cast 1.6 times a fight in Act 5.

**2026-09-28, per user direction: mana is bought, not grown.** At 2 a point the pool outgrew
every price by Act 3 and the Wellspring doubled regen on top, so mana mattered early and then
stopped mattering. Growth came back to 1 a point, the Wellspring's regen was halved to +5
with a matching +5 on the Bulwark, the Wellspring went to +50 HP / +25 Mana, the Mana Well to +40
and +5 regen, and eight of the most-cast Late moves went up 10 (`docs/authoring-moves.md` §8). The tension named: a 45–50 pool hero now reaches about 85 by
level 30, so a 65+ Late move is castable once a fight and a second cast is a choice someone made.
Measured on the first pass (Wellspring +60 HP / +50 Mana, no regen, no Late re-price; 3000 runs, greedy pilot, seed 1): full-clear 92.2 → 93.4%, Resting 0.3% of turns both
sides of the change, Late casts 14.7 → 14.6% of Act 5's, Banner lifts +0.07 / +0.07 / −0.14
(Warcry / Bulwark / Wellspring), the Mana Well −0.13 → −0.23. **The sim cannot see this change**:
its pilot cycles to the bench for mana and never runs dry, so a pool it never empties is a pool it
never values. Whether mana now reads as a decision is a playtest call.
The revision (Wellspring +50 HP / +25 Mana / +5 regen, the eight Late moves +10), same batch:
full-clear 93.3%, Banner lifts +0.08 / −0.03 / −0.05, Late 14.6 → 12.3% of Act 5's casts. The
eight re-priced moves lost a quarter to two thirds of their casts (Onslaught 1873 → 1071, Salvo
1137 → 547, Dusk Blade 1072 → 365 — the steepest, so it came back to 60).

**The Mana Well is the exception to *a bare number never gets a screen*, decided 2026-09-13**
(per user direction, on the argument that a pool is the stat a whole tier of moves is priced in,
so the number IS the capability where +10 Attack never was). It is an exception for mana alone —
`docs/run-loop.md` "The Mana Well" and `CLAUDE.md`. If playtest says the pool still runs dry, the
dials are `GROWTH_UNIT_MANA`, `MANA_WELL_AMOUNT`, the Wellspring's +25, and the Well's weight.

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

Nothing of this doc's own. Whether mana reads as a decision after the 2026-09-28 reshape is a
playtest call ("Growing the pool"); Field Effects keep their own open questions.

---

## Engine placement

- Mana is **combat state** (`architecture.md`): it lives on the fight, spends when a
  move is used, and regenerates every round, active and bench alike.
- Mana changes emit a **`ManaChanged` event** (`engine/events.ts`) so the presentation layer can
  show the resource draining and refilling — same engine/presentation discipline as HP. Never
  gate a move's *legality* in the view — legality (can this move be afforded?) is an engine
  decision surfaced as state (`engine/state.ts` `hasAffordableMove`, a pure query over mana +
  move costs that both the player UI and the AI consult).
- **Rest** (`combat.md` "Rest") is the resolution to the case where a hero can afford
  *none* of their moves: it fully restores Mana instead of spending it, implemented
  as its own `Action` kind (`engine/combat/actions.ts`) rather than a move, so it
  can't be folded into a hero's authored movepool or accidentally costed/tuned like
  one.

---

## Numbers in force

Starting pools run 45–130 (most heroes 50–95) with MP Regen a flat 10 outside the 550 budget, so
a 30-mana move is cast freely and a 65+ Late move about once a fight before the pool grows. Every
figure on a hero sheet is a **starting** one — see "Mana pools GROW over a run".
