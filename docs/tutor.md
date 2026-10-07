# The Tutor — pick any move

**Decided and BUILT 2026-10-07, per user direction** (the third of three changes after
`docs/gems.md` and `docs/mentor.md`). Act 4's forced Tutor stops rolling a Late move and becomes
**a pick of any move the hero can learn and does not hold**.

Code: `tutorMovePool` in `src/run/tutor.ts`, `src/view/run/TutorNodeScreen.tsx`.

## Why now

A curated pick was tried before and rejected as a designer's screen and the run's longest. Two
things changed. The Mentor no longer hands out moves, so the Tutor is the run's one aimed move. And
by Act 4 the player knows the kit and what it is missing. The Tutor is where that last hole gets
filled.

## The screen

Pick a hero (each card counts its Late moves and the total). Then the move list, the same tiles
Constructed uses, banded **Late → Mid → Early**. A tap selects, a hold reads the move, **Teach**
commits, and a back button returns to the heroes. Below the move cap the move simply lands. At
the cap the usual replace-or-decline is asked, and **declining there returns to the list**
instead of spending the Tutor.

## The pool

The starting kit, the level-up pool, and every chosen path's moves (granted and learnable), minus
what the hero holds. **A move once offered and declined is not burned here**, because this is a
pick, not a roll. A starting move swapped away can be learned back. Never a signature, never a
Class move: neither is on any of those lists (pinned by `test/mastery.test.ts`,
`test/classes.test.ts`).

## Measured

600 runs a side, seed 7, MVP on, against the Mentor commit: full-clear 82.8 → 81.5% skilled, 34.2 →
34.7% chart. That is noise. The sim takes the highest-valued move anyone can learn.

## Reverses

"The Tutor: one guaranteed seat in act 4 … one Late-tier move is ROLLED" (CLAUDE.md). The seat
stays. The roll does not.
