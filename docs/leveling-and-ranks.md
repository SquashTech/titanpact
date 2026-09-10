# leveling-and-ranks.md

> The authoritative spec for **how heroes grow**: the automatic level curve and its growth
> grades, the Mastery Scroll faucet and the rank that gates it, and the Evolution branching
> system. This module
> supersedes the level-up / Evolution sections of `progression.md` — where they
> disagree, this file wins, and `progression.md` should be updated to defer here.
> Rules only; thresholds, move data, and per-hero Evolution paths are **data** (`/data`).

> **SUPERSEDED IN PART by `growth-overhaul.md` (2026-09-10), which is now built in FULL**,
> and this file is updated for it: moves left the level track entirely (a Scroll is the only
> faucet, and **Mastery Rank**, not level, gates the tiers), and levels went automatic,
> roster-wide and cap 30, paying stats through growth grades. The pooled currency, its cost
> curve and the mastery stat reel are all deleted, Evolutions come from **the Crucible** at
> the act boundary rather than from a level, a Guild hire arrives RAW — unevolved, rank 1, its
> own three moves — the difficulty curve is re-fitted against all of it, and all 36 heroes
> carry authored growth grades. **Everything here describes what the code does.** Read both
> before changing anything.

---

# Part 1 — Levelling

## Levels are automatic and roster-wide (2026-09-10, Growth Overhaul phase 3)

**Every roster hero levels every won encounter, fielded or benched. There is no pool, no
allocation and no screen.** `MAX_LEVEL` = 30. `src/run/growth.ts`.

This replaced a pooled Training Point currency the player spent hero by hero — a triangular cost
curve, a defer-and-bank flow, and a Level Up screen between the player and the map at almost every
node. All of it is gone. Full argument: `docs/growth-overhaul.md` §3.

Participation-based XP (Fire Emblem's actual model) was considered and **rejected**: it produces
the runaway where your best four level, your sideboard rots, and by Act 4 you cannot rotate.
Roster-wide automatic XP gets the screen removal — the only thing a 30-level cap actually required
— without buying that problem. A hero rotated in at Act 4 is at parity, and rotating costs
nothing, which is *better* for strategic churn than participation XP, not worse.

**The cost, and it is a real deletion:** hyperfocus dies as a *levelling* strategy. It is bought
back wholesale by Mastery Rank (Part 1b), which is why that system is load-bearing rather than a
convenience. A **focus-hero XP dial** (one designated hero per act at +25% XP) was drafted as a
consolation and then dropped once Rank made it unnecessary. Do not re-introduce it without
re-reading `docs/growth-overhaul.md` §4.

### The curve

`LEVEL_AFTER_ENCOUNTER` is authored outright rather than derived from a per-fight rate: the
act-end figures are the decided shape, and a rate would only approximate them. Acts 1-5 run four
encounters each — the forced fight, the Skirmish, the Elite-or-Battle, and the Guardian — then the
finale.

| Act | Encounters | Level at act end |
|---|---|---|
| 1 | 4 | 6 |
| 2 | 4 | 12 |
| 3 | 4 | 18 |
| 4 | 4 | 23 |
| 5 | 4 | 28 |
| 6 | 1 | 30 |

Level 5 lands on the **third encounter of act 1**, which is where the Evolution surfaces until
phase 4 moves it to the Crucible. Every figure is a first-pass placeholder for playtest; only the
shape is decided.

**It is a DELTA, never a target** (`levelsForEncounter`). A hero that joins late has missed the
grants before it and stays behind permanently — which is what keeps "arrives underlevelled" a real
archetype for a Guild Hall hire (`docs/growth-overhaul.md` §6) rather than a rounding error the
next win erases. Setting each hero to the curve's level instead would erase it.

## Growth grades — what a level actually pays

Each level rolls **each stat independently** against that hero's authored grade for it.

| Grade | S | A | B | C | D | E | F |
|---|---|---|---|---|---|---|---|
| Chance | 95% | 80% | 65% | 50% | 35% | 20% | 5% |
| Budget cost | 6 | 5 | 4 | 3 | 2 | 1 | 0 |

- **A success grants +2, or +6 HP.** HP is not a special case: `CLAUDE.md`'s own measured
  break-even is ≈0.33 a point, so 6 HP *is* 2 points' worth of anything else.
- Grades cover the **seven stats the 550 budget covers** — MP Regen excluded, exactly as it is
  from every other per-hero grant, and for the same reason.
- **Every hero's grades sum to exactly `GRADE_BUDGET` = 28** (an average of B). This is a
  **SECOND budget**, enforced by test the way `heroStatTotal` enforces the first: the 550 rule
  alone stops being sufficient to say a hero is fairly costed the moment grades exist, because a
  low base with S-grades outruns a high base with F-grades however the 550 is spent. Taking one
  stat to S costs another from B to D, or two from B to C.

That is **4.55 successes a level for every hero**, ~9 budget points a level, **~264 over 29
levels** — a hero grows by roughly half again. Below ~90 the arc is invisible and the underwhelm
returns.

"For every hero" is exact, not approximate: a grade's chance is `0.05 + 0.15 × cost` with no
rounding, so any line summing to 28 buys the same 4.55. **A grade line is a shape, never a
size** — which is what lets a mismatch be authored without also handing that hero more growth
than the roster gets.

**Base and growth are independent axes**, and that is the point. Low base + high growth is a late
bloomer; high base + low growth is front-loaded. This is Fire Emblem's Est/Oifey axis, and it
lands on a problem the game already had: a Guild Hall hire arriving underlevelled is a downside
today. Give that archetype S-grades and arriving underlevelled *is* the build.

**All 36 heroes are authored** as of 2026-09-10 (`docs/growth-overhaul.md` phase 7). The budget
and the no-placeholder rule are both pinned in `test/roster.test.ts`, directly beneath the 550 —
a grade line is the second half of that rule, not a separate one. The authoring doctrine, the
two archetypes it produces and the two rules that bound them: `docs/types-and-heroes.md`
"Growth grades".

**The player reads the grades on the sheet.** `StatBars` takes an opt-in `grades` prop and draws
a letter column beside the bars, on the hero sheet and the Guild Hall preview — not in combat,
where the question is what a hero IS rather than what it becomes. Without it the late-bloomer
archetype would exist in the data and in no decision the player can make.

**The multiple-of-5 rule does not apply to a growth roll.** `CLAUDE.md` locks flat stat modifiers
to multiples of 5 or 10; +2 and +6 are neither. That rule exists to keep AUTHORED grants legible,
and a roll nobody authors per-hero is not that kind of grant — the legibility lives in the grade
instead.

## Where levels are REPORTED

Under uniform levelling, Level is a property of the **run**, not of a hero: all six read the same
number, and a figure identical across six cards carries no information there. It sits in the map
header beside the act, and per-hero only where a hero **deviates** — which is exactly the case
that matters, a recruit that is behind. The victory overlay reports the levels a win paid
("+2 Levels"), because that beat is the only place the player learns their roster grew; it is a
report, not a screen, and nothing is spent on it.

## A level never touches the movepool (2026-09-10, phase 2)

Moves come from **Mastery Scrolls**, gated by **Mastery Rank** — Part 1b below. A level pays
stats and nothing else. Evolutions come from the Crucible (Part 2), never from a level.

### An offer is spent by being MADE (2026-09-07)

A move leaves a hero's pool the moment it is **offered**, whether or not it is taken
(`RosterEntry.offeredMoveIds`, filtered by `masteryMovePool`). The rule outlived the level curve
it was written for and applies unchanged to a Scroll's offer. Three cases, one rule:

- **Declined** at the cap — gone. The decline is a decision, so re-rolling the same move
  on the next Scroll is the screen wasting the player's spend on a question already answered.
- **Taught, then swapped away** for something later — gone. Otherwise the discarded move
  drops straight back into the pool it came from and crowds out everything unseen.
- **Granted by an Evolution path**, both the moves the cap took and the overflow it
  refused (`chooseEvolutionPath`) — the overflow IS an offer, so it prices like one.

An **event's gift does not** (`grantMove`, not `grantOfferedMove`). A `learnMove` event draws
from the whole catalog and hands the move over; the player was never asked to choose it against
anything, so swapping it away later leaves it offerable. The rule is about questions already put
to the player, and an event never put one.

Scoped per hero and per run — nothing persists past the run, and a second copy of the
hero recruited later starts with its own empty list.

The pool therefore drains monotonically, which is what makes the depth of it load-bearing.
**An empty pool below `MASTERY_LEVEL` is a data bug, not a state the game may reach**, so
the floor is derived from the curve rather than written down beside it
(`movePoolFloor`, `src/run/progression.ts`):

The bands are the three **offerable sets**, not cumulative slices of the pool: Early expires
when Mid opens (below), so a move offer only ever draws from one of these three.

| Band | Offers drawn from it | Floor |
| --- | --- | --- |
| Early alone | levels 2, 3 | 2 + margin |
| Mid alone | levels 4, 6 | 2 + margin |
| Mid + Late | levels 4, 6, 7, 8, 9, 10 | 6 + margin |

The Mid+Late row counts the offers at 4 and 6 as well: a Mid taken at level 4 is gone from
the set at level 9. Eight offers in all, not nine — the level-up that reaches
`EVOLUTION_LEVEL` surfaces the Evolution instead, and `MASTERY_LEVEL` itself still pays a move.

`MOVE_POOL_MARGIN` is **`MOVE_CAP`**, and it is derived rather than picked. The curve is not
the only thing that takes a move off the table: `levelUpMovePool` also filters what the hero is
currently **holding**, and a loadout slot can be filled from outside the pool by an event's gift.
`MOVE_CAP` of those is the most that can ever be held at once, so a pool deeper than
curve + `MOVE_CAP` **cannot** be emptied — by any run, not merely by a likely one. An earlier
pass used a guessed margin of 3 and called it a bet; there was no need to bet.

Bringing all 36 pools to that floor on 2026-09-07 took **67 added entries**, roughly two per
hero; closing Early at Mid later the same day raised the Mid and Late floors and took **125
more**, leaving every hero on **6 Early / 6 Mid / 4 Late** at minimum. The authoring rules they
had to satisfy are in the FLOOR comment in
`src/data/progression.ts`. Two tests hold it: one checks the arithmetic against every pool, the
other **walks** each hero from 1 to `MASTERY_LEVEL` down all three Evolution paths — filling the
whole loadout with event gifts out of its own Early pool first, then alternating taking and
declining every offer — and asserts no level-up ever falls through to a mastery stat
(`test/moveTiers.test.ts`).

# Part 1b — Mastery Scrolls and Mastery Rank (2026-09-10)

**Moves come from ONE faucet: a Mastery Scroll, poured into one hero on the Roster's Mastery
board.** Full rationale in `docs/growth-overhaul.md` §4; this section is the spec.

- **A Scroll offers ONE move** from the hero's eligible pool — take it or decline, and the move
  is burned either way (the offer-spent-by-being-made rule above, unchanged).
- **Every Scroll also ticks the rank bar.** `SCROLLS_PER_RANK` = 3, `MAX_MASTERY_RANK` = 3, so
  **six max a hero**. Rank is DERIVED from `RosterEntry.masteryScrollsSpent` (`masteryRank`),
  never stored — two figures for one fact drift, and the board's pips need the count anyway.
- **The tick lands BEFORE the roll.** The third Scroll into a hero offers from the band it just
  opened, which is what makes every third spend the bigger moment rather than a silent deposit.
- **Income:** `SCROLLS_PER_ACT` = 2 at every Guardian (10 guaranteed), the `scrollReward` Scroll
  Cache (`SCROLL_REWARD_COUNT` = 2, weight 34), and the Guild Hall at `SCROLL_PURCHASE_COST` =
  35g. ~15-18 reachable. All first-pass figures for playtest.
- **A Scroll is refused only when it would buy literally nothing** — max rank AND nothing left to
  teach (`canSpendScroll`). A dry band below the cap still takes one: the rank tick is the only
  thing that opens the next band, so refusing there would strand the hero at that rank forever.
  The board says "Band is dry — a Scroll buys the rank only" rather than greying the row out.

### Which move is offered: the tier gate (2026-08-31; re-pointed to RANK 2026-09-10)

The move is drawn at random from the hero's pool (`progressionTable.moveTiers`), but
**not from all of it.** Every move carries the designer table's `Early / Mid / Late`
column as `MoveDefinition.tier`, and `MOVE_TIER_RANK` (`src/run/progression.ts`) gates
each tier behind a hero's **Mastery Rank**: **Early at 1, Mid at 2, Late at 3.** That maps 1:1
onto the authored 6 Early / 6 Mid / 4 Late pools, so the re-point cost no re-authoring.

It gates on rank rather than on the act because the ceiling has to sit **behind the spend**. Act-
gating makes holding a Scroll always better than spending one, and a currency whose optimal play
is *don't spend it* can never feel good to receive.

Four properties, all deliberate:

- **Early EXPIRES at Mid; Mid and Late accumulate** (2026-09-07, `MOVE_TIER_RANK_EXPIRY`,
  replacing a fully cumulative gate). A ranked-up hero handed a starter-tier move was the ladder
  paying out backwards, and because a pool's Early half outnumbered everything else, a single
  random draw against the whole cumulative pool is what buried the Late band — five heroes
  carried exactly **one** Late move and it was almost never the one rolled. Late does *not*
  close Mid: the Late slates hold 4-5 moves a type, far too few to carry a band alone.
  The cost of an expiry is that a move the hero never rolled becomes unreachable — which is
  what the per-band floors are sized to make survivable rather than fatal.
- **Read at the rank just reached** (see the tick-before-roll rule above).
- **A graft's line is gated on REACHING a tier, not on the expiry** (`isMoveTierReached` vs
  `isMoveTierOfferable`). A graft can land on a hero already past rank 1; applying the expiry to
  its `learnableMoveIds` would make every Early move in a grafted type's line permanently
  unreachable, and the Early moves *are* the way into a type the hero has only just acquired.
- **An empty band is legal**, and the Scroll still buys the rank tick out of it.

Generated enemies hold no Scrolls, so **their rank is read off their LEVEL** — the same three
bands the level gate drew before (`enemyScrollsForLevel`, `src/run/enemyGen.ts`: Early under 4,
Mid at 4, Late at 7), so enemy kits keep the shape the difficulty curve was tuned against.
Revisit in the overhaul's phase 6, where enemy level is re-derived from scratch.

**All fourteen authored slates carry the designer's tier column**, checked against the
source table on 2026-08-31. Ancient is untiered because it has no authored slate yet,
and a move with no `tier` counts as Early, i.e. ungated. See `docs/authoring-moves.md`
§2 and `test/moveTiers.test.ts`.

**The gate exposed a pool-composition problem it did not cause.** Six heroes' level-up
pools (Sylva, Tempest, Vesper, Marrow, Nightshade, Bellows) held no Early move at all,
so they learned nothing until level 4 — those pools were built while the tier column
was documentation only, and nothing ever asked them to hold one. All six were given
one; `test/moveTiers.test.ts` now asserts that **every pool holds something a level-1
hero can be offered**, which is the invariant the gate creates.

That thinness is gone: no pool holds fewer than **6 Early, 6 Mid and 4 Late** offerable entries.
The floor is now `SCROLLS_PER_RANK` per band — what a band must survive to get the hero out of
it — rather than a margin derived from a fixed curve, because Scrolls make offers-per-hero
player-controlled and unbounded (`movePoolFloor`). Depth is also what buys **run diversity**: a
Scroll draws ONE move at random, so the six a maxed hero spends sample 16-odd entries rather
than exhausting a pool of 12.

### The four-move cap (LOCKED)

A hero holds a **maximum of four moves.** This is a hard cap. Once at four, growth in
the movepool is strictly *substitution*, never expansion.

> **Implemented (2026-08-16 playtest pass):** `src/run/progression.ts`'s
> `levelUpHero`/`grantLevelUpMove`/`MOVE_CAP` enforce exactly this — under the cap a
> level-up's move is gained outright; at the cap it's an accept/decline replacement
> offer (`src/view/run/LevelUpScreen.tsx`). **Fixture content now respects the cap
> too:** `/src/data/heroes.ts` starting kits are **exactly 3 moves for every hero** (a
> low-power move of the hero's main type plus two supports — heal/buff/status),
> leaving room to grow into the cap via level-ups instead of starting over it. The
> five Field Effect setters briefly broke that uniformity as fourth starting moves;
> they moved into `moveTiers` on 2026-08-26 (`docs/field-effects.md`), so the rule now
> holds with no exceptions — which is what lets the draft screen compare four
> candidates' kits against each other without one of them being a slot longer. Every
> fixture hero's `moveTiers` pool (`src/data/progression.ts`) was expanded to match, so
> a level-up's random draw has real variety across all 12 heroes. Evolution paths
> (Part 2, below) now cover all 12 fixture heroes too — a separate axis from the
> move pool, see README "Known gaps."

### Levels pay STATS — reversing "level-ups never change stats" (2026-09-10)

The old rule was that a level-up touched the movepool and nothing else, and all stat growth
happened at Evolution. Both halves are reversed: a level pays stats automatically (Part 1), and
the movepool moved wholesale onto Mastery Scrolls (Part 1b).

What the old rule was protecting — raw power explained by visible choices rather than an opaque
curve — moves rather than dying. The growth roll is not a choice, but the GRADE behind it is
authored, published on the hero sheet, and budgeted; and the choices that remain (which Scroll,
which Evolution, which item) are all still visible. Two lanes that never cross
(`docs/growth-overhaul.md` §2).

### Which moves are offered

The moves offered on level-up are drawn from a pool **shaped by the hero's current
typing and Evolution history** (see Part 2 — an Evolution path steers future
offerings). The exact selection rule (weighted draw vs. authored per-level lists) is a
design detail to specify in `/data`; the invariant is that offerings are
**type-appropriate to what the hero currently is.**

---

# Part 2 — The Evolution system

## Trigger: the CRUCIBLE (2026-09-10, Growth Overhaul phase 4)

**An Evolution is not triggered by anything a hero does. It is spent on a hero.** The Crucible
picks **ONE** hero from the roster, and that hero is presented with its **choice of three paths**.
`src/view/run/CrucibleScreen.tsx`.

**Where it fires.** A beat in the act-boundary chain, not a map row:

> **Guardian falls → Banner → Crucible → Pact Seal → act intro**

The Banner grants to everyone, the Crucible transforms one, the Seal counts the run — team, hero,
run, three scales ascending. It costs zero map rows, which matters because acts 1-4 already run
nine and a tenth is not affordable. **Non-bankable**: a turning point is decided now, which is
also why it is a beat rather than an item.

**Economy: five forced, a sixth reachable.** One per act's Guardian, plus the `crucibleReward`
reward-row node — **acts 3+ only**, and dropped from the map roll entirely when no roster hero has
an Evolution left (`CRUCIBLE_FIRST_ACT`, `rewardPoolFor`, `src/run/map.ts`). It has to be filtered
at generation rather than on arrival, because a map rolls its nodes an act ahead where a Boon
rolls its offers when the player walks in; a reward row is a pick of three, and a card nobody can
spend is a third of the choice gone. There is deliberately **no Guild Hall purchase**: gold stays
off the Evolution axis, because an Evolution is identity rather than something bought.

This is scarce when it matters and universal by the end. You choose who evolves first — in Act 2
that is a real commitment on a team still forming — and by the finale everyone can be there. An
unevolved sideboard hero is not unfinished, on the same reasoning that makes mono typing a valid
terminal state.

**`EVOLUTION_LEVEL` gates nothing** (`availableEvolution` is now identical to `pendingEvolution`).
It survives as authored data on `EvolutionNode.level`, and the docs still date the fork by it. Do
not re-attach a gate to it — the move off the level track was **forced, not preferred**: under
automatic roster-wide levelling every hero crosses any threshold on the same fight, so a level
trigger IS a six-decision wall.

**A GENERATED hero is the exception.** An enemy holds no Crucible, so its Evolution is read off
level (`rollLevelProgression`, `src/run/enemyGen.ts`) — the same equivalence
`enemyScrollsForLevel` uses for Mastery Rank.

The threshold is **`ENEMY_EVOLUTION_LEVEL` = 16, not `EVOLUTION_LEVEL`** (2026-09-10, phase 6). It
has to track how many of the PLAYER's heroes a Crucible has reached by that act — one an act, so
1-of-4 entering Act 2 — rather than when a level-up used to fire. Gating enemies on 5 evolved every
one of them from Act 2 and made that act's Guardian the run's only remaining difficulty spike. 16
is Act 3's enemy level, so Acts 1-2 field unevolved enemies and Acts 3+ evolved ones.

A **Guild Hall hire is no longer one of those** (2026-09-10, phase 5): it arrives RAW — unevolved,
rank 1, its own three moves — against a CONTRACT hero, which is the beaten enemy entire and so
carries everything that enemy's level bought. That contrast is the raise-vs-recruit axis
(`docs/progression.md` "A hire arrives RAW").

> **Scope note, not a contradiction of `CLAUDE.md`.** `CLAUDE.md` describes evolution
> depth as varying by design — *Capstone = 0 Evolutions, Single = 1, Deep line = 2+*
> — with per-hero-authored trigger levels implied. This file's current
> implementation is a deliberately scoped-down first pass: **every hero gets exactly
> one Evolution, at the same uniform level, for now.** That's the "Single" shape
> applied uniformly rather than authored per hero. Per-hero trigger levels and
> multi-node Evolution lines (Capstone / Deep-line heroes) are **deferred, not
> abandoned** — the data model (`ProgressionTable.evolutions: EvolutionNode[]` per
> hero, ordered) already supports more than one node whenever that authoring work
> happens; only the "every hero's first node sits at the same flat level" constraint
> is the temporary part.

## The three paths differ in kind, not degree (LOCKED)

An Evolution is **not** "pick how much to grow." The three paths take the hero in
**genuinely different directions** — a different role, a different type identity, a
different tool. Never author paths as tiered stat bumps of the same shape.

**Every path must carry a single identifiable name** — a proper noun the player
recognizes and remembers, the way Cinder's three paths might be named
**Explosive**, **Ironclad**, and **Thunderblaze**. The name, not the `kind` label
(`offensive` / `defensive` / `utility`), is what the player sees first and what the
build gets called in conversation about the run.

A path may grant any of:

- **A secondary type** (mono → dual, or a shift of the secondary slot), and/or
- **A stat grant** — always in **multiples of 5 or 10** (`progression.md`), and/or
- **An ability** (a passive or triggered effect), and/or
- **A move, granted outright** (`unlocksMoveIds`), subject to MOVE_CAP — see
  clause 5 below, and/or
- **A set of newly LEARNABLE moves** — see "Evolution steers future level-up
  offerings" below. These join the level-up pool; they are not handed over.

Not every path changes typing — **staying mono is a valid path** and a valid terminal
identity.

> ### The Evolution framework (2026-09-01 designer call)
>
> The shape every hero's node is authored to. **All 36 heroes are on it** as of
> 2026-09-05 — the 14 starters landed 2026-09-02, the 22 recruit-only heroes in the
> baseline pass that followed. `test/roster.test.ts` pins the parts of it that are
> checkable: three kinds per node, at least one mono path, no path that is a bare
> stat line, and a gross stat line inside the Rare-to-Mythic band.
>
> The recruit-only pass also took the five DUAL-typed recruits — Cinder, Brimstone,
> Bellows, Widow and Coil — somewhere the starters never had to go, and it took two
> passes to get there. Duals used to be offered no graft at all, so their three paths
> could only compete with each other; each one carries a passive or a granted move for
> that reason, and `learnableMoveIds` **without** a `typeGraft` is what lets a path hand
> over a whole LINE (the field is only type-checked when a graft is present). Cinder's
> Explosive opens Fire's magical column that way, which its physical body could never
> read.
>
> ### The RETYPE (2026-09-05, designer call)
>
> Then the prohibition itself came off. **The graft owns the SECONDARY SLOT** rather than
> appending to the type list — `effectiveTypes` and `rosterEntryTypes` both compose
> `[primary, graft]` — so a mono hero gains a second type exactly as before, and an
> innately dual one **trades the one it was born with**. Nothing ever reaches three types
> and the primary is never touched, which is the invariant that was actually load-bearing;
> the old throw was guarding an append that could not express a replacement.
>
> **A retype is a swap, not a gain**, which is what makes it safe: a mono hero's graft is
> pure addition (a chart column plus a slate plus STAB), while a dual hero pays for its
> new column with the old one and loses STAB on moves it is already holding. So it does
> not make duals better than monos — it makes their node contain a real fork instead of
> three flavours of the same currency.
>
> **Exactly one path per dual hero retypes** (`test/roster.test.ts`). Three would make the
> innate pairing a starting state rather than an identity; none is what the pass was fixing.
> And a retype path must carry the new type's line — `unlocksMoveIds` plus at least four
> `learnableMoveIds` — because clause 5's problem (a hero left holding a loadout that no
> longer reads what it now is) is the same problem a lost STAB creates. The five:
>
> | Hero | Path | Trade | What it buys |
> | --- | --- | --- | --- |
> | Cinder | Thunderblaze | Iron → **Storm** | The name always wanted it. The Iron it *keeps* still detonates Conduct — `Conduct.triggerTypes` is Storm, Iron and Mech, and detonation never asked for STAB. |
> | Brimstone | Hexfume | Shadow → **Nature** | The smoke was always the poison. Its Hexfume passive (arrival Poisons both foes) and Nature's Poison line are the same idea twice. |
> | Bellows | Overpressure | Iron → **Fire** | It is a boiler. Mech is the PRIMARY, so the self-burning Mech column stays learnable alongside the Fire one — which is what keeps Superheat fuelled. |
> | Widow | Silkbinder | Shadow → **Nature** | The trapper rather than the assassin. Nature has a physical column, which a 20-Intelligence spider needs. |
> | Coil | Hooded | Mind → **Stone** | A basilisk's gaze. The riskiest of the five: Coil's pool is almost all Mind, so this spends nearly every STAB it has. Stone's magical column is exactly three moves, which is just enough to refill a loadout — watch it in playtest. |
>
> Lucius is the counter-example that still stands. He was retyped **mono-Mind** in the same
> pass (`types-and-heroes.md` "The stat total"), and the retype rule does not undo that: a
> mono hero gets two graft paths plus a mono one, where a dual gets one retype. Being born
> dual is no longer a tax, but it is still less branching than being born mono.
>
> Tempest was authored from nothing (2026-09-02) rather than re-authored: it was the
> one hero of 36 with no `evolutions` entry at all, and nothing failed — the lookup is
> `?? []`, so it simply never evolved, in the player's roster and in `enemyGen` alike.
> `test/moveTiers.test.ts` now pins the coverage, the three kinds, and the graft's
> learnable line, so the next omission is a red test rather than a silent one.
>
> **1. Grants got bigger.** An Evolution is permanent, once per hero, and
> run-defining; paying out the ~20 points a Common item pays was the wrong
> order of magnitude. Re-authored nodes sit at roughly 20–40 points in
> equipment currency (`src/run/equipment.ts` `STAT_POINT_VALUE` — HP and Mana
> at ½, MP Regen at 3×), i.e. Rare-to-Epic. The multiples-of-5/10 rule is
> untouched; only magnitude moved.
>
> **2. The MONO path trades stats for a PASSIVE.** A graft buys a whole second
> column of the type chart *and* a second slate to draw level-up offers from. A
> mono path offering only stats cannot compete, which quietly made "mono is a
> valid terminal identity" false in practice. So a mono path takes the
> **smallest stat line on its node** and carries something no graft can offer:
> Crimson's **Pyroclasm** grants Firestarter, Fang's **Bloodhunt** grants
> Bloodthirsty.
>
> **A default, not a law** (2026-09-02): Riptide and Rime both put the passive on a
> GRAFT instead — Siren's Enthrall, Glacier's Frozen Stone — and pay for it in
> the stat line (Siren grants no stats at all). What the clause protects is that a
> mono path must carry something a graft cannot, and a signature MOVE (clause 5) serves
> that too: Riptide's Tidecaller has Lizard Rush, Rime's Avalanche has Snowball. What
> stays true is that a mono path offering *only stats* cannot compete.
>
> Tempest's Thunderhead breaks the other half (2026-09-02): +30 Speed ties Lightning
> Rod's net 30 rather than sitting under it, and it carries Feedback Loop on top. The
> designer's read is that a grant spent entirely on ONE axis that is neither offense
> nor defense is not the same 30 points as a mixed line — Speed only orders actions —
> and that 65 to 95 is worth being the loudest thing on the node. Watch it: if a mono
> path can out-pay both grafts, the clause was measuring the wrong thing.
>
> **3. A GRAFT path pays three ways** — more stats, the new type, and a line of
> that type's moves via `learnableMoveIds` (below). Three payoffs against the
> mono path's two, because the graft is also giving up the passive. STAB on the
> grafted line is the point: a type with no moves in it is half a graft.
>
> **4. A path may DRAMATICALLY REFOCUS the hero.** `statGrants` is signed, and a
> refocus path spends one stat to buy another. Fang's **Warhowl** is the worked
> example: −30 Attack / +60 Intelligence turns a 90-Attack physical body into an
> 80-Intelligence caster that kept its Speed. Nothing in the contract needed
> changing for this — the field has always been signed — it had simply never
> been used to say something that loud. The Attack is *spent*, not merely
> unused, which is what makes it a choice rather than a strict upgrade.
>
> **5. A path GRANTS a move, not only the promise of one** (2026-09-01, the fix
> for the refocus risk below). `unlocksMoveIds` is now authored, and it is what
> makes a refocus land the same turn it is chosen: Warhowl hands Fang
> **Poltergeist**, so the 60 Intelligence has something to read immediately
> rather than waiting on a level-up roll. `learnableMoveIds` still carries the
> *line*; `unlocksMoveIds` carries the one move the path is incomplete without.
>
> **The refocus risk, and how the grant is priced against MOVE_CAP** (closed
> 2026-09-01): a hero whose authored pool is entirely one category — Fang's is
> entirely physical — used to come out of a refocus with a loadout that no
> longer read the stat it now lived on, because `learnableMoveIds` only
> *offers* the fix on a later level-up. A granted move fixes that, but a level-5
> hero is normally already at MOVE_CAP, so the grant is **priced, not free**:
> `applyEvolutionMoves` (`src/run/progression.ts`) fills open slots in order and
> returns the rest as `overflow`, which `LevelUpScreen` puts to the player as the
> same **replace-or-decline** offer a level-up at the cap makes. The loadout
> never grows to five, and the player — not the path — decides what the new move
> displaces.

Typing usually shifts by *adding* a secondary (mono → dual), but a path may
also *replace* the secondary outright — whether it was granted by an earlier graft or
is the hero's INNATE second type (the retype, above). A hero flavored around
"Iron Stone" might Evolve down an **Iron / Light** path instead of the expected
Iron / Stone, if that's the path chosen. This is the same secondary-slot-shift
mechanic `progression.md`'s "Type-graft paths" already specifies; it just means the
resulting pairing isn't always the "obvious" one implied by the hero's name or flavor.

The paths are authored per hero (each hero has its own set of three), consistent with
the authored-roster philosophy in `types-and-heroes.md`.

## The immutability nuance (reconciles with `types-and-heroes.md`)

`types-and-heroes.md` states a hero's innate type is immutable. Evolution paths do
change typing — so read the invariant precisely:

- **The innate PRIMARY type is immutable.** It is present in *every* path offered and
  never changes. (The Snowman below is Frost in all three options.)
- **The SECONDARY type slot is the Evolution branch axis.** A path may add or shift the
  secondary type; it never touches the primary.

So "type is immutable" means the **innate primary** is immutable — not that typing is
frozen. `types-and-heroes.md`'s "Hero authoring rules" now carries this
primary/secondary distinction rather than a flat "type never changes" claim.

## Worked example — Snowman (canonical; keep verbatim)

A **Mono Frost** "Snowman" hero reaches `EVOLUTION_LEVEL`. The three options:

- **Become Frost / Stone**, and gain **+30 Defense.**
  → the defensive/tank branch (secondary type + stat grant).
- **Stay Mono Frost**, and gain an **ability that summons Snow at the start of
  combat.**
  → the mono-utility branch (no type change, no stats — an ability instead).
- **Become Frost / Arcane**, and gain **+10 Intelligence and +10 Wisdom.**
  → the special-attacker pivot (secondary type + stat grant).

Note how the three differ **in kind**: a wall, a weather/utility enabler, and a
caster pivot — not three sizes of the same upgrade. Frost is retained in all three
(the immutable primary). All stat grants are multiples of 5/10.

> This example predates the "single identifiable name" rule above and hasn't had
> names authored for its three options yet (that's real content-design work, deferred
> to a future pass — see `types-and-heroes.md`'s open five-50/50-heroes note for the
> same kind of deferred content work). Keep the mechanical shape verbatim; add names
> when the Snowman's paths get finalized.
>
> The Snow-summon ability presupposes the **weather subsystem**, which is flagged
> 🔒 OPEN in `mana.md` (weather dependency). The example is canonical, but that
> option's ability can only be implemented once weather is signed off.

## Evolution steers future level-up offerings (LOCKED behavior)

Choosing an Evolution path **influences which moves are later offered on level-up.**
Branching into a new secondary type **opens that type's moves** for future level-up
offers — e.g. the **Frost / Arcane** Snowman will subsequently be offered **Arcane
attacks** it could not have received as Mono Frost.

This makes the Evolution choice compounding: it is not just an immediate package of
type/stats/ability, it **redirects the hero's whole future movepool** toward the
chosen identity. The path you *don't* pick does not open its offerings.

> **Implemented (2026-09-01):** `EvolutionPath.learnableMoveIds`
> (`src/run/progression.ts`). `levelUpMovePool` unions the hero's authored pool
> with the `learnableMoveIds` of every path it has taken, deduped, then applies
> the same unlocked-filter and tier gate to the whole thing. Three consequences
> worth stating, since the rule above left them open:
>
> - **The retained primary keeps being offered** — the pool is *widened*, not
>   redirected. That is the "expected yes" above, now settled.
> - **Weighting stays uniform.** The level-up roll is flat across the pool, so a
>   graft's moves compete with the primary's on equal footing. If a grafted hero
>   should skew toward its new type, that is a weighting change to `levelUpMovePool`,
>   not more entries in the list — open, not decided.
> - **Tier gating still applies.** A Late graft move is unreachable until level 7
>   even though the graft happens at 5, so a graft arrives as a curve rather than
>   as a dump.
>
> Learnable moves also feed the level-up **floor** (`src/data/progression.ts`
> FLOOR, `test/moveTiers.test.ts`): a graft can only ever *add* to the pool, so
> it can widen a hero past the floor but never below it. The floor is still
> authored on the base pool, which is correct — it must hold for a hero that
> takes the mono path.

---

## Data vs. rules

This module specifies **rules**. The following are **data** (`/data`), not doc content:

- Level-up counts awarded per encounter tier (normal vs. elite).
- Each hero's authored three-path Evolution (names, types, grants, abilities).
- Move offer pools / weighting per type and per Evolution path.
- **Deferred:** per-hero Evolution trigger levels and multi-node Evolution lines
  (Capstone / Deep-line depth) — not yet authorable; `EVOLUTION_LEVEL` is presently a
  single engine-level constant, not per-hero data. Promoting it to per-hero data (and
  allowing more than one ordered node) is the next scope expansion of this system, not
  a rule change — the `EvolutionNode[]`-per-hero shape is already there to support it.

## Cross-references

- `progression.md` — pooled currency framing, equipment, relics, raise-vs-recruit.
  **Its level-up/Evolution sections defer to this file.**
- `types-and-heroes.md` — the 15-type system and the primary/secondary immutability
  nuance above; mono as a valid terminal state.
- `combat.md` — how the resulting stats/moves resolve in a fight (stat pipeline, move
  resolution).
- `mana.md` — the weather subsystem the Snowman's Snow ability depends on (🔒 OPEN).
- `architecture.md` — Evolution/level-ups mutate **run state**, not combat state.

---

## How heroes actually scale with level (measured 2026-09-08)

`scripts/statprice.ts roster --level N` runs a round robin at a given level: every hero against
every other, four copies a side, no gear, no relics, each side levelled through the run's OWN
progression functions — so raising the level really does unlock moves. (Until this pass the
harness handed out the three-move starting kit at every level, which made a hero designed to be
weak early and strong late unmeasurable by construction.)

Mean win rate by primary type, sorted by how much the type gains across the climb:

| type | n | L1 | L3 | L5 | L7 | L10 | swing |
|---|---|---|---|---|---|---|---|
| **Arcane** | 2 | 29.5% | 39.3% | 50.8% | 58.9% | **68.8%** | **+39.2** |
| Stone | 2 | 43.5% | 51.9% | 58.3% | 57.5% | 56.5% | +12.9 |
| Storm | 3 | 41.1% | 44.3% | 55.3% | 57.3% | 52.0% | +10.9 |
| Frost | 3 | 46.3% | 47.5% | 52.3% | 51.4% | 52.6% | +6.3 |
| Beast | 3 | 46.3% | 47.2% | 50.4% | 49.2% | 51.8% | +5.5 |
| Shadow | 3 | 46.3% | 47.9% | 52.4% | 46.5% | 47.1% | +0.9 |
| Nature | 3 | 46.4% | 34.3% | 35.9% | 41.5% | 45.3% | −1.0 |
| Iron | 3 | 58.1% | 57.2% | 60.4% | 65.1% | 56.8% | −1.3 |
| Mind | 3 | 61.6% | 57.7% | 46.4% | 40.6% | 53.2% | −8.4 |
| Fire | 3 | 62.2% | 60.4% | 46.6% | 53.3% | 53.4% | −8.7 |
| Water | 2 | 49.1% | 46.5% | 45.7% | 35.3% | 38.4% | −10.7 |
| Mech | 2 | 58.8% | 59.6% | 52.0% | 56.3% | 45.3% | −13.5 |
| Spirit | 2 | 57.3% | 58.3% | 44.1% | 42.6% | 42.3% | −15.0 |
| **Light** | 2 | 49.3% | 49.7% | 49.8% | 42.2% | **30.5%** | **−18.8** |

**Arcane is the intended late-scaling type and it works.** It is the worst type in the game at
level 1 and the best by level 10. **Zenith is the sharpest case in the roster** — 13.7% → 70.9%,
a +57.2 swing, more than twice the next hero (Sentinel, +27.5). Its level-1 kit is a Base Power
20 attack and two moves that hand mana to a partner; that is the price of the payoff, and the
payoff arrives. A hero reading as weak at level 5 is not on its own evidence of anything.

**The unflagged problem is the mirror image: types that start strong and decay.** Light −18.8,
Spirit −15.0, Mech −13.5, Water −10.7. Arcane's early weakness buys something; a Light hero's
late weakness buys nothing, and Aegis is the extreme — **62.0% at level 1 down to 24.3% at level
10, a −37.7 swing**, almost exactly Zenith inverted. That is the shape worth authoring against.

**Two caveats on the numbers past level 5.** The harness always takes the FIRST Evolution path,
so a hero whose `paths[0]` is weak — or is a retype that spends its innate STAB — reads worse
than a played hero would; the decays above are a place to look, not a verdict. And a round robin
fields four copies of one hero, which flatters nothing and punishes a SUPPORT: `--partner <id>`
gives each side two copies plus a fixed neutral so a support has someone to support.

**One real bug fell out of building this.** `policy.replacementTarget` (the simulated player's
"which move do I drop at MOVE_CAP") priced moves on power minus a fraction of cost, with no
affordability check, so a greedy climb traded every cheap move away: Brimstone reached level 10
holding four moves priced 75–80 against a 65 mana pool, could cast nothing, and won 0 of 350
fights. It now never gives up the last castable move. `scripts/sim` shares that policy, so the
main simulator had the same hole — measured at 11.2% full-clear against 11.1% before, it changes
little there only because few heroes reach level 10 inside a run.
