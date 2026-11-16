# Danger sense

**Decided and built 2026-11-16, per user direction.** It replaces the enemy-intent draft of
2026-10-15 (the faces of every enemy aiming at a hero, behind the Dev menu), which is deleted.

## What it shows

At the start of the command phase, a hero of the player's that an enemy's declared move this round
would hit **super effectively (×2 or more)** shudders once, again every few seconds, over a red rim
on its platform. Nothing else: never which enemy, never which move. A hero not shuddering has
nothing super effective aimed at it this round, and that is information too.

It exists so a player can see the round's danger without a chart lookup, and answer it: switch the
hero out, protect it, or knock the attacker out before it moves. The reference is Pokémon's
Anticipation, narrowed from "the foe holds a super effective move" to "one is coming at you now".

## Why it is exact

The AI plans against the board as it stands before the round (`run/ai.ts pickAiAction`), seeded per
combatant and round (`derivedRandom`), and never reads the player's commands. The sense reads the
same `planAiActions` the round resolves with (`view/combat/dangerSense.ts`), at the same type
multiplier the damage lands at (`effectivenessAgainst`, so Downpour counts). A move's type is read
off its caster (`moveForHero`). A spread move marks only the heroes it hits super effectively; a
random-target move marks every hero it might pick.

Not shown in Versus (a friend is not an AI). The engine is untouched: it is a read in the view.

## Enemy kits are hidden

Decided the same day: **an enemy's moves are never listed.** The in-fight hero sheet drops its
Moves page for an enemy (`HeroDetailOverlay hideMoves`); a move is learned by watching it cast, and
is not kept on the sheet afterwards (a Pokémon-style reveal of moves seen was offered and declined).

## What to watch in play

- **The switch is reliable.** The AI never plays around the sense. A single-target hit lands on
  whoever takes the slot, so the switch-in eats it: switching into a resist is the play, switching
  into another weak hero is not.
- **Silence is a read.** A hero with no shudder is safe from a super effective hit this round.
- **A random-target move** can shudder a hero it then misses.
