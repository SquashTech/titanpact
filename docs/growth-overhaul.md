# growth-overhaul.md — The Growth Overhaul

> **STATUS: DECIDED (2026-09-10, per user direction). PHASES 1-4 OF §8 ARE BUILT; 5-7 ARE NOT.**
> Gems are gone, moves come only from Mastery Scrolls, levels are automatic and cap 30, and
> Evolutions come from the Crucible. Still to come: finished-vs-raw recruits, the difficulty
> re-fit and the 36-hero grade pass — until then a Guild hire still arrives pre-evolved off its
> level and every hero runs the all-B placeholder. `CLAUDE.md`'s remaining invariants still
> describe *that* game and are
> still the rules in force until the phase that replaces each one lands. This module is the
> destination, and §8 is the route — **check its Status column before assuming anything here
> runs.** Where it disagrees with `leveling-and-ranks.md`, `progression.md` or `run-loop.md`,
> those files describe what runs today and this one describes what replaces it — neither is
> wrong; they are separated in time. Each phase in §8 updates the others as it lands.

---

## 1. The rule the whole overhaul reduces to

> **A bare number never gets a screen, and a screen never buys a bare number.**

The problem this answers: the reward economy had drifted to eleven doors — items, Gems, Boons,
Banners, Classes, Tutor, Forge, two stat shrines, gold, level-ups — each with its own screen and
its own grant verb. A Mentor act put the player through roughly **17 choice screens against 4
fights**, so a run showed more menus than battles by a factor of three and a half.

The volume was never the problem. Slay the Spire pays out more rewards per act and reads as
generous, because nearly everything arrives through **one door** (a card, 1-of-3) and the variety
lives in the content behind it. Titanpact's variety had migrated into the *systems* instead — which
is backwards for a game whose architecture premise is that all acquirable content is pure data over
a shared vocabulary. The engine holds that line; the reward layer had stopped.

**Why Gems failed specifically**, since it is the guard rail for everything below:

1. **Free re-allocation removed the weight.** A decision you can undo for free is admin, not
   strategy. Re-allocation was added to solve roster churn — a real problem, but Gems were the
   wrong thing to ask to solve it.
2. **A Gem has no identity.** Ruby / Amethyst / Citrine are a colour code for a number. "+5 Attack"
   never becomes a story; "you learned Ember Cascade" is a thing that happened.
3. **The caps were inert.** A run earned roughly 40 Gems against a `GEM_CAP_PER_HERO` of 20 × six
   heroes = 120 capacity, so the hero cap could essentially never bind. Two numbers the player had
   to hold in their head that did nothing.

And the proportion is the tell: ~40 Gems is ~200 stat points across a whole roster, maybe +50 on a
core hero — under 10% of a 550-point stat line — against one late Legendary at 90 points in a
single decision. **Gems delivered item-comparable power at roughly ten times the attention cost per
point.**

Test any future reward proposal against the rule above before anything else.

---

## 2. The two lanes

Growth splits into two lanes that never cross. This is the same automatic-vs-chosen line as §1,
stated as structure.

| | **Vertical — the hero deepens** | **Horizontal — the team broadens** |
|---|---|---|
| Frequency | every fight | ~15 picks a run |
| Shape | **automatic, no interface** | **chosen, one screen each** |
| Carries | Level, and the stats it rolls | Mastery Scrolls, the Crucible, items, Boons, Classes, recruits |

- **Level is what a hero is.** Never a decision — it ticks like a clock, identically for everyone.
- **Rank is what a hero knows.** Nothing but decisions.

Two numbers that *behave* differently are far easier to hold than two that behave alike, which is
what defuses the Level/Rank confusion risk. See §4 for the UI consequence.

---

## 3. Levelling and growth grades

### XP is automatic and roster-wide

**Every roster hero levels every fight, fielded or benched. There is no pool, no allocation and no
screen.** `MAX_LEVEL` = 30.

Participation-based XP (Fire Emblem's actual model) was considered and **rejected**: it produces the
runaway where your best four level, your sideboard rots, and by Act 4 you cannot rotate. Roster-wide
automatic XP gets the screen removal — which was the only thing level 30 actually required — without
buying that problem. A hero rotated in at Act 4 is at parity, and rotating costs nothing, which is
*better* for strategic churn than participation XP, not worse.

**BUILT 2026-09-10.** `src/run/growth.ts`; the curve is `LEVEL_AFTER_ENCOUNTER`, authored
outright rather than derived from a per-fight rate, because the act-end figures below are the
decided shape and a rate would only approximate them.

**The cost, and it is a real deletion:** hyperfocus dies as a *levelling* strategy. `CLAUDE.md`
protects it — "the carry build stays legal and is charged for in breadth." It is bought back
wholesale by Mastery Rank (§4), which is why that system is load-bearing and not a convenience.
A **focus-hero XP dial** (one designated hero per act at +25% XP) was drafted as a consolation and
then **dropped** once Rank made it unnecessary. Do not re-introduce it without re-reading §4.

### Growth grades (Fire Emblem model)

Each level rolls **each stat independently** against that hero's authored grade for it.

| Grade | S | A | B | C | D | E | F |
|---|---|---|---|---|---|---|---|
| Chance | 95% | 80% | 65% | 50% | 35% | 20% | 5% |
| Budget cost | 6 | 5 | 4 | 3 | 2 | 1 | 0 |

- **A success grants +2**, or **+6 HP**. HP is not a special case: `CLAUDE.md`'s own measured
  break-even is ≈0.33 a point, so 6 HP *is* 2 points' worth.
- Grades cover the **seven stats the 550 budget covers** — MP Regen excluded, exactly as it is from
  the Gem catalog, and for the same reason.
- **Every hero's grades sum to exactly 28** (an average of B). This is a **second budget**, and it
  must be enforced by test the way `heroStatTotal` enforces the first — the 550 rule alone stops
  being sufficient to say a hero is fairly costed the moment grades exist. Taking one stat to S
  costs another from B to D, or two from B to C.

At all-B that is ~4.5 successes a level, ~9 points a level, **~264 points over 29 levels** — a hero
grows by roughly half again. Below ~90 the arc is invisible and the underwhelm returns.

**Base and growth are independent axes**, and that is the point. Low base + high growth is a late
bloomer; high base + low growth is front-loaded. This is Fire Emblem's Est/Oifey axis, and it lands
on a problem the game already had: a Guild Hall hire arriving underlevelled is a downside today.
Give that archetype S-grades and arriving underlevelled *is* the build.

### The level curve

| Act | Fights | Level at act end | Scrolls granted | Crucible |
|---|---|---|---|---|
| 1 | 4 | 6 | 2 | 1, at the Guardian |
| 2 | 4 | 12 | 2 | 1, at the Guardian |
| 3 | 4 | 18 | 2 | 1, at the Guardian |
| 4 | 4 | 23 | 2 | 1, at the Guardian |
| 5 | 4 | 28 | 2 | 1, at the Guardian |
| 6 | 1 | 30 | — | purchasable at the Vigil |

~1.5 levels a fight, decelerating. **Every figure here is a first-pass placeholder for playtest;
only the shape is decided.**

---

## 4. Mastery Scrolls and Mastery Rank

**Mastery Scrolls are the only faucet for moves.** They are spent at the player's leisure on the
Roster screen, alongside equipment.

### Why Rank exists

Act-gating the movepool was the first proposal and it has a fatal incentive: if the tier ceiling
rises with the act, **holding a Scroll is always better than spending one**, and a currency whose
optimal play is *don't spend it* can never feel good to receive. Rank puts the ceiling **behind the
spend** rather than behind a clock, which inverts the incentive completely.

It also does a second job. Scrolls have **increasing returns inside a hero** (concentrate and the
ceiling rises) and **decreasing returns across the roster** (spread six ways and nobody ranks up).
That is the carry build, priced in breadth — the property uniform auto-levelling deleted, recovered
on the axis where investment has texture instead of the one where it was arithmetic.

### The spend

**A Scroll offers ONE move from the hero's eligible pool; take it or decline; the move is burned
either way** (2026-09-10, per user direction — a 1-of-3 was drafted here and rejected). The
arithmetic is what settles it: rank 1 takes three Scrolls, three moves shown apiece against an
Early band authored to a floor of six, so a 1-of-3 would empty the band before the hero could
climb out of it — and §4's own promise is that **no hero needs re-authoring**. One move also
keeps the rule the level curve already ran on unchanged: an offer is spent by being MADE
(`docs/leveling-and-ranks.md`), whatever the answer.

**Every Scroll does both things**: it offers a move *now* and it ticks the rank bar. Rank-only
spends with moves arriving at rank-up would make two of every three Scrolls a silent deposit, which
is the delayed-gratification problem this design exists to escape. The rhythm is: every spend is a
moment, every third spend is a bigger moment.

### Rank

| Rank | Scrolls to reach | Offerable tier |
|---|---|---|
| 1 (start) | — | Early |
| 2 | 3 | Mid (Early expires, exactly as the level curve does today) |
| 3 | 3 more | Mid + Late |

This maps **1:1 onto the offerable sets the movepools are already authored against** — in practice
6 Early / 6 Mid / 4 Late after the starting kit is filtered out — so **no hero needs re-authoring.**

Six Scrolls maxes a hero. Against a run paying **10 guaranteed (2 an act) and ~15–18 reachable**
once reward rows and Guild Hall purchases are counted, that is two heroes maxed and a third partway,
or five heroes bumped once and nobody deep. A real spread-vs-concentrate call.

### Two mechanical notes

- **`RosterEntry.offeredMoveIds` already exists** (`src/run/state.ts`) and the pool filter already
  ran on it (`src/run/progression.ts`, now `masteryMovePool`). A Scroll is the old
  `grantLevelUpMove` with the level trigger cut off — it ships as `grantOfferedMove`. Because that
  list accumulates, the fifth Scroll dumped into one hero rolls from a depleted pool —
  **hyperfocus self-limits with no cap needed**, which is the anti-funnel job the Gem 20/8 caps
  were doing badly.
- **`movePoolFloor`'s proof breaks.** `MOVE_POOL_MARGIN` guaranteed a pool "cannot be emptied — by
  any run, not merely by a likely one," derived against a *fixed* number of curve offers. Scrolls
  make offers-per-hero player-controlled and unbounded, so the floor is now simply
  **`SCROLLS_PER_RANK` per offerable set** — what a band must survive to get the hero out of it.
  `test/moveTiers.test.ts` is rewritten against rank.

  **The refusal is narrower than first drafted** (2026-09-10, as built). "Refuse the spend and
  grey out a hero whose pool is dry" strands the hero: a band *can* empty — an event's gifts fill
  the loadout out of the hero's own pool, and offers burn whether taken or declined — and the rank
  tick is the only thing that opens the next band. So a Scroll is refused only when it would buy
  **literally nothing**: max rank AND nothing left to teach. Below the cap a dry band still takes
  one, and the board says so rather than greying out (`canSpendScroll`).

### UI consequence

Under uniform auto-levelling, **Level is a property of the run, not of the hero** — all six read 18
in Act 3, and a number identical across the whole roster carries no information on a hero card. Put
it in the map header (*Act 3 · Level 18*) and print it per-hero only where a hero **deviates**,
which is exactly the case that matters: a recruit that is behind. The hero card then shows one
progress number, Rank, with pips.

`MASTERY_LEVEL` and the mastery stat reel are dying anyway (§7), so the word "Mastery" is vacated at
precisely the moment this needs it. No lasting collision — but `drawMasteryStats` must actually go
rather than linger.

---

## 5. The Crucible — Evolution's new home

**Evolutions leave the level track entirely.** At level 30, `EVOLUTION_LEVEL` = 5 would arrive in
Act 1, and under uniform levelling **all six heroes would hit any level threshold in the same
fight** — a six-decision wall. That rules out the level track outright, so this is a consequence
rather than a preference.

**The Crucible is a beat in the act-boundary chain, not a map row.** Acts 1–4 already run 9 rows and
the map had to drop tile labels and shrink to 56px to fit that; a tenth row is not affordable. The
chain becomes:

> **Guardian falls → Banner → Crucible → Pact Seal → Act intro**

The Banner grants to everyone, the Crucible transforms one, the Seal counts the run. Team, hero,
run — three scales ascending, a crescendo rather than a pile. It costs zero map rows, and every
player learns after Act 1 that a Guardian's death is where a hero changes.

**Non-bankable.** It is a turning point, so the choice is made now. That is also why it is a beat
rather than an item: a grant that cannot be held is a screen anyway, so it should be one the player
can see coming.

**Naming.** It is **not** called an Evolution Seal. `Seal` is the most load-bearing noun in the
fiction — `docs/lore.md` is *The Pact, the Seal, and the Endbringer*, a run's five Guardians **are**
its five broken seals, and `PactSealScreen` / `BrokenSeal` / `recordBrokenSeal` all exist. Worse,
the Pact Seal is earned **one per act**, so a second per-act "Seal" currency beside it would be
actively confusing. "The Crucible" sits in the existing node vocabulary (Mentor's Hall, The Forge,
The Vigil, Guild Hall) without explanation.

**Economy: 5 forced (acts 1–5), 6+ reachable. BUILT 2026-09-10 as a map node only** (per user
direction), not a Guild Hall purchase: the `crucibleReward` reward-row node, **acts 3+**, weight
12. Acts 1-2 already get one apiece off their own Guardian, and a roster still forming is not
where a second Evolution is the interesting pick.

The dead-card problem a reward node has and a Boon does not: a Boon rolls its offers when the
player arrives, so it can filter itself; a map rolls its nodes an act ahead. So the filter lives
at **generation** — `rewardPoolFor` drops the Crucible from the pool entirely when no roster hero
has an Evolution left, and `advanceToNextAct` passes that in. The node also skips itself on
arrival if the roster evolved in between. A reward row is a pick of THREE; a card nobody can
spend is a third of the choice gone.

The drafted Guild Hall purchase was **not** built. Gold stays off the Evolution axis: an
Evolution is identity, not something bought.

This resolves the scarce-vs-universal question that ran through the design: **it is scarce when it
matters and universal by the end.** You choose who evolves first — in Act 2 that is a real
commitment on a team still forming — and by the finale everyone can be there. An unevolved sideboard
hero is not unfinished; `CLAUDE.md` already holds that "mono typing is a valid terminal state, not a
larval stage," and the same reasoning applies.

---

## 6. Finished and raw recruits

A pre-evolved late-game recruit makes an existing line **mechanical** rather than a statement about
stats. `CLAUDE.md`: "Guild heroes have decaying runway value; contract heroes have flat value."

| | Level | Rank | Evolution | Kit |
|---|---|---|---|---|
| **Contract hero** | act level | 2–3 | already chosen | **chosen by the game** |
| **Guild hero** | underlevelled | 1 | none | yours to build |

The contract hero is **finished**; the guild hero is **raw**. You save six Scrolls and a Crucible,
and in exchange you authored none of it — and spending your own Scrolls on it still works, since
Rank 3 keeps offering. Contracts and Crucibles become partially substitutable, which makes both more
interesting than either was alone. Act 3+ enemies already arrive evolved, so the content is largely
there.

**What prices three free axes:** **gold**. It is the one currency that converts to *either* objective
power (equipment, item slots, the Anvil, the Enchanter) *or* a pre-built hero, so buying the hero is
visibly not buying the power. The ~5 act-end contracts arrive free, so gold prices the *purchased*
route only — the free route stays priced by the roster cap, since gaining a hero means terminating
one and equipment strips with no refund. Two brakes on two routes, both real.

---

## 7. What is deleted

| Going | Surface |
|---|---|
| **Gems, entire** | `src/data/gems.ts`, `src/run/gems.ts`, `GemBoard.tsx`, `GemChoiceScreen.tsx`, `test/gems.test.ts`, `RunState.gemsEarned`, `gemReward` in `REWARD_WEIGHTS` |
| **The Training Point pool** | `levelUpPool`, `levelUpDeferred`, `levelUpCost`, `costToReachLevel`, `MAX_LEVEL_UP_COST`, `BASE_TRAINING_POINTS`, `ACT_XP_STEP`, `LevelUpScreen.tsx`, `test/levelCost.test.ts` |
| **The mastery stat reel** | `MASTERY_LEVEL`, `drawMasteryStats`, `grantMasteryStat`, `MASTERY_CHOICE_COUNT`, `RANDOM_STAT_POOL`, `test/mastery.test.ts` |
| **Level as the move gate** | `MOVE_TIER_LEVEL`, `moveOfferLevels`, `EVOLUTION_LEVEL` as a trigger |
| **The two stat shrines' grants** | `hpBoostReward`, `manaBoostReward` — REMOVED outright (phase 1) |
| **The XP Cache's payload** | `upgradeReward` — RE-POINTED at Mastery Scrolls as `loneScrollReward` (phase 3, per user direction), paying `LONE_SCROLL_COUNT` = 1 against the Cache's 2. It kept its seat rather than following the shrines because the reward rows were already down to six types. |

The **movepool FLOOR** (`src/data/progression.ts`, `test/moveTiers.test.ts`) dissolves as a
consequence, and this is a roster-quality win rather than only a code one. It exists so a level-up
never pays nothing, and it is explicitly worth "pulling an **off-type** move from an adjacent slate"
to satisfy. Once every level pays stats, a level-up *cannot* pay nothing, and movepools may be
authored to their real size with no padding — so authored identity stops being diluted to satisfy a
curve, which serves the north star directly.

---

## 8. Order of work

Sequenced so the tree is playable at every boundary. **The numbering is dependency order, not
preference.**

The bridge that makes this work is already in the code: `masteryOrMove` falls back to the stat reel
when a move pool comes up empty, so the state between phases 2 and 3 is a *working game* where
Scrolls give moves and level-ups give stats via the old reel.

**`SAVE_VERSION` bumps freely.** `src/run/save.ts` rejects version mismatches rather than migrating
them, so in-flight runs invalidate cleanly and no migration code is owed at any boundary.

| # | Phase | Exit criterion | Status |
|---|---|---|---|
| 1 | **Excise Gems.** Isolated and well-bounded; it shrinks the surface everything else moves through. Delete the owned files, strip the state fields, pull `gemReward`, remove the sim's gem handling from `policy.ts` / `run.ts`. The two stat shrines were **removed outright** rather than given a placeholder payload (2026-09-10, per user direction): they are §1's rule stated as a node, so a stand-in screen would have been built only to be deleted in phase 3. Their 20 weight and the Gem Cache's 20 went to the Boon (18 → 30) and the purse (18 → 26) until phase 2 seats the Scroll node. | No gem references, suite green, a run completable end to end. | **DONE** 2026-09-10. 985 tests green; 200 batch runs complete end to end. Cost, measured: full-clear 45.5% → 33.0%, encounters won 12.11 → 10.70 — the ~200 stat points a run Gems carried, handed back by phase 3 and re-fitted in phase 6. |
| 2 | **Mastery Scrolls and Rank.** Add the currency, `RosterEntry.masteryRank`, and the spend flow on the Roster screen. Re-point `levelUpMovePool`'s tier gate from level to rank and cut the level-up's move grant in the same change — they are one edge. Add the pool-exhaustion guard. | Scrolls are the only move faucet; level-ups fall through to the stat reel. `test/moveTiers.test.ts` rewritten against rank. | **DONE** 2026-09-10. 989 tests green. Measured against phase 1: full-clear 33.0% → 18.0%, encounters won 10.70 → 8.55, and of heroes reaching act 4+ only 38.0% reach rank 2 and 23.1% rank 3 (against 97.9%/54.9% on the old level gate). Income is on §4's spec (~16 a run, ~2 heroes maxed); the gap is the difficulty curve, which phase 6 re-fits. |
| 3 | **Flip the levelling model.** The destructive one, landing after its replacements exist. XP becomes automatic and roster-wide; pool, deferral, cost curve and stat reel all go; cap 30; each level rolls the seven stats. Ship with a uniform all-B grade set so the engine runs before the content pass does. | No allocation screen anywhere. Level moves to the map header. Tutorial script re-checked — `src/data/tutorial.ts` narrates the old beats. | **DONE** 2026-09-10. 979 tests green. Measured against phase 2: full-clear 18.0% → **51.5%**, encounters won 8.55 → 12.71, mean end level 16.4. That is above even the pre-overhaul 45.5% — the ~264 points a hero of automatic growth more than replaced what Gems and the level curve were paying. Phase 6 re-fits it. The `upgradeReward` XP Cache became `loneScrollReward`, a 1-Scroll node (per user direction), rather than being deleted like the shrines. |
| 4 | **The Crucible.** Small: `chooseEvolutionPath` and the path data are untouched, only the invocation point moves. Insert into the act-boundary chain ahead of `PactSealScreen`; add the purchasable spend at the Guild Hall and the Vigil. | Five forced Crucibles a run, a sixth reachable. No evolution reachable from a level-up. | **DONE** 2026-09-10. 982 tests green. Map node only, acts 3+, filtered out of the roll when nobody can take one (per user direction) — no Guild Hall purchase. Measured against phase 3: full-clear 51.5% → **38.5%** (1000 runs), encounters won 12.71 → 11.07. Evolutions went from every hero automatically in act 1 to one a Guardian, which is the whole point; phase 6 re-fits. |
| 5 | **Finished and raw recruits.** Contract heroes arrive levelled, ranked, evolved, kit game-chosen; guild heroes raw. Gold on both purchased routes. | The flat-value / decaying-runway line true on three axes instead of one. `test/recruitment.test.ts` extended. | not started |
| 6 | **Re-fit the difficulty curve.** The real work, and it cannot start earlier: `ENEMY_LEVEL_BY_ACT`, `ACT_STEP_CURVE`, Guardian champions, reward weights and Banner values all re-derived. Drive with `scripts/sim` and the skilled pilot. | Batch runs show no mechanical fault — walls, dead nodes, unreachable ranks. Win-rate targets are a playtest question, not a batch one. | not started |
| 7 | **Growth grades for 36 heroes.** Parallelisable from phase 3 onward; it needs the schema, not the tuning. The interesting authoring is the mismatches — a low base with S grades is a late bloomer worth recruiting underlevelled, and that archetype only exists once this pass does. | Grade budget enforced by test, beside the 550 check in `test/roster.test.ts`. No hero left on the all-B placeholder. | not started |

### Phase 6 is the actual project

Phases 1–5 are mostly deletion and re-pointing. Re-fitting the curve against a player who grows from
somewhere entirely new is the part with real risk. Two specifics:

- `ENEMY_LEVEL_BY_ACT` `[1, 3, 5, 7, 10]` is meaningless against a 30-level player — roughly
  `4 / 10 / 16 / 22 / 28`, with the player running ~2 ahead.
- **Guardian champions currently ignore level entirely** (`appendFinalEnemy` runs no level
  progression, and `MOVE_CAP` leaves a full 4-move kit no room). Under the new scale level is the
  main axis and champions are the one thing it does not touch — they need their own handling or they
  fall off the curve hard.

### `CLAUDE.md` ships with each phase, not at the end

The constitution is a deliverable here, not cleanup. A rule in it beats a prompt by design, so a
half-migrated constitution actively fights the next session's work — worse than either the old state
or the new one. Update it at each phase boundary, alongside `leveling-and-ranks.md`,
`progression.md` and `run-loop.md`.

---

## 9. Locked invariants this overturns

Each is a sign-off, not an implementation detail. Listed in the order a reader of `CLAUDE.md` meets
them. **None of these has changed yet** — they are in force until the phase that replaces them lands.

| Today | Becomes |
|---|---|
| No automatic stat growth from leveling | Every level rolls stats against the hero's growth grades |
| Level-ups are a pooled currency distributed freely after each battle | XP is automatic and roster-wide; no pool, no allocation |
| A level-up costs as many pool points as the hero's current level | Deleted with the pool |
| A level-up unlocks a move from the current tier | Moves come only from Mastery Scrolls, gated by Mastery Rank |
| Past `MASTERY_LEVEL` a level-up rolls three stats and the player picks one | Absorbed — every level pays stats, so the sink is unnecessary |
| A level-up never pays out nothing (the movepool FLOOR) | Dissolved; pools authored to their real size, no off-type padding |
| The level-up that reaches the Evolution level surfaces the Evolution | The Crucible, at the act boundary, five times a run |
| Gems are per-hero stat investment, poured and re-poured freely | Deleted; stats are never a decision anywhere in the run |

---

## 10. Open questions — DO NOT silently resolve

- **Equipment: two base slots, halved budgets.** Proposed and never confirmed. One slot means every
  drop is replace-or-sell, and builds are combinations — `BASE_ITEM_SLOTS` at 2 with `RARITY_BUDGET`
  roughly halved keeps stat throughput flat while doubling the decision, and extending
  `EFFECT_FLOOR_SHARE` down to Rare is what makes an item memorable rather than merely bigger.
  Budgets tripled when heroes went 3 slots → 1, so this is partly untripling. **Blocks nothing, but
  settle it before phase 6** — re-measuring the curve twice is the one genuinely wasted pass
  available.
- **Do Banners shrink?** They are the last team-wide flat-stat axis, carrying roughly 175 points a
  run where Gems carried 50. With levels carrying ~264 per hero, a Banner may now read as arithmetic
  rather than as a trophy. Resolve inside phase 6.
- **Max Rank 3, or 4?** Three maps exactly onto the authored tiers and needs no re-authoring. A
  fourth needs a fourth tier — a content pass across 36 heroes, worth it only if a maxed carry reads
  as finished too early.
- **Does max Rank change the offer?** Optional payoff: at Rank 3 a Scroll could offer a **free pick**
  from the pool rather than a roll of three — the Tutor's grammar, earned rather than granted. The
  hard rule runs the other way: **Rank must never grant stats**, or Gems return through the side
  door.

### Watch in playtest

- **Does raising become a mistake?** A contract hero now arrives with level, rank and evolution all
  skipped, paid for in gold and a termination. That is meant to keep churn viable — but there is a
  point where it tips from *pivoting is an option* to *raising is a trap*, and starters start reading
  as fodder nobody spends a Crucible on.
- **Do banked Scrolls read as homework?** Rank removes the incentive to hoard, but a Roster button
  wearing "4 Scrolls" still signals admin waiting. Show a count, never an alert badge — and if the
  screen still feels like a chore hub once equipment shares it, that is the signal to split them.
- **Does the roster read too flat?** Uniform levelling means differentiation comes entirely from
  base stats, growth grades and the scarce axes. If it is not enough, the focus-hero XP dial (§3) is
  the drafted answer — but reach for it only after Rank has been played, not before.
