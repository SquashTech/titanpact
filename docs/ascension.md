# ascension.md — The Ascension ladder: Permadeath, then rules

> **STATUS: A1 DECIDED 2026-09-21 (per user direction); PHASES 0–1 ARE IN — A1 is PLAYABLE (`src/run/ascension.ts`, the title's rung picker, the Fallen beat), phase 0 measured in §9b. Phase 2 is IN (2026-09-26) as §7a records it — the bestiary page, the companion star and the awakening; phase 3 (the star colours) NOT BUILT. A2–A5 PROPOSED, not decided.**
> Ascension 1 is Permadeath from the first fight, the Revive consumable the one way back, offered
> at the end of the fight that took the hero — and **a Revive cannot save the companion** at any
> rung. The three companion additions in §7 are decided the same day. Every rung above A1
> escalates through a RULE — boss verbs trickled down from the finale, authored enemy comps, the
> economy — never through a bare enemy stat multiplier (the standing constraint of 2026-09-09).
> Recruitment stays exactly as it is at Base; the ladder is where it gets its demand. §10 lists
> the invariants each rung reverses; until the §9 phase that replaces one lands, the rule in
> CLAUDE.md is still the rule in force.

---

## 0. Why this exists

**Nobody recruits past Act 2, and the game does not care.** In every playtest run the roster fills
in Act 1 — the draft, the companion after the first fight, one Guild Hall hire before the Guardian
— and never changes again. The Recruit Contract counter sits at whatever the act ends paid it,
the Guild Hall's contract shelf has never sold one, and the runs are cleared anyway.

That is not a tuning miss on the raise-vs-recruit axis (`progression.md`, "LOCKED design
intent"); the axis has lost one of its two ends. Three decisions, each right on its own, took the
reasons to churn a roster:

- **Roster-wide automatic levelling** (2026-09-10) — a hero held is at par, its schedule walked,
  without anyone spending anything. A contract hero's *finished* axes are finished on everyone.
- **Every fight fields the whole roster, cap 6** (2026-09-17) — a recruit past Act 1 is a
  termination first. Slay the Spire's rule: adding is fun, removing is a price, and here removing
  is the precondition.
- **Gear absorption** (2026-09-15) — termination destroys up to three merged items, a Boon, a
  Class, a Ley Line, and a contract hero arrives with one item and `2N−2` pips. It is finished on
  the axes that stopped being scarce and raw on the axes that are.

Under those three, a recruit is a swap nobody takes because nothing is lost that a recruit would
replace. **Attrition is the only thing that makes a mid-run recruit necessary** — Darkest Dungeon
and Into the Breach both drive their rosters with death — and attrition does not belong in the
Base game, which the designer wants breezy: a place to learn the mechanics and find the fun
playstyles, cleared by a decent strategy player inside a few attempts. Ascension is where mastery
is priced (the 2026-09-09 note), so Ascension is where the roster is allowed to break.

**The companion is the pilot.** One hero has been mortal since 2026-09-13, and it is the run's
biggest late bloomer: kept to the finale and stepped to its Late body it is often the strongest
piece on the field, which is the goal. That one hero already proved the rule reads: a KO that
removes a hero from the run is understood the moment it happens, it is priced by rules that
already exist, and the game still wins. A1 is that rule for everyone.

---

## 1. The rule this reduces to

**Base is the lesson; a rung is a rule.** Ascension changes *what the player has to solve*, never
only the size of the numbers they solve it with. The one place a number is the honest lever is
the economy, and it gets one rung.

Beside it, one coupling that every rung has to respect: **the Revive is the price of Permadeath.**
Eighty gold, one a visit, five visits — a player who buys every one has spent 400 gold on
insurance across a run whose Act 1 purse is ~45. Every other gold sink on the ladder — the Anvil,
the Enchanter, a hire, a contract — competes with it. So a later rung that raises a Smithy price
is really a rung with fewer Revives, and the two dials are one dial: turn it on one rung, name it,
and leave it alone on the others.

---

## 2. Ascension 1 — Permadeath

**Every roster entry is `mortal`.** The companion's rule (`src/run/companion.ts`,
`RosterEntry.mortal`, `absorbCompanions`) generalised to the roster: a hero knocked out in a fight
is gone from the run when the fight resolves, its gear and its pips with it, exactly as the
companion goes today. The roster shrinks; the whole roster still fields; lock-in still derives
from the side's size (`lockInThreshold`, half, floor 2).

**The Revive is the one way back.** At the end of a WON fight that knocked a hero out, the player
is offered — for each fallen hero, while the stock lasts — a Revive to keep it (§3). A lost fight
is the run, as it always was; there is nothing to revive into. The in-fight Revive
(`useConsumable 'revive'`, 2026-09-18) keeps its job and becomes a genuine bet: spend it
mid-fight for a body on the bench at half, or hold it for the certain save at the end. That is a
better decision than the one it holds at Base.

**A Revive cannot save the companion. DECIDED.** At Base a KO'd companion is gone with no faucet;
if A1 let a Revive stand it up, the companion would be *easier* to keep at A1 than at Base and its
star (§7) would get cheaper as the ladder rose. So the companion is the one body a Revive does not
work on, at every rung — a Titanspawn is not a mortal, and §7's Gaze exemption says the same thing
from the other side. On the Fallen screen its row shows with no button; it is the pilot of the
harder rule, as it has been from the start.

**What stops existing at A1.** `RosterEntry.down` has no mid-act meaning: a KO is revived at the
fight's end or gone. So the act-end free stand-up, the Rest seat's stand-up and the mend's *a
downed hero counts as a whole one* branch (`rosterMissing`, `mendPrice`) are dead code on A1 —
not removed, since Base still reads them, but never reached. Wounds are otherwise unchanged: HP
still carries across the act's nodes, the mend still prices what is missing. The map-side Revive
(the squad screen's, `reviveHero`) has nothing to act on; the Fallen beat is where the Revive
lives on A1.

**A roster below two.** Whole-roster-fields means a roster of one fields 1v2. Let it — a forced
end is a screen, and the wipe rule already ends the run. The run ends at zero, or at a lost fight,
never at a count.

**The Act 1 enemy-count cap** reads the *immortal* roster today (`encounters.ts:82`, so the
tutorial-shaped 3v2 Skirmish ignores the companion). Under A1 that is the empty set. It must read
*the roster minus the companion* — which is the seam §9 phase 0 opens: `mortal` is the RULE,
`companionHeroId` the IDENTITY, and `companionOf`, the Scribe screen's *Grows!* label and the
count cap all read the rule today because the two have never disagreed.

---

## 3. The Fallen — the beat

The companion's *lost* beat (`CompanionScreen`, `beat.kind === 'lost'`) is this screen with no
button on it. The Fallen generalises it: **first in the post-fight chain, before the level
report**, in the slot `absorbCompanions` holds today (`App.tsx:771`) — the report must never list
a hero that is already gone, and a revived hero must be on the roster before the roll lands so it
levels with everyone.

- One row per hero the fight knocked out, in roster order, the companion's row last and unbuttoned.
- Each row: the hero, its level, what it wore, and **Revive** while the stock is above zero. The
  stock is drawn beside the rows and counts down as it is spent; two Revives against three fallen
  is the screen's whole tension, and it is a screen precisely because that choice exists. With
  nothing fallen the beat does not fire; with no stock it fires as the companion's does — a
  farewell with a Continue.
- A revived hero stands at the Revive's own figure (`REVIVE_FRACTION`, half, `wounds.ts`),
  written into `wounds` so the next fight opens it there. Its gear, pips, Boons and Class are
  untouched — it was never gone.
- A hero let go is absorbed exactly as a companion is: off the roster, gear and pips with it,
  the `Absorption.absorbed` list feeding the screen's farewell.
- **It does not fire on the finale's win.** The run is over and there is nothing to revive into;
  and the companion star (§7) reads *alive when the Eyes closed* — a post-finale Revive would buy
  a star, so the roster at the Eyes' close is the record, unmended.

---

## 4. The economy of a Revive under Permadeath

Supply today, unchanged by A1: `REVIVE_PRICE` = 80 and `REVIVE_PURCHASE_LIMIT` = 1 a visit at a
Guild Hall the map forces every act, so five a run bought; plus `REVIVE_DROP_CHANCE` by node
kind, rolled only when the potion roll missed. Gold scales by act (`ACT_GOLD_SCALE` ×1 … ×3), so a
Revive is most of the Act 1 purse and a routine purchase by Act 4 — which is the right shape:
early, a KO is expensive and a Revive is a real choice against the hire; late, the roster is
worth more than the gold.

**A1 moves none of these numbers.** The first measurement (§9 phase 0) is what says whether the
supply is right, and the report already carries every column it needs: `spent:revive` in the
gold ledger, `recruitsBySource`, and how runs end. The two readings that would move a number:

- Runs ending by *roster exhaustion* rather than by a wipe — the supply is short, or the fork-only
  contract cash-in (§6) is the wall.
- `spent:revive` crowding out `spent:anvil` / `spent:enchant` entirely — the price is right for
  the rule but wrong for the Smithy, and A4 has to know that before it raises anything.

---

## 5. The ladder — A2–A5, PROPOSED

Each rung is a rule, carried on a lever that mostly exists. The finale (`titan-eyes.md`) built a
vocabulary of boss verbs no Guardian uses — the ward, the phase, the drain field, Beheld — and
trickling them down is data, which makes boss deadliness the cheapest thing on the table. The
designer's own list for these rungs: Banners weaker, gear upgrades and enchants pricier, enemy
comps scripted rather than random, new mechanics on boss fights.

| Rung | Rule | The lever |
|---|---|---|
| **A1** | **Permadeath.** Every hero mortal; the Revive the one save, offered at the fight's end; the companion beyond it. | `mortal`, `absorbCompanions`, `reviveHero` — all exist. |
| **A2** | **The Guardians wake.** Every Guardian carries its type's Mark, and is **warded while its escorts stand** — the Herald's rule, trickled down. The boss is the last thing you kill, and it grows while you get there. | `titansMarkFor` (measured 2026-09-20: a Marked champion was the whole of a twelve-point Act 1 loss — the size of the rung is already known), `wardedWhileCompanyStands`. |
| **A3** | **Warbands.** The fork and the Guardian's escorts draw **authored comps** — a setter beside its reader, a Shield wall behind a DoT, a Haunt engine — in place of the typing roll, and enemies wear gear from Act 1. The tile still previews the typing; what it cannot preview is that the pair was built. | `nodeEncounter` / the map-seeded draw in `src/run/encounters.ts`; `ENEMY_GEAR_FROM_ACT` 4 → 1. The one rung that is authoring work: a warband is content, one or two per type pair. |
| **A4** | **The Banners fray.** Each Banner at half, and the Anvil and Enchanter at ×1.5. The economy rung — the one that taxes the Revive (§1). | `guardianBannerRelics` (`src/data/relics.ts`; the three are measured parity, so one factor keeps it), `ANVIL_PRICE_BY_TARGET`, `ENCHANT_PRICE_BY_RARITY` (`src/run/shop.ts`). |
| **A5** | **The Titan's reach.** Withering Gaze at a tenth, every Guardian a two-phase fight, and an Ascension AI tier. | `WITHERING_GAZE_FRACTION` 0.05 → 0.10 (a tenth measured as the Eyes phase's whole margin, `titan-eyes.md` §10.3); the `reserves` phase (`Squad.reserves`, `buildCombatState.ts`) is the finale's and takes a second phase on any squad. **The AI tier does not exist** — the one rung with nothing to turn yet (`run-loop.md:586` reserves it a dial). |

Notes on the shape:

- **A2 and A5 are the "new boss mechanics" category and cost almost nothing**, because the verbs
  are built and measured. A2 lands *after* A1 so the Mark's twelve points fall on a player who has
  already learned to budget a Revive.
- **A3 is the 2026-09-09 note's real ask** — deadlier comps, real strategy, smarter enemy — and the
  only rung with a content bill. It is also the one that turns the fork's preview from a chart
  lookup into a tell.
- **A4 is deliberately the only number rung**, and the only one that touches the purse. Whether
  a halved Banner reads as *weaker* or as *why bother* is a playtest question (§11).
- **Nothing on any rung cuts recruitment supply.** The ladder exists to find out whether contracts
  and hires carry a roster under attrition; starving them would test nothing.
- **Rung order is the designer's.** Permadeath is A1 by decision; the rest is a proposal and the
  columns can be dealt differently. What should hold is one rule a rung, and the economy on one
  rung only.

---

## 6. Recruitment under attrition — what the ladder is for

A roster below six is a state the Base game reaches only through the companion. Once it is
common, every recruitment rule already written starts to read the way it was designed to
(`progression.md` "The raise-vs-recruit axis"):

- **A contract hero arrives finished, at its node's level, armed** — exactly what a roster with a
  hole in Act 4 needs. **A Guild hire arrives raw, one act behind** — exactly what it does not,
  and worth its 50g only while the act it is behind is a small share of the run. The *decaying
  runway* is visible for the first time, because the choice is made under a deadline.
- **Nothing is terminated.** Filling a hole has no Slay-the-Spire remove-first cost, so the
  contract counter, the shelf's blank contract at 20g and the *Contracts held* number on the map
  header all mean something.
- **The Second String gets its identity back.** Fourteen recruit-only heroes are the Guild Hall's
  depth, and under attrition depth is what the shelf sells.

What to read off the first measurement, and what each reading would move:

| Reading | It says | The dial |
|---|---|---|
| `recruitsBySource.contract` rises, `spent:contract` stays 0 | the free contracts suffice; the shelf's is redundant | leave it, or delete the shelf line at Base too |
| runs end by roster exhaustion with contracts held | the cash-in is the wall — the fork is the only place a contract is spent, once an act, and a hero lost at the opener leaves a hole through two fights | widen where a contract can be spent on A1 (§11), not the supply |
| `hire` rises late | the raw hire is a body when a body is all that is needed | the runway decay is doing its job; nothing to move |
| neither rises | attrition is not biting — the Revive supply is covering it | `REVIVE_DROP_CHANCE` / the purchase limit, before anything on A2+ |

---

## 7. The companion — three additions, DECIDED

The companion kept to the finale and stepped to its Late body is the run's strongest piece and
the intended payoff, and the meta layer does not know it exists: `knownHeroIds` deliberately
excludes a companion's body (`profile.ts:238`). Three additions, all rungs including Base:

1. **A bestiary tab in the Compendium.** All 42 spawn bodies (`src/data/titanspawn.ts`), each
   revealed as *met* (fought) or *held* (was the companion), the entry drawn by `TitanspawnGlyph`
   at the highest body the companion reached. A `knownSpawnIds` beside the hero set. It does
   double duty — the enemy mob lines get a page they never had.
2. **A star per type for clearing with the companion alive.** The hero star is keyed by Evolution
   path; the companion has no path, it has a tier-step, so its key is the type: `companion:<type>`,
   fourteen to collect, on the bestiary tab. **Alive is the condition, not the Late body** — the
   Late form is the trophy art on the entry, never a second star (star tiers are Ascension's,
   `constellation.md` §6). **Read at the Eyes' close, not at the last Guardian's fall**:
   `recordRunEnded` stars the roster as it stood when the last Guardian fell, and a companion
   KO'd in the finale — the fight it is most likely to die in — is off the roster by then, so the
   star reads `companionHeroId` against the roster when the finale resolved. §3's *no Fallen on
   the finale* is what keeps that honest.
3. **The companion stands under Withering Gaze un-withered.** The Gaze exempts *the Titan's own
   pieces* (`exemptTypes: ['Ancient']`, `src/data/fieldEffects.ts`); a Titanspawn is the Titan's
   own flesh, so the exemption becomes *Ancient, or a spawn body*. It fires every round of the
   Eyes phase — the phase measured as the run's wall — costs nothing on the enemy side (the
   Herald's Late company is down before the Gaze is ever set), and scales exactly with how well the
   companion was kept. The thing you turned against the Titan is the one thing it cannot wither.

   A larger version was weighed and set aside: the Herald's company drawn one spawn short where
   the companion's type would have marched. It only fires when that type is among the five
   drawn, so it reads as luck unless the draw is forced. Start with the Gaze and measure.

## 7a. As built (2026-09-26, per user direction)

The three additions landed in a shape that moved from the text above in three places:

- **The bestiary reveals a line on its STAR, not on met/held.** The Compendium's *Spawn* page lists
  the fourteen lines in chart order; a line is a silhouette with *???* until a run has been cleared
  with its companion alive, then its Late body, its three names and a lit star. No `knownSpawnIds`.
  The star is `Profile.companionStars` (types), `companion:<type>` in `RunRecord.starsEarned`, and
  counts in `totalStars` — it is Constellation currency like a path star.
- **The companion AWAKENS at the finale** (new, per user direction). Brought to the finale, it gets
  a beat of its own between the Herald and the fight (`CompanionAwakensScreen`): *Its true
  potential* — Ancient takes its secondary slot (`awakenCompanion`, the graft slot a spawn line
  never otherwise uses, so nothing is traded). The line is recorded in `Profile.ascendedSpawnTypes`
  on the spot, win or lose, and **every later companion of that line joins already Ancient**
  (`joinCompanion(…, ascended)`), from Act 1, on every rung. The Compendium shows Ancient beside a
  woken line's type.
- **The Gaze exemption comes free with it.** Withering Gaze already exempts Ancient, and a companion
  in the finale is always Ancient now, so no spawn-body clause was added.

**The tension to watch in playtest:** Ancient is the chart's wall — every attacking row reads
`Ancient: 0.5` (`typechart.ts`). A woken line's companion takes half damage from every typed hit
**from its first fight on every run after**, far more than the finale-only Gaze exemption §7.3
decided. It stays mortal and arrives Early and raw, so the half is measured against a small body.
If it reads as the run's best piece by Act 2, the lever is where the graft applies (finale only,
or from the Late step), not whether the line wakes.

---

## 8. Stars, colours, and how a rung opens

- **`Profile.ascension`** — the highest rung cleared; **`RunState.ascension`** — the rung this run
  is on, chosen at run start, read wherever a rung's rule is read. The unlock rule is Slay the
  Spire's: cleared at N opens N+1. The tutorial is Base.
- **Star colours.** `constellation.md` §6 left one number open: five colours, six states. With A1 as
  large a step as it is, the proposal is **Base white, A1 bronze, A2–A3 silver, A4 gold, A5
  rainbow** — the silver rungs are the two rule rungs a player climbs together. Max-only, never
  regressed, cosmetic to the balance, as §6 already says. The storage change it names
  (`heroId → { pathId → tier }`) lands with the first rung.
- The companion's star takes a tier the same way.

---

## 9. Order of work

| Phase | What lands | Notes |
|---|---|---|
| 0 | **DONE 2026-09-21.** **Split the rule from the identity, and measure A1.** `companionOf`, the Scribe's *Grows!* label and the Act 1 count cap read `companionHeroId`; `mortal` is left meaning only what it says. Then `RunOptions.ascension` in `scripts/sim`, every entry mortal, the chart pilot, the report's `recruitsBySource` / `spent:revive` / end-of-run reasons | Nothing player-facing. The measurement is what §4 and §6 read, and it is the cheapest thing in this document. |
| 1 | **DONE 2026-09-21.** **A1.** `RunState.ascension` (saved; an older file loads as Base), `Profile.ascensionCleared` and `RunRecord.ascension`, the title's rung sheet (*How hard?* — every rung up to `openAscension`, a Base clear opening A1; the summary's *New Run* keeps the rung), `isPermadeath` / `isMortal` / `fallenAfterFight` / `releaseFallen` in `src/run/ascension.ts`, the Fallen beat (`FallenScreen`) first in the post-fight chain with the KO'd left `down` on the roster until Continue so the level report reads the roster for who is still there, the map header's `Asc N` chip | The companion's row unbuttoned, its KO absorbed as at Base. The map-side Revive needed no hiding: nobody is ever `down` on the map at A1. The sim's `resolveFallen` reads the same verbs. `test/ascension.test.ts`. The tutorial forces rung 0. |
| 2 | **DONE 2026-09-26** (§7a). **The companion** (§7): the bestiary page, the `companion:<type>` star read at the Eyes' close, the awakening at the finale and the woken line on later runs | All rungs including Base. `test/companion`, `test/profile`. |
| 3 | **Stars and colours** (§8): `Profile.ascension`, the unlock, the colour mapping, the storage change | The first rung a star can record. |
| 4 | **A2** — the Mark and the ward on every Guardian | Measured against phase 0's A1 baseline. |
| 5 | **A3** — warbands as content, enemy gear from Act 1 | The content phase; one or two warbands a type pair, pooled beside the typing draw. |
| 6 | **A4** — the Banners at half, the Smithy ×1.5 | Read `spent:revive` first (§4). |
| 7 | **A5** — the Gaze at a tenth, two-phase Guardians, the AI tier | The AI tier is new work and its own document. |

Phases 4–7 are each a rung and each a measurement; none is decided until it is built and read.

---

## 9b. Phase 0 — measured (2026-09-21)

The rule/identity split is in (`isCompanion`, `src/run/companion.ts`), and the sim takes
`--ascension N`: at 1 every KO on a won fight is the Fallen beat (§3, `resolveFallen` in
`scripts/sim/run.ts` — a Revive on the strongest fallen first while the stock lasts, the rest gone),
the companion's KO is absorbed as at Base, and the pilot buys one Revive a Guild Hall visit ahead of
a hire whenever it holds fewer than two. Nothing else moved: same Revive price and limit, same
drop odds, same recruitment supply. 3000 runs, seed 1, both pilots, against the same seed at Base.

| | Base, skilled | **A1, skilled** | Base, chart | **A1, chart** |
|---|---|---|---|---|
| full-clear | 73.7% | **31.2%** | 22.3% | **1.1%** |
| Act 1 / 2 / 3 / 4 / 5 / finale cleared | 93 / 91 / 100 / 95 / 98 / 94 | **89 / 66 / 86 / 83 / 92 / 81** | 67 / 70 / 94 / 89 / 94 / 62 | **52 / 27 / 67 / 61 / 70 / 28** |
| KOs in won fights, a run | 9.33 (all mended back) | 6.28 | 8.08 | 2.68 |
| the Fallen: kept / let go, a run | — | **2.66 / 2.37** | — | 0.82 / 1.34 |
| roster at the end | 6 | **4.04** | 6 | — |
| Revives found / spent, a run | 1.29 / 1.52 | 0.88 / **3.17** | 0.72 / 0.88 | 0.33 / 0.87 |
| recruits: contract / contract-replacing / hire | 1.74 / 2.27 / 1.35 | **2.57 / 0.39 / 1.43** | 1.19 / 1.10 / 1.07 | 1.11 / 0.03 / 0.56 |
| Act 1 gold: earned → on Revives / on hires | 79 → 0 / 53 | 78 → **47 / 18** | 64 → 0 / 39 | 59 → 36 / 14 |
| runs ended with nobody standing | — | 0 | — | 0 |

What it says, in the order §4 and §6 asked:

- **The rule bites, and Act 2 is where.** Under the skilled pilot Act 2's clear falls 91 → 66 while
  Act 1 holds at 89 and Act 3 recovers to 86. Act 1 is survivable on the starting purse; Act 2 is
  fought with the holes Act 1's Guardian left, on an Act 1 income that a single Revive takes 60% of.
  Nothing else on the ladder should touch Act 2 until this has been played.
- **The Guardian is where heroes fall, and Base was hiding it.** 45% of persisting KOs fall at the
  boss at both rungs; at Base the act's end mends them for free, so the Guardian's real cost was
  never paid. Under A1 the Guardian fight is where Revives are spent. That is a shape the designer
  should see before deciding A2 makes the same fight harder.
- **Recruitment is live.** Contracts claimed below the cap 1.74 → 2.57 a run, and the swap route
  (`contractReplacing`, the byPower trade nobody makes in play) 2.27 → 0.39: under attrition a
  contract fills a hole instead of replacing a hero. Hires hold at 1.4 a run but move later — Act 1's
  hire spend falls 53 → 18 gold because the Revive is bought first, and Acts 3–5's rises. **The shelf's
  blank contract still sells nothing** (≈1 gold an act at both rungs): the fork's free contract
  covers the demand, which is §6's first row. The 20g shelf line is redundant on the evidence.
- **The Revive supply is the binding number, not the drop.** 3.17 spent a run against 0.88 found:
  the pilot buys ~0.7 a visit and would buy more — it holds under two at most visits. The Fallen beat
  is a real choice (2.66 kept against 2.37 let go: roughly half the fallen walk). §4's second reading
  is also in: the Anvil at Act 3 falls 58 → 5.5 gold and the Enchanter 26 → 3.5 — **the Revive crowds
  the Smithy out entirely through Act 3**, so A4's price rise would be a rung with no purchases left to
  price. That is the coupling §1 named, measured.
- **No run ends with nobody standing.** A lost fight ends it first, every time; the §2 rule on a
  roster below two never came up and needs no forced end.
- **The chart pilot's 1.1% is the floor, not the forecast.** The designer clears every Base run; the
  skilled pilot's 31% is the nearer read, and a human who plays around the Guardian's KOs will sit
  above it. The comparison that transfers is the shape: Act 2, the Guardian, the Revive.

Nothing is re-tuned off this pass. The candidates, for the designer, in the order the numbers
point: the Revive's Act 1 price against Act 1 income (a rung whose insurance costs 60% of the purse
is a rung about gold, which A1 is not meant to be); the shelf's blank contract line, which sells
nothing at either rung; and the Act 2 wall as the thing to play before A2 exists.

## 10. Locked invariants this overturns

| Where | The rule | What changes, and on which rung |
|---|---|---|
| CLAUDE.md "Roster hard cap = 6" | *One exception, the companion … a knockout removes it from the run* | **A1**: every hero is that exception. The companion stays the ONE a Revive cannot reach. |
| CLAUDE.md "Wounds" | *a KO'd hero is `down` … stands up only at the Rest seat, the Guild Hall's mend, a Revive, or the act's end* | **A1**: three of the four faucets are gone; the Revive stays, moved to the Fallen beat. Base untouched. |
| CLAUDE.md "Consumables" — the Revive | *spent on a hero that is DOWN — on the map, on the squad screen, on a hero a fight left down* | **A1**: there is no `down`; the Revive is spent at the fight's end or in the fight. |
| `innate-passives.md` §3 | *no Guardian carries the Mark* — the seal keeps it off | **A2** reverses it, on purpose, at the measured price. |
| CLAUDE.md "Enemies are LEVELLED" | *Enemy gear from Act 4* (`ENEMY_GEAR_FROM_ACT`) | **A3**: from Act 1. |
| CLAUDE.md "The Guardian's Banner" | the figures are measured parity | **A4** keeps the parity (one factor on all three) and halves the size. |
| `titan-eyes.md` §10 | `WITHERING_GAZE_FRACTION` = 0.05 | **A5**: a tenth. |
| `src/data/fieldEffects.ts` | Withering Gaze exempts Ancient | **§7, every rung**: exempts Ancient or a spawn body. |
| `profile.ts` `recordRunEnded` | *the run was cleared by the team that finished it* — the roster at the last Guardian's fall | **§7**: the companion's star reads the roster at the Eyes' close, because the finale is where it dies. Hero stars unchanged. |
| `constellation.md` §6 | the colour mapping is unsettled | **§8** settles it: Base white, A1–A5 bronze / silver / silver / gold / rainbow. |
| The Ascension memory (2026-09-09) | *a rung is never merely a stat multiplier* | **Kept.** A4 is the one number rung and it prices the player's economy, not the enemy's body. |

---

## 11. Open questions — DO NOT silently resolve

- **Where a contract can be spent on A1.** The fork is the only cash-in, once an act; a hero lost
  at the opener leaves a hole through two fights. Widen it (the opener recruitable on A1? a
  contract spendable at the Guild Hall on a shelf hero?) or is the gap the point? Phase 0's
  end-of-run reasons answer whether it needs answering.
- **The Revive supply on A1.** `REVIVE_DROP_CHANCE` and the one-a-visit limit are Base's numbers;
  §4 names the two readings that would move either. Do not move them on a guess.
- **A roster below two** fields what stands, per §2. If 1v2 measures as a slow certain death that
  costs a player ten minutes, a forced end is the kinder rule.
- **Does A4 read as weaker or as pointless?** A halved Banner might just be a Banner nobody thinks
  about. The alternative rule — Banners do not fold (one of each, no `+2`) — narrows the team shape
  instead of the number and might be the better rung.
- **The AI tier** is the one lever that does not exist, and A5 leans on it. Its own document, when
  A4 is in.
- **The tutorial** is Base and stays Base. Is a rung ever chosen on a fresh profile? No — the
  unlock rule answers it, but it is worth stating on the title screen's picker.
- **Rung order** past A1 (§5) is a proposal.

### Watch in playtest

- **Does the player buy a Revive first at every Guild Hall, or only after the first loss?** The
  sim's Revive-first pilot took the finale 52 → 57%; a human who learns it after losing a hero is
  the story the rung is meant to tell.
- **Is the Fallen beat ever a real choice** — two Revives, three fallen — or is it always
  one-or-none? If it is never a choice, it is a confirm, and a confirm is not a screen.
- **Does the player recruit from the fork under A1**, and which way — contract or hire — and in
  which act? That is the whole question §0 asked, and the ladder exists to let it be answered.
