# The Academy

**Decided and built 2026-10-09, per user direction.** The Class beat leaves the Guardian and goes
onto the map. It replaces the Crucible of `docs/growth-overhaul.md` §11.

## What changed

- **The Crucible is gone from the post-Guardian chain.** A Guardian now pays the fight's own spoils,
  the Banner, the contract claim and the Pact Seal — nothing after the Banner asks the player to
  pick a hero.
- **The Academy is a forced single-tile row every act**, right after the Elite-or-Skirmish fork
  (`ACADEMY_ROW` = 6, `src/run/map.ts`). The act is ten rows: Fight, reward, Mentor/Tutor, reward,
  the Lapidary, the fork, **the Academy**, reward, the Guild Hall, the Guardian. `academyReward`
  is absent from `REWARD_WEIGHTS`, so this row is its only seat.
- **Same grant, Classes first.** The three Classes rolled from the whole catalog
  (`rollClassOffers`) are shown on landing, each readable with a hold, over a **Who can learn**
  strip of the roster: a hero with no Class lit, one with a Class dimmed and wearing its mark. Pick
  a Class, then the hero — each card shows the Class move at that hero's type — and the hero's tap
  commits. One Class a hero, a move or a passive, never a stat line. Non-bankable.
- **The way back is one step earlier** (2026-10-09, per user direction): from the hero grid to the
  Classes, where nothing has been granted. The Crucible's order (hero, then Class, no way back)
  left the player committing to a hero before seeing what it would learn.
- **A building, not a keeper** (per user direction: "more epic than a schoolhouse"): a spired
  college on a crag, 96px at 2x like the Guild Hall (`art/map-nodes/landmarks/academy.png`,
  landmark kind `building`, `BUILDING_ART` in `mapLandmarks.tsx`). The screen keeps the keeper
  header's shape with the castle in the figure's seat, one of `ACADEMY_LINES` in the voice line,
  then the three Class cards, the hero grid and the reveal (`AcademyNodeScreen`). The node colour
  and icon glyph are laurel (`#b8c95a`) and a mortarboard. Rejected rolls (a schoolmistress, two
  schoolhouses, a second castle) are in `art/concepts/academy/`.

## Why

The fiction did not hold (a Guardian's death teaching one hero a discipline), and the beat sat in
the longest chain in the run, between the Banner and the Pact Seal, where it read as an
interruption. Moving it onto the Mastery track was weighed and set aside: it would make Classes
universal (four a run → six), hand them to enemies through `masteryForAct` (whose AI never
switches, so Vanish is dead there), and crowd a track whose appeal is "5 and 10".

## What it moves

- **Count unchanged:** four Classes a run, one an act. The fourth now arrives with half of Act 4
  left instead of only the finale.
- **Act 1 was expected to get stronger** (the first Class lands before the Act 1 Guardian) and
  **measured flat**. 1000 runs, seed 1, against HEAD before the change (`resolveAcademy`,
  `scripts/sim/run.ts`):

  | Pilot | Act 1 clear | Full clear |
  |---|---|---|
  | skilled | 95.8 → 96.0% | 74.9 → 76.7% |
  | chart | 83.4 → 83.1% | 22.9 → 25.4% |

  The full-clear lift sits in Acts 3–5 (the fourth Class has an act to work in) and is inside
  about two standard errors at this sample; read it as neutral-to-slight.
- **A Guardian recruit waits.** A hero claimed off a Guardian used to walk straight into the
  Crucible; now it waits for the next act's Academy.
- **Saves:** a run saved on the old `crucible` screen resumes on what followed it; the Class is
  forfeit (`decodeScreen`, `src/run/resume.ts`).

