# Enemy intent — a draft

**Status: DRAFT, behind the Dev menu (🧪 Enemy intent), off by default.** Built 2026-10-15 per user
direction to see what the middle ground looks like; not decided.

## What it shows

Over each of the player's heroes, the face of every enemy whose move this round would land on it,
ringed in the enemy's red, sitting on the horizon between the two rows. **Who, never what.** A move
aimed at the enemy's own side, a switch and a Rest show nothing; a random-target move marks every
hero it might pick.

The reference is Into the Breach's attack arrows rather than Slay the Spire's intent icons: the
target is told, the weapon is not.

## Why it can be exact

The AI picks against the board as it stands before the round (`run/ai.ts pickAiAction`), seeded
per combatant and round (`derivedRandom`), and never reads the player's commands — the Trials'
pilot is deterministic too. So the preview calls the same `planAiActions` the round resolves with,
and is recomputed if the board changes during the command phase (a potion). What it shows is what
happens.

## What to watch in play

- **Prediction.** Doubles is a read: does the enemy take the obvious hit or cover it. Knowing the
  target removes half that read. Whether the half left (which move) is enough is the question.
- **Switching.** A marked hero switched out is a free dodge. Single-target moves already retarget
  onto whoever takes the slot, so the switch-in eats the hit — that may be the counterweight.
- **Focus fire becomes legible.** Two faces over one hero says "this one dies this round" — the
  strongest thing the draft says, and possibly too strong.
- **Free enabler.** If always-on is too much, it can cost something: a Class verb or a move that
  reveals the round's aims, rather than a standing rule.

Not shown in Versus (a friend is not an AI).
