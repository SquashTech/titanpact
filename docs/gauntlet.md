# gauntlet.md — The Gauntlet: draft six from fifteen, win five before you lose two

> **STATUS: DECIDED 2026-10-07 (per user direction); phase 1 BUILT the same day** — the rules
> (`src/run/gauntlet.ts`), the profile record, the screen (`GauntletScreen`), and the title's three
> doors. Numbers are first pass; §9 lists what is open.

A third mode beside **Seal the Pact** (the roguelike, Classic in code) and **the Trials**
(Constructed). The game rolls fifteen heroes the player owns, each in a random Evolution with a
random kit; the player drafts six; the six fight random six-hero teams until they have **five wins
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
| The board | Fifteen heroes, **owned only** (the whole Collection, not the deck). Unowned heroes never appear on it. |
| Each hero | A random Evolution path and a random kit; the player picks six. |
| The run | Fight random six-hero teams; **five wins** clear, **two losses** end it. |
| Reward | **Nothing below five wins.** A clear stars every path on the team not already starred, and pays a flat clear bonus. |
| Stars | A Gauntlet star is an ordinary path star — it **opens the hero in the Trials** (the hero gate) and adds to the balance. |
| Entry | **One free entry a day**; further entries cost stars. |

---

## 2. The board

**Fifteen** (`BOARD_SIZE`), drawn as hero–path pairs from every hero the account owns:

- **One a hero.** A hero never appears twice, in two forms or one.
- **At most two of a primary type** (`BOARD_TYPE_LIMIT`), so the board spans at least eight types
  and a team can be built around the chart rather than against it.
- **Unstarred first, not only.** A pair the account has not starred weighs `UNSTARRED_WEIGHT` = 3
  against a starred pair's 1. A filter would run dry late on an account and, before that, skew every
  board toward the forms the player has done worst with. The board marks unstarred paths, so the
  choice between the strong team and the missing star is in front of the player.
- **Always evolved.** A path is what the board is for; an unevolved hero has no star to win.

Five rows of three fits the portrait screen. A tap opens the hero read-only (path, typing, innate,
kit, stats); a second control drafts it.

## 3. A rolled hero

A Gauntlet hero is the Trials' `TeamSlot` — **level 30, Mastery 10, the expected growth line** —
so the engine and the fight builder never learn a third mode exists. Rolled (`rollGauntletSlot`):

- **The path**: the board's pair.
- **The kit**: `MOVE_CAP` = 4 moves off the same pool the Trials' builder offers
  (`constructedMovePool`). **The signature is always held** — it is the hero at level 30 — and the
  path's own move is always held; the rest are rolled.
- **Fit, not trap**: a damage move off the hero's offensive stat (Attack, or Intelligence, read
  after a rewire) weighs a quarter; Late moves weigh 3, Mid 2, Early 1. An off-stat move can still
  turn up — that is allowed (off-stat moves are fine) — but a whole off-stat kit is a roll the
  weights make vanishingly rare. At least two of the four deal damage.
- **No items**, either side. Items double the board's density, and symmetric absence is fair.

## 4. The run

- **Record**: `wins` and `losses`; `WINS_TO_CLEAR` = 5, `LOSSES_TO_END` = 2. At most six fights.
- **The opponent** is rolled per fight from a seed fixed at entry, so the preview IS the fight and a
  reload shows the same team. It is drawn from **the whole catalog** — a stranger can stand across
  from you, as in Classic — rolled by the same `rollGauntletSlot`.
- **Escalation, a rule not a number**: the opponent's six are picked from `6 + 3 × wins` rolled
  candidates, scored by how well their typing answers **your six** (the same doubling arithmetic as
  the lead-pick arrows). At 0 wins it is any six; at 4 wins it is the six of eighteen that hit you
  hardest. *The Gauntlet learns you.* Levels, stats and AI are identical every fight.
- **The AI** is the Trials' pilot (`aiPilot`). Its leads are its two best-scoring heroes. The
  player picks leads in the fight, as everywhere.
- **Whole every fight.** No Wounds, no carried KOs, no potions.
- **A fight left unfinished is a loss.** Leaving a Gauntlet fight, or the app closing during one,
  forfeits it — otherwise a bad opening is a free reroll. `GauntletRun.fighting` is set at the fight's
  start and read on return.
- **Retire** ends the run at its record. It pays what that record pays: nothing, below five.

## 5. Rewards

**Nothing below five wins** (decided). A clear pays:

- **A path star for every hero–path on the team not already starred**, recorded in
  `Profile.evolutionStars` exactly as a Classic clear records one. The star is coloured **Cycle I**:
  the higher Cycles' colours stay Seal the Pact's to give.
- **`GAUNTLET_CLEAR_BONUS` = 3 stars**, into `bonusStars`, so a clear with an already-starred team
  still pays — and pays back a bought entry.

A Gauntlet star opens its hero in the Trials (decided). That makes the Gauntlet the second road into
the Trials, beside Classic, and amends `docs/constructed.md` §1's *"Classic earns heroes"* to
*"winning earns heroes"*.

## 6. Entry

- **One free entry a day** (local calendar day, `gauntletFreeDay`). It does not bank: a day missed is
  not two tomorrow.
- **A further entry costs `GAUNTLET_ENTRY_PRICE` = 3 stars**, recorded as a count
  (`gauntletEntriesBought`) that `starsSpent` charges, the way the Starfall's ledger entries are.
- **One run at a time.** Entering is refused while one is open.

So a clear always returns a bought entry (3 = 3) plus its path stars; a 4–2 is the 3 stars lost.
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
2. Measure in the sim: clear rate at the chart and skilled pilots, and whether the escalation step
   (3 candidates a win) holds a 5-0 near a fifth of attempts.
3. A record in Records: Gauntlets entered, cleared, best streak.
4. Purchased entries for money, if ever — after the star price has been played.

## 9. Open — first-pass numbers and calls

- `BOARD_SIZE` 15, `BOARD_TYPE_LIMIT` 2, `UNSTARRED_WEIGHT` 3.
- `GAUNTLET_CLEAR_BONUS` 3 and `GAUNTLET_ENTRY_PRICE` 3 — they are set equal on purpose.
- The escalation step, 3 candidates a win.
- **Opponents from the whole catalog** rather than the owned Collection — a recommendation, since
  the "owned only" rule was decided for the board. Owned-only is a one-line switch (`gauntletOpponent`).
- **Forfeit on an unfinished fight** — strict on a phone that kills the app. The alternative is
  resuming the fight, which no mode yet does.
- Items stay out until the board's density has been played.
