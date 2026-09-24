# tutorial.md — First-Time Tips

> Module of the Titanpact `/docs` suite. Companion to `lore.md` (whose premise the lore card
> states in four lines) and `run-loop.md` (whose every beat is a tip's occasion).
>
> Decided 2026-09-24, per user direction, **replacing the scripted first run** of 2026-09-05
> (Valor-narrated, Valor + Fang forced, a one-node-per-row Act 1 with curated fights, pinned
> payouts and three locks — turned off 2026-09-10 and now deleted whole).

## 1. What it is

There is **no tutorial run**. A player's first run is an ordinary run — the draft rolls, the map
branches, the fights are drawn, the payouts roll — exactly as every later run is.

What a first run adds is information, not structure:

- **The lore card** — four lines, one a tap, ahead of the first draft on an account.
- **First-time tips** — the first time the player meets a mechanic (a screen, a node, a
  situation inside a fight), a short card says what it is and what to do with it. **Once per
  account**, never again.

**Voice.** Tips are plain game-UI text — *video-gamey information*, brief and to the point. Nobody
is speaking: no portrait, no name, no "we", no in-world framing (`test/tips.test.ts` fails on
"we / us / our" in a tip). One or two sentences a page, at most three pages, 180 characters a
page. The lore card is the one place the game speaks as a legend.

## 2. The lore card

```
A Titan cannot be killed.
It can only be put to sleep for 1,000 years.
Our time is up.
We must seal the pact.
```

`LoreScreen` (`src/view/run/LoreScreen.tsx`), full-bleed on the cold open's black, serif, the last
line in the seal's gold. It sits between the title's *Start a Run* and the draft, because its last
line is the draft's verb — the draft's button reads *Seal the Pact*. Shown once an account
(`LORE_TIP_ID` in `Profile.seenTipIds`); the cold open (`TitanWakeScreen`) still plays after every
draft.

## 3. The tips

Content is `src/data/tips.ts`; mechanism is `src/run/tips.ts`; the card is
`src/view/run/TipOverlay.tsx` (centred, dims without blurring so the thing named stays readable,
swallows input until dismissed).

### Screen tips

App.tsx maps the current screen to candidate ids (`screenTipIds`), in priority order, and shows
the first the profile has not seen (`firstUnseenTip`). One card at a time; a screen that is the
first meeting with two things shows the second on its next visit.

| Id | Fires on |
| --- | --- |
| `draft` | the draft |
| `run` | the act's arrival screen |
| `map` | the map |
| `wounds` | the map, once any hero is hurt (HP carries across an act; Mana does not) |
| `fork` | the map, once an Elite or Skirmish is one step away |
| `squad` | lead order (skipped while the roster is two) |
| `levelUp` | the level-up report |
| `item` | the item who-screen (sockets, merge, sell) |
| `companion` | the companion's join beat |
| `fallen` | Permadeath's Fallen beat (Ascension 1) |
| `equipmentReward` | the equipment cache |
| `mentor`, `tutor`, `boon`, `manaWell`, `forge`, `leyLine`, `rest`, `event` | that node's screen |
| `scribe`, `scrollCache` | the Scribe's and the Cache's scroll screens (a bought Scroll gets none — the Guild Hall's tip named it) |
| `shop` | the Guild Hall |
| `recruit` | the Recruit Contract claim (roster cap, termination) |
| `banner`, `crucible` | the Guardian's two beats |
| `seal` | the Pact Seal between acts |
| `locationChoice` | the act-2+ location pick |

None fires over a fight (FightScreen owns those) or over a cinematic (the cold open, the Herald,
the Titan's fall), and none over a recruit's fanfare.

### Fight tips

Checked at the top of every command phase — never between two orders — against a
`FightTipContext` FightScreen derives from live state. List order is priority order.

| Id | When |
| --- | --- |
| `fight.basics` | the first command phase of the first fight: orders, Mana, reading fighters, turn order, holding a move |
| `fight.types` | round 2+: the multiplier on a move, STAB, physical vs magical (with the move-kind glyphs inline) |
| `fight.rest` | a player hero can afford nothing |
| `fight.guardian` | a Guardian fight: the champion waits on the bench |
| `fight.ancient` | an Ancient on the field |
| `fight.bench` | round 2+ with someone benched: bench Mana, switching, lock-in |
| `fight.bag` | round 3+: potions are a free action |
| `fight.knockout` | the first player KO: it persists until a Rest, the mend, a Revive, or the act's end |
| `fight.lockIn` | the player side is locked in |
| `fight.field` | a Field Effect is up |
| `fight.pactClock` | the Pact Clock's warning starts |

Fights outside a run (Quick Battle, the sandbox) show none: they pass no `tips` prop.

## 4. State

`Profile.seenTipIds` — account-wide, not per run, so a tip read in a run that was wiped is not
read again in the next one. Written straight to storage on dismissal (`recordTipSeen`). An id this
build no longer ships is kept, harmlessly. A profile from before the tips decodes with none seen;
its old `tutorialDone` is dropped.

The **Dev menu's Reset Tips** (`resetTips`) clears the list, lore card included, so everything
shows again on its next occasion.

`RunState` carries nothing. The scripted run's `tutorial` and `tutorialSeenBeatIds` are gone; a
save still holding them decodes (the fields are ignored), so no `SAVE_VERSION` bump.

## 5. Adding a tip

1. Write it in `src/data/tips.ts` — a screen tip under `SCREEN_TIPS`, a fight tip in
   `FIGHT_TIPS` at the priority it deserves.
2. A screen tip's id goes in `SCREEN_TIP_IDS` (`src/run/tips.ts`) and in `screenTipIds`
   (App.tsx); the test fails if content and list disagree. A fight tip needing a new signal adds
   a field to `FightTipCondition` and `FightTipContext` and derives it in FightScreen.
3. Check the rule it states against the code — a tip that is wrong is worse than none.

## 6. What was deleted, and why

The scripted run taught through staging: forced starters, a curated corridor, curated
encounters propped up with flat stat grants so a fight would survive its own dialogue, pinned
gold so Valor's shopping advice held, a forced Recruit (Flurry, the physical/magical lesson) and a
forced field slot. Every one of those drifted each time a system moved underneath it (the Forge,
the Scribe, the third reward row, the Titanspawn rewrite) and the script was off from 2026-09-10
because of it. Tips key on **mechanics**, not on a staged act, so a system that moves changes one
card's text rather than a corridor.

Gone: `src/run/tutorial.ts`, `src/data/tutorial.ts`, `TutorialOverlay`, `test/tutorial.test.ts`,
`Profile.tutorialDone`, the two `RunState` fields, the RecruitScreen's `required` offer, the
SquadSelectScreen's pinned heroes, the encounter builder's `scripted` roster. Kept, as generic
test levers: `generateEncounter`'s `forcedHeroIds` and `statGrants`.

## 7. Open questions

- **A first run is the real Act 1.** The curated act guaranteed a survivable opener; now a new
  player meets the same Act 1 wall a veteran does (measured 58–68% cleared under the sim's
  pilots). Whether that needs a first-run softening is for playtest.
- **Clusters.** The first won fight can raise three cards in a row (level report, item,
  then the map's wounds). Each is short; if it reads as a wall, the lower-priority one can wait
  for the next occasion.
- **An opt-out.** There is no player-facing "turn tips off" setting yet — only the Dev reset.
- **Veterans** on an existing profile see every tip once. Deliberate for playtest; a veteran
  heuristic (skip on a profile with a clear) is a one-line change in `decodeProfile` if wanted.
