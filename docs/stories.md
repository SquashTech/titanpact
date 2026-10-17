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
- **The brother's name and type** (proposal in §12). Proposed: the brother, not Ren, is who the Titan holds, which
  makes him the Story's **Cycle II Warden**: the family's first real fight against the Titan is
  against their own boy. That leaves Ren free to be Valor's teacher, with the patron ladder's rung-5
  blade as the moment he finally gives her the sword.
- **Fang's death at the midpoint (Cycle III)**, and whether Cycle V's freed Wardens bring Fang back
  for one last fight (keeping the grief) or for good (spending it). Proposed path: a Story-only
  Evolution where Valor grafts Beast.
- **The existing first-press fall** (`TitanFallScreen` and its lore crawl, 2026-10-14). The prologue
  plays the fall from the ground. Does it replace the first-press beat, follow it, or fold the crawl
  into its end card?
- **What the title offers after the prologue.** Seal the Pact opens the Story select (§10). Does
  its Classic button appear at once? The Trials and the Gauntlet still open on a Cycle I clear?
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

---

## 10. The Story select (UI)

**Decided (2026-10-17, per user direction):** once the prologue is done, **Seal the Pact opens a
screen of every available Story as a big button**, each showing its progress, plus a way into a
Classic run. The Trials and the Gauntlet keep their own doors on the title.

**Proposed:**

- **Before the prologue is done there is no screen.** The first press plays the prologue directly.
- **A Story button** is the protagonist's art, the Story's name, and **the next chapter's title**
  as the only other words. Progress is a quiet mark, not a tally: **five Cycle pips** (lit by
  colour as each Cycle's chapters are cleared, the colours stars already use). Never "3 of 12
  chapters".
- **One tap continues.** The big button starts the next chapter, so the usual case is one decision.
  Replaying a cleared chapter lives a level down: a chapter timeline across the five Cycles, opened
  from a smaller control on the button. Reference: Hearthstone's Book of Heroes (a book a hero,
  chapters inside); Dicey Dungeons' episode select.
- **The Classic button** carries the Cycle picker it already has and no story art. It sits last,
  or first once Stories are done.
- **Locked Stories show as silhouettes**: art in shadow and the name, with no condition text. The
  condition is explained at the moment it's met.

**What to call Classic.** It's the player's own timeline: their deck, their draft, no canonical
hero. Candidates:

1. **Pactbearer.** The lore's own word for the role, and "a role, not a person" (`lore.md`) is
   exactly what Classic is set against the Stories' named heroes. Recommended.
2. **Your Pact.** Plainer, and reads well next to "Stories".
3. **Classic.** Clear, but names a mode against a history the player doesn't have.

**Other screens Stories needs:**

- **The scene player.** Figures on the location's backdrop, one short line a tap, the speaker's
  figure stepping forward. **Skip is always one tap**, for the player who isn't here for the story,
  and a skipped scene leaves one line saying what happened, so a chapter still makes sense.
- **The guided-fight layer.** Only the scripted button is live; it's lit and the rest are dimmed.
  The line that motivates it plays over the stage, with no tooltip.
- **The chapter end card.** The chapter's name, one closing image, back to the Story select.

## 11. Chapter 2 (PROPOSED)

Teaches **the map, rewards and items** (decided). Proposed story: Valor, Fang and Ren follow the
Endbringer's trail out of Wild's Edge to get the brother back. Valor carries his sword; Ren won't
teach her to use it.

- **The party is three:** Valor, Fang and Ren. This is the first time Ren is playable, and three
  heroes means a real bench.
- **The first item is the brother's sword.** The chapter opens on the item who-screen with that one
  piece, so the socket is taught on an object the story has already made matter.
- **The map is one short act:** fight → a pick-1-of-3 row → fight → a row → the chapter's last fight.
  The rows carry an item, a potion and a Rest, so each kind of reward gets seen once.
- **The world changes.** The chapter's enemies are **the first Titanspawn**: the land the Titan
  touched, turning. The prologue's wildlife was the world before; this is *"It spread into
  everything it touched"* happening to the place the player just learned to fight in.
- **The ending beat:** Ren relents. *If you're carrying his sword, carry it properly.* That opens
  the patron ladder, which chapter 3 would teach.

**The tension to settle:** a map row is a real choice, so the fights after it can't be identical on
every play. Proposed: chapter 2 keeps a fixed seed and scripted enemies, but the player's commands
are free (guided only the first time something new appears), and its numbers may vary. Which makes
chapter 1 the only fully deterministic chapter, against "the first couple" in §5.

## 12. Valor's brother (PROPOSED)

- **Name: Ward** (recommended). The family names its children for what Ren hopes they'll be, Valor
  included, and the boy the Titan takes ends up its **Warden**. Alternatives: Earnest, Constant.
- **Type: Storm.** He's trained in Ren's own style (Gale Sever, the cut that moves the air), so
  **Ren is Storm too**, which settles `patron-heroes.md`'s "no obvious home" without a second Iron
  swordsman beside Ronin. **Valor is Iron**: the daughter who taught herself is the steel, not her
  father's wind. The family resemblance is a type chart.
- **Across the Cycles:** taken in the prologue; in Cycle II he's the Warden the Titan holds, Storm
  with **Ancient grafted** into his secondary slot (the curse precedent makes a turned typing
  possible), and the family fights its own boy. Cycle V frees him with the rest of the Wardens.

## 13. More Stories

Decided (per user direction): more Stories with new protagonists unlock over time, and **they can
go in wildly different directions**.

**Proposed principle: each Story tells itself through its protagonist's domain.** The way a Story
is told, both its scene grammar and its one Story-only rule, comes from who it's about, so no two
Stories feel the same. Valor's is spoken family drama: people arguing out loud.

**Drift's Story (direction).** Drift, the psychic jellyfish (Mind), **can't speak**, but thinks
deeply, and his thoughts are internalised as he meets new characters.

- **His lines are thoughts, never speech:** no speech box, no nameplate. A different line kind in
  the scene data (`say` / `think`), drawn as drifting text near his figure.
- **He hears what others don't say.** When Drift is near a character, their thoughts surface next to
  their spoken line, sometimes agreeing with it and sometimes not. That's Mind as "the domain a
  hero's power draws from", told as story.
- **The Story-only rule could be the same idea in a fight:** Drift's chapters show the enemy's
  commands before the player declares (Mind reads intent). It also teaches the telegraph grammar
  the companion's ! already uses.

**Open:** what unlocks a new Story (a chapter of another one, a Cycle clear, an achievement), and
whether a Story's protagonist must be owned in the Collection.
