# gauntlet.md — The Gauntlet: draft six, one of three at a time, win five before you lose two

> **STATUS: DECIDED 2026-10-07 (per user direction); phase 1 BUILT the same day** — the rules
> (`src/run/gauntlet.ts`), the profile record, the screen (`GauntletScreen`), and the title's three
> doors. Numbers are first pass; §9 lists what is open.
> **2026-10-09 (per user direction): the board of fifteen is six offers of three** (§2) — fifteen at
> once was overwhelming in play — and **no hero is dealt a move over its Mana pool** (§3).

A third mode beside **Seal the Pact** (the roguelike, Classic in code) and **the Trials**
(Constructed). Six times the game offers three heroes the player owns, each in a random Evolution
with a random kit, and the player takes one; the six fight random six-hero teams until they have **five wins
or two losses**. Five wins stars every unstarred path on the team.

---

## 0. Why this exists

- **The three modes are three skills.** Seal the Pact is resource management across an hour; the
  Trials are building with everything chosen; the Gauntlet is **drafting and piloting** with
  nothing chosen but the six. Each mode is the one where its skill is the whole game.
- **Path stars are a grind against draft luck.** A path is starred by a Classic clear in which the
  hero was drafted, kept, and evolved down that path. The Gauntlet hands the player forms they have
  never finished in, and pays for winning with them.
- **References.** Pokémon Emerald's **Battle Factory** (rental sets, a streak) is the closest —
  a VGC-adjacent precedent for exactly this. Hearthstone Arena for the economy: a ticket, a record,
  a reward on the record. MTG Sealed for the board: every option seen at once.

---

## 1. Decided

| Rule | Decision |
|---|---|
| Gate | Opens on the first **Cycle I** clear — the same gate as the Trials (`isGauntletOpen`). |
| The draft | Six offers of three, one taken from each; **owned only** (the whole Collection, not the deck). Unowned heroes never appear in it. |
| Each hero | A random Evolution path and a random kit; the player picks six. |
| The run | Fight random six-hero teams; **five wins** clear, **two losses** end it. |
| Reward | **Nothing below five wins.** A clear stars every path on the team not already starred, and pays a flat clear bonus. |
| Stars | A Gauntlet star is an ordinary path star — it **opens the hero in the Trials** (the hero gate) and adds to the balance. |
| Entry | **One free entry a day**; further entries cost stars. |

---

## 2. The draft

**Six offers of three** (`OFFER_SIZE`, `rollOffer`, `draftPick`), one taken from each — 18 heroes
seen. It was a board of fifteen seen at once (MTG Sealed); in play that was overwhelming, and a pick
of one from three (Hearthstone Arena) asks one question at a time. Each offer is drawn as hero–path
pairs from every hero the account owns:

- **One a hero.** A hero is offered once in a run, taken or not (`GauntletRun.seen`).
- **Three primary types an offer**, and **never a type the team already holds two of**
  (`TEAM_TYPE_LIMIT`), so the six can be built around the chart rather than against it. Where an
  account's heroes run short the type rules give way before the offer does.
- **Unstarred first, not only.** A pair the account has not starred weighs `UNSTARRED_WEIGHT` = 3
  against a starred pair's 1. A filter would run dry late on an account and, before that, skew every
  offer toward the forms the player has done worst with. An offer marks unstarred paths, so the
  choice between the strong team and the missing star is in front of the player.
- **Always evolved.** A path is what the draft is for; an unevolved hero has no star to win.
- **Fixed by the seed and the pick number**, and stored on the run, so a reload shows the same three.
  An offer reads the team so far (the type rule), so it is rolled when the pick before it is made.

The six seats sit above the three cards. A card shows the form, typing and kit; a tap opens the hero
read-only (path, typing, innate, kit, stats) with Draft on it. A run saved under the board drafts on
from the board's first three.

## 3. A rolled hero

A Gauntlet hero is the Trials' `TeamSlot` — **level 30, Mastery 10, the expected growth line** —
so the engine and the fight builder never learn a third mode exists. Rolled (`rollGauntletSlot`):

- **The path**: the offer's pair.
- **The kit**: `MOVE_CAP` = 4 moves off the same pool the Trials' builder offers
  (`constructedMovePool`). **The signature is always held** — it is the hero at level 30 — and the
  path's own move is always held; the rest are rolled.
- **Fit, not trap**: a damage move off the hero's offensive stat (Attack, or Intelligence, read
  after a rewire) weighs a quarter; Late moves weigh 3, Mid 2, Early 1. An off-stat move can still
  turn up — that is allowed (off-stat moves are fine) — but a whole off-stat kit is a roll the
  weights make vanishingly rare. At least two of the four deal damage.
- **Castable** (2026-10-09): no move costing more than the form's Mana pool at level 30 is ever
  dealt, either side. The roll weights Late moves up and the Late moves are the dear ones, so 40 of
  252 forms could be handed one they could never cast — Judgment 120 on a pool of 88, Overdrive 100
  on 62. The rule is the Trials' (`docs/constructed.md` §3), where Gems can lift the pool instead.
- **No items**, either side. Items double each offer's density, and symmetric absence is fair.

## 4. The run

- **Record**: `wins` and `losses`; `WINS_TO_CLEAR` = 5, `LOSSES_TO_END` = 2. At most six fights.
- **The opponent** is rolled per fight from a seed fixed at entry, so the preview IS the fight and a
  reload shows the same team. It is drawn from **the whole catalog** — a stranger can stand across
  from you, as in Classic — rolled by the same `rollGauntletSlot`.
- **Escalation, a rule not a number**: the opponent's six are picked from `6 + 3 × wins` rolled
  candidates, scored by how well their typing answers **your six** (the same doubling arithmetic as
  the lead-pick arrows). At 0 wins it is any six; at 4 wins it is the six of eighteen that hit you
  hardest. *The Gauntlet learns you.* Levels, stats and AI are identical every fight.
- **The AI is the escalation's second half** (2026-10-07, per user direction — a third loss was
  weighed and rejected): below `PILOT_FROM_WINS` = 3 wins the opponent plays on Classic's AI
  (run/ai.ts); from three wins on, the Trials' pilot (run/pilot.ts) flies it
  (`gauntletAiPilot`). Losses never move it, so a run that stumbles early stays on the easier AI.
  Its leads are its two best-scoring heroes. The player picks leads in the fight, as everywhere.
- **Whole every fight.** No Wounds, no carried KOs, no potions.
- **A place to stand** (2026-10-07, per user direction): each fight borrows a run Location for its
  backdrop and music, rolled off the same seed as the opponent (`gauntletLocationId`) from every place
  but the Threshold. Presentation only.
- **A fight left unfinished is a loss.** Leaving a Gauntlet fight, or the app closing during one,
  forfeits it — otherwise a bad opening is a free reroll. `GauntletRun.fighting` is set at the fight's
  start and read on return.
- **Retire** ends the run at its record. It pays what that record pays: nothing, below five.

## 5. Rewards

**Nothing below five wins** (decided). A clear pays:

- **A path star for every hero–path on the team not already starred**, recorded in
  `Profile.evolutionStars` exactly as a Classic clear records one. The star is coloured **Cycle I**:
  the higher Cycles' colours stay Seal the Pact's to give.
- **`GAUNTLET_CLEAR_BONUS` = 5 stars**, into `bonusStars` (2026-10-07, per user direction: slightly
  above the entry), so a clear with an already-starred team still pays, and a bought entry cleared is
  a profit.

A Gauntlet star opens its hero in the Trials (decided). That makes the Gauntlet the second road into
the Trials, beside Classic, and amends `docs/constructed.md` §1's *"Classic earns heroes"* to
*"winning earns heroes"*.

## 6. Entry

- **One free entry a day, never stacked** (per user direction): a blanket free run for the local
  calendar day, either claimed or not (`gauntletFreeDay` holds the day it was claimed). A day missed
  is not two tomorrow, and it is never a ticket that can be held.
- **A further entry costs `GAUNTLET_ENTRY_PRICE` = 3 stars**, recorded as a count
  (`gauntletEntriesBought`) that `starsSpent` charges, the way the Starfall's ledger entries are.
- **One run at a time.** Entering is refused while one is open.

So a cleared bought entry nets 2 stars plus its path stars; a 4–2 is the 3 stars lost.
If 4–2 proves to feel bad in play, the reserve fix is **four wins refunds the entry** — not a reward,
the stake back.

## 7. The title: three doors

The Play page carries three doors: **Seal the Pact** (the press that has always been there — the
Cycle picker sits behind it), **The Trials**, **The Gauntlet**. On a new account the two smaller
doors stand locked, each with a padlock; a tap says what opens it. Collection and Constellation stay
shared, outside the doors. The teambuilder's own title becomes **The Trials** in every player-facing
string; `constructed` stays the code name.

## 8. Phases

1. **BUILT 2026-10-07** — `src/run/gauntlet.ts` (board, kit, opponent, record, rewards, entry),
   the profile fields, the star ledger, `GauntletScreen` (hub → board → between fights → result), the
   fight wiring, the three doors, tests.
2. **MEASURED 2026-10-07** (`scripts/sim/gauntlet.ts`, 500 runs a row, the base 42 owned, the AI on
   run/pilot.ts as shipped, the player opening on the two that best answer the enemy's leads):

   | Player pilot | Draft | Escalation | Fight 1 won | Clear |
   |---|---|---|---|---|
   | skilled (sim pilot) | chart | as shipped | 49% | **8%** |
   | skilled | chart | none | 49% | 10% |
   | skilled | random | as shipped | 43% | 6% |
   | skilled | random | none | 43% | 13% |
   | chart (Classic's AI) | either | either | 12% | 0% |

   - **The format is the number.** Five wins before two losses clears 11% of attempts for a player
     who wins half its fights, 16% at 55%, 23% at 60%. The skilled pilot wins ~46% against the
     shipped AI, so it clears ~8% — one free entry in twelve. A fifth needs ~58% a fight.
   - **The escalation works as meant**: without it a team that wins keeps winning more (52–62% by the
     fourth fight); with it the rate holds flat near 45% whatever the record. It costs 2–7 points of
     clear.
   - **The draft barely moves it** in the sim — chart against random is +4–6 points a fight — because
     the sim drafts on typing alone.
   - **The Trials' AI outplays Classic's** by a wide margin: a player at Classic-AI skill wins one fight
     in nine and never clears.
   - 3.5 fights a run, 18 rounds a fight (the Trials: 14.6), no stalemates.

   **Decided the same day: the AI escalates** (a third loss rejected). Swept on the skilled pilot,
   chart draft — the wins from which the Trials' pilot flies the opponent against the clear:

   | Pilot from | 0 (as measured above) | 2 | **3 (shipped)** | 4 | 5 |
   |---|---|---|---|---|---|
   | Clear | 8% | 16% | **22%** | 35% | 53% |

   At 3: the first three fights are won ~77% of the time and the last two ~45%, so the run reads
   as a climb into a wall — most runs end at three wins (35%), a fifth go 5-0. A random draft
   clears 14%; the Classic-AI-level pilot 1%, winning ~45% early and ~13% once the pilot flies.
3. A record in Records: Gauntlets entered, cleared, best streak.
4. Purchased entries for money, if ever — after the star price has been played.

## 9. Open — first-pass numbers and calls

- `BOARD_SIZE` 15, `BOARD_TYPE_LIMIT` 2, `UNSTARRED_WEIGHT` 3.
- `GAUNTLET_CLEAR_BONUS` 5 against `GAUNTLET_ENTRY_PRICE` 3 — the bonus sits just above the entry on purpose.
- The escalation step, 3 candidates a win.
- **Opponents from the whole catalog** rather than the owned Collection — a recommendation, since
  the "owned only" rule was decided for the board. Owned-only is a one-line switch (`gauntletOpponent`).
- **Forfeit on an unfinished fight** — strict on a phone that kills the app. The alternative is
  resuming the fight, which no mode yet does.
- Items stay out until the board's density has been played.
