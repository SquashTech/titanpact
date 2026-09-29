# Evolution Simplification

**Status: BUILT for all 84 heroes (2026-09-29, per user direction).** `EvolutionPath.statGrants`
is deleted and `test/evolutionSimplification.test.ts` binds every hero. The five-clause framework
(`docs/leveling-and-ranks.md`) is history. §9 records what the roster pass found; the sim pass and
the Evolution screen are next (§7).

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
| **Explosive** | Atk −40, Int +60, Mana +20; Immolate; 5 learnables | **Immolate + Rekindle**, rewire; Fire's magical line (11) |
| **Ironclad** | HP +60, Def +10; Shield Bash; Iron; 6 learnables; Cinderguard | **Iron + Cinderguard**; Iron's line (8, Shield Bash in it) |
| **Thunderblaze** | Atk +10, Spd +30; Storm Lash; Storm; 5 learnables | **Storm + Storm Lash**; Storm's line (11) |

**Rekindle** (new, Evolution-only): *whenever this hero lands a Fire attack on a Burning foe,
that foe gains Burn 10%.* It replaced the pilot's Flashpoint, which repeated Kindling.

**The innate reads both columns (decided 2026-09-29, per user direction).** Kindling read Attack,
the stat Explosive gives away, so it now grants **5 Attack and 5 Intelligence** (Kindling+ 10 /
10 / 10 Defense). No engine verb retargets an innate on a swap; the rule for every rewire is that
**an innate or mastered innate reading a traded stat reads both.** With Kindling covering the
Intelligence, Flashpoint repeats it and is replaced in the roster pass (§8).

## 6. Open questions

1. **Dual-typed heroes: DECIDED (2026-09-29, per user direction).** A dual hero takes the same
   three pairs, so **both type paths retype** (the old "exactly one retype" rule is retired for
   converted heroes). The path that **keeps its pairing** is the Move + Passive one, and its move
   is **a Late move of its secondary type**, off its own pool: the special move is the reason to
   stay what it was born as, and it is of the type the other two paths trade away.
2. **Passive supply: DECIDED, author them.** Two of the three pairs carry a passive, so the
   roster needs ~168 path passives against 49 today. The engine's hooks, conditions and effects
   support far more than that; the pass authors new cards (one file a type,
   `src/data/evolutionPassives/`) and keeps an existing Evolution passive where it still fits.
   A Boon card is never reused as a path passive. Watch the late-run passive stack (innate,
   mastered innate, Class, Evolution, Boons) in play.
3. **Power: DECIDED, accepted.** Stat lines were 50–110 points a hero at pip 5. The user judges
   the game too easy as it stands, so the loss is not compensated; measure it, don't pay it back.
4. **The rewire's Mana.** Explosive's old +20 Mana existed because a caster lives on its pool.
   The swap doesn't move Mana, and a rewired hero keeps its old pool. Probably fine (the Mana
   Well is the faucet), but watch it.

## 7. Migration

1. Pilot (done): Cinder, the engine for the swap, the derived line, the pinned test.
2. The roster pass (§8), two types at a time. A hero counts as **converted** once no path of its
   carries a stat line, and `test/evolutionSimplification` binds every converted hero, so no
   list has to be kept.
3. When every hero is converted: delete `statGrants` from `EvolutionPath`, retire the five-clause
   framework and its roster tests (the Rare-to-Epic stat-line ceiling, the one-retype rule, the
   retype line requirement), and fold this into CLAUDE.md as the rule in force.
4. A sim pass (`SIM_ALL_HEROES`, per path). Directional only: sims find faults, and balance is
   played.
5. **The Evolution screen: BUILT 2026-09-29** (per user direction, picked from three mockups).
   The choice is a **triptych**: three form cards side by side, sized to their content and centred,
   each showing the hero lit in the path's colours, the typing it lands on (a retype marked with what
   it loses), a rewire ribbon, and its two grants as medallions. A tap opens the **showcase**, which
   replaced the dossier sheet: the hero on rays, arrows and a swipe to page between the three, the
   full detail under it, and the Evolve button pinned at the bottom. The awakening and the evolve
   cinematic are unchanged (`src/view/run/EvolutionScreen.tsx`).
6. **Long-term, filed not scheduled:** a new sprite for each Evolution form (252), keyed by path id.

## 8. Converting a hero

- **Keep every path's name and id** (a star is keyed on the id). Rewrite its `description` to the
  two things it now is, in the same voice: one sentence, flavour first.
- **Assign the three pairs by identity.** Most paths already hold two or three of the verbs;
  keep the two that make the path what it is, and move or drop the third. A path that was mostly
  a stat line needs its verb found: that is the design work.
- **Type + Move:** the move is of the grafted type (it colours the path) and is not already in
  the hero's pool. **Type + Passive:** a different graft from the other type path.
  **Move + Passive:** keeps the typing; a Mid or Late move worth a path, off the hero's own pool.
- **Lines:** a graft's `learnableMoveIds` is `evolutionLine(heroId, graft, { granted })`; a
  rewire's is `evolutionLine(heroId, primary, { swapped: true, granted })`; any other path has
  none. `statGrants: {}` on every path.
- **Passives are verbs** from the existing vocabulary (`PassiveDefinition`, `src/engine/content.ts`:
  hooks, conditions, effects, damage modifiers, conditional grants), never a bare `statGrants`
  card. Flat magnitudes (a passive has no move to take STAB from), stat deltas in multiples of 5,
  Burn and Renew in percent of max HP. Sized as an Evolution, above an innate's narrow band.
  Never a restatement of the hero's own innate. A design that needs an engine verb that does not
  exist is set aside and reported, not built inside the pass.
- **A rewire** only where the path's identity is a category flip (the old line traded Attack and
  Intelligence against each other). Pin it in `REWIRES`, and apply §5's rule to the innate.

## 9. What the roster pass found (2026-09-29)

Converted in seven parallel groups of two types, then reviewed as one catalog. **123 new path
passives** (`src/data/evolutionPassives/`), **9 rewires** (pinned in the test's `REWIRES`), and
three kept-pairing paths for the duals: Brimstone's Cauldronborn (Eclipse), Bellows' Redline
(Juggernaut), Coil's Mesmer (Brain Flay). Each rewired hero whose innate read the traded stat
now reads both: Kindling, Pack Hunter and their mastered forms, and Reverie's Neuroplastic+.

**Fixed in review.** An id collision (Carillon's and Keen's `deathKnell`: the spread kept one card
for both paths), three word-for-word duplicate cards written independently by different groups,
and two dead cards that granted Ambush on the holder's own hit (the move that landed it spends it).
Both failure shapes are now pinned by `test/evolutionPassives.test.ts`.

**Engine limits every group ran into** (verbs set aside, not built — candidates for a later pass):
- **Passive-caused events don't trigger other passives.** A Burn, Freeze, Shield or Renew a
  passive applies never fires "whenever this hero Burns/Freezes/Shields" cards; only a move's
  rider does. Several cards read narrower in play than on paper because of it.
- **No effect target reaches the attacker.** Every group wanted a true counter-hit.
- **`Healed` fires only on heal moves and drains**, not on Renew ticks or passive heals.
- Also wanted: a "both allies" passive target, a MoveUsed condition on the move's type, a
  condition on the holder's own statuses, a KO hook for an ally falling, and a "plant after the
  burst" order for Conduct.

**Watch in play.**
- **Mana income.** About a dozen cards pay mana past the pool: Stored Charge, Tithe, Blade
  Channel, Apogee, Death Knell (Keen), Storm Drinker, Moonwell, Runic Ward, Overspill,
  Mainspring. This cuts against the 2026-09-28 reshape that made the pool scarce again, and the
  sim can't see mana.
- **Stacking ramps.** Glitter and Spirit Pack pay the partner every round.
- **Proc-heavy verbs.** 25–30% Daze or Freeze on hit (Shriek, Footlights, Winter's Weight),
  Bleed on every Water hit (Snapping Jaw), and Updraft's partner priority.
- **Off-type moves on mono paths.** Many heroes' own pools already held every fitting same-type
  Mid/Late move, so Move + Passive paths often hand over an off-type move (Crimson's Landslide,
  Flurry's Landslide, Drake's Juggernaut). That's legal under off-type policy. Flurry's case
  could be fixed by moving Avalanche out of her pool so the path can grant it.
- **Rewired heroes keep their old pool.** A rewired hero's level-up pool still offers the
  column it left. Off-stat moves are a normal pick, so this is left as is.
