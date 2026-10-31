# First Light — the curriculum

> **STATUS: BUILT (2026-10-27), nine lessons; reviewed and revised 2026-10-29 (§0).** Replaces the
> four lessons of `docs/the-sky.md` §2c and §6 (`src/data/lessons.ts`): Valor and Fang, the guided
> Hunt and Clearing, and the Road and Fork acts are deleted. Kept: First Light as the gate before the
> full game (§2e), the Ascent, the manual's pages filed by playing (§2c), and Blip. Where §1–§6 below
> disagree with §0, §0 is what the game does.

## 0. The review pass (2026-10-29, per user direction)

A play-through as a new account found the lessons themselves working and the material around them
not. All eight findings were fixed:

1. **Lesson 1's page is about lesson 1.** Turn by Turn is two pages: pick a move, then who it hits
   (Crag's Rock Toss and the Arcling, the move and the foe ringed); then fastest first, tap a
   fighter, hold a move. The once-a-round passive rule moved out (now on Passives, below). The
   five-label move picture is gone.
2. **The opening says it once.** The fall (`OpeningFall`, wordless panels) stays, and the Welcome
   is two pages that no longer retell it: what a run is, then what First Light is. A welcome page
   says *Tap to continue* until its last, which says *Tap to begin*. The six-line lore card stays unplayed.
3. **A lesson retires the run tip it taught.** Winning Equipment marks the `item` tip seen, and the
   open fight marks `bench` (`TIPS_A_LESSON_RETIRES`, App.tsx), as every lesson already did for `fight.basics`.
4. **A page a choice needs opens at the choice.** The Map, Levels and Moves, and Recruiting
   (`ManualPage.atDecision`) open over their screen the first time it is reached, instead of landing
   on a later fight's Learned row after the choice is made. Every other run page still waits for a
   won fight. Kept to three on purpose: the rest of a run's screens label themselves (`docs/tutorial.md` §1).
5. **Equipment shows the difference.** Two fights: bare, Ursa's Claw takes two hits to drop a
   level-13 Cubling; the Feral Dagger goes on; armed, the same Claw takes one. The page opens over
   the item screen, the beat the lesson is about.
6. **The pictures match.** Items has no drawn picture; it lights the live item screen behind it
   (the piece, the heroes, the sockets). Leads keeps the party roll and lights the live lead pick's
   arrows on its second page, not a move's.
7. **Docs.** This section, `docs/tutorial.md` and `docs/the-sky.md` say what is built.
8. **Small edges.** Mana is Pixie's Arcane Blast (60 of a ~74 pool) on a level-15 Pebbling throwing
   plain Rock Tosses: Riptide's Drag lowered Speed on every Water hit, an arrow nothing had taught.
   Pixie's innate is quiet alone, and a test pins that the lesson moves no stat and lands no status.
   A tap swallowed while the hand flew in did not reproduce on a second play-through.

**The open fight is smaller** (same day, per user direction): four heroes the lessons cast, each
holding only the move it was taught with (Crimson's Ember, Raiju's Thunderclap, Cairn's Tremor,
Ursa's Claw), against three foes at level 4 that each throw one plain hit (Ravager's Pounce,
Bramblehide's Rock Toss, Rillfin's Splash): on their own kits they Poisoned the party and laid a
field in the first rounds. Its line is *Four heroes now. Win it your way.* Measured (directional):
every lead pair wins 30 of 30 under both sim pilots, in 2–5 rounds, against about 8 for the
six-hero version.

**Passives are named after the open fight** (same day, per user direction). Cairn's Waystone (Shield
10 on his partner at each round end) is the one thing in the open fight no lesson had shown. Cairn
stays: seeing a passive fire by name, as a Pokémon ability announces itself, is the right first
meeting, and a lesson built on it would teach two things, the passive and Shield. The open fight
files a second page, **Passives** (every hero has one, it works by itself, its name shows when it
fires; tap a hero to read it; once a round), which opens over the Learned screen after the win
(`ManualPage.afterFight`) rather than before the first tap, and wears Waystone's mark. The
once-a-round line moved there from Buffs and Debuffs. Shield's own page still waits for a run.

**Second play-through** (2026-10-30, per user direction). Fixed:
- **The install card holds the sky.** On a phone the card used to land a second into the fall, which
  then started lesson 1 by itself and took the card away unread; the card came back over lesson 1's
  lighting. The sky now waits while the card is up (`TitleScreen`'s `held`), so the fall plays after it.
- **A page's spotlight lights the screen, never its own picture.** Status Effects and Switching
  drew their `.status-badge` / switch button inside the picture, which drew rings over empty
  mid-screen and pushed the card over the lesson's line.
- **Lesson 5 throws Splash**, not Crest: Crest's self-Shield read *Rillfin's Shield breaks*.
- **Equipment's seed is 1826**: on 1809 the bare Claw landed a Bleed and left the Cubling on 1 HP,
  so the Dagger read as one point of damage. Now no Bleed, and the bare Claw leaves it on 25.
- **A kit under four moves is drawn at a full kit's size** (per user direction), as Rest-only now
  is too: the console's rows are always four, the empty ones bare stone. The guide hand re-measures
  its target and lands on the smaller card unchanged.

**Lessons are quiet** (same day, per user direction): a guided lesson fights with no innate on either
side and no foe wears the Titan's Mark (`StoryFight.quietSides`, `RosterEntry.innateQuiet`). The open
fight quiets its foes only, so the heroes' own innates fire there for the Passives page after it.

Open, for the designer: lesson 6's Burn finish leans on a seeded Singe crit;
Single and Spread's second and third pages teach effect figures, Shield and random damage that the
lesson never uses; lesson 1's hits overkill fourfold and show *Bonus!* before Types.

## 1. What changes

- **Blip stops talking.** No thought bubbles anywhere in First Light or the tour after it. Blip
  stays on the sky as a wordless companion: it bounces at a win, shows a "!" as a page lands,
  flinches at a KO, squishes when poked. That keeps the skin cosmetic (`docs/cosmetics.md`) alive.
  Blip's idle thoughts on the sky outside First Light are a separate call, not made here.
- **The opening** was drafted as the lore card in place of the fall. Not built: the fall stays and
  the Welcome follows it (§0.2).
- **One concept, one page, one fight.** A lesson teaches exactly one idea and files exactly one page.
  The page is shown before the fight and filed after it. Under the old curriculum a lesson filed
  five or six.
- **Pictures first.** The picture is the guided fight itself (§2), with one line. The page
  filed to the manual is that line and a still of the fight's key frame. The rule that a page never
  talks about this particular fight (`the-sky.md` §2c) stands.

Reference games: **Plants vs. Zombies** (each level introduces one thing with a picture card,
then a board where that thing is the answer), **Marvel Snap** (onboarding by unlocking, almost no
text), **Into the Breach** (a small board, set up so the answer is findable) and **Hearthstone's** first missions (the hand points, the one right play is the only one open).

## 2. The shape of a lesson

> **Revised after the first full playtest, 2026-10-27, per user direction.**
> - **A lesson opens on its How to Play page.** The page shows in the tip box, with its picture,
>   before the first tap: over the field, over the item screen in lesson 8, and over the lead pick in
>   lesson 9. The hand waits behind it. The line on the top bar alone was easy to miss; it stays as a
>   reminder. The same page lands on the Learned screen after the win. (`StoryChapterScreen`; the
>   page shows each time a lesson is played.)
> - **Turn order is no longer its own lesson.** Lesson 1's Turn by Turn page now says the round plays
>   out fastest first and that the track across the top shows the order. The Turn Order lesson and
>   its page are deleted, and First Light is **nine** lessons. Lesson numbers below that say 6–10 are
>   now 5–9.
> - **A won run fight shows one How to Play page at most** (`LEARNED_A_WIN`, `FightScreen`). This
>   fight's first meeting comes before anything a screen filed earlier, and the rest wait for later wins.
>   A run's first map and fight used to land four or more pages at once.
> - **Pictures for every lesson page.** Items shows the Gear counter's roster, each hero marked
>   with what the piece would do there: take it, merge it, or replace a piece. Leads shows the open
>   fight's six, then Raiju against its two leads with a green arrow and a red.
> - **A Welcome before the first lesson, once an account** (`WELCOME_TIP`, per user direction): four
>   lines in the welcome look. A Titan has woken; heroes rise against it; a run is the road to it;
>   First Light teaches the fight. The device install card is retitled *Install Titanpact* so the
>   game says welcome once. It still comes first, because on iOS the browser's progress doesn't carry
>   to the installed app.
> - **Next Lesson on the Learned screen** (2026-10-28, per user direction). The main button plays
>   the next lesson at once; *Back to the Sky* is the second. The island still lights, and the sky
>   plays every lighting it hasn't shown on the next visit. The last lesson offers only the way back,
>   since First Light's finale plays on the sky.

**The lesson's picture is its own fight. DECIDED 2026-10-27, per user direction**, picked from
`art/concepts/lesson-pages/` (*On the Field*). It replaces a separate picture card: a card, a plate
or a manual leaf were tried there and read as unlike the game.

1. **The guided fight is the demo. DECIDED 2026-10-27, per user direction.** There is no ghost
   finger playing ahead of the player. The lesson opens on its own fight, laid out exactly as any
   fight is: the arena, the nameplates, the strip, the move console and the Back / Switch / Rest /
   Bag row. The one line sits on the top bar in place of the turn-order track, so it covers nothing
   on the field. The hand points and the player taps through the concept themselves, for example a
   move, then a target card, then the round resolving. It uses the screen's own readouts wherever
   they already teach the concept: lesson 3 points at the target cards' damage ranges, and lesson 2
   greys out a move card and lights Rest. The comparison page's ghost finger stands in for the
   player's own taps, and its *Your turn* hand-off is retired.
2. **The fight is guided.** It lasts one to three rounds. The heroes hold only the moves the lesson
   needs, and the board is set so the concept is the way to win.

**Most lessons are GUIDED. DECIDED 2026-10-27, per user direction**, the way the Valor and Fang
lessons were. The pointing hand leads the player's own taps, and every control but the one it points
at is locked. This reuses Stories' machinery as it stands: `guidedAction` (`src/run/story.ts`) holds
each hero to one command a round, a cue's `point: true` draws the hand at the move and then its target,
and a round past the script is the player's own.

| Lessons | How they play |
|---|---|
| 1–8 | Guided throughout: every round the hand points and the player taps. |
| 9 Equipment | Guided: the who-screen's tap, then the fight's decisive hit. |
| 10 The first fight | Free: a full team of six, the leads the player's to pick, nothing guided. |

3. **Lost → replay.** **DRAFT CALL:** a lesson can be lost; a loss restarts it at once, with no
   result screen. A guided lesson can't be lost, so this applies only to lesson 10.
4. **Won → the Learned screen.** The same page lands in the book (`src/run/manual.ts`), Blip
   cheers, the island lights, and the sky moves on to the next one.

**Cast. DECIDED 2026-10-27, per user direction:** heroes from the base 28, picked per concept rather
than one recurring pair, so ten lessons double as a first look at the roster. No team fields two heroes
of one type (§6). Blip, on the sky between lessons, is the thread
that runs through them.

## 3. The curriculum

| # | Concept | Page (the picture) | The fight |
|---|---|---|---|
| 1 | **Move & target** | a move tile → a foe's frame lighting | 2v2, one move each. One foe is nearly down; hitting it first wins. |
| 2 | **Mana & Rest** | the mana bar draining, then Rest refilling it | A big move empties the pool. Rest is the only option left, then the big move lands again. |
| 3 | **Type matchups** | type icon → type icon, a big hit and a small one | A Fire hero against a Nature foe and a Water foe. The Nature foe is the answer. |
| 4 | **Single vs Spread** | one arrow against two | Two weak foes. A spread clears both in one round; a single hit would take two. |
| 5 | **Turn order** | the order track, the fast hero first | A foe is about to KO a hero. A faster hero or a priority move gets there first. |
| 6 | **Physical vs Magical** | Attack → Defense, Intelligence → Wisdom | A foe with a wall of Defense and paper Wisdom; the Int move is the answer. A foe built for this fixes the playtest note at the end of `the-sky.md` §2c. |
| 7 | **Status effects** | Burn's three pips running out | One status, Burn, on a foe that would otherwise outlast you. |
| 8 | **Switching** | a hero stepping back, the bench refilling mana | The lead is in a bad matchup; swap in the benched hero, who comes in with full mana. |
| 9 | **Equipment** | a piece going into a socket, and its Force on a hit | **DRAFT CALL:** a who-screen with one piece, then a fight where that piece's Force tips the decisive hit. Elemental Force is taught here, not on its own. |
| 10 | **The first fight** | the lead pick | **DECIDED 2026-10-27, per user direction:** the first truly open fight, a full team of six against four, nothing guided. The Road act it replaced is retired; the map, Recruit Contracts and level-ups are taught by a run's own screens the first time it reaches them (§6). |

**Order.** Each lesson leans only on the ones before it: 1–4 are what every fight needs, 5–8 are what
makes doubles deep, 9 is the run's gear, and 10 is all of it at once.

**Left for runs to file** (the existing "a run files the rest", `the-sky.md` §2c): Shield, Conduct,
heals, Daze, buffs and debuffs, lock-in, potions, the map, Wounds, levels, the Pact Clock, Elite or
Skirmish, Patrons, Recruiting, the Guild Hall, the Academy, Gems.

## 4. Second-order questions

- **The Ascent is a climb you scroll. DECIDED 2026-10-27, per user direction**, picked from
  `art/concepts/first-light-climb/` (A, *The climb to the Pact*), replacing the squeezed trail. The
  islands zigzag up a tall sky from the foot to the ring's gap, one lesson a step (`CLIMB_STEP`,
  `SkyChart.tsx`). The Pact keeps its own box at the top, drawn at the scale it is sealed at, so the
  climb's top is the title as it will be. The stage opens on the lesson about to light or play next,
  and a lighting scrolls up the climb as it plays. The draw-in scrolls to the Pact before the trail
  folds into it.
  - The logo stays pinned above the scroll, where the mock had it scroll with the climb.
  - The galaxy follows the ring.
  - **Not yet played:** the draw-in and fold at the end. They need a sealed First Light, which no
    longer exists until lessons 5–10 land.
- **The tour after the finale** (`FIRST_LIGHT_TOUR`) is all Blip lines today. Silent, it is a
  pointing hand at *Call to the Stars*, then at the Pact and the Infinite.
- **Time to the full game:** estimated (not measured) at about 13–17 minutes: roughly 8 minutes of
  guided fights, 3–5 for the open fight, and the rest the stops between lessons. **Trimmed 2026-10-27,
  per user direction:** a lesson skips the VS card, and the lighting playback between lessons is about
  half as long (charge, burst, path and wake all faster). Cut stops before cutting lessons; if lesson 10
  plays long, drop it to three foes.
- **Stardust:** First Light pays 300 when sealed (`the-sky.md` §10, still FLAGGED). Spread over ten
  lessons, or still paid at the seal? Unchanged until decided.
- **Pages are prose today** (`src/data/howToPlay.ts`). Each of the ten becomes its line and a still
  of its guided fight's key frame. That frame is the real fight screen, so this needs no PixelLab spend.
- **Old accounts.** An account with First Light lit keeps it lit and its pages (`manualComplete`);
  the ten new pages are filed for it on decode.

## 5. What it deletes

`lesson-hunt`, `lesson-clearing`, the Road and Fork acts, `LESSON_CAST`'s Valor and Fang, the guided
cues' spoken lines, Blip's First Light thoughts and hello premise, `OpeningFall` and its comic panels
(`art/` stays on disk until the user says otherwise), and the 5–6-page curriculum table in
`the-sky.md` §2c.

## 6. Build order (proposed)

1. ~~A comparison page for the lesson's picture, pages 1–3.~~ Done: On the Field (§2).
2. ~~The lesson machinery.~~ Done 2026-10-27: a fight beat's `line` (`run/story.ts`) shows on the top
   bar in the order track's place while the player commands, and the track returns while the round
   resolves. A beat's `handOver` plays the real item screen before its fight: only the named hero can
   take the piece, Sell is hidden, and the hand points at the hero and then *Continue*.
3. ~~All ten lessons.~~ DONE 2026-10-27 (`data/lessons.ts`, pinned in `test/lessons.test.ts`), at
   Wild's Edge. Lessons 1–9 are guided; each has a test that the concept is what wins.

   | # | Line | Cast | What happens |
   |---|---|---|---|
   | 1 | *Pick a move, then pick who it hits.* | Crag, Ursa | Each drops its own foe. |
   | 2 | *Moves cost Mana. Rest fills it back up.* | Pixie | Arcane Blast (60 of a ~74 pool), then a round holding only Rest, then a second Blast finishes a level-15 Pebbling (§0.8; it was Riptide's Torrent). |
   | 3 | *Some types hit harder than others.* | Crimson, Raiju | Fire on a Sproutling, Storm on a Puddling; swapped, both foes stand. The target cards' *Bonus!* and *Resist* ranges carry it. |
   | 4 | *Some moves hit both foes at once.* | Cairn | Tremor drops both. |
   | ~~5~~ | *Deleted: folded into lesson 1.* | Skyshear, Hollowbark | Skyshear drops a Cubling before it can swing; aimed the other way, it gets its hit in on slow Hollowbark. |
   | 6 | *Defense stops physical hits. Wisdom stops magic.* | Nightshade, Glyph | The same move in each hand: physical Nightfall through Rillfin's thin hide, magical Nightfall (off-type for Glyph) past Ingot's low Wisdom. Every pairing is neutral; crossed, neither foe falls. |
   | 7 | *A Burn keeps hurting after the hit.* | Cinder | Set Alight, then a Singe that leaves a level-13 Rivetling standing; the round-end Burn tick lands the KO. A full Burn is only 27% of max HP over three rounds, less than one hit, so the lesson shows it finishing a foe. |
   | 8 | *Switch in a hero from the bench.* | Cinder, Clockwork, Raiju (bench) | Cinder steps back from a Puddling; Raiju takes under half the splash. The switch panel's *deals 2× / takes 0.5×* readout carries it. |
   | 9 | *Without gear, it takes two hits.* then *A piece of gear makes its hero stronger.* | Ursa | Two fights (§0.5): bare, two Claws drop a level-13 Cubling; the Feral Dagger (Attack +15, Speed +15, Beast Force 5) goes to Ursa on the item screen; armed, one Claw does. |
   | 10 | *Four heroes now. Win it your way.* | Crimson, Raiju, Cairn, Ursa | **The first open fight**: nothing guided, the leads the player's to pick on the real lead pick, each hero holding only the move a lesson taught it, against Ravager, Bramblehide and Rillfin at level 4 on the enemy AI, each holding one plain hit. It can be lost, and a loss replays it. Was six heroes against four (2026-10-27); cut to four against three on 2026-10-29 (§0). |

   **Casts. DECIDED 2026-10-27, per user direction:** no team fields two heroes of one type (pinned
   by test), and the casts spread across the base roster rather than leaning on a few heroes.

   **A lesson with a bench needs two leads, or none.** With one lead the game opens on *Choose a
   replacement* to fill the empty slot. Pinned by test.

   **Retired: the Hunt, the Clearing, the Road and the Fork** (the last two 2026-10-27, per user
   direction, when lesson 10 became the open fight). A file that lit one lights the lessons that
   replaced it (`RETIRED_LESSONS`, `run/profile.ts`). First Light is nine islands (since the Turn Order fold) and ends on the open
   fight. The Infinite opens on lesson 8.

   **Pages, one concept a lesson:** Turn by Turn (1), Mana and Rest (2), Types (3), Single and Spread
   (4), Physical and Magical (6), Status Effects and Burn (7), Switching (8),
   Items (9), Leads (10). Everything else is filed by a run the first time it meets it:
   - **Fight triggers:** a stat moving a step files Buffs and Debuffs (`stage`, `run/manual.ts`); a
     heal files Heals (`heal`).
   - **Statuses:** Shield, Conduct and Daze are filed when first met, like every other status.
   - **Screens:** the first map files The Map, Wounds and Elite or Skirmish; the first run fight files
     The Bag; the first level-up, patron screen and recruit screen file Levels and Moves, Patrons and
     Recruiting.

   **Deleted 2026-10-27, per user direction:** the Story *act* machinery (`StoryAct`, its map and run,
   `RunState.story`, the chapter's resume beat, and every branch that switched a run feature off during
   an act) and the Story cast (`data/storyCast.ts`: the lesson Valor, the stag, the fox and Winter's
   Breath). A Story is now fight beats only. Their art is archived in `art/archive/story-cast/`. The Turn by
   Turn page's picture was recast from the lesson Valor to lesson 1's Crag and Arcling.
4. The Ascent at ten (DONE, §4), the silent tour, the lore card restored. The old lessons are deleted.
