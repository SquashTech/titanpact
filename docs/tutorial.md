# tutorial.md — First-Time Tips

> Module of the Titanpact `/docs` suite. Companion to `lore.md` (whose premise the lore card
> states in four lines) and `run-loop.md`.
>
> Decided 2026-09-24, per user direction, **replacing the scripted first run** of 2026-09-05
> (Valor-narrated, Valor + Fang forced, a one-node-per-row Act 1 with curated fights, pinned
> payouts and three locks — turned off 2026-09-10 and now deleted whole).
>
> **Cut to three tips 2026-10-13, per user direction** (§3): the number of interruptions was the
> problem, and most cards explained a screen that already said it. Everything they said moved to
> the Reference's **How to Play** page (§5), a backstop for the player who goes looking.

## 1. What it is

There is **no tutorial run**. A player's first run is an ordinary run — the draft rolls, the map
branches, the fights are drawn, the payouts roll — exactly as every later run is.

What a first run adds is information, not structure:

- **The lore card** — four lines, one a tap, ahead of the first draft on an account.
- **Three first-time tips** — the first fight, the first fight with a bench, the first item.
  **Once per account**, never again.

Everything else is taught by the screen it happens on: a label, a button that names what it does,
a quiet mark for a state that lasts, and a line at the moment a state changes. The test for a new
tip is whether the player cannot make the decision in front of them without it. The audience is
mostly experienced players, who get the gist fast; the inquisitive minority has How to Play.

**Voice.** Tips are plain game-UI text — *video-gamey information*, brief and to the point. Nobody
is speaking: no portrait, no name, no "we", no in-world framing (`test/tips.test.ts` fails on
"we / us / our" in a tip or a How to Play section). One or two sentences a page, at most three
pages, 180 characters a page. The lore card is the one place the game speaks as a legend.

## 2. The lore card

```
A Titan cannot be killed.
Sealed, it sleeps for one year.
The year is up.
We must seal the pact.
```

`LoreScreen` (`src/view/run/LoreScreen.tsx`), full-bleed on the cold open's black, serif, the last
line in the seal's gold. It sits between the title's *Start a Run* and the draft, because its last
line is the draft's verb — the draft's button reads *Seal the Pact*. Shown once an account
(`LORE_TIP_ID` in `Profile.seenTipIds`), and each Cycle past the first has its own, once (docs/cycles.md §7).
**The cold open lives here since 2026-10-06** (per user direction): the Titan's eyes open high on
the card over the first line; `TitanWakeScreen`, which played them after every draft, is deleted.

## 3. The tips

Content is `src/data/tips.ts`; mechanism is `src/run/tips.ts`; the card is
`src/view/run/TipOverlay.tsx` (centred, dims without blurring so the thing named stays readable,
swallows input until dismissed).

| Id | Fires on | Says |
| --- | --- | --- |
| `fight.basics` (**Combat**) | the first command phase of the first fight | orders and Speed order; the Mana gem, the MP bar and Rest; the matchup arrows under a move, tap a fighter, hold a move |
| `bench` (**Your Bench**) | the lead pick of the first fight with three or more heroes (FightScreen) | two leads, the rest benched and regaining Mana; the matchup arrows on the pick; Switch costs that hero's turn; no switching once half the side is down |
| `item` (**Items**) | the first item who-screen (App.tsx `screenTipIds`) | kept for the run; three sockets; a second of a family merges; sell |

`bench` merges the old `squad` and `fight.switching` cards so the bench is explained once, at the
decision it governs. Its third page draws the command bar's Switch key, which the lead pick does
not show.

### What replaced the rest (2026-10-13)

| Cut | Now carried by |
| --- | --- |
| `draft`, `map`, `fork`, `banner`, `academy`, `locationChoice` | the screens: the draft's *Choose N more* confirm, labelled map tiles and the preview a tap raises, the pick screens' own layout |
| `run` | the seal's four rings, and How to Play |
| `blessing` | the gold star, and the *Blessing breaks* beat when it is spent |
| `wounds` | the bars on the map's party chips; a downed hero stands out of the light (greyed, no pool of light), and the fight result says *Knocked-out heroes stay down until a Rest, the Guild Hall, a Revive, or the next act* whenever one is down (not in a permadeath Cycle, where the Fallen beat speaks instead) |
| `fallen` | the Cycle picker's line and the Fallen screen's own words |
| `scribe` | the Mastery pips, whose 5th and 10th are drawn as milestones |
| `shop`, `recruit`, `fight.skirmish` | the Guild Hall's labelled counters, the recruit screen's contract pips and *Sign* / *Swap in* buttons, the Skirmish dossier |
| `fight.types`, `fight.attacks` | the Combat card's third page; the move card on hold |
| `fight.stages` | the arrows themselves — **the once-a-round passive rule is learned by watching** (2026-10-13, per user direction) |
| `fight.rest`, `fight.bag`, `fight.field` | the Rest row, the Bag sheet, the field plaque (tap to read) |
| `fight.companion` | the ! on its figure and its seat on the order track; its sheet on tap |
| `fight.ancient` | the matchup arrows, which already show ½ and 1× |
| `fight.pactClock` | the pact warning band and the *pact comes due* beat |

None fires over a cinematic, a recruit's fanfare or any reward screen.

### Scenes

**A fight tip shows a staged picture, never a spotlight on the live board** (2026-10-10, per user
direction). A live board rarely holds the example a page needs — a 2× and a ½× on the same move —
so a page that needs one carries a **scene** (`src/data/tipScenes.ts`, pure data: which heroes,
which moves, what is ringed) drawn by `src/view/run/TipScene.tsx` with the fight's OWN components
(`CombatantCard`, `MoveButtonReplica`, the command bar's classes). It cannot go stale when the
fight's UI changes, and the multipliers it shows are computed from the chart.
`test/tips.test.ts` checks every id a scene names and every multiplier it promises (`expect`).

| Tip | Page | Scene |
| --- | --- | --- |
| `fight.basics` | 2 | Cinder at 30/50 MP over two moves; the gems and the MP bar ringed |
| `fight.basics` | 3 | Crimson's Ember against Sylva (2×) and Leviathan (0.5×); the arrows ringed |
| `bench` | 3 | the command bar; Switch ringed |

### Staging (screen tips)

A screen tip that names something on screen points at it (`src/view/run/tipStaging.ts`, per
page): the named elements are cut out of a darker scrim and ringed, and the card moves to
whichever band hides least of them. A selector that matches nothing lights nothing and the card
sits in the middle. `bench` lights the lead grid and its arrows; `item` the hero cards, the
sockets, then Sell.

Fights outside a run (Quick Battle, the sandbox) show none: they pass no `tips` prop.

### The modes opening (2026-10-13, per user direction) — RETIRED 2026-10-24

**Retired with the doors** (`docs/the-sky.md` phase 4): the sky shows the Trials and the Gauntlet
opening, glimpsed to open, so the beat, its tip id and its stills are deleted. Kept below as history.

The one beat outside a run. **The first title after the win that opens the Trials and the Gauntlet**
(`modesOpenDue`, id `modes.open`) plays it once, on the bare Pact page, after the launch screen and
the install card. It is the moment the state changes, so it is the one place the two doors are
explained; the doors themselves stay quiet (`docs/gauntlet.md` §7).

1. The title dims (everything but the doors, hub bar included) under **Two New Ways to Play**.
2. The doors arrive in their corners, Trials then Gauntlet, each with a ring and `star.reveal`.
3. One stone window a mode: its emblem and wordmark, a **screenshot of that mode's own screen** (the
   Trials teambuilder with six built, the Gauntlet draft at four of six), cut off at the bottom so it
   reads as a window onto more, and two sentences. That mode's door pulses below it; the other dims.
4. *Got it* sinks the window, lifts the dim, and the doors are pressable.

A tap skips the arrival. Copy is `MODES_OPEN_CAPTION` / `MODES_OPEN_PAGES` in `src/data/tips.ts`;
the beat is `src/view/run/ModesOpenBeat.tsx`. **The pictures are stills** (`art/ui/modes/*.webp`,
708×600 at 2x, captured from the real screens), not staged live renders like the fight scenes: the
teambuilder and the draft are whole screens with saves behind them, too heavy to mount as a
picture. The cost is that they go stale when either screen changes, and are re-captured by hand.
An account already past its first clear when this shipped sees the beat once on its next launch.

## 4. State

`Profile.seenTipIds` — account-wide, not per run, so a tip read in a run that was wiped is not
read again in the next one. Written straight to storage on dismissal (`recordTipSeen`). An id this
build no longer ships is kept, harmlessly. A profile from before the tips decodes with none seen;
its old `tutorialDone` is dropped.

The **Dev menu's Reset Tips** (`resetTips`) clears the list, lore card included, so everything
shows again on its next occasion.

`RunState` carries nothing.

## 5. How to Play

The Reference's first tab (`src/view/shared/ReferenceOverlay.tsx`, the page `HowToPlay` in
`referencePages.tsx`), opened from the title's Reference glyph on that tab, and from the map and
the fight's Options on Types as before. Content is `src/data/howToPlay.ts`: one `Tip`-shaped
section a mechanic (`howto.*` ids), a paragraph a page, the same voice and inline tokens as the
tips. Sections are heads, one open at a time; a section's pictures are its `TIP_SCENES` entry, so
every scene the cut tips drew lives on here, still checked by the test.

It is as comprehensive as it likes to be — the rules the tips used to carry, plus what no tip
ever said (levels, Cycles). Nothing raises it; a player has to go and open it, which is the point.

## 6. Adding a tip

Don't, unless §1's test holds: the player cannot make the decision in front of them without it.
A rule worth knowing but not needed at a decision is a How to Play section.

1. Write it in `src/data/tips.ts` — a screen tip under `SCREEN_TIPS`, a fight tip in
   `FIGHT_TIPS` at the priority it deserves. A picture goes in `TIP_SCENES`; a screen tip's
   spotlight in `TIP_STAGING`.
2. A screen tip's id goes in `SCREEN_TIP_IDS` (`src/run/tips.ts`) and in `screenTipIds`
   (App.tsx); the test fails if content and list disagree. A fight tip needing a new signal adds
   a field to `FightTipCondition` and `FightTipContext` and derives it in FightScreen.
3. Check the rule it states against the code — a tip that is wrong is worse than none.

## 7. What was deleted, and why

The scripted run taught through staging: forced starters, a curated corridor, curated
encounters propped up with flat stat grants so a fight would survive its own dialogue, pinned
gold so Valor's shopping advice held, a forced Recruit (Flurry, the physical/magical lesson) and a
forced field slot. Every one of those drifted each time a system moved underneath it and the
script was off from 2026-09-10 because of it. Tips key on **mechanics**, not on a staged act.

The 27-card tip set of 2026-09-24 – 10-12 (fifteen screen tips, twelve fight tips) went the other
way: a card on nearly every first meeting, which stacked into a wall of interruptions across the
first run. Cut to three on 2026-10-13 (§3).

## 8. Open questions

- **A first run is the real Act 1.** A new player meets the same Act 1 wall a veteran does
  (measured 58–68% cleared under the sim's pilots). Whether that needs a first-run softening is
  for playtest.
- **Veterans** on an existing profile see the three tips once (`bench` is a new id). Deliberate.
