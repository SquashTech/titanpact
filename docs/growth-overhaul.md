# growth-overhaul.md — The Growth Overhaul

> **STATUS: BUILT IN FULL (2026-09-10, per user direction; second pass §11 2026-09-11, third pass
> §12 2026-09-12).** What is still in force from this doc: §1's rule, §3's automatic roster-wide
> levelling and growth grades, §6's finished-vs-raw recruit line, §7's deletions, and §11's
> Crucible-grants-a-Class, Classes-as-verbs and the Mentor.
> **Superseded:** the Mastery Scroll ladder of §4, §11 and §12 was deleted by `xp-overhaul.md`
> (2026-09-13 — moves come from a per-hero level schedule), and the Evolution then moved onto
> Mastery pips (`mastery.md`, 2026-09-14). §5's Crucible-grants-an-Evolution was reversed by §11.
> §3's level-curve table was re-authored as XP (`xp-overhaul.md` §2) and cut to four acts
> (`xp-overhaul.md` §5). Act 4's Forge row (§11) became the Tutor (`gear-absorption.md` §4).
> Superseded sections keep their heading and a pointer; the current rule is in `CLAUDE.md`.

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
   strategy.
2. **A Gem has no identity.** Ruby / Amethyst / Citrine are a colour code for a number. "+5 Attack"
   never becomes a story; "you learned Ember Cascade" is a thing that happened.
3. **The caps were inert.** A run earned roughly 40 Gems against a capacity of 120, so the hero cap
   could essentially never bind.

And the proportion is the tell: ~40 Gems is ~200 stat points across a whole roster, against one
late Legendary at 90 points in a single decision. **Gems delivered item-comparable power at roughly
ten times the attention cost per point.**

Test any future reward proposal against the rule above before anything else.

---

## 2. The two lanes

Growth splits into two lanes that never cross. This is the same automatic-vs-chosen line as §1,
stated as structure.

| | **Vertical — the hero deepens** | **Horizontal — the team broadens** |
|---|---|---|
| Frequency | every fight | ~15 picks a run |
| Shape | **automatic, no interface** | **chosen, one screen each** |
| Carries | Level, and the stats it rolls | Mastery, the Crucible, items, Boons, Classes, recruits |

- **Level is what a hero is.** Never a decision — it ticks like a clock, identically for everyone.
- **What a hero knows is chosen.** (Drafted as Mastery Rank; Rank is gone — today the chosen axis
  is Mastery pips, `mastery.md`, and the schedule's offers, `xp-overhaul.md` §4.)

Two numbers that *behave* differently are far easier to hold than two that behave alike.

---

## 3. Levelling and growth grades

### XP is automatic and roster-wide

**Every roster hero levels every won fight, fielded or benched. There is no pool and no
allocation.** `MAX_LEVEL` = 30. `src/run/growth.ts`.

**A level-up REPORT is allowed; an allocation screen is not.** The distinction is that a screen
must not exist to collect a decision that is really a spreadsheet — not that growth should happen
invisibly. The report names each hero, the level it crossed, and every growth stat as a cell
whether it rolled or not, because the misses are what make the hits read as a **roll against a
grade** rather than an authored grant. (Since 2026-09-30 it lives on the victory screen; see
`CLAUDE.md`.)

Participation-based XP (Fire Emblem's actual model) was considered and **rejected**: it produces the
runaway where your best four level, your sideboard rots, and by Act 4 you cannot rotate. A hero
rotated in at Act 4 is at parity, and rotating costs nothing, which is *better* for strategic churn.

**The cost, and it is a real deletion:** hyperfocus dies as a *levelling* strategy. A **focus-hero
XP dial** (one designated hero per act at +25% XP) was drafted and dropped; the focus axis lives on
Mastery pips now (`mastery.md`).

The curve itself — XP a fight pays, par derived — is `xp-overhaul.md` §2.

### Growth grades (Fire Emblem model)

Each level rolls **each stat independently** against that hero's authored grade for it. A grade
is a **distribution over points**, not a coin (`GRADE_ROLL`, 2026-09-10, per user direction —
the flat "+2 or nothing" roll it replaced was predictable enough to read as a schedule):

| Grade | S | A | B | C | D | E | F |
|---|---|---|---|---|---|---|---|
| Budget cost | 6 | 5 | 4 | 3 | 2 | 1 | 0 |
| Miss | 10% | 18% | 30% | 40% | 52% | 68% | 92% |
| +1 | 24% | 30% | 28% | 28% | 30% | 24% | 6% |
| +2 | 38% | 30% | 28% | 24% | 14% | 8% | 2% |
| +3 | 22% | 18% | 10% | 8% | 4% | — | — |
| +4 | 6% | 4% | 4% | — | — | — | — |
| Mean points | 1.9 | 1.6 | 1.3 | 1.0 | 0.7 | 0.4 | 0.1 |

- **A point is +1, or +3 HP** (the measured HP break-even is ≈0.33 a point), **or +1 Mana**
  (`CLAUDE.md`). One level lands anywhere from nothing to +4 (+12 HP) on an S stat, and never past
  +2 on an F.
- **Every row's mean is exactly `0.1 + 0.3 × cost`** — the figure the flat roll paid — so the shape
  of the row changed and never its size.
- Grades cover the **seven stats the 550 budget covers** — MP Regen excluded.
- **Every hero's grades sum to exactly 28** (an average of B) — a **second budget**, enforced by
  test beside the 550 (`test/roster.test.ts`).

At all-B that is ~9.1 points a level, ~264 over 29 levels — a hero grows by roughly half again.

**Base and growth are independent axes**, and that is the point. Low base + high growth is a late
bloomer; high base + low growth is front-loaded.

**A grade line is a shape, never a size.** Because a grade's mean is linear in its cost, a line
summing to 28 buys *every* hero the same 9.1 points a level. Only *placement* is authorable:

- A **late bloomer** stacks the budget on the stat it swings with and on Speed, where growth
  compounds through the damage ratio.
- A **front-loaded** hero holds its spike at B or C and spends the budget on bulk, Wisdom or mana
  — real value that does not compound.

Two rules bound both. A hero's **dump stat stays dumped** (E/F): it is what the 550 charged for.
And a stat a hero genuinely swings or defends with **never goes below C** — the first draft gave
Tempest an F in Defense and measured it straight into trap-pick territory. Authored lines:
`src/data/heroes.ts`, `docs/types-and-heroes.md`.

### The level curve

Act ends are **8 / 14 / 19 / 24**, the finale at par 24 (four acts since 2026-10-02). They were
front-loaded in phase 6 from 6 / 12 / 18 / 23 because Acts 1–2 measured as the run's wall and the
player's own curve was the only lever left. The curve is authored as XP a fight pays, with par
derived: `xp-overhaul.md` §2, §5.

---

## 4. Mastery Scrolls and Mastery Rank

> **SUPERSEDED.** The Scroll ladder was deleted by `xp-overhaul.md` §4 (2026-09-13); moves come
> from a per-hero level schedule, and the Evolution from Mastery pips (`mastery.md`). Kept for the
> three arguments later docs cite.

- **The guard rail — the ceiling sits behind the spend, never behind a clock.** Act-gating the
  movepool made holding a Scroll always better than spending one, and a currency whose optimal
  play is *don't spend it* can never feel good to receive. (It retired with its premise: with no
  Scroll there is nothing to hold — `xp-overhaul.md` §1.)
- **The silent-deposit objection.** A spend that only ticks a bar is a deposit; every grant should
  be a moment.
- **Concentration priced in breadth.** Increasing returns inside a hero, decreasing across the
  roster — the carry build, priced on an axis with texture rather than arithmetic.

`MoveOfferOverlay` (one offer, take or decline, burned either way, replace-or-decline at
`MOVE_CAP`) is the shape this section introduced and the level schedule kept.

---

## 5. The Crucible — Evolution's new home

> **SUPERSEDED by §11 (2026-09-11).** The Crucible beat and screen survive; what they grant is a
> Class. The Evolution is on Mastery pips (`mastery.md`). Kept for the reasoning that still holds.

- **No level trigger under roster-wide levelling.** Every hero would cross any threshold in the
  same fight — a six-decision wall.
- **A beat in the act-boundary chain, not a map row:** *Guardian falls → Banner → Crucible → Pact
  Seal → Act intro.* Team, hero, run — three scales ascending. Non-bankable: a turning point is
  chosen now.
- **Naming.** Not an "Evolution Seal": `Seal` is the most load-bearing noun in the fiction (a run's
  Guardians **are** its broken seals), so a second per-act "Seal" would confuse. "The Crucible" sits
  in the existing node vocabulary.
- **Gold stays off the Evolution axis**: an Evolution is identity, not something bought.

---

## 6. Finished and raw recruits

A pre-evolved late-game recruit makes an existing line **mechanical** rather than a statement about
stats: "Guild heroes have decaying runway value; contract heroes have flat value."

| | Level | Kit | Evolution | Gear |
|---|---|---|---|---|
| **Contract hero** | its node's enemy level | schedule entries below its level taken, **chosen by the game** | already chosen once its Mastery reaches 5 (`masteryForAct`, Act 4) | armed (`gear-absorption.md` §7) |
| **Guild hire** | one act behind | its authored two moves, the schedule still owed | none | bare |

Built 2026-09-10; the level axis, briefly inverted, was put right by levelling enemies per node
(`enemy-levels.md` §4), and `test/recruitment.test.ts` pins it.

- **RAW is unbuilt, not hollow.** A hire still has its levels ROLLED (`levelUpEntry`, seeded off
  the offer so the preview and the purchase agree). A hire with no growth would be ~120 points
  behind a roster hero of the same level — a waste of 50 gold, not an archetype.
- **`guildHallLevel` is DERIVED from the level curve** (`GUILD_HALL_ACT_LAG`,
  `src/run/guildRecruit.ts`): the level the roster held when this act began, plus one. That fixed
  act-sized gap IS the decaying runway — worth most early, when one act is most of the run.

The contract hero is **finished**; the hire is **raw**. You save the walk, and in exchange you
authored none of it.

**What prices it:** **gold** prices the *purchased* route — it is the one currency that converts to
either objective power or a pre-built hero, so buying the hero is visibly not buying the power. The
free route is priced by the roster cap: gaining a hero means terminating one, and its gear goes with
it. Two brakes on two routes.

---

## 7. What is deleted

All gone as of 2026-09-10: **Gems** entire (`gems.ts`, `GemBoard`, `GemChoiceScreen`,
`RunState.gemsEarned`, `gemReward`); **the Training Point pool** (`levelUpPool`, `levelUpCost`,
`costToReachLevel`, the old allocation `LevelUpScreen`); **the mastery stat reel** (`MASTERY_LEVEL`,
`drawMasteryStats`, `grantMasteryStat`); **level as the move gate** (`MOVE_TIER_LEVEL`,
`moveOfferLevels`); and **the two stat shrines** (`hpBoostReward`, `manaBoostReward`). The Mana Well
later came back as a named exception (`CLAUDE.md`).

The movepool floor was expected to dissolve here; it did not — it was rewritten twice and lives on
as `movePoolFloor(schedule)` (`src/run/progression.ts`, `test/moveTiers.test.ts`).

---

## 8. Order of work

All seven phases **DONE 2026-09-10**. Measured on the sim (greedy pilot) as each landed:

| # | Phase | Full-clear after |
|---|---|---|
| 1 | Excise Gems; the two stat shrines removed outright | 45.5% → 33.0% |
| 2 | Mastery Scrolls and Rank (since deleted) | → 18.0% |
| 3 | Automatic roster-wide levelling, cap 30, stat rolls | → 51.5% |
| 4 | The Crucible (then granting Evolutions) | → 38.5% |
| 5 | Finished and raw recruits | → 36.0% |
| 6 | Re-fit the difficulty curve | → 29.6% (acts 72/75/85/85/82/93) |
| 7 | Growth grades for all 36 heroes | → 35.6% |

**Phase 6's lesson, still worth having:** enemy LEVEL bought almost nothing on its own; what
mattered were the **thresholds** read off it (rank and Evolution), which were still set to a game
that no longer existed. Its two structural findings were both answered later — *every non-boss node
a ~99% win because HP restored between nodes* by **Wounds** (`run-loop.md` "Wounds"), and *the
Monsters track never threatens* by levelling enemies per node (`enemy-levels.md`). The step curve
and champion multiplier it introduced were deleted by `enemy-levels.md`.

---

## 9. Locked invariants this overturns

All landed 2026-09-10. Rows marked † were later superseded again.

| Before | Became |
|---|---|
| No automatic stat growth from leveling | Every level rolls stats against the hero's growth grades |
| Level-ups are a pooled currency distributed freely after each battle | XP is automatic and roster-wide; no pool, no allocation |
| A level-up costs as many pool points as the hero's current level | Deleted with the pool |
| A level-up unlocks a move from the current tier | † Moves came only from Mastery Scrolls — now the level schedule (`xp-overhaul.md` §4) |
| Past `MASTERY_LEVEL` a level-up rolls three stats and the player picks one | Absorbed — every level pays stats |
| A level-up never pays out nothing (the movepool FLOOR) | † Expected to dissolve; it survives as `movePoolFloor(schedule)` |
| The level-up that reaches the Evolution level surfaces the Evolution | † The Crucible — then the Scroll ladder (§11) — now Mastery pip 5 (`mastery.md`) |
| Gems are per-hero stat investment, poured and re-poured freely | Deleted; stats are never a decision anywhere in the run |

---

## 10. Open questions — DO NOT silently resolve

Closed: equipment slots (left at one, 2026-09-10 — since moved to three by `gear-absorption.md`),
Banner size (left alone, 2026-09-10), and both Rank questions (moot — Rank is deleted).

### Watch in playtest

- **Does raising become a mistake?** A contract hero arrives with level, kit, Evolution and gear
  skipped, paid for in a termination. That is meant to keep churn viable — the point to watch is
  where *pivoting is an option* tips into *raising is a trap*.
- **Does the roster read too flat?** Uniform levelling means differentiation comes from base stats,
  growth grades, schedules and the scarce axes (`xp-overhaul.md` carries this forward).

---

## 11. Second pass (2026-09-11): Evolution on the ladder, Classes in the Crucible

Playtest of the finished overhaul found two things. **The Crucible handed out what nobody built
toward** — an Evolution on a fixed cadence, one per Guardian, is a reward with no approach. **Classes
were the last Gem** — sixteen `+10/+10` Classes behind a forced Mentor row, statistically inert. The
fix: put the Evolution where the player is already investing, and the Class where the Evolution was.

### The ladder

> **SUPERSEDED** — the Evolution moved onto the 6th Scroll here, then onto the level schedule
> (`xp-overhaul.md` §4), then onto Mastery pip 5 (`mastery.md`). The idea that survived every
> move: a threshold the player fills toward one hero at a time can never wall.

### Income: the Skirmish lane pays Scrolls, the Monster lane pays loot

> **SUPERSEDED** with the Scroll ladder. Fights pay XP; the map pays Mastery Scrolls (`mastery.md`).

### The Crucible grants a Class

The chain is unchanged — *Guardian falls → Banner → Crucible → Pact Seal → act intro* — pick one
hero, pick one of three. What the Crucible tempers a hero into is a **Class**. One per Guardian, so
with four Guardians and six heroes two end Classless — the price of a late recruit, not a reason for
another source. `crucibleReward` is deleted.

**A Class is a verb, never a number** (per user direction). Its schema is the Evolution path's minus
the graft and the hero: a name and *either* a granted move (`grantMove`, replace-or-decline at
`MOVE_CAP`) *or* a passive with a real effect. No stat line. The Crucible rolls three distinct from
the whole catalog, un-labelled (the Offensive/Defensive/Utility tag came off the same day). Fourteen
in `src/data/classes.ts`; one per hero, replace-not-stack (`src/run/classes.ts`).

**Caster pass (2026-10-02, per user direction).** All three damaging class moves were physical, so
a caster holding one swung its dump stat — a trap pick. Five Classes were added: **Sorcerer**
(Cascade, the magical Volley), **Hexer** (Jinx: priority 2, BP 40, −15 Intelligence on the target),
**Conjurer** (Blink, the magical Vanish), **Warlock** (Siphon: every magical hit restores 10 Mana)
and **Sage** (Deep Breath: a Rest grants +20 Intelligence). Every damaging class move has a twin in
the other category (`test/classes.test.ts`). **Volley came down 55 / 30 → 50 / 35**, Cascade at the
same figures: it was the best damage per mana in the game. **Succor became the Cleric's passive**:
every hit the holder lands mends its partner 15 healing power off its Wisdom — on-hit rather than at
round end so it is not Patch's Upkeep, and a spread mends twice.

Two exclusivity rules, without which a Class is a Boon with a hat:

- A class passive is not in the Boon pool, and no Boon passive is a Class.
- A class move is in no level-up pool and no Tutor pool, and carries no `tier`. It **wears its
  holder's innate primary type** (`MoveDefinition.typeFollowsUser`): Feint is Fire on Cinder and
  Water on Riptide, so STAB is guaranteed and the chart is read at the hero's element. Resolved once
  at the edge — `moveForHero` in `src/engine/state.ts` — so the catalog is never mutated. Class
  moves are **role verbs** (a redirect, a priority strike, a spread, a heal, a hit-and-switch),
  never nukes. The type slates' own tests exempt them (`classMoves`).
- **A guaranteed lockout is priced by the fight, not the cast.** Feint, Blind and Barrier carry
  `manaCostGainOnUse` = 20 — each cast dearer for the rest of the fight — banked as a negative
  entry in the same per-move ledger as `manaDiscountOnUse`.

### The Mentor teaches any hero a powerful move

The Mentor row holds the spliced seat in **acts 1–3** (`LAST_MENTOR_ACT` = 3, `src/run/map.ts`).
Pick a hero, and the Mentor **rolls one Mid-tier move** from that hero's pool — un-gated, taking no
schedule entry, spent by being made (`mentorMovePool`, `src/run/tutor.ts`; `MentorNodeScreen`).

It was first a curated pick from the hero's whole Early-and-Mid list, and revised the same day (per
user direction): on one of the first nodes a new player meets, a twelve-move list is overwhelming.
The roll keeps the payoff and leaves *who* as the only decision. A Mentor move fills a slot and
advances nothing else, so it buys exactly one thing — an answer to the measured Acts 1–2 wall.

Act 4's seat was a forced Forge here; since `gear-absorption.md` §4 it is the Tutor.

### What this reverses

The Evolution left the Crucible (it is now on Mastery pips); `crucibleReward` is deleted; Classes
went from `+10/+10` stat pairs on a Mentor row to a move or a passive from the Crucible; the Mentor
went from granting a Class to rolling a Mid move.

## 12. Third pass (2026-09-12): the ladder is priced, and the purse banks

> **SUPERSEDED by `xp-overhaul.md` §4 (2026-09-13)** — deleted whole with the ladder. It priced
> rungs 1/2/3/4/5 Scrolls on the pre-overhaul level-up curve and let a purse bank. The ladder was
> killed by its screens — ~47 rung decisions a run (`xp-overhaul.md` §0) — not by its price.
