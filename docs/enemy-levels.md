# enemy-levels.md — Enemies are levelled, not stepped

> **STATUS: BUILT 2026-09-15, per user direction.** An enemy's one stat axis is its **level**,
> rolled through its growth grades exactly as a Guild hire's is, set **per node** off the
> player's par, and **shown** — on the scouted chips, the node dossier and the fight nameplate.
> The act-step curve, the node-kind stat bonuses and the champion multiplier are deleted. §4's
> figures are a first pass fitted by the sim to hold the previous run shape (§6); §7 lists the
> invariants this reverses. §5's loadout seam is BUILT and wired for gear only, from Act 4.

---

## 1. Why

Enemy strength came from two abstract axes bolted onto `evolutionStatGrants`: a node-kind bonus
(Elite +10 to two stats, Guardian +20 to three) and an act-step curve (`ACT_STEP_CURVE`, +30 a
step over `[0, 0, 4, 8, 13]` steps), with a ×1.3 multiplier for the Guardian's champion. Enemies
also carried a level (`ENEMY_LEVEL_BY_ACT`, 6/12/17/22/26) — but it was inert for stats: "no
growth rolls, so it is kit depth only." So the number the player could have read said nothing
about the fight, and the number that decided the fight was one the player could not read.

Meanwhile a Guild hire already did the thing: `levelUpEntry` rolls a hero's grades up to its
level on arrival. Every Titanspawn line carries authored grades (for the companion). The
machinery for "an enemy is a hero at a level" existed; it was not pointed at enemies.

## 2. The rule

**An enemy is a `RosterEntry` built the way a hire is.** Its level is rolled through its
definition's growth grades from 1 (`enemyGen.ts growTo` → `levelUpEntry`), its Mastery pips
come off the act (`masteryForAct`, unchanged), its kit is walked off its schedule
(`rollLevelProgression`, unchanged). `evolutionStatGrants` on an enemy now holds only the
scripted first act's flat grant. A contract hero is therefore *literally* the enemy you beat:
level, growth, Evolution, kit — the same fields a roster hero has, no side channel.

Three bodies, one rule:

| Body | Base line | Grades | Level |
|---|---|---|---|
| Hero-pool enemy | the hero's 550 | its own 28-budget line | the node's (§4) |
| Titanspawn | its tier's 200 / 400 / 600 | its line's 28-budget line | the node's |
| Guardian's champion, Endbringer | its authored 550 | **`CHAMPION_GRADES`, all E (budget 7)** | escorts + `CHAMPION_LEVEL_BONUS` |

The champion line is the one content decision here. A champion is **front-loaded**: authored
at full strength, so its level buys it little. On hero grades the Act 2 Guardian measured 67%
cleared against 85% before (§6) — a 550 body growing 9 points a level over two Mid escorts
doing the same is more than Act 2 can carry.

## 3. Shown

- **Scouted chips** (`SquadSelectScreen`): the level on the figure's corner, as the player's
  own slots wear it — "Lv 16" against the squad's "Lv 15".
- **Node dossier** (`nodeFacts.ts`): an *Enemies · Lv N* row on every encounter node, first,
  with *the Guardian Lv M* as the boss row's note; the stale "+10 to 2 stats" lines are gone.
- **Fight nameplate** (`CombatantCard.level`, both sides): "Lv 16 Brimstone" over the bars, so
  the gap reads at a glance. Dim, so the name stays the plate's subject.

## 4. The level

`enemyLevelFor(kind, act)` = the player's **par entering that node** + a per-kind offset
(`ENEMY_LEVEL_OFFSET`, `src/run/difficulty.ts`) + **the act's own term** (`ACT_LEVEL_ADJUST`,
2026-09-15, per user direction: Act 1 −2, Acts 3 and 5 +2). Par and not the live roster: the tile
can promise the level before the fight, and a player ahead of par earns the easier one. The kind
offset shapes a row of the map; the act term shapes the run — it was added after gear absorption
(`docs/gear-absorption.md`) had lifted full-clear eight points and left Act 1's fork as the wall
(Skirmish 68%, Elite 64%) with Acts 3 and 5 near-clean. A level is a fine dial: ~4 points of act
clear at Act 1's par, ~1 at Act 5's. Measured: Act 1 50 → 58%, Act 3 98 → 96, Act 5 90 → 88, the
Act 1 Guardian unmoved at 77% (its escorts were already at the level floor — that fight is the
champion's body, §6's other dial).

| Node | Offset | Act 1 (−2) | Act 2 | Act 3 (+2) | Act 4 | Act 5 (+2) |
|---|---|---|---|---|---|---|
| player par entering opener / fork / Guardian | — | 1 / 5 / 6 | 8 / 10 / 11 | 14 / 15 / 17 | 19 / 20 / 21 | 24 / 25 / 26 |
| `fight` (opener) | −3 | 1 | 5 | 13 | 16 | 23 |
| `battle` | −2 | 1 | 8 | 15 | 18 | 25 |
| `skirmish` | 0 | 3 | 10 | 17 | 20 | 27 |
| `elite` | +1 | 4 | 11 | 18 | 21 | 28 |
| `boss` escorts | −3 | 1 | 8 | 16 | 18 | 25 |
| champion (escorts +2) | — | 3 | 10 | 18 | 20 | 27 |
| finale (Endbringer) | +2 | | | | | 30 |
| *Guild hire, for reference* | | 2 | 9 | 15 | 20 | 25 |

Read across a row of the map: **the Skirmish is at your level, the Elite a step over, the
opener under, and the Guardian is beaten on its body, not its level** — a 550 champion over
the act's tier of escorts, sitting a level under you. The Elite's contract outranks a hire on
level in every act; the Skirmish's ties it in Acts 2 and 4 and outranks it in 3 and 5 (Act 1's
sits under, and is not the contract a hire competes with).

**Why the Guardian sits under par.** The old curve paid Acts 1–2 *zero* steps and Act 2 was
still the wall. A level cannot pay zero: the lowest honest reading of a Guardian is a few
levels under the player, and that is where the fit landed (§6). The escort tier
(`SPAWN_TIER_BY_ACT`, Mid from Act 2) is a step function — Early escorts at Act 2 measured
91–94% cleared, Mid 70–79% — so the level is the fine dial and the tier the coarse one.

## 5. The loadout seam

`EncounterOptions.loadout: EnemyLoadout` — `{ gear?: rarity weights, passiveIds?: [...] }` —
applied to every enemy the generator builds (`applyLoadout`), the champion included, and the
same shape the opener's escorts already used for their item (`escortLoadout`). `RosterEntry`
already carries both fields and the scout sheet already lists equipment, so nothing new is
stored or drawn.

**Wired today: gear only, from Act 4** (`ENEMY_GEAR_FROM_ACT`, `enemyLoadoutFor`): one item
per hero-pool enemy, Guardian escort and champion, rolled on the node's own rarity curve
(`LOOT_SOURCE` — the Elite's and the Guardian's a tier ahead). Stripped on a contract claim,
as any equipment is. Passives are the seam's other half and nothing hands them out yet.

Why gear has to exist at all: level alone falls behind. The player's stat total in Act 5 is
base + growth + up to three items + four Banners + Boons + a Class; an enemy at Act 5's level
has base + growth. The old curve's 13 steps (+390) covered that gap by fiat; a level cannot
(the cap is 30), and the sim shows it — Acts 4–5 at 82 / 97% cleared with levels alone. Gear
is the axis that grows the way the player's does, because it is the player's axis.

## 6. Measured (sim pass 9, 3000 runs, seed 1, greedy pilot)

| | baseline (steps) | levels only, first table | **shipped** |
|---|---|---|---|
| full-clear | 43.6% | 20.3% | **42.4%** |
| Act 1 / 2 / 3 / 4 / 5 cleared | 85 / 85 / 96 / 76 / 82 | 67 / 50 / 88 / 76 / 92 | **79 / 79 / 98 / 76 / 92** |
| Guardian, Act 2 / 4 / 5 | 85 / 76 / 82 | 52 / 76 / 92 | **81 / 77 / 92** |

The first table (Skirmish +1, Elite +2, escorts +1, champion +3, hero-grade champions, no
gear) was the honest one and halved the full-clear: a level is worth more than a step's stat
total says, because a grade concentrates growth in the stats the body swings with where a step
spread +10 over random stats with HP double-weighted. The shipped table gets back to the
baseline's full-clear with the Guardian a little under par, the champion front-loaded, and gear
from Act 4.

Two dials left for playtest, both named in the table above:

- **Act 1 at 79% (was 85).** The Skirmish at par against a two-hero roster. `skirmish` −1
  measured 88% there but puts a Skirmish contract a level *under* a hire from Act 3, which is
  the inversion `test/recruitment` guards; the alternative is the hire's `+1`.
- **Act 5 at 92% (was 82).** Gear from Act 3 instead of 4 measured 90 / 76 / 92 with a bump at
  Act 3; a second item for the Guardian, or passives through the seam, are the levers that
  scale with the act. `CHAMPION_LEVEL_BONUS` barely moves it under all-E grades.

## 7. Locked invariants this reverses

| Was | Now |
|---|---|
| "Encounters scale by act on two tracks … an accelerating `ACT_STEP_CURVE`" | One axis: level, per node, off par. `ScalingTrack`, `BASELINE_ACT`, `ACT_STEP_*`, `CHAMPION_STEP_MULTIPLIER`, `ENEMY_LEVEL_BY_ACT`, `ENEMY_LEVEL_LAG` are gone. |
| Elite +10×2, Guardian +20×3 node-kind stat bonuses | The kind sets the SIZE and the level offset; no stat bonus. |
| "level is inert for a Guardian's champion" | A champion grows — on `CHAMPION_GRADES`, all E — and carries gear from Act 4. |
| "an enemy spawn never rolls [its grades]" (`titanspawn.ts`) | Every spawn rolls its line's grades to the node's level. |
| "a contract hero arrives at the act's enemy level (6/12/17/22/26)" | At its NODE's level: the Skirmish's is par, the Elite's par + 1. |
| "a contract hero outranks a hire on level" (strict) | The Elite's outranks; the Skirmish's never trails (ties from Act 3). Finished-vs-raw and Mastery still separate them. |
| `BrokenSeal` snapshots `statGrants` only | Also `growthStatGrants`, so the finale fields the champion at the growth it was beaten at. Save v17. |
| `generateFinaleEncounter` rolls nothing | It rolls the Endbringer's growth, at the node's seed. |
