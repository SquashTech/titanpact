# First Light — the curriculum

> **STATUS: DRAFT (2026-10-27, per user direction), not built.** Replaces the four lessons of
> `docs/the-sky.md` §2c and §6 (`src/data/lessons.ts`): Valor and Fang, the guided Hunt and Clearing,
> and the Road and Fork acts are deleted and started over. Kept: First Light as the gate before the
> full game (§2e), the Ascent, the manual's pages filed by playing (§2c), and Blip.
> Recommended answers to the four open questions are written in as decided-for-draft; each is marked
> **DRAFT CALL** so it can be moved.

## 1. What changes

- **Blip stops talking.** No thought bubbles anywhere in First Light or the tour after it. Blip
  stays on the sky as a wordless companion: it bounces at a win, shows a "!" as a page lands,
  flinches at a KO, squishes when poked. That keeps the skin cosmetic (`docs/cosmetics.md`) alive.
  Blip's idle thoughts on the sky outside First Light are a separate call, not made here.
- **The opening is the lore card again.** `LORE_LINES` (`src/data/tips.ts`), one line a tap, before the
  first lesson. **DRAFT CALL:** the plain card, with the comic page of the fall (`OpeningFall`)
  deleted with it, because it is framed by Blip's narration and ends on Valor and Fang.
  **FLAGGED:** the user remembers four lines; `LORE_LINES` holds six. Cut to four, or keep six?
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
   | 2 | *Moves cost Mana. Rest fills it back up.* | Riptide | Torrent (40 of a 68 pool), then a round holding only Rest, then a second Torrent finishes a level-14 Cubling. |
   | 3 | *Some types hit harder than others.* | Crimson, Raiju | Fire on a Sproutling, Storm on a Puddling; swapped, both foes stand. The target cards' *Bonus!* and *Resist* ranges carry it. |
   | 4 | *Some moves hit both foes at once.* | Cairn | Tremor drops both. |
   | ~~5~~ | *Deleted: folded into lesson 1.* | Skyshear, Hollowbark | Skyshear drops a Cubling before it can swing; aimed the other way, it gets its hit in on slow Hollowbark. |
   | 6 | *Defense stops physical hits. Wisdom stops magic.* | Nightshade, Glyph | The same move in each hand: physical Nightfall through Rillfin's thin hide, magical Nightfall (off-type for Glyph) past Ingot's low Wisdom. Every pairing is neutral; crossed, neither foe falls. |
   | 7 | *A Burn keeps hurting after the hit.* | Cinder | Set Alight, then a Singe that leaves a level-13 Rivetling standing; the round-end Burn tick lands the KO. A full Burn is only 27% of max HP over three rounds, less than one hit, so the lesson shows it finishing a foe. |
   | 8 | *Switch in a hero from the bench.* | Cinder, Clockwork, Raiju (bench) | Cinder steps back from a Puddling; Raiju takes under half the splash. The switch panel's *deals 2× / takes 0.5×* readout carries it. |
   | 9 | *A piece of gear makes its hero stronger.* | Ursa, Drift | The Feral Dagger (Attack +15, Speed +15, Beast Force 5) goes to Ursa on the item screen; her Claw then knocks out a level-13 Cubling that the bare Claw leaves at 24 HP. The target card shows the knockout. |
   | 10 | *Six heroes now. Win it your way.* | Rime, Raiju, Revenant, Sylva, Glyph, Cairn | **The first open fight** (2026-10-27, per user direction): six heroes of six types, nothing guided, the leads the player's to pick on the real lead pick, against four mid-tier spawn (Ravager, Bramblehide, Rillfin, Kindlehide) at level 4 on the enemy AI. It can be lost, and a loss replays it. Measured (directional): an AI-piloted team wins 40 of 40 in about 8 rounds, with about 4 heroes standing. |

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
