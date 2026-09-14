# xp-overhaul.md — The XP Overhaul

> **STATUS: §2–4 DECIDED (2026-09-13, per user direction); §5 (four acts) DEFERRED, not decided.
> PHASE 1 OF §8 IS IN.** `CLAUDE.md` and `growth-overhaul.md` still describe the game in force
> wherever a §8 phase has not yet landed; §8 is the route and §9 the list of sign-offs each phase
> spends — **check its Status column before assuming anything here is live.** Where a number
> below is a first pass it says so — the design is the shape, and the sim (§8, phase 6) is where
> the numbers get set. §5 is phased last so the rest ships without it, and is to be revisited
> once the clock is re-measured with the ladder gone.

---

## 0. Why this exists

Two measurements, one week apart, pointed at the same thing.

**The clock.** `scripts/sim` now estimates wall-clock run length (`scripts/sim/time.ts`,
2026-09-13): a full clear is **~88 minutes** for a player who taps every beat, ~60 on Auto, ~36
on Fast, against a 45-minute target. Half of it is out-of-fight. The single largest out-of-fight
item is **the Mastery ladder: ~47 rung screens a run** (~9 min), because ~150 Scrolls under rising
prices is 47 decisions. Acts are flat at 15–19 minutes each, and acts 2–3 clear at 95% — they are
the run's plateau.

**The load.** The game runs *two* progression models side by side. Every hero the player does not
control — enemies, Guild hires, contract heroes — reads its rank and Evolution off its **level**
through one table (`ENEMY_RUNGS_BY_LEVEL`, `src/run/enemyGen.ts`: Mid at 10, Evolution at 16, Late
at 21). Only the player's six carry the Scroll economy on top: a currency, a price curve, an income
table, a purse that banks, a bank button, a forced screen, and the rule that the ceiling must sit
behind the spend. That is the system a new player has to learn that nobody else in the game uses.

The proposal is to stop the player's roster being the exception. Levels become the one faucet for
everything — stats, moves and Evolutions — the way Pokémon does it, with two things Pokémon does
not do: the move at each level is **rolled from a band**, not fixed, and the run hands out **XP
that must be aimed at one hero**, so the carry build and the catch-up both come back.

---

## 1. The rule this reduces to

> **One curve. A hero's level is the only thing that says what it has, and the only things that
> move it are what the roster won and what the player aimed.**

Everything the Scroll ladder did — pace moves, gate tiers, time the Evolution, price a carry in
breadth — the level table does, and the level table already exists. The Scroll was a second clock
running beside the first. `growth-overhaul.md` §4's guard rail — *the ceiling sits behind the
spend, never behind a clock* — was written because act-gating made **holding** a Scroll optimal.
With no Scroll there is nothing to hold. The rule is not violated; its premise is gone, and it
retires.

`growth-overhaul.md` §1's rule still governs: *a bare number never gets a screen, and a screen
never buys a bare number.* Every screen this adds collects **who**, and what the hero gets is a
level — stat rolls, an offer, sometimes an Evolution — which is a thing that happened, not a
number.

---

## 2. The XP curve

**Level is derived from cumulative XP.** `RosterEntry.xp` is stored; `level` is read off the
curve. Pokémon's Medium Fast is the baseline:

> `XP(L) = L³` — the cumulative XP to *be* level L. 27,000 to the cap of 30.

**Encounter XP is derived from the authored level table, not the other way round.** The decided
pacing is a level per encounter (`LEVEL_AFTER_ENCOUNTER`), so encounter *k* pays exactly
`XP(L_k) − XP(L_{k−1})`: a hero at par walks the authored table to the point. The table stays the
single authored object; the XP amounts are what it costs to keep it true.

**Roster-wide and automatic**, benched included, as today. No pool, no allocation.

### The convex curve is the mechanism

A fixed XP amount is worth more levels to a hero below par and fewer to one above it. That is not a
rule anyone has to write; it is what the cube does. Two consequences, both wanted:

- **Catch-up is built in.** A Guild hire one act behind receives the same XP per encounter as the
  roster and climbs faster for being lower. The gap closes on its own — slowly — and a candy (§3)
  closes it in one node.
- **The carry throttles itself.** Every candy into the same hero buys less level than the last.
  What it *does* buy is the next threshold sooner — the Evolution, the Late band — and a threshold
  is a step in power, not in level. The player is trading a smaller, earlier step against breadth.
  Both curves are readable on the sheet.

### What this changes about "a delta, never a target"

Today a hero that joins late has missed the level *grants* before it and **stays behind
permanently** — `test/recruitment.test.ts` pins it, `CLAUDE.md` states it. Under a convex curve the
same XP grants close the gap asymptotically. The archetype survives (a hire *is* behind, and
visibly), but "permanently" becomes "unless the player closes it, and slowly even if not." That is
Pokémon's behaviour and it is the better one for a roguelike, because the runway is now something
the player chooses to spend a node on. **§9 lists it as a reversal; the test moves with it.**

---

## 3. Candy — XP the player aims

**A candy is a map-node reward that grants XP to ONE hero.** Pokémon's EXP Candy, as a node. It
replaces the Scroll Cache and the Lone Scroll in the reward rows, seat for seat and weight for
weight (`scrollReward` 46, `loneScrollReward` 14 in `REWARD_WEIGHTS`), and the Guild Hall shelf
sells one for gold where it sold a Scroll. Every source is a node that displaced another reward —
the Tutor's pricing principle — so a candy is never free and never compounds.

**Every candy is a moment.** `growth-overhaul.md` §4's "silent deposit" objection applies: XP that
lands no level-up is invisible. So candies are denominated in **levels-at-par**, not raw XP:

| Node | Size | Meaning |
|---|---|---|
| Candy (the old Scroll Cache's seat, weight 46) | **2 levels-at-par** | the XP from par to par+2 on the run's own curve |
| Small Candy (the old Lone Scroll's seat, weight 14) | **1 level-at-par** | the XP from par to par+1 |
| Guild Hall shelf | Small, flat gold, limit 2 a visit | replaces `SCROLL_PURCHASE_*` |

"Par" is `levelAfterEncounters(run.encountersWon)`. A candy so sized always crosses at least one
level for any hero **at or behind** par — the behind gets more — and only a carry already ahead
can ever see a partial. The level-up report is where it pays out, same screen, same rows.

**The screen is one tap: who.** Pushed on the node, like every other reward screen. A hero at
`MAX_LEVEL` is refused rather than wasted, which is the one place the cap quietly pushes spread.

### Why this is not the two things already rejected

- **Not participation XP** (`growth-overhaul.md` §3): that compounds — the four who fight level,
  so they win, so they fight. A candy is finite, node-priced, and goes where the player points.
  The bench never rots because encounter XP is still roster-wide.
- **Not Gems** (§1 there): the screen buys a level, and a level is stat rolls against a grade, an
  offer from a band, and maybe an Evolution — a story with a hero's name on it, not "+5 Attack."
- **Not the focus-hero dial** it resembles — or rather, it is that dial in the shape it should
  have had. §3 there dropped the dial *"once Rank made it unnecessary."* Rank is what §4 below
  deletes, so the reason for dropping it leaves with it; and a node the player aims is a better
  dial than a percentage the act sets.

### The supply is the only balance number

Expected candy nodes a run at the inherited weights: ~3 Candy + ~1 Small ≈ **7 levels-at-par**
across a run (first pass — the sim's Scroll node counts, 3.1 and 1.1 a run, are the basis).
Poured into one hero that is a carry ~+5 by Act 3 after the curve's throttle; spread, it is a
hire lifted from −5 to par with change. Too little and the carry cannot exist; too much and par
stops meaning anything. **This is a sim question before a playtest one** — `scripts/sim` still
carries `--policy focus|spread` and `--xpmult` from the old allocation era, inert today and
precisely the two experiments this needs.

---

## 4. Moves and Evolutions come from levels

**The Scroll ladder is deleted whole.** Rank, rungs, prices, income, the purse, banking,
`masteryDue`, the Bank button, the map's Scroll chip, `MasteryScreen`, `MasteryBoard`,
`canSpendScroll`, the Vigil's clearing rule, `ENEMY_RUNGS_BY_LEVEL`. §7 has the list.

**What replaces it is the thing enemies already use: a per-hero schedule read off level.**

```
HeroDefinition.schedule: {
  midLevel:       number   // the Mid band opens; Early expires (RANK_THRESHOLDS[1] today)
  evolutionLevel: number   // the Evolution is offered, in place of that level's move offer
  lateLevel:      number   // the Late band opens (RANK_THRESHOLDS[2] today)
  offerLevels:    number[] // levels that roll a move offer from the highest open band
}
```

**Keep the roll, lose the currency.** This is the one place *not* to copy Pokémon. Charmander
learns Ember at 12 every game, and in a roguelike that makes every Cinder the same Cinder. Here a
level on `offerLevels` fires an offer **rolled from the band that level has opened** — the Scroll
rung minus the Scroll. Take it or decline; the move is burned either way; at `MOVE_CAP` it is
replace-or-decline. `RosterEntry.offeredMoveIds` and `grantOfferedMove` are the same code. The
schedule says *when*, the band says *from what*, the roll says *which*.

**The offer lands on the level-up report.** `LevelUpScreen` is already first in the post-fight
chain and already lists every hero's roll; a hero whose level crossed an offer gets its offer as
part of its row, and the Evolution screen is raised from there when a hero crosses
`evolutionLevel`. This is a reversal of the report's "one button, no choice" rule (§9): the report
gains exactly one decision kind, and it is the one that was a screen of its own before. It must
not gain a second.

**Per-hero timing is the lever the roster was missing.** Growth grades make late bloomers and
front-loaders *numerically*; nobody feels a C grade. Everybody feels Magikarp. A hero whose sheet
says *evolves at 12* against one that says *evolves at 20* is an identity a player reads before
drafting — exactly what the 550 rule was written to give stats. Today every hero can be rushed to
its Evolution in Act 1 for 10 Scrolls, so "early powerhouse" is not something a hero can *be*.
`EVOLUTION_LEVEL` = 5 already exists as inert per-hero data; this pass gives it its job back.

**Default schedule** (ships in phase 3 so the engine runs before the content pass; authored per
hero in phase 4, the way grades were):

| | Level |
|---|---|
| `offerLevels` | 4, 7, 10, 13, **16**, 19, 22, 25, 28 |
| `midLevel` | 10 |
| `evolutionLevel` | 16 (the offer at 16 *is* the Evolution) |
| `lateLevel` | 21 |

That is the enemy table verbatim, so on the day it ships a starter and a contract hero of the same
level are the same hero. The authoring pass is what pulls them apart. Two authoring rules, mirrors
of the grade rules: a hero's Evolution sits **between 10 and 24** (before Act 2's Guardian at the
earliest, before the finale at the latest — a hero that cannot evolve in a run is a trap pick), and
the count of `offerLevels` is bounded by `movePoolFloor` — the offers it takes to climb out of a
band — rewritten against the schedule.

**One model for everybody.** A generated hero reads the same schedule as a roster hero;
`enemyScrollsForLevel` goes. A contract hero arriving at the act's enemy level has crossed its
levels and rolled its kit — what it does today, by the same code now. A Guild hire arrives one act
behind with its levels *un*-crossed, which is what raw means, and its first candy is where the
player decides whether that runway is worth closing.

**What survives, and why:**

- **The Mentor and the Tutor.** They keep their reason and gain a cleaner one: they are the only
  way to get a move *ahead of* its schedule. The Mentor rolls Mid un-gated in the early acts; the
  Tutor picks any move late.
- **Classes, Boons, items.** Untouched. They are now the three "pick a hero" screens, and with
  Scrolls gone they carry the whole of per-hero *choice*; §10 names what that means.
- **The companion's tier-step** fires at `evolutionLevel` and `lateLevel` in place of a branch, as
  it fired at the rungs.
- **The RETYPE, the five-clause framework, every authored path.** `chooseEvolutionPath` is
  untouched; only the trigger moves.

### What is given up

The carry build as **increasing returns inside a hero**. `growth-overhaul.md` §4 priced
concentration in breadth: pour Scrolls into one hero and its ceiling rises, spread them and nobody
ranks up. Under one curve, concentration has *decreasing* returns in level and *stepped* returns
in power, and it is bought with candy the player could have spread. That is a different texture —
Pokémon's, not Slay the Spire's — and it means **Titanpact's team-building is about who and which,
never how much.** If that is not acceptable, this overhaul is not the answer, and the Scroll ladder
is the right system carrying the wrong price.

---

## 5. Four acts, then the finale

> **Provisional, per user direction (2026-09-13): "the right answer MIGHT be four acts."** A
> separate decision from §2–4 — §8 phases it last so the rest can ship without it — but it re-fits
> the same table, so it is written here rather than in a fourth doc.

`TOTAL_ACTS` 6 → 5: four acts of the decided shape, then a finale act that is **the Vigil → the
Herald** (the Endbringer, renamed) **→ the Titan's Eyes**, the planned final boss. Two bosses in
the finale, no map between them.

**Why four and not three.** The sim's act-clear table says acts 2 and 3 are the plateau
(95% clears; deaths are in 1, 4 and 5). Three acts is the honest reading of that and the tidiest
fit to the content's own tripartite shape (Titanspawn Early/Mid/Late, three move bands). Four
keeps a middle long enough for a roster to *turn over* — a recruit in Act 2 has two acts to
matter — and keeps the Guardian count at four, which is a Banner shy of today rather than two.
Time, at today's prices, cut act ≈ −16 min, second finale boss ≈ +7: **~79 min tapping / ~55
Auto / ~33 Fast** before the rest of this doc, **~70 / ~48 / ~28** after it. Four acts is therefore
also a decision that the target player is on Auto, or that a first-run reader gets 70 minutes.
Say which.

**What it re-fits** (all in phase 5; none of it is hard, all of it is one pass):

| Thing | Today | Under four acts (first pass) |
|---|---|---|
| `LEVEL_AFTER_ENCOUNTER` | act ends 8/14/19/24/28, finale 30 | act ends **9/17/24/29**, Herald 30, Eyes 30 (18 encounters) |
| `ENEMY_LEVEL_BY_ACT` | derived, lag 2 | derived, unchanged rule |
| `ACT_STEP_CURVE` | `[0, 1, 3, 6, 10]` | `[0, 1, 3, 6]` + the finale on the skirmish track as now |
| `SPAWN_TIER_BY_ACT` | early/mid/mid/late/late | **early/mid/late/late** |
| Guardians, Banners, Classes, seals | 5 | **4** — four of six heroes Classed, which is a real pick where five-of-six was not |
| Location itinerary | 5 of the set | 4 of the set — more of the map unseen each run |
| Mentor / Forge / Tutor rows | Mentor 1–3, Forge 4, Tutor 4–5 | **Mentor 1–2, Forge 3, Tutor 3–4** |
| `GUILD_HALL_ACT_LAG` | 1 act of 5 | 1 act of 4 — the runway is a larger share of the run, which is the direction §3 wants |
| Finale | Vigil → Endbringer | Vigil → Herald → Eyes; `brokenSeals` reads four |
| `docs/lore.md` | five seals | four seals, and the Herald is the Titan's herald rather than its end |

---

## 6. What the run feels like

Node → do a thing → node. The post-fight chain is *Level-up report (with any offers and any
Evolution) → Banner → Crucible → map*. No Mastery screen behind it, no Scroll chip on the map, no
purse to read. A candy node is one tap. The Guild Hall sells people, gear and candy.

The arc, under four acts and authored schedules: Act 1 is who you are (draft, companion, first
contract, Early kits); Act 2 is who you are becoming (the early evolvers turn, Mid bands open,
the roster fills); Act 3 is the team taking shape (the late evolvers turn, Late bands, the Tutor);
Act 4 is the finished team under test; the finale is the test. What the player chose is the
roster, the paths, the Classes, the Boons, the items, and **where the candy went** — and the last
one is the one that says "this is my carry."

---

## 7. What is deleted

| Going | Surface |
|---|---|
| **Mastery Scrolls, entire** | `RunState.masteryScrolls`, `masteryDeferred`, `RosterEntry.masteryScrollsSpent`, `scrollCost`, `MAX_SCROLL_COST`, `scrollsToReachRung`, `masteryRung`, `masteryRank`, `RANK_THRESHOLDS`, `EVOLUTION_RUNG`, `EVOLUTION_SCROLLS`, `SCROLLS_TO_MAX_RANK`, `canSpendScroll`, `canAffordAnyScroll`, `spendMasteryScroll`, `grantMasteryScrolls`, `masteryMovePool` (re-pointed at the schedule) |
| **Scroll income** | `scrollsFor`, `ACT_SCROLL_STEP`, `SCROLL_REWARD_COUNT`, `LONE_SCROLL_COUNT`, `SCROLL_PURCHASE_COST`, `SCROLL_PURCHASE_LIMIT`, `buyMasteryScroll`, the Guild Hall shelf's Scroll bundle |
| **The screens** | `MasteryScreen.tsx`, `MasteryBoard.tsx`, `useScrollPour`, the map's Scroll chip, the Bank button, the Vigil's clear-on-exit |
| **The nodes** | `scrollReward`, `loneScrollReward` — RE-POINTED at candy, seat and weight kept (§3) |
| **Level as inert data** | `EVOLUTION_LEVEL` as a flat 5 — REPLACED by `schedule.evolutionLevel`, per hero |
| **The enemy's private table** | `ENEMY_RUNGS_BY_LEVEL`, `enemyScrollsForLevel` — REPLACED by the shared schedule |
| **The level table as levels** | `LEVEL_AFTER_ENCOUNTER` stays authored; `levelsForEncounter` becomes `xpForEncounter`, and `grantEncounterLevels` grants XP |
| **The sim's Scroll telemetry** | `scrollsBySource`, `heroScrollHistogram*`, the `rung`/`evolution` screen tallies in `time.ts` → candy and offer tallies |

The tutorial script (`src/data/tutorial.ts`) narrates Scroll beats and must be re-checked in
phase 3, as it was in the growth overhaul's.

---

## 8. Order of work

Sequenced so the tree is playable at every boundary. Numbering is dependency order.
`SAVE_VERSION` bumps freely at each.

| # | Phase | Exit criterion | Status |
|---|---|---|---|
| 1 | **XP under the hood.** `RosterEntry.xp`; level derived off `XP(L) = L³`; encounter XP derived from `LEVEL_AFTER_ENCOUNTER` so par is unchanged to the point. Growth rolls fire per level crossed, as now. No visible change. | Every existing test green with no numeric change at par. A hire behind par measurably gains on it — the new test that replaces "stays behind permanently". | **DONE 2026-09-13.** `xpForLevel` / `levelForXp` / `levelOf` / `xpForEncounter` / `grantXp` (`src/run/growth.ts`); `level` is gone from `RosterEntry` and every reader derives it; `SAVE_VERSION` 12. Measured below. |
| 2 | **Candy.** The two Scroll nodes re-pointed; the shelf; the *who* screen; the report shows the jump. Scrolls still exist and still buy moves — this is a working bridge state where candy buys levels-and-stats and Scrolls buy moves. | Both nodes grant XP to one hero; the sim tallies candy by source and the paired focus/spread batch runs. | **DONE 2026-09-13.** `src/run/candy.ts`, `CandyNodeScreen`; nodes are `candyReward` / `smallCandyReward` (renamed, not just re-pointed — a node named for Scrolls that grants levels would outlive phase 3); the shelf sells a Small for the bundle's 35g, 2 a visit; `SAVE_VERSION` 13. Measured below. |
| 3 | **Levels teach.** The destructive one. `HeroDefinition.schedule` on the default table; offers roll from the report; the Evolution raises from `evolutionLevel`; enemies and hires read the same schedule; delete everything in §7. Tutorial re-checked. | No Scroll anywhere. `test/moveTiers.test.ts` rewritten against the schedule. A run completable end to end. | |
| 4 | **Author 36 schedules.** Parallelisable from phase 3 on. The interesting authoring is the spread: who evolves at 12 and who at 22, and whether the low-base/high-grade late bloomers from the grade pass are also the late evolvers (they should not all be — a hero can bloom in stats and turn early, or the reverse). | No hero on the default schedule; the 10–24 Evolution window pinned by test beside the grade budget. | |
| 5 | **Four acts and the finale.** §5's table, in one pass. The Herald rename; the Eyes as a second finale champion through `appendFinalEnemy`. | `TOTAL_ACTS` = 5; the sim's act table reads four; 18 encounters at par reach 30. | |
| 6 | **Re-fit.** Candy supply, `ACT_STEP_CURVE`, `ENEMY_LEVEL_LAG`, champion multipliers, reward weights, against the sim and the skilled pilot; then the length report. | No dead node, no unreachable band, no wall the old curve did not have; run length reported per profile. Win-rate targets are a playtest question. | |

**What each phase measures.** Phase 1: nothing moves *at par*, and that held — but the roster is
not all at par. A contract hero arrives at the act's enemy level (par − `ENEMY_LEVEL_LAG`) and a
hire an act behind, and under the cube both now gain on par with every win where they used to
trail by a fixed count. Measured (1000 runs, seed 11, greedy pilot): full-clear **51.7% → 61.9%**,
Act 1 flat (82.0% → 82.2%: nobody is off par yet), Act 2 94.1 → 96.8, Act 3 96.5 → 99.2, Act 4
83.0 → 89.0, Act 5 84.8 → 88.8. The whole lift is the catch-up §2 promised, landing on recruits
before candy exists to aim it — so phase 6's re-fit starts ten points looser than the growth
overhaul left it, and the contract hero's "arrives finished" value is now also "arrives and
closes". A hire that misses eight wins ends the run two levels short (`test/growth.test.ts`).
Phase 2, measured (1000 runs, seed 11, greedy pilot; the ladder still in, so candy is purely
additive): **supply is ~13 levels-at-par a completed run, not the ~7 §3 estimated** — candy 6.3,
Small 1.1, and the Guild Hall shelf **5.7**, which §3's estimate left out and which is nearly half
of it (the sim buys both Smalls every visit; a player may not). **Focus vs spread is a wash:
60.3% vs 61.8% full-clear**, and spread is 61.8% against phase 1's 61.9% with no candy at all —
13 levels-at-par per run moved the clear rate by nothing measurable. Mean end level rose 22.6 →
23.5, so the candy landed; it just is not a lever at this size, which is consistent with a level
being ~9 budget points (a Candy at par ≈ 18 points ≈ six-tenths of a Common item, for one hero).
Two readings, both for phase 6: candy is under-sized for what its seat displaces (an item or a
Boon), or the greedy pilot cannot exploit a carry the way a player would. The sign did not flip
between policies, so it is not a scorer fault (`docs/growth-overhaul.md` §8's lesson) — but the
focus policy feeds the *strongest* hero, who is already ahead of par and so gets the least from
each candy; a player's carry is a hero they are *about* to make strong. §10 gains the question. Phase 3: full-clear and encounters-won against
phase 2 — expect a drop, since ~47 rung offers become ~40 scheduled ones at a different cadence,
and the drop is what phase 6 re-fits. Phase 5: the act table and the clock. Phase 6: the clock
against the target, per profile, and a named decision about which profile the target is for.

---

## 9. Locked invariants this overturns

Each is a sign-off. In force until the phase that replaces it lands.

| Today (`CLAUDE.md`) | Becomes | Phase |
|---|---|---|
| Levels are automatic and roster-wide; the curve is authored as levels | Still automatic and roster-wide; the curve is authored as levels and *paid* in XP on a convex scale | 1 |
| A level grant is a delta; a late hero stays behind **permanently** | XP is the delta; a convex curve closes the gap slowly on its own, and candy closes it on purpose | 1 |
| There is no per-hero stat-investment currency (Gems deleted) | Still no *stat* currency. Candy is per-hero **level** investment — it buys a story, not a number — and it is the focus dial §3 dropped, in node form | 2 |
| Moves come from ONE faucet: Mastery Scrolls, gated by Rank | Moves come from ONE faucet: **levels**, on a per-hero schedule, rolled from the band the level opens | 3 |
| A rung has a price that rises; the purse banks; the ceiling sits behind the spend | Deleted. Nothing is held, so nothing needs to be behind a spend | 3 |
| Evolutions come from the 4th rung, paced by the player | From `schedule.evolutionLevel`, authored per hero; the player paces it only with candy | 3 |
| A level-up REPORT is not an allocation screen — one button, no choice | Still not allocation. It gains exactly one decision kind: the move offer (take / replace / decline), which was its own screen before | 3 |
| A generated hero reads its ladder off level through `ENEMY_RUNGS_BY_LEVEL` | Through the same schedule a roster hero uses; the private table goes | 3 |
| `EVOLUTION_LEVEL` gates nothing; authored data only | Per-hero and load-bearing again | 3–4 |
| Five acts of the decided shape, then a finale | **Four**, then a finale with two bosses | 5 |
| Five Guardians, five Banners, five Classes, six heroes — one ends Classless | Four of each; two heroes end Classless, and which two is a choice | 5 |
| `SPAWN_TIER_BY_ACT` folds five acts into three tiers | early / mid / late / late | 5 |

Untouched, and worth saying so: the 550 and 28 budgets, growth grades, the damage and heal
formulas, the graft-owns-the-slot rule, Classes as verbs, Boons, the item rules, the Banner
family, the Pact Clock, the companion, potions, the map shape within an act.

---

## 10. Open questions — DO NOT silently resolve

- **Which profile is the 45 minutes for?** Four acts plus this doc lands Auto at ~48 and a
  tapping first-run reader at ~70. The remaining lever for the reader is the command phase
  (declaring actions is ~25 min a run at a guessed 6 s each — preselected targets and a
  "same as last round" tap are UX, not design). Decide the player before deciding the number.
- **Can the carry rush an Evolution in Act 1?** Under the default schedule, no: Act 1 pays
  roughly one candy, so a carry leaves Act 1 about +2 over a par of 9 and crosses 16 early in
  Act 2 rather than at its end — an act early, not two. An authored `evolutionLevel` of 10 says
  yes for that hero. That is a fact about the hero, and it should be authored on purpose for a
  few — the early powerhouses — and refused for the rest.
- **Does candy make Ascension's job harder?** A +5 carry beside a par partner is what a harder
  mode has to punish first (`memory: project_ascension_scope`). Candy supply per Ascension is a
  dial; so is a Guardian that targets the highest level on the field.
- **Do offers on the report read as a chain?** The report was one button. A round where three
  heroes cross offer levels at once is three prompts in one screen. The default schedule staggers
  offer levels 3 apart, and par moves ~1–2 a fight, so it should be rare — measure it in phase 3
  (`time.ts` tallies it) before adding any batching.
- **Is `L³` the right curve?** Medium Fast is the baseline because it is the one everyone has
  felt. Steeper (Slow, 1.25·L³) makes the carry throttle harder and the hire catch up faster;
  shallower does the reverse. Phase 6's focus/spread batch is where this gets set; ship the cube.
- **Does the Guild Hall shelf sell one candy or two?** The Scroll limit was 2 a visit. Two Smalls
  a visit at flat gold is NOT a purchased +2 for one hero — the second is eaten by a hero now
  ahead of par and buys less than a level (the throttle, §2, pinned in `test/candy.test.ts`) — but
  it is nearly half the run's candy in the sim (phase 2's measurement). Start at 2 and watch.
- **Is a candy big enough to be worth its seat?** Phase 2 measured 13 levels-at-par a run moving
  the clear rate by nothing, and a Candy at par is ~18 budget points against the ~30 of the Common
  item the same seat could have paid. Either the size goes up (3 / 2?), the seat goes down (weight
  46 is the Scroll Cache's, sized for a currency that bought Evolutions), or the value is in what
  a level *opens* once phase 3 puts offers and the Evolution on the schedule — in which case the
  question is not answerable until then. Do not resize before phase 3; do not skip resizing after.

### Watch in playtest

- **Does the roster read too flat *without* the ladder?** The growth overhaul's own watch item,
  now with its drafted answer built in. If six heroes at par with one candy-carry still read as
  interchangeable, the schedules are too similar — that is a phase 4 authoring finding, not a
  systems one.
- **Does declining an offer feel bad when it was free?** A Scroll declined was a Scroll spent, and
  that stung in a way that made the take feel like a decision. A level-up offer declined costs
  nothing but the roll. If declining starts to feel like nothing, the Mentor/Tutor grammar (a
  free pick, earned) is the drafted answer, on the Late band only.
- **Does the finale's second boss read as a second act?** Two fights with no map between them is
  the intended "end"; if the Herald reads as a Guardian and the Eyes as the *real* end, the
  Herald is the one to make shorter, not the one to cut.
