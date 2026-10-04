# leveling-and-ranks.md

> The rules for **how heroes grow**: the automatic level curve and its growth grades, what a
> level pays (the move schedule), and the Evolution branch. Where `progression.md` touches
> levelling or Evolution it defers here. Rules only; thresholds, move data and per-hero paths are
> **data** (`src/data/`).
>
> The current authorities beside this file: `docs/xp-overhaul.md` (the `L³` curve and the
> per-hero schedule), `docs/mastery.md` (Mastery pips: the Evolution at 5, the mastered innate at
> 10, the signature on its own level), `docs/evolution-simplification.md` (what a path may
> grant). The pooled Training Point currency, the Mastery Scroll ladder and its Rank, Ichor and
> the Crucible-as-Evolution are all deleted; their reasoning lives in `docs/growth-overhaul.md`
> and `docs/xp-overhaul.md`.

---

# Part 1 — Levelling

## Levels are automatic and roster-wide

**Every roster hero levels every won encounter, fielded or benched. There is no pool and no
allocation.** `MAX_LEVEL` = 30. `src/run/growth.ts`.

Participation-based XP (Fire Emblem's actual model) was considered and **rejected**: it produces
the runaway where your best four level, your sideboard rots, and by Act 4 you cannot rotate.
Roster-wide XP gets the screen removal without buying that problem. A hero rotated in late is at
parity, so rotating costs nothing — better for strategic churn than participation XP, not worse.

**The cost is real: hyperfocus dies as a *levelling* strategy.** The aimed currency that buys it
back is the Mastery Scroll (`docs/mastery.md`). A **focus-hero XP dial** (one hero an act at
+25% XP) was drafted and dropped; do not re-introduce it without re-reading
`docs/growth-overhaul.md` §4.

### The curve

**The XP a won encounter pays is what is authored** (`ENCOUNTER_XP_BY_ACT`); par
(`levelAfterEncounters`, `LEVEL_AFTER_ENCOUNTER`) is derived from the sum on `XP(L) = L³`. Four
seal acts of three fights each — the opener, the Elite-or-Skirmish fork (par assumes the
Skirmish; the Elite pays **×1.5**, above par), and the Guardian at **×2**
(`ENCOUNTER_XP_MULTIPLIER`) — then the finale's one fight.

| Act | XP a fight | Par after each fight | Par at act end |
|---|---|---|---|
| 1 | 150 | 5 · 6 · 8 | 8 |
| 2 | 560 | 10 · 11 · 14 | 14 |
| 3 | 1060 | 15 · 17 · 19 | 19 |
| 4 | 1750 | 20 · 21 · 24 | 24 |
| Finale | 5000 | — | the run ends |

A fight can leave a hero's bar part-way, and that is the point of authoring the XP rather than
the level: the bar is a real quantity the player watches fill, a hero behind par visibly climbs
faster on the same figure, and the next fight is visibly worth more than the last. Every figure is
a first pass for playtest; the act-end levels are what enemy level and the Guild Hall's lag read.

**It is a DELTA, never a target** (`xpForEncounter`). A hero that joins late has missed the
grants before it and is behind — which keeps "arrives underlevelled" a real archetype for a Guild
Hall hire rather than a rounding error the next win erases. On the cube the same XP is worth more
levels from lower down, so a late hero gains on par with every win, but never catches up on its
own (`test/growth.test.ts`).

## Growth grades — what a level actually pays

Each level rolls **each stat independently** against that hero's authored grade for it. A grade
is a **distribution over points** (`GRADE_ROLL`), not a coin: a roll with one outcome read as a
schedule, and a level-up that always says +2 is not a roll the player watches.

| Grade | S | A | B | C | D | E | F |
|---|---|---|---|---|---|---|---|
| Budget cost | 6 | 5 | 4 | 3 | 2 | 1 | 0 |
| Miss | 10% | 18% | 30% | 40% | 52% | 68% | 92% |
| +1 | 24% | 30% | 28% | 28% | 30% | 24% | 6% |
| +2 | 38% | 30% | 28% | 24% | 14% | 8% | 2% |
| +3 | 22% | 18% | 10% | 8% | 4% | — | — |
| +4 | 6% | 4% | 4% | — | — | — | — |
| Mean points | 1.9 | 1.6 | 1.3 | 1.0 | 0.7 | 0.4 | 0.1 |

- **A point is +1, or +3 HP.** HP is not a special case: the measured break-even is ≈0.33 a
  point (`progression.md` "Pricing HP"), so 3 HP *is* one point's worth. An S stat can jump +4
  (+12 HP) in one level; an F never passes +2.
- **Every row's mean is exactly `0.1 + 0.3 × cost`**, the figure the flat roll paid, so the curve
  fitted against it holds. The grade decides both how often a stat grows and how far it can jump;
  the miss rate is what the hero sheet's legend prints (`GRADE_CHANCE`).
- Grades cover the **seven stats the 550 budget covers** — MP Regen excluded, as from every other
  per-hero grant.
- **Every hero's grades sum to exactly `GRADE_BUDGET` = 28** (an average of B), a **second
  budget** enforced by test beside the 550: the 550 alone stops being sufficient the moment a low
  base with S-grades can outrun a high base with F-grades.

That is **9.1 points a level for every hero** — exact, not approximate, since the mean is linear
in cost — **~264 over 29 levels**. **A grade line is a shape, never a size.**

**Base and growth are independent axes**, and that is the point: low base + high growth is a late
bloomer, high base + low growth is front-loaded (Fire Emblem's Est/Oifey axis). Every hero is
authored; the budget and the no-placeholder rule are pinned in `test/roster.test.ts`. Authoring
doctrine: `docs/types-and-heroes.md` "Growth grades".

**The player reads the grades on the sheet** (`StatBars`' `grades` prop: the hero sheet and the
Guild Hall preview, not combat). Without it the late-bloomer archetype would exist in the data and
in no decision the player can make.

**The multiple-of-5 rule does not apply to a growth roll.** It exists to keep AUTHORED grants
legible; a roll nobody authors per hero is not that kind of grant, and the legibility lives in the
grade instead.

## Where levels are REPORTED

Under uniform levelling, Level is a property of the **run**: a figure identical across six cards
carries no information. It sits in the map header beside the act, and per-hero only where a hero
**deviates** — a recruit that is behind. The report lives **on the victory screen** (levels and
bars at a glance, a **Stat gains** tap for every growth cell, misses included — `LevelUpList`;
the roll is seeded per hero so the preview is what lands). The level screen opens only when a
payoff is owed (`levelUpFlow.ts`): a schedule offer, a signature, or an Evolution a hire arrived
past.

## What a level pays: the schedule

A level pays stats (above) and, on the levels a hero's **schedule** names, ONE move offer
(`LevelSchedule`, `src/run/progression.ts`; spec `docs/xp-overhaul.md` §4, `run-loop.md` "The
schedule"). Every hero authors its own: **five offers — two Early, two Mid, one Late** — and
starts with **two moves**, one attack and one that is not (Widow the named exception). The band
an offer rolls from is the one the level has opened: Early below `midLevel`, Mid from there, Late
from `lateLevel`. Take it or decline it; it is burned either way. The **signature** is a
guaranteed learn at the hero's own `signatureLevel` (`docs/mastery.md` §5). The **Evolution** is
not a level's to pay: it opens at Mastery 5 (Part 2).

`RosterEntry.scheduleTaken` walks the entries one per level-up, so a raw hire arrives with its
entries un-taken and works them off one fight at a time, while a contract hero arrives with every
entry below its level taken (`scheduleEntriesBelow`).

### An offer is spent by being MADE

A move leaves a hero's pool the moment it is **offered**, whether or not it is taken
(`RosterEntry.offeredMoveIds`, filtered by `levelMovePool`). Three cases, one rule:

- **Declined** at the cap — gone. The decline is a decision; re-rolling the same move later is
  the screen asking a question already answered.
- **Taught, then swapped away** — gone. Otherwise the discarded move drops back into the pool and
  crowds out everything unseen.
- **Granted by an Evolution path**, both the moves the cap took and the overflow it refused
  (`chooseEvolutionPath`) — the overflow IS an offer, so it prices like one.

The Mentor's and the Tutor's rolls are spent the same way. **An event's gift is not**
(`grantMove`, not `grantOfferedMove`): the player was never asked to choose it against anything,
so swapping it away later leaves it offerable. Scoped per hero and per run.

The pool therefore drains monotonically, so its depth is load-bearing. **An empty band is a data
bug, not a state the game may reach**: `movePoolFloor` derives each band's floor from the offers
the schedule makes from it, and the pools are authored well past it (6 Early / 6 Mid / 4 Late; the
FLOOR comment in `src/data/progression.ts`, enforced by `test/moveTiers.test.ts`).

### Which move is offered: the tier gate

The move is drawn at random from the hero's pool (`progressionTable.moveTiers`) plus the line of
any chosen path, **but only from the band's own tier**. Every move carries the designer table's
`Early / Mid / Late` column as `MoveDefinition.tier`, read through `MOVE_TIER_RANK` and
`MOVE_TIER_RANK_EXPIRY`:

- **Each band offers its own tier.** Early expires when Mid opens, Mid when Late does. A hero past
  `midLevel` handed a starter-tier move is the schedule paying out backwards, and a cumulative
  draw buried the thin Late band under everything below it.
- **A graft's line is gated on REACHING a tier, not on the expiry** (`isMoveTierReached` vs
  `isMoveTierOfferable`). An Evolution can land on a hero already past `midLevel`; applying the
  expiry would make the Early moves of a just-grafted type unreachable, and those moves are the
  way into it.
- **An empty band is legal at runtime** — the entry is still taken and the next level opens the
  next band — but the floor above means it never happens.
- **Offerings are type-appropriate to what the hero currently is**: the pool is the hero's own
  plus its grafted line (Part 2, "Evolution steers future level-up offerings").

A move with no `tier` counts as Early. All authored slates carry the column (`docs/authoring-moves.md`
§2, `test/moveTiers.test.ts`). Enemies, contracts and hires read the same schedule off their own
level.

### The four-move cap (LOCKED)

A hero holds a **maximum of four moves** (`MOVE_CAP`). Once at four, growth in the movepool is
strictly *substitution*, never expansion: under the cap an offer lands outright; at it, the offer
is replace-or-decline. Starting kits are two moves, so both Early offers land as receipts.

### Levels pay STATS — reversing "level-ups never change stats"

The old rule was that a level touched the movepool and nothing else, and all stat growth happened
at Evolution. What it protected — raw power explained by visible choices rather than an opaque
curve — moved rather than died: the roll is not a choice, but the GRADE behind it is authored,
published on the hero sheet and budgeted, and the choices that remain (which offer, which path,
which item) are all visible (`docs/growth-overhaul.md` §2).

---

# Part 2 — The Evolution system

## Trigger: the fifth Mastery pip

**A hero's Evolution opens at Mastery 5** (`MASTERY_EVOLUTION`, `availableEvolution`,
`docs/mastery.md`). The Scroll that lands the fifth pip raises that one hero's **choice of three
paths** over the node that paid it; a hire that arrives past the pip takes it on its next
level-up report. A generated hero reads the same pips (`masteryForAct`, `src/run/mastery.ts`), so
enemies evolve from Act 4.

**Never on a level.** Under automatic roster-wide levelling every hero crosses a level threshold
on the same fight, so a level trigger IS a six-decision wall. Pips are aimed one hero at a time,
which is what lets the player choose who evolves first. The **Crucible** at each Guardian now
grants a **Class**, not an Evolution (`CLAUDE.md`; `docs/growth-overhaul.md` §11).

An unevolved sideboard hero is not unfinished, on the same reasoning that makes mono typing a valid
terminal state. A **Guild Hall hire** arrives unevolved; a **contract** hero arrives with its
Evolution chosen (`docs/progression.md` "A hire arrives RAW").

> **Deferred, not abandoned: evolution depth.** `CLAUDE.md`'s *Capstone = 0 Evolutions, Single =
> 1, Deep line = 2+* is not authored: every hero has exactly one node. The data model
> (`ProgressionTable.evolutions: EvolutionNode[]` per hero, ordered) already supports more.

## The three paths differ in kind, not degree (LOCKED)

An Evolution is **not** "pick how much to grow." The three paths take the hero in genuinely
different directions — a different role, a different type identity, a different tool. Never
author paths as tiered stat bumps of the same shape.

**Every path carries a single identifiable name** — a proper noun the player remembers (Cinder's
**Explosive**, **Ironclad**, **Thunderblaze**). The name is all a path has: the `offensive` /
`defensive` / `utility` label was deleted on 2026-09-16 (it read as a category the paths never
fitted), and a path id is `heroId-pathName` (`test/moveTiers`).

**What a path grants** (`docs/evolution-simplification.md`, binding every hero): **exactly two of
a type graft, ONE granted move (`unlocksMoveIds`) and ONE passive, and never a stat line**; a
hero's three paths are the three pairs. A graft's learnable line is DERIVED (`evolutionLine`), not
authored. The one stat verb is the **rewire**, Attack ⇄ Intelligence (`swapsOffense`), pinned per
path. **Staying mono is a valid path** and a valid terminal identity.

## The Evolution framework (2026-09-01 — retired)

The five-clause framework this heading named (stat lines sized Rare-to-Epic, a mono path trading
stats for a passive, a graft paying three ways, the signed refocus line, a granted move) is
**retired by `docs/evolution-simplification.md`**, which replaced it with the two-of-three rule
above. Two of its findings still stand:

- **A path GRANTS a move, not only the promise of one.** `unlocksMoveIds` is what lets a path land
  the turn it is chosen. Priced against `MOVE_CAP`: `applyEvolutionMoves` fills open slots and
  returns the rest as `overflow`, put to the player as the same **replace-or-decline** offer a
  level-up at the cap makes. The loadout never grows to five, and the player decides what the new
  move displaces.
- **What a mono path carries must be something a graft cannot offer** — a passive or a move — not
  stats alone. That is now true of every path by construction.

### The RETYPE

**The graft owns the SECONDARY SLOT** rather than appending to the type list —
`effectiveTypes` and `rosterEntryTypes` both compose `[primary, graft]` — so a mono hero gains a
second type, and an innately dual one **trades the one it was born with**. Nothing ever reaches
three types and the primary is never touched (the one exception is a Turned curse,
`run/curse.ts`).

**A retype is a swap, not a gain**, which is what makes it safe: a mono hero's graft is pure
addition (a chart column, a slate, STAB), while a dual hero pays for its new column with the old
one and loses STAB on moves it already holds. It does not make duals better than monos; it makes
their node contain a real fork.

**How many paths retype** is set by `docs/evolution-simplification.md` §6.1 (2026-09-29): a dual
hero takes the same three pairs, so **both type paths retype**, and the path that keeps its
pairing is the Move + Passive one, whose move is a Late move of its secondary type. This retired
the 2026-09-05 rule of exactly one retype per dual hero.

## The immutability nuance (reconciles with `types-and-heroes.md`)

`types-and-heroes.md` states a hero's innate type is immutable. Evolution paths do change typing,
so read the invariant precisely:

- **The innate PRIMARY type is immutable.** It is present in every path offered and never changes.
- **The SECONDARY type slot is the Evolution branch axis.** A path may add or shift the secondary
  type; it never touches the primary.

So "type is immutable" means the **innate primary** is immutable — not that typing is frozen. A
path may replace a secondary that was the hero's innate second type (the retype, above), so the
resulting pairing is not always the one the hero's name or flavour implies.

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

> The example predates three later rules and is kept for its shape, not its payload: the trigger
> is now Mastery 5, not a level; paths carry no stat line (each stat grant would now be a move or
> a passive); and every path needs a name. "Summons Snow" is a Field Effect setter, which the
> Field Effects subsystem (`docs/field-effects.md`) now makes authorable.

## Evolution steers future level-up offerings (LOCKED behavior)

Choosing a path **influences which moves are later offered.** Branching into a new secondary type
**opens that type's moves** for future schedule offers — the Frost / Arcane Snowman will later be
offered Arcane attacks it could not have received as Mono Frost. The path you *don't* pick opens
nothing. That makes the choice compounding: it redirects the hero's whole future movepool.

Built (`EvolutionPath.learnableMoveIds`, derived by `evolutionLine`; `levelMovePool` unions it
with the hero's pool):

- **The retained primary keeps being offered** — the pool is *widened*, not redirected.
- **The tier gate still applies** (reached, not expiry — above), so a graft arrives as a curve
  rather than as a dump.
- A graft can only add to the pool, so the floor is authored on the base pool, which must hold for
  a hero that takes the mono path.
- **Open: weighting.** The roll is flat across the pool, so a graft's moves compete with the
  primary's on equal footing. If a grafted hero should skew toward its new type, that is a
  weighting change to `levelMovePool`, not more entries — undecided.

---

## Data vs. rules

This module specifies **rules**. These are **data** (`src/data/`): the XP each act pays; each
hero's grades, schedule, signature and three paths (names, grafts, moves, passives); move pools
per hero. Per-hero evolution depth (more than one node) is the deferred scope expansion above, not
a rule change.

## Cross-references

- `progression.md` — equipment, relics, raise-vs-recruit, meta-progression. Its levelling and
  Evolution sections defer to this file.
- `xp-overhaul.md`, `mastery.md`, `evolution-simplification.md` — the specs this file summarises.
- `types-and-heroes.md` — the 15-type system, the immutability nuance, mono as a valid terminal
  state, growth-grade authoring.
- `combat.md` — how the resulting stats and moves resolve in a fight.
- `architecture.md` — levels and Evolutions mutate **run state**, not combat state.

---

## How heroes scale with level (measured 2026-09-08, directional)

`scripts/statprice.ts roster --level N` runs a round robin at a given level — every hero against
every other, four copies a side, no gear — levelled through the run's own progression functions.
`--partner <id>` gives each side two copies plus a fixed neutral so a support has someone to
support. Measured on the 36-hero roster at the old cap of 10, before the schedule, the grades and
the Evolution rework, so the figures are stale; the shapes it found are the ones to re-check:

- **Arcane is the intended late-scaling type and it worked**: worst at level 1 (29.5%), best by
  level 10 (68.8%). Zenith was the sharpest case (13.7% → 70.9%). A hero reading weak early is not
  on its own evidence of anything.
- **The unflagged problem was the mirror image: types that start strong and decay** — Light
  −18.8 points across the climb, Spirit −15.0, Mech −13.5, Water −10.7, and Aegis 62.0% → 24.3%.
  Arcane's early weakness buys something; a late decay buys nothing.

Caveats: the harness takes each hero's FIRST Evolution path, and a four-copy round robin punishes
a support.
