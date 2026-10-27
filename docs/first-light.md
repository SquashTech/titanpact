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
| 10 The Road | Free: the act is the player's own, and its new screens get their picture card at the moment. |

3. **Lost → replay.** **DRAFT CALL:** a lesson can be lost; a loss restarts it at once, with no
   result screen. A guided lesson can't be lost, so this applies only to lesson 10's act.
4. **Won → the Learned screen.** The same page lands in the book (`src/run/manual.ts`), Blip
   cheers, the island lights, and the sky moves on to the next one.

**Cast. DRAFT CALL:** heroes from the base 28, picked per concept rather than one recurring pair, so
ten lessons double as a first look at the roster. Blip, on the sky between lessons, is the thread
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
| 10 | **The Road** | the map's row of tiles | One short act: the opener, a reward row, a Skirmish, and its **Recruit Contract** claimed. The map, Contracts and level-ups each get their picture card at the moment they happen. **DRAFT CALL:** Contracts are taught here and not as a lesson of their own. |

**Order.** Each lesson leans only on the ones before it: 1–4 are what every fight needs, 5–8 are what
makes doubles deep, and 9–10 are the run.

**Left for runs to file** (the existing "a run files the rest", `the-sky.md` §2c): Shield, Conduct,
heals, Daze, buffs and debuffs, lock-in, potions, Leads, Wounds, the Pact Clock, Elite or Skirmish,
Patrons, the Guild Hall, the Academy, Gems.

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
- **Time to the full game:** about a minute for each fight, plus the act, comes to roughly 12–15 minutes
  before the Infinite opens. Watch it in playtest; cutting lessons is the dial.
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
   resolves. Lesson 10's act restart is still to do.
3. Lessons 1–4 DONE 2026-10-27 (`data/lessons.ts`, pinned in `test/lessons.test.ts`). Each is one
   guided round unless noted, at Wild's Edge against early spawn:
   - **Move & target**: Crag and Ursa, one attack each, drop an Arcling and a Cubling.
   - **Mana & Rest**: Riptide alone. Torrent costs 40 of a 68 pool. Round 2 holds only Rest, and
     round 3's Torrent finishes a level-14 Cubling. Three rounds.
   - **Types**: Cinder's Fire on a Sproutling, Raiju's Storm on a Puddling. Swapped, both foes stand.
     The target cards' *Bonus!* and *Resist* ranges carry the lesson.
   - **Spread**: Cairn alone. Tremor drops both foes.

   They replace the Hunt. A file that lit the Hunt lights all four on decode (`RETIRED_LESSONS`,
   `run/profile.ts`). The Clearing, the Road and the Fork stay after them until lessons 5–10 land.
   First Light is seven islands meanwhile, on the scrolling climb (§4).

   **Pages:** Turn by Turn files from lesson 1, Mana and Rest from 2, Types from 3, Single and Spread
   from 4. **FLAGGED:** Buffs and Debuffs moved to the Clearing as a stopgap, because no new lesson
   teaches it. The curriculum leaves it for runs to file, but runs file a page only when a status,
   fight event or screen triggers it, and nothing does for a stat stage. It needs a trigger, or a
   lesson.

   Then 5–8, then 9–10.
4. The Ascent at ten, the silent tour, the lore card restored, and the old lessons deleted.
