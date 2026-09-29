# Evolution Simplification

**Status: PROPOSED, PILOTED on Cinder (2026-09-29, per user direction).** One hero is converted
and pinned by `test/evolutionSimplification.test.ts`; the other 83 are still on the five-clause
framework (`docs/leveling-and-ranks.md` "The Evolution framework"), which stays the rule in force
for them until the migration in §7 lands.

## 1. The problem

An Evolution path could carry up to five things: a stat line, a granted move, a set of learnable
moves, a type graft and a passive. Counted across the roster before the pilot (252 paths, 84
heroes × 3):

| Component | Paths carrying it |
|---|---|
| Stat grants | 251 |
| Granted move | 215 |
| Learnable-move list | 167 |
| Type graft | 165 |
| Passive | 49 |

The typical path was four of the five, and some were all five (Cinder's Ironclad: +60 HP, +10
Defense, Shield Bash, Iron, six learnables, Cinderguard). The Evolution screen is the biggest
screen a hero gets, and nearly every path on it was partly selling a bare number, which breaks
the rule the Growth Overhaul reduced to: *a bare number never gets a screen, and a screen never
buys a bare number.* The stat lines are also what the player skims past; the verbs (a type, a
move, a passive) are what gets remembered and built around.

## 2. The rule: two of three, and the three pairs

A path grants **exactly two of**:

1. **a type**: a graft into the secondary slot (the graft rules in CLAUDE.md are unchanged)
2. **a move**: exactly ONE, granted outright, replace-or-decline at `MOVE_CAP`
3. **a passive**: exactly ONE

and **no stat line**. A hero's three paths are **the three pairs, one each**:

| Pair | What it is for |
|---|---|
| **Type + Move** | a new direction, with something to swing on day one |
| **Type + Passive** | a new direction that changes how the hero plays |
| **Move + Passive** | the mono path: going deeper into what the hero already is |

This matches the roster's existing shape (about two grafts a hero), and the Move + Passive path
satisfies the "at least one mono path" test by construction. It keeps a hero from offering three
versions of one path, and a player who has read one Evolution screen can read all of them.

## 3. The line is a rule, not a list

`learnableMoveIds` does not go away, because a graft without it is a chart column and one move.
It stops being AUTHORED. `evolutionLine(heroId, type)` (`src/data/progression.ts`) derives it:

> every tiered move of the type (`spawnSlate`) that the hero's own pool doesn't already hold,
> keeping its damage moves only on the column the hero swings with after the path (physical if
> Attack ≥ Intelligence, flipped by a rewire) and its other moves whole, minus whatever the path
> grants outright.

It is not one of the path's two things: the Evolution screen's "New Storm moves join what a
level can teach" line is the type's consequence, not a third grant. The dossier still lists the
moves for a player who wants them.

**A consequence to measure:** the derived lines are longer than the hand-authored ones. Cinder's
are 11 / 8 / 11 against 5 / 6 / 5. A grafted hero's level-up rolls therefore draw more often
from the new type. That arguably makes the graft read as a graft, but it dilutes the hero's own
pool, and graft moves are gated on *reaching* their tier rather than expiring, so an Early graft
move stays in the pool at Late. If it measures badly, the dial is the filter (for example,
dropping graft Early moves once the hero is past Mid), not a return to hand-written lists.

## 4. The rewire: the one stat exception

Some paths exist to change what a hero swings with (Explosive turns a physical knight into a
caster). Under the old framework that was a stat pile (−40 Attack, +60 Intelligence, +20 Mana).
Here it is **a swap**, printed as one line, *Attack ⇄ Intelligence*:

- `EvolutionPath.swapsOffense` trades the hero's own Attack and Intelligence (base, growth and
  any earlier Evolution grant) as a derived grant (`offenseSwapDelta`), so the 550 total is
  untouched and nothing needs adding up.
- `RosterEntry.offenseSwapped` makes every later level roll each stat on the other's grade
  (`entryGradesFor`). Without this, a rewired Cinder would keep rolling its A into a dead Attack.
- **Gear is not traded.** The player chose it, and it stays what it was.
- It rides **on top of** a pair; it is not one of the two. Explosive is Move + Passive + rewire.
- Rare by rule: `REWIRES` in the test pins every holder, so a new one is a decision.

**Two things this touches in CLAUDE.md.** (1) The swap is a **third derived grant** (landing
unrounded) beside Arcane Overflow and Apex Predator, and CLAUDE.md says a third "should be a
conversation": this doc is that conversation. (2) Stat modifiers stay flat and additive, and the
two-pipeline rule is untouched: the swap writes into the same flat evolution grant everything
else does.

## 5. Cinder, the pilot

| Path | Before | After |
|---|---|---|
| **Explosive** | Atk −40, Int +60, Mana +20; Immolate; 5 learnables | **Immolate + Flashpoint**, rewire; Fire's magical line (11) |
| **Ironclad** | HP +60, Def +10; Shield Bash; Iron; 6 learnables; Cinderguard | **Iron + Cinderguard**; Iron's line (8, Shield Bash in it) |
| **Thunderblaze** | Atk +10, Spd +30; Storm Lash; Storm; 5 learnables | **Storm + Storm Lash**; Storm's line (11) |

**Flashpoint** (new, Evolution-only): *whenever this hero afflicts Burn, it gains 10
Intelligence.* It is Kindling's shape on the column the rewire hands over.

**A tension the pilot surfaced:** Cinder's innate Kindling (+5 Attack on afflicting Burn) and
its mastered form Kindling+ both read Attack, the stat Explosive gives away. Flashpoint covers
the gap, but the innate stays dead weight on an Explosive Cinder. Every rewire will hit this
wherever the innate reads the traded stat. The options are to accept it, have the swap also
retarget innate `statDelta`s (an engine verb), or never rewire a hero whose innate reads the
stat it trades. **Undecided.**

## 6. Open questions

1. **Dual-typed heroes.** The retype rule says exactly one path per dual hero changes its
   secondary type, but the three pairs give every hero two type paths. There are only three dual
   heroes (of 84), so either they get an exemption (one retype path, the other Type path becomes
   a second Move + Passive) or they get two retypes. **Undecided.**
2. **Passive supply.** Two of the three pairs carry a passive, so the roster needs ~168 path
   passives against 49 today. Reusing catalog cards is allowed but conflicts with "Evolution
   passives are excluded from the Boon pool", since a reused Boon card would then be both.
   Watch the late-run passive stack too: innate, mastered innate, Class, Evolution and Boons can
   become the new pile.
3. **Power.** Stat lines were 50–110 points of stats a hero at pip 5, roster-wide. Taking them
   out is a real loss that has to land somewhere: `ACT_LEVEL_ADJUST`, the Scroll supply, or
   accepted. Measure before choosing. Mastery already cost 62 → 54% full-clear by making
   Evolutions arrive later.
4. **The rewire's Mana.** Explosive's old +20 Mana existed because a caster lives on its pool.
   The swap doesn't move Mana, and a rewired hero keeps its old pool. Probably fine (the Mana
   Well is the faucet), but watch it.

## 7. Migration

1. Pilot (done): Cinder, the engine for the swap, the derived line, the pinned test.
2. A sim pass over Cinder's paths against the old ones (`SIM_ALL_HEROES`, per path). Directional
   only: sims find faults, and balance is played.
3. Decide §5's innate tension and §6.1 (duals); then convert a type at a time, adding each hero
   to `SIMPLIFIED` in the test. As each type lands, delete its authored `learnableMoveIds` lists.
4. When `SIMPLIFIED` is the roster: delete `statGrants` from `EvolutionPath`, retire the
   five-clause framework and its roster tests (the Rare-to-Epic stat-line ceiling, the retype
   line requirement), and fold this into CLAUDE.md as the rule in force.
