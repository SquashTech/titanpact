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

## 1b. How a chapter is told (2026-10-18, per user direction)

- **Valor's memories frame every chapter.** Each one opens on a `memory` beat: Valor, later, telling
  it ("When it all started, we were out on a hunt. It was the first time Father let Will come with
  us."), her lines typed over the chapter's place faded like an old picture. It gives the prologue
  the context it started without, and each later chapter its *why now*. This is narration, not
  instruction: the tutorial voice §1 rejected stays rejected.
- **The place's music plays under the Story.** A scene or memory sets the chapter's place
  (`onPlace`), so its track plays (Wild's Edge for the prologue) and its fights stand in its arena.
  The Titan's fall plays in silence. The user may write a Story-specific piece later.
- **Lines type out with a voice under them.** A character at a time, a blip every second character,
  in the speaker's timbre and pitch (`StoryActor.voice`; `voice.bright` / `warm` / `deep` in
  audio/sounds.ts): Valor bright, Will brighter and higher, Ren deep, Solace warm, Valor remembering
  a little lower than herself. Narration, Fang and the Faceless type in silence. A tap finishes a line
  still typing; the next tap moves on. Reduced motion shows lines whole.
- **Fang has his moments.** A line can carry a sound (`StoryLine.sound`, `StoryCue.sound`): Fang
  barks when the hunt sets out and again at the first fight's call, howls at the empty sky after
  Will is taken, and howls north at the end of chapter 3. `wolf.bark` and `wolf.howl` are
  procedural like every other sound in the game: first passes, to be judged by ear.

- **Scenes are staged, not a row** (2026-10-18, per user direction). A scene can place its cast (`stage`: `x` across the ground, `depth` into it, far figures higher and smaller and behind) and any line can move someone (`moves`: a step, a retreat, an entrance, an exit), so the scene acts out what the lines say: Ren and Will walk off on the hunt, the Faceless appears far back and comes closer, Valor steps out between it and her family, Will is taken off with it, Solace walks in out of the trees. Everyone faces whoever is speaking, the speaker the nearest other. A scene with no staging fans each side out with staggered depths (`autoStage`). An actor can be drawn larger (`scale`: the risen Endbringer towers).

## 1c. Teaching the controls (2026-10-18, per user direction)

**The prologue is A Tale of Valor's chapter 1 of 5** (Cycle I plans five, `plannedChapters`): the
Story select marks those five chapters, built or not, and each end card names its chapter number.

**Some explanation of how to play is necessary** to make sure every player learns the exact
controls, without becoming overbearing. A Story fight's cue can carry a **control tip**
(`StoryCue.tip`), shown once an account at the top of that round's command phase, the moment the
control is first needed, with what it names lit on the live board (`view/run/tipStaging.ts`). This
brings tips back that the 2026-10-13 cut removed, but only inside the prologue's guided fights.

| Fight | Round | Tip | Lights |
|---|---|---|---|
| The hunt | 1 | **Choosing a Move**: tap the move, then the enemy it hits | the guided move, then the foes |
| The hunt | 2 | **The Round**: Speed order along the top; health, Mana, a move's cost | the order track, then the bars |
| The clearing | 1 | **Reading a Foe**: tap any hero to read them | the Faceless |
| The clearing | 2 | **Switching**: the one coming in doesn't act; the bench regains Mana | the Switch key, then the bars |
| The clearing | 4 | **Rest**: no Mana for any move, so Rest skips the turn and refills it | the Rest row |

The bench and item tips still fire where they belong, in chapter 2's act. The general round tip
(`fight.basics`) is marked seen when chapter 1 ends, since its first two tips say the same.
**Not yet taught anywhere:** the Bag (potions as a free action), the matchup arrows on a move, and
holding a move to read it.

## 2. The shape

- A **Story** follows one hero (or one pairing) through the five Cycles. Each **chapter** is a
  mini-run: the same grammar as Classic (fights, pick-1-of-3 map rows, levels), but with
  **scripted party members** in place of the draft and recruiting.
- The first chapters are **tutorials**: short, deterministic (§5), and each one introduces a
  mechanic or a type.
- **Classic Mode is the main way to play long-term; Stories are a cinematic onboarding**
  (2026-10-18, per user direction). **Every chapter is short and none is a full run.** This replaces
  "later chapters loosen up until a chapter plays like a Classic run".
- **The first Story is Valor and Fang's, *A Tale of Valor*.** Its prologue is what the first press
  of the game plays.

**Proposed: later chapters are paced by Classic.** A five-Cycle arc told in short chapters works best
if the chapters past the tutorials unlock off Classic milestones. For example, A Tale of Valor's
Cycle II chapter opens the first time the player reaches Cycle II in Classic. Classic stays the
spine, and the Story arrives as a cinematic between runs, the way Hades tells its story between
escapes. It also means a chapter set in a Cycle is only played by someone who has seen that Cycle.

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
- **The first-press fall: DECIDED 2026-10-18 (per user direction).** The prologue replaces it, and the
  fall happens during the prologue: a `fall` beat plays `TitanFallScreen` with the scene's own lines
  after the clearing fight, and marks the lore seen. Classic no longer plays the fall or the Cycle I
  lore card before its first draft (a later Cycle's card still plays), and the title's press no
  longer fades into a fall.
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
screen of every available Story**, each showing its progress, plus a way into a Classic run. The
Trials and the Gauntlet keep their own doors on the title.

**The layout is the featured book, painted** (picked off `art/concepts/story-select/`, per user
direction):

- **Each Story has one painted key-art banner**, made in PixelLab from its heroes' own sprites
  (A Tale of Valor's is `valor-tall-*.png` there). The selected Story fills the top half with it.
- **A shelf of covers below holds every Story and Classic Mode side by side.** A cover is a crop of
  the same painting. **Classic is one of the options on the shelf**, so it reads as the other way to
  play, not as a footnote.
- **The confirm plate is along the bottom**, not in the middle of the art. It names what it does
  for what is selected: Continue, Begin, or Seal the Pact for Classic.
- **Progress is a quiet mark, not a tally:** five Cycle pips in the star colours under the title
  and on each cover. Classic's pips are its Cycles. Never "3 of 12 chapters".
- **Locked Stories show as silhouettes**, with no condition text. The condition is explained at the
  moment it's met.

**Proposed:**

- **Before the prologue is done there is no screen.** The first press plays the prologue directly.
- **The Story last played is selected on arrival**, so the usual case is still one tap, on the
  plate. Selecting from the shelf then confirming is two taps, and only when the player is switching.
- Replaying a cleared chapter lives a level down: a chapter timeline across the five Cycles, opened
  from the featured Story. Reference: Hearthstone's Book of Heroes.
- **Classic needs a painting of its own.** The mock uses the night sky and a seal ring as a
  stand-in.

**What to call Classic.** The user's lean is **Classic Mode** ("or something"), which reads plainest
on a shelf of named Stories. Other candidates are still on the comparison page's toggle:
**Pactbearer** (the lore's word for the role), **Your Pact**.

**The first Story's name: A Tale of Valor** (decided 2026-10-17, per user direction). It's a pun on
her name and says what will happen. "The Hunter's Daughter" was dropped because Ren is the
Swordsman; the Huntress is Sable.

**Other screens Stories needs:**

- **The scene player.** Figures on the location's backdrop, one short line a tap, the speaker's
  figure stepping forward. **Skip is always one tap**, for the player who isn't here for the story,
  and a skipped scene leaves one line saying what happened, so a chapter still makes sense.
- **The guided-fight layer.** Only the scripted button is live; it's lit and the rest are dimmed.
  The line that motivates it plays over the stage, with no tooltip.
- **The chapter end card.** The chapter's name, one closing image, back to the Story select.

## 11. Chapter 2, His Sword (BUILT 2026-10-18; numbers first pass)

**Every chapter past the prologue is a single Act, never a full run** (2026-10-18, per user
direction), and each one layers in a few new mechanics. Chapter 2 teaches **the map, a pick from
three, items, levels and the Rest**.

- **Story:** the morning after, the river runs black and Ren sets out north after the faceless
  thing. Valor carries Will's sword; Ren won't teach her. At the end he watches her fight and
  relents: *If you're carrying his sword, carry it properly.* That opens the patron ladder for
  chapter 3.
- **The party:** Valor (the roster's own, sword and all, level 4), Fang (4), Ren (6). Three heroes,
  so the first bench.
- **The act** (Wild's Edge, five rows): a Fight → Items / Rest / Boon → a Fight → Rest / Items /
  Mana Well → an Elite. The enemies are **the first Titanspawn**, the land turning: Cubling and
  Sproutling, then Rivetling, Cubling and Sproutling, then a Ravager leading Sproutling and
  Rivetling. The later two fights hold a third on the bench.
- **Every drop is authored** (per user direction, same day): each fight names its one item and each
  Items chest its three, all suited to the party (`test/story.test.ts` checks each piece grants a
  stat someone in the party uses). A Story act drops **no random Gem, Contract or flask**. The tips
  that fire are the ones that belong: the bench at the first lead pick, the item at the first gear.
  The round's tip is marked seen when the prologue ends.
- **Measured, directional** (skilled sim pilot vs the game's AI, 200 seeds a fight): the opener and
  the second fight are won in 2–3 rounds with the party almost untouched; the Elite takes ~5 rounds,
  leaves the party at ~67% and sometimes costs a hero. The player's levels and gear are the dial; the
  user tunes by playing.

The deterministic question in the earlier proposal is settled the simple way: only the prologue is
scripted round by round. From chapter 2 the fights are the player's.

**How an act plugs in** (`src/run/story.ts`): a chapter beat `{ kind: 'act', act }` hands the run's
own screens a hand-built map (`storyActMap`, every row fully connected), a fixed party
(`storyActRun`), each fight's authored enemies (`storyNodeEncounter`, the map's scouting reads the
same) and drops (`storyNodeSpec`). The run carries `RunState.story` back to its chapter: winning the
last row returns to the next beat, losing replays the act. **A Story act is never saved and never
touches the profile's run records**, so a parked Classic run is safe. No companion joins, no
contract is offered, no Banner is paid, and the arrival screen names the chapter instead of the act.

## 11b. Chapter 3, The Lesson (BUILT 2026-10-18; numbers first pass)

Teaches **types and the matchup arrows, Ren's patron seat, and the fork**, and brings in **the
party's first caster** (per user direction: a caster with new mechanics, and **an existing hero
rather than a new character**, 2026-10-18).

- **Story:** Ren starts teaching Valor before dawn: which turned things a blade can cut, and which it
  can't. In the Forbidden Forest they find **Solace**, a priest of the dawn whose chapel the turning
  swallowed. She comes north with them. At the end Solace knows a town to the east that hasn't
  fallen, which leads into chapter 4.
- **Solace** (the base roster's own, `dawnwarden`, decided 2026-10-18 per user direction): Light,
  Glimmer and Mend from her own kit plus Blind, and her innate Dawnlight. She is the party's first
  magical damage (against Wisdom, not Defense), first heal, first status (Blind Dazes) and first
  innate that isn't a fighter's. Light also hits the Frost Elite at the fork double. A player who
  finishes the Story already owns her in Classic.
- **The act** (Forbidden Forest, six rows): a Fight → Items / Rest / Boon → **Ren's seat** → **the
  fork** → Rest / Items / Mana Well → an Elite.
  - **The opener** is Sproutling and Whimling (Nature, Mind). Beast hits both double, so the lead
    pick's arrows say *lead with Fang*.
  - **Ren's seat** is the real patron screen: the Swordsman, his rung-1 line, a Rare Sword to Valor
    (preset as his student, `StoryAct.students`), Trust 1, Crescent Cut promised next time. A seat
    must sit on a patron row (`PATRON_ROWS`, rows 2 and 6); the test pins it.
  - **The fork is the type lesson.** The Elite is Hoarfang, Pebbling and Sleetling (Frost, Stone),
    a level above the party but Iron's prey. The Skirmish is Voltail and Gearhound (Storm, Mech), at
    level 5 but double against everyone. The preview shows it: the Elite's grid is green for the
    Iron pair and red for Fang, and the Skirmish's is red across the party.
  - **The last Elite** mixes it up (Bramblehide, Gearhound, Whimling), so leads have to be chosen
    on the matchups.
- **Story nodes get their own map card:** the authored enemy levels, XP, gold and one item, with
  no Gem, recruit or Contract line (`storyNodeDossier`).
- **Measured, directional** (skilled sim pilot, 200 seeds): the opener is won in ~2.5 rounds
  untouched; **the Elite at the fork wins 100% with ~79% HP left; the Skirmish wins 86% with ~40%
  left and ~2 heroes down**; the last Elite wins 99% with ~59% left (re-measured with Solace). A lost fight replays the whole
  act, so the Skirmish's level is the dial to watch in play.

## 12. Valor's brother, Will (name decided; the rest PROPOSED)

- **Name: Will** (decided 2026-10-17, per user direction). Valor and Will: a pair, and a normal
  boy's name.
- **Types, decided 2026-10-18 (per user direction): Will is Storm, Ren is Iron.** Ren is Iron by
  precedent: his patron cuts (Crescent Cut, Gale Sever) are authored Iron. Will is Storm, quick and
  light. Valor is Iron like her father. This replaces the proposal that Ren be Storm too. It leaves
  Ren a second Iron swordsman beside Ronin (`patron-heroes.md` §0), a tension that only bites once
  Ren is a draftable hero.
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

## 14. Building it for the alpha (PROPOSED, 2026-10-18)

**Alpha scope:** the two tutorial chapters (the prologue and chapter 2), the Story select with A
Tale of Valor and Classic Mode on the shelf, and the first-press flow. Later chapters are story
content, not onboarding, so they don't block the alpha.

What exists and what's missing (surveyed 2026-10-18):

- **Determinism is nearly free.** The engine replays identically for a fixed seed and fixed inputs
  (`seededRng.ts`; the AI reads `derivedRandom`). FightScreen just needs a seed prop; today only
  Versus passes one.
- **Missing engine vocabulary**, to add as data the engine understands, never Endbringer-specific
  code: scripted enemy commands per round (a choke point exists: FightScreen's `planAiActions`), an
  end-of-fight trigger (today only a wiped side ends a fight; `sideDefeated`), and "can't be knocked
  out" (today only finite `enduresOnce` stacks and a Blessing). The mid-fight cinematic hook already
  exists (`TitanRiseScreen` via `awaitingCinematic`), so the Titan's fall can play over fight 2.
- **Missing view pieces:** a live-button allowlist for guided input (TipOverlay's spotlights are
  emphasis only, and nothing restricts a button), an in-fight line overlay, and a scene player.
  The deleted tutorial's `TutorialOverlay` and cue system (`git show 65dbfe24~1:…`) are a starting
  point for the overlay.
- **Plumbing that's ready:** a fight outside a run is built like the Trials' (`constructedSide`, an
  `Encounter` pair into FightScreen). New screens join the `RunScreen` union (`resume.ts`) and
  App.tsx. Story progress is a new tolerant `Profile` field (`decodeProfile`). First press is gated
  on the `lore` tip today (`firstFall`).

**Order:**

1. **Engine and run: BUILT 2026-10-18.** `src/run/story.ts`: `StoryFight` (parties at fixed
   levels and kits, leads, a seed, `enemyScript` and `guide` as one command list a round, `endsWhen`),
   `storySides`, `scriptedEnemyActions`, `guidedAction`. Engine verbs: `FightEndTrigger` on
   `CombatState.endsWhen` (`afterRound`, `hpAtMost`) read by `fightWinner`, and the passive verb
   `cannotBeKnockedOut` (`Combatant.unbreakable`, held at 1 HP with an `Endured` beat, without
   limit). FightScreen takes `story` (seed, script, ends). `Profile.storyChaptersDone` and
   `recordStoryChapterDone`. `test/story.test.ts` replays a scripted fight to an identical event
   stream. Guided input is read by nothing yet: the view's lock is step 2.
2. **View: BUILT 2026-10-18.** `src/view/story/`: the scene player (`StoryScene`, one line a tap,
   the speaker stepping forward, Skip leaves the beat's `skipped` line), the end card, the Story
   select (`StorySelectScreen`, the painted featured book, Classic Mode on the shelf, the plate
   at the foot), and the chapter runner (`StoryChapterScreen`, a lost fight replayed from its
   start). FightScreen's guided round lights the one move and target and dims the rest
   (Switch, Rest, Bag), and a beat's `cues` put a line on the stage's horizon. **Seal the Pact
   with no run parked plays the prologue until it is done, then opens the Story select**; Classic
   Mode there starts a run exactly as the press used to (the fall, the draft). The chapter data is
   `src/data/stories.ts`, a DRAFT prologue with stand-ins (Gallant for Ren, Skyshear for Will,
   Pixie and Kitsu for the wildlife) until step 3. The banner is `art/stories/valor.png`
   (`valor-tall-2`, provisional). Not yet: the switch panel doesn't dim the unguided bench hero,
   the +1 level after the first fight isn't shown (story fights skip the result overlay), and the
   stand-ins' names show in the fight.
3. **Content: BUILT 2026-10-18.** `src/data/storyCast.ts`: prologue Valor (her line, Iron Fist and
   Fortify, no innate), **Ren** (Iron, by precedent: his patron cuts Crescent Cut and Gale Sever
   are authored Iron; on the 550), **Will** (Storm, as proposed; on the 550), the Wild's Edge
   creatures (Stag, Fox, Boar, Crow, under the 550 on purpose), and **The Faceless**, the Endbringer
   as the family meets it (200 HP, Undying). The art is the prologue session's concepts, now in
   `art/heroes/story/`. Both fights finish inside their scripts with nobody down (pinned by
   `test/story.test.ts`): the hunt in two rounds, the clearing in four, the Faceless brought to 1 HP
   by Will after Ren's guided **Rest**, which is the prologue's first Rest. Dialogue is a second
   draft, for the user to rewrite. Ren's and Will's types are decided (§12).
   Boar and Crow are unused, waiting for chapter 2.
4. **Art**, which can run beside steps 1–3 in its own session: swordless Valor, Will, Ren as a
   fighter (each with attack/hurt frames), two or three creatures, the powered-up Endbringer, and
   the fall seen from the ground.
5. **Chapter 2: BUILT 2026-10-18** (§11), on a one-Act layer every later chapter reuses.
6. **An alpha pass:** a full playthrough from a fresh profile into Classic.

**Still needed from the user:** a pass over the dialogue (the user's, in the coming days).

## 15. The Cycle I chapters (PROPOSED, 2026-10-18)

Each chapter is one Act that adds a few mechanics on top of the last, until a player arriving at
Classic has met everything its first act asks of them. The order follows what Classic's Act 1 puts
in front of the player.

| Chapter | Story | Layers in | Map |
|---|---|---|---|
| 1. The Fall | Wild's Edge; Will taken | Moves, targets, the round, switching, Rest | Two scripted fights (built) |
| 2. His Sword | North after the faceless thing; Ren relents | The map, a pick of three, items, levels | Fight, row, fight, row, Elite (built) |
| 3. The Lesson | Ren teaches; the first ally joins | **Types and matchup arrows**, the **patron seat** (Ren as the Swordsman, Trust), **the fork** (Elite or Skirmish, previewed) | Fight, row, patron seat, fork, row, Elite |
| 4. The Hall | A town that survived; supplies, a hire | **Gems** (the Lapidary), **Mastery and the Evolution at five pips**, **the Guild Hall** (gold, gear, mend) | Fight, row, Lapidary, fork, Guild Hall, Elite |
| 5. The Seal | The first Guardian; the seal holds | **The Guardian**, its **Banner**, **the Academy and a Class** | A full Act 1 shape, Guardian at the end |

After chapter 5 the Story points the player at Classic, and the chapters set in Cycles II–V wait
on Classic milestones (§2).

**Chapter 3 is BUILT** (§11b): the ally is **Solace**, the base roster's Light caster.
**Open:** whether chapter 4's hire is a Guild hire the player picks.
