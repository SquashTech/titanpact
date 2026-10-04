# xp-overhaul.md — The XP Overhaul

> **STATUS: BUILT IN FULL** (§2–4 decided 2026-09-13, §5's four acts decided and built 2026-10-02,
> all per user direction; every phase of §8 is in). In force: the `L³` curve and authored
> encounter XP (§2), moves from a per-hero level **schedule** with the roll kept (§4), each band
> offering its own tier, Late-tier mana ×0.75, and **four acts then the finale** (§5).
> **Superseded by `docs/mastery.md` (2026-09-14):** §3's **Ichor is retired** (its seats went back
> to the Scroll Cache), and §4's **Evolution moved off the schedule onto Mastery pip 5**. The
> schedule has since been cut to **five offers a hero** and a **two-move starting kit**
> (2026-09-30, `CLAUDE.md`). This doc replaced the Scroll ladder of `growth-overhaul.md` §4, §11, §12.

---

## 0. Why this exists

Two measurements, one week apart, pointed at the same thing.

**The clock.** `scripts/sim/time.ts` put a full clear at **~88 minutes** tapping against a
45-minute target, half of it out-of-fight. The single largest out-of-fight item was **the Mastery
ladder: ~47 rung screens a run** (~9 min).

**The load.** The game ran *two* progression models side by side. Every hero the player did not
control — enemies, Guild hires, contract heroes — read its rank and Evolution off its **level**
through one table. Only the player's six carried the Scroll economy on top: a currency, a price
curve, an income table, a purse, a bank button, a forced screen. That was the system a new player
had to learn that nobody else in the game used.

The answer was to stop the player's roster being the exception: levels became the one faucet for
stats and moves, the way Pokémon does it, except that the move at each level is **rolled from a
band**, not fixed.

---

## 1. The rule this reduces to

> **One curve. A hero's level is the only thing that says what it has, and the only things that
> move it are what the roster won and what the player aimed.**

The Scroll was a second clock running beside the first. `growth-overhaul.md` §4's guard rail —
*the ceiling sits behind the spend, never behind a clock* — was written because act-gating made
**holding** a Scroll optimal. With no Scroll there is nothing to hold; the rule's premise is gone,
and it retires. (Mastery pips later brought a currency back, flat and unbanked — `mastery.md`.)

`growth-overhaul.md` §1's rule still governs: *a bare number never gets a screen, and a screen
never buys a bare number.*

---

## 2. The XP curve

**Level is derived from cumulative XP.** `RosterEntry.xp` is stored; `level` is read off the curve
(`xpForLevel` / `levelOf`, `src/run/growth.ts`). Pokémon's Medium Fast:

> `XP(L) = L³` — the cumulative XP to *be* level L. 27,000 to the cap of 30.

**Encounter XP is the authored object; par is derived from it** (2026-09-13, per user direction).
The first build derived XP from a level table so a hero at par landed exactly ON a level every
fight — the bar filled to the top every time, XP was never a number the player saw, and a fight
paying two levels and the next paying one read as arbitrary. Now `ENCOUNTER_XP_BY_ACT` —
**150 / 560 / 1060 / 1750** a fight by act, the finale 5000 (unspent) — is what a win pays; **the
Guardian pays ×2 and the Elite ×1.5** (`ENCOUNTER_XP_MULTIPLIER`; par assumes the Skirmish, so the
Elite is above par). Par reaches **8 / 14 / 19 / 24** at the act ends and walks 5/6/8, 10/11/14,
15/17/19, 20/21/24 inside them. **The bar is real:** the fight result sweeps each hero's bar from
where its XP stood to where the grant left it (`src/view/shared/xpBar.ts`). A partial bar is the
normal state and the whole of how catch-up reads.

**Roster-wide and automatic**, benched included. No pool, no allocation.

### The convex curve is the mechanism

A fixed XP amount is worth more levels to a hero below par and fewer to one above it — what the cube
does, not a rule anyone wrote.

- **Catch-up is built in.** A Guild hire one act behind receives the same XP per encounter and
  climbs faster for being lower. The gap closes on its own, slowly.
- **A carry throttles itself.** Any aimed XP into one hero buys less level than the last.

### What this changes about "a delta, never a target"

A hero that joined late used to **stay behind permanently**. Under a convex curve the same XP
grants close the gap asymptotically. The archetype survives (a hire *is* behind, and visibly), but
"permanently" became "slowly". Measured: a hire that misses eight wins ends the run two levels short
(`test/growth.test.ts`).

---

## 3. Ichor — XP the player aims

> **RETIRED 2026-09-14 by `docs/mastery.md` §4.** Ichor was a reward node (and a Guild Hall shelf
> item) granting XP to ONE hero, priced in fights' worth of the act's XP (`ICHOR_FIGHTS`). Measured,
> ~13 levels-at-par a run moved full-clear by nothing — focus vs spread was a wash (60.3 / 61.8%) —
> and it was a second aimed currency beside Mastery Scrolls with the same who-screen. Its seats
> went back to the Scroll Cache. The catch-up it was *also* for is the curve's job (§2).

What it taught, kept: it was **not participation XP** (`growth-overhaul.md` §3 — that compounds:
the four who fight level, so they win, so they fight), and a node the player aims is a better focus
dial than a percentage the act sets. Mastery pips are that dial now.

---

## 4. Moves come from levels

**The Scroll ladder is deleted whole** (§7). **What replaces it is the thing enemies already used:
a per-hero schedule read off level** (`LevelSchedule`, `src/engine/content.ts`;
`src/run/progression.ts`):

```
HeroDefinition.schedule: {
  offerLevels:    number[] // levels that roll a move offer from the open band
  midLevel:       number   // the Mid band opens; Early expires
  lateLevel:      number   // the Late band opens; Mid expires
  signatureLevel: number   // the guaranteed signature learn (mastery.md §5)
}
```

(`evolutionLevel` was here until `mastery.md` moved the Evolution onto pips.)

**Keep the roll, lose the currency.** This is the one place *not* to copy Pokémon: Charmander learns
Ember at 12 every game, and in a roguelike that makes every Cinder the same Cinder. A level on
`offerLevels` fires an offer **rolled from the band that level has opened**. Take it or decline; the
move is burned either way; at `MOVE_CAP` it is replace-or-decline. The schedule says *when*, the
band says *from what*, the roll says *which*.

**The offer lands on the level-up report** (`levelUpFlow.ts`). The report gained exactly one
decision kind, and it must not gain a second. **A hero takes at most ONE entry per level-up**
(`RosterEntry.scheduleTaken`, `pendingScheduleEntry`), so a raw hire's backlog is worked off one
fight at a time and the report never stacks two decisions on one hero.

**Every hero authors its own schedule** (`src/data/heroes.ts`), pinned by `test/moveTiers`:
**five offers — two Early, two Mid, one Late** (2026-09-30, per user direction; it was 5–7), the
first Mid at the Mid opening, the last by the end of Act 4; a hero starts with **two moves**.
`DEFAULT_SCHEDULE` (4, 7, 10, 16, 22; Mid 10, Late 21) is what an unauthored definition — the
Titanspawn and the companion — reads. **Each band offers its own tier**: Early expires at
`midLevel`, Mid at `lateLevel`.

**Offers are staggered across the roster** (2026-09-16). Par is roster-wide, so a hero's own
spacing does nothing when every schedule shares a phase: the first pass put 33 of 36 heroes' first
offer on the opener and six move screens after one fight. Every offer level is now the par a FIGHT
reaches, and schedules are phased against each other so each fight's window holds a handful.
Pinned in `test/moveTiers` ("staggered").

**One model for everybody.** A generated hero reads the same schedule as a roster hero
(`rollLevelProgression`). A contract hero arrives with every entry below its level taken; a Guild
hire arrives with them owed, which is what raw means.

**What survives:** the Mentor and the Tutor — the only way to a move *ahead of* its schedule;
Classes, Boons and items; the companion's tier-steps (now at 5 and 10 Mastery pips); every authored
Evolution path, with only the trigger moved.

### What is given up

The carry build as **increasing returns inside a hero**. Under one curve, concentration has
*decreasing* returns in level. **Titanpact's team-building is about who and which, never how
much** — with Mastery pips (`mastery.md`) the one place concentration still pays.

---

## 5. Four acts, then the finale

> **DECIDED AND BUILT 2026-10-02, per user direction.** Playtest found the run's escalation ending
> at the Act 4 Guardian: every hero held a full kit and full sockets by then, and Act 5 was stat
> rolls, gear merges and one forced Tutor.

**The shape.** `TOTAL_ACTS` = 5, `SEAL_ACTS` = 4 (`src/run/state.ts`): Wild's Edge, then three
chosen Locations, then the finale as act 5 — the Vigil → the Herald → the Titan's Eyes. Four seals
broken of six base Locations, so **two** stay shut every run.

**Delete the fifth act, do not compress the four.** A par re-fit to 9/17/24/29 (variant B) was
measured and rejected: it pulled every schedule forward and moved the plateau into Act 4 rather
than removing it. Keeping acts 1–4's XP as it was means **acts 1–4 play exactly as before** and the
build completes at the last Guardian. The roster enters the finale at par 24.

**What shipped:**

- `ENCOUNTER_XP_BY_ACT` 150/560/1060/1750, finale 5000 (unspent); par 8/14/19/24.
- `masteryForAct` = `2N − 2` for acts 1–4; **the finale reads `MASTERY_CAP` by rule**, so its
  enemies keep their mastered innates.
- `ACT_LEVEL_ADJUST[finale]` = 0 (at par 24 the level clamp no longer bites, so +2 would be a real +4).
- **Act 4's Guardian on C** (`CHAMPION_GRADE_BY_ACT`) — it is the last seal.
- The finale is **Herald + 4 escorts** — one per broken seal.
- Four Guardians, four Banners, four Classes; the spliced row is the Mentor in 1–3 and **the Tutor
  in act 4 only** (one guaranteed Late move a run, not two).
- **Mastery supply: the MVP pip and shelf 2-packs**, the Scribe at 2 + 2 (`mastery.md` §3).
- **The finale re-fit:** Eyes Int −20, Herald Atk and Int −20, `WITHERING_GAZE_FRACTION` 0.04, the
  Eyes' HP **kept** at 810 / 945 (per user direction — they should feel big).
- `SAVE_VERSION` 20; in-flight five-act runs are discarded.

**Measured (3000 runs, chart / skilled pilot):** the finale **74.4 / 97.3%**, full-clear
**48.2 / 90.1%** (five acts: 54.6 / 91.6%), the Act 4 Guardian 97.7% chart; **62.6 min Reader**
skilled, against 73.0.

**What the finale wall was.** Levels were the smaller part — restoring Act 5's XP bought four points.
The rest was the loadout layer Act 5 paid for: its Banner (60–80 stats a hero) and an act of gear
and Smithy work. A fifth Banner put the finale back exactly; per user direction it was not taken,
and the bosses came down instead. No single number did it; the chosen set spends four small ones.

**Mastery supply** — none of the levers moved full-clear; where the pips land mattered as much as how
many. The shelf buys for the four strongest heroes and a pack doubles down on them; the MVP pip goes
where the fight says.

| Lever (finale act term 0) | Full-clear skilled / chart | Pips a completed run | Every hero evolved |
|---|---|---|---|
| Scribe 3+3 | 87.3 / 41.9% | 34.4 | 57.7 / 40.6% |
| Shelf 2-packs, Scribe 2+2 | 86.7 / 42.9% | 33.8 | 33.8 / 24.0% |
| MVP pip, Scribe 2+2 | 87.1 / 41.6% | 37.6 | 67.3 / 48.9% |
| **MVP pip + 2-packs, Scribe 2+2 (shipped)** | 87.5 / 42.3% | 45.0 | 77.1 / 54.0% |

**Open, for the designer:**

- **The finale's feel.** Whether the Eyes at their kept HP read as the climax is for play to say.
- **Act 4's Guardian as the last one.** On C it clears 97.7% chart (98.0% on D) — the grade barely
  moves it. If the final seal does not read as the hardest in play, a third escort is the next lever.
- **One Tutor a run.** Whether the Vigil takes a Tutor ("last things before the test") is the
  natural home for a second.
- **Mastery 10** — whether one hero reaching ten is still a run's realistic ceiling.
- **Ascension's per-act tables** (`WOKEN_ESCORTS_BY_ACT`, the A1 measurements) were not re-run for
  four acts.

---

## 6. What the run feels like

Node → do a thing → node. The post-fight chain is *victory and level-up report (with any offers and
the signature) → Banner → Crucible → map*. No ladder behind it, no purse to read.

The arc: Act 1 is who you are (draft, companion, first contract, Early kits); Act 2 is who you are
becoming (Mid bands open, the first Evolutions, the roster fills); Act 3 is the team taking shape
(signatures, Late bands); Act 4 is the finished team under test; the finale is the test. What the
player chose is the roster, the paths, the Classes, the Boons, the items, and where the Mastery
went.

---

## 7. What is deleted

Done: **Mastery Scrolls as a ladder** (`masteryScrollsSpent`, `scrollCost`, rungs, rank,
`RANK_THRESHOLDS`, `EVOLUTION_RUNG`, `canSpendScroll`, the purse, `masteryDeferred`); **Scroll
income** (`scrollsFor`, `ACT_SCROLL_STEP`, the Guild Hall's Scroll bundle); **the screens**
(`MasteryScreen`, `MasteryBoard`, the map's Scroll chip, the Bank button, the Vigil's clear-on-exit);
**the enemy's private table** (`ENEMY_RUNGS_BY_LEVEL`). `scrollReward` and the shelf later came back
as flat Mastery Scrolls (`mastery.md`).

---

## 8. Order of work

All phases **DONE**. Measured on the sim (1000 runs, seed 11, greedy pilot unless noted).

| # | Phase | Status |
|---|---|---|
| 1 | **XP under the hood** — `RosterEntry.xp`, level derived off `L³` | **DONE 2026-09-13.** Full-clear 51.7 → 61.9%: the whole lift is catch-up landing on recruits off par. |
| 2 | **Ichor** (since retired, `mastery.md`) | **DONE 2026-09-13.** ~13 levels-at-par a run; focus vs spread a wash; full-clear unmoved. |
| 3 | **Levels teach** — the schedule, offers on the report, the ladder deleted | **DONE 2026-09-13.** Full-clear 61.8 → 54.1%, all of it the Act 1 wall (83 → 76%). Late band reached by twice as many (81% vs 37%). Offers made 41.5 decisions a run — the cut came in phase 4. |
| 4 | **Author 36 schedules** | **DONE 2026-09-13.** Offers 41.5 → 26.4 a run; full-clear 51.3%. Crossed against the grades on purpose: a hero can bloom in stats and turn early, or the reverse. |
| 5 | **Four acts and the finale** | **DONE 2026-10-02.** §5. |
| 6 | **Re-fit** (per user direction: Late moves realistically accessible) | **DONE 2026-09-13.** Three causes of the 4.5% Late-cast share: (1) a Late offer rolled from Mid+Late — **each band now offers its own tier**; (2) Late offers sat at 25–29 — re-authored earlier; (3) a 70+ move against a 50–95 pool is cast once a fight — **Late-tier mana ×0.75** (floor 45; the 100+ whole-pool casts exempt). Landed: full-clear 57.1%, Late 18.5 / 28.9 / 36.4% of Acts 4 / 5 / finale. MP Regen 10 → 15 was tried and is not the lever. |

**Phase 6's Act 1 finding:** stat ratios were byte-identical to before the overhaul, so the 76% wall
was kit — the ladder had let one hero buy Mid moves and an Evolution inside Act 1 — and every
symmetric number measured ±0 there. Mastery answered it with an Act 1 Evolution *by choice* (the
Scribe before the fork, `mastery.md` §3), and `ACT_LEVEL_ADJUST` (Act 1 −2, `enemy-levels.md`) is the
enemy-side dial.

Same day: **the Tutor became the Mentor's beat at Late** (`docs/run-loop.md` "The Tutor"), and mana
growth went to 2 a point (back to 1 on 2026-09-28; `docs/mana.md` "Growing the pool").

---

## 9. Locked invariants this overturns

All landed. Rows marked † were later superseded by `mastery.md`.

| Before (`CLAUDE.md`) | Became | Phase |
|---|---|---|
| Levels are automatic and roster-wide; the curve is authored as levels | Still automatic and roster-wide; **the curve is authored as XP a fight pays** (by act, Guardian ×2, Elite ×1.5) and par is derived | 1 |
| A level grant is a delta; a late hero stays behind **permanently** | XP is the delta; a convex curve closes the gap slowly on its own | 1 |
| † There is no per-hero stat-investment currency | Ichor as per-hero **level** investment — retired; Mastery pips took the role | 2 |
| Moves come from ONE faucet: Mastery Scrolls, gated by Rank | Moves come from ONE faucet: **levels**, on a per-hero schedule, rolled from the band the level opens | 3 |
| A rung has a price that rises; the purse banks; the ceiling sits behind the spend | Deleted. Nothing is held, so nothing needs to be behind a spend | 3 |
| † Evolutions come from the 4th rung, paced by the player | From `schedule.evolutionLevel` — now from Mastery pip 5 | 3 |
| A level-up REPORT is not an allocation screen — one button, no choice | Still not allocation. It gains exactly one decision kind: the move offer | 3 |
| A generated hero reads its ladder off level through `ENEMY_RUNGS_BY_LEVEL` | Through the same schedule a roster hero uses | 3 |
| † `EVOLUTION_LEVEL` gates nothing; authored data only | Per-hero and load-bearing — then deleted with the move to pips | 3–4 |
| Five acts of the decided shape, then a finale | **Four**, then the finale | 5 |
| Five Guardians, five Banners, five Classes, six heroes — one ends Classless | Four of each; two heroes end Classless | 5 |
| `SPAWN_TIER_BY_ACT` folds five acts into three tiers | Early / Mid / Mid / Late, the finale Late | 5 |

Untouched: the 550 and 28 budgets, growth grades, the damage and heal formulas, the
graft-owns-the-slot rule, Classes as verbs, Boons, the item rules, the Banner family, the Pact
Clock, the companion, potions, the map shape within an act.

---

## 10. Open questions — DO NOT silently resolve

Answered and removed: whether the carry can rush an Act 1 Evolution (by choice, through Mastery);
offers stacking on the report (staggered across the roster, §4); how many offers a hero (five,
2026-09-30); a Mana Well node (built, now +40 Mana / +5 MP Regen); the Act 1 wall (§8); and every
Ichor question (retired).

- **Which profile is the 45 minutes for?** Four acts land a skilled Reader at ~63 min. The
  remaining lever for the reader is the command phase (declaring actions is ~25 min a run at a
  guessed 6 s each — preselected targets and a "same as last round" tap are UX, not design). Decide
  the player before deciding the number.
- **Is `L³` the right curve?** Steeper (Slow, 1.25·L³) makes a carry throttle harder and a hire
  catch up faster; shallower does the reverse. Shipped the cube; no batch has argued against it.

### Watch in playtest

- **Does the roster read too flat?** If six heroes at par still read as interchangeable, the
  schedules are too similar — an authoring finding, not a systems one.
- **Does declining an offer feel bad when it was free?** A Scroll declined was a Scroll spent; a
  level-up offer declined costs nothing but the roll. If declining starts to feel like nothing, the
  Mentor/Tutor grammar (a free pick, earned) is the drafted answer, on the Late band only.
