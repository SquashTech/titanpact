# stories.md — Stories: the guided mode and the front door

> **STATUS: DIRECTION DECIDED, NOTHING BUILT (2026-10-17, per user direction).** The shape of the
> mode and the prologue's beats are decided. Names, numbers, the chapter list past chapter 2 and
> every open question in §8 are not.

---

## 0. Why

Stories are short runs with a **predetermined team**, each one telling a complete story about one
hero across the five Titan Cycles. They do two jobs:

- **Onboarding.** The first run used to be the whole roguelike: dozens of heroes, a draft, a map.
  Stories bring in types and mechanics a chapter at a time, with a team the player didn't have to
  pick.
- **The trademark mode.** A Story's heroes are the multiverse's canonical telling. In Stories a
  hero is *changed* by events that never touch it in Classic, where it's just a hero.

Reference: Pokémon's story is the onboarding and the Battle Tower / VGC is where players end up.
Darkest Dungeon's Hamlet opening is the shape of the prologue: a short scripted expedition, then
the real game.

## 1. Why the Valor-narrated Act 1 was deleted, and what Stories does differently

The scripted Act 1 (deleted 2026-09-24) failed for two reasons, per user direction:

1. **Valor talked to the player.** The lines were diegetic in voice but were really mechanical
   tutorials. **In Stories the characters talk to each other**, about the job, the family, the
   blade. The teaching is in the screen: the line gives a reason, the UI lights the one button, and
   nobody explains a rule. The tips rule stands (never a hero speaking, never "we").
2. **It ran straight into an ordinary run.** **A Story chapter ends**: one finished short story,
   then back to the title to pick the next chapter or another mode.

**Dialogue stays light.** It's just enough to give the characters a backstory and a personality.
A player who isn't interested in the story must never feel held hostage by it.

## 2. The shape

- A **Story** follows one hero (or one pairing) through the five Cycles. Each **chapter** is a
  mini-run: the same grammar as Classic (fights, pick-1-of-3 map rows, levels), but with
  **scripted party members** in place of the draft and recruiting.
- The first chapters are **tutorials**: short, deterministic (§5), and each one introduces a
  mechanic or a type. Later chapters loosen up until a chapter plays like a Classic run.
- **The first Story is Valor and Fang's.** Its prologue is what the first press of the game plays.

## 3. The cast of the first Story

| Who | What | Notes |
|---|---|---|
| **Valor** | The lead. A monster hunter's daughter who hasn't been allowed the blade | Prologue Valor is **swordless**: a new sprite, fighting with Iron Fist. The sword is something she gains. |
| **Fang** | Valor's wolf; the two of them are a pairing | Doesn't speak; reacts through animation. |
| **Ren, the Swordsman** | Valor's father, the family's master of the blade | **Playable in Stories** (§6). |
| **Valor's younger brother** | Already being trained, which Valor resents | Name and type open (§8). |
| **The Endbringer** | The Titan's Herald | **Arrives before the Titan** (§4). |

## 4. Chapter 1: the prologue (decided beats)

About 10–12 minutes, two fights.

1. **Scene: Wild's Edge.** The family is out on a monster-hunting job. They split up to find the
   target. Valor and Fang walk together; Valor is angry that her father won't train her with the
   blade when her younger brother is already learning.
2. **Fight 1: Valor and Fang against weak wildlife** (2v2). Every action is guided. It teaches
   choosing a move, choosing a target, and a round resolving. The enemies are **diegetic creatures,
   not heroes** (§7).
3. **Level up.** After the first win, Valor and Fang each gain **+1 level** on the victory screen.
   That's the first look at levelling.
4. **Scene: Ren and the brother.** A short exchange of their own, then **the Endbringer**. They
   know at once to run. *(Proposed: a cutscene, not a fight, so the prologue stays at two fights
   and the Endbringer's first appearance belongs to the art.)*
5. **The family regroups.** Ren warns Valor not to fight it. She refuses.
6. **Fight 2: all four against the Endbringer.** This is the first bench, so it teaches switching.
   **It can be won.** When the Endbringer hits zero it **doesn't die.**
7. **The Titan falls.** The Endbringer rises, **powered up**, and takes the brother. He drops his
   sword. Valor picks it up as the family runs. End of the prologue; back to the title.

The image the chapter is built around: **Valor gets the blade she wanted, at the worst possible
price, by ignoring her father.**

**Lore, decided:** *the Herald comes before the Titan*, the way the Silver Surfer comes before
Galactus. It strengthens the lore rather than contradicting it (`lore.md` "The fall").

**A rhyme worth keeping:** in the finale, the Titan rises over the fight as the Herald falls
(`TitanRiseScreen`). The prologue's second fight ends on the same beat, so the game's first boss
fight and its last share a shape.

## 5. Tutorial fights are deterministic

Decided: **the first couple of chapters play out identically every time**: no crits, the same
numbers. They still *look* like a normal fight, with damage ranges on the tiles and HP bars
draining as usual, but the outcome is fixed.

Proposed implementation, the cheapest that gets there, keeping the engine pure and the content as
data:

- **Enemy commands come from an encounter script** (data), not the AI.
- **Player commands are guided**: the view lights only the scripted button. The engine just
  receives a command, as always.
- **A fixed RNG seed.** Variance stays in the formula (it's load-bearing) and rolls the same every
  time. Prologue heroes wear no gear, so there's no crit source to begin with.
- **"Doesn't die at zero" and "ends at the fall" are encounter-script triggers** the engine
  understands, not code special-cased to the Endbringer.
- Authored per-hit damage is the fallback, used only if seed plus script can't hold a beat.
  Scripted values must stay inside the range the tile shows.

## 6. Ren

Decided: Ren is **the Swordsman** patron. **He is playable in Stories**, and later **unlockable as
a normal hero** through achievement hunting (`patron-heroes.md` §6 carries the options for that
layer).

This **makes Stories a named exception to `patrons.md` rule 13** ("a patron never stands on a
fight stage"). The rule's Hades reasoning (gods only ever appear as portraits) no longer fully
holds: a player who started with Stories meets Ren as a fighter first and a patron second.
`patron-heroes.md` §0 and §5 cover the rest (his type, and a patron on your roster).

## 7. Diegetic creatures

Decided: the Story fights use **creatures that are not heroes**. They're not in the deck, never
contracted, never drafted, and outside the 550 budget's purpose, in the way Titanspawn lines
already sit apart. They're needed because **nothing the Titan turned exists before the fall**, so
the prologue's wildlife can't be Titanspawn. A first set for Wild's Edge is to be designed.

## 8. Proposed and open — DO NOT silently resolve

- **The chapter curriculum.** Decided: chapter 2 teaches **the map, rewards and items**. Past it,
  proposed: the type chart, mana and Rest, statuses, fields, the Guardian and its Banner, Evolution,
  Gems, Classes, patrons. Roughly one idea a chapter, and the party grows as the mechanics do.
- **How many chapters a Cycle**, and how long a Cycle-V chapter runs.
- **The brother's name and type.** Proposed: the brother, not Ren, is who the Titan holds, which
  makes him the Story's **Cycle II Warden**: the family's first real fight against the Titan is
  against their own boy. That leaves Ren free to be Valor's teacher, with the patron ladder's rung-5
  blade as the moment he finally gives her the sword.
- **Fang's death at the midpoint (Cycle III)**, and whether Cycle V's freed Wardens bring Fang back
  for one last fight (keeping the grief) or for good (spending it). Proposed path: a Story-only
  Evolution where Valor grafts Beast.
- **The existing first-press fall** (`TitanFallScreen` and its lore crawl, 2026-10-14). The prologue
  plays the fall from the ground. Does it replace the first-press beat, follow it, or fold the crawl
  into its end card?
- **What the title offers after the prologue.** The user's direction says "the next part of Valor's
  story, or some other mode". Does Classic open at once? The Trials and the Gauntlet still open on a
  Cycle I clear?
- **Do Story clears seat Wardens?** `cycles.md` makes the account's first Cycle I winners its
  Wardens forever. A Story's Cycle I win would make them scripted. Either Story clears don't count,
  or a Story has canonical Wardens of its own.
- **Failure in a Story chapter.** Retry the chapter, or (past the tutorials) make the loss a scene,
  the way Hades does.
- **Art:** swordless Valor, the brother, Ren as a fighter, the creatures, and the fall seen from the
  ground.

## 9. What it reverses

- **"The first run on an account is an ordinary run, nothing staged"** (CLAUDE.md, 2026-09-24): the
  first press now plays the Story prologue. The reasons that run was deleted (§1) are what this mode
  is designed against.
- **`patrons.md` rule 13**, in Stories (§6).
