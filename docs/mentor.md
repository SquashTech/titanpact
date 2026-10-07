# The Mentor — Rare Candy

**Decided and BUILT 2026-10-07, per user direction** (the second of three changes after
`docs/gems.md`). The Mentor stops rolling a Mid move and **pays XP to one hero**, more each act.

Code: `src/run/mentor.ts`, `src/view/run/MentorNodeScreen.tsx`, `applySeededXp` in `src/run/growth.ts`.

## Why

XP was fully deterministic: nothing the player did aimed it (the Elite's ×1.5 is roster-wide). The
Mentor is the aimed faucet. **XP, never a level**: a +1 level grant is wasted on a hero one point
short of its next level, and XP is not.

## The grant

| Act | XP | A hero at par (Lv 5 / 10 / 15) goes to |
|---|---|---|
| 1 | 800 | 9 |
| 2 | 3,000 | 15 |
| 3 | 6,000 | 21 |

`MENTOR_XP_BY_ACT`. The cube does the rest: the same XP lifts a hero behind par further (a late hire
is the natural target). Levels pay what levels pay — growth rolls on the screen, then any schedule
offer or signature the levels reach on the level-up screen after (App routes it). A hero at the XP
cap cannot be picked. Act 4's seat stays the Tutor.

## The level-30 budget

Par before the finale is ~14,100 XP (Lv 24); the cap is 27,000. `test/mentor.test.ts` pins:

- all three Mentors on one hero → Lv 28, short of the cap;
- **+ every Elite + one MVP an act in Acts 2–4 → Lv 30.**

So the cap is a committed plan, not the default.

## Measured

600 runs a side, seed 7, MVP on, against the Gems commit: full-clear 81.8 → 82.8% skilled, 34.0 →
34.2% chart; mean roster level at the end +1.1. The sim aims at the lowest-levelled hero.

## Reverses

"The Mentor teaches any hero a powerful move" (CLAUDE.md): the Mid roll is deleted, and with it the
only way to a Mid move ahead of its schedule. The Mentor reaches the schedule sooner instead.

## Open

- The Act 2 grant is +5 levels at par — the spike is the point; watch whether it reads as too much.
- Levels 25–30 buy growth rolls and nothing else; the cap is a trophy unless something lives there.
